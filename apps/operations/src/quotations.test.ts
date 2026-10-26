import { describe, expect, it } from "vitest";
import {
  amountInWordsFor,
  defaultQuotationTermSelection,
  quotationPaymentScheduleForView,
  quotationMaterialsForApi,
  quotationTermSelectionFromTerms,
  quotationTermSelectionFromTemplate,
  quotationTermsForApi,
  quotationTermsTextIncludesStructuredDetail,
} from "./quotations";

describe("quotation amount presentation", () => {
  it("formats INR totals using Indian number groups", () => {
    expect(amountInWordsFor("1824280", "INR")).toBe("Rupees Eighteen Lakh Twenty Four Thousand Two Hundred Eighty Only");
  });

  it("includes paise and omits words for non-INR currencies", () => {
    expect(amountInWordsFor(123.45, "INR")).toBe("Rupees One Hundred Twenty Three and Forty Five Paise Only");
    expect(amountInWordsFor(123.45, "USD")).toBe("");
  });
});

describe("quotation template tax visibility", () => {
  it("defaults customer tax details to visible for backward-compatible templates", () => {
    expect(defaultQuotationTermSelection().showTaxDetails).toBe(true);
    expect(quotationTermSelectionFromTerms({ validity_days: 30 }).showTaxDetails).toBe(true);
  });

  it("preserves an explicit hidden tax setting when a template is applied", () => {
    const selection = quotationTermSelectionFromTerms({ show_tax_details: false });
    expect(selection.showTaxDetails).toBe(false);
    expect(quotationTermsForApi(undefined, selection).show_tax_details).toBe(false);
  });

  it("keeps tax calculation terms separate from customer presentation", () => {
    const selection = quotationTermSelectionFromTerms({ show_tax_details: false });
    const terms = quotationTermsForApi({ tax_rule_id: "published-rule" }, selection);
    expect(terms.tax_rule_id).toBe("published-rule");
    expect(terms.show_tax_details).toBe(false);
  });

  it("loads a template's default commercial configuration when selected", () => {
    const selection = quotationTermSelectionFromTemplate({
      id: "template-1",
      type: "provider-quotation-terms-templates",
      relationships: {},
      attributes: {
        name: "Premium Elevator Installation & AMC — Bengaluru",
        description: "<p>Premium commercial conditions</p>",
        status: "ACTIVE",
        scope: "PROVIDER",
        revision: 2,
        terms: {
          validity_days: 45,
          online_customer_approval: false,
          show_tax_details: true,
          payment_stages: {
            mode: "STAGED",
            freeze_after_issue: true,
            stages: [{
              code: "ADVANCE",
              description: "Customer advance",
              percentage: 40,
              sequence: 1,
              trigger_kind: "CUSTOMER_ACCEPTANCE",
              customer_acceptance_required: true,
            }],
          },
          included_free_amc: { months: 24, frequency: "QUARTERLY" },
          exclusions: ["Civil works"],
        },
      },
    });

    expect(selection.validityDays).toBe("45");
    expect(selection.onlineCustomerApproval).toBe(false);
    expect(selection.paymentStages[0]?.percentage).toBe("40");
    expect(selection.freeAmcMonths).toBe("24");
    expect(selection.exclusionsText).toBe("Civil works");
    expect(selection.termsAndConditions).toBe("<p>Premium commercial conditions</p>");
  });

  it("renders legacy payment milestones in the customer preview schedule", () => {
    expect(quotationPaymentScheduleForView({
      payment_milestones: [{ code: "ADVANCE", percentage: 50 }],
    })).toEqual({
      mode: "STAGED",
      stages: [{
        code: "ADVANCE",
        percentage: 50,
        sequence: 1,
        description: "ADVANCE",
        trigger_kind: "MANUAL",
      }],
    });
  });

  it("prefers the normalized payment stage configuration", () => {
    expect(quotationPaymentScheduleForView({
      payment_stages: { mode: "STAGED", stages: [{ code: "HANDOVER", percentage: 50 }] },
      payment_milestones: [{ code: "ADVANCE", percentage: 100 }],
    })?.stages[0]?.code).toBe("HANDOVER");
  });

  it("does not repeat payment stages already written in rich-text terms", () => {
    expect(quotationTermsTextIncludesStructuredDetail("<p>PAYMENT SCHEDULE</p><p>20% at order</p>", "payment_stages")).toBe(true);
    expect(quotationTermsTextIncludesStructuredDetail("<p>Warranty and delivery conditions</p>", "payment_stages")).toBe(false);
  });

  it("carries enabled material values into the quotation terms payload", () => {
    expect(quotationMaterialsForApi([{
      description: "Passenger lift package",
      category: "MECHANICAL",
      quantity: "2",
      unit_code: "SET",
      customer_visibility: "INCLUDED",
      unit_price: "225000",
      tax_rule_id: "tax-rule-1",
      tax_pricing_mode: "EXCLUSIVE",
      specifications: "Capacity: 630 kg\nSpeed: 1.0 m/s",
      notes: "Customer-visible planned scope",
      warranty_months: "24",
    }])).toEqual([{
      description: "Passenger lift package",
      category: "MECHANICAL",
      quantity: "2",
      unit_code: "SET",
      customer_visibility: "INCLUDED",
      unit_price: "225000",
      tax_rule_id: "tax-rule-1",
      tax_pricing_mode: "EXCLUSIVE",
      notes: "Customer-visible planned scope",
      warranty_months: 24,
      specifications: [
        { name: "Capacity", value: "630 kg" },
        { name: "Speed", value: "1.0 m/s" },
      ],
    }]);
  });
});
