import { useEffect, useState, type FormEvent } from "react";
import { Button, FilterToolbar, PageHeader, SortedSelect } from "@trise/ui";
import { OperationsDialog } from "./operations-dialog";
import { ActionNotification, EmptyState, ProviderActionMenu } from "./operations-shared";
import { OperationsStatus as Status } from "./operations-status";
import {
  operationsData,
  type Collection,
  type PlatformLogo,
  type ProviderBusinessProfile,
  type QuotationTermsTemplateAttributes,
  type Resource,
} from "./data";
import {
  QuotationTermsEditor,
  QuotationBankAccountSummary,
  QuotationAgreementSignatureSection,
  QuotationCustomerApprovalSummary,
  QuotationExclusionsSummary,
  QuotationIncludedAmcSummary,
  QuotationLetterheadSummary,
  QuotationPaymentMethodsSummary,
  QuotationTaxVisibilitySummary,
  type QuotationLetterhead,
  quotationTermSelectionFromForm,
  quotationTermsForApi,
  quotationValueForTerms,
  amountInWordsFor,
} from "./quotations";
import { RichTextEditor, RichTextViewer } from "./rich-text-editor";
import { formatIndiaDateTime } from "./subscription-support";

type Template = Resource<QuotationTermsTemplateAttributes>;
type PreviewMode = "web" | "pdf";
type LetterheadContactKey = "phone" | "email" | "fax" | "website";

const letterheadContactFields: Array<{ key: LetterheadContactKey; label: string; inputType: string; placeholder: string; maxLength: number }> = [
  { key: "phone", label: "Phone", inputType: "tel", placeholder: "+91 80 4000 1234", maxLength: 40 },
  { key: "email", label: "Email", inputType: "email", placeholder: "sales@example.com", maxLength: 254 },
  { key: "fax", label: "Fax", inputType: "tel", placeholder: "+91 80 4000 1235", maxLength: 40 },
  { key: "website", label: "Website", inputType: "url", placeholder: "https://www.example.com", maxLength: 2048 },
];

function termCount(template: Template) {
  return Object.keys(template.attributes.terms || {}).filter(
    (key) => !["delivery_terms", "warranty_terms"].includes(key),
  ).length;
}

function templateScope(template: Template) {
  return template.attributes.scope === "PLATFORM_MASTER" ? "Platform master" : "This provider";
}

function readableTermLabel(key: string) {
  if (key === "payment_methods") return "Payment Mode & Details";
  return key
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function descriptionPreview(value?: string | null) {
  const plainText = String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plainText) return "Reusable commercial baseline";
  return plainText.length > 150 ? `${plainText.slice(0, 150).trimEnd()}…` : plainText;
}

const emptyLetterhead = (): QuotationLetterhead => ({
  enabled: false,
  format: "STANDARD",
  logo_position: "LEFT",
  logo: { enabled: false },
  business_name: "",
  address: { country: "India" },
  show_address: true,
  show_tax_details: true,
  gstin: "",
  pan_number: "",
  footer_text: "",
  footer_contacts: letterheadContactFields.reduce((contacts, field) => ({ ...contacts, [field.key]: { enabled: false, value: "" } }), {}),
});

function normalizedFooterContacts(value: unknown): QuotationLetterhead["footer_contacts"] {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return letterheadContactFields.reduce((contacts, field) => {
    const item = source[field.key] && typeof source[field.key] === "object" ? source[field.key] as Record<string, unknown> : {};
    contacts[field.key] = { enabled: item.enabled === true, value: String(item.value || "") };
    return contacts;
  }, {} as NonNullable<QuotationLetterhead["footer_contacts"]>);
}

function letterheadFromValue(value: unknown): QuotationLetterhead {
  const source = value && typeof value === "object" ? value as QuotationLetterhead : {} as QuotationLetterhead;
  return { ...emptyLetterhead(), ...source, footer_contacts: normalizedFooterContacts(source.footer_contacts) };
}

function letterheadFromProfile(profile: ProviderBusinessProfile["profile"], logo: PlatformLogo | null): QuotationLetterhead {
  const address = profile.address || {};
  const hasRequiredAddress = Boolean(profile.legal_name && address.city && address.state && address.pin_code);
  return {
    ...emptyLetterhead(),
    enabled: hasRequiredAddress,
    business_name: String(profile.legal_name || ""),
    address: {
      country: String(address.country || "India"),
      address_line: address.address_line || "",
      locality: address.locality || "",
      city: address.city || "",
      district: address.district || "",
      state: address.state || "",
      pin_code: address.pin_code || "",
      landmark: address.landmark || "",
    },
    gstin: String(profile.gstin || ""),
    pan_number: String(profile.pan_number || ""),
    logo: logo
      ? { enabled: true, document_id: logo.document_id, version_id: logo.version_id, filename: logo.filename, media_type: logo.media_type }
      : { enabled: false },
  };
}

function templateLetterhead(template: Template): QuotationLetterhead {
  return letterheadFromValue(template.attributes.terms.letterhead);
}

function letterheadAddress(letterhead: QuotationLetterhead) {
  const address = letterhead.address || {};
  return [
    address.address_line,
    address.locality,
    [address.city, address.district, address.state, address.pin_code].filter(Boolean).join(", "),
    address.country,
  ].filter(Boolean).map(String).join(" · ");
}

function PreviewLetterhead({ template, logo }: { template: Template; logo: PlatformLogo | null }) {
  const letterhead = templateLetterhead(template);
  const logoUrl = logo?.transfer?.url;
  const showLogo = letterhead.enabled !== false && letterhead.logo?.enabled !== false && Boolean(logoUrl);
  return (
    <header className={`quotation-template-letterhead quotation-template-letterhead--${String(letterhead.logo_position || "LEFT").toLowerCase()}`}>
      {showLogo && <img src={logoUrl} alt="Provider logo" />}
      <div>
        <strong>{letterhead.business_name || "Provider business name"}</strong>
        {letterhead.show_address !== false && <span>{letterheadAddress(letterhead) || "Business address not configured"}</span>}
        {letterhead.show_tax_details !== false && (letterhead.gstin || letterhead.pan_number) && <span>{[letterhead.gstin && `GSTIN ${letterhead.gstin}`, letterhead.pan_number && `PAN ${letterhead.pan_number}`].filter(Boolean).join(" · ")}</span>}
      </div>
      {!showLogo && letterhead.logo?.enabled !== false && <small className="quotation-template-letterhead-missing-logo">Logo preview unavailable</small>}
    </header>
  );
}

function PreviewLetterheadFooter({ template }: { template: Template }) {
  const letterhead = templateLetterhead(template);
  if (letterhead.enabled === false) return null;
  const contacts = letterheadContactFields
    .map((field) => ({ ...field, value: letterhead.footer_contacts?.[field.key]?.value || "", enabled: letterhead.footer_contacts?.[field.key]?.enabled === true }))
    .filter((field) => field.enabled && field.value.trim());
  if (!letterhead.footer_text && contacts.length === 0) return null;

  const hrefFor = (field: LetterheadContactKey, value: string) => {
    if (field === "email") return `mailto:${value}`;
    if (field === "phone" || field === "fax") return `tel:${value.replace(/[^+\d]/g, "")}`;
    return value;
  };

  return (
    <footer className="quotation-template-letterhead-footer">
      {contacts.length > 0 && (
        <div className="quotation-template-letterhead-footer-contacts" aria-label="Provider contact details">
          {contacts.map((field) => (
            <span key={field.key}>
              <strong>{field.label}</strong>
              <a href={hrefFor(field.key, field.value)}>{field.value}</a>
            </span>
          ))}
        </div>
      )}
      {letterhead.footer_text && <p>{letterhead.footer_text}</p>}
    </footer>
  );
}

function QuotationPaymentStagesSummary({ value }: { value: unknown }) {
  const configuration = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const stages = Array.isArray(configuration.stages) ? configuration.stages : [];
  if (!stages.length) return <>{quotationValueForTerms(value)}</>;

  return (
    <span className="quotation-payment-stages-summary">
      {Boolean(configuration.mode) && (
        <span className="quotation-payment-stages-mode">
          <span>Payment mode</span>
          <strong>{readableTermLabel(String(configuration.mode))}</strong>
        </span>
      )}
      {stages.map((item, index) => {
        const stage = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const sequence = Number(stage.sequence || index + 1);
        const code = String(stage.code || `STAGE_${sequence}`);
        const description = stage.description ? String(stage.description) : "Payment milestone";
        const percentage = stage.percentage !== undefined && stage.percentage !== null
          ? `${String(stage.percentage)}%`
          : "Percentage not supplied";
        const trigger = stage.trigger_kind ? readableTermLabel(String(stage.trigger_kind)) : "Manual";
        return (
          <span className="quotation-payment-stage" key={`${code}-${sequence}`}>
            <span className="quotation-payment-stage-label">
              <strong>{sequence}. {readableTermLabel(code)}</strong>
              <small>{percentage}</small>
            </span>
            <span className="quotation-payment-stage-details">
              <span>{description}</span>
              <small>{trigger}{stage.customer_acceptance_required ? " · Customer acceptance required" : ""}</small>
            </span>
          </span>
        );
      })}
    </span>
  );
}

function TemplateTermsAndConditions({ template }: { template: Template }) {
  const termsAndConditions = templateTermsAndConditions(template);
  if (!termsAndConditions) return null;

  return (
    <section className="quotation-template-terms-conditions">
      <div className="quotation-template-terms-conditions-heading">
        <h5>Terms and conditions</h5>
        <small>Applied to this quotation</small>
      </div>
      <RichTextViewer value={termsAndConditions} />
    </section>
  );
}

function templateTermsAndConditions(template: Template) {
  return String(
    template.attributes.description || template.attributes.terms?.terms_and_conditions || "",
  ).trim();
}

function termTextIncludesStructuredDetail(template: Template, key: string) {
  const text = templateTermsAndConditions(template)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (!text) return false;
  if (key === "validity_days") return /validity|valid until|valid for/.test(text);
  if (key === "payment_stages") return /payment schedule|payment milestone|advance payment|customer acceptance|final handover/.test(text);
  return false;
}

function TemplateTermsGrid({ template, maskAccounts = true, interactive = false, collapsible = false, excludeLetterhead = false, excludeTermsAndConditions = false, excludeCustomerApproval = false, excludeTaxVisibility = false }: { template: Template; maskAccounts?: boolean; interactive?: boolean; collapsible?: boolean; excludeLetterhead?: boolean; excludeTermsAndConditions?: boolean; excludeCustomerApproval?: boolean; excludeTaxVisibility?: boolean }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const entries = Object.entries(template.attributes.terms || {});
  const paymentMethods = Array.isArray(template.attributes.terms?.payment_methods)
    ? template.attributes.terms.payment_methods
    : [];
  const hasPaymentMethodBankAccount = paymentMethods.some((item) => item && typeof item === "object" && "bank_account" in item);
  const visibleEntries = entries
    .filter(([key]) => !["delivery_terms", "warranty_terms"].includes(key))
    .filter(([key]) => !(excludeLetterhead && key === "letterhead"))
    .filter(([key]) => !(excludeTermsAndConditions && key === "terms_and_conditions"))
    .filter(([key]) => !(excludeCustomerApproval && key === "online_customer_approval"))
    .filter(([key]) => !(excludeTaxVisibility && key === "show_tax_details"))
    .filter(([key]) => !(excludeTermsAndConditions && ["validity_days", "payment_stages"].includes(key) && termTextIncludesStructuredDetail(template, key)))
    .filter(([key]) => !(key === "bank_account" && hasPaymentMethodBankAccount));
  const activeOpenKey = visibleEntries.some(([key]) => key === openKey) ? openKey : null;
  return (
    <dl className={collapsible ? "provider-terms-preview-accordion" : undefined}>
      {visibleEntries.map(([key, value], index) => {
        const isOpen = collapsible ? (activeOpenKey === null ? index === 0 : activeOpenKey === key) : true;
        return <div className={`quotation-template-term-card quotation-template-term-card--${key}${collapsible ? " is-collapsible" : ""}${collapsible && isOpen ? " is-open" : ""}`} key={key}>
          <dt>{collapsible ? <button type="button" className="quotation-template-term-toggle" aria-expanded={isOpen} onClick={() => setOpenKey(isOpen ? null : key)}><span>{readableTermLabel(key)}</span><span aria-hidden="true">{isOpen ? "−" : "+"}</span></button> : readableTermLabel(key)}</dt>
          {isOpen && <dd>{key === "terms_and_conditions" ? <RichTextViewer value={value} /> : key === "payment_methods" ? <QuotationPaymentMethodsSummary value={value} maskAccounts={maskAccounts} interactive={interactive} /> : key === "payment_stages" ? <QuotationPaymentStagesSummary value={value} /> : key === "bank_account" ? <QuotationBankAccountSummary value={value} maskAccount={maskAccounts} interactive={interactive} /> : key === "letterhead" ? <QuotationLetterheadSummary value={value} /> : key === "exclusions" ? <QuotationExclusionsSummary value={value} /> : key === "included_free_amc" ? <QuotationIncludedAmcSummary value={value} /> : key === "online_customer_approval" ? <QuotationCustomerApprovalSummary value={value} /> : key === "show_tax_details" ? <QuotationTaxVisibilitySummary value={value} /> : quotationValueForTerms(value)}</dd>}
        </div>;
      })}
    </dl>
  );
}

function QuotationTemplatePreviewBody({ template, mode, logo, logoLoading, onModeChange }: { template: Template; mode: PreviewMode; logo: PlatformLogo | null; logoLoading: boolean; onModeChange: (mode: PreviewMode) => void }) {
  return <>
    <div className="quotation-template-preview-tabs" role="tablist" aria-label="Quotation template preview modes">
      <button type="button" role="tab" aria-selected={mode === "web"} className={mode === "web" ? "is-active" : ""} onClick={() => onModeChange("web")}>Web quotation</button>
      <button type="button" role="tab" aria-selected={mode === "pdf"} className={mode === "pdf" ? "is-active" : ""} onClick={() => onModeChange("pdf")}>PDF preview</button>
    </div>
    {logoLoading && <p className="notice">Loading the approved provider logo for preview…</p>}
    {mode === "web" ? <WebQuotationPreview template={template} logo={logo} /> : <PdfQuotationPreview template={template} logo={logo} />}
  </>;
}

type SampleQuotationLine = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: string;
  amount: number;
};

const sampleQuotationLines: SampleQuotationLine[] = [
  { description: "13-passenger gearless traction lift", quantity: 1, unit: "SET", unitPrice: 650000, taxRate: "18%", amount: 650000 },
  { description: "Installation, testing and commissioning", quantity: 1, unit: "JOB", unitPrice: 150000, taxRate: "18%", amount: 150000 },
  { description: "Preventive maintenance support", quantity: 4, unit: "VISITS", unitPrice: 0, taxRate: "18%", amount: 0 },
];

const sampleQuotationSubtotal = sampleQuotationLines.reduce((total, line) => total + line.amount, 0);
const sampleQuotationCgst = sampleQuotationSubtotal * 0.09;
const sampleQuotationSgst = sampleQuotationSubtotal * 0.09;
const sampleQuotationGrandTotal = sampleQuotationSubtotal + sampleQuotationCgst + sampleQuotationSgst;
const indianRupees = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

function previewDate(daysFromNow = 0) {
  const value = new Date();
  value.setDate(value.getDate() + daysFromNow);
  return value.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function PreviewQuotationContext({ template, showDocumentLabel = true }: { template: Template; showDocumentLabel?: boolean }) {
  const validityDays = Number(template.attributes.terms.validity_days || 30);
  return (
    <>
      <div className={`quotation-template-web-meta${showDocumentLabel ? "" : " quotation-template-web-meta--compact"}`}>
        {showDocumentLabel && <div><span>Quotation preview</span><strong>{template.attributes.name}</strong></div>}
        <div><span>Quotation no.</span><strong>QT-PREVIEW-001</strong></div>
        <div><span>Issue date</span><strong>{previewDate()}</strong></div>
        <div><span>Valid until</span><strong>{previewDate(validityDays)}</strong></div>
        <div><span>Revision</span><strong>R{template.attributes.revision}</strong></div>
      </div>
      <div className="quotation-template-sample-customer">
        <div><span>Customer</span><strong>Example customer</strong></div>
        <div><span>Billing address</span><strong>Customer billing address · Bengaluru, Karnataka</strong></div>
        <div><span>Shipping / site address</span><strong>Elevator project site · Bengaluru, Karnataka</strong></div>
        <div><span>Status</span><strong>Draft preview</strong></div>
      </div>
    </>
  );
}

function SampleQuotationLines({ showTaxDetails = true }: { showTaxDetails?: boolean }) {
  return (
    <div className="quotation-template-sample-lines">
      <div className="quotation-template-sample-lines-heading"><div><strong>Quotation items</strong><small>{showTaxDetails ? "Sample item lines with unit prices and tax columns." : "Sample item lines with tax calculation hidden from the customer copy."}</small></div><Status>Sample data</Status></div>
      <div className="quotation-template-sample-table-wrap"><table className="quotation-template-sample-table"><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Unit price</th>{showTaxDetails && <th>Tax</th>}<th>Amount</th></tr></thead><tbody>{sampleQuotationLines.map((line) => <tr key={line.description}><td>{line.description}</td><td>{line.quantity}</td><td>{line.unit}</td><td>{indianRupees(line.unitPrice)}</td>{showTaxDetails && <td>{line.taxRate}</td>}<td>{indianRupees(line.amount)}</td></tr>)}</tbody></table></div>
      {showTaxDetails ? (
        <div className="quotation-template-tax-summary">
          <div className="quotation-template-tax-context"><div><span>Tax treatment</span><strong>Taxable</strong><small>Illustrative published tax catalogue selection</small></div><div><span>Tax rule</span><strong>GST 18%</strong><small>CGST 9% + SGST 9% · India</small></div><div><span>Currency</span><strong>INR</strong><small>Indian Rupees</small></div></div>
          <dl className="quotation-template-totals"><div><dt>Subtotal</dt><dd>{indianRupees(sampleQuotationSubtotal)}</dd></div><div><dt>Discount</dt><dd>{indianRupees(0)}</dd></div><div><dt>Tax</dt><dd>{indianRupees(sampleQuotationCgst + sampleQuotationSgst)}</dd></div><div><dt>CGST</dt><dd>{indianRupees(sampleQuotationCgst)}</dd></div><div><dt>SGST</dt><dd>{indianRupees(sampleQuotationSgst)}</dd></div><div className="is-grand-total"><dt>Quoted total</dt><dd>{indianRupees(sampleQuotationGrandTotal)}</dd></div><small className="quotation-template-total-in-words">{amountInWordsFor(sampleQuotationGrandTotal)}</small></dl>
        </div>
      ) : (
        <div className="quotation-template-total-only"><div><span>Total payable</span><strong>{indianRupees(sampleQuotationGrandTotal)}</strong></div><small>Tax calculation remains applied to the total; the tax breakdown is excluded from this customer copy.</small></div>
      )}
    </div>
  );
}

function SampleQuotationMaterials() {
  const materials = [
    { description: "Gearless traction machine and controller", category: "Electrical", quantity: "1", unit: "SET", warranty: "As agreed", specifications: "Drive: Gearless MRL traction" },
    { description: "Lift car, frame and landing doors", category: "Mechanical", quantity: "1", unit: "SET", warranty: "24 months", specifications: "Capacity: 630 kg · Finish: Stainless steel" },
    { description: "Installation consumables and fixing hardware", category: "Consumable", quantity: "1", unit: "LOT", warranty: "As agreed", specifications: "Included in provider execution scope" },
  ];
  return (
    <section className="quotation-template-sample-lines" aria-label="Sample material scope">
      <div className="quotation-template-sample-table-wrap"><table className="quotation-template-sample-table"><thead><tr><th>Description</th><th>Category</th><th>Qty</th><th>Unit</th><th>Warranty</th></tr></thead><tbody>{materials.map((material) => <tr key={material.description}><td>{material.description}<small className="quotation-preview-cell-note">{material.specifications}</small></td><td>{material.category}</td><td>{material.quantity}</td><td>{material.unit}</td><td>{material.warranty}</td></tr>)}</tbody></table></div>
    </section>
  );
}

function WebQuotationPreview({ template, logo }: { template: Template; logo: PlatformLogo | null }) {
  const showTaxDetails = template.attributes.terms?.show_tax_details !== false;
  return (
    <section className="quotation-template-preview-mode quotation-template-web-preview" aria-label="Web quotation preview">
      <div className="quotation-template-preview-mode-heading"><div><span className="platform-eyebrow">Web quotation</span><h3>Customer-facing browser view</h3></div><small>Responsive preview using this template</small></div>
      <article className="quotation-template-web-sheet">
        <PreviewLetterhead template={template} logo={logo} />
        <PreviewQuotationContext template={template} />
        <SampleQuotationLines showTaxDetails={showTaxDetails} />
        <section className="quotation-template-selected-terms"><div className="quotation-template-preview-section-heading"><h4>Commercial Terms &amp; Payment Details</h4><small>Customer-ready details</small></div><div className="quotation-template-approval-mode"><span>Customer approval</span><QuotationCustomerApprovalSummary value={template.attributes.terms?.online_customer_approval !== false} /></div><TemplateTermsAndConditions template={template} /><TemplateTermsGrid template={template} maskAccounts={false} interactive excludeLetterhead excludeTermsAndConditions excludeCustomerApproval excludeTaxVisibility /></section>
        <PreviewLetterheadFooter template={template} />
      </article>
    </section>
  );
}

function PdfQuotationPreview({ template, logo }: { template: Template; logo: PlatformLogo | null }) {
  const onlineApprovalEnabled = template.attributes.terms?.online_customer_approval !== false;
  const showTaxDetails = template.attributes.terms?.show_tax_details !== false;
  const printQuotationPreview = () => {
    const previousTitle = document.title;
    document.title = `${template.attributes.name} - Quotation preview`;
    window.setTimeout(() => window.print(), 0);
    window.setTimeout(() => { document.title = previousTitle; }, 1000);
  };
  return (
    <section className="quotation-template-preview-mode quotation-template-pdf-preview" aria-label="PDF quotation preview">
      <div className="quotation-template-preview-mode-heading"><div><span className="platform-eyebrow">PDF preview</span><h3>Letterhead quotation layout</h3></div><div className="quotation-template-pdf-actions"><small>A4 layout · use the browser dialog to print or save as PDF</small><Button type="button" variant="secondary" aria-label="Print or save quotation preview as PDF" onClick={printQuotationPreview}>Print / save as PDF</Button></div></div>
      <div className="quotation-template-pdf-document" aria-label="A4 quotation pages">
        <article className="quotation-template-pdf-sheet quotation-template-pdf-page">
          <PreviewLetterhead template={template} logo={logo} />
          <div className="quotation-template-pdf-title"><span>Quotation preview</span><h2>{template.attributes.name}</h2><small>Customer quotation structure</small></div>
          <PreviewQuotationContext template={template} showDocumentLabel={false} />
          <SampleQuotationLines showTaxDetails={showTaxDetails} />
          <div className="quotation-template-pdf-page-number">Page 1 of 4</div>
        </article>
        <article className="quotation-template-pdf-sheet quotation-template-pdf-page">
          <div className="quotation-template-pdf-continuation"><span>Materials included in scope</span><strong>{template.attributes.name}</strong><small>Customer-visible planned material scope carried into the project</small></div>
          <SampleQuotationMaterials />
          <div className="quotation-template-pdf-page-number">Page 2 of 4</div>
        </article>
        <article className="quotation-template-pdf-sheet quotation-template-pdf-page quotation-template-pdf-page--terms">
          <div className="quotation-template-pdf-continuation"><span>Quotation terms</span><strong>{template.attributes.name}</strong><small>Commercial terms and payment details</small></div>
          <section className="quotation-template-pdf-terms"><div className="quotation-template-preview-section-heading"><h4>Commercial Terms &amp; Payment Details</h4><small>Included in the quotation</small></div><div className="quotation-template-approval-mode"><span>Customer approval</span><QuotationCustomerApprovalSummary value={template.attributes.terms?.online_customer_approval !== false} /></div><TemplateTermsAndConditions template={template} /><TemplateTermsGrid template={template} maskAccounts={false} excludeLetterhead excludeTermsAndConditions excludeCustomerApproval excludeTaxVisibility /></section>
          <PreviewLetterheadFooter template={template} />
          <div className="quotation-template-pdf-page-number">Page 3 of 4</div>
        </article>
        <article className="quotation-template-pdf-sheet quotation-template-pdf-page quotation-template-pdf-page--agreement">
          <PreviewLetterhead template={template} logo={logo} />
          <div className="quotation-template-pdf-continuation"><span>Agreement confirmation</span><strong>{template.attributes.name}</strong><small>Approval, acceptance and optional customer evidence</small></div>
          <div className={`quotation-template-agreement-status${onlineApprovalEnabled ? " is-online" : " is-offline"}`}><span className="quotation-template-agreement-status-icon" aria-hidden="true">✓</span><div><span>Customer approval mode</span><strong>{onlineApprovalEnabled ? "Draft preview — online approval enabled" : "Draft preview — offline agreement copy"}</strong><small>{onlineApprovalEnabled ? "After provider approval, an authorised customer contact can accept this exact revision online; no physical signature or company seal is required." : "Customer signature, company seal and date may be included when available; online acceptance is disabled for this template."}</small></div></div>
          <QuotationAgreementSignatureSection />
          <div className="quotation-template-agreement-record" aria-label="Agreement record controls">
            <div><span>Revision control</span><strong>One approved revision</strong><small>Any change creates a new revision for review.</small></div>
            <div><span>Evidence retained</span><strong>Approval record and supplied evidence</strong><small>Keep a signed or sealed copy only when the customer provides one.</small></div>
            <div><span>Customer copy</span><strong>Quotation, terms and payment details</strong><small>Delivered together as the final agreement package.</small></div>
          </div>
          <div className="quotation-template-pdf-page-number">Page 4 of 4</div>
        </article>
      </div>
      <p className="quotation-template-preview-note">This is a layout preview for the saved template. A final downloadable quotation PDF is generated from a quotation revision after actual customer, item, tax and pricing details are supplied.</p>
    </section>
  );
}

type TemplateEditorTarget = Template | "new";

function QuotationTermsTemplateForm({
  providerId,
  target,
  copySource = null,
  templates,
  busy,
  onSubmit,
  onCancel,
}: {
  providerId: string;
  target: TemplateEditorTarget;
  copySource?: Template | null;
  templates: Template[];
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const source = target === "new" ? copySource : target;
  const [description, setDescription] = useState(
    source ? String(source.attributes.description || "") : "",
  );
  const initialLetterhead = !source
    ? emptyLetterhead()
    : letterheadFromValue(source.attributes.terms.letterhead);
  const [letterhead, setLetterhead] = useState<QuotationLetterhead>(initialLetterhead);
  const [businessProfile, setBusinessProfile] = useState<ProviderBusinessProfile | null>(null);
  const [activeLogo, setActiveLogo] = useState<PlatformLogo | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileMessage, setProfileMessage] = useState("");
  const [letterheadTouched, setLetterheadTouched] = useState(Boolean(source));

  useEffect(() => {
    let active = true;
    setProfileLoading(true);
    setProfileMessage("");
    Promise.allSettled([
      operationsData.providerBusinessProfile(providerId),
      operationsData.providerLogo(providerId),
    ]).then(([profileResult, logoResult]) => {
      if (!active) return;
      const profile = profileResult.status === "fulfilled" ? profileResult.value.data : null;
      const logo = logoResult.status === "fulfilled" ? logoResult.value.data : null;
      setBusinessProfile(profile);
      setActiveLogo(logo);
      if (target === "new" && !letterheadTouched && profile) setLetterhead(letterheadFromProfile(profile.profile, logo));
      if (profileResult.status === "rejected" || logoResult.status === "rejected") setProfileMessage("Business profile or active logo could not be fully loaded. You can still save a disabled letterhead and manage the logo from Business Profile.");
    }).finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [providerId, target === "new" ? "new" : target.id]);

  const updateLetterhead = (patch: Partial<QuotationLetterhead>) => {
    setLetterheadTouched(true);
    setLetterhead((current) => ({ ...current, ...patch }));
  };
  const updateAddress = (key: string, value: string) => {
    setLetterheadTouched(true);
    setLetterhead((current) => ({ ...current, address: { ...(current.address || {}), [key]: value } }));
  };
  const updateFooterContact = (key: LetterheadContactKey, patch: { enabled?: boolean; value?: string }) => {
    setLetterheadTouched(true);
    setLetterhead((current) => ({
      ...current,
      footer_contacts: {
        ...normalizedFooterContacts(current.footer_contacts),
        [key]: {
          ...normalizedFooterContacts(current.footer_contacts)?.[key],
          ...patch,
        },
      },
    }));
  };
  const useCurrentProfile = () => {
    if (!businessProfile) return;
    setLetterhead(letterheadFromProfile(businessProfile.profile, activeLogo));
    setLetterheadTouched(true);
  };

  return (
    <form className="provider-terms-editor-form" onSubmit={onSubmit}>
      <div className="provider-terms-editor-intro">
        <p>
          {copySource
            ? `This provider copy starts with the platform master “${copySource.attributes.name}”. Edit and save it as a provider-owned template; the shared master stays unchanged.`
            : "Save a reusable provider baseline. A quotation copies the selected values into its own revision; later template edits do not rewrite existing quotations."}
        </p>
      </div>
      <label>
        Template name *
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={target === "new" ? (copySource ? `${copySource.attributes.name} — Provider copy` : "") : target.attributes.name}
          placeholder="e.g. Standard installation terms"
        />
      </label>
      <RichTextEditor
        label="Apply terms and conditions"
        value={description}
        onChange={setDescription}
        help="Add the reusable explanation for when these terms apply. Use headings, emphasis and lists; unsafe markup is removed by the server."
      />
      <input type="hidden" name="description" value={description} readOnly />
      <fieldset className="quotation-letterhead-editor">
        <legend>PDF letterhead</legend>
        <p className="quotation-letterhead-help">Bind the provider&apos;s approved logo and business address to this template. The selected logo version and address are copied into each quotation revision; changing the business profile later does not rewrite historical PDFs.</p>
        <label className={`quotation-terms-choice${letterhead.enabled ? " is-enabled" : ""}`}>
          <input type="checkbox" checked={letterhead.enabled} onChange={(event) => updateLetterhead({ enabled: event.target.checked })} />
          <span><strong>Include provider letterhead in quotation PDF</strong><small>Use this template&apos;s business identity at the top of the generated document.</small></span>
        </label>
        <div className="quotation-letterhead-toolbar">
          <Button type="button" variant="secondary" disabled={profileLoading || !businessProfile} onClick={useCurrentProfile}>Use current business profile</Button>
          <span className="quotation-letterhead-status">{profileLoading ? "Loading business profile…" : businessProfile ? "Business profile available" : "Business profile unavailable"}</span>
          <button type="button" className="provider-admin-link quotation-letterhead-manage" onClick={() => { window.location.hash = "business-profile"; }}>Manage logo and business profile →</button>
        </div>
        <div className="form-grid quotation-letterhead-grid">
          <label>Letterhead format<SortedSelect value={letterhead.format} onChange={(event) => updateLetterhead({ format: event.target.value as QuotationLetterhead["format"] })}><option value="STANDARD">Standard — logo and address</option><option value="COMPACT">Compact — reduced header</option><option value="CENTERED">Centered — formal letterhead</option></SortedSelect></label>
          <label>Logo position<SortedSelect value={letterhead.logo_position} onChange={(event) => updateLetterhead({ logo_position: event.target.value as QuotationLetterhead["logo_position"] })}><option value="LEFT">Left</option><option value="CENTER">Center</option><option value="RIGHT">Right</option></SortedSelect></label>
          <label className="quotation-letterhead-checkbox"><input type="checkbox" checked={letterhead.show_address !== false} onChange={(event) => updateLetterhead({ show_address: event.target.checked })} /> Show business address</label>
          <label className="quotation-letterhead-checkbox"><input type="checkbox" checked={letterhead.show_tax_details !== false} onChange={(event) => updateLetterhead({ show_tax_details: event.target.checked })} /> Show GSTIN / PAN</label>
        </div>
        <div className="quotation-letterhead-layout">
          <div className="quotation-letterhead-fields">
            <label>Business name<input value={letterhead.business_name || ""} maxLength={200} onChange={(event) => updateLetterhead({ business_name: event.target.value })} /></label>
            <label>Address line<input value={String(letterhead.address?.address_line || "")} maxLength={200} onChange={(event) => updateAddress("address_line", event.target.value)} /></label>
            <label>Locality<input value={String(letterhead.address?.locality || "")} maxLength={200} onChange={(event) => updateAddress("locality", event.target.value)} /></label>
            <label>State<input required={letterhead.enabled} value={String(letterhead.address?.state || "")} maxLength={200} onChange={(event) => updateAddress("state", event.target.value)} /></label>
            <label>District<input value={String(letterhead.address?.district || "")} maxLength={200} onChange={(event) => updateAddress("district", event.target.value)} /></label>
            <label>City<input required={letterhead.enabled} value={String(letterhead.address?.city || "")} maxLength={200} onChange={(event) => updateAddress("city", event.target.value)} /></label>
            <label>PIN code<input required={letterhead.enabled} inputMode="numeric" maxLength={6} value={String(letterhead.address?.pin_code || "")} onChange={(event) => updateAddress("pin_code", event.target.value)} /></label>
            <label>Country<input value={String(letterhead.address?.country || "India")} readOnly /></label>
            <label>GSTIN<input maxLength={15} value={letterhead.gstin || ""} onChange={(event) => updateLetterhead({ gstin: event.target.value.toUpperCase() })} /></label>
            <label>PAN<input maxLength={10} value={letterhead.pan_number || ""} onChange={(event) => updateLetterhead({ pan_number: event.target.value.toUpperCase() })} /></label>
            <label className="quotation-letterhead-footer">Footer note<input maxLength={500} placeholder="e.g. This quotation is issued subject to the attached terms." value={letterhead.footer_text || ""} onChange={(event) => updateLetterhead({ footer_text: event.target.value })} /></label>
            <fieldset className="quotation-letterhead-contact-fieldset">
              <legend>Footer contact information</legend>
              <p>Choose which contact details appear in the quotation footer. A checked field must have a value.</p>
              <div className="quotation-letterhead-contact-grid">
                {letterheadContactFields.map((field) => {
                  const contact = letterhead.footer_contacts?.[field.key] || { enabled: false, value: "" };
                  return (
                    <label className={`quotation-letterhead-contact${contact.enabled ? " is-enabled" : ""}`} key={field.key}>
                      <span className="quotation-letterhead-contact-toggle">
                        <input type="checkbox" checked={contact.enabled === true} onChange={(event) => updateFooterContact(field.key, { enabled: event.target.checked })} />
                        <strong>{field.label}</strong>
                        <small>Show in footer</small>
                      </span>
                      <input
                        type={field.inputType}
                        value={contact.value || ""}
                        placeholder={field.placeholder}
                        maxLength={field.maxLength}
                        required={contact.enabled === true}
                        disabled={contact.enabled !== true}
                        onChange={(event) => updateFooterContact(field.key, { value: event.target.value })}
                      />
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
          <div className="quotation-letterhead-preview" aria-label="PDF letterhead preview">
            <span className="platform-eyebrow">PDF header preview</span>
            <div className={`quotation-letterhead-preview-paper ${letterhead.logo_position === "CENTER" ? "is-centered" : ""}`}>
              {activeLogo?.transfer?.url && letterhead.logo?.enabled && <img src={activeLogo.transfer.url} alt="Active provider logo" />}
              <div><strong>{letterhead.business_name || "Business name"}</strong>{letterhead.show_address !== false && <small>{[letterhead.address?.address_line, letterhead.address?.city, letterhead.address?.state, letterhead.address?.pin_code].filter(Boolean).join(" · ") || "Business address"}</small>}{letterhead.show_tax_details !== false && (letterhead.gstin || letterhead.pan_number) && <small>{[letterhead.gstin && `GSTIN ${letterhead.gstin}`, letterhead.pan_number && `PAN ${letterhead.pan_number}`].filter(Boolean).join(" · ")}</small>}</div>
            </div>
            {letterheadContactFields.some((field) => letterhead.footer_contacts?.[field.key]?.enabled === true && letterhead.footer_contacts?.[field.key]?.value?.trim()) && (
              <div className="quotation-letterhead-preview-contact-footer">
                <span>Footer contact preview</span>
                <div>
                  {letterheadContactFields.map((field) => {
                    const contact = letterhead.footer_contacts?.[field.key];
                    return contact?.enabled === true && contact.value?.trim() ? <small key={field.key}><strong>{field.label}:</strong> {contact.value}</small> : null;
                  })}
                </div>
              </div>
            )}
            <small>{letterhead.logo?.enabled ? (letterhead.logo.filename || "Active provider logo attached") : "No provider logo attached"} · {letterhead.format}</small>
          </div>
        </div>
        {profileMessage && <p className="notice">{profileMessage}</p>}
        <input type="hidden" name="letterhead_json" value={JSON.stringify(letterhead)} readOnly />
      </fieldset>
      <QuotationTermsEditor
        key={target === "new" ? `new-${copySource?.id || "blank"}` : target.id}
        initialTerms={source?.attributes.terms}
        templates={templates}
        showTermsAndConditions={false}
      />
      <div className="provider-form-actions">
        <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" busy={busy}>
          {target === "new" ? "Create terms template" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

export function ProviderQuotationTermsTemplatesAdmin({
  providerId,
  canManage,
  canCreateQuotation = false,
  initialCreate = false,
  templateId,
}: {
  providerId: string;
  canManage: boolean;
  canCreateQuotation?: boolean;
  initialCreate?: boolean;
  templateId?: string;
}) {
  const [templates, setTemplates] = useState<Collection<QuotationTermsTemplateAttributes> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editorTarget, setEditorTarget] = useState<Template | "new" | null>(null);
  const [copySource, setCopySource] = useState<Template | null>(null);
  const [previewTarget, setPreviewTarget] = useState<Template | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("web");
  const [previewLogo, setPreviewLogo] = useState<PlatformLogo | null>(null);
  const [previewLogoLoading, setPreviewLogoLoading] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Template | null>(null);
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"ALL" | "PLATFORM_MASTER" | "PROVIDER">("ALL");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setTemplates(await operationsData.quotationTermsTemplates(providerId));
    } catch (cause) {
      setTemplates(null);
      setError((cause as Error).message || "Quotation terms templates could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [providerId]);

  useEffect(() => {
    if (!templateId) return;
    let active = true;
    setPreviewLogoLoading(true);
    void operationsData.providerLogo(providerId)
      .then((result) => { if (active) setPreviewLogo(result.data); })
      .catch(() => { if (active) setPreviewLogo(null); })
      .finally(() => { if (active) setPreviewLogoLoading(false); });
    return () => { active = false; };
  }, [providerId, templateId]);

  async function openPreview(template: Template) {
    setPreviewTarget(template);
    setPreviewMode("web");
    setPreviewLogoLoading(true);
    try {
      setPreviewLogo((await operationsData.providerLogo(providerId)).data);
    } catch {
      setPreviewLogo(null);
    } finally {
      setPreviewLogoLoading(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const terms = quotationTermsForApi(undefined, quotationTermSelectionFromForm(form));
      const letterheadValue = String(form.get("letterhead_json") || "");
      if (letterheadValue) {
        try { terms.letterhead = JSON.parse(letterheadValue); } catch { throw new Error("PDF letterhead configuration could not be read. Please review it and try again."); }
      }
      const description = String(form.get("description") || "").trim();
      const body: Record<string, unknown> = { name, description, terms };
      const result = editorTarget && editorTarget !== "new"
        ? await operationsData.updateQuotationTermsTemplate(
            providerId,
            editorTarget.id,
            { ...body, expected_revision: editorTarget.attributes.revision },
            crypto.randomUUID(),
          )
        : await operationsData.createQuotationTermsTemplate(providerId, body, crypto.randomUUID());
      setTemplates((current) => {
        if (!current) return { data: [result] };
        if (editorTarget === "new") return { ...current, data: [result, ...current.data] };
        return { ...current, data: current.data.map((item) => item.id === result.id ? result : item) };
      });
      setCopySource(null);
      if (initialCreate) window.location.hash = "configuration/quotation-terms-templates";
      else setEditorTarget(null);
      setMessage(editorTarget === "new" ? "Provider quotation terms template created." : "Quotation terms template updated.");
    } catch (cause) {
      setError((cause as Error).message || "Quotation template could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!archiveTarget) return;
    setBusy(true);
    setError("");
    try {
      await operationsData.deleteQuotationTermsTemplate(
        providerId,
        archiveTarget.id,
        { expected_revision: archiveTarget.attributes.revision },
        crypto.randomUUID(),
      );
      setTemplates((current) => current ? { ...current, data: current.data.filter((item) => item.id !== archiveTarget.id) } : current);
      setArchiveTarget(null);
      setMessage("Quotation template archived. Existing quotation snapshots and audit history remain unchanged.");
    } catch (cause) {
      setError((cause as Error).message || "Quotation template could not be archived.");
    } finally {
      setBusy(false);
    }
  }

  const rows = templates?.data || [];
  const viewTarget = templateId ? rows.find((template) => template.id === templateId) || null : null;
  if (templateId) {
    if (loading) return <section className="content provider-terms-detail-page"><p className="notice">Loading quotation terms template…</p></section>;
    if (!viewTarget) return <section className="content provider-terms-detail-page">
      <PageHeader
        eyebrow="Provider administration / Commercial"
        title={error ? "Quotation terms templates unavailable" : "Quotation terms template not found"}
        description={error ? "The authorized template library could not be loaded. Retry after the API or database is available." : "The template may no longer be available in the selected provider context."}
        action={<Button variant="secondary" onClick={() => { window.location.hash = "configuration/quotation-terms-templates"; }}>← Back to quotation terms</Button>}
      />
      {error ? <>
        <ActionNotification kind="error" title="Quotation terms templates could not be loaded" onClose={() => setError("")}>{error}</ActionNotification>
        <div className="provider-form-actions"><Button type="button" onClick={() => void load()}>Retry</Button></div>
      </> : <EmptyState title="Terms template unavailable" description="Choose another item from the quotation terms library." />}
    </section>;
    return (
      <section className="content provider-terms-detail-page">
        <PageHeader
          eyebrow="Provider administration / Commercial / Template details"
          title={viewTarget.attributes.name}
          description={viewTarget.attributes.scope === "PROVIDER" && canManage ? "Review the reusable quotation terms snapshot. Preview it for the customer-facing view or edit this provider-owned baseline." : "Review the reusable quotation terms snapshot. Platform master terms are read-only in provider administration."}
          action={<div className="provider-terms-detail-actions"><Button variant="secondary" onClick={() => { window.location.hash = "configuration/quotation-terms-templates"; }}>← Back to quotation terms</Button>{canCreateQuotation && <Button onClick={() => { window.location.hash = `quotations/new/${encodeURIComponent(viewTarget.id)}`; }}>Create quotation with these terms</Button>}<Button variant="secondary" onClick={() => void openPreview(viewTarget)}>Preview terms</Button>{viewTarget.attributes.scope === "PROVIDER" && canManage && <><Button onClick={() => { setCopySource(null); setEditorTarget(viewTarget); }}>Edit terms</Button><Button variant="danger" onClick={() => setArchiveTarget(viewTarget)}>Archive terms</Button></>}{viewTarget.attributes.scope === "PLATFORM_MASTER" && canManage && <Button onClick={() => { setCopySource(viewTarget); setEditorTarget("new"); }}>Customize as provider terms</Button>}</div>}
        />
        {error && <ActionNotification kind="error" title="Quotation terms action needs attention" onClose={() => setError("")}>{error}</ActionNotification>}
        {message && <ActionNotification title="Quotation terms update completed" onClose={() => setMessage("")}>{message}</ActionNotification>}
        <section className="provider-terms-detail-card detail-card">
          <div className="provider-terms-detail-meta"><Status>{templateScope(viewTarget)}</Status><span>Revision {viewTarget.attributes.revision}</span><span>{viewTarget.attributes.updated_at ? `Last updated ${formatIndiaDateTime(viewTarget.attributes.updated_at)}` : "Update time unavailable"}</span></div>
          {viewTarget.attributes.scope === "PLATFORM_MASTER" && <p className="provider-terms-readonly-note">Platform master template · read-only for service providers. Create or update a provider-owned template to customize terms for this provider.</p>}
          {previewLogoLoading && <p className="notice">Loading the approved provider logo for preview…</p>}
          <WebQuotationPreview template={viewTarget} logo={previewLogo} />
        </section>
        {editorTarget && <OperationsDialog title={editorTarget === "new" ? (copySource ? "Customize platform terms for this provider" : "Create quotation terms template") : "Edit quotation terms template"} busy={busy} className="provider-terms-editor-dialog" onClose={() => { setEditorTarget(null); setCopySource(null); }}><QuotationTermsTemplateForm providerId={providerId} target={editorTarget} copySource={copySource} templates={rows} busy={busy} onSubmit={(event) => void save(event)} onCancel={() => { setEditorTarget(null); setCopySource(null); }} /></OperationsDialog>}
        {previewTarget && <OperationsDialog title="Quotation terms preview" className="provider-terms-preview-dialog" onClose={() => setPreviewTarget(null)}><QuotationTemplatePreviewBody template={previewTarget} mode={previewMode} logo={previewLogo} logoLoading={previewLogoLoading} onModeChange={setPreviewMode} /></OperationsDialog>}
        {archiveTarget && <OperationsDialog title="Archive quotation terms template" busy={busy} onClose={() => setArchiveTarget(null)}><div className="provider-terms-confirm"><p><strong>{archiveTarget.attributes.name}</strong> will be removed from future quotation terms selection. The server archives it instead of physically deleting it, so existing quotation revisions and audit history remain unchanged.</p><div className="provider-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setArchiveTarget(null)}>Keep template</Button><Button type="button" variant="danger" busy={busy} onClick={() => void archive()}>Archive terms template</Button></div></div></OperationsDialog>}
      </section>
    );
  }
  if (initialCreate) {
    return (
      <section className="content provider-terms-editor-page">
        <PageHeader
          eyebrow="Provider administration / Commercial"
          title="New quotation terms template"
          description="Create a reusable provider baseline with readable rich-text terms and conditions. Future quotations copy the saved snapshot; later template edits do not change issued quotations."
          action={<Button variant="secondary" onClick={() => { window.location.hash = "configuration/quotation-terms-templates"; }}>← Back to quotation terms</Button>}
        />
        {!canManage ? <EmptyState title="Terms template management is restricted" description="Only the authorized Service Provider Admin or Provider Reviewer can create provider-owned quotation terms templates." /> : (
          <section className="provider-terms-editor-page-card detail-card">
            <div className="provider-terms-editor-intro">
              <strong>Build the provider baseline</strong>
              <p>Use the formatting toolbar for headings, emphasis and lists. The server removes unsafe markup and keeps a bounded readable snapshot.</p>
            </div>
            {error && <ActionNotification kind="error" title="Quotation terms action needs attention" onClose={() => setError("")}>{error}</ActionNotification>}
            <div className="provider-terms-editor-page-form">
              <QuotationTermsTemplateForm
                target="new"
                templates={rows}
                providerId={providerId}
                busy={busy}
                onSubmit={(event) => void save(event)}
                onCancel={() => { window.location.hash = "configuration/quotation-terms-templates"; }}
              />
            </div>
          </section>
        )}
      </section>
    );
  }
  return (
    <section className="content provider-terms-admin-page">
      <PageHeader
        eyebrow="Provider administration / Commercial"
        title="Quotation terms templates"
        description="Maintain reusable provider commercial terms for future quotation drafts. Issued, accepted and historical quotations keep their own immutable terms snapshot."
        action={canManage ? <Button onClick={() => { window.location.hash = "configuration/quotation-terms-templates/new"; }}>Create terms template</Button> : undefined}
      />
      <div className="provider-terms-admin-note">
        <strong>Provider scope</strong>
        <span>Service Provider Admin and Provider Reviewer can create, update and archive provider-owned templates. Platform master templates are available for selection but cannot be changed here. Stage payment plans apply only to New Installation, Modification and Takeover quotations; AMC/service quotations do not use project payment stages.</span>
      </div>
      {error && <ActionNotification kind="error" title="Quotation terms action needs attention" onClose={() => setError("")}>{error}</ActionNotification>}
      {message && <ActionNotification title="Quotation terms update completed" onClose={() => setMessage("")}>{message}</ActionNotification>}
      {loading ? <p className="notice">Loading authorized quotation terms templates…</p> : !rows.length ? <EmptyState title="No quotation terms templates" description="No active platform or provider terms template is available in this provider context." action={canManage ? <Button onClick={() => { window.location.hash = "configuration/quotation-terms-templates/new"; }}>Create a terms template</Button> : undefined} /> : (() => {
        const normalizedQuery = query.trim().toLowerCase();
        const filteredRows = rows.filter((template) => {
          const matchesQuery = !normalizedQuery || `${template.attributes.name} ${template.attributes.description || ""}`.toLowerCase().includes(normalizedQuery);
          const matchesScope = scopeFilter === "ALL" || template.attributes.scope === scopeFilter;
          return matchesQuery && matchesScope;
        });
        return <>
          <FilterToolbar resultLabel={`Showing ${filteredRows.length} of ${rows.length} quotation terms templates`}>
            <label>Search templates<input aria-label="Search quotation terms templates" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by template name or description" /></label>
            <label>Scope<SortedSelect aria-label="Filter quotation terms templates by scope" value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value as typeof scopeFilter)}><option value="ALL">All scopes</option><option value="PLATFORM_MASTER">Platform master</option><option value="PROVIDER">This provider</option></SortedSelect></label>
            {(query || scopeFilter !== "ALL") && <Button type="button" variant="quiet" onClick={() => { setQuery(""); setScopeFilter("ALL"); }}>Clear filters</Button>}
          </FilterToolbar>
          {filteredRows.length ? <div className="provider-terms-table-wrap"><table className="provider-terms-table"><caption className="sr-only">Quotation terms templates</caption><thead><tr><th>Template</th><th>Scope</th><th>Terms</th><th>Revision</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{filteredRows.map((template) => <tr key={template.id}><td><strong>{template.attributes.name}</strong><small className="provider-terms-template-summary">{descriptionPreview(template.attributes.description)}</small></td><td><Status>{templateScope(template)}</Status></td><td>{termCount(template)} selected</td><td>v{template.attributes.revision}</td><td>{template.attributes.updated_at ? formatIndiaDateTime(template.attributes.updated_at) : "Time unavailable"}</td><td><ProviderActionMenu label={`Actions for ${template.attributes.name}`} actions={[{ id: "view", label: "View terms template", onSelect: () => { window.location.hash = `configuration/quotation-terms-templates/${encodeURIComponent(template.id)}`; } }, ...(template.attributes.scope === "PROVIDER" && canManage ? [{ id: "edit", label: "Edit terms template", onSelect: () => { setCopySource(null); setEditorTarget(template); } }, { id: "archive", label: "Archive terms template", tone: "danger" as const, onSelect: () => setArchiveTarget(template) }] : template.attributes.scope === "PLATFORM_MASTER" && canManage ? [{ id: "copy", label: "Customize as provider terms", onSelect: () => { setCopySource(template); setEditorTarget("new"); } }] : [])]} /></td></tr>)}</tbody></table></div> : <EmptyState title="No matching quotation terms templates" description="Try a different name, description or scope filter." />}
        </>;
      })()}
      {editorTarget && <OperationsDialog title={editorTarget === "new" ? (copySource ? "Customize platform terms for this provider" : "Create quotation terms template") : "Edit quotation terms template"} busy={busy} className="provider-terms-editor-dialog" onClose={() => { setEditorTarget(null); setCopySource(null); }}><QuotationTermsTemplateForm providerId={providerId} target={editorTarget} copySource={copySource} templates={rows} busy={busy} onSubmit={(event) => void save(event)} onCancel={() => { setEditorTarget(null); setCopySource(null); }} /></OperationsDialog>}
      {previewTarget && <OperationsDialog title="Quotation terms preview" className="provider-terms-preview-dialog" onClose={() => setPreviewTarget(null)}><QuotationTemplatePreviewBody template={previewTarget} mode={previewMode} logo={previewLogo} logoLoading={previewLogoLoading} onModeChange={setPreviewMode} /></OperationsDialog>}
      {archiveTarget && <OperationsDialog title="Archive quotation terms template" busy={busy} onClose={() => setArchiveTarget(null)}><div className="provider-terms-confirm"><p><strong>{archiveTarget.attributes.name}</strong> will be removed from future quotation terms selection. The server archives it instead of physically deleting it, so existing quotation revisions and audit history remain unchanged.</p><div className="provider-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setArchiveTarget(null)}>Keep template</Button><Button type="button" variant="danger" busy={busy} onClick={() => void archive()}>Archive terms template</Button></div></div></OperationsDialog>}
    </section>
  );
}
