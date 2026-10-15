# Business Compliance workspace

The Platform Administration business directory now opens a dedicated Business Compliance workspace at `#platform/compliance?business_id=<id>`. The workspace uses seven focused tabs: Overview, GST Registrations, Registrations & Brands, Licence Authorizations, Documents, Requests & Reviews, and History & Audit.

## Implemented behavior

- Overview keeps legal identity compact and uses the existing Business API as the source of truth.
- Legal identity, GST association, and published Business requirement requests open in focused dialogs.
- Requirement labels use published names; internal requirement codes and synthetic browser fixtures are not shown as selectable business areas.
- Documents use the existing private upload/finalization and malware-scan gates. Preview authorization is requested server-side and is rendered inline only for images and PDF files.
- Requests show server-backed pages of ten records and retain the existing Platform permissions and immutable review workflow.
- Approved versions and audit events use the Business-scoped history API and are paged ten records at a time.
- India-only country and State/UT controls use the shared `india-geography.ts` master list.

## Deliberate boundaries

The page does not expose reviewer assignment or decision controls. Those remain in the Platform Approval Inbox. Agent and asset operational compliance remains Provider-owned. GST submission currently uses the existing tax registration endpoint; evidence is uploaded through the secure Documents workflow because that endpoint does not accept evidence references.

## Known gaps

- The Business documents endpoint still returns its existing bounded collection rather than a server-paged document collection.
- Licence authorizations are fetched through the existing platform collection and filtered by Business in the client because no Business-filtered endpoint is currently published.
- Browser acceptance requires the private development administrator email fixture. No credentials were added to source or test output.

