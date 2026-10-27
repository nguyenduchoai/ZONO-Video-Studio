/**
 * permission-group-routes.ts — RBAC Phase Phân Quyền 2026-05-21
 * REST endpoints cho PermissionGroup CRUD + matrix update.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../auth/auth-middleware.js';
import {
  getOrgPermissionGroups,
  getPermissionGroup,
  createPermissionGroup,
  updatePermissionGroup,
  archivePermissionGroup,
  userHasGrant,
} from './permission-group-service.js';
import { RESOURCES, ACTIONS, RESOURCE_ACTIONS, type Resource, type Action } from './permission-types.js';

// TEMP RBAC guard (D8 sẽ extract thành middleware chính thức)
function requireGrant(resource: Resource, action: Action) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) return reply.status(401).send({ error: 'unauthorized' });
    const allowed = await userHasGrant(user.userId ?? user.id, resource, action);
    if (!allowed) return reply.status(403).send({ error: `Forbidden: ${resource}.${action}` });
  };
}

export async function registerPermissionGroupRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/permission-groups — full tree
  app.get('/api/v1/permission-groups', { preHandler: authMiddleware }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) return reply.status(401).send({ error: 'unauthorized' });
    const tree = await getOrgPermissionGroups(user.orgId);
    return reply.send({ tree });
  });

  // GET /api/v1/permission-groups/meta — return matrix shape (resources + actions)
  // Dùng cho frontend render UI matrix
  app.get('/api/v1/permission-groups/meta', { preHandler: authMiddleware }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) return reply.status(401).send({ error: 'unauthorized' });
    return reply.send({
      resources: RESOURCES,
      actions: ACTIONS,
      resourceActions: RESOURCE_ACTIONS,
    });
  });

  // GET /api/v1/permission-groups/:id
  app.get('/api/v1/permission-groups/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) return reply.status(401).send({ error: 'unauthorized' });
    const { id } = request.params as { id: string };
    const group = await getPermissionGroup(user.orgId, id);
    if (!group) return reply.status(404).send({ error: 'not_found' });
    return reply.send({ group });
  });

  // POST /api/v1/permission-groups
  app.post('/api/v1/permission-groups', { preHandler: [authMiddleware, requireGrant('permission_group', 'create')] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) return reply.status(401).send({ error: 'unauthorized' });
    const body = (request.body ?? {}) as {
      name?: string;
      parentId?: string | null;
      cloneFromId?: string;
      grants?: any;
    };
    try {
      const group = await createPermissionGroup({
        orgId: user.orgId,
        name: body.name ?? '',
        parentId: body.parentId ?? null,
        cloneFromId: body.cloneFromId,
        grants: body.grants,
      });
      return reply.send({ ok: true, group });
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });

  // PATCH /api/v1/permission-groups/:id
  app.patch('/api/v1/permission-groups/:id', { preHandler: [authMiddleware, requireGrant('permission_group', 'edit')] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) return reply.status(401).send({ error: 'unauthorized' });
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      name?: string;
      parentId?: string | null;
      displayOrder?: number;
      grants?: any;
    };
    try {
      const group = await updatePermissionGroup({
        orgId: user.orgId,
        id,
        name: body.name,
        parentId: body.parentId,
        displayOrder: body.displayOrder,
        grants: body.grants,
      });
      return reply.send({ ok: true, group });
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });

  // DELETE /api/v1/permission-groups/:id
  app.delete('/api/v1/permission-groups/:id', { preHandler: [authMiddleware, requireGrant('permission_group', 'delete')] }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) return reply.status(401).send({ error: 'unauthorized' });
    const { id } = request.params as { id: string };
    try {
      await archivePermissionGroup(user.orgId, id);
      return reply.send({ ok: true });
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });
}
