import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@trise/ui";
import { operationsData, type PlatformQuotationBranding } from "./data";

const initialBranding: PlatformQuotationBranding["attributes"] = {
  brand_name: "TRISE INDIA",
  platform_scope_text: "TRISE India provides the digital platform used to prepare and review this quotation. The service provider named above is responsible for the quoted scope, pricing, delivery and contractual terms.",
  support_email: null,
  revision: 1,
};

export function PlatformQuotationBrandingPage({ canEdit }: { canEdit: boolean }) {
  const [branding, setBranding] = useState(initialBranding);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let current = true;
    operationsData.platformQuotationBranding().then(({ data }) => {
      if (current) setBranding(data.attributes);
    }).catch((cause: unknown) => {
      if (current) setError((cause as { message?: string })?.message || "Branding settings could not be loaded.");
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data } = await operationsData.updatePlatformQuotationBranding({
        expected_revision: branding.revision,
        brand_name: branding.brand_name,
        platform_scope_text: branding.platform_scope_text,
        support_email: branding.support_email || "",
      });
      setBranding(data.attributes);
      setNotice("Quotation branding saved. New quotation PDFs and previews will use these details.");
    } catch (cause) {
      setError((cause as { message?: string })?.message || "Branding settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="platform-reference-page platform-quotation-branding">
    <div className="reference-breadcrumb"><span>Platform administration</span><span aria-hidden="true">›</span><a href="#platform/configuration">Configuration</a><span aria-hidden="true">›</span><strong>Quotation branding</strong></div>
    <div className="reference-page-heading">
      <div><span className="reference-eyebrow">Platform administration</span><h1>Quotation branding</h1><p>Set the platform identity, its role in customer quotations and an optional contact for platform support.</p></div>
    </div>
    <div className="quotation-branding-guidance"><strong>Platform support and quotation questions have different owners.</strong><p>The service provider shown on each quotation owns the quoted scope, prices, delivery and contract terms. Add a support email here only for issues with the TRISE platform.</p></div>
    {error && <div className="reference-registry-error" role="alert"><strong>Could not complete the request</strong><span>{error}</span></div>}
    {notice && <p className="reference-form-note" role="status">{notice}</p>}
    <form className="quotation-branding-form reference-table-card" onSubmit={(event) => void save(event)}>
      <div className="quotation-branding-section"><div><h2>Platform identity</h2><p>Shown in the platform section at the end of quotation previews and PDFs.</p></div>
        <label>Brand name<input required maxLength={80} value={branding.brand_name} disabled={loading || saving || !canEdit} onChange={(event) => setBranding({ ...branding, brand_name: event.target.value })} /></label>
        <label>Platform role on quotations<textarea required rows={4} maxLength={800} value={branding.platform_scope_text} disabled={loading || saving || !canEdit} onChange={(event) => setBranding({ ...branding, platform_scope_text: event.target.value })} /><small>Explain what TRISE provides and make clear that the provider remains responsible for the offer and its terms.</small></label>
      </div>
      <div className="quotation-branding-section"><div><h2>Platform support contact</h2><p>This is separate from transactional email sender and reply-to settings. Leave it empty until a customer-facing support address is confirmed.</p></div>
        <label>Support email <span className="quotation-branding-optional">Optional</span><input type="email" maxLength={254} autoComplete="email" placeholder="support@example.in" value={branding.support_email || ""} disabled={loading || saving || !canEdit} onChange={(event) => setBranding({ ...branding, support_email: event.target.value || null })} /><small>When provided, it is labeled “Platform support” in the quotation footer.</small></label>
      </div>
      <div className="quotation-branding-preview"><span className="reference-eyebrow">Customer-facing preview</span><strong>{branding.brand_name || "TRISE INDIA"}</strong><p>{branding.platform_scope_text}</p><small>{branding.support_email ? `Platform support: ${branding.support_email}` : "For quotation scope and commercial terms, contact the service provider named above."}</small></div>
      <div className="quotation-branding-actions">{!canEdit && <small>Read only: your platform grant does not include configuration write access.</small>}<Button type="submit" disabled={loading || saving || !canEdit}>{saving ? "Saving…" : "Save branding"}</Button></div>
    </form>
  </section>;
}
