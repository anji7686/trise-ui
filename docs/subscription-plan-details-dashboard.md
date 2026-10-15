# Subscription Plan Details Dashboard

The Operations Plan Details screen follows the approved reference image at
`docs/design/TRise Quarterly Plan Dashboard.png` while preserving the existing
platform-admin shell and server-authoritative API boundaries.

## Capability mapping

| Feature | Existing API | Existing UI integration | Result |
| --- | --- | --- | --- |
| Plan identity and overview | `GET /platform/plans/{planId}` | `PlatformPlansPage` | Real name, code, version, revision, status, Industry, operations and tax fields |
| Pricing and tax | Plan version fields; billing tax preview remains separate | `Pricing` | Read-only commercial terms and billing-context warning; no hard-coded GST |
| Entitlements | Version `limits[]`, `included_features[]` | `Entitlements` | Typed limits only; empty features state is explicit |
| Publication readiness | `GET .../validation` | `Readiness` | Backend blockers only; published versions show immutable published state |
| New version | `POST /platform/plans/{planId}/versions` | Header and Versions action | Capability-gated successor draft creation |
| Publish/retire/edit | Existing revision-bound endpoints | Header/readiness actions | State-aware and capability-gated; Rails remains authoritative |
| Version history | Plan detail `versions[]` | `Versions` | Actual returned snapshots and publication dates |
| Audit history | Plan detail `audit_history[]` | `AuditHistory` | Actual events only; actor IDs remain IDs when no name is returned |

Tabs use `?tab=` in the existing hash route, preserving active tab on refresh
and browser history navigation. The summary card stacks below the overview at
tablet/mobile widths.

Published plan versions are immutable. The screen never edits a published
version, invents readiness checks, assumes tax classification approval, or
mutates provider subscriptions/invoices.

## Validation

- `npm run typecheck` — passed.
- Focused Operations data/routing tests — 51 passed.
- `npm run build:operations` — passed, with existing Node/Vite and bundle-size warnings.
- Rails `platform_plan_catalogue_api_test.rb` — passed with the repository Ruby
  4.0.7/Bundler 4.0.21 toolchain (5 tests, 18 assertions).
- `git diff --check` — passed for the changed tracked files.
- Terminal Playwright acceptance — blocked before Chromium launch by the local
  Node 18.20.8 runtime; see `docs/testing/browser-readiness-report.md`.
