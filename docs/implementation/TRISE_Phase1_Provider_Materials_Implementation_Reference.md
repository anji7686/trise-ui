# PH1-PME — Operations UI implementation reference

This is the UI-repository pointer for the approved Phase 1 provider materials
execution plan.

Canonical feed:

* [`TRISE_Phase1_Provider_Materials_Codex_Feed.md`](../../../trise-architecture/docs/implementation/TRISE_Phase1_Provider_Materials_Codex_Feed.md)

Design references:

* [`phase-1-provider-materials-execution-plan.md`](../../../trise-architecture/architecture/phase-1-provider-materials-execution-plan.md)
* [`TRISE_UI_DESIGN_SYSTEM_AI_INSTRUCTIONS.md`](../design/TRISE_UI_DESIGN_SYSTEM_AI_INSTRUCTIONS.md)
* [`ubold-reference-index.md`](../../../trise-architecture/docs/ubold-reference-index.md)
* Phase 1 workflow mockup: `/Users/anjanreddy/.codex/visualizations/2026/10/22/01a1646e-c161-7d20-9f88-88c3a8defb25/trise-phase1-workflow-journey.html`

The [TRISE elevator inventory master starter workbook](../../../trise-architecture/docs/design/service-providers/References/TRISE_Elevator_Inventory_Master_Starter.xlsx)
is a reference for material vocabulary only. Its SKU, stock, location,
certification, supplier and inventory-schema sheets remain deferred from the
Phase 1 UI. See the [phase mapping review](../../../trise-architecture/docs/implementation/TRISE_Elevator_Inventory_Master_Starter_Review.md).

## Screen journey

```text
Lead and survey -> Quotation -> Project materials and delivery
-> Service job usage -> Customer-safe update
```

## UI rules

* Quotation shows plain material descriptions, category, quantity, unit,
  customer visibility and notes.
* Project shows quotation snapshot lineage, project-added requirements,
  multi-line shipment, all-line delivery reconciliation and evidence.
* Service job shows immutable material/part usage with explicit source and
  usage kind.
* Customer-facing views exclude provider stock, vendor, warehouse, cost and
  internal operational notes.
* Do not call a material `SKU` or show `Reserved stock` in Phase 1.
* Use existing Operations shell, shared primitives, status components, dialogs,
  tabs, responsive behavior and authorization presentation.

## UI verification

Run the repository's typecheck, unit tests, lint, production build, bundle
checks, `git diff --check`, desktop/narrow browser checks and provider/customer
non-regression checks. Report API, frontend, browser and visual evidence
separately.
