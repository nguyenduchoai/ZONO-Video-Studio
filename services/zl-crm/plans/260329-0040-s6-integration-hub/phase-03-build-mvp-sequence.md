# Phase 03 — BUILD: MVP delivery sequence

## Context Links
- Plan overview: `./plan.md`
- Phase 02 contracts: `./phase-02-plan-architecture-and-contracts.md`

## Overview
- Priority: P2
- Status: planned
- Goal: break implementation into smallest vertical slices.

## Key Insights
- Vertical slices reduce integration risk vs big-bang provider build.
- Shipping Telegram first validates end-to-end hub flow fast.

## Requirements
### Functional
- Deliver one working provider before second provider.
- Each slice includes persistence + API + UI + validation.

### Non-functional
- Keep each step independently testable and revertable.

## Architecture
- Slice A: Core hub (schema + generic CRUD + logs + UI shell).
- Slice B: Telegram provider.
- Slice C: Google Sheets export provider.
- Slice D: hardening + DX polish.

## Related Code Files
### Modify
- `backend/prisma/schema.prisma`
- `backend/src/app.ts`
- `frontend/src/router/index.ts`
- `frontend/src/layouts/DefaultLayout.vue`

### Create
- Integration module + frontend integration UI files from Phase 02.

### Delete
- None

## Implementation Steps
1. **Slice A (Core)**
   - Add models + migration.
   - Add integration routes CRUD + logs endpoint.
   - Add provider registry with no-op provider placeholders.
   - Add Integrations page listing items.
2. **Slice B (Telegram)**
   - Add config validation (bot token + chatId).
   - Add `/test` endpoint sending sample message.
   - Add event hooks for appointment reminder + sync failures.
3. **Slice C (Google Sheets)**
   - Add export sync contacts → sheet rows.
   - Add manual sync endpoint + log metrics.
   - Add UI fields for sheetId/tab/range.
4. **Slice D (Hardening)**
   - Add request validation + error normalization.
   - Add masked secret states in API responses.
   - Add empty/error/loading states in UI.

## Todo List
- [ ] Freeze MVP acceptance before coding.
- [ ] Confirm env keys needed for providers.
- [ ] Keep Facebook as stub unless explicit go-ahead.

## Success Criteria
- Telegram + Google Sheets both functional via UI + API.
- Sync logs observable and useful for debugging.

## Risk Assessment
- Risk: Google API auth setup delays sprint.
- Mitigation: manual service-account upload first, OAuth later.

## Security Considerations
- Validate webhook/chat IDs and external URLs.
- Prevent mass sync abuse with rate-limited manual trigger.

## Next Steps
- Phase 04 review of architecture/security before merge.

## Unresolved questions
- Need scheduler in MVP, or manual sync button enough?
