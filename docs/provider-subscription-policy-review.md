# Provider/subscription Batch 5 decision package

> Current status (2026-10-11): Batch 5 is approved and source implementation is present. Automated checks pass; PostgreSQL migration/integration/RLS and real-browser acceptance remain open due to host restrictions. This update supersedes earlier review-required/ON HOLD statements below. See [Batch 5 verification](testing/provider-subscription-batch5-results.md).


11 October 2026. **OPEN DECISION / PROPOSED.** No policy, identity, tenancy,
schema or access-rule changes are implemented by this package. Outbound reminder
delivery is ON HOLD and excluded.

The API governance requires: “stop for architecture review before changing
cardinality, tenancy, authorization, identifiers or schema semantics”
([API AGENTS.md](../../trise-api/AGENTS.md)). Architecture governance requires
human approval for major API, authentication/authorization and schema changes
([architecture AGENTS.md](../../trise-architecture/AGENTS.md)).

| Decision | Current source behavior | Proposed review direction | Required regression acceptance |
| --- | --- | --- | --- |
| No subscription / expired status-ACTIVE subscription | `SubscriptionLimitEnforcer` returns when no ACTIVE subscription exists; ACTIVE selection does not evaluate validity. Invoice issue checks ACTIVE status. | Specify exactly which new operations require valid commercial entitlement and which existing jobs/read-only recovery remain available. Approve grace rules before adding denials. | Boundary times, no subscription, future start, expired ACTIVE, grace period, existing work, and provider isolation |
| Downgrade below existing usage | Changes have explicit review/application; limit enforcement affects creation separately. | Specify whether downgrade is rejected or allowed with new capacity blocked until usage fits. Preserve existing assets/jobs unless explicitly decided. | Revision conflicts, usage above/equal/below limit, already-counted assets and concurrent writes |
| Duplicate pending requests | Request creation does not establish a one-pending-request invariant. Idempotency guards retries of a single command. | Decide whether multiple proposals are allowed or exactly one unresolved request is permitted per provider, including replacement/rejected requests. | Concurrent requests, same-key retry, different-key submissions, replacement and provider scope |
| Accepted future starts / change boundaries | Approval, activation, validity and provider lifecycle are independent; due changes require explicit apply. | Clarify when entitlement starts and how renewal/downgrade/cancellation boundaries are applied. No automatic application worker in this batch. | Just-before/at/after start/end, payment/revision gates and refresh consistency |
| Billing period and evidence reconciliation | Each issued invoice uses accepted plan price plus configured add-ons/tax. Initial request evidence and invoice evidence are separate. | Decide period uniqueness, initial-payment reconciliation and whether proration/credits are supported before changing charge calculations. | Multiple invoices for one period, request-versus-invoice evidence, replay, totals, historic snapshot retention |
| Provider administrator invitation | Provider serializer reports administrator membership readiness; the inspected platform onboarding contracts do not create invitations/memberships. | Define existing-user versus new-user flows, who grants/revokes membership, expiry/reuse and role limits through the existing identity authority. | Wrong-provider invitations, unauthorized grants, reused/expired invitation, inactive identity, audit and revoked access |
| Delegated assignment list/read | Create/end commands exist; no assignment list/read route is implemented. The UI shows only its latest returned command result. | Approve a provider-scoped, paginated read contract with current revisions and explicit grant requirements. | Readers versus lifecycle writers, provider isolation, revoked/expired assignments and stale end commands |
| Evidence correction feedback | Reasons are persisted by review commands. Request decision reasons are returned; evidence review reasons are not exposed by the inspected detail serializers. | Approve a bounded, authorized review-history representation before exposing reviewer details to provider users. | Review history scope, privacy, chronological order and correction/resubmission workflow |
| Office deactivation | Office PATCH permits fields/coordinates/revision, not status; contact ending is implemented separately. | Decide an explicit audited office lifecycle command and handling for the primary registered office. | Unauthorized/status changes, stale revision, address retention and provider isolation |

Reference decisions: [ADR 053](../../trise-architecture/adr/053-provider-operational-lifecycle-access-and-audit.md),
[ADR 055](../../trise-architecture/adr/055-subscription-review-commercial-evidence-and-usage-boundary.md),
[ADR 057](../../trise-architecture/adr/057-subscription-lifecycle-change-policy.md),
[ADR 058](../../trise-architecture/adr/058-subscription-addons-tax-invoicing-and-payment-evidence.md),
[ADR 059](../../trise-architecture/adr/059-provider-subscription-self-service-boundary.md),
[ADR 060](../../trise-architecture/adr/060-subscription-duration-validity-and-reminders.md).

Implementation sequence after review: record approved decisions in architecture;
update contracts and negative tests; implement the smallest backend changes;
regenerate client types; expose supported UI; run database/API and authenticated
browser acceptance on isolated development data. No database reset is required
or authorized by this package.


## Contract distinction confirmed — 11 October 2026

Existing `/resource-membership-invitations` operations invite membership at a
service location under provider context and require an active `MANAGE_MEMBERS`
resource membership. They do not establish a platform provider-administrator
onboarding invitation contract. Provider administrator readiness is separately
computed from active provider memberships with `PROVIDER_ADMIN`/`ADMIN` role
context. Reusing the resource invitation route for administrator handoff would
change authorization semantics and is not part of the approved implementation.
The manager-assignment routes still expose create/end only; no list/read route
was found. These distinctions preserve the Batch 5 review requirement.


## Concrete implementation proposal — 11 October 2026

The [architecture approval package](../../trise-architecture/docs/provider-subscription-batch5-approval.md)
now specifies proposed commercial defaults, endpoint bodies and authority,
invitation acceptance/revocation, migration/RLS/rollback boundaries and negative
acceptance cases. Product/architecture approval has been requested. These rules
remain PROPOSED; no approved contract, grant, schema or migration has been changed.
