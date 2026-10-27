---
title: "Sprint S6 Integration Hub Implementation Plan"
description: "7-phase execution plan for a simple, high-value Integration Hub MVP in ZaloCRM."
status: pending
priority: P2
effort: 18h
branch: dmman16pn/integration-hub
tags: [sprint-s6, integration-hub, backend, frontend, prisma]
created: 2026-03-29
---

## Scope
Sprint S6 from `plans/sprint-plan.md`, full 7-phase flow (Think → Plan → Build → Review → Test → Ship → Reflect), read-only research done, no code yet.

## THINK conclusion (value-first)
1. **Telegram notifications first**: lowest build risk, instant ops value (owner/admin gets lead + appointment + failure alerts), no heavy data mapping.
2. **Google Sheets contacts sync second**: high business value for SME workflows (manual sheet ops today), medium complexity, can start one-way export then optional import.
3. **Facebook lead import third**: high potential value but highest integration risk (OAuth/app review/webhook policy), defer to after core hub stable.
4. **Zapier endpoint support (optional in MVP)**: can be thin wrapper over existing public API + webhooks, useful but not required for first delivery.

Reasoning: maximize shipped value under 2–3 day sprint window, minimize external API compliance risk, keep architecture extensible.

## Phase map
- [Phase 01 — Think](./phase-01-think-prioritize-integrations.md)
- [Phase 02 — Plan](./phase-02-plan-architecture-and-contracts.md)
- [Phase 03 — Build](./phase-03-build-mvp-sequence.md)
- [Phase 04 — Review](./phase-04-review-security-and-design.md)
- [Phase 05 — Test](./phase-05-test-validation-matrix.md)
- [Phase 06 — Ship](./phase-06-ship-pr-checklist.md)
- [Phase 07 — Reflect](./phase-07-reflect-metrics-and-followups.md)

## Proposed MVP delivery order
1. Prisma migration + backend module skeleton + integration registry.
2. Telegram provider + routes + UI config card + send test.
3. Google Sheets provider (contacts export + manual sync) + logs + UI.
4. Shared sync log endpoints + basic status polling in UI.
5. Hardening, validation, docs, release.

## Key dependencies
- Existing auth/role middleware (`authMiddleware`, `requireRole`).
- Existing app settings/security conventions (`AppSetting`, masked secrets in responses).
- Existing settings/API UI patterns (`ApiSettingsView.vue`, composables + `/api/v1/*` conventions).
- Existing module registration style in `backend/src/app.ts`.

## Out of scope (YAGNI)
- Full bidirectional realtime sync for all providers.
- Facebook OAuth/webhook production-grade flow.
- Complex conflict engine; use deterministic last-write policy + explicit logs first.
- Background worker infra or queue system.

## Unresolved questions
- Which Google account auth mode accepted now: service account JSON vs OAuth user consent?
- Telegram target model: chatId only, or per-team/per-user routing needed in v1?
- For sheets sync, is one sheet schema fixed globally or configurable per org?
- Must integration secrets be encrypted now, or acceptable to match current `AppSetting.valuePlain` baseline for v1?
