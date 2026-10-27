# TRISE UI Agent Instructions

## Scope

These instructions apply to the TRISE web applications in this repository.
Preserve the separate Customer and Operations application boundaries,
authentication behavior, generated API types, authorization presentation, and
uncommitted user work.

## Provider-side visual reference

For every new or materially changed Operations/provider-side screen, first
inspect the applicable local UBold PDF reference files in:

`../trise-architecture/Template design screen shot files from Ubold/`

Use the architecture reference index for the mapping of PDFs to patterns:

`../trise-architecture/docs/ubold-reference-index.md`

The UBold PDFs are visual references only. Adapt their layout patterns—compact
sidebar/header, page title and breadcrumb, summary cards, filter toolbar,
readable tables, status badges, detail sections, timelines, row actions,
pagination, and responsive behavior—to TRISE terminology and authoritative
API data. Do not copy ecommerce labels, sample records, unsupported metrics,
payment fields, destructive actions, or template code into the application.
Do not copy the PDFs into an application bundle.

Before editing a screen, record which reference pattern is being applied and
compare the rendered result at desktop and narrow widths when browser tooling
is available.

## Canonical UI design instructions

Use [`docs/design/TRISE_UI_DESIGN_SYSTEM_AI_INSTRUCTIONS.md`](docs/design/TRISE_UI_DESIGN_SYSTEM_AI_INSTRUCTIONS.md)
as the implementation contract for all new and materially changed screens.
It defines the approved logo treatment, typography, tokens, button variants,
forms, read-only views, tabs, accordions, tables, filters, dialogs, responsive
behavior, status colors, and acceptance checks. Do not invent a competing
pattern in a feature stylesheet. Extend the shared primitive or token system
when a pattern is genuinely reusable.

## Customer boundary

The Customer application is excluded from the UBold provider-dashboard design
mandate. Do not redesign Customer navigation, styling, layout, or shared
primitives in a way that changes Customer rendering. If a shared primitive
must change, prove Customer behavior and appearance remain unchanged or use an
Operations/provider-specific variant.

## Data and security

- Use existing generated OpenAPI types and implemented operations only.
- Keep platform administration separate from provider workspaces.
- Treat server authorization as authoritative; never infer authority from an
  email address, role label, hidden button, or client-side route guard.
- Do not fabricate totals, relationships, statuses, subscription data,
  payment state, audit evidence, or successful business actions.
- Preserve revisions, idempotency, pagination, context-scoped state, logout
  cleanup, and stale-response protection.
- Do not add authentication bypasses, identity mappings, migrations, or API
  contracts unless the task explicitly authorizes them.

## Implementation and verification

Keep feature modules separate from application bootstrap and reuse the existing
TRISE primitives, tokens, themes, localization, and accessibility patterns.
Apply the visual reference to provider/admin, operations, dispatcher, agent,
workforce, commercial, configuration, audit, and platform screens as supported
by current APIs. Keep unsupported capabilities omitted or explicitly marked
unavailable.

Follow the canonical design guide's data-loading and production-performance
requirements for every new or changed feature. Keep primary content independent
from optional lookups, use bounded server pagination, debounce search, reuse
provider-scoped data, and protect against stale responses. Coalesce identical
concurrent GETs and use short-lived in-memory caching only for stable lookups;
key cached data by session/provider, and invalidate it after writes or context
changes. Never persist authenticated customer or provider data in localStorage.
Review request counts for the initial screen and repeated interactions, and
consider representative production-sized data before calling the feature ready.

For UI changes, run typecheck, tests, lint, production builds, bundle-budget
checks, and `git diff --check`. Report automated, rendered, and authenticated
browser evidence separately. Never claim visual acceptance from compilation
or HTTP responses alone.
