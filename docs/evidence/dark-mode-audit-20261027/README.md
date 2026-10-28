# Operations dark-mode live audit — 2026-10-27

## Scope and method

Audited the authenticated Operations workspace in Chrome at `http://127.0.0.1:4174` in dark mode. The live browser workflows cover all 21 Global Administrator destinations and 21 Provider Administrator destinations, with representative child actions, dialogs, detail pages, tabs, gated actions, and role-specific navigation. Checked headings, loading/error/forbidden states, API failures, horizontal overflow, and full-page captures. Mutating dialogs were opened and canceled; no customer or provider records were created or changed.

## Observations and fixes

| Area | Observation | Result |
| --- | --- | --- |
| Shared search | The provider shell search retained a near-white background in dark mode, with light-theme input text and suggestion colors. | Fixed with dark tokens for the shell, input, placeholder, and suggestion list. |
| Onboarding form | The form surface switched to dark, but its detail-card border stayed pale blue. Form/select surfaces did not explicitly use the dark native color scheme. | Fixed to use the dark border and elevated-surface tokens; inputs/selects/textareas now use dark colors and placeholders/disabled controls are styled for dark mode. |
| Native controls | The root advertised both light and dark color schemes regardless of the selected theme, allowing browser-native controls to remain inconsistent. | The root now sets `color-scheme` to match explicit light/dark preferences. |
| Phone navigation | The fixed account/notification/check-in cluster overlapped the mobile `Menu` button and intercepted clicks. The search field also collapsed to an icon-sized control. | Fixed small-screen header spacing and stacking for both provider and platform headers; the search keeps a usable share of the header and menu buttons remain clickable. |
| Account/theme menu | Dark surfaces, labels, selects, and sign-out action were readable in the live provider session. | No further change needed. |
| Onboarding disabled steps | Future steps and “Continue to community” remain visually subdued while no customer is selected. | Expected disabled state; left unchanged. The live form could not advance without selecting/creating a customer, and no business data was created for this audit. |

## Menu and screen coverage

- Opened all 21 Global Administrator platform destinations live in dark mode: overview, businesses, providers, configuration registry and overrides, business-operations catalogue, approval inbox, audit log, reference data, notifications, compliance, provider users, maintenance, plans, subscriptions, subscription requests, usage, billing, taxes, platform team, and roles. Each rendered a heading, had no forbidden/error/alert state, and fit the desktop viewport.
- The platform captures and contact sheet are saved under [`platform/`](/Users/anjanreddy/wrk/trise/trise-ui/docs/evidence/dark-mode-audit-20261027/platform/), with the overview, directory and other screens available individually.
- Provider destination pass covers 21 screens: overview, leads, quotations, projects, service requests, bookings, jobs, customers, sites, assets, AMC, workforce, reports, administration, business profile, compliance, team access, audit, onboarding, configuration, notification policies, and subscription. It opens representative create/edit/status dialogs and detail pages, checks project and quotation tabs, and inspects visible prerequisite gates without submitting or saving forms. Full-page dark captures are saved under [`provider/`](/Users/anjanreddy/wrk/trise/trise-ui/docs/evidence/dark-mode-audit-20261027/provider/); overview contact sheets are at [`provider-menu-contact.png`](/Users/anjanreddy/wrk/trise/trise-ui/docs/evidence/dark-mode-audit-20261027/provider-menu-contact.png) and [`platform-menu-contact.png`](/Users/anjanreddy/wrk/trise/trise-ui/docs/evidence/dark-mode-audit-20261027/platform-menu-contact.png).
- Provider deep-link coverage additionally checks intake, billing, sites, assets, attendance, leave, AMC plans, support coverage, extra-day credits, quotation templates, and notifications. Related child routes are verified active in navigation, with representative template edit/view actions.
- Platform screens rendered with no API failures, forbidden/error states, alerts, loading text, or horizontal overflow. Provider screens have the same result aside from the explicit permission-gated contact-routing lookup below. The logo endpoint can return 503 when private logo storage is unavailable; the screen exposes its recovery message.
- The seeded provider context receives `403` from `GET /api/v1/contact-routing/resolutions`; the request detail screen shows “Contact routing is unavailable for this request in the selected provider context.” The lookup failure is handled in the UI. The audit verifies the message and records this as an authorization/data-read limitation for that provider context.
- The project workflow correctly gates installation-job creation when no service location or linked elevator unit exists, with the prerequisite explained. Per-unit handover is likewise unavailable until an authorized elevator unit is linked. A submitted service report correctly locks part usage as read-only. These are expected data-dependent gates, not dark-mode defects.
- Jobs table status chips wrapped into narrow multi-line badges. Fixed the status column minimum width and kept the chips on one line; the verified dark screen capture now shows the status labels at normal width.
- Updated stale visual checks to match the live routes and UI: quotation negotiation is on the “Review & actions” tab, projects use the shared 15-record display instead of per-table page-size controls, service requests open via “View”, and unavailable project actions are checked through their prerequisite message.

## Role and action coverage

- The live role matrix covers platform administrator and reviewer; provider administrator and reviewer; operator; customer; agent; marketing executive and manager; and asset administrator.
- The matrix checks that each role receives only its server-authorized navigation and notification access, and verifies that the document is rendered with dark theme active.
- The ten-persona mobile role matrix passed at a 390 px viewport.
- The authenticated provider setup workbook workflow passed: XLSX download returned HTTP 200 with the spreadsheet content type, the workbook uploaded, validation ran, and the page rendered at a 390 px viewport without horizontal overflow.
- The mobile role matrix found the header/menu overlap described above. The sidebar navigation sequence and mobile header were corrected, then the ten-persona mobile role matrix passed with tracing disabled.

## Reports screen follow-up

- The live Reports page showed white KPI cards and workload metric rows in dark mode. Added dark surfaces, readable secondary text, and dark-toned KPI icons.
- The report-definition edit form compressed its allowlist labels into three columns, and long saved report names crowded export/schedule dialog titles. The allowlists now use two columns, the report-name field spans the form, and export/schedule dialogs use short titles with the full selected report name shown in the form.
- Switching from Preview left its “Preview loaded” status visible on other tabs. Manual Reports tab changes now clear stale preview/error messages; queued export and schedule confirmations remain visible after those operations.
- The Reports workflow opened and canceled Create, Edit, Export, and Schedule forms; loaded a bounded Preview; checked Scheduled reports and Export history; and verified the selected tab state. Screenshots are under [`reports/`](/Users/anjanreddy/wrk/trise/trise-ui/docs/evidence/dark-mode-audit-20261027/reports/).

## Automated checks

- `npm run typecheck` — passed.
- `npm run lint` — passed after the UI changes.
- `npm test` — 45 test files, 290 tests passed.
- `npm run build` — passed for Customer and Operations. Vite still reports the existing large Operations chunks; they remain within the configured compressed bundle budget.
- `npm run check:bundle` — passed (Customer 72,974 bytes; Operations 181,263 bytes; each target 204,800 bytes).
- `npm run test:e2e:typecheck` — passed after role test updates.
- Global Administrator workflow — all 21 platform destinations passed in dark mode.
- Provider Administrator workflow — all 21 provider destinations and representative actions passed in dark mode.
- Provider capability deep-link workflow — passed, including nested configuration screens.
- Reports create/edit/preview/export/schedule/history workflow — passed in dark mode with active tab state verified.
- Mobile role matrix — all ten personas passed.
- `git diff --check` — passed.

## Changed files

- `packages/design-tokens/src/theme.css`
- `apps/operations/src/operations-design.css`
- `apps/operations/src/jobs.css`
- `tests/e2e/role-navigation-notifications.spec.ts`
- `tests/e2e/critical-visual-workflows.spec.ts`
- `tests/e2e/provider-capability-navigation.spec.ts`
