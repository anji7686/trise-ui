# Customer portal redesign and implementation ledger

**Status: IN PROGRESS** — responsive customer shell and existing-screen visual refresh implemented on 2026-10-28. The customer app continues to use the current TRISE identity, provider context, API resources, and authorized business actions.

## Design inputs

- Customer visual baseline: [`customer-agent-experience`](../../../trise-architecture/docs/design/customer-agent-experience/README.md), a local interactive mock with fictional in-memory data.
- Provider layout patterns: [`TRISE_UI_DESIGN_SYSTEM_AI_INSTRUCTIONS.md`](../design/TRISE_UI_DESIGN_SYSTEM_AI_INSTRUCTIONS.md) and the provider reference catalogue in the architecture repository. Adapted patterns are compact navigation, page framing, summary cards, status labels, detail sections, responsive forms, and consistent action placement.
- Customer and Agent remain separate experiences over the shared API. This work changes Customer presentation only; Agent screens remain deferred.

The local customer mock demonstrates the intended visual direction. Its sample names, amounts, statuses, links, and in-memory interactions are not treated as application data or business behavior.

## Implemented in this change

- Added a responsive Customer workspace shell with the approved brand header, notification entry, grouped desktop navigation, account preferences, and mobile bottom navigation. Provider choice is account content under “My providers,” not a header control.
- Exposed every route already present in the customer app through navigation: Overview, Assets, Bookings, Service requests, Projects, Quotations, Warranty & AMC, Documents, Alerts, and Profile. Asset/request/document detail routes stay within their parent navigation item.
- Reordered Customer navigation to follow the mock overview sequence where supported: Overview, assets and places, service/bookings and service history, projects, quotation approvals, coverage, and documents. Service requests and account options remain available. Added consistent SVG icons to navigation and profile-menu actions, and icon-backed System/Light/Dark theme controls in Profile.
- Refreshed the existing API-backed cards, headings, forms, status labels, and mobile layout using the Customer theme tokens. The existing quotation-specific review and sign-in presentation remain separate from the general workspace shell.
- Reworked Overview to follow the mock’s content sequence: greeting/date hero and service action, API-derived summary tiles, next confirmed/rescheduled visit with date tile, assets, a quotation approval card, scan/document/coverage links, and recent activity. Summary counts use `+` when the API page indicates additional records; jobs, quotation and coverage summaries load independently so those optional endpoints do not block the core overview.
- Refined Overview asset previews into status/identifier cards and Recent activity into dated, keyboard-accessible request links. Matched the primary service and quotation actions to the navy/blue theme and improved their hover/focus states.
- Reduced Overview startup traffic to its three primary, page-bounded collections (3 assets, 25 bookings for upcoming appointment lookup, and 3 recent requests). Quotation review and coverage records now load only when the customer opens those routes; the Overview uses direct links instead of fetching full quotation, job, warranty, and contract collections to draw nonessential counts.
- Replaced the generic diamond in asset previews, lists, and details with the equipment illustration used by the customer mock. Asset type-specific illustrations need an authorized asset type label in the API response; the current customer representation does not supply one.
- Added opaque-cursor “Load more” pagination to the Assets, Service requests, and Bookings lists. Those customer collections default to 10 records per request; the Overview uses 3-record previews for assets and requests and 10 bookings for upcoming-visit lookup.
- Matched the mock’s compact mobile navigation pattern with Overview, Assets, Services, and a More menu; the More menu keeps all remaining implemented routes reachable without a long horizontal nav strip.
- Added an authorized “My providers” directory. Customer identity and profile stay account-wide. Overview and Assets now show authorized assets across all relationships by querying `/providers` and then the existing provider-scoped `/assets` operation per relationship; selecting an asset establishes its own authorized provider context for detail and service actions. Other operational collections remain provider-scoped and lead to My providers when no relationship is active. No default provider is restored from session storage.
- Overview upcoming appointments and the Bookings page now aggregate bounded `/service-bookings` reads across those same authorized relationships. Appointment panels no longer ask the customer to select a provider first; the aggregate list identifies the relationship for each booking and can open that provider's service history.
- Fixed Overview rendering when there is no selected provider: appointments, quotations, scanning, and recent activity now explain how to open the appropriate provider-scoped data, and recent activity safely handles an absent request collection. The initial unauthenticated `/me` 401 remains the normal signed-out session probe and is handled by the existing auth provider; it no longer results in an Overview crash after sign-in.
- Clearing provider context now clears the authenticated API client context and session storage; it cannot leave a previous provider selected in the API client.
- Fixed the quotation Messages navigation anchor and reset acceptance evidence when the provider, quotation, or revision changes.
- Acceptance actions now require an eligible open status, provider review, online approval mode, and an unexpired offer in the UI. The server continues to enforce all commercial and authorization rules.
- Corrected quotation dark-theme tokens and contrast for warning/success/scope/payment panels, status controls, and navigation; tightened the quotation header at widths below 360px and made the customer mobile navigation's horizontal scroll cue visible.
- Set the main customer header to TRISE’s default navy brand surface and use the approved white-wordmark asset without recoloring it; pale quotation headers retain the approved navy-wordmark asset. Replaced the green/teal customer accent with TRISE navy/blue. Added the header profile menu with profile details and Logout; moved Language and Theme controls into Profile and removed “Customer portal” header text.
- Fixed the customer header to the viewport top and made it compact on scroll. Added a fixed Terms & Conditions footer tag; on phones, the footer sits below the fixed four-tab navigation to keep both controls clear of page content.
- Redesigned the signed-out Customer login screen with a responsive brand panel and secure sign-in card, preserving the existing Google and local-development sign-in behavior. Uses the approved light wordmark on the navy header.
- Kept the API request contract, generated types, identity mechanism, quotation revision semantics, approval evidence, idempotency, and customer/provider data boundary unchanged.

## Existing customer functionality map

| Route / use case | Current behavior preserved | Review state |
| --- | --- | --- |
| Sign-in and quotation deep link | Existing Google sign-in; quotation route remains selected through sign-in; no anonymous quotation detail | Code preserved; auth tests pass; browser flow not re-run |
| Home | Authorized assets from all associated providers, upcoming booking and recent requests for the active provider, service request entry, asset identifier resolution | Cross-provider asset behavior and no-provider empty panels checked in browser with synthetic API responses; provider-scoped live business actions not submitted |
| Assets and asset detail | Authorized assets from all associated providers; asset click establishes the corresponding provider context before detail/service request | Cross-provider asset list and context navigation checked in browser with synthetic API responses; live asset detail not exercised |
| Places and service history | Authorized service locations and provider-scoped customer-visible timeline | Supported routes exist in the Customer app; live responsive, partial-error, retry, denied and same-provider cursor behavior is covered by Customer e2e checks |
| Service requests | Request creation, request list, and request detail | Code preserved; no authenticated browser walkthrough |
| Bookings and jobs | Booking list and server-sourced linked job progress | Code preserved; no authenticated browser walkthrough |
| Projects and handover | Installation-project progress and revision-protected handover acknowledgement | Code preserved; no live action submitted |
| Alerts | Notification list and idempotent mark-read action | Code preserved; no live action submitted |
| Profile | Profile name/language update with expected revision | Code preserved; no live action submitted |
| Quotations | Customer-scoped list, exact revision detail, provider snapshot branding, scope, pricing, payment stages, terms, review/decision history, messages, and acceptance evidence | Code preserved; message anchor and context-reset issues fixed; no decision submitted |
| Warranty and AMC | Authorized customer-safe coverage summary | Code preserved; no authenticated browser walkthrough |
| Documents | Authorized list, version detail, and per-version attachment authorization | Code preserved; no file download performed |

## Verification ledger

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS — 46 files, 299 tests |
| Focused customer data, API client, and auth tests | PASS — 3 files, 17 tests |
| Customer production build | PASS — 85,265 compressed initial JavaScript bytes |
| `npm run check:bundle` | PASS — customer and operations under configured initial compressed budgets |
| `npm run build` | PASS — customer and operations production builds; Vite reports its existing advisory for large uncompressed Operations chunks |
| `git diff --check` | PASS after implementation and ledger updates |
| Customer Overview/list request shape | PASS by code review — with a provider active, 3 initial calls; with no provider selected, bounded Assets and Bookings reads are made per authorized relationship. Assets, Bookings, and Service requests default to 10 rows per page; Overview previews use 3 assets and requests |
| Live Customer portal viewport review | PASS — Playwright screenshots and layout checks at 1440×900, 1024×768, 768×1024, 390×844, and 350×740; no horizontal overflow; mobile header 68px at top and 56px after scroll; footer clears mobile navigation |
| Live Customer navigation/theme review | PASS — local synthetic customer sign-in, provider selection, mobile More → Alerts active state, Profile theme switch to dark; no browser page errors |
| Signed-out Customer login review | PASS — Google and local sign-in controls render at desktop and mobile widths; light/dark layouts have no horizontal overflow; synthetic customer sign-in completed successfully |
| Customer dev server HTTP response | PASS — `http://127.0.0.1:4173` returned HTTP 200 |
| Local API schema and health | PASS — four pending development migrations applied; `/up` returned HTTP 200 |
| Anonymous quotation access | PASS — `/api/v1/quotations` returned HTTP 401 |
| API quotation/notification regression tests | PASS — 74 tests, 652 assertions |
| Authenticated customer/API walkthrough | PASS — desktop/mobile authenticated route matrix passed for quotation, AMC, assets, documents, alerts/preferences, feedback, help, profile, sign-in and Service History. Success, empty, denied, retry, partial-error and stale-revision states are covered; no live commercial decision was submitted. |
| Provider-independent asset Overview and list | PASS — Playwright mocked two authorized provider relationships and three assets; all assets rendered without a selected provider; selecting an aggregate asset established scoped navigation; zero uncaught browser errors |
| Provider-independent appointments and Bookings page | PASS — Playwright mocked two authorized provider relationships and one appointment each; Overview showed the next appointment without a provider-selection prompt and Bookings displayed both relationships; zero uncaught browser errors |
| Signed-out `/me` and Overview null-state regression | PASS — simulated initial `/me` 401; existing auth flow handled it, and the signed-in Overview rendered with requests unavailable in provider-independent mode without a TypeError |

Rendered Playwright checks confirm the login and portal layouts at representative viewport sizes. They do not cover every authenticated customer workflow or prove business actions against the current local database.

## Follow-up status

1. **Complete:** keyboard navigation, 200% browser zoom, long-value wrapping, desktop/mobile route behavior and recovery states were checked. The Customer E2E routes passed; desktop-only viewport and eligibility matrices are intentionally not duplicated on mobile.
2. **Complete for the supported current API:** authenticated Customer routes were exercised with development identities and scenario data. Route responses, empty/denied/error/retry states, same-provider cursor behavior, cross-provider asset/coverage access and responsive results are covered without submitting a live quotation decision.
3. **Capability boundary (reviewed 2026-10-30):** the Customer app already has API-backed feedback, Service History and provider help/contact routes. The proposal's family/site member invitations and standalone QR/quick-service requester flow have no matching customer API workflow. Keep those experiences deferred; do not simulate identities, access grants, verification or requests in the UI. This closes supported API capability mapping only; exact visual acceptance of every proposed mock screen has not been claimed.
4. **Separate API/security follow-up:** OpenAPI requires provider context for `/assets` and has no authorized cross-provider customer asset summary. The current UI makes one bounded first-page asset request per authorized provider, then paginates within each relationship; request count therefore grows with provider relationships. Review an additive customer asset summary/aggregation contract, sparse-field support, SQL plans and response sizes with API/security approval before changing behavior. This remains outside the completed quotation/AMC/customer-journey tracker.

