# Service-provider end-to-end acceptance

Status: preparation recorded; authenticated browser execution pending.

## Required roles and data

- Provider operator/dispatcher with provider context and operations capabilities.
- Provider finance authority for payment verification and stage release.
- Independent QA authority for inspection approval and reinspection.
- Assigned technician identity with valid workforce, skill, territory, availability and capacity facts.
- Customer authority for exact quotation-revision acceptance and per-lift handover acceptance.
- At least one accepted quotation with multiple lift units, payment stages, material lines, shipment, installation job, QA finding, handover and included AMC entitlement.

## Positive workflow

1. Create/update lead, record follow-up, capture survey and revise requirements.
2. Create draft quotation, edit it, create an immutable issued revision, and verify customer acceptance binds to that revision.
3. Configure payment stages, convert the accepted order idempotently, create multiple lift units and stages.
4. Record payment, verify collection with finance authority, allocate materials, create/partially receive shipment and confirm release gating.
5. Create installation job, assign an eligible technician, capture execution evidence and complete the work session.
6. Record QA findings, reject incomplete work, correct/reinspect, and hand over each completed lift independently.
7. Start included AMC only from the unit-specific configured commencement event; offer and accept paid renewal without auto-charging.

## Negative and isolation checks

- Cross-provider record reads and mutations return the existing authorization error contract.
- Accepted quotation revisions cannot be edited through generic update.
- Stage release is denied without authorized finance verification and required payment/material conditions.
- Shipment receipt rejects shortages/duplicates according to server validation and is idempotent on retry.
- QA/handover is denied for incomplete evidence, blocking findings, missing dossier or missing authorized acceptance.
- AMC renewal cannot mutate historical coverage snapshots or silently charge the customer.

## Browser status

`BLOCKED_BROWSER_RUNTIME`: the permitted authenticated browser session was not available during Batch 0. Code-level tests, API integration tests and any Playwright runs are tracked separately and must not be reported as visual acceptance.
