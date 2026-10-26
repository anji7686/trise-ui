# Phase 1 Project Details UI reference

The Project Details screen follows the Phase 1 journey from accepted commercial scope to handover:

1. Overview — lifecycle stepper, next action, jobs, materials, shipments, and project summary.
2. Readiness & blockers — structural/electrical guidance, stakeholder dependency tracking, due dates, impact days, notify, and resolve.
3. Stages & execution — milestones, dependencies, material release, dispatch, and installation jobs.
4. QA & handover — commissioning defects, re-inspection, evidence, and per-elevator handover.
5. Commercial — payment stages, partial/over payments, allocation preview, settled evidence, approved-credit exception, and payment history.

Provider Admin and provider-operations contexts receive the server-equivalent action affordances. Role-governed users see only actions represented by their effective permissions. The UI never invents a stage release: it renders the server response and keeps blocked actions explainable.

Reference implementation:

- `apps/operations/src/projects.tsx`
- `apps/operations/src/data.ts`
- `apps/operations/src/operations-design.css`
- `tests/e2e/project-delivery-phase1.spec.ts`

The visual direction follows the local UBold reference set: compact overview cards, a clear detail header, progressive work-area tabs, action drawers/dialogs, and responsive layouts. The authoritative navigation and token rules remain in `docs/design/TRISE_UI_DESIGN_SYSTEM_AI_INSTRUCTIONS.md`.
