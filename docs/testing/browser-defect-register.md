# Browser defect register

10 October 2026. Confirmed findings below are development-environment blockers,
not demonstrated React/Rails functional defects. No browser-observed application
defect has been manufactured to satisfy the workflow requirement.

## ENV-001 — High — Interactive browser connection

- Application/page/role: Codex Browser, before navigation, all roles.
- Reproduce: invoke browser bootstrap in the exposed JavaScript tool.
- Expected: connect and read browser documentation. Actual: tool rejects request.
- Evidence: `js: codex/sandbox-state-meta: missing field sandboxPolicy`.
- Root cause: host-owned metadata validation; exact responsible component unknown.
- Modified files: documentation only; no app variable can fix host metadata.
- Tests: bootstrap attempted. Status: BLOCKED; host recovery unverified.

## ENV-002 — High — Chromium unavailable

- Application/page/role: Operations signed-out, desktop, anonymous.
- Reproduce: `npm run test:e2e -- --project=operations-desktop --workers=1`.
- Expected: Chromium opens real UI. Actual: executable missing, before navigation.
- Evidence: `browserType.launch: Executable doesn't exist`; install returns
  `getaddrinfo ENOTFOUND cdn.playwright.dev`. Retry trace/error context in local
  `test-results`; no screenshot/video because no page was created.
- Root cause: browser binary absent and session DNS/network restriction.
- Modified files: `playwright.config.ts`, `tests/e2e/*`, `package.json`, lockfile,
  `.gitignore`; runner installed from existing offline cache.
- Tests: runner discovery/typecheck pass; browser execution blocked.
- Status: BLOCKED; install Chromium from unrestricted local development terminal.

## ENV-003 — Medium — Node/npm incompatibility

- Application/page/role: dependency setup, no application page, developer.
- Reproduce: npm install with default Node 18.20.8/npm 12.2.0.
- Expected: install runner. Actual: engine warning and `ERR_REQUIRE_ESM`.
- Root cause: shell resolves old Node alongside modern npm.
- Modified files: setup documentation describes explicit existing Node 24 PATH.
- Tests: same offline installation succeeds using Node 24; e2e typecheck/list work.
- Status: RESOLVED FOR DOCUMENTED COMMANDS; shell/global configuration unchanged.

## ENV-004 — High — Local API/database verification access

- Application/page/role: Rails health and authenticated backend checks, all roles.
- Reproduce: curl discovered Rails `/up` in this managed session.
- Expected: health response. Actual: connection fails (`curl` exit 7); Playwright reports `connect EPERM 127.0.0.1:3000`; prior
  attempts returned `Operation not permitted`. Listeners remain observable.
- Evidence: no HTTP response; database integrations previously fail localhost.
- Root cause: managed session connection restriction; listener is not proof of
  application/database health.
- Modified files: prepared API public smoke case and recovery documentation.
- Tests: API smoke attempted; no successful health/authorization claim.
- Status: BLOCKED; rerun with permitted local HTTP/PostgreSQL access.

## Application defect workflow

No confirmed browser defect yet. Each new defect must record ID/severity,
application/page/role, reproduction, expected/actual, sanitized console/network
and screenshot/trace references, root cause, modified files, tests, and final
browser retest status. A unit-test-only fix remains pending browser verification.

Installed Chrome was additionally tested for ENV-002. It closed before page
creation (`SIGABRT`, cleanup `EPERM`); exact launch failure cause is unknown.
Runner configuration explicitly enables Chromium sandbox for subsequent runs.

## E2E-001 — Medium — installed Chromium ignored

- Application/page/role: runner configuration; Operations signed-out, anonymous.
- Reproduce: run Operations desktop without a browser-cache override.
- Expected: use installed standard-cache Chromium. Actual: empty workspace cache forced.
- Evidence: before error is missing `.browser-cache` executable; after run selects installed binary.
- Root cause: unconditional `PLAYWRIGHT_BROWSERS_PATH` fallback in config.
- Modified: `playwright.config.ts`, setup documentation.
- Tests: same real browser test rerun; installed binary selected but launch blocked by host; e2e types/unit suite/lint pass.
- Status: cache selection FIXED; browser acceptance BLOCKED.

Latest host readiness evidence supersedes earlier installation observations: see
`browser-readiness-report.md`. Chromium is now installed; MCP definitions are saved
but tools remain unavailable. No browser-confirmed React/Rails defect exists.


## Source-confirmed application defects — priority batches, 11 October 2026

These are source/unit-confirmed findings, not browser-observed defects. Their
code fixes pass automated checks; original live reproduction and browser retest
remain BLOCKED. No console/network evidence or screenshots are invented.

### SUB-001 — Medium — wrong invoice duration wording

- Application/page/role: Operations billing; platform subscription writer.
- Reproduction to run after recovery: activate an isolated WEEK plan, issue an
  invoice through the existing API and inspect its PLAN line.
- Expected: weekly wording from accepted terms. Original actual source: all
  invoices used the literal `Monthly subscription`.
- Evidence/root cause: hardcoded UI issue label and backend description. Isolated
  Ruby regression now covers DAY/TEN_DAYS/WEEK/MONTH/QUARTER/YEAR and unknown terms.
- Files modified: Operations `platform-subscriptions.tsx`; API billing controller,
  `subscription_invoice_description.rb`, isolated description test and existing
  billing integration test. No historic line snapshots are updated.
- Tests: isolated description test 2 tests/8 assertions PASS; scoped RuboCop PASS;
  integration assertion syntax/style PASS, database execution BLOCKED.
- Final status: FIXED IN CODE; live API/browser retest BLOCKED.

### SUB-002 — Medium — hardcoded payment-evidence currency

- Application/page/role: request/change evidence; platform subscription writer.
- Reproduction to run after recovery: enter a non-INR payment amount/reference,
  submit and inspect the API payload and refreshed evidence record.
- Expected: explicitly stated payment currency. Original actual source: nonempty
  amounts always sent `currency_code: INR`.
- Evidence/root cause: hardcoded request/change form bodies; no currency field.
- Files modified: `platform-subscriptions.tsx`, `subscription-workflow.ts` and its
  regression tests. UI now requires currency with amount, trims/uppercases it and
  rejects incomplete evidence before sending. No amount-to-currency inference.
- Tests: USD payload preservation and invalid/missing currency regressions PASS;
  full UI tests/typecheck/lint/build PASS. Actual network capture BLOCKED.
- Final status: FIXED IN CODE; original browser reproduction/retest BLOCKED.

### SUB-003 — Low — unknown administrator readiness shown as not configured

- Application/page/role: provider detail; platform reader.
- Reproduction to run after recovery: render a provider record whose administrator
  readiness field is absent/unknown.
- Expected: Not available. Original actual source: ternary fallback Not configured.
- Evidence/root cause: binary UI mapping conflated absent evidence with false.
- Files modified: `platform-admin.tsx`, `provider-admin-handoff.tsx` and handoff
  markup regression test. Explicit configured/not_configured values remain distinct.
- Tests: unknown readiness markup regression and required UI checks PASS.
- Final status: FIXED IN CODE; rendered browser verification BLOCKED.


## Walkthrough findings — 11 October 2026

Latest Chrome DevTools navigation and screenshot evidence supersedes historical “tools unavailable” statements above. The terminal Chromium blocker is a separate, unresolved gate.

### UI-001 — Low — unclear Operations entry screen

- Observed in the real anonymous desktop/mobile page: a live sign-in screen labelled “Synthetic preview”, with implementation-oriented guidance.
- Changed only Operations entry wording to identify sign-in, administrative work and the next action in plain language. Existing public E2E expectations updated.
- Reference: first pages of UBold `Form.pdf` and `TRISE_Subscription_UI_Design.pdf`; existing card/heading layout retained.
- Validation: actual desktop/tablet/mobile after screenshots inspected; 127 unit tests, typecheck, lint, builds and bundle checks pass.
- Status: entry wording **BROWSER-VERIFIED**. This does not accept the authenticated admin interface.

### UI-002 — Medium — platform bookmark route mismatch

- Source reproduction: the shell accepts `#/platform/plans`, but `PlatformRoute` previously matched only `#platform/plans`; provider parsing and commercial child routes had the same inconsistency.
- Expected: supported bookmark forms reach the same authorized destination. Actual source: slash-form routes fall through or parse incorrectly.
- Changed: shared optional-leading-slash normalization in provider routing, platform dispatch, catalogue and subscription screens; regression cases preserve unsupported-route rejection.
- Validation: 25 provider routing tests and the full 127-test suite pass. Authenticated original browser reproduction/retest **NOT TESTED**.
- Status: **FIXED IN SOURCE / UNIT-VERIFIED; authenticated browser acceptance OPEN**.

### AUTH-001 — High — Google rejects local UI origins

- Real browser console on both apps: `[GSI_LOGGER]: The given origin is not allowed for the given client ID.` Google button resource returned 403. Normal sign-in completion was not established.
- `localhost:4174` also rejected by Google and caused Rails API CORS errors. No origin/CORS configuration was altered.
- The configured OAuth client owner must review its approved local JavaScript origins. No identity, session or grant was forged.
- Status: **OBSERVED; further Google authentication testing SKIPPED per user instruction**. Private workflow verification still needs an existing authenticated context.

Actual screenshots and sanitized outcomes: `docs/evidence/browser-automation/platform-admin-20261011/`. Step queue and limitations: `platform-admin-browser-walkthrough-20261011.md`.
