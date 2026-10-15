# Platform administration browser walkthrough — 11 October 2026

Status: **PARTIAL; Google sign-in testing skipped at user request, authenticated steps NOT TESTED.** Chrome DevTools is connected. This interactive evidence is separate from terminal Playwright Test acceptance, whose previous sandbox-enabled launch failed before page creation. No terminal launch was retried or security control changed.

## Interface pattern recorded before editing

Inspected actual first-page renders of the architecture UBold references `TRISE_Subscription_UI_Design.pdf` and `Form.pdf`. Apply clear page purpose, grouped content and short help text to the existing Operations sign-in card. The change is wording only, using existing Operations markup/primitives; Customer and shared authentication behavior are unchanged. The reference's sample financial values and industry labels are not application data.

## Executed steps

1. Opened real Operations at `http://127.0.0.1:4174/`: signed-out screen rendered; no platform data shown.
2. Opened provider directory and platform overview, new-provider, plans, subscriptions, requests, usage and billing deep links in an isolated anonymous browser context: each kept the protected sign-in screen; no private sidebar or business forms rendered. Reload of billing preserved protection.
3. Inspected Operations at exact emulated 1440×900, 820×1180 and 390×844 viewports: document width matched each viewport, with no horizontal page overflow. Captured real screenshots. These checks cover the signed-out page only.
4. Pressed Tab on the signed-out mobile page: the accessible Google sign-in button received focus. Authentication was not completed.
5. Inspected actual console/network diagnostics: anonymous `/api/v1/me` and `/api/v1/session/refresh` returned expected 401. Google `/gsi/button` returned 403 and console reported `[GSI_LOGGER]: The given origin is not allowed for the given client ID.` The origin error appeared in both real applications. No Rails HTTP 500 was observed in these checks.
6. Checked Operations at `http://localhost:4174/` as a diagnosis: Google also rejected that origin; Rails blocked `/me` via CORS. This hostname is not a working workaround. No CORS or Google-client settings were changed.
7. Opened Customer documents deep link and inspected the same three viewports: signed-out protection remained visible and no horizontal overflow was measured. Captured actual screenshots as a baseline.
8. Corrected Operations entry wording: replaced “Synthetic preview” with “Secure workspace”, made the heading “Sign in to TRISE Operations”, and described the available administrative work and next sign-in action in plain language. Updated existing public E2E heading expectations; no test assertion was relaxed.

Screenshots and sanitized diagnostics are saved under `docs/evidence/browser-automation/platform-admin-20261011/`. Browser-tool file saving was denied, but inline screenshot image bytes were returned and saved through the workspace-authorized terminal. No invented screenshots or copied prior captures were used.

## Authenticated workflow queue

Each row below is **NOT TESTED** until normal platform-admin sign-in succeeds. Required test-provider identity has been requested; no records or grants have been fabricated.

| Order | User journey | Checks required |
| --- | --- | --- |
| 1 | Sign in and enter platform overview | Server-provided grants, clear navigation, platform/provider separation, useful error states |
| 2 | Find and inspect a provider | Search/status filters, pagination, correct detail, refresh/back navigation |
| 3 | Provider identity and business profile | Required/invalid fields, save versus submit, revisions, persisted values |
| 4 | Contacts, offices and documents | Form labels, field errors, pagination, edit/end reasons, final-office safeguard, real authorized attachments |
| 5 | Plans and commercial requests | Published versions, accepted duration/currency, request status, reason dialog cancel/confirm |
| 6 | Payment evidence and activation | Separate approval, evidence review, subscription activation and provider activation; fresh read after mutation |
| 7 | Billing, changes and history | Independent invoice evidence, accepted totals/snapshots, due versus future changes, filters/load-more |
| 8 | Administrator handoff | Invitation versus membership versus delegation; expiry/revision validation; no new authority grants in this session |
| 9 | Usability and regressions | Desktop/tablet/mobile screenshots, modal keyboard/focus, validation, duplicate submission/retry, logout cleanup |

The configured Google client owner needs to review the exact local JavaScript origins or provide the already-approved development client. External configuration was not changed. A completed normal session with existing platform authority and an identified isolated provider is needed before this queue can execute. Approval of a UI review does not authorize provisioning new authority.

## Completed continuation after skipping Google testing

The updated Operations entry screen was captured and visually inspected at desktop, tablet and mobile widths. It retains a clear heading, grouped sign-in card and readable help text. All three actual after images are saved alongside the before images; the public page remains protected. Customer baseline screenshots were captured separately, and no Customer source/shared style was edited.

Source review found a bookmark compatibility defect: `main.tsx` accepted the optional slash in `#/platform/...`, while provider, plan and subscription routing did not. A shared normalization now accepts both `#platform/...` and `#/platform/...` across those screens. Existing provider routing tests now cover both URL forms and still reject unsupported destinations; six catalogue/commercial normalization cases were added. This is source/unit evidence, not authenticated browser acceptance.

127 tests across 20 files, application/E2E TypeScript, lint, both production builds, bundle budgets and `git diff --check` pass. Full functional and user-friendly acceptance of the private platform screens remains open because those screens require an authenticated administrator context. Skipping Google sign-in testing does not create that context.
