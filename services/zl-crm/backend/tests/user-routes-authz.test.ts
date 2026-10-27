/**
 * user-routes-authz.test.ts — Regression tests for phase 06.
 *
 * Verifies the per-role field allowlist on PUT /api/v1/users/:id and the
 * generic-error response on unique-constraint violations (removes the
 * cross-org email enumeration oracle).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

// Per-test user identity.
let currentUser = { id: 'me-1', orgId: 'org-1', role: 'member' as string, email: 'me@x' };

vi.mock('../src/modules/auth/auth-middleware.js', () => ({
  authMiddleware: async (req: any) => { req.user = currentUser; },
}));

const userUpdateMock = vi.fn();
const userCreateMock = vi.fn();

vi.mock('../src/shared/database/prisma-client.js', () => ({
  prisma: {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      update: userUpdateMock,
      create: userCreateMock,
    },
  },
}));

const { userRoutes } = await import('../src/modules/auth/user-routes.js');
const { Prisma } = await import('@prisma/client');

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(userRoutes);
  await app.ready();
  return app;
}

function p2002(): Error {
  // Simulate Prisma's unique-constraint violation for tests.
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on email',
    { code: 'P2002', clientVersion: 'test', meta: { target: ['email'] } },
  );
}

describe('PUT /api/v1/users/:id — field allowlist', () => {
  beforeEach(() => {
    userUpdateMock.mockReset();
    userCreateMock.mockReset();
    userUpdateMock.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'target', email: 't@x', fullName: 'T', role: 'member', isActive: true, teamId: null, ...data }),
    );
    currentUser = { id: 'me-1', orgId: 'org-1', role: 'member', email: 'me@x' };
  });

  it('member can update own fullName', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/me-1',
      payload: { fullName: 'New Name' },
    });
    expect(res.statusCode).toBe(200);
    expect(userUpdateMock).toHaveBeenCalled();
    const { data } = userUpdateMock.mock.calls[0][0];
    expect(data).toEqual({ fullName: 'New Name' });
    await app.close();
  });

  it('member CANNOT change own email (403)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/me-1',
      payload: { email: 'hijack@victim.tld' },
    });
    expect(res.statusCode).toBe(403);
    expect(userUpdateMock).not.toHaveBeenCalled();
    await app.close();
  });

  it('member CANNOT change own teamId (403)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/me-1',
      payload: { teamId: 'team-other' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('member CANNOT change own role (403)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/me-1',
      payload: { role: 'owner' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('admin can change another user email', async () => {
    currentUser = { id: 'admin-1', orgId: 'org-1', role: 'admin', email: 'a@x' };
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/target-1',
      payload: { email: 'new@x' },
    });
    expect(res.statusCode).toBe(200);
    const { data } = userUpdateMock.mock.calls[0][0];
    expect(data).toEqual({ email: 'new@x' });
    await app.close();
  });

  it('admin CANNOT change own email (400, prevent self-lockout)', async () => {
    currentUser = { id: 'admin-1', orgId: 'org-1', role: 'admin', email: 'a@x' };
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/admin-1',
      payload: { email: 'new@x' },
    });
    expect(res.statusCode).toBe(400);
    expect(userUpdateMock).not.toHaveBeenCalled();
    await app.close();
  });

  it('admin CANNOT change role (only owner can — 403)', async () => {
    currentUser = { id: 'admin-1', orgId: 'org-1', role: 'admin', email: 'a@x' };
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/target-1',
      payload: { role: 'admin' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('owner can change role + isActive of another user', async () => {
    currentUser = { id: 'owner-1', orgId: 'org-1', role: 'owner', email: 'o@x' };
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/target-1',
      payload: { role: 'admin', isActive: false },
    });
    expect(res.statusCode).toBe(200);
    const { data } = userUpdateMock.mock.calls[0][0];
    expect(data).toEqual({ role: 'admin', isActive: false });
    await app.close();
  });

  it('returns generic error on unique constraint violation (no enumeration)', async () => {
    currentUser = { id: 'admin-1', orgId: 'org-1', role: 'admin', email: 'a@x' };
    userUpdateMock.mockRejectedValueOnce(p2002());
    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/target-1',
      payload: { email: 'collision@x' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string };
    // Generic — must not mention "exists", "đã tồn tại", or the email itself.
    expect(body.error).not.toMatch(/exist|tồn tại|collision/i);
    await app.close();
  });
});

describe('POST /api/v1/users — create with collision returns generic error', () => {
  beforeEach(() => {
    userCreateMock.mockReset();
    currentUser = { id: 'admin-1', orgId: 'org-1', role: 'admin', email: 'a@x' };
  });

  it('does NOT leak cross-org email existence', async () => {
    userCreateMock.mockRejectedValueOnce(p2002());
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      payload: {
        email: 'exists-in-other-org@example.com',
        fullName: 'X',
        password: 'secret123',
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: string };
    expect(body.error).not.toMatch(/exist|tồn tại/i);
    await app.close();
  });
});
