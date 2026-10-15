# Subscription administration UI standardization — analysis and implementation record

## Phase 1 — screen and component matrix

| Screen | Current implementation | Existing APIs / behavior | Main UI issue | Planned UI work |
|---|---|---|---|---|
| Plans & Pricing | `platform-plans.tsx`; list, detail, draft form | Plan catalogue supports cursor paging and server `q`, `filter[status]` and `filter[industry]`; draft create/update, validation, publish and retire use separate capabilities and immutable versions | First-page-only table, no industry/billing filters, detail groups commercial terms and readiness together, hard-coded elevator metrics in draft editor | Shared page/filter/table/pagination/status patterns; server name/industry/plan-state filters, loaded-page cycle filter, plan detail sections and API audit history; preserve draft and publication rules |
| Provider Subscriptions | `platform-subscriptions.tsx`; loaded-page filtering, inline selected detail and change form | Cursor-paged subscription/change reads, detail, change request/review/evidence/apply, usage read; list API helper exposes cursor only | Search/status/date apply to loaded rows; provider edit actions distract; detail is embedded in list; historical/current/change records are mixed | Dedicated detail route, provider/code + plan/version/status/effective/expiry table, loaded-page scope label, separate current records and changes, compact details and authorized actions |
| Requests & Approvals | Same manager selected by `/platform/subscription-requests`; inline request details/evidence | Cursor-paged request list/detail, decisions, evidence submission/review, explicit activation; decision requires review capability; paid activation also requires separate gates | Request identity is weak; View/Edit Provider actions prominent; review workflow rendered below list; no clear detail route | Dedicated request detail route, Review primary action, current/requested terms and evidence/history groups, confirmed approval/rejection and reason behavior, activation separate |
| Usage & Limits | Same manager selected by `/platform/subscription-usage`; provider selector and metric cards | Provider-scoped authoritative usage endpoint; separate usage-read capability; provider directory used for selector; no client-supplied limit | Lacks plan/status/billing context, treats absent limit like a generic no-limit condition, no utilization bar, no clear no-entitlement state | Focused page with provider/plan/status context, metric usage/limit and utilization only for finite entitlement, clear absent/unlimited distinction, loaded provider selector behavior |
| Billing & Payments | Billing branch in `platform-subscriptions.tsx`; invoice creation/evidence/actions plus add-on/tax catalogue cards | Cursor-paged invoices and subscriptions; invoice detail, create, evidence submit/review, mark-paid; add-on/tax catalogue reads and mutations. Payment evidence review and mark-paid are separate | Invoice view is selected inline; settings/catalogue cards take primary page space; search/status are loaded-page filters; collection and evidence state hierarchy is difficult to scan | Invoice list and dedicated detail route, snapshot/line/tax/payment/collection/audit sections, main row action View Invoice, catalogues linked to their own routes only where available; keep evidence and independent verification separated |

### Shared patterns and local references

Use Operations-only components and existing TRISE primitives. Apply the local
`TRISE_Subscription_UI_Design.pdf` catalogue/editor hierarchy, `Subscriptions.pdf`
plan comparison treatment, `Tables.pdf` compact searchable rows and pagination,
`Task Details.pdf` grouped record details, and `Invoice Preview.pdf` / `Invoice
Template.pdf` invoice identity, line-item and totals hierarchy. The UBold files
are visual references only; no example business data, payment actions, labels,
or unsupported entitlement assumptions are copied.

The shared platform shell already separates Platform navigation from provider
workspace. The subscription routes currently live under one Subscriptions
accordion. Keep this shell, clarify its five labels, and retain existing route
compatibility. Provider directory and Provider Subscriptions remain distinct.

### API and permission limits

- `GET /platform/plans` implementation supports `q`, status, industry and
  cursor pagination. The UI uses those server filters. Billing cycle is not
  supported by the API, so that control filters loaded plan rows.
- Subscription, request, change and invoice list helpers provide cursor
  pagination but no global search/status/date filters. Client filtering must
  label loaded-page scope and result counts must never imply database totals.
- Provider usage is authoritative and requires
  `PLATFORM_SUBSCRIPTION_USAGE_READ`. Metrics and limits are API-projected;
  absent limit and explicit unlimited are distinct states.
- Plan read/write/publish, subscription read/write/review, and usage access are
  separate capabilities. API remains authoritative. Provider lifecycle is
  separate from subscription activation.
- Invoice totals and tax are server-calculated from accepted plan/add-on
  snapshots and an approved effective tax record. Payment evidence submission,
  independent review and mark-paid remain separate commands.
- No invoice or plan audit endpoint is assumed unless the current response
  actually supplies audit data. No tax rate, plan, subscription, invoice, or
  approval state is fabricated.

No backend or architecture change is proposed. Existing ADR-054/055/057/058/060/063
and the Batch 5 approval plan remain authoritative. This record will be updated
with implementation, automated checks, browser evidence and remaining API gaps.

## Implementation and verification — 11 October 2026

Implemented the shared admin page header/filter/table/empty-state/pagination
building blocks and clarified the five subscription sidebar labels. Plans now
use server-side name, industry and plan-state filtering plus cursor paging;
billing-cycle filtering is limited to loaded pages. Plan details group
overview, pricing/tax, entitlements, versions and the bounded audit history
returned by the plan detail API.

Subscription and request list rows route to addressable detail URLs. Requests
present provider/plan/request/effective-date/remarks, approval history and
payment evidence, with Review as the queue action. Approval and rejection use
the existing review-reason flow; subscription activation remains a separate
write action. Usage shows returned subscription/plan context and clearly
distinguishes finite, unlimited and missing entitlements. Billing has invoice
list/detail routes, loaded-page filters, snapshot/tax totals and separate
evidence verification and collection actions. Catalogue cards were removed
from the invoice list page; there are no catalogue settings routes to link to.

Automated checks passed under Node 24: TypeScript, ESLint, 143 Vitest tests,
both production builds, bundle budget and `git diff --check`. Vite reports the
Operations main chunk above 500 kB before compression; the gzip bundle check
passes. The UI has not received fresh rendered/browser verification because
the previously recorded terminal Chromium launch crashed; browser acceptance
remains blocked. Subscription/request/change/invoice global filtering and
sorting are not supported by the current list API contracts; filters remain
explicitly scoped to loaded pages. Invoice detail does not expose audit
history. Tax/add-on management has no independent settings screen in the
current route inventory. No API, database, architecture or permission change
was made.

## Subscription billing invoice refactor — 15 October 2026

Billing now uses the dedicated `#platform/subscription-billing/new` route and a
four-step wizard: eligible subscription selection, recipient/billing context,
server tax preview with charges/add-ons, and review/issue. Subscription selection
is immediately populated and searches server-side by provider, Business, provider
reference and accepted plan name/code. The API response includes readable Business
and plan metadata while retaining UUIDs only for internal relationships.

Issued invoice details retain overview, PDF preview, payment/delivery and activity
sections. `View PDF inline` fetches the authorized PDF as a private Blob URL and
embeds it in the application; explicit Download remains separate and object URLs
are revoked during cleanup. Existing payment evidence, review, mark-paid, email and
resend actions remain permission-gated and server-authoritative.

Validation: UI `npm test -- --run` (32 files, 175 tests), `npm run lint`,
`npm run typecheck`, and `npm run build:operations` passed. API focused
`platform_subscription_api_test.rb` in documented LEGACY test mode passed with
8 tests and 79 assertions, including provider/Business/plan search coverage.
Fresh authenticated browser/PDF visual evidence remains BLOCKED by the recorded
host-managed Chromium launch restriction.
