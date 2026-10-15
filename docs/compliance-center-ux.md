# Provider Compliance Center UX

Status: Provider Compliance Center implemented and verified in the host browser for the current provider workflows. The broader seven-batch UX refactor remains in progress; the explicit API gaps are tracked in `docs/compliance-ux-action-api-matrix.md`.

## Scope

The Provider Workspace Compliance route remains the existing `compliance` route and now presents as **Compliance Center**. This is a presentation change only. It reuses the existing provider-scoped APIs, request revisions, idempotency keys, evidence lifecycle and server authorization.

## Screen-to-API mapping

| Screen capability | Existing provider contract | Authority boundary |
| --- | --- | --- |
| Eligibility banner | `GET /providers/compliance/eligibility` | Server-reported outcome and blockers; the UI does not calculate eligibility from cards. |
| Published requirements | `GET /providers/compliance/requirements` | Published catalogue controls requirement visibility. |
| My Requests | `GET /providers/compliance`, `POST /providers/compliance`, `PATCH /providers/compliance/:requestId`, `POST /providers/compliance/:requestId/submit` | Provider submitter can create/edit/submit permitted drafts; platform decisions remain outside this workspace. |
| Agent certifications | `GET /agents`, `GET /providers/agents/:agentId/compliance*` through the existing provider data layer | Agent records remain provider-scoped and credentials belong to the individual agent. |
| Asset approvals | `GET /assets`, existing asset compliance contracts | Asset type, jurisdiction and evidence requirements remain server-authoritative. |
| Business licences | `GET /providers/available-business-licences`, `GET /providers/licence-authorizations` | Only approved source licences returned by the API are selectable; authorization scope is not expanded by the UI. |
| Territories | `GET /providers/operating-territories`, existing POST request contract | A request is not an effective operating authorization. |
| Documents | Existing `ProviderDocumentsStep` provider document create/upload/finalize/download contracts | Private storage transfers remain authorization-scoped; only eligible finalized versions can be attached. |
| Activity history | Request `audit_history` already returned by the compliance API | Audit values are read-only and rendered as readable events. |

## Permission mapping

The page does not infer permissions from role labels or expose platform reviewer assignment/decision controls. Provider membership and capability checks remain in the existing Operations shell and Rails API. The wizard only presents targets returned in the current provider context. Provider document upload and transfer authorization remain in `ProviderDocumentsStep`.

## Guided request behavior

The common wizard uses five steps: category, provider-scoped target, readable details, eligible evidence, and review/submit. The current published requirement contract exposes requirement metadata rather than a field-level JSON schema, so the first version uses readable common fields and retains the selected published requirement code. It does not expose a raw JSON editor by default. Any future field-level schema can be rendered into the same step without changing the request endpoint.

## Compatibility and known gaps

- `#/compliance` remains the default route; `#/compliance/requests`, `agents`, `assets`, `licences`, `territories`, `documents`, and `activity` are supported deep links. `licenses`, `my-requests`, and `history` aliases are accepted.
- The current component receives the provider context from the existing Operations shell and uses the provider ID for API scoping. The surrounding shell already renders the authoritative selected provider display name.
- Server-side search, filtering and pagination for requests are not exposed by the current provider compliance collection contract used by the UI. The current simplified view provides bounded filtering over the loaded authorized collection and records this as an API follow-up; it does not claim a larger result set than the server returned.
- Production expiry scheduler execution, external notification delivery/publication, strict CLEAN malware scanning, and broader production authorization/legal-variant review remain `PRODUCTION_PENDING` per the architecture evidence. This UI does not weaken those gates.

## Validation

- `npm run typecheck` — pass.
- `npm run lint` — pass with zero warnings.
- `npm test -- --run` — 31 files / 172 tests pass.
- `npm run build:operations` — pass; Vite emits only the existing chunk-size advisory.
- `git diff --check` — pass.
- Authenticated browser evidence: host Chromium Agent Compliance Center smoke passes **3/3** across desktop, tablet and mobile using `/tmp/trise-compliance-center-responsive-20261015.json`; the corrected provider-scoped asset workflow passes using `/tmp/trise-asset-compliance-20261015-v6.json`; the corrected provider document transfer workflow passes using `/tmp/trise-document-transfer-20261015-v4.json`; the consolidated three-workflow run passes 3/3 using `/tmp/trise-compliance-ux-refactor-20261015.json`; and the four-view navigation assertion passes using `/tmp/trise-compliance-ux-navigation-20261015.json`. The earlier blank-page failure was caused by an optional `audit_history` collection being absent in a valid response; the UI now treats that collection as optional. Chromium startup is verified outside the Codex sandbox; no sandboxed launch was repeated.

## Development master-data prefill

The existing development-only `compliance_browser_demo.rb` ran successfully and returned synthetic Business, Business compliance, licence, Provider and pending authorization identifiers. The existing `business_operations.rb`, `compliance_asset_demo.rb`, `default_provider_roles.rb` and `tax_catalogue.rb` seeds were also loaded. `demo_elevator.rb` was not completed because its own guard requires the separately configured `TRISE_DEMO_CUSTOMER_EMAIL`; no customer identity was invented. This does not affect the Provider Compliance Center implementation, but it remains a fixture prerequisite for elevator/customer acceptance scenarios.
