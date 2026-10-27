# Code Review: Integration Hub (Sprint S6)

**Branch:** `dmman16pn/integration-hub`
**Date:** 2026-03-29
**Reviewer:** code-reviewer agent

---

## Scope

| File | LOC | Status |
|------|-----|--------|
| `backend/prisma/schema.prisma` (Integration + SyncLog models) | ~30 | New |
| `backend/src/modules/integrations/integration-routes.ts` | 137 | New |
| `backend/src/modules/integrations/sync-engine.ts` | 73 | New |
| `backend/src/modules/integrations/providers/google-sheets.ts` | 74 | New |
| `backend/src/modules/integrations/providers/telegram-bot.ts` | 68 | New |
| `backend/src/modules/integrations/providers/facebook.ts` | 79 | New |
| `backend/src/modules/integrations/providers/zapier-webhook.ts` | 67 | New |
| `backend/src/app.ts` (2 lines: import + register) | 2 | Modified |
| `frontend/src/views/IntegrationsView.vue` | 288 | New |
| `frontend/src/router/index.ts` (1 route added) | ~5 | Modified |
| `frontend/src/layouts/DefaultLayout.vue` (1 nav item) | ~1 | Modified |

Total new code: ~817 LOC

---

## Overall Assessment

The integration hub delivers a functional CRUD + manual-sync scaffold with clean provider separation. Auth scoping (JWT + orgId) is applied correctly on all routes. The shape is consistent with existing modules. However, three issues require fixes before production ship: credentials are returned in plaintext from the GET list endpoint, the Zapier `webhookUrl` is fetched from user-supplied config without SSRF validation, and write/delete/sync routes lack the role guard that the rest of the codebase uses for sensitive operations.

---

## Critical Issues

### C1 — Credentials returned raw in GET /api/v1/integrations response

**File:** `integration-routes.ts` lines 20–24

The GET list query does a full `findMany` with no `select` filter, including the `config` JSON column which contains `apiKey`, `botToken`, `pageAccessToken`. These values are serialised and sent to the browser on every page load.

**Impact:** Any authenticated user (including `member` role) can see all integration secrets for the org.

**Existing pattern for reference:** `webhook-settings-routes.ts` masks the API key and webhook secret before returning them.

**Fix:** Apply a `select` projection that excludes `config` in the list response, or mask known secret fields before responding. The detail/sync endpoints do not need to return config either — they only need it internally.

```ts
// Minimal safe select for list
select: {
  id: true, orgId: true, type: true, name: true,
  enabled: true, lastSyncAt: true, createdAt: true, updatedAt: true,
  syncLogs: { take: 5, orderBy: { createdAt: 'desc' } },
}
```

---

### C2 — SSRF via user-controlled webhookUrl in zapier-webhook.ts

**File:** `providers/zapier-webhook.ts` lines 18–19, 48

`webhookUrl` is stored in `config` by the user and passed directly to `fetch()` with no validation. An attacker can set `webhookUrl` to an internal address (`http://localhost:3000/`, `http://169.254.169.254/latest/meta-data/`) and trigger it via the sync endpoint.

**Impact:** Server-side request forgery against internal services or cloud metadata endpoints.

**The plan itself flagged this:** Phase 04 security checklist item: "Prevent SSRF risk: validate outbound webhook/sheet endpoints if configurable."

**Fix:** Validate `webhookUrl` is HTTPS and the hostname is not a private/loopback address before making the request. A minimal check:

```ts
const parsed = new URL(webhookUrl);
if (parsed.protocol !== 'https:') throw new Error('webhookUrl must use HTTPS');
const blocked = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/;
if (blocked.test(parsed.hostname)) throw new Error('webhookUrl target is not allowed');
```

---

## High Priority

### H1 — No role guard on write/delete/sync endpoints

**File:** `integration-routes.ts` lines 33, 55, 82, 99

POST (create), PUT (update), DELETE, and POST sync are protected only by `authMiddleware` (JWT). The existing codebase consistently applies `requireRole('owner', 'admin')` on all non-read operations that manage shared org resources (see: `team-routes.ts`, `zalo-access-routes.ts`, `org-routes.ts`, `zalo-sync-routes.ts`).

**Impact:** A `member` role user can create/modify/delete integrations and trigger syncs that export all org contacts to an external endpoint.

**Fix:** Add per-route role guard following existing pattern:

```ts
app.post('/api/v1/integrations', {
  preHandler: [authMiddleware, requireRole('owner', 'admin')],
}, async (request, reply) => { ... });
```

The GET list and GET logs can remain member-accessible (read-only). The `config` masking from C1 still applies.

---

### H2 — Google Sheets uses API key auth (write requires OAuth, API key is read-only)

**File:** `providers/google-sheets.ts` lines 51–58

The Sheets API v4 `values.update` (PUT) requires OAuth 2.0 credentials — API keys only support read access. Using an API key for a PUT request will consistently return a 403 from Google.

**Impact:** The Google Sheets sync will always fail silently with a Sheets API 403, recording a `failed` sync log. Users will configure this provider and see it never work.

**Fix:** The comment in the file says "Uses simple API key auth for public/shared sheets" — this is incorrect for write operations. The config shape and UI need to change to accept a service account JSON key (or OAuth token), not a simple API key. This is a known unresolved question from `plan.md`. Recommend either: (a) downscoping to service account credentials, or (b) marking Google Sheets as "coming soon" until proper OAuth is implemented.

---

### H3 — N+1 query in facebook.ts for upsert-by-metadata

**File:** `providers/facebook.ts` lines 51–68

For each participant across all conversations (up to 100 conversations × N participants), a separate `prisma.contact.findFirst` with JSON path filtering is executed. There is no index on `metadata->>'facebook_id'`, so each query is a full-table JSON scan.

**Impact:** For an org with 10k+ contacts and a page with 100 conversations, this is 200+ sequential full-table-scan queries on the `contacts` table. The sync will be slow and expensive.

**Fix:** Collect all participant IDs first, query once using `hasSome` or raw IN, then create missing contacts in a batch `createMany`.

---

## Medium Priority

### M1 — `sync-engine.ts` log write is outside error boundary — can throw after provider fails

**File:** `sync-engine.ts` lines 55–69

`prisma.syncLog.create` and `prisma.integration.update` are outside the `try/catch` that wraps provider execution. If either DB call throws (network blip, constraint error), the error propagates to the route handler uncaught, returning a 500 with no log written.

**Impact:** Failed syncs may not be recorded, violating the plan's requirement "verify provider failures always write IntegrationSyncLog."

**Fix:** Wrap the log persistence in its own `try/catch` so a DB failure during log writing does not mask the sync result.

---

### M2 — `facebook.ts` always returns `'success'` status even when 0 records imported

**File:** `providers/facebook.ts` line 73

```ts
return { direction: 'import', recordCount: imported, status: imported > 0 ? 'success' : 'success' };
```

The ternary is a dead expression — both branches return `'success'`. Zero-record runs should return `'partial'` or a distinct status so operators can distinguish "ran and found nothing new" from "ran and imported contacts."

**Fix:** Replace with `status: imported > 0 ? 'success' : 'partial'`.

---

### M3 — Google Sheets export hardcoded to 5000 contacts with no pagination

**File:** `providers/google-sheets.ts` line 29

`take: 5000` is applied unconditionally. Google Sheets has a 5M cell limit per spreadsheet, but more critically, loading 5000 full contact records into memory on every sync (each with a `metadata` JSON blob) can spike memory if the org is large. There is no configurable limit or incremental sync.

**Impact:** Memory spike for large orgs; Sheets API request body may exceed limits for wide rows.

**Fix (medium term):** Accept an optional `maxRows` config field, default to 1000. Document the 5000 hard cap.

---

### M4 — No timeout on outbound fetch calls

**Files:** all four providers

None of the `fetch()` calls set a timeout via `AbortController`. If an external service hangs, the Node.js event loop will hold the connection open indefinitely.

**Fix:** Pass `signal: AbortSignal.timeout(15_000)` to each `fetch()` call. Available natively in Node 18+.

---

### M5 — Plan Phase 04 TODO list not completed

`plans/260329-0040-s6-integration-hub/phase-04-review-security-and-design.md` shows three unchecked items:

```
- [ ] API contract review pass completed.
- [ ] Security review pass completed.
- [ ] UX empty/error state review completed.
```

These should be marked complete (or explicitly deferred) before the PR is shipped.

---

## Low Priority

### L1 — Frontend `Integration.config` typed as `Record<string, any>`

**File:** `IntegrationsView.vue` line 149

The `config` field on the `Integration` interface is `Record<string, any>`. Given secrets in `config` should not be returned (see C1), this field should either be removed from the frontend type entirely or typed as `Record<string, never>` until a masked-shape contract is defined.

---

### L2 — `handleDelete` in IntegrationsView.vue does not close dialog on error

**File:** `IntegrationsView.vue` lines 260–272

On delete failure, `error.value` is set and `saving.value` is cleared, but `showDelete` remains `true`, so the delete dialog stays open with no visible error (the error alert is outside the dialog). The user sees a spinner disappear but no feedback inside the dialog.

**Fix:** Either surface `dialogError` inside the delete dialog, or close the dialog and show the global error.

---

### L3 — `sheetName` path segment not sanitised before URL construction

**File:** `providers/google-sheets.ts` line 52

`sheetName` (user-supplied config) is embedded in the Sheets range string and then passed to `encodeURIComponent`. `encodeURIComponent` handles special characters, so injection risk here is low. However, a sheet name containing `!` or `'` could produce a malformed range. This is cosmetic but worth noting.

---

### L4 — Telegram uses MarkdownV1 parse mode

**File:** `providers/telegram-bot.ts` line 52

`parse_mode: 'Markdown'` uses the legacy Telegram MarkdownV1 parser. Telegram's own docs recommend `MarkdownV2` for new bots. MarkdownV1 can silently fail to render if any character in the message collides with reserved markdown syntax (e.g. data values containing `*` or `_`). Low risk here since the message is static, but future dynamic content (e.g. contact names in notifications) could break rendering unexpectedly.

---

## Edge Cases Found by Scout (Pre-review Analysis)

1. **Concurrent sync triggers:** Two users click "Đồng bộ" simultaneously on the same integration. `runSync` has no locking — both will run concurrently. For Google Sheets this causes two PUT requests to the same cell range, last-write wins. For Facebook import, the `findFirst` + `create` pattern is not atomic — two goroutines can both find `!existing` and both call `create`, resulting in a unique-constraint violation on `metadata->>'facebook_id'` (there is no DB unique constraint) or duplicate contacts.

2. **Sync triggered on disabled integration via race:** A user can enable → sync → disable in quick succession. The route checks `integration.enabled` at request time, but `runSync` is async — the integration could be disabled before `runSync` completes. This is low-impact but worth noting.

3. **Empty `name` field on Integration model:** The schema has `name String @default("")`. If `name` is `""`, `IntegrationsView.vue` falls back to `typeLabel(item.type)` via `item.name || typeLabel(...)` — this works correctly.

4. **`SyncLog.errorMessage` truncation:** Provider error messages are truncated to 200 chars before being returned in HTTP responses but are stored at full length in `SyncLog.errorMessage`. No issue — this is correct behaviour.

---

## Positive Observations

- Clean module separation: each provider is isolated in its own file with a typed config interface. Adding a new provider requires touching only the provider file and the `switch` in `sync-engine.ts`.
- All routes correctly scope queries with `{ where: { id, orgId } }` — no IDOR risk on the database queries themselves.
- The `authMiddleware` hook is applied at the plugin level (`addHook('preHandler', ...)`) rather than per-route, ensuring no route in the module can accidentally be unauthenticated.
- `SyncLog` always gets written even on `default` case in `sync-engine.ts` — the error capture pattern in the outer try/catch correctly writes a failed log.
- Frontend form correctly uses `type="password"` for all secret fields (botToken, apiKey, pageAccessToken), preventing shoulder-surfing in the browser.
- Route registration in `app.ts` follows the exact same one-line pattern as every other module — no ceremony.

---

## Recommended Actions (Prioritised)

1. **[C1] Strip `config` from GET list/logs responses** — mask or exclude before shipping.
2. **[C2] Add SSRF guard to `zapier-webhook.ts`** — validate `webhookUrl` is HTTPS + non-private.
3. **[H1] Add `requireRole('owner', 'admin')` to POST/PUT/DELETE/sync routes** — consistent with codebase pattern.
4. **[H2] Fix or disable Google Sheets provider** — API-key write will always 403; document or swap to service account.
5. **[M2] Fix dead ternary in `facebook.ts`** — one-line fix.
6. **[M1] Wrap syncLog persistence in its own try/catch** — prevents silent log loss on DB errors.
7. **[M4] Add fetch timeouts** — `AbortSignal.timeout(15_000)` across all four providers.
8. **[H3] Batch the Facebook upsert loop** — collect IDs, single query, batch create.
9. **[M5] Mark Phase 04 TODOs complete** — update plan file checkboxes.

---

## Metrics

| Metric | Value |
|--------|-------|
| Type Coverage | ~85% (providers use `any` for config cast in sync-engine; `Record<string, any>` in frontend) |
| Test Coverage | 0% (no tests added — consistent with rest of codebase per sprint plan) |
| Linting Issues | 1 dead expression (M2), 0 syntax errors |
| Critical Issues | 2 |
| High Issues | 3 |
| Medium Issues | 5 |
| Low Issues | 4 |

---

## Unresolved Questions

1. Should `config` field ever be returned to the frontend (for pre-populating edit forms)? If yes, a masked-shape contract per provider type is needed. If no, the edit form can only overwrite credentials, not display existing ones.
2. Is the Google Sheets API key auth a known interim decision, or was OAuth (service account) intended for the MVP? The plan listed this as unresolved — it needs a decision before shipping.
3. Is the `member` role intended to be able to read integration list (names + last sync status) but not secrets? If yes, C1 fix + H1 role guard is the right split.
4. Should concurrent sync be rate-limited (e.g. one active sync per integration at a time)? A simple `syncing` boolean column on `Integration` would cover this.
