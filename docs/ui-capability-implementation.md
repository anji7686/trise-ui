# TRISE UI capability implementation

Status: **IMPLEMENTED FOUNDATION / INCREMENTAL**

The Customer and Operations applications are separate Vite builds over the
same Rails API. They do not contain industry branches: elevator, vehicle,
appliance, home-service, and association records are examples of the same
asset, service, booking, workforce, coverage, document, and configuration
capabilities.

## Navigation and operation mapping

| Experience | Route | Capability | API operations currently wired |
| --- | --- | --- | --- |
| Customer | `#/` | Home, upcoming visit, asset/activity previews | `ListAsset`, `ListServiceBooking`, `ListServiceRequest`, `ListProvider` |
| Customer | `#/assets`, `#/asset/:id` | Authorized assets and location | `ListAsset`, `GetAsset`, `GetLocation`, `ListProvider` |
| Customer | `#/asset/:id/request` | Service selection and requested booking | `ListServiceType`, `GetAsset`, `CreateServiceBooking` |
| Customer | `#/requests` | Request history | `ListServiceRequest` |
| Customer | `#/bookings` | Booking history | `ListServiceBooking` |
| Operations | `#requests` | Provider request queue/detail | `ListServiceRequest`, `GetServiceRequest` |
| Operations | `#overview` | Bounded provider workspace summary and attention preview | `ListServiceRequest`, `ListServiceBooking`, `ListServiceJob` |
| Operations | `#bookings` | Capacity-backed appointment and job creation actions | `ListServiceBooking`, `ListCapacityPool`, `CreateAppointment`, `ConfirmAppointment`, `RescheduleAppointment`, `CreateServiceJob` |
| Operations | `#jobs` | Assignment, agent response, visit, and execution workspace | `ListServiceJob`, `ListAgent`, `ListAssignment`, `AssignServiceJob`, `AcceptAssignment`, `DeclineAssignment`, `ListServiceVisit`, `CreateServiceVisit`, `CheckInAgent`, `StartService`, `CompleteServiceJob` |

Server responses remain authoritative. Requested windows are not rendered as
confirmed appointments, and the UI does not infer assignment eligibility,
coverage, payment, completion, or permission from labels.

## Boundaries

Shared packages contain transport, authentication, tokens, primitives, and
localization. Customer and Operations own their feature data adapters and
screens. Provider context is part of every private cache key and API request.
Idempotency keys are generated per logical mutation; payload changes require a
new key. Revision conflicts are surfaced as API errors for reload/review.

The current contract does not expose customer-safe request-type discovery, so
the customer booking screen uses authorized `service_type_id` values returned
by `ListServiceType` and explicitly labels request-type discovery as
unavailable. It never asks the customer to enter an internal UUID. Asset
registration, quotation, document transfer, configuration administration, and
membership workflows remain subsequent screens until their implemented contract
adapters are added. Agent-directory enumeration is correctly denied to
customer-context sessions; a dispatcher must authenticate with an operations
membership before the assignment selector is available.

## Validation scenarios

Focused UI tests cover booking payload construction and authentication error
classification. Browser acceptance must use the real local API and synthetic
records: Customer asset → booking request → Operations appointment action →
assignment. Mocked component tests do not count as API integration evidence.

## Implementation order

1. Shared shell, context isolation, assets, locations, request/booking history.
2. Appointment/capacity actions, persisted job creation, assignment, agent response, visit, check-in, start, and completion actions.
3. Quotations, coverage, documents, custody, and stages.
4. Memberships, notifications, workforce/configuration administration.

No offline mutation queue or authenticated-response service-worker cache is
used. English, Kannada, and Hindi remain externalized; Kannada and Hindi are
draft translations pending review.

The approved logo is served from `apps/customer/public/assets/trise-logo.png`
and `apps/operations/public/assets/trise-logo.png`, copied from the
architecture repository source asset.
