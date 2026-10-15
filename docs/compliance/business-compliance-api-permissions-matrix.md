# Business Compliance API and permissions

| UI capability | Existing API | Permission boundary |
|---|---|---|
| Business overview | `GET /platform/businesses/:id` | Platform Business read capability and server-side Business scope |
| Legal identity proposal | `POST /platform/businesses/:id/legal-profile` | Platform compliance write; approval remains governed |
| GST association | `POST /platform/businesses/:id/tax-registrations` | Platform compliance write; canonical tax ownership is validated by API |
| Requirements | `GET /platform/compliance/requirements?status=ACTIVE` | Published requirements only; synthetic fixtures hidden by UI |
| Business requests | `GET/POST /platform/compliance` with `business_id` | Platform compliance read/write; revision and idempotency remain server-controlled |
| Business history | `GET /platform/businesses/:id/compliance-history?kind=versions\|audit&page=1&per_page=10` | Platform compliance read; immutable server-generated records |
| Documents | Existing Business document create/list/finalize/download endpoints | Scoped private storage, scan state, authorization and lifecycle checks |
| Licence visibility | Existing platform licence authorization collection | No decision or assignment controls in the Business workspace |

The client never treats a submitted request as approved, never edits canonical GST values, and never exposes storage keys. Approval, maker-checker, RLS and evidence activation remain API responsibilities.

