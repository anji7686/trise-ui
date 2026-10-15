# TRISE Compliance UX Refactor — Action/API/Permission Matrix

Date: 15 October 2026  
Scope: Provider Compliance Center, Business Verification, Platform Approval Inbox

## Phase 0 audit

The existing UI uses the current Rails contracts in `apps/operations/src/data.ts`; no new API or permission is introduced by this refactor. Provider records are always requested with the selected `providerId`. Platform review operations are capability-gated in the platform page and remain outside the provider workspace.

| Surface | User action | Existing source of truth | Existing API | Permission boundary | Failure/empty behavior |
| --- | --- | --- | --- | --- | --- |
| Provider Overview | View eligibility and next steps | Eligibility evaluation | `GET /providers/compliance/eligibility` | Provider membership and capability enforced by API | Loading/error state; no client-derived eligibility score |
| Provider Overview | Open category | Published requirements and provider resources | Requirements, agents, assets, licences, territories endpoints | Current provider scope | Empty category explains no applicable/available records |
| Requirements | Start request | Published requirement catalogue | `GET /providers/compliance/requirements`; agent/asset requirement endpoints | Provider submit capability and target scope | No published requirement is distinct from approved |
| New request | Select category/target/details/evidence/submit | Server validation, revision and status transitions | Existing `POST /providers/compliance` and submit endpoint | Authorized provider submitter only | API validation, permission, stale revision and evidence errors shown |
| My Requests | Search/view/edit/submit correction | Compliance request status and revision | Existing provider compliance collection/update/submit endpoints | Provider-scoped request ownership | Current UI filters loaded page; server query contract gap recorded below |
| Documents | Upload/finalize/preview/download | Document lifecycle, scan state, version | Existing `ProviderDocumentsStep` and document transfer APIs | Provider document capabilities; private storage | Unscanned/ineligible evidence is not treated as cleared |
| Activity | Read history | Immutable request audit history | `audit_history` included when available | Provider-scoped visibility | Missing optional history renders an empty state, not a blank page |
| Business Verification | Review business legal/GST data | Business and canonical GST contracts | Existing business/tax endpoints | Business membership for submission; no platform decision controls | Structured legal/GST fields now submit the existing governed payload; server-published constitution-specific schema remains an API follow-up |
| Approval Inbox | Assign/decide review request | Platform review queue, evidence and versions | Existing platform compliance review endpoints | Platform reviewer capability and maker-checker | Decision errors preserve request state and show server reason |

## Scenario matrix

| Scenario | Required UI result | Current status |
| --- | --- | --- |
| First-time provider | Clear incomplete/next-action state; no invented approval | Implemented in Provider Overview states |
| Pending request | Show server status, submitted date and awaiting-review action | Implemented |
| Approved request | Show approved status and immutable-history context | Implemented |
| Rejected request | Show decision state and server feedback when returned | Partially implemented; detail feedback API is limited |
| Corrections requested | Allow edit/resubmit only for supported status | Implemented for existing correction transition |
| No published requirement | Explain configuration gap; never label approved | Implemented in requirements messaging |
| No approved licence | Explain that provider cannot create a business licence here | Implemented |
| Unscanned document | Keep lifecycle and scan state separate; block gated evidence | UI gate retained; strict production CLEAN scanning is `PRODUCTION_PENDING` |
| No permitted action | Read-only state with permission explanation | Implemented by shell/API capability handling |
| Permission denied | Preserve provider scope and show access error | Implemented |
| Network failure | Actionable error and retry where supported | Implemented |
| Stale revision | Preserve server state and show conflict instead of overwriting | Backend contract retained; UI displays API error |

## Contract gaps intentionally not fabricated

1. The published requirement response exposes requirement metadata and evidence labels, but not a field-level schema. The wizard therefore uses readable common fields and the selected requirement code; dynamic schema rendering requires an additive API contract.
2. The provider request collection currently has no documented search/filter/page query shape in the UI client. The current view filters the authorized response already returned; true server-side request filtering/pagination remains an API follow-up.
3. The eligibility response returns outcome and blockers but not a richer explanation/next-action model. The UI uses a conservative provider-level explanation and does not infer activity authorization.
4. Platform Approval correction requests now expose structured common fields alongside the compatibility payload editor. Business legal identity, GST, and registration/brand entry render structured common fields while preserving their existing request payloads. Full dynamic field rendering requires published field metadata.

## Route compatibility

`#/compliance` remains the default provider route. Existing deep links for requests, agents, assets, licences, territories, documents and activity remain recognized while the primary presentation is consolidated into Overview, Requirements, My Requests and Documents.

## Evidence

- Provider browser acceptance artifacts: `/tmp/trise-compliance-center-responsive-20261015.json`, `/tmp/trise-asset-compliance-20261015-v6.json`, `/tmp/trise-document-transfer-20261015-v4.json`.
- Full UI checks are recorded in `docs/compliance-center-ux.md` and this matrix is updated as batches land.
- Production-only deferred evidence remains tagged `PRODUCTION_PENDING` in the architecture progress record.
