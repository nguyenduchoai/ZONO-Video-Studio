# Phase 05 — TEST: Validation matrix

## Context Links
- Existing module tests approach (repo level conventions)
- Integration routes and UI from Phases 02–03

## Overview
- Priority: P2
- Status: planned
- Goal: define practical test matrix for MVP confidence.

## Key Insights
- Highest-risk areas: config validation, auth/role guard, provider error handling.
- Need both API-level and UI-level checks.

## Requirements
### Functional
- Verify CRUD, test connection, manual sync, logs retrieval.
- Verify Telegram and Google Sheets happy + unhappy paths.

### Non-functional
- Verify no secret leakage.
- Verify acceptable response time for manual sync trigger.

## Architecture
- API integration tests + frontend smoke tests + manual E2E checklist.

## Related Code Files
### Modify
- Test files near integration module and frontend integration view.

### Create
- New backend route/service tests.
- New frontend composable/component tests if current stack supports.

### Delete
- None

## Implementation Steps
1. Backend test cases:
   - unauthorized/forbidden access on write routes.
   - create/update integration config with validation errors.
   - `/test` success/failure per provider.
   - `/sync` success/partial/failure and log write.
2. Frontend test cases:
   - load list, open config dialog, save config.
   - trigger test/sync, view result + logs table.
   - error rendering when API fails.
3. Manual validation:
   - real Telegram message arrives to target chat.
   - rows exported to correct Google sheet tab.

## Todo List
- [ ] Backend integration tests pass.
- [ ] Frontend smoke tests pass.
- [ ] Manual real-provider checks pass.

## Success Criteria
- All critical path tests pass with real provider credentials.
- No P1/P2 bugs open.

## Risk Assessment
- Risk: flaky external API in CI.
- Mitigation: isolate provider adapters; run deterministic contract tests + targeted manual real checks.

## Security Considerations
- Validate unauthorized users cannot trigger sync/test.
- Ensure test payloads avoid sensitive data.

## Next Steps
- Move to ship checklist and PR prep.

## Unresolved questions
- Are provider live-credential tests required in CI or only local/pre-release?
