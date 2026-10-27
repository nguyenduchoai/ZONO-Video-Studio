# Phase 01 — THINK: Prioritize integrations

## Context Links
- Sprint brief: `/Users/martin/conductor/workspaces/zalocrm/delhi/plans/sprint-plan.md`
- Backend pattern: `/Users/martin/conductor/workspaces/zalocrm/delhi/backend/src/modules/*`
- Frontend settings pattern: `/Users/martin/conductor/workspaces/zalocrm/delhi/frontend/src/views/ApiSettingsView.vue`

## Overview
- Priority: P2
- Status: planned
- Goal: decide smallest valuable integration set for Sprint S6 timeline.

## Key Insights
- Current stack already has public API and webhook base; good for integration pivot.
- Existing settings/security is simple and pragmatic (masked values, JWT auth).
- Fastify route-centric modules favored over heavy abstraction.

## Requirements
### Functional
- Define provider order and MVP/non-MVP cut line.
- Define success outcomes per chosen provider.

### Non-functional
- Keep implementation realistic for 2–3 days.
- Minimize external compliance blockers.

## Architecture
- Use provider interface abstraction now, provider-specific logic in dedicated files.
- Hub module orchestrates provider calls + persistence + logs.

## Related Code Files
### Modify
- `plans/sprint-plan.md` (reference only, no edit in this phase)

### Create
- N/A (planning phase only)

### Delete
- None

## Implementation Steps
1. Compare candidate providers by value, complexity, and dependency risk.
2. Score each provider using 80/20 lens.
3. Lock MVP order: Telegram → Google Sheets → Facebook deferred.

## Todo List
- [ ] Confirm business priority with product owner.
- [ ] Confirm credentials availability for Telegram + Google.

## Success Criteria
- Clear priority list exists with rationale and risk notes.
- MVP cut line agreed before technical plan.

## Risk Assessment
- Risk: choosing high-complexity provider first delays sprint.
- Mitigation: strict MVP sequence and defer risky provider.

## Security Considerations
- Don’t expose raw provider tokens in APIs/UI.
- Keep config write endpoints role-protected.

## Next Steps
- Move to Phase 02 architecture and contracts.

## Unresolved questions
- Is Facebook import mandatory in sprint acceptance, or acceptable deferred as stretch?
