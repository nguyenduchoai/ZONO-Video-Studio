# Phase 02 — PLAN: Architecture and contracts

## Context Links
- App bootstrap: `/Users/martin/conductor/workspaces/zalocrm/delhi/backend/src/app.ts`
- Prisma schema: `/Users/martin/conductor/workspaces/zalocrm/delhi/backend/prisma/schema.prisma`
- Auth middlewares: `/Users/martin/conductor/workspaces/zalocrm/delhi/backend/src/modules/auth/`
- Settings/API UI: `/Users/martin/conductor/workspaces/zalocrm/delhi/frontend/src/views/ApiSettingsView.vue`

## Overview
- Priority: P2
- Status: planned
- Goal: lock Prisma, backend module structure, routes, provider boundaries, frontend UI shape.

## Key Insights
- Existing module style is route-first, simple function exports.
- Existing schema heavily org-scoped; new tables must follow `orgId` scoping.
- Existing UI patterns use composables + direct axios wrapper.

## Requirements
### Functional
- CRUD integration configs by org.
- Manual sync trigger + sync logs query.
- Telegram: send test + event notifications.
- Google Sheets: contact export sync (v1), optional import as stretch.
- Provider status check endpoint.

### Non-functional
- Keep files <200 LOC where possible.
- Role access: owner/admin for write ops.
- Deterministic sync behavior and observable errors.

## Architecture
### Prisma schema (proposed)
```prisma
model Integration {
  id               String   @id @default(uuid())
  orgId            String   @map("org_id")
  provider         String   // telegram | google_sheets | facebook
  name             String
  enabled          Boolean  @default(true)
  config           Json     @default("{}") // non-secret config only
  status           String   @default("inactive") // inactive|active|error
  lastSyncAt       DateTime? @map("last_sync_at")
  lastSyncStatus   String?   @map("last_sync_status") // success|partial|failed
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  org              Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  syncLogs         IntegrationSyncLog[]

  @@unique([orgId, provider, name])
  @@map("integrations")
}

model IntegrationSyncLog {
  id               String   @id @default(uuid())
  integrationId    String   @map("integration_id")
  orgId            String   @map("org_id")
  direction        String   // export|import
  triggerType      String   // manual|scheduled|event
  recordCount      Int      @default(0)
  status           String   // success|partial|failed
  message          String?
  detail           Json     @default("{}")
  createdAt        DateTime @default(now()) @map("created_at")

  integration      Integration @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  org              Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId, createdAt])
  @@map("integration_sync_logs")
}
```

### Secret handling boundary
- Keep integration metadata in `Integration.config`.
- Keep sensitive tokens/keys in `AppSetting` with namespaced keys:
  - `integration:{integrationId}:telegram_bot_token`
  - `integration:{integrationId}:google_service_account`
- API responses always return masked secret states only (`hasToken: true/false`).

### Backend module structure (proposed)
```
backend/src/modules/integrations/
  integration-routes.ts
  integration-service.ts
  integration-validator.ts
  provider-registry.ts
  providers/
    base-provider.ts
    telegram-provider.ts
    google-sheets-provider.ts
    facebook-provider.ts      # stub in MVP, no full OAuth
  sync/
    sync-engine.ts
    sync-log-service.ts
```

### Routes (proposed)
- `GET /api/v1/integrations`
- `POST /api/v1/integrations`
- `GET /api/v1/integrations/:id`
- `PUT /api/v1/integrations/:id`
- `DELETE /api/v1/integrations/:id`
- `POST /api/v1/integrations/:id/test`
- `POST /api/v1/integrations/:id/sync`
- `GET /api/v1/integrations/:id/logs`

Role policy:
- Read: authenticated org members.
- Write/test/sync/delete: `requireRole('owner', 'admin')`.

### Provider boundary contract
```ts
interface IntegrationProvider {
  provider: 'telegram' | 'google_sheets' | 'facebook';
  validateConfig(input: unknown): { ok: boolean; errors?: string[] };
  testConnection(ctx: ProviderContext): Promise<{ ok: boolean; message: string }>;
  runSync(ctx: ProviderContext): Promise<{ status: 'success'|'partial'|'failed'; recordCount: number; detail?: unknown }>;
}
```

### Frontend config UI (proposed)
- New view: `frontend/src/views/IntegrationsView.vue`
- New components:
  - `frontend/src/components/integrations/IntegrationList.vue`
  - `frontend/src/components/integrations/IntegrationConfigDialog.vue`
  - `frontend/src/components/integrations/IntegrationLogTable.vue`
- New composable:
  - `frontend/src/composables/use-integrations.ts`
- Router + nav entry:
  - route `/integrations`
  - sidebar item in `DefaultLayout.vue`

## Related Code Files
### Modify
- `backend/prisma/schema.prisma`
- `backend/src/app.ts`
- `frontend/src/router/index.ts`
- `frontend/src/layouts/DefaultLayout.vue`

### Create
- `backend/src/modules/integrations/*`
- `frontend/src/views/IntegrationsView.vue`
- `frontend/src/components/integrations/*`
- `frontend/src/composables/use-integrations.ts`

### Delete
- None

## Implementation Steps
1. Finalize schema + migration plan.
2. Define provider interface + registry.
3. Design routes and request/response contracts.
4. Design UI list + config + logs interaction.
5. Lock acceptance criteria for MVP cut.

## Todo List
- [ ] Confirm route naming with existing API conventions.
- [ ] Confirm secret persistence approach accepted by team.
- [ ] Confirm Facebook provider as stub or omitted.

## Success Criteria
- Schema, route contracts, module boundaries, UI flow are all explicit.
- Dev can implement with no major unknown.

## Risk Assessment
- Risk: provider complexity leaks into route handlers.
- Mitigation: strict provider interface + registry pattern.

## Security Considerations
- JWT + org scoping on all integration routes.
- Mask secrets and never return raw token content.
- Add payload validation before writing config.

## Next Steps
- Move to phased build order with narrow MVP slices.

## Unresolved questions
- Should non-admin users see sync logs or only admin roles?
