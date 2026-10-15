# TRISE local browser policy and activation

10 October 2026. Repository endpoint guards are active. Host policy templates are
PROPOSED and inactive. This managed session cannot replace its own restrictions,
write global Codex settings, grant browser privileges, or supply host metadata.

## Access boundaries

| Surface | Allow | Keep restricted |
| --- | --- | --- |
| Filesystem | TRISE workspace, temporary browser profiles/artifacts, installed runtimes read-only | Outside-workspace writes, personal Chrome profiles, `.aws`, policy directories and Git metadata writes |
| Local HTTP | Discovered Customer, Operations and API origins | Production, shared environments, other LAN hosts, arbitrary URL credentials |
| Browser installation | Temporary exact download-host list and workspace cache | Unrestricted network, wildcard domain grants, automatic runtime package downloads |
| Browser execution | Chromium sandbox, fresh profile, local artifacts, real development login | Disabling authentication, authorization, TLS validation, Chromium sandbox, personal sessions |
| Debug transport | Pipe/stdio; if CDP is required, exact loopback binding in a dedicated profile | Public debugging ports, `0.0.0.0`, personal-profile attachment |
| MCP | Reviewed/pinned local packages, verify live tool catalog, explicit tool decisions | Assume config equals connected; auto-approve arbitrary evaluation, destructive actions or external sends |
| Data | Synthetic local records; role-specific real sessions | Production writes, external reminders, database resets, copied customer data |

The endpoint validator in `tests/e2e/browser-policy.ts` is used by Playwright
configuration. It requires HTTP(S), exact loopback hosts and no embedded
credentials/query/fragment. Fifteen unit cases cover accepted and rejected URLs.
It validates initial application/API targets, not every subresource, popup or
redirect; it is not a replacement for host/network browser controls.

## Reviewable host profiles

- `policies/trise-local.config.toml`: local command profile; network proxy enabled,
  loopback allowlist, workspace writes and runtime reads.
- `policies/trise-download.config.toml`: temporary bootstrap profile; npm and
  observed Playwright CDN hosts, only cache/dependency/manifest writes.
- `policies/mcp-servers.example.toml`: inactive server definitions, local reviewed
  entrypoint placeholders, per-tool prompts. Do not enable before replacing paths.

Official [permission documentation](https://developers.openai.com/codex/permissions)
requires an active network proxy for command domain filtering. MCP and browser
traffic have separate controls. Host allowlists are not port-specific. The profile
therefore allows loopback hosts, not only TRISE ports; a host firewall/executor
port policy is needed for exact-port enforcement. PostgreSQL uses non-HTTP TCP;
HTTP proxy rules alone do not establish database access. Request an exact local
PostgreSQL destination after inspecting the real Rails configuration. Do not add
invented `allowed_ports` TOML fields or broaden all private-network access.

The download profile starts with `registry.npmjs.org`, `cdn.playwright.dev` and
`playwright.download.prss.microsoft.com`. Additional redirect hosts are disabled
until observed and reviewed. Domain rules cannot constrain URL paths: remove the
bootstrap profile when installation is finished. Do not send credentials during
this stage. Keep DNS/TLS verification enabled.

## Host activation sequence

1. Save work and update/restart the desktop app and browser plugin from trusted
   distribution. Observed terminal CLI is `0.162.1`; desktop-bundled CLI is
   `0.137.0-alpha.4`. The difference is a compatibility lead, not a proven diagnosis.
   Use a client supporting permission profiles (documented baseline 0.138.0+).
2. Have the host owner/administrator merge the templates into supported Codex
   configuration and allow the profile in managed policy if needed. Preserve
   unrelated settings. Do not layer these profiles over old `sandbox_mode` or
   `[sandbox_workspace_write]` values without reviewing the documented migration.
   No global settings were changed here. Do not activate by launching an unrestricted
   nested agent or bypassing the managed session's sandbox.
3. In a NEW permitted session select the temporary download profile with the
   documented `default_permissions` setting. Enable `features.network_proxy`.
   Confirm the effective policy, not merely TOML syntax. Install Chromium using:

```sh
cd /Users/anjanreddy/wrk/trise/trise-ui
export PATH="/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.browser-cache"
export npm_config_cache="$PWD/.npm-cache"
npx --no-install playwright install chromium
```

4. If MCP is required, select reviewed package versions, install exact versions
   locally, then inspect each installed package's actual `bin` entrypoint. Replace
   the inactive template placeholders. Do not use `@latest` to download code each
   time an inspection session starts. Keep external writes and evaluation prompted;
   restrict tool lists after verifying the actual tool catalog. Apply separate
   origin/process controls because command profiles do not sandbox MCP servers.
5. Switch to the local profile and remove bootstrap download access. Grant the
   built-in browser the exact discovered TRISE origins in its supported host
   permission interface. Google login requires separate approval for the actual
   observed Google origins; it is not automatically permitted by the local command
   profile. Use dedicated development identities and keep login artifacts private.
6. Restart the MCP/client connection and verify live tools before use. Supported
   configuration/restart flow is described in [OpenAI MCP documentation](https://developers.openai.com/codex/mcp).
   Global/project policy configuration cannot alter already-issued tool metadata.
7. Run gates below. Stop and record any rejected gate rather than changing security
   settings to make it pass.

## Acceptance gates

| Gate | Evidence required | Current state |
| --- | --- | --- |
| Browser metadata | Browser tool executes minimal code and completes bootstrap | BLOCKED: missing `sandboxPolicy` reproduced |
| Chromium install | Workspace cache contains expected arm64 executable | BLOCKED: CDN DNS failure in this session |
| Native browser launch | Sandboxed Chrome/Chromium creates a page | BLOCKED: Chrome `SIGABRT`; cause not proven |
| API connection | `GET /up` returns 200 from permitted session | BLOCKED: `EPERM` |
| MCP | Server initializes and expected tools are callable | NOT CONNECTED |
| First real UI | Operations desktop test completes with diagnostics | BLOCKED by launch |
| Authenticated workflow | Real local role, isolated records, request/UI/refresh evidence | UNTESTED |

Run `npm run test:e2e -- --project=api-public` and then
`npm run test:e2e -- --project=operations-desktop`. Once both can execute, begin
one real subscription defect workflow before expanding roles and viewports.
Never claim the full workflow from policy validation or unit tests alone.

## Missing sandboxPolicy

This field is host-owned request metadata, not a user-defined application policy
key. No supported repair for this exact error was established in official docs.
Do not inject a guessed metadata object, patch plugin checks, or create a fake
application `sandboxPolicy`. If updating/reconnecting fails, give support the
redacted error, client versions and minimal reproduction. Repository changes
cannot repair the tool transport.

## Rollback

Host owner reselects the previous permission profile, removes temporary download
rules and disables the added MCP definitions. Delete only dedicated test sessions
and caches when no longer needed; preserve existing user browser profiles and
reports. No database or production rollback is involved in these policy templates.
