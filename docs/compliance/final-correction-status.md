# Compliance reference-match correction status

## Implemented

- Platform Compliance now lands on an Approval Inbox master/detail queue rather than auto-opening the first request or rendering licence cards above the queue.
- Approval Inbox has compact server-backed summary metrics, search/status filters, paged request rows, a blank initial detail state, Changes/Evidence/Activity/Details tabs, structured diffs, and separate reviewer assignment and decision steps.
- Business Compliance continues to use the seven-tab workspace and modal forms. The shared upload flow now has one contextual heading, a real Browse files control, required classification selection, supported `Other` input, file replacement, upload/finalization feedback, and scan/lifecycle display.
- Human-readable display infrastructure and inventory are present; internal UUIDs remain only in API state, routes, keys and mutation payloads.

## Licence authorization investigation

The current API route is `GET /platform/licence-authorizations` backed by `PlatformProviderLicenceAuthorizationsController#index`. It returns a collection and has no detail/new-record endpoint or human-readable provider/business/source-licence projection. The serializer currently exposes foreign keys and depends on the authorization/activity/territory associations. The requested 500 could not be reproduced because Rails cannot boot in the current environment: system Ruby 2.6 uses an incompatible Bundler and rejects the Gemfile's `windows` platform while the lockfile requires Bundler 4.0.21. No response was changed to hide this failure.

## Remaining blockers

- Business logo ownership/activation is not implemented because the API currently exposes provider-logo routes only; no Business logo assignment/thumbnail projection exists.
- Licence authorization detail/new-record APIs and readable summary projections are required before safely implementing the complete detail workflow.
- Business document classification `Other` is currently sent through the existing free-form classification field; backend controlled metadata validation is still required.
- Authenticated screenshot comparison and browser acceptance remain NOT RUN in this pass because the private browser fixture is unavailable.

