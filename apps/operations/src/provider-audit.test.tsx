import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProviderAudit } from "./provider-audit";

describe("provider audit workspace", () => {
  it("offers provider-scoped timeline and immutable audit filters with backend page sizes", () => {
    const markup = renderToStaticMarkup(
      <ProviderAudit providerId="provider-1" />,
    );
    expect(markup).toContain("Filter audit by source record ID");
    expect(markup).toContain("Filter audit by action");
    expect(markup).toContain("Filter audit by resource kind");
    expect(markup).toContain("require the server-granted Audit Read permission");
    expect(markup).toContain("Audit from date and time");
    expect(markup).toContain("Audit through date and time");
    expect(markup).toContain('value="10"');
    expect(markup).toContain('value="100"');
  });
});
