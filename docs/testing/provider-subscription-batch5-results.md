# Batch 5 implementation and verification — 2026-10-11

User approval is recorded in the [frozen architecture package](../../../trise-architecture/docs/provider-subscription-batch5-approval.md) and [ADR-061](../../../trise-architecture/adr/061-provider-administrator-invitations-and-commercial-edge-contracts.md). Approval is no longer pending.

Implemented source: separate administrator-invitation capability, verified existing-user invitations, platform create/list/detail/revoke and identity-scoped list/accept, expiry/revision checks, issuer reauthorization, provider/user locking, membership creation, transactional audit/event intent, scoped RLS and migration constraints. Existing accounts receive no automatic capability. Added assignment list/detail contracts and handoff history, office-ending command preserving the final registered office for verified providers, and private evidence review feedback. Subscription activation/apply now lock the provider and reject conflicting active subscriptions. Approved commercial defaults preserve existing work and operational admission.

The Operations account menu exposes Administrator invitations without requiring a selected provider. Platform handoff separates invitations, provider memberships, and delegated onboarding grants. Evidence reasons include decision/time and exclude evidence reviewer identities. Office ending requires reason/revision. The new client contracts are generated from OpenAPI; the API operation ledger lists the nine new operations.

Visual references inspected: first pages of `TRISE_Subscription_UI_Design.pdf` (grouped cards/forms) and `Time Line Template.pdf` (dated history). Existing Operations primitives are reused. Static markup tests do not establish visual/browser acceptance.

## Fresh evidence

- Node 24: 121 UI tests across 20 files pass, including expiry boundaries, identity-scoped acceptance headers/body/idempotency, escaped feedback, handoff permission visibility, and existing batches' regressions.
- Application TypeScript and ESLint pass. E2E TypeScript, final Customer/Operations production builds, and compressed bundle budgets pass: Customer 69,508 bytes, Operations 130,037 bytes, both below 204,800.
- Ruby 4.0.7: 13 isolated tests, 49 assertions pass. New policy gates and feedback order/privacy checks pass.
- Targeted RuboCop: ten Batch 5 files pass; integration test passes its separate check. Earlier checks covered other touched controllers/models/context files.
- OpenAPI parses; generated client regeneration passes. Diff whitespace checks pass.
- Rails invitation integration attempt fails before tests: PostgreSQL `127.0.0.1:5433` is denied by the managed host. Acceptance, replay, revoked issuer, pending duplicates, revoked invitation and non-owner runtime-role RLS cases are prepared in `trise-api/test/integration/provider_admin_invitations_api_test.rb` but have not passed against PostgreSQL.
- In-app browser reconnection still fails before page access: `missing field sandboxPolicy`. Previous standalone Chromium acceptance attempts failed at launch with SIGTRAP. No fresh real-browser acceptance is claimed.

## Remaining completion gates (superseded by the 14 October continuation below)

At the time of this earlier report, the migration, integration/RLS checks, authoritative dump and authenticated browser acceptance were still open. They are recorded as completed in the 14 October continuation below.

From a local terminal authorized to reach the development database:

```sh
cd /Users/anjanreddy/wrk/trise/trise-api
export PATH="/Users/anjanreddy/.rbenv/versions/4.0.7/bin:$PATH"
bin/rails db:migrate
RAILS_ENV=test bin/rails db:migrate
TRISE_TEST_WORKERS=1 bin/rails test test/integration/provider_admin_invitations_api_test.rb test/integration/subscription_history_pagination_api_test.rb test/integration/platform_subscription_api_test.rb test/integration/provider_subscription_self_service_api_test.rb
bin/rails db:structure:dump
```

Confirm the configured databases are development/test first. Preserve migration history: `down` refuses rollback when invitation records exist; row security is disabled for the count so a restrictive role fails instead of falsely treating hidden rows as an empty table. After use, disable routes/capability and roll forward; never delete accepted memberships or audit evidence to force rollback.

Capability provisioning remains an explicit, audited administrator procedure. Use a test issuer with `PLATFORM_PROVIDER_ADMIN_INVITE` for acceptance; ordinary provider/lifecycle grants alone must receive 403. No production grant or invitation was created.

See [browser recovery and manual permissions](../browser-environment-blocker.md).

## Live-gate continuation — 14 October 2026

The development and test migrations were applied successfully against the
local PostgreSQL 18.6 instance on `127.0.0.1:5433`. The supported Rails task
in this repository is `db:schema:dump` (there is no `db:structure:dump` task);
the authoritative `trise-api/db/structure.sql` was regenerated successfully.

The documented Batch 5 subscription/invitation integration gate passed with
the test-only `LEGACY` tax engine mode: **15 tests, 130 assertions, 0
failures, 0 errors, 0 skips**. The focused provider invitation, membership,
RLS and role-management gate also passed: **23 tests, 123 assertions, 0
failures, 0 errors, 0 skips**. These suites cover identity-scoped acceptance,
issuer authorization, duplicate/idempotent handling, membership isolation,
RLS transaction boundaries and role-management rollback behavior. The
invitation migration's `down` path remains intentionally irreversible and
raises `ActiveRecord::IrreversibleMigration` to preserve invitation history;
no rollback or database reset was attempted.

Authenticated browser acceptance passed with Chromium security settings
unchanged:

- Operations desktop: **3 passed** (`roles-permissions-redesign` 2/2 and
  `team-access-simplification` 1/1), plus the approved-account inventory
  check **1/1**.
- Operations tablet/narrow responsive checks: **3 passed**.

Evidence is preserved in
`docs/evidence/browser-automation/batch5-auth-final-20261014/`,
`docs/evidence/browser-automation/batch5-access-inventory-20261014/` and
`docs/evidence/browser-automation/batch5-auth-tablet-20261014/`.

Two acceptance tests were updated to match the implemented contract exposed
by the live UI: role status initially uses the all-status value, approved
account email uses a combobox, and existing platform default roles are shown
in Team Access. No production credentials, permissions, cookies or tokens
were changed or recorded.

Batch 5 database, authorization/RLS, schema, desktop and narrow-browser
gates are **COMPLETE**. Deferred outbound reminder delivery remains on hold
as separately documented.
