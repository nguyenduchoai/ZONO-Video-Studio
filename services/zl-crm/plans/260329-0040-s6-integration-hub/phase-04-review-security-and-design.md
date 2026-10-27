# Phase 04 — REVIEW: Security, architecture, UX

## Context Links
- Existing webhook settings routes for masking pattern:
  - `/Users/martin/conductor/workspaces/zalocrm/delhi/backend/src/modules/api/webhook-settings-routes.ts`
- Existing auth/role pattern:
  - `/Users/martin/conductor/workspaces/zalocrm/delhi/backend/src/modules/auth/`

## Overview
- Priority: P2
- Status: planned
- Goal: catch design and security gaps before full QA.

## Key Insights
- Existing code already uses org scoping + role middleware; reuse directly.
- Need consistency in response keys (current code has some mismatch risk), so contract check required.

## Requirements
### Functional
- Review route contract consistency between backend and frontend.
- Review provider isolation and fallback behavior.

### Non-functional
- Review secret exposure risk.
- Review failure observability.

## Architecture
- Checklist-driven review, no architecture rewrite.

## Related Code Files
### Modify
- Integration module/API/UI files created in Phase 03.

### Create
- Optional review notes in plan folder.

### Delete
- None

## Implementation Steps
1. Validate route input/output contracts against frontend composable usage.
2. Verify all integration queries are org-scoped.
3. Verify role guard on write/test/sync/delete endpoints.
4. Verify provider failures always write `IntegrationSyncLog`.
5. Verify secrets never returned raw.

## Todo List
- [ ] API contract review pass completed.
- [ ] Security review pass completed.
- [ ] UX empty/error state review completed.

## Success Criteria
- No critical security or contract blocker found.
- Remaining issues are minor and tracked.

## Risk Assessment
- Risk: silent partial sync causes trust loss.
- Mitigation: explicit `partial` status + message + recordCount in logs.

## Security Considerations
- Prevent SSRF risk: validate outbound webhook/sheet endpoints if configurable.
- Keep tokens out of logs.
- Add audit log for integration config changes if feasible.

## Next Steps
- Move to Phase 05 validation matrix.

## Unresolved questions
- Is audit logging mandatory in sprint definition or optional hardening?
