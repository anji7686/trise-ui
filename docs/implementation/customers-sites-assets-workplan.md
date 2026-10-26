# Customers, Sites & Assets workspace workplan

## Outcome

Give provider teams a clear, responsive workspace for the customer journey:

`Customer identity and billing -> Site / shipping location -> Elevator, lift or other asset`

The UI reuses the existing provider-scoped API operations and capability
projection. No new client-only records or permission assumptions are added.

## Recommended data boundary

- **Customer** is the provider-scoped commercial/service relationship. Name and
  phone are required; email is optional until an invitation or email delivery
  is requested. Customer billing address is optional at first capture.
- **Community** is a top-level service location, not another customer. It can
  contain buildings, blocks, towers or wings.
- **Site / location** is the physical service or shipping place below the
  customer, optionally below a community. Its address becomes required when a
  team is ready to dispatch or visit the site.
- **Asset** is the installed equipment at a location. Elevator, lift,
  escalator, platform lift and other equipment remain catalog-defined asset
  definitions; they do not need separate customer or database tables.

The operational chain is therefore:

`Provider -> Customer -> Community/Site -> Asset -> Work Intake -> Lead/Survey -> Quotation -> Project/AMC`

The guided onboarding step captures the customer first, then builds the
property hierarchy and registers equipment. Every read and write remains
provider-scoped by the API; the UI never treats a customer, site or asset as a
global record.

## Delivery batches

| Batch | Scope | Status |
| --- | --- | --- |
| 1 | Split navigation into Customers, Sites & Locations, and Assets | Complete |
| 2 | Keep each screen focused on one record type and reuse existing create/edit dialogs | Complete |
| 3 | Add provider-scoped search, customer/site filters, 15/30 pagination, and stale-request protection | Complete |
| 4 | Gate create/edit actions with the server-projected `customer_admin` capability | Complete |
| 5 | Verify customer -> site -> asset navigation, role-backed deep links, modal open/close, and no-data states | Complete |
| 6 | Run typecheck, focused navigation tests, operations E2E, and `git diff --check` | Complete |

## Behavior contract

- Customers contains identity, relationship status, billing address and profile
  summary.
- Sites & Locations contains physical shipping/service locations. A site is
  linked to an authorized customer relationship.
- Assets contains installed equipment such as elevators, lifts and escalators.
  Assets are filtered by customer and site, and use server-returned definitions
  and attribute rules.
- A user without `customer_admin` can still use the authorized read workspace,
  but cannot create or edit records. The API remains the final authority.
- Lists default to 15 records and allow 30; search is debounced before the
  provider API is called.
- Existing customer, location and asset APIs remain the source of truth.

## Verification evidence to record

- Provider Administrator: all three routes render and create actions are
  available only where the API capability is present.
- Read-only provider role: routes can render only when `customers` is projected;
  create/edit actions are absent without `customer_admin`.
- Mobile and narrow layouts: filters stack, cards become one column, and no
  horizontal scrolling is required for the workspace controls.
- Dark mode: controls use the existing theme tokens and retain readable
  contrast.
