# Phase 06 — SHIP: PR and release checklist

## Context Links
- Sprint acceptance: `/Users/martin/conductor/workspaces/zalocrm/delhi/plans/sprint-plan.md`
- Docs update requirements: `/Users/martin/.claude/rules/documentation-management.md`

## Overview
- Priority: P2
- Status: planned
- Goal: deliver clean PR with low merge risk.

## Key Insights
- Sprint S6 is late-merge by roadmap order; keep blast radius small.

## Requirements
### Functional
- PR includes schema, backend module, frontend UI, tests, docs impact notes.

### Non-functional
- Ensure no secrets committed.
- Keep commit scope clean.

## Architecture
- Single feature branch PR for Sprint S6 integration hub.

## Related Code Files
### Modify
- All S6 code files and impacted docs.

### Create
- Migration files and new integration module/UI files.

### Delete
- None unless explicit refactor cleanup.

## Implementation Steps
1. Run lint/build/tests.
2. Run manual provider checks with dev credentials.
3. Update docs (`docs/` + roadmap/changelog if impacted).
4. Prepare PR summary with test plan.
5. Request review.

## Todo List
- [ ] Build and tests green.
- [ ] Docs impact evaluated and updated.
- [ ] PR description includes risks + rollback plan.

## Success Criteria
- PR approved with no critical comments.
- Deploy-ready artifact for sprint merge window.

## Risk Assessment
- Risk: migration conflicts with parallel sprint branches.
- Mitigation: rebase early, keep migration additive and minimal.

## Security Considerations
- Re-check `.env` and provider credential files not staged.
- Confirm logs do not print secrets.

## Next Steps
- Reflect phase with outcome metrics and next sprint recommendations.

## Unresolved questions
- Which base branch merge window is targeted for S6 in current release train?
