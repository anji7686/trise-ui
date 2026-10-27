import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProviderAudit } from "./provider-audit";

describe("provider audit workspace", () => {
  it("offers provider-scoped timeline and immutable audit filters without a page-size control", () => {
    const markup = renderToStaticMarkup(
      <ProviderAudit providerId="provider-1" />,
    );
    expect(markup).toContain("Filter audit by action");
    expect(markup).toContain("Filter audit by resource kind");
    expect(markup).toContain("server-granted Audit Read permission");
    expect(markup).toContain("Advanced filter · specific record");
    expect(markup).toContain("Filter audit by source record ID");
    expect(markup).toContain("Audit from date and time");
    expect(markup).toContain("Audit through date and time");
    expect(markup).toContain("Filter history");
    expect(markup).toContain("Audit activity");
    expect(markup).not.toContain("Rows per page");
    expect(markup).not.toContain("Audit rows per page");
  });
});
