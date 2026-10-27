/**
 * auth-login.test.ts — Đăng nhập bằng SĐT hoặc email + bootstrap admin.
 *
 * Mock ở ranh giới prisma-client. Không cần DB thật.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

// ── Prisma mock ───────────────────────────────────────────────────────────────
const userFindUnique = vi.fn();
const userCreate = vi.fn();
const userUpdate = vi.fn();
const orgFindFirst = vi.fn();
const orgCreate = vi.fn();

vi.mock('../src/shared/database/prisma-client.js', () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => userFindUnique(...a),
      create: (...a: unknown[]) => userCreate(...a),
      update: (...a: unknown[]) => userUpdate(...a),
    },
    organization: {
      findFirst: (...a: unknown[]) => orgFindFirst(...a),
      create: (...a: unknown[]) => orgCreate(...a),
    },
    // $transaction chạy callback với chính đối tượng tx = prisma mock
    $transaction: async (fn: (tx: unknown) => unknown) => fn({
      user: { create: (...a: unknown[]) => userCreate(...a) },
      organization: {
        findFirst: (...a: unknown[]) => orgFindFirst(...a),
        create: (...a: unknown[]) => orgCreate(...a),
      },
    }),
    $disconnect: vi.fn(),
  },
}));
vi.mock('../src/shared/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { login } from '../src/modules/auth/auth-service.js';
import { ensureBootstrapAdmin } from '../src/modules/auth/ensure-admin.js';

const PASSWORD = 'Tt17072021@@';
// canonical 84918100192 tương ứng SĐT 0918100192
const ADMIN_PHONE_CANON = '84918100192';

async function makeAdminRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-admin',
    orgId: 'org-1',
    email: '0918100192@zalocrm.local',
    phone: ADMIN_PHONE_CANON,
    passwordHash: await bcrypt.hash(PASSWORD, 12),
    role: 'owner',
    isActive: true,
    ...overrides,
  };
}

beforeEach(() => {
  userFindUnique.mockReset();
  userCreate.mockReset();
  userUpdate.mockReset();
  orgFindFirst.mockReset();
  orgCreate.mockReset();
});

describe('login() — SĐT hoặc email', () => {
  it('đăng nhập bằng SĐT (0918100192) → tra theo phone canonical', async () => {
    const admin = await makeAdminRow();
    userFindUnique.mockImplementation(({ where }: any) =>
      where.phone === ADMIN_PHONE_CANON ? admin : null,
    );

    const payload = await login('0918100192', PASSWORD);
    expect(payload).toMatchObject({ id: 'user-admin', role: 'owner', orgId: 'org-1' });
    // Phải tra bằng phone canonical, không phải email
    expect(userFindUnique).toHaveBeenCalledWith({ where: { phone: ADMIN_PHONE_CANON } });
  });

  it('đăng nhập bằng các format SĐT khác nhau đều ra cùng canonical', async () => {
    const admin = await makeAdminRow();
    userFindUnique.mockImplementation(({ where }: any) =>
      where.phone === ADMIN_PHONE_CANON ? admin : null,
    );
    for (const id of ['0918100192', '+84918100192', '84918100192', '0918.100.192']) {
      const p = await login(id, PASSWORD);
      expect(p.id).toBe('user-admin');
    }
  });

  it('đăng nhập bằng email vẫn hoạt động', async () => {
    const admin = await makeAdminRow({ email: 'boss@shinsulab.com' });
    userFindUnique.mockImplementation(({ where }: any) =>
      where.email === 'boss@shinsulab.com' ? admin : null,
    );
    const payload = await login('Boss@ShinSuLab.com', PASSWORD);
    expect(payload.id).toBe('user-admin');
    expect(userFindUnique).toHaveBeenCalledWith({ where: { email: 'boss@shinsulab.com' } });
  });

  it('sai mật khẩu → 401', async () => {
    userFindUnique.mockResolvedValue(await makeAdminRow());
    await expect(login('0918100192', 'sai-mat-khau')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('không tồn tại user → 401', async () => {
    userFindUnique.mockResolvedValue(null);
    await expect(login('0900000000', PASSWORD)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('user bị khoá (isActive=false) → 401', async () => {
    userFindUnique.mockResolvedValue(await makeAdminRow({ isActive: false }));
    await expect(login('0918100192', PASSWORD)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('ensureBootstrapAdmin()', () => {
  const OLD_ENV = { ...process.env };
  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      BOOTSTRAP_ADMIN_PHONE: '0918100192',
      BOOTSTRAP_ADMIN_PASSWORD: PASSWORD,
      BOOTSTRAP_ADMIN_RESET_PASSWORD: 'false',
    };
  });

  it('bỏ qua khi thiếu ENV', async () => {
    delete process.env.BOOTSTRAP_ADMIN_PHONE;
    const r = await ensureBootstrapAdmin();
    expect(r.status).toBe('skipped');
  });

  it('tạo mới admin + org khi DB trống', async () => {
    userFindUnique.mockResolvedValue(null); // chưa có admin
    orgFindFirst.mockResolvedValue(null);   // DB trống
    orgCreate.mockResolvedValue({ id: 'org-new', name: 'Shin Su Lab' });
    userCreate.mockResolvedValue({ id: 'user-new' });

    const r = await ensureBootstrapAdmin();
    expect(r.status).toBe('created');
    expect(orgCreate).toHaveBeenCalled();
    // Phone phải lưu canonical + role owner
    const createArg = userCreate.mock.calls[0][0].data;
    expect(createArg.phone).toBe(ADMIN_PHONE_CANON);
    expect(createArg.role).toBe('owner');
    expect(createArg.orgId).toBe('org-new');
  });

  it('gắn admin vào org có sẵn khi DB đã có org', async () => {
    userFindUnique.mockResolvedValue(null);
    orgFindFirst.mockResolvedValue({ id: 'org-existing', name: 'Cũ' });
    userCreate.mockResolvedValue({ id: 'user-new' });

    const r = await ensureBootstrapAdmin();
    expect(r.status).toBe('created');
    expect(orgCreate).not.toHaveBeenCalled();
    expect(userCreate.mock.calls[0][0].data.orgId).toBe('org-existing');
  });

  it('idempotent — admin đã tồn tại thì bỏ qua, KHÔNG đổi mật khẩu', async () => {
    userFindUnique.mockResolvedValue(await makeAdminRow());
    const r = await ensureBootstrapAdmin();
    expect(r.status).toBe('existed');
    expect(userCreate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('kích hoạt lại admin bị khoá (isActive=false)', async () => {
    userFindUnique.mockResolvedValue(await makeAdminRow({ isActive: false }));
    userUpdate.mockResolvedValue({});
    const r = await ensureBootstrapAdmin();
    expect(r.status).toBe('existed');
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: true }) }),
    );
  });

  it('RESET_PASSWORD=true → cập nhật lại mật khẩu admin đã có', async () => {
    process.env.BOOTSTRAP_ADMIN_RESET_PASSWORD = 'true';
    userFindUnique.mockResolvedValue(await makeAdminRow());
    userUpdate.mockResolvedValue({});
    const r = await ensureBootstrapAdmin();
    expect(r.status).toBe('password_reset');
    expect(userUpdate.mock.calls[0][0].data.passwordHash).toBeTypeOf('string');
  });
});
