import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button, PageHeader, SortedSelect } from "@trise/ui";
import { useAuth } from "@trise/auth";
import QRCode from "qrcode";
import {
  DEFAULT_PAGE_SIZE,
  operationsData,
  type Collection,
  type GenericAttributes,
  type MaterialScopeTemplateAttributes,
  type QuotationTermsTemplateAttributes,
  type QuotationTaxRule,
  type QuotationTaxRuleAttributes,
  type ProviderWorkJourney,
  type RequirementRevisionAttributes,
  type Resource,
} from "./data";
import { accessData } from "./access-data";
import { OperationsStatus as Status } from "./operations-status";
import { OperationsDialog } from "./operations-dialog";
import { ActionNotification, displayLabel, ProviderActionMenu } from "./operations-shared";
import { SvgIcon } from "./icons";
import {
  JourneyTimelineDialog,
  WorkflowChainAction,
} from "./provider-journey-timeline";
import { JourneyAbandonAction } from "./journey-abandon-action";
import {
  WorkflowFollowUpAction,
  WorkflowFollowUpDialog,
} from "./workflow-follow-ups";
import { SearchableSelect, type LookupOption } from "./searchable-select";
import { RichTextEditor, RichTextViewer } from "./rich-text-editor";

type Props = {
  providerId: string;
  initialQuotationId?: string;
  initialCreate?: boolean;
  initialTemplateId?: string;
  initialPurpose?: string;
};

type QuotationMaterialLine = {
  description: string;
  category: string;
  quantity: string;
  unit_code: string;
  customer_visibility: "INCLUDED" | "EXCLUDED";
  unit_price: string;
  tax_rule_id: string;
  tax_pricing_mode: "EXCLUSIVE" | "INCLUSIVE";
  specifications: string;
  notes: string;
  warranty_months: string;
  /** Explicit quoted lift assignments; shared lines store every quoted code. */
  unit_codes: string[];
  /** Template/manual lines on multi-lift quotes require an explicit assignment. */
  unit_scope_confirmed?: boolean;
};

type QuotationDeliveryChannel = "EMAIL" | "SMS" | "WHATSAPP";

const amountWordsBelowTwenty = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const amountWordsTens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function amountWordsBelowThousand(value: number): string {
  if (value < 20) return amountWordsBelowTwenty[value];
  if (value < 100) return `${amountWordsTens[Math.floor(value / 10)]}${value % 10 ? ` ${amountWordsBelowTwenty[value % 10]}` : ""}`;
  return `${amountWordsBelowTwenty[Math.floor(value / 100)]} Hundred${value % 100 ? ` ${amountWordsBelowThousand(value % 100)}` : ""}`;
}

function indianIntegerAmountWords(value: number): string {
  if (value === 0) return "Zero";
  const scales = [[100000000000, "Kharab"], [1000000000, "Arab"], [10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"]] as const;
  let remaining = value;
  const parts: string[] = [];
  for (const [scale, label] of scales) {
    const count = Math.floor(remaining / scale);
    if (count > 0) {
      parts.push(`${amountWordsBelowThousand(count)} ${label}`);
      remaining %= scale;
    }
  }
  if (remaining > 0) parts.push(amountWordsBelowThousand(remaining));
  return parts.join(" ");
}

export function amountInWordsFor(value: unknown, currency = "INR"): string {
  if (currency.toUpperCase() !== "INR") return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  const paiseValue = Math.round(Math.abs(numeric) * 100);
  const rupees = Math.floor(paiseValue / 100);
  const paise = paiseValue % 100;
  const prefix = numeric < 0 ? "Minus " : "";
  return `${prefix}Rupees ${indianIntegerAmountWords(rupees)}${paise ? ` and ${amountWordsBelowThousand(paise)} Paise` : ""} Only`;
}

const phaseOneMaterialCategories = [
  ["MECHANICAL", "Mechanical"],
  ["DOOR_SYSTEM", "Door system"],
  ["ELECTRICAL", "Electrical"],
  ["SAFETY", "Safety"],
  ["CONSUMABLE", "Consumable"],
  ["OTHER", "Other"],
] as const;
const phaseOneMaterialMax = 100;
type MaterialLineOrder = "TEMPLATE" | "CATEGORY" | "DESCRIPTION";

const stagePaymentPurposes = ["INSTALLATION", "MODIFICATION", "TAKEOVER"] as const;
const supportsStagePayments = (purpose: string) => stagePaymentPurposes.includes(purpose as (typeof stagePaymentPurposes)[number]);

export type QuotationPaymentStageSelection = {
  code: string;
  description: string;
  percentage: string;
  sequence: number;
  trigger_kind: string;
  material_release_condition: string;
  customer_acceptance_required: boolean;
};

export type QuotationBankAccountSelection = {
  beneficiary_name: string;
  bank_name: string;
  account_number: string;
  account_type: "CURRENT" | "SAVINGS" | "OTHER";
  ifsc_code: string;
  branch_name: string;
  upi_id: string;
};

export type QuotationPaymentMethodCode = "BANK_TRANSFER" | "ONLINE" | "CASH" | "CHEQUE" | "UPI_QR";

export type QuotationPaymentMethodSelection = {
  method: QuotationPaymentMethodCode;
  label: string;
  bankAccount: QuotationBankAccountSelection;
  providerName: string;
  paymentLink: string;
  upiId: string;
  instructions: string;
};

export type QuotationLetterhead = {
  enabled: boolean;
  format: "STANDARD" | "COMPACT" | "CENTERED" | string;
  logo_position: "LEFT" | "CENTER" | "RIGHT" | string;
  logo?: {
    enabled: boolean;
    document_id?: string;
    version_id?: string;
    filename?: string;
    media_type?: string;
  };
  business_name?: string;
  address?: Record<string, string | null | undefined>;
  show_address?: boolean;
  show_tax_details?: boolean;
  gstin?: string;
  pan_number?: string;
  footer_text?: string;
  footer_contacts?: {
    phone?: { enabled?: boolean; value?: string };
    email?: { enabled?: boolean; value?: string };
    fax?: { enabled?: boolean; value?: string };
    website?: { enabled?: boolean; value?: string };
  };
};

const emptyQuotationBankAccount = (): QuotationBankAccountSelection => ({
  beneficiary_name: "",
  bank_name: "",
  account_number: "",
  account_type: "CURRENT",
  ifsc_code: "",
  branch_name: "",
  upi_id: "",
});

const emptyQuotationPaymentMethod = (method: QuotationPaymentMethodCode = "BANK_TRANSFER"): QuotationPaymentMethodSelection => ({
  method,
  label: "",
  bankAccount: emptyQuotationBankAccount(),
  providerName: "",
  paymentLink: "",
  upiId: "",
  instructions: "",
});

export type QuotationTermSelection = {
  validity: boolean;
  validityDays: string;
  onlineCustomerApproval: boolean;
  showTaxDetails: boolean;
  /** @deprecated Read only for legacy quotation revisions. New revisions use termsAndConditions. */
  delivery: boolean;
  /** @deprecated Read only for legacy quotation revisions. New revisions use termsAndConditions. */
  deliveryTerms: string;
  /** @deprecated Read only for legacy quotation revisions. New revisions use termsAndConditions. */
  warranty: boolean;
  /** @deprecated Read only for legacy quotation revisions. New revisions use termsAndConditions. */
  warrantyTerms: string;
  termsAndConditions: string;
  payment: boolean;
  paymentStages: QuotationPaymentStageSelection[];
  freezePaymentStages: boolean;
  freeAmc: boolean;
  freeAmcMonths: string;
  freeAmcFrequency: string;
  paymentMethodsEnabled: boolean;
  paymentMethods: QuotationPaymentMethodSelection[];
  exclusions: boolean;
  exclusionsText: string;
  letterhead?: QuotationLetterhead;
};

export const defaultQuotationTermSelection = (): QuotationTermSelection => ({
  validity: true,
  validityDays: "30",
  onlineCustomerApproval: true,
  showTaxDetails: true,
  delivery: false,
  deliveryTerms: "",
  warranty: false,
  warrantyTerms: "",
  termsAndConditions: "",
  payment: true,
  paymentStages: [
    { code: "ADVANCE", description: "Customer advance", percentage: "20", sequence: 1, trigger_kind: "CUSTOMER_ACCEPTANCE", material_release_condition: "", customer_acceptance_required: true },
    { code: "HANDOVER", description: "Final handover", percentage: "80", sequence: 2, trigger_kind: "HANDOVER", material_release_condition: "", customer_acceptance_required: true },
  ],
  freezePaymentStages: true,
  freeAmc: true,
  freeAmcMonths: "12",
  freeAmcFrequency: "QUARTERLY",
  paymentMethodsEnabled: false,
  paymentMethods: [],
  exclusions: false,
  exclusionsText: "",
    letterhead: undefined,
});

export const quotationTermSelectionFromTerms = (terms: unknown): QuotationTermSelection => {
  const defaults = defaultQuotationTermSelection();
  if (!terms || typeof terms !== "object") return defaults;
  const source = terms as Record<string, unknown>;
  const paymentStages = source.payment_stages && typeof source.payment_stages === "object"
    ? (source.payment_stages as Record<string, unknown>)
    : undefined;
  const stages = Array.isArray(paymentStages?.stages)
    ? paymentStages.stages
        .filter((stage): stage is Record<string, unknown> => Boolean(stage && typeof stage === "object"))
        .map((stage, index) => ({
          code: String(stage.code || `STAGE_${index + 1}`),
          description: String(stage.description || stage.code || `Stage ${index + 1}`),
          percentage: String(stage.percentage ?? "0"),
          sequence: Number(stage.sequence || index + 1),
          trigger_kind: String(stage.trigger_kind || "MANUAL"),
          material_release_condition: String(stage.material_release_condition || ""),
          customer_acceptance_required: Boolean(stage.customer_acceptance_required),
        }))
    : Array.isArray(source.payment_milestones)
      ? source.payment_milestones.map((stage, index) => {
          const item = stage && typeof stage === "object" ? (stage as Record<string, unknown>) : {};
          return {
            code: String(item.code || `STAGE_${index + 1}`),
            description: String(item.description || item.code || `Stage ${index + 1}`),
            percentage: String(item.percentage ?? "0"),
            sequence: index + 1,
            trigger_kind: "MANUAL",
            material_release_condition: "",
            customer_acceptance_required: false,
          };
        })
      : defaults.paymentStages;
  const freeAmc = source.included_free_amc;
  const legacyBankAccount = source.bank_account && typeof source.bank_account === "object"
    ? source.bank_account as Record<string, unknown>
    : undefined;
  const paymentMethods = Array.isArray(source.payment_methods)
    ? source.payment_methods
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item) => {
        const bank = item.bank_account && typeof item.bank_account === "object" ? item.bank_account as Record<string, unknown> : {};
        const method = ["BANK_TRANSFER", "ONLINE", "CASH", "CHEQUE", "UPI_QR"].includes(String(item.method))
          ? String(item.method) as QuotationPaymentMethodCode
          : "BANK_TRANSFER";
        return {
          ...emptyQuotationPaymentMethod(method),
          label: String(item.label || ""),
          bankAccount: {
            beneficiary_name: String(bank.beneficiary_name || ""),
            bank_name: String(bank.bank_name || ""),
            account_number: String(bank.account_number || ""),
            account_type: ["CURRENT", "SAVINGS", "OTHER"].includes(String(bank.account_type || ""))
              ? String(bank.account_type) as QuotationBankAccountSelection["account_type"]
              : "CURRENT",
            ifsc_code: String(bank.ifsc_code || ""),
            branch_name: String(bank.branch_name || ""),
            upi_id: String(bank.upi_id || ""),
          },
          providerName: String(item.provider_name || ""),
          paymentLink: String(item.payment_link || ""),
          upiId: String(item.upi_id || ""),
          instructions: String(item.instructions || ""),
        };
      })
    : legacyBankAccount
      ? [{
          ...emptyQuotationPaymentMethod("BANK_TRANSFER"),
          label: "Bank transfer",
          bankAccount: {
            beneficiary_name: String(legacyBankAccount.beneficiary_name || ""),
            bank_name: String(legacyBankAccount.bank_name || ""),
            account_number: String(legacyBankAccount.account_number || ""),
            account_type: ["CURRENT", "SAVINGS", "OTHER"].includes(String(legacyBankAccount.account_type || ""))
              ? String(legacyBankAccount.account_type) as QuotationBankAccountSelection["account_type"]
              : "CURRENT",
            ifsc_code: String(legacyBankAccount.ifsc_code || ""),
            branch_name: String(legacyBankAccount.branch_name || ""),
            upi_id: String(legacyBankAccount.upi_id || ""),
          },
        }]
      : [];
  const exclusions = Array.isArray(source.exclusions)
    ? source.exclusions
    : typeof source.exclusions === "string"
      ? [source.exclusions]
      : [];
  const legacyTerms = [source.delivery_terms, source.warranty_terms]
    .filter((value) => typeof value === "string" && value.trim())
    .join("<br>");
  return {
    ...defaults,
    validity: source.validity_days !== undefined,
    validityDays: String(source.validity_days ?? defaults.validityDays),
    onlineCustomerApproval: source.online_customer_approval === undefined
      ? defaults.onlineCustomerApproval
      : Boolean(source.online_customer_approval),
    showTaxDetails: source.show_tax_details === undefined
      ? defaults.showTaxDetails
      : Boolean(source.show_tax_details),
    delivery: false,
    deliveryTerms: String(source.delivery_terms || defaults.deliveryTerms),
    warranty: false,
    warrantyTerms: String(source.warranty_terms || defaults.warrantyTerms),
    termsAndConditions: String(source.terms_and_conditions || legacyTerms || ""),
    payment: paymentStages?.mode !== "NOT_APPLICABLE" && stages.length > 0,
    paymentStages: stages,
    freezePaymentStages: paymentStages?.freeze_after_issue === undefined ? defaults.freezePaymentStages : Boolean(paymentStages.freeze_after_issue),
    freeAmc: Boolean(freeAmc),
    freeAmcMonths:
      freeAmc && typeof freeAmc === "object"
        ? String((freeAmc as Record<string, unknown>).months ?? defaults.freeAmcMonths)
        : defaults.freeAmcMonths,
    freeAmcFrequency:
      freeAmc && typeof freeAmc === "object"
        ? String((freeAmc as Record<string, unknown>).frequency ?? defaults.freeAmcFrequency)
        : defaults.freeAmcFrequency,
    paymentMethodsEnabled: paymentMethods.length > 0,
    paymentMethods,
    exclusions: exclusions.length > 0,
    exclusionsText: exclusions.map((item) => String(item)).join("\n"),
    letterhead: source.letterhead && typeof source.letterhead === "object"
      ? source.letterhead as QuotationLetterhead
      : undefined,
  };
};

/**
 * A terms template is a reusable commercial snapshot. Keep the mapping in one
 * place so the editor and its tests use the same precedence rules as the
 * quotation preview: the template description is the customer-facing rich
 * text, with terms_and_conditions as the API fallback.
 */
export const quotationTermSelectionFromTemplate = (
  template: Resource<QuotationTermsTemplateAttributes>,
): QuotationTermSelection => ({
  ...quotationTermSelectionFromTerms(template.attributes.terms),
  termsAndConditions: String(
    template.attributes.description ||
      (template.attributes.terms as Record<string, unknown>).terms_and_conditions ||
      "",
  ),
});

export const quotationTermSelectionFromForm = (form: FormData) => {
  const raw = form.get("commercial_terms_json");
  if (!raw) return defaultQuotationTermSelection();
  try {
    return {
      ...defaultQuotationTermSelection(),
      ...(JSON.parse(String(raw)) as Partial<QuotationTermSelection>),
    };
  } catch {
    throw new Error("Commercial terms could not be read. Please review the selected terms.");
  }
};

export const quotationTermsForApi = (
  existing: Record<string, unknown> | undefined,
  selection: QuotationTermSelection,
  paymentStagesEnabled = true,
) => {
  const terms = { ...(existing || {}) };
  if (selection.validity) terms.validity_days = Math.max(1, Number(selection.validityDays) || 30);
  else delete terms.validity_days;
  terms.online_customer_approval = selection.onlineCustomerApproval;
  terms.show_tax_details = selection.showTaxDetails;
  if (selection.termsAndConditions.trim()) terms.terms_and_conditions = selection.termsAndConditions.trim();
  else delete terms.terms_and_conditions;
  // Delivery and warranty were previously separate fields. Keep historical
  // values readable, but do not create duplicate fields in new revisions.
  delete terms.delivery_terms;
  delete terms.warranty_terms;
  if (selection.payment && paymentStagesEnabled) {
    terms.payment_stages = {
      mode: "STAGED",
      freeze_after_issue: selection.freezePaymentStages,
      stages: selection.paymentStages.map((stage, index) => ({
        code: stage.code.trim().toUpperCase() || `STAGE_${index + 1}`,
        description: stage.description.trim() || `Stage ${index + 1}`,
        percentage: Math.min(100, Math.max(0, Number(stage.percentage) || 0)),
        sequence: index + 1,
        trigger_kind: stage.trigger_kind,
        material_release_condition: stage.material_release_condition.trim() || undefined,
        customer_acceptance_required: stage.customer_acceptance_required,
      })),
    };
    delete terms.payment_milestones;
  } else {
    if (paymentStagesEnabled) terms.payment_stages = { mode: "NOT_APPLICABLE", freeze_after_issue: false, stages: [] };
    else delete terms.payment_stages;
    delete terms.payment_milestones;
  }
  if (selection.freeAmc) {
    terms.included_free_amc = {
      months: Math.max(0, Number(selection.freeAmcMonths) || 0),
      frequency: selection.freeAmcFrequency,
    };
  } else delete terms.included_free_amc;
  if (selection.paymentMethodsEnabled && selection.paymentMethods.length > 0) {
    terms.payment_methods = selection.paymentMethods.map((method) => {
      const item: Record<string, unknown> = {
        method: method.method,
        label: method.label.trim(),
        instructions: method.instructions.trim() || undefined,
      };
      if (method.method === "BANK_TRANSFER") item.bank_account = { ...method.bankAccount };
      if (method.method === "ONLINE") {
        item.provider_name = method.providerName.trim();
        item.payment_link = method.paymentLink.trim() || undefined;
      }
      if (method.method === "UPI_QR") item.upi_id = method.upiId.trim();
      return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined));
    });
  } else delete terms.payment_methods;
  delete terms.bank_account;
  if (selection.exclusions && selection.exclusionsText.trim()) {
    terms.exclusions = selection.exclusionsText.split("\n").map((item) => item.trim()).filter(Boolean);
  } else delete terms.exclusions;
  if (selection.letterhead) terms.letterhead = selection.letterhead;
  return terms;
};

const materialCategoryLabel = (value: string) =>
  phaseOneMaterialCategories.find(([code]) => code === value)?.[1] || value;

const emptyQuotationMaterial = (): QuotationMaterialLine => ({
  description: "",
  category: "OTHER",
  quantity: "1",
  unit_code: "PCS",
  customer_visibility: "INCLUDED",
  unit_price: "",
  tax_rule_id: "",
  tax_pricing_mode: "EXCLUSIVE",
  specifications: "",
  notes: "",
  warranty_months: "",
  unit_codes: [],
});

const specificationPairsFromText = (value: string, strict = false) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator <= 0) {
        if (strict) {
          throw new Error(
            "Enter each specification as Name: Value on its own line, with a value after the colon.",
          );
        }
        return { name: line, value: "" };
      }
      const name = line.slice(0, separator).trim();
      const specificationValue = line.slice(separator + 1).trim();
      if (strict && (!name || !specificationValue)) {
        throw new Error(
          "Enter each specification as Name: Value on its own line, with a value after the colon.",
        );
      }
      return {
        name,
        value: specificationValue,
      };
    });

const specificationIssueFromText = (value: string) => {
  const issue = value.split("\n").reduce<{
    lineNumber: number;
    message: string;
  } | null>((current, line, index) => {
    if (current || !line.trim()) return current;
    const separator = line.indexOf(":");
    if (separator <= 0) {
      return {
        lineNumber: index + 1,
        message: "Use Name: Value on each specification line.",
      };
    }
    if (!line.slice(0, separator).trim()) {
      return {
        lineNumber: index + 1,
        message: "Add a specification name before the colon.",
      };
    }
    if (!line.slice(separator + 1).trim()) {
      return {
        lineNumber: index + 1,
        message: "Add a value after the colon.",
      };
    }
    return null;
  }, null);
  return issue
    ? `Specification line ${issue.lineNumber}: ${issue.message}`
    : "";
};

const specificationTextFromPairs = (value: unknown) => {
  if (!Array.isArray(value)) return "";
  const lines = value
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const name = String(row.name || "").trim();
      const specificationValue = String(row.value || "").trim();
      return name || specificationValue ? [`${name}: ${specificationValue}`] : [];
    });
  return Array.from(new Set(lines))
    .join("\n");
};

const quotationSpecificationOrder = [
  "equipment type", "application", "industry", "technology", "drive type", "control system",
  "capacity", "stops", "speed", "door configuration", "door type", "finish", "machine room",
  "shaft width", "shaft depth", "pit depth", "headroom", "accessibility", "safety", "emergency",
  "standard", "authority reference", "notes",
];

function orderedQuotationSpecifications(text: string) {
  return specificationPairsFromText(text)
    .map((pair, index) => ({ ...pair, index }))
    .sort((left, right) => {
      const position = (name: string) => quotationSpecificationOrder.findIndex((item) => name.toLowerCase().includes(item));
      const leftPosition = position(left.name);
      const rightPosition = position(right.name);
      return (leftPosition < 0 ? quotationSpecificationOrder.length : leftPosition) -
        (rightPosition < 0 ? quotationSpecificationOrder.length : rightPosition) || left.index - right.index;
    });
}

const quotationMaterialsFromTerms = (terms: unknown): QuotationMaterialLine[] => {
  if (!terms || typeof terms !== "object") return [];
  const materials = (terms as Record<string, unknown>).materials;
  if (!Array.isArray(materials)) return [];
  return materials.flatMap((material) => {
    if (!material || typeof material !== "object") return [];
    const row = material as Record<string, unknown>;
    return [
      {
        description: String(row.description || row.code || ""),
        category: String(row.category || "OTHER").toUpperCase(),
        quantity: String(row.quantity || "1"),
        unit_code: String(row.unit_code || "PCS").toUpperCase(),
        customer_visibility:
          String(row.customer_visibility || "INCLUDED").toUpperCase() ===
          "EXCLUDED"
            ? "EXCLUDED"
            : "INCLUDED",
        unit_price: String(row.unit_price ?? ""),
        tax_rule_id: String(row.tax_rule_id || ""),
        tax_pricing_mode:
          String(row.tax_pricing_mode || "EXCLUSIVE").toUpperCase() ===
          "INCLUSIVE"
            ? "INCLUSIVE"
            : "EXCLUSIVE",
        specifications: specificationTextFromPairs(row.specifications),
        notes: String(row.notes || ""),
        warranty_months: String(row.warranty_months ?? ""),
        unit_codes: Array.isArray(row.unit_codes) ? row.unit_codes.map(String) : [],
        // The editor serializes this confirmation into its hidden form field.
        // Keep it through form parsing so client validation does not reject a
        // lift assignment the user already confirmed.
        unit_scope_confirmed: row.unit_scope_confirmed === true,
      } satisfies QuotationMaterialLine,
    ];
  });
};

export const quotationPaymentScheduleForView = (
  terms: unknown,
): { mode: string; stages: Array<Record<string, unknown>> } | null => {
  if (!terms || typeof terms !== "object") return null;
  const source = terms as Record<string, unknown>;
  const configured = source.payment_stages;
  if (configured && typeof configured === "object") {
    const schedule = configured as Record<string, unknown>;
    if (Array.isArray(schedule.stages) && schedule.stages.length) {
      return {
        mode: String(schedule.mode || "STAGED"),
        stages: schedule.stages.map((stage) =>
          stage && typeof stage === "object" ? stage as Record<string, unknown> : {},
        ),
      };
    }
  }
  if (Array.isArray(source.payment_milestones) && source.payment_milestones.length) {
    return {
      mode: "STAGED",
      stages: source.payment_milestones.map((milestone, index) => {
        const stage = milestone && typeof milestone === "object" ? milestone as Record<string, unknown> : {};
        return {
          code: stage.code || `STAGE_${index + 1}`,
          percentage: stage.percentage,
          sequence: index + 1,
          description: stage.description || stage.code || `Payment milestone ${index + 1}`,
          trigger_kind: stage.trigger_kind || "MANUAL",
        };
      }),
    };
  }
  return null;
};

const quotationMaterialsFromForm = (
  form: FormData,
): QuotationMaterialLine[] => {
  const raw = form.get("materials_json");
  if (!raw) return [];
  try {
    return quotationMaterialsFromTerms({ materials: JSON.parse(String(raw)) });
  } catch {
    throw new Error("Material scope could not be read. Please try again.");
  }
};

export const quotationMaterialsForApi = (materials: QuotationMaterialLine[]) =>
  materials.map((material) => {
    const { specifications, tax_rule_id, tax_pricing_mode, warranty_months } = material;
    const apiMaterial = { ...material };
    delete apiMaterial.unit_scope_confirmed;
    return {
      ...apiMaterial,
      ...(tax_rule_id ? { tax_rule_id, tax_pricing_mode } : {}),
      ...(warranty_months.trim() ? { warranty_months: Number(warranty_months) } : {}),
      ...(specifications.trim()
        ? { specifications: specificationPairsFromText(specifications, true) }
        : {}),
    };
  });

function validateQuotationMaterialLiftAssignments(
  materials: QuotationMaterialLine[],
  quotedUnitCodes: string[],
) {
  if (quotedUnitCodes.length < 2) return;
  const unassigned = materials.some(
    (material) => !material.unit_scope_confirmed || material.unit_codes.length === 0,
  );
  if (unassigned) {
    throw new Error(
      "Some material lines still need lift assignments. Review the highlighted lines and choose one or more lifts, or apply all quoted lifts to every line if the full scope is shared.",
    );
  }
}

const taxTreatmentLabel = (value: string) =>
  value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

const quotationCommercialLinesFromForm = (form: FormData) => {
  const raw = form.get("commercial_lines_json");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (line): line is Record<string, unknown> =>
        Boolean(line) && typeof line === "object",
    );
  } catch {
    throw new Error("Material pricing could not be read. Please try again.");
  }
};

const quotationCommercialLinesAndAmount = (form: FormData) => {
  const pricedLines = quotationCommercialLinesFromForm(form);
  const amountInput = Number(form.get("amount") || 0);
  if (pricedLines.length > 0) {
    const invalidLine = pricedLines.find((line) => {
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unit_price);
      return !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0;
    });
    if (invalidLine) {
      throw new Error("Enter a valid non-negative price for every priced material line.");
    }
    return {
      lines: pricedLines,
      amount: pricedLines.reduce((total, line) => total + Number(line.amount || 0), 0),
    };
  }
  if (!Number.isFinite(amountInput) || amountInput < 0) {
    throw new Error("Enter a valid manual total or apply a priced material template.");
  }
  return {
    lines: [
      {
        description: form.get("description"),
        quantity: 1,
        unit_price: amountInput,
        amount: amountInput,
      },
    ],
    amount: amountInput,
  };
};

function MaterialScopeEditor({
  initialMaterials,
  unitCodes = [],
  templates = [],
  taxRules = [],
  onCreateTemplate,
  name = "materials_json",
}: {
  initialMaterials?: QuotationMaterialLine[];
  unitCodes?: string[];
  templates?: Resource<MaterialScopeTemplateAttributes>[];
  taxRules?: QuotationTaxRule[];
  onCreateTemplate?: (
    name: string,
    lines: QuotationMaterialLine[],
  ) => Promise<Resource<MaterialScopeTemplateAttributes> | void>;
  name?: string;
}) {
  const [materials, setMaterials] = useState<QuotationMaterialLine[]>(
    () => initialMaterials?.map((material) => {
      const assignedUnits = material.unit_codes.filter((code) => unitCodes.includes(code));
      const hadExplicitAssignment = material.unit_codes.length > 0;
      return {
        ...material,
        // Preserve legacy unscoped lines as shared. If an old explicit unit
        // no longer exists in the latest survey, require a fresh assignment.
        unit_codes: hadExplicitAssignment ? assignedUnits : [...unitCodes],
        unit_scope_confirmed: hadExplicitAssignment ? assignedUnits.length > 0 : true,
      };
    }) || [],
  );
  const [templateResources, setTemplateResources] = useState(templates);
  const [templateScope, setTemplateScope] = useState<"PROVIDER" | "PLATFORM_MASTER">("PROVIDER");
  const [templateId, setTemplateId] = useState("");
  const [appliedTemplateId, setAppliedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateMessage, setTemplateMessage] = useState("");
  const [lineOrder, setLineOrder] = useState<MaterialLineOrder>("TEMPLATE");
  const [openMaterialIndex, setOpenMaterialIndex] = useState<number | null>(
    initialMaterials?.length ? 0 : null,
  );
  const specificationRefs = useRef<Record<number, HTMLTextAreaElement | null>>(
    {},
  );

  useEffect(() => {
    setTemplateResources(templates);
  }, [templates]);

  useEffect(() => {
    materials.forEach((material, index) => {
      specificationRefs.current[index]?.setCustomValidity(
        specificationIssueFromText(material.specifications),
      );
    });
  }, [materials]);

  const updateMaterial = (
    index: number,
    field: keyof QuotationMaterialLine,
    value: string | string[] | boolean,
  ) => {
    setMaterials((current) =>
      current.map((material, rowIndex) =>
        rowIndex === index
          ? {
              ...material,
              [field]:
                  field === "unit_codes"
                    ? Array.isArray(value) ? value : []
                    : field === "unit_scope_confirmed"
                      ? value === true
                    : field === "customer_visibility"
                  ? value === "EXCLUDED"
                    ? "EXCLUDED"
                    : "INCLUDED"
                  : value,
            }
          : material,
      ),
    );
  };

  const providerTemplates = templateResources.filter((template) => template.attributes.scope === "PROVIDER" && template.attributes.status === "ACTIVE");
  const platformTemplates = templateResources.filter((template) => template.attributes.scope === "PLATFORM_MASTER" && template.attributes.status === "ACTIVE");
  const selectableTemplates = templateScope === "PROVIDER" ? providerTemplates : platformTemplates;
  const selectedTemplate = selectableTemplates.find((template) => template.id === templateId);

  const applyTemplate = (selectedTemplateId = templateId) => {
    const template = selectableTemplates.find((item) => item.id === selectedTemplateId);
    if (!template) return;
    setTemplateId(template.id);
    setAppliedTemplateId(template.id);
    const templateMaterials: QuotationMaterialLine[] = template.attributes.lines.map((line) => ({
        description: line.description,
        category: line.category,
        quantity: String(line.quantity),
        unit_code: line.unit_code,
        customer_visibility: line.customer_visibility,
        unit_price: String(line.default_unit_price),
        tax_rule_id: "",
        tax_pricing_mode: "EXCLUSIVE",
        specifications: specificationTextFromPairs(line.specifications),
        notes: String(line.notes || ""),
        warranty_months: String(line.warranty_months ?? ""),
        unit_codes: unitCodes.length === 1 ? [...unitCodes] : [],
        unit_scope_confirmed: unitCodes.length === 1,
      }));
    const materialKey = (material: QuotationMaterialLine) => JSON.stringify({
      description: material.description.trim().toLocaleLowerCase(),
      category: material.category,
      quantity: material.quantity,
      unit_code: material.unit_code,
      customer_visibility: material.customer_visibility,
      unit_price: material.unit_price,
      specifications: specificationPairsFromText(material.specifications),
      notes: material.notes.trim(),
      warranty_months: material.warranty_months,
      unit_codes: [...material.unit_codes].sort(),
      unit_scope_confirmed: material.unit_scope_confirmed === true,
    });
    const existingKeys = new Set(materials.map(materialKey));
    const additions = templateMaterials.filter((material) => !existingKeys.has(materialKey(material)));
    setMaterials([...materials, ...additions]);
    setOpenMaterialIndex(additions.length ? materials.length : Math.max(0, materials.length - 1));
    setTemplateMessage(
      additions.length
        ? `Added ${additions.length} line${additions.length === 1 ? "" : "s"} from ${template.attributes.name}. Select lifts for each line below, or choose “Apply all quoted lifts to every line” if the full template is shared. Existing lines and tax choices were kept.`
        : `All lines from ${template.attributes.name} are already in this draft. Existing material lines and tax choices were kept.`,
    );
  };

  const saveAsTemplate = async () => {
    if (!onCreateTemplate || !templateName.trim() || !materials.length) return;
    setTemplateBusy(true);
    setTemplateMessage("");
    try {
      const createdTemplate = await onCreateTemplate(templateName.trim(), materials);
      if (createdTemplate) {
        setTemplateResources((current) => [createdTemplate, ...current.filter((item) => item.id !== createdTemplate.id)]);
        setTemplateScope("PROVIDER");
        setTemplateId(createdTemplate.id);
      }
      setTemplateName("");
      setTemplateMessage("Material template saved for this provider.");
    } catch (cause) {
      setTemplateMessage(
        (cause as Error).message || "Material template could not be saved.",
      );
    } finally {
      setTemplateBusy(false);
    }
  };

  const pricedLines = materials
    .filter((material) => material.unit_price.trim() !== "" && material.unit_scope_confirmed !== false)
    .map((material) => {
      const quantity = Number(material.quantity);
      const unitPrice = Number(material.unit_price);
      return {
        description: material.description,
        quantity: material.quantity,
        unit_price: material.unit_price,
        amount: String(quantity * unitPrice),
        unit_codes: material.unit_codes.length ? material.unit_codes : unitCodes,
        ...(material.tax_rule_id
          ? {
              tax_rule_id: material.tax_rule_id,
              tax_pricing_mode: material.tax_pricing_mode,
            }
          : {}),
      };
    });
  const pricedTotal = pricedLines.reduce(
    (total, line) => total + Number(line.amount || 0),
    0,
  );
  const serializedMaterials = materials.map((material) => ({
    ...material,
    specifications: specificationPairsFromText(material.specifications),
  }));
  const orderedMaterials = materials
    .map((material, index) => ({ material, index }))
    .sort((left, right) => {
      if (lineOrder === "TEMPLATE") return left.index - right.index;
      const leftValue =
        lineOrder === "CATEGORY"
          ? materialCategoryLabel(left.material.category)
          : left.material.description;
      const rightValue =
        lineOrder === "CATEGORY"
          ? materialCategoryLabel(right.material.category)
          : right.material.description;
      return (
        leftValue.localeCompare(rightValue, undefined, {
          numeric: true,
          sensitivity: "base",
        }) || left.index - right.index
      );
    });
  const unassignedMaterialIndexes = unitCodes.length > 1
    ? materials.flatMap((material, index) =>
        !material.unit_scope_confirmed || material.unit_codes.length === 0 ? [index] : [],
      )
    : [];
  const applyAllUnitsToEveryMaterial = () => {
    setMaterials((current) => current.map((material) => ({
      ...material,
      unit_codes: [...unitCodes],
      unit_scope_confirmed: true,
    })));
  };

  return (
    <fieldset className="quotation-material-editor">
      <legend>Material scope</legend>
      <p className="quotation-material-editor-help">
        Capture the provider&apos;s planned material scope only. Use one line for
        a set or package and one line for each item inside it; add the relevant
        set-level or item-level specifications on that line. This does not
        reserve stock, maintain SKUs, or record certification. Template prices
        are editable planning defaults in INR.
      </p>
      <section className="quotation-material-template-picker" aria-label="Material scope templates">
        <div className="quotation-material-template-picker-heading">
          <div><strong>Material scope templates</strong><small>Choose a source, then select an active template. These fill material lines, quantities, specifications and planning prices; quotation terms are set separately.</small></div>
        </div>
        <div className="quotation-material-template-picker-controls">
          <label>
            Template source
            <SortedSelect
              dir="ltr"
              value={templateScope}
              onChange={(event) => {
                setTemplateScope(event.target.value as typeof templateScope);
                setTemplateId("");
                setTemplateMessage("");
              }}
            >
              <option value="PROVIDER">This provider</option>
              <option value="PLATFORM_MASTER">Platform master</option>
            </SortedSelect>
          </label>
          <label>
            Material scope template
            <SortedSelect value={templateId} onChange={(event) => { setTemplateId(event.target.value); setTemplateMessage(""); }}>
              <option value="">{selectableTemplates.length ? "Select an active template" : "No active templates available"}</option>
              {selectableTemplates.map((template) => (
                <option key={template.id} value={template.id}>{template.attributes.name}</option>
              ))}
            </SortedSelect>
          </label>
          <Button type="button" variant="secondary" disabled={!selectedTemplate} onClick={() => applyTemplate()}>
            {selectedTemplate && appliedTemplateId === selectedTemplate.id ? "Add template lines again" : "Add selected template lines"}
          </Button>
        </div>
        <p className="quotation-material-template-picker-status" aria-live="polite">
          {templateMessage || `${selectableTemplates.length} active ${templateScope === "PROVIDER" ? "provider" : "platform"} material scope template${selectableTemplates.length === 1 ? "" : "s"}.`}
        </p>
      </section>
      <input type="hidden" name={name} value={JSON.stringify(serializedMaterials)} />
      <input
        type="hidden"
        name="commercial_lines_json"
        value={JSON.stringify(pricedLines)}
      />
      {materials.length ? (
        <>
          {unitCodes.length > 1 && (
            <div className={`quotation-material-assignment-review${unassignedMaterialIndexes.length ? " has-missing" : ""}`} role="status">
              <div>
                <strong>{unassignedMaterialIndexes.length ? `${unassignedMaterialIndexes.length} material line${unassignedMaterialIndexes.length === 1 ? "" : "s"} need lift assignment` : "Lift assignments complete"}</strong>
                <small>{unassignedMaterialIndexes.length ? "Expand each highlighted line and choose its lift(s), or use the all-lines action when every item applies to every lift." : "Each material line is assigned to one or more quoted lifts."}</small>
              </div>
              <div>
                {unassignedMaterialIndexes.length > 0 && <Button type="button" variant="secondary" onClick={() => setOpenMaterialIndex(unassignedMaterialIndexes[0])}>Review next line</Button>}
                <Button type="button" variant="quiet" onClick={applyAllUnitsToEveryMaterial}>Apply all {unitCodes.length} lifts to every line</Button>
              </div>
            </div>
          )}
          {materials.length > 1 && (
            <div className="quotation-material-order-tools">
              <label>
                Display order
                <SortedSelect
                  value={lineOrder}
                  onChange={(event) =>
                    setLineOrder(event.target.value as MaterialLineOrder)
                  }
                >
                  <option value="TEMPLATE">Template / added order</option>
                  <option value="CATEGORY">Category (A–Z)</option>
                  <option value="DESCRIPTION">Description (A–Z)</option>
                </SortedSelect>
              </label>
              <small>Arrange lines for review without changing their values.</small>
            </div>
          )}
          <div className="quotation-material-editor-list" aria-label="Material scope items">
          {orderedMaterials.map(({ material, index }) => (
            <details
              className={`quotation-material-editor-row${unassignedMaterialIndexes.includes(index) ? " is-assignment-missing" : ""}`}
              key={`${index}-${material.description}`}
              open={openMaterialIndex === index}
              onToggle={(event) => {
                if (event.currentTarget.open) setOpenMaterialIndex(index);
                else if (openMaterialIndex === index) setOpenMaterialIndex(null);
              }}
            >
              <summary className="quotation-material-editor-summary">
                <span className="quotation-material-editor-summary-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="quotation-material-editor-summary-copy">
                  <strong>{material.description.trim() || `Material item ${index + 1}`}</strong>
                  <small>{materialCategoryLabel(material.category)} · {material.quantity || "0"} {material.unit_code || "UNIT"}</small>
                </span>
                <span className="quotation-material-editor-summary-values">
                  <span className={`quotation-material-editor-summary-visibility${material.customer_visibility === "EXCLUDED" ? " is-internal" : ""}`}>{material.customer_visibility === "EXCLUDED" ? "Internal" : "Included"}</span>
                  {unitCodes.length > 0 && <span className={!material.unit_scope_confirmed || !material.unit_codes.length ? "is-assignment-needed" : ""} title={material.unit_scope_confirmed && material.unit_codes.length ? material.unit_codes.join(", ") : "Lift assignment required"}>{!material.unit_scope_confirmed || !material.unit_codes.length ? "Assignment needed" : material.unit_codes.length === unitCodes.length ? `All ${unitCodes.length} lifts` : `${material.unit_codes.length} of ${unitCodes.length} lifts`}</span>}
                  {material.unit_price.trim() && <span>₹{Number(material.unit_price).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>}
                  {material.specifications.trim() && <span>{specificationPairsFromText(material.specifications).length} specs</span>}
                </span>
                <span className="quotation-material-editor-summary-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="quotation-material-editor-fields">
              <label className="quotation-material-editor-description">
                Description
                <textarea
                  required
                  rows={2}
                  maxLength={500}
                  value={material.description}
                  onChange={(event) =>
                    updateMaterial(index, "description", event.target.value)
                  }
                />
              </label>
              <label>
                Category
                <SortedSelect
                  value={material.category}
                  onChange={(event) =>
                    updateMaterial(index, "category", event.target.value)
                  }
                >
                  {phaseOneMaterialCategories.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SortedSelect>
              </label>
              <label>
                Quantity
                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  value={material.quantity}
                  onChange={(event) =>
                    updateMaterial(index, "quantity", event.target.value)
                  }
                />
              </label>
              <label>
                Unit
                <input
                  required
                  pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,31}"
                  value={material.unit_code}
                  onChange={(event) =>
                    updateMaterial(index, "unit_code", event.target.value.toUpperCase())
                  }
                />
              </label>
              {unitCodes.length > 0 && (
                <fieldset className="quotation-material-unit-scope">
                  <legend>Applies to lifts</legend>
                  <small>{!material.unit_scope_confirmed ? `Choose lift(s) for this item (${unitCodes.length} quoted), or intentionally apply it to all.` : !material.unit_codes.length ? "No lifts selected. Choose at least one or apply to all." : material.unit_codes.length === unitCodes.length ? `All ${unitCodes.length} quoted lifts selected.` : `${material.unit_codes.length} of ${unitCodes.length} quoted lifts selected.`}</small>
                  <div>
                    {unitCodes.map((unitCode) => {
                      const checked = material.unit_scope_confirmed && material.unit_codes.includes(unitCode);
                      return <label key={unitCode}>
                        <input
                          type="checkbox"
                          checked={checked}
                          aria-label={`Apply ${material.description || "material"} to ${unitCode}`}
                          onChange={(event) => {
                            const next = new Set(material.unit_scope_confirmed ? material.unit_codes : []);
                            if (event.target.checked) next.add(unitCode);
                            else next.delete(unitCode);
                            updateMaterial(index, "unit_codes", Array.from(next));
                            updateMaterial(index, "unit_scope_confirmed", true);
                          }}
                        />
                        <span>{unitCode}</span>
                      </label>;
                    })}
                  </div>
                  <Button type="button" variant="quiet" onClick={() => {
                    updateMaterial(index, "unit_codes", [...unitCodes]);
                    updateMaterial(index, "unit_scope_confirmed", true);
                  }}>
                    Apply to all {unitCodes.length} lifts
                  </Button>
                </fieldset>
              )}
              <label>
                Unit price (INR)
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={material.unit_price}
                  placeholder="Optional"
                  onChange={(event) =>
                    updateMaterial(index, "unit_price", event.target.value)
                  }
                />
              </label>
              <label>
                Customer visibility
                <SortedSelect
                  value={material.customer_visibility}
                  onChange={(event) =>
                    updateMaterial(index, "customer_visibility", event.target.value)
                  }
                >
                  <option value="INCLUDED">Included</option>
                  <option value="EXCLUDED">Internal / excluded</option>
                </SortedSelect>
              </label>
              <label>
                Tax rule
                <SortedSelect
                  value={material.tax_rule_id}
                  onChange={(event) =>
                    updateMaterial(index, "tax_rule_id", event.target.value)
                  }
                >
                  <option value="">Tax not configured</option>
                  {taxRules.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.attributes.rule_code} · {taxTreatmentLabel(rule.attributes.tax_treatment)} · {rule.attributes.total_rate_percent}%
                    </option>
                  ))}
                </SortedSelect>
                <small>
                  Rates and components come from the published platform tax catalogue.
                </small>
              </label>
              <label>
                Price mode
                <SortedSelect
                  value={material.tax_pricing_mode}
                  disabled={!material.tax_rule_id}
                  onChange={(event) =>
                    updateMaterial(index, "tax_pricing_mode", event.target.value)
                  }
                >
                  <option value="EXCLUSIVE">Tax extra</option>
                  <option value="INCLUSIVE">Tax included</option>
                </SortedSelect>
              </label>
              <label
                className={`quotation-material-editor-specifications${
                  specificationIssueFromText(material.specifications)
                    ? " has-material-field-error"
                    : ""
                }`}
              >
                Customer specifications
                <textarea
                  ref={(element) => {
                    specificationRefs.current[index] = element;
                    element?.setCustomValidity(
                      specificationIssueFromText(material.specifications),
                    );
                  }}
                  rows={2}
                  maxLength={12000}
                  placeholder="Capacity: 630 kg\nDrive: Gearless"
                  aria-invalid={Boolean(
                    specificationIssueFromText(material.specifications),
                  )}
                  aria-describedby={
                    specificationIssueFromText(material.specifications)
                      ? `material-specifications-error-${index}`
                      : undefined
                  }
                  className={
                    specificationIssueFromText(material.specifications)
                      ? "quotation-material-field-error"
                      : undefined
                  }
                  value={material.specifications}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateMaterial(index, "specifications", value);
                    event.currentTarget.setCustomValidity(
                      specificationIssueFromText(value),
                    );
                  }}
                />
                {specificationIssueFromText(material.specifications) && (
                  <small
                    id={`material-specifications-error-${index}`}
                    className="quotation-material-editor-inline-error"
                    role="alert"
                  >
                    {specificationIssueFromText(material.specifications)}
                  </small>
                )}
              </label>
              <label className="quotation-material-editor-notes">
                Notes
                <input
                  maxLength={1000}
                  value={material.notes}
                  onChange={(event) =>
                    updateMaterial(index, "notes", event.target.value)
                  }
                />
              </label>
              <label>
                Item warranty (months)
                <input
                  type="number"
                  min="0"
                  max="1200"
                  step="1"
                  value={material.warranty_months}
                  placeholder="Optional"
                  onChange={(event) =>
                    updateMaterial(index, "warranty_months", event.target.value)
                  }
                />
                <small>Declare a warranty for this material line only.</small>
              </label>
              <Button
                type="button"
                variant="quiet"
                onClick={() => {
                  setMaterials((current) => current.filter((_, rowIndex) => rowIndex !== index));
                  setOpenMaterialIndex((current) => {
                    if (current === index) return materials.length > 1 ? Math.min(index, materials.length - 2) : null;
                    return current !== null && current > index ? current - 1 : current;
                  });
                }}
              >
                Remove item
              </Button>
              </div>
            </details>
          ))}
          </div>
        </>
      ) : (
        <p className="quotation-empty-state">No material scope lines added.</p>
      )}
      <Button
        type="button"
        variant="quiet"
        disabled={materials.length >= phaseOneMaterialMax}
        onClick={() => {
          setMaterials((current) => [...current, {
            ...emptyQuotationMaterial(),
            unit_codes: unitCodes.length === 1 ? [...unitCodes] : [],
            unit_scope_confirmed: unitCodes.length === 1,
          }]);
          setOpenMaterialIndex(materials.length);
        }}
      >
        {materials.length >= phaseOneMaterialMax
          ? `Maximum ${phaseOneMaterialMax} material lines`
          : "+ Add material line"}
      </Button>
      {pricedLines.length > 0 && (
        <p className="quotation-material-pricing-summary">
          Priced scope total: <strong>₹{pricedTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong> · {pricedLines.length} commercial line{pricedLines.length === 1 ? "" : "s"}
        </p>
      )}
      {onCreateTemplate && (
        <div className="quotation-material-template-save">
          <label>
            Save these lines as a provider material scope template
            <input
              value={templateName}
              maxLength={120}
              placeholder="e.g. Standard residential lift"
              onChange={(event) => setTemplateName(event.target.value)}
            />
          </label>
          <Button
            type="button"
            variant="quiet"
            disabled={templateBusy || !templateName.trim() || !materials.length}
            onClick={() => void saveAsTemplate()}
          >
            {templateBusy ? "Saving…" : "Save as template"}
          </Button>
        </div>
      )}
      {templateMessage && (
        <small className="quotation-material-template-message">
          {templateMessage}
        </small>
      )}
    </fieldset>
  );
}

function QuotationActionNotifications({
  message,
  error,
  onDismissMessage,
  onDismissError,
}: {
  message: string;
  error: string;
  onDismissMessage: () => void;
  onDismissError: () => void;
}) {
  return (
    <>
      {message && (
        <ActionNotification
              title="Quotation action completed"
          onClose={onDismissMessage}
        >
          {message}
        </ActionNotification>
      )}
      {error && (
        <ActionNotification
          kind="error"
          title="Quotation action needs attention"
          onClose={onDismissError}
        >
          {error}
        </ActionNotification>
      )}
    </>
  );
}

export function QuotationTermsEditor({
  initialTerms,
  templates = [],
  initialTemplateId,
  stagePaymentsEnabled = true,
  amcMode = false,
  showTermsAndConditions = true,
}: {
  initialTerms?: Record<string, unknown>;
  templates?: Resource<QuotationTermsTemplateAttributes>[];
  initialTemplateId?: string;
  stagePaymentsEnabled?: boolean;
  amcMode?: boolean;
  showTermsAndConditions?: boolean;
}) {
  const selectionForMode = (source: unknown) => {
    const configured = quotationTermSelectionFromTerms(source);
    return amcMode ? { ...configured, freeAmc: false, freeAmcMonths: "0" } : configured;
  };
  const [selection, setSelection] = useState(() => selectionForMode(initialTerms));
  const initialSavedTemplate = initialTerms?.quotation_terms_template;
  const initialSavedTemplateId = initialSavedTemplate && typeof initialSavedTemplate === "object"
    ? String((initialSavedTemplate as Record<string, unknown>).id || "")
    : "";
  const [templateId, setTemplateId] = useState(initialTemplateId || initialSavedTemplateId);
  const [templateMessage, setTemplateMessage] = useState("");
  const selectableTemplates = useMemo(
    () => {
      const latestByScopeAndName = new Map<string, Resource<QuotationTermsTemplateAttributes>>();
      templates.forEach((template) => {
        const { status, scope, name, revision, updated_at, created_at } = template.attributes;
        if (status !== "ACTIVE" || !["PLATFORM_MASTER", "PROVIDER"].includes(scope)) return;
        const key = `${scope}:${name.trim().toLocaleLowerCase()}`;
        const current = latestByScopeAndName.get(key);
        const currentRevision = Number(current?.attributes.revision || 0);
        const nextRevision = Number(revision || 0);
        const currentDate = Date.parse(String(current?.attributes.updated_at || current?.attributes.created_at || "")) || 0;
        const nextDate = Date.parse(String(updated_at || created_at || "")) || 0;
        if (!current || nextRevision > currentRevision ||
          (nextRevision === currentRevision && (nextDate > currentDate || (nextDate === currentDate && template.id > current.id)))) {
          latestByScopeAndName.set(key, template);
        }
      });
      return Array.from(latestByScopeAndName.values()).sort((left, right) =>
        left.attributes.name.localeCompare(right.attributes.name, undefined, { sensitivity: "base" }),
      );
    },
    [templates],
  );
  const selectedTemplate = selectableTemplates.find((template) => template.id === templateId);
  const autoAppliedTemplate = useRef("");
  const selectionForTemplate = (template: Resource<QuotationTermsTemplateAttributes>) => {
    const configured = quotationTermSelectionFromTemplate(template);
    return amcMode ? { ...configured, freeAmc: false, freeAmcMonths: "0" } : configured;
  };
  const updateSelection = <K extends keyof QuotationTermSelection>(
    key: K,
    value: QuotationTermSelection[K],
  ) => setSelection((current) => ({ ...current, [key]: value }));
  const toggle = (key: "validity" | "payment" | "freeAmc" | "exclusions" | "onlineCustomerApproval" | "showTaxDetails") =>
    updateSelection(key, !selection[key]);
  const togglePaymentMethods = () => {
    setSelection((current) => ({
      ...current,
      paymentMethodsEnabled: !current.paymentMethodsEnabled,
      paymentMethods: current.paymentMethods.length > 0
        ? current.paymentMethods
        : [emptyQuotationPaymentMethod()],
    }));
  };
  const applyTemplate = (template = selectedTemplate) => {
    if (!template) return;
    setSelection(selectionForTemplate(template));
    setTemplateMessage(
      `Applied ${template.attributes.name}. Its default commercial configuration is loaded; save the quotation draft to persist this snapshot.`,
    );
  };
  useEffect(() => {
    if (!initialTemplateId || !templates.length || autoAppliedTemplate.current === initialTemplateId) return;
    const template = selectableTemplates.find((item) => item.id === initialTemplateId);
    if (!template) return;
    setTemplateId(initialTemplateId);
    setSelection(selectionForTemplate(template));
    setTemplateMessage(`Applied ${template.attributes.name}. Its default commercial configuration is loaded; save the quotation draft to persist this snapshot.`);
    autoAppliedTemplate.current = initialTemplateId;
  }, [initialTemplateId, selectableTemplates]);
  return (
    <fieldset className="quotation-terms-editor">
      <legend>Quotation terms</legend>
      <input type="hidden" name="quotation_terms_template_id" value={templateId} readOnly />
      <p className="quotation-terms-editor-help">
        Choose the conditions that belong in this quotation revision. Disabled
        terms are omitted from the saved snapshot. Item-level warranty is
        declared on each material line above. Provider terms templates are
        shared with quotation creators working in this provider account. Only
        active templates appear; when names repeat, the latest revision is used.
      </p>
      {selectableTemplates.length > 0 && (
        <div className="quotation-terms-template-tools">
          <label>
            Quotation terms template
            <SortedSelect
              value={templateId}
              onChange={(event) => {
                const nextTemplateId = event.target.value;
                setTemplateId(nextTemplateId);
                const nextTemplate = selectableTemplates.find((template) => template.id === nextTemplateId);
                if (nextTemplate) applyTemplate(nextTemplate);
                else setTemplateMessage("");
              }}
            >
              <option value="">Select active quotation terms</option>
              {selectableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.attributes.name}
                  {template.attributes.scope === "PLATFORM_MASTER"
                    ? " · Platform master"
                    : " · This provider"}
                </option>
              ))}
            </SortedSelect>
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={!templateId}
            onClick={() => applyTemplate()}
          >
            Reapply template defaults
          </Button>
          {selectedTemplate && (
            <details className="quotation-terms-template-preview">
              <summary>Preview template</summary>
              <dl>
                {selectedTemplate.attributes.description && (
                  <div>
                    <dt>Apply terms and conditions</dt>
                    <dd><RichTextViewer value={selectedTemplate.attributes.description} /></dd>
                  </div>
                )}
                {Object.entries(selectedTemplate.attributes.terms)
                  .filter(([key]) => !["delivery_terms", "warranty_terms"].includes(key))
                  .filter(([key]) => key !== "terms_and_conditions" || !selectedTemplate.attributes.description)
                  .map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replaceAll("_", " ")}</dt>
                    <dd>{key === "terms_and_conditions" ? <RichTextViewer value={value} /> : key === "payment_methods" ? <QuotationPaymentMethodsSummary value={value} maskAccounts /> : key === "bank_account" ? <QuotationBankAccountSummary value={value} maskAccount /> : key === "letterhead" ? <QuotationLetterheadSummary value={value} /> : key === "online_customer_approval" ? <QuotationCustomerApprovalSummary value={value} /> : key === "show_tax_details" ? <QuotationTaxVisibilitySummary value={value} /> : quotationValueForTerms(value)}</dd>
                  </div>
                  ))}
              </dl>
            </details>
          )}
        </div>
      )}
      <div className="quotation-terms-choice-grid">
        {[
          ["validity", "Quotation validity", "Keep the proposal valid for a defined number of days."],
          ["onlineCustomerApproval", "Online customer approval", "Allow an authorised customer contact to review and accept this exact revision online."],
          ["showTaxDetails", "Include tax details", "Show tax columns, tax rule, rates and components in the customer quotation web/PDF."],
          ["payment", "Stage payment schedule", "Allocate the quotation total across controlled project stages."],
          ["freeAmc", "Included free AMC", "Declare included maintenance coverage."],
          ["paymentMethodsEnabled", "Payment mode & details", "Add one or more approved ways for the customer to pay: bank transfer, online, cash, cheque or UPI QR."],
          ["exclusions", "Exclusions", "List work or supply items outside this quotation."],
        ].filter(([key]) => (key !== "payment" || stagePaymentsEnabled) && (key !== "freeAmc" || !amcMode)).map(([key, label, help]) => {
          const selected = Boolean(selection[key as keyof QuotationTermSelection]);
          return (
            <label
              className={`quotation-terms-choice${selected ? " is-enabled" : ""}`}
              key={key}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={key === "paymentMethodsEnabled" ? togglePaymentMethods : () => toggle(key as "validity" | "payment" | "freeAmc" | "exclusions" | "onlineCustomerApproval" | "showTaxDetails")}
              />
              <span>
                <strong>{label}</strong>
                <small>{help}</small>
              </span>
            </label>
          );
        })}
      </div>
      {stagePaymentsEnabled ? (
        <div className="quotation-payment-stage-editor">
          <div className="quotation-payment-stage-heading">
            <div>
              <strong>Payment stages</strong>
              <small>Used for New Installation, Modification and Takeover only. Percentages must total 100%.</small>
            </div>
            <label className="quotation-payment-freeze">
              <input
                type="checkbox"
                checked={selection.freezePaymentStages}
                onChange={(event) => updateSelection("freezePaymentStages", event.target.checked)}
              />
              Freeze when quotation is issued
            </label>
          </div>
          {selection.payment && selection.paymentStages.map((stage, index) => (
            <div className="quotation-payment-stage-row" key={`${stage.code}-${index}`}>
              <label>
                Stage
                <input value={stage.code} onChange={(event) => updateSelection("paymentStages", selection.paymentStages.map((item, itemIndex) => itemIndex === index ? { ...item, code: event.target.value } : item))} />
              </label>
              <label>
                Description
                <input value={stage.description} onChange={(event) => updateSelection("paymentStages", selection.paymentStages.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} />
              </label>
              <label>
                Percentage
                <input type="number" min="0.01" max="100" step="0.01" value={stage.percentage} onChange={(event) => updateSelection("paymentStages", selection.paymentStages.map((item, itemIndex) => itemIndex === index ? { ...item, percentage: event.target.value } : item))} />
              </label>
              <label>
                Trigger
                <SortedSelect value={stage.trigger_kind} onChange={(event) => updateSelection("paymentStages", selection.paymentStages.map((item, itemIndex) => itemIndex === index ? { ...item, trigger_kind: event.target.value } : item))}>
                  <option value="MANUAL">Manual</option>
                  <option value="CUSTOMER_ACCEPTANCE">Customer acceptance</option>
                  <option value="STAGE_COMPLETION">Stage completion</option>
                  <option value="DELIVERY">Delivery</option>
                  <option value="HANDOVER">Handover</option>
                </SortedSelect>
              </label>
              <label className="quotation-payment-stage-acceptance">
                <input type="checkbox" checked={stage.customer_acceptance_required} onChange={(event) => updateSelection("paymentStages", selection.paymentStages.map((item, itemIndex) => itemIndex === index ? { ...item, customer_acceptance_required: event.target.checked } : item))} />
                Customer acceptance
              </label>
              <Button type="button" variant="quiet" disabled={selection.paymentStages.length <= 1} onClick={() => updateSelection("paymentStages", selection.paymentStages.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
            </div>
          ))}
          {selection.payment && <div className="quotation-payment-stage-actions"><Button type="button" variant="secondary" onClick={() => updateSelection("paymentStages", [...selection.paymentStages, { code: `STAGE_${selection.paymentStages.length + 1}`, description: "New stage", percentage: "0", sequence: selection.paymentStages.length + 1, trigger_kind: "MANUAL", material_release_condition: "", customer_acceptance_required: false }])}>Add stage</Button><span role="status">Total: {selection.paymentStages.reduce((total, stage) => total + (Number(stage.percentage) || 0), 0).toFixed(2)}%</span></div>}
        </div>
      ) : (
        <p className="notice quotation-payment-not-applicable">Stage payments are not applicable to AMC/service quotations. The quotation remains payable as a commercial total or contract schedule.</p>
      )}
      <div className="quotation-terms-value-grid">
        {showTermsAndConditions && (
          <RichTextEditor
            label="Apply terms and conditions"
            value={selection.termsAndConditions}
            onChange={(value) => updateSelection("termsAndConditions", value)}
            help="Use one rich-text field for the provider’s delivery, warranty, commercial and customer-facing conditions."
          />
        )}
        {selection.validity && (
          <label>
            Validity (days)
            <input
              name="validity_days"
              type="number"
              min="1"
              max="3650"
              value={selection.validityDays}
              onChange={(event) => updateSelection("validityDays", event.target.value)}
            />
          </label>
        )}
        {selection.paymentMethodsEnabled && (
          <fieldset className="quotation-bank-account-editor quotation-payment-method-editor">
            <legend>Payment mode &amp; details</legend>
            <p>Add the provider-approved payment options that should appear on this quotation. Add multiple bank transfer accounts when required.</p>
            {selection.paymentMethods.map((method, index) => (
              <div className="quotation-payment-method-card" key={`${method.method}-${index}`}>
                <div className="quotation-payment-method-heading">
                  <strong>Payment option {index + 1}</strong>
                  <Button type="button" variant="quiet" disabled={selection.paymentMethods.length <= 1} onClick={() => updateSelection("paymentMethods", selection.paymentMethods.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
                </div>
                <div className="quotation-bank-account-grid">
                  <label className="quotation-payment-mode-field">
                    Payment mode *
                    <SortedSelect value={method.method} onChange={(event) => updateSelection("paymentMethods", selection.paymentMethods.map((item, itemIndex) => itemIndex === index ? { ...item, method: event.target.value as QuotationPaymentMethodCode } : item))}>
                      <option value="BANK_TRANSFER">Bank transfer</option>
                      <option value="ONLINE">Online payment</option>
                      <option value="CASH">Cash</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="UPI_QR">UPI QR</option>
                    </SortedSelect>
                  </label>
                  <label className="quotation-payment-label-field">
                    Display label
                    <input value={method.label} placeholder="e.g. HDFC current account" onChange={(event) => updateSelection("paymentMethods", selection.paymentMethods.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} />
                  </label>
                  {method.method === "BANK_TRANSFER" && (
                    <>
                      <label className="quotation-bank-beneficiary-field">Beneficiary name *<input required value={method.bankAccount.beneficiary_name} onChange={(event) => updateSelection("paymentMethods", selection.paymentMethods.map((item, itemIndex) => itemIndex === index ? { ...item, bankAccount: { ...item.bankAccount, beneficiary_name: event.target.value } } : item))} /></label>
                      <label>Bank name *<input required value={method.bankAccount.bank_name} onChange={(event) => updateSelection("paymentMethods", selection.paymentMethods.map((item, itemIndex) => itemIndex === index ? { ...item, bankAccount: { ...item.bankAccount, bank_name: event.target.value } } : item))} /></label>
                      <label>Account number *<input required inputMode="numeric" value={method.bankAccount.account_number} onChange={(event) => updateSelection("paymentMethods", selection.paymentMethods.map((item, itemIndex) => itemIndex === index ? { ...item, bankAccount: { ...item.bankAccount, account_number: event.target.value } } : item))} /></label>
                      <label>Account type *<SortedSelect value={method.bankAccount.account_type} onChange={(event) => updateSelection("paymentMethods", selection.paymentMethods.map((item, itemIndex) => itemIndex === index ? { ...item, bankAccount: { ...item.bankAccount, account_type: event.target.value as QuotationBankAccountSelection["account_type"] } } : item))}><option value="CURRENT">Current</option><option value="SAVINGS">Savings</option><option value="OTHER">Other</option></SortedSelect></label>
                      <label>IFSC code *<input required maxLength={11} autoCapitalize="characters" placeholder="e.g. HDFC0001234" value={method.bankAccount.ifsc_code} onChange={(event) => updateSelection("paymentMethods", selection.paymentMethods.map((item, itemIndex) => itemIndex === index ? { ...item, bankAccount: { ...item.bankAccount, ifsc_code: event.target.value.toUpperCase() } } : item))} /></label>
                      <label>Branch name<input value={method.bankAccount.branch_name} onChange={(event) => updateSelection("paymentMethods", selection.paymentMethods.map((item, itemIndex) => itemIndex === index ? { ...item, bankAccount: { ...item.bankAccount, branch_name: event.target.value } } : item))} /></label>
                    </>
                  )}
                  {method.method === "ONLINE" && (
                    <>
                      <label>Payment provider *<input required placeholder="e.g. Razorpay" value={method.providerName} onChange={(event) => updateSelection("paymentMethods", selection.paymentMethods.map((item, itemIndex) => itemIndex === index ? { ...item, providerName: event.target.value } : item))} /></label>
                      <label className="quotation-payment-link-field">Payment link<input type="url" placeholder="https://…" value={method.paymentLink} onChange={(event) => updateSelection("paymentMethods", selection.paymentMethods.map((item, itemIndex) => itemIndex === index ? { ...item, paymentLink: event.target.value } : item))} /></label>
                    </>
                  )}
                  {method.method === "UPI_QR" && (
                    <label className="quotation-upi-id-field">UPI ID *<input required inputMode="email" placeholder="business@upi" value={method.upiId} onChange={(event) => updateSelection("paymentMethods", selection.paymentMethods.map((item, itemIndex) => itemIndex === index ? { ...item, upiId: event.target.value } : item))} /></label>
                  )}
                  {(method.method === "CASH" || method.method === "CHEQUE") && (
                    <label className="quotation-payment-instructions-field">Collection instructions<input placeholder="e.g. Collect against receipt" value={method.instructions} onChange={(event) => updateSelection("paymentMethods", selection.paymentMethods.map((item, itemIndex) => itemIndex === index ? { ...item, instructions: event.target.value } : item))} /></label>
                  )}
                </div>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => updateSelection("paymentMethods", [...selection.paymentMethods, emptyQuotationPaymentMethod()])}>Add payment option</Button>
          </fieldset>
        )}
        {selection.freeAmc && (
          <>
            <label>
              Free AMC months
              <input
                type="number"
                min="0"
                max="1200"
                value={selection.freeAmcMonths}
                onChange={(event) => updateSelection("freeAmcMonths", event.target.value)}
              />
            </label>
            <label>
              AMC frequency
              <SortedSelect
                value={selection.freeAmcFrequency}
                onChange={(event) => updateSelection("freeAmcFrequency", event.target.value)}
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="BIANNUALLY">Biannually</option>
                <option value="ANNUALLY">Annually</option>
              </SortedSelect>
            </label>
          </>
        )}
        {selection.exclusions && (
          <label className="quotation-terms-exclusions">
            Exclusions (one per line)
            <textarea
              rows={3}
              maxLength={12000}
              value={selection.exclusionsText}
              onChange={(event) => updateSelection("exclusionsText", event.target.value)}
            />
          </label>
        )}
      </div>
      <input
        type="hidden"
        name="commercial_terms_json"
        value={JSON.stringify(selection)}
        readOnly
      />
      <p className="quotation-terms-editor-note">
        Tax treatment and rates come from the published provider/platform tax catalogue; they are not entered as free text here.
      </p>
      {templateMessage && (
        <small className="quotation-terms-template-message">{templateMessage}</small>
      )}
    </fieldset>
  );
}

export const quotationValueForTerms = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(quotationValueForTerms).join(", ");
  if (value && typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key.replaceAll("_", " ")}: ${quotationValueForTerms(item)}`)
      .join(" · ");
  return String(value ?? "—");
};

function quotationTitleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function CopyPaymentValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" className="quotation-payment-copy" onClick={() => void copy()} aria-label={`Copy ${label}`}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function bankAccountCopyText(account: Record<string, unknown>) {
  return [
    ["Beneficiary", account.beneficiary_name],
    ["Bank", account.bank_name],
    ["Account type", quotationTitleCase(String(account.account_type || ""))],
    ["Account number", account.account_number],
    ["IFSC code", account.ifsc_code],
    ["Branch", account.branch_name],
    ["UPI ID", account.upi_id],
  ]
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}: ${String(value)}`)
    .join("\n");
}

function paymentMethodCopyText(method: Record<string, unknown>) {
  const bankAccount = method.bank_account && typeof method.bank_account === "object" ? method.bank_account as Record<string, unknown> : null;
  return [
    `Payment method: ${String(method.label || quotationTitleCase(String(method.method || "PAYMENT")))}`,
    bankAccount ? bankAccountCopyText(bankAccount) : "",
    method.provider_name ? `Payment provider: ${String(method.provider_name)}` : "",
    method.upi_id ? `UPI ID: ${String(method.upi_id)}` : "",
    method.payment_link ? `Payment link: ${String(method.payment_link)}` : "",
    method.instructions ? `Instructions: ${String(method.instructions)}` : "",
  ].filter(Boolean).join("\n");
}

function QuotationUpiQr({ upiId, payeeName }: { upiId: string; payeeName: string }) {
  const [source, setSource] = useState("");
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}`;
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(upiUri, { width: 144, margin: 1, errorCorrectionLevel: "M" })
      .then((dataUrl: string) => { if (active) setSource(dataUrl); })
      .catch(() => { if (active) setSource(""); });
    return () => { active = false; };
  }, [payeeName, upiId, upiUri]);
  return source ? (
    <figure className="quotation-payment-qr">
      <img src={source} alt={`Scan to pay ${payeeName}`} />
      <figcaption>Scan to pay</figcaption>
    </figure>
  ) : null;
}

export function QuotationLetterheadSummary({ value }: { value: unknown }) {
  const letterhead = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const address = letterhead.address && typeof letterhead.address === "object" ? letterhead.address as Record<string, unknown> : {};
  const addressLine = [
    address.address_line,
    address.locality,
    [address.city, address.district, address.state, address.pin_code].filter(Boolean).join(", "),
    address.country,
  ].filter(Boolean).map(String).join(" · ");
  const logo = letterhead.logo && typeof letterhead.logo === "object" ? letterhead.logo as Record<string, unknown> : {};
  const footerContacts = letterhead.footer_contacts && typeof letterhead.footer_contacts === "object" ? letterhead.footer_contacts as Record<string, unknown> : {};
  const visibleContacts = ["phone", "email", "fax", "website"]
    .map((key) => {
      const contact = footerContacts[key] && typeof footerContacts[key] === "object" ? footerContacts[key] as Record<string, unknown> : {};
      return contact.enabled === true && contact.value ? `${key[0].toUpperCase()}${key.slice(1)}: ${String(contact.value)}` : "";
    })
    .filter(Boolean);
  return (
    <span className="quotation-letterhead-summary">
      <strong>{letterhead.enabled === false ? "Not used" : String(letterhead.business_name || "Business name not supplied")}</strong>
      <span>{String(letterhead.format || "STANDARD")} · Logo {logo.enabled === false ? "not attached" : "attached"}</span>
      {letterhead.enabled !== false && addressLine && <span>{addressLine}</span>}
      {letterhead.show_tax_details !== false && Boolean(letterhead.gstin || letterhead.pan_number) && <span>{[letterhead.gstin && `GSTIN ${String(letterhead.gstin)}`, letterhead.pan_number && `PAN ${String(letterhead.pan_number)}`].filter(Boolean).map(String).join(" · ")}</span>}
      {visibleContacts.length > 0 && <span>Footer: {visibleContacts.join(" · ")}</span>}
    </span>
  );
}

export function QuotationBankAccountSummary({
  value,
  maskAccount = false,
  interactive = false,
  showCopyButton = true,
}: {
  value: unknown;
  maskAccount?: boolean;
  interactive?: boolean;
  showCopyButton?: boolean;
}) {
  const account = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const accountNumber = String(account.account_number || "—");
  const visibleAccountNumber = maskAccount && accountNumber.length > 4
    ? `${"•".repeat(Math.max(0, accountNumber.length - 4))}${accountNumber.slice(-4)}`
    : accountNumber;
  return (
    <span className="quotation-bank-account-summary">
      <span className="quotation-bank-account-summary-toolbar"><small>Payment mode &amp; details</small>{showCopyButton && interactive && !maskAccount && <CopyPaymentValue value={bankAccountCopyText(account)} label="all payment details" />}</span>
      <span className="quotation-bank-account-fields">
        <span className="quotation-payment-value quotation-payment-value--beneficiary"><small>Beneficiary</small><strong>{String(account.beneficiary_name || "Beneficiary not supplied")}</strong></span>
        <span className="quotation-payment-value"><small>Bank</small><strong>{String(account.bank_name || "Bank not supplied")}</strong></span>
        <span className="quotation-payment-value"><small>Account type</small><strong>{quotationTitleCase(String(account.account_type || "Account type not supplied"))}</strong></span>
        <span className="quotation-payment-value"><small>Account Number</small><strong>{visibleAccountNumber}</strong></span>
        <span className="quotation-payment-value"><small>IFSC Code</small><strong>{String(account.ifsc_code || "—")}</strong></span>
        {Boolean(account.branch_name) && <span className="quotation-payment-value"><small>Branch</small><strong>{String(account.branch_name)}</strong></span>}
        {Boolean(account.upi_id) && <span className="quotation-payment-value"><small>UPI ID</small><strong>{String(account.upi_id)}</strong></span>}
      </span>
    </span>
  );
}

export function QuotationPaymentMethodsSummary({
  value,
  maskAccounts = false,
  interactive = false,
}: {
  value: unknown;
  maskAccounts?: boolean;
  interactive?: boolean;
}) {
  const methods = Array.isArray(value) ? value : [];
  const allPaymentDetails = methods
    .map((item) => item && typeof item === "object" ? paymentMethodCopyText(item as Record<string, unknown>) : "")
    .filter(Boolean)
    .join("\n\n");
  return (
    <span className="quotation-payment-methods-summary">
      {interactive && !maskAccounts && allPaymentDetails && <span className="quotation-payment-methods-toolbar"><small>Payment mode &amp; details</small><CopyPaymentValue value={allPaymentDetails} label="all payment details" /></span>}
      {methods.map((item, index) => {
        const method = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const code = quotationTitleCase(String(method.method || "PAYMENT"));
        const upiId = String(method.upi_id || "").trim();
        const payeeName = String(method.provider_name || method.label || "Provider").trim();
        return (
          <span className="quotation-payment-method-summary" key={`${code}-${index}`}>
            <span className="quotation-payment-method-header"><strong>{String(method.label || code)}</strong><span className="quotation-payment-method-header-actions"><small>{code}</small></span></span>
            {Boolean(method.bank_account) && <QuotationBankAccountSummary value={method.bank_account} maskAccount={maskAccounts} interactive={interactive} showCopyButton={false} />}
            {Boolean(method.provider_name) && <span className="quotation-payment-value"><small>Payment Provider</small><strong>{String(method.provider_name)}</strong>{Boolean(method.payment_link) && <a href={String(method.payment_link)} target="_blank" rel="noreferrer">Open Payment Link</a>}</span>}
            {Boolean(upiId) && <span className="quotation-payment-upi-block"><span className="quotation-payment-value"><small>UPI ID</small><strong>{upiId}</strong></span><QuotationUpiQr upiId={upiId} payeeName={payeeName} />{interactive && <a className="quotation-payment-open-upi" href={`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}`}>Open UPI App</a>}</span>}
            {Boolean(method.instructions) && <span className="quotation-payment-value"><small>Instructions</small><strong>{String(method.instructions)}</strong></span>}
          </span>
        );
      })}
    </span>
  );
}

export function QuotationExclusionsSummary({ value }: { value: unknown }) {
  const items = Array.isArray(value) ? value.map(String).filter(Boolean) : [String(value || "")].filter(Boolean);
  return items.length ? <ul className="quotation-exclusions-list">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <span>None specified</span>;
}

export function QuotationIncludedAmcSummary({ value }: { value: unknown }) {
  const amc = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const months = Number(amc.months || 0);
  const frequency = amc.frequency ? quotationTitleCase(String(amc.frequency)) : "Schedule to be confirmed";
  return <span className="quotation-included-amc-summary"><strong>{months > 0 ? `${months} Months Included` : "Included AMC"}</strong><span>{frequency} preventive maintenance coverage</span></span>;
}

export function QuotationCustomerApprovalSummary({ value }: { value: unknown }) {
  const online = value !== false && String(value).toLowerCase() !== "false";
  return <span className={`quotation-customer-approval-summary${online ? " is-online" : " is-offline"}`}><strong>{online ? "Online customer approval" : "Offline agreement copy"}</strong><span>{online ? "Authorised customer contacts can review and accept the issued revision online; no physical signature or company seal is required." : "Customer signature, company seal and date may be included when available; online acceptance is disabled for this revision."}</span></span>;
}

export function QuotationTaxVisibilitySummary({ value }: { value: unknown }) {
  const visible = value !== false && String(value).toLowerCase() !== "false";
  return <span className={`quotation-tax-visibility-summary${visible ? " is-visible" : " is-hidden"}`}><strong>{visible ? "Tax details included" : "Tax breakdown hidden"}</strong><span>{visible ? "Tax columns, rates and components appear in customer web/PDF views." : "Tax calculation remains active; customer views show only the total payable."}</span></span>;
}

function QuotationPaymentStagesCustomerSummary({ value, total, currency = "INR", moneyFor }: {
  value: unknown;
  total?: unknown;
  currency?: string;
  moneyFor?: (value: unknown, currency?: string) => string;
}) {
  const configuration = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const stages = Array.isArray(configuration.stages) ? configuration.stages : [];
  if (!stages.length) return <span>Payment schedule not specified</span>;
  const quotedTotal = Number(total);
  return <span className="quotation-payment-stages-summary">{stages.map((item, index) => {
    const stage = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const sequence = Number(stage.sequence || index + 1);
    const percentage = Number(stage.percentage);
    const amount = Number.isFinite(quotedTotal) && Number.isFinite(percentage)
      ? Number((quotedTotal * percentage / 100).toFixed(2))
      : undefined;
    return <span className="quotation-payment-stage" key={`${String(stage.code || sequence)}-${sequence}`}>
      <span className="quotation-payment-stage-label">
        <strong>{sequence}. {quotationTitleCase(String(stage.code || "Stage"))}</strong>
        <span className="quotation-payment-stage-share">
          <small>{Number.isFinite(percentage) ? `${percentage.toFixed(1)}%` : "Percentage not supplied"}</small>
          {amount !== undefined && moneyFor && <strong>{moneyFor(amount, currency)}</strong>}
        </span>
      </span>
      <span className="quotation-payment-stage-details"><span>{String(stage.description || "Payment milestone")}</span><small>{quotationTitleCase(String(stage.trigger_kind || "MANUAL"))}{stage.customer_acceptance_required ? " · Customer acceptance required" : ""}</small></span>
    </span>;
  })}</span>;
}

export function QuotationAgreementSignatureSection({
  providerName = "Provider authorized representative",
  customerName = "Customer authorized representative",
  providerState = "Provider approval recorded separately",
  customerState = "Awaiting customer acceptance",
}: {
  providerName?: string;
  customerName?: string;
  providerState?: string;
  customerState?: string;
}) {
  return (
    <section className="quotation-agreement-signatures" aria-label="Agreement signatures and seals">
      <div className="quotation-agreement-signatures-heading">
        <div><span className="eyebrow">Agreement confirmation</span><h4>Provider and customer confirmation</h4></div>
        <small>Soft copy provision</small>
      </div>
      <p className="quotation-agreement-signatures-note">Online acceptance records the authorised customer identity and timestamp. A physical customer signature, company seal and date are optional when the customer does not have them.</p>
      <div className="quotation-agreement-signature-grid">
        <div className="quotation-agreement-signature-card quotation-agreement-signature-card--provider">
          <span className="quotation-agreement-signature-role">Provider</span>
          <strong>{providerName}</strong>
          <small>{providerState}</small>
          <div className="quotation-agreement-signature-line"><span>Authorised signature</span><span>Company seal · Date</span></div>
        </div>
        <div className="quotation-agreement-signature-card quotation-agreement-signature-card--customer">
          <span className="quotation-agreement-signature-role">Customer</span>
          <strong>{customerName}</strong>
          <small>{customerState}</small>
          <div className="quotation-agreement-signature-line"><span>Signature optional</span><span>Seal if available · Date optional</span></div>
        </div>
      </div>
    </section>
  );
}

type CustomerQuotationPreviewLine = {
  description?: string;
  quantity?: string | number;
  unit?: string;
  unit_code?: string;
  unit_price?: string | number;
  amount?: string | number;
  tax_amount?: string | number;
  pricing_mode?: string;
  tax?: { rule_code?: string; tax_treatment?: string } | null;
  unit_codes?: string[];
};

type CustomerQuotationPreviewMaterial = {
  description: string;
  category: string;
  quantity: string;
  unit_code: string;
  customer_visibility: "INCLUDED" | "EXCLUDED";
  specifications: string;
  warranty_months: string;
  unit_codes?: string[];
};

function QuotationLiftAssignmentValue({ unitCodes, allUnitCodes }: { unitCodes?: string[]; allUnitCodes: string[] }) {
  const assigned = unitCodes?.length ? unitCodes : allUnitCodes;
  const assignedSet = new Set(assigned);
  const ordered = allUnitCodes.filter((code) => assignedSet.has(code));
  const resolved = ordered.length ? ordered : assigned;
  const isAll = allUnitCodes.length > 0 && resolved.length === allUnitCodes.length;
  if (!resolved.length) return <>All quoted lifts</>;
  if (isAll) return <>All {allUnitCodes.length} lifts</>;
  return <details className="quotation-lift-assignment-value">
    <summary>{resolved.length} of {allUnitCodes.length || "quoted"} lifts <span>View lifts</span></summary>
    <ul>{resolved.map((code) => <li key={code}>{code}</li>)}</ul>
  </details>;
}

export function quotationTermsTextIncludesStructuredDetail(value: string, key: "payment_stages") {
  const text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (key === "payment_stages") return /payment schedule|payment milestone|advance payment|customer acceptance|final handover/.test(text);
  return false;
}

function CustomerQuotationPreview({
  quotation,
  customerName,
  lines,
  materials,
  terms,
  taxSummary,
  moneyFor,
  logoUrl = "",
}: {
  quotation: Resource<GenericAttributes>;
  customerName: string;
  lines: CustomerQuotationPreviewLine[];
  materials: CustomerQuotationPreviewMaterial[];
  terms: Record<string, unknown>;
  taxSummary?: { status?: string; components?: Array<{ code?: string; amount?: string }> };
  moneyFor: (value: unknown, currency?: string) => string;
  logoUrl?: string;
}) {
  const [platformBranding, setPlatformBranding] = useState<{ brand_name: string; platform_scope_text: string; support_email?: string | null } | null>(null);
  useEffect(() => {
    let current = true;
    operationsData.quotationPlatformBranding().then(({ data }) => { if (current) setPlatformBranding(data.attributes); }).catch(() => { if (current) setPlatformBranding(null); });
    return () => { current = false; };
  }, []);
  const platformBrandName = platformBranding?.brand_name || "TRISE INDIA";
  const platformScopeText = platformBranding?.platform_scope_text || "TRISE India provides the digital platform used to prepare and review this quotation. The service provider named above is responsible for the quoted scope, pricing, delivery and contractual terms.";
  const currency = String(quotation.attributes.currency || "INR");
  const showTaxDetails = terms.show_tax_details !== false;
  const visibleMaterials = materials.filter((material) => material.customer_visibility !== "EXCLUDED");
  const requirementScope = quotation.attributes.requirement_scope && typeof quotation.attributes.requirement_scope === "object"
    ? quotation.attributes.requirement_scope as Record<string, unknown>
    : {};
  const quotationRequirements = quotation.attributes.requirements && typeof quotation.attributes.requirements === "object"
    ? quotation.attributes.requirements as Record<string, unknown>
    : {};
  const customerRequirementOverview = {
    ...quotationRequirements,
    units: Array.isArray(requirementScope.units) ? requirementScope.units : quotationRequirements.units,
  };
  const customerLiftUnitCodes = Array.isArray(customerRequirementOverview.units)
    ? customerRequirementOverview.units.map((unit, index) => {
      const record = unit && typeof unit === "object" ? unit as Record<string, unknown> : {};
      return String(record.unit_code || record.label || record.name || `Lift ${index + 1}`);
    })
    : [];
  const termsAndConditions = String(terms.terms_and_conditions || terms.description || "").trim();
  const paymentStages = quotationPaymentScheduleForView(terms);
  const showPaymentStages = Boolean(paymentStages && !quotationTermsTextIncludesStructuredDetail(termsAndConditions, "payment_stages"));
  const paymentMethods = Array.isArray(terms.payment_methods) ? terms.payment_methods : [];
  const hasPaymentMethods = paymentMethods.length > 0;
  const exclusions = terms.exclusions;
  const freeAmc = terms.included_free_amc;
  const templateSnapshot = terms.quotation_terms_template && typeof terms.quotation_terms_template === "object"
    ? terms.quotation_terms_template as Record<string, unknown>
    : null;
  const letterhead = terms.letterhead && typeof terms.letterhead === "object"
    ? terms.letterhead as Record<string, unknown>
    : null;
  const letterheadAddress = letterhead?.address && typeof letterhead.address === "object"
    ? letterhead.address as Record<string, unknown>
    : {};
  const letterheadAddressText = [
    letterheadAddress.address_line,
    letterheadAddress.locality,
    [letterheadAddress.city, letterheadAddress.district, letterheadAddress.state, letterheadAddress.pin_code].filter(Boolean).join(", "),
    letterheadAddress.country,
  ].filter(Boolean).map(String).join(" · ");
  const letterheadLogo = letterhead?.logo && typeof letterhead.logo === "object"
    ? letterhead.logo as Record<string, unknown>
    : {};
  const letterheadContacts = letterhead?.footer_contacts && typeof letterhead.footer_contacts === "object"
    ? letterhead.footer_contacts as Record<string, unknown>
    : {};
  const contactFields = ["phone", "email", "fax", "website"]
    .map((key) => {
      const contact = letterheadContacts[key] && typeof letterheadContacts[key] === "object"
        ? letterheadContacts[key] as Record<string, unknown>
        : {};
      return { key, value: String(contact.value || ""), enabled: contact.enabled === true };
    })
    .filter((contact) => contact.enabled && contact.value.trim());
  const status = String(quotation.attributes.status || "DRAFT")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
  const issueDate = quotation.attributes.issued_at ? new Date(String(quotation.attributes.issued_at)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "Not issued";
  const validUntil = quotation.attributes.valid_until ? new Date(String(quotation.attributes.valid_until)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "Not specified";
  return (
    <section className="quotation-template-preview-mode quotation-template-web-preview quotation-customer-preview" aria-label="Actual customer quotation preview">
      <div className="quotation-template-preview-mode-heading">
        <div><span className="platform-eyebrow">Web quotation</span><h3>Customer-facing browser view</h3></div>
        <small>{templateSnapshot ? `Applied terms template · ${String(templateSnapshot.name || "Saved template")} · revision ${String(templateSnapshot.revision || "—")}` : "Uses this quotation revision&apos;s original saved values. No template snapshot was attached; immutable revisions cannot be re-templated."}</small>
      </div>
      <article className="quotation-template-web-sheet">
        {letterhead && letterhead.enabled !== false && (
          <header className={`quotation-template-letterhead--${String(letterhead.logo_position || "LEFT").toLowerCase()} quotation-template-letterhead`}>
            {logoUrl && <img src={logoUrl} alt="Provider logo" />}
            <div>
              <strong>{String(letterhead.business_name || quotation.attributes.provider_name || "Provider business name")}</strong>
              {letterhead.show_address !== false && <span>{letterheadAddressText || "Business address not configured"}</span>}
              {letterhead.show_tax_details !== false && Boolean(letterhead.gstin || letterhead.pan_number) && <span>{[letterhead.gstin ? `GSTIN ${String(letterhead.gstin)}` : "", letterhead.pan_number ? `PAN ${String(letterhead.pan_number)}` : ""].filter(Boolean).join(" · ")}</span>}
            </div>
            {letterheadLogo.enabled === true && !logoUrl && <small className="quotation-template-letterhead-missing-logo">Logo preview unavailable</small>}
          </header>
        )}
        <div className="quotation-template-web-meta quotation-customer-preview-meta">
          <div><span>Quotation</span><strong>{String(quotation.attributes.provider_name || "Commercial proposal")}</strong></div>
          <div><span>Quotation no.</span><strong>{String(quotation.attributes.quotation_number || "Quotation")}</strong></div>
          <div><span>Issue date</span><strong>{issueDate}</strong></div>
          <div><span>Valid until</span><strong>{validUntil}</strong></div>
          <div><span>Revision</span><strong>R{String(quotation.attributes.revision || "1")}</strong></div>
        </div>
        <div className="quotation-template-sample-customer">
          <div><span>Customer</span><strong>{customerName}</strong></div>
          <div><span>Billing address</span><strong>Not supplied on this revision</strong></div>
          <div><span>Shipping / site address</span><strong>Not supplied on this revision</strong></div>
          <div><span>Status</span><strong>{status}</strong></div>
        </div>
        <section className="quotation-template-sample-lines" aria-label="Actual quotation items">
          <div className="quotation-template-sample-lines-heading"><div><strong>Quotation items</strong><small>Original line items and prices from the saved quotation revision.</small></div><Status>{lines.length} {lines.length === 1 ? "item" : "items"}</Status></div>
          {lines.length ? (
            <div className="quotation-template-sample-table-wrap"><table className="quotation-template-sample-table"><thead><tr><th>Description</th><th>Applies to lifts</th><th>Qty</th><th>Unit</th><th>Unit price</th>{showTaxDetails && <th>Tax</th>}<th>Amount</th></tr></thead><tbody>{lines.map((line, index) => <tr key={`${line.description || "line"}-${index}`}><td>{line.description || "—"}</td><td><QuotationLiftAssignmentValue unitCodes={line.unit_codes} allUnitCodes={customerLiftUnitCodes} /></td><td>{String(line.quantity ?? "—")}</td><td>{String(line.unit || line.unit_code || "—")}</td><td>{moneyFor(line.unit_price || 0, currency)}</td>{showTaxDetails && <td>{line.tax ? `${String(line.tax.rule_code || line.tax.tax_treatment || "Configured")} · ${moneyFor(line.tax_amount || 0, currency)}` : "Not configured"}</td>}<td>{moneyFor(line.amount || 0, currency)}</td></tr>)}</tbody></table></div>
          ) : <p className="quotation-empty-state">No priced line items are attached to this revision.</p>}
          <div className="quotation-template-tax-summary quotation-customer-preview-totals">
          <div className="quotation-template-tax-context"><div><span>Tax treatment</span><strong>{showTaxDetails ? "Included" : "Hidden"}</strong><small>{showTaxDetails ? "Breakdown appears in this customer view." : "Calculation remains included in the total payable."}</small></div><div><span>Tax rule</span><strong>{taxSummary?.components?.map((component) => displayLabel(component.code, "Tax")).join(" + ") || "Not configured"}</strong><small>Published central tax rules</small></div><div><span>Currency</span><strong>{currency}</strong><small>Quotation currency</small></div></div>
            <dl className="quotation-template-totals"><div><dt>Subtotal</dt><dd>{moneyFor(quotation.attributes.subtotal || quotation.attributes.total || 0, currency)}</dd></div><div><dt>Discount</dt><dd>{moneyFor(quotation.attributes.discount_total || 0, currency)}</dd></div>{showTaxDetails && <><div><dt>Tax</dt><dd>{moneyFor(quotation.attributes.tax_total || 0, currency)}</dd></div>{taxSummary?.components?.map((component) => <div key={String(component.code)}><dt>{displayLabel(component.code, "Tax")}</dt><dd>{moneyFor(component.amount || 0, currency)}</dd></div>)}</>}<div className="is-grand-total"><dt>Quoted total</dt><dd><span>{moneyFor(quotation.attributes.grand_total || quotation.attributes.total || 0, currency)}</span>{currency.toUpperCase() === "INR" && <small className="quotation-amount-words">{amountInWordsFor(quotation.attributes.grand_total || quotation.attributes.total || 0, currency)}</small>}</dd></div></dl>
          </div>
        </section>
        {Object.keys(customerRequirementOverview).length > 0 && <section className="quotation-template-sample-lines quotation-customer-lift-specifications"><QuotationOverviewSpecifications requirements={customerRequirementOverview} customerFacing /></section>}
        {visibleMaterials.length > 0 && <section className="quotation-template-sample-lines" aria-label="Actual material scope"><div className="quotation-template-sample-lines-heading"><div><strong>Materials included in scope</strong><small>Customer-visible planned material scope from this quotation revision.</small></div><Status>{visibleMaterials.length} {visibleMaterials.length === 1 ? "material" : "materials"}</Status></div><div className="quotation-template-sample-table-wrap"><table className="quotation-template-sample-table"><thead><tr><th>Description &amp; specifications</th><th>Applies to lifts</th><th>Category</th><th>Qty</th><th>Unit</th><th>Warranty</th></tr></thead><tbody>{visibleMaterials.map((material, index) => <tr key={`${material.description}-${index}`}><td><strong>{material.description || "—"}</strong>{material.specifications && <dl className="quotation-customer-material-specs">{orderedQuotationSpecifications(material.specifications).map((specification, specificationIndex) => <div key={`${specification.name}-${specificationIndex}`}><dt>{specification.name}</dt><dd><QuotationOverviewValue value={specification.value} requirementKey={specification.name} /></dd></div>)}</dl>}</td><td><QuotationLiftAssignmentValue unitCodes={material.unit_codes} allUnitCodes={customerLiftUnitCodes} /></td><td>{displayLabel(material.category, "Other")}</td><td>{material.quantity}</td><td>{material.unit_code}</td><td>{material.warranty_months ? `${material.warranty_months} months` : "As agreed"}</td></tr>)}</tbody></table></div></section>}
        <section className="quotation-template-selected-terms" aria-label="Actual quotation terms">
          <div className="quotation-template-preview-section-heading"><h4>Commercial Terms &amp; Payment Details</h4><small>Original customer-ready values attached to this quotation revision.</small></div>
          <div className="quotation-template-approval-mode"><span>Customer approval</span><QuotationCustomerApprovalSummary value={terms.online_customer_approval !== false} /></div>
          {termsAndConditions && <div className="quotation-template-terms-conditions"><div className="quotation-template-terms-conditions-heading"><h5>Terms &amp; Conditions</h5><small>Applied to this revision</small></div><RichTextViewer value={termsAndConditions} /></div>}
          <dl>
            {showPaymentStages && paymentStages && <div><dt>Payment stages</dt><dd><QuotationPaymentStagesCustomerSummary value={paymentStages} total={quotation.attributes.grand_total || quotation.attributes.total || 0} currency={currency} moneyFor={moneyFor} /></dd></div>}
            {hasPaymentMethods && <div><dt>Payment Mode &amp; Details</dt><dd><QuotationPaymentMethodsSummary value={paymentMethods} maskAccounts={false} /></dd></div>}
            {Boolean(terms.bank_account) && !terms.payment_methods && <div><dt>Payment account</dt><dd><QuotationBankAccountSummary value={terms.bank_account} maskAccount={false} /></dd></div>}
            {Array.isArray(exclusions) ? exclusions.length > 0 && <div><dt>Exclusions</dt><dd><QuotationExclusionsSummary value={exclusions} /></dd></div> : Boolean(exclusions) && <div><dt>Exclusions</dt><dd><QuotationExclusionsSummary value={exclusions} /></dd></div>}
            {Boolean(freeAmc) && <div><dt>Included free AMC</dt><dd><QuotationIncludedAmcSummary value={freeAmc} /></dd></div>}
            <div><dt>Tax details</dt><dd><QuotationTaxVisibilitySummary value={showTaxDetails} /></dd></div>
          </dl>
        </section>
        {letterhead && letterhead.enabled !== false && (Boolean(letterhead.footer_text) || contactFields.length > 0) && <footer className="quotation-template-letterhead-footer">
          {contactFields.length > 0 && <div className="quotation-template-letterhead-footer-contacts" aria-label="Provider contact details">
            {contactFields.map((contact) => <span key={contact.key}><strong>{contact.key[0].toUpperCase() + contact.key.slice(1)}</strong><a href={contact.key === "email" ? `mailto:${contact.value}` : contact.key === "phone" || contact.key === "fax" ? `tel:${contact.value.replace(/[^+\d]/g, "")}` : contact.value}>{contact.value}</a></span>)}
          </div>}
          {Boolean(letterhead.footer_text) && <p>{String(letterhead.footer_text)}</p>}
        </footer>}
        <footer className="quotation-customer-platform-footer">
          <div className="quotation-customer-platform-mark" aria-hidden="true"><strong>{platformBrandName}</strong><span>PLATFORM</span></div>
          <div><strong>Platform services</strong><p>{platformScopeText}</p><small>{platformBranding?.support_email ? <>Platform support: <a href={`mailto:${platformBranding.support_email}`}>{platformBranding.support_email}</a></> : "For quotation scope and commercial terms, contact the service provider named above."}</small></div>
        </footer>
      </article>
    </section>
  );
}

function quotationRequirementLabel(key: string) {
  const labels: Record<string, string> = {
    equipment_type_code: "Equipment type",
    industry_segment: "Industry",
    shaft_width_mm: "Shaft width (mm)",
    shaft_depth_mm: "Shaft depth (mm)",
    pit_depth_mm: "Pit depth (mm)",
    headroom_mm: "Headroom (mm)",
    application: "Application",
    technology: "Technology",
    drive_type: "Drive type",
    capacity_kg: "Capacity",
    stops: "Stops",
    quantity: "Units",
    speed_band: "Speed",
    door_configuration: "Door configuration",
    door_type: "Door type",
    machine_room: "Machine room",
    control_system: "Control system",
    finish: "Finish",
    accessibility_features: "Accessibility",
    safety_features: "Safety / emergency",
    standards_references: "Standards",
  };
  return labels[key] || key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function quotationRequirementValue(value: unknown, key: string) {
  const text = Array.isArray(value)
    ? value.map((item) => String(item).replaceAll("_", " ")).join(", ")
    : String(value ?? "—").replaceAll("_", " ");
  if (key === "capacity_kg" && text !== "—") return `${text} kg`;
  if (key === "stops" && text !== "—") return `${text} stops`;
  if (key === "quantity" && text !== "—") return `${text} unit${Number(value) === 1 ? "" : "s"}`;
  return text;
}

const quotationRequirementOrder = [
  "equipment_type_code", "application", "industry_segment", "technology", "drive_type", "control_system",
  "capacity_kg", "stops", "speed_band", "door_configuration", "door_type", "finish", "machine_room",
  "shaft_width_mm", "shaft_depth_mm", "pit_depth_mm", "headroom_mm", "accessibility_features",
  "safety_features", "standards_references", "notes",
];
const quotationRequirementOrderIndex = (key: string) => {
  const index = quotationRequirementOrder.indexOf(key);
  return index < 0 ? quotationRequirementOrder.length : index;
};

function QuotationOverviewValue({ value, requirementKey }: { value: unknown; requirementKey: string }) {
  const formatted = quotationRequirementValue(value, requirementKey);
  const isStandards = /standard|reference|authority/i.test(requirementKey);
  const items = Array.isArray(value)
    ? value.map((item) => String(item).replaceAll("_", " ").trim()).filter(Boolean)
    : isStandards && formatted.includes(",")
      ? formatted.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
  const longValue = formatted.length > 110 || items.length > 3;
  if (!longValue) return <>{formatted}</>;
  const preview = items.length > 3
    ? `${items.slice(0, 3).join(", ")} · +${items.length - 3} more`
    : `${formatted.slice(0, 108).trimEnd()}…`;
  return <span className="quotation-overview-long-value">
    <span>{preview}</span>
    <details>
      <summary>View full value</summary>
      {items.length > 3
        ? <ul>{items.map((item, index) => <li key={`${requirementKey}-${index}`}>{item}</li>)}</ul>
        : <p>{formatted}</p>}
    </details>
  </span>;
}

function QuotationOverviewSpecifications({ requirements, customerFacing = false }: { requirements: Record<string, unknown>; customerFacing?: boolean }) {
  const rawUnits = Array.isArray(requirements.units) ? requirements.units : [];
  const units = rawUnits.map((unit) => unit && typeof unit === "object" && !Array.isArray(unit) ? unit as Record<string, unknown> : {});
  const identityKeys = new Set(["equipment_type_code", "type", "label", "stops", "capacity_kg", "unit_key", "unit_code", "code", "name", "id"]);
  const metadataKeys = new Set(["units", "quantity", "profile_mode", "unit_requirement_mode", "business_operation_code"]);
  const baseRequirements = Object.fromEntries(Object.entries(requirements).filter(([key]) => !metadataKeys.has(key) && (!units.length || !identityKeys.has(key))));
  const profiles = units.map((unit) => {
    const unitRequirements = unit.requirements && typeof unit.requirements === "object" && !Array.isArray(unit.requirements)
      ? unit.requirements as Record<string, unknown>
      : {};
    return { ...baseRequirements, ...unitRequirements };
  });
  const profileKeys = [...new Set([...Object.keys(baseRequirements), ...profiles.flatMap((profile) => Object.keys(profile))])]
    .filter((key) => !metadataKeys.has(key) && !identityKeys.has(key))
    .sort((left, right) => quotationRequirementOrderIndex(left) - quotationRequirementOrderIndex(right) || left.localeCompare(right));
  const hasPerUnitProfiles = String(requirements.unit_requirement_mode || "").toUpperCase() === "PER_UNIT" || units.some((unit) => Boolean(unit.requirements));
  const differentKeys = new Set(profileKeys.filter((key) => new Set(profiles.map((profile) => JSON.stringify(profile[key] ?? null))).size > 1));
  const sharedRequirements = hasPerUnitProfiles && profiles.length > 1
    ? Object.fromEntries(profileKeys.filter((key) => !differentKeys.has(key) && profiles.some((profile) => profile[key] !== null && profile[key] !== undefined && profile[key] !== "" && (!Array.isArray(profile[key]) || (profile[key] as unknown[]).length > 0))).map((key) => [key, profiles[0][key]]))
    : baseRequirements;
  const sharedEntries = Object.entries(sharedRequirements).filter(([key, value]) => !metadataKeys.has(key) && !identityKeys.has(key) && value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0))
    .sort(([left], [right]) => quotationRequirementOrderIndex(left) - quotationRequirementOrderIndex(right) || left.localeCompare(right));
  const unitIdentity: Array<Record<string, unknown>> = units.map((unit) => ({
    type: unit.equipment_type_code || unit.type,
    stops: unit.stops,
    capacity_kg: unit.capacity_kg,
  }));
  const differentIdentityKeys = new Set(["type", "stops", "capacity_kg"].filter((key) => new Set(unitIdentity.map((identity) => JSON.stringify(identity[key] ?? null))).size > 1));

  return <section className={`quotation-overview-specifications${customerFacing ? " is-customer-facing" : ""}`} aria-label={customerFacing ? "Lift specifications" : "Latest lift specifications"}>
    <div className="quotation-overview-specifications-heading"><div><span className="eyebrow">{customerFacing ? "Lift specifications" : "Latest Lead & survey specifications"}</span><p>{hasPerUnitProfiles ? "Shared values appear once; highlighted lift values differ." : "Latest submitted values carried into this quotation."}</p></div>{!customerFacing && <Status>Survey snapshot</Status>}</div>
    {sharedEntries.length > 0 && <section className="quotation-overview-shared-specifications"><h5>{hasPerUnitProfiles ? "Requirements shared across lifts" : "Shared requirements"}</h5><dl className="quotation-requirement-grid quotation-overview-specification-grid">{sharedEntries.map(([key, value]) => <div key={key}><dt>{quotationRequirementLabel(key)}</dt><dd><QuotationOverviewValue value={value} requirementKey={key} /></dd></div>)}</dl></section>}
    {units.length > 0 && <section className="quotation-overview-lift-comparison"><h5>Lift specifications</h5><div>{units.map((unit, index) => {
      const profile = profiles[index] || {};
      const differences = [...differentKeys].map((key) => [key, profile[key] ?? "Not recorded"] as [string, unknown]);
      const identity = { ...unitIdentity[index], type: unitIdentity[index]?.type || "Not recorded", stops: unitIdentity[index]?.stops ?? "Not recorded", capacity_kg: unitIdentity[index]?.capacity_kg ?? "Not recorded" };
      return <article key={`quotation-overview-lift-${index}`}>
        <strong>{String(unit.label || `Unit ${index + 1}`)}</strong>
        <dl className="quotation-overview-lift-identity">{Object.entries(identity).map(([key, value]) => <div className={differentIdentityKeys.has(key) ? "quotation-overview-difference" : undefined} key={key}><dt>{quotationRequirementLabel(key)}</dt><dd><QuotationOverviewValue value={value} requirementKey={key} /></dd></div>)}</dl>
        {differences.length > 0 ? <dl className="quotation-overview-lift-differences">{differences.map(([key, value]) => <div className="quotation-overview-difference" key={key}><dt>{quotationRequirementLabel(key)}</dt><dd><QuotationOverviewValue value={value} requirementKey={key} /></dd></div>)}</dl> : <small>{hasPerUnitProfiles ? "No lift-specific differences." : "Uses the shared requirement profile."}</small>}
      </article>;
    })}</div></section>}
    {sharedEntries.length === 0 && units.length === 0 && <p className="notice">No submitted requirement specifications are attached to this quotation.</p>}
    {typeof requirements.notes === "string" && requirements.notes.trim() && !sharedEntries.some(([key]) => key === "notes") && <p className="quotation-overview-specification-notes"><strong>Survey notes:</strong> {requirements.notes}</p>}
  </section>;
}

function QuotationRequirementSnapshot({
  requirement,
  loading,
  error,
}: {
  requirement: Resource<RequirementRevisionAttributes> | null;
  loading: boolean;
  error: string;
}) {
  if (loading) return <p className="notice quotation-requirement-loading">Loading the selected Lead&apos;s latest requirements…</p>;
  if (error) return <p className="notice state-error" role="alert">{error}</p>;
  if (!requirement) return <p className="notice">Select a Lead to carry its latest survey and requirement revision into this quotation.</p>;
  const scope = requirement.attributes.requirement_scope || {};
  const values = scope.requirements || requirement.attributes.requirements || {};
  const entries = Object.entries(values).filter(([key, value]) => !["notes", "units", "profile_mode", "unit_requirement_mode", "business_operation_code"].includes(key) && value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0))
    .sort(([left], [right]) => quotationRequirementOrderIndex(left) - quotationRequirementOrderIndex(right) || left.localeCompare(right));
  const requirementUnits = scope.units || (Array.isArray(values.units) ? values.units as Array<Record<string, unknown>> : []);
  const unitOverrides = requirementUnits.map((unit, index) => {
    const base = unit.requirements && typeof unit.requirements === "object" ? unit.requirements as Record<string, unknown> : {};
    const changed = Object.entries(base).filter(([key, value]) => key !== "notes" && value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0) && JSON.stringify(value) !== JSON.stringify(values[key]))
      .sort(([left], [right]) => quotationRequirementOrderIndex(left) - quotationRequirementOrderIndex(right) || left.localeCompare(right));
    return { unit, index, changed };
  });
  const completion = requirement.attributes.requirements_completion;
  return <section className="quotation-requirement-snapshot" aria-label="Selected Lead requirements">
    <div className="quotation-requirement-snapshot-heading"><div><span className="eyebrow">Requirement source</span><strong>Latest Lead &amp; survey requirements</strong><small>These values remain linked to the selected Lead; they are not re-entered in the quotation form.</small></div><Status>{completion?.complete ? `Revision ${requirement.attributes.revision_number} · Complete` : `Revision ${requirement.attributes.revision_number} · Review required`}</Status></div>
    {entries.length ? <dl>{entries.map(([key, value]) => <div key={key}><dt>{quotationRequirementLabel(key)}</dt><dd>{quotationRequirementValue(value, key)}</dd></div>)}</dl> : <p className="notice">The selected Lead has no submitted requirement values yet.</p>}
    {values.unit_requirement_mode === "PER_UNIT" && unitOverrides.length > 0 && <section className="quotation-unit-requirements"><h4>Per-lift differences</h4><div>{unitOverrides.map(({ unit, index, changed }) => <article key={`quotation-unit-requirements-${index}`}><strong>{String(unit.label || `Unit ${index + 1}`)} · {String(unit.equipment_type_code || unit.type || "Type not recorded")} · {String(unit.stops || "—")} stops · {String(unit.capacity_kg || "—")} kg</strong>{changed.length ? <dl>{changed.map(([key, value]) => <div key={key}><dt>{quotationRequirementLabel(key)}</dt><dd>{quotationRequirementValue(value, key)}</dd></div>)}</dl> : <small>Matches the default technical profile.</small>}</article>)}</div></section>}
    {!completion?.complete && completion?.missing_fields?.length ? <small className="quotation-requirement-missing">Missing before quotation issue: {completion.missing_fields.map(quotationRequirementLabel).join(", ")}</small> : null}
  </section>;
}

function QuotationFormPage({
  mode,
  busy,
  providerId,
  relationshipOptions = [],
  leads = [],
  initialDescription,
  initialLiftUnitCodes,
  initialRequirementUnitCodes = [],
  initialPurpose = "INSTALLATION",
  initialAmount,
  initialMaterials,
  initialTerms,
  initialTemplateId,
  templates,
  termsTemplates,
  taxRules,
  relationshipsError = "",
  relationshipsLoading = false,
  relationshipsHaveMore = false,
  onLoadMoreRelationships,
  onCreateTemplate,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit" | "revision";
  busy: boolean;
  providerId: string;
  relationshipOptions?: Array<{ id: string; label: string }>;
  leads?: Resource<GenericAttributes>[];
  initialDescription: string;
  initialLiftUnitCodes?: string;
  initialRequirementUnitCodes?: string[];
  initialPurpose?: string;
  initialAmount?: string;
  initialMaterials?: QuotationMaterialLine[];
  initialTerms?: Record<string, unknown>;
  initialTemplateId?: string;
  templates: Resource<MaterialScopeTemplateAttributes>[];
  termsTemplates: Resource<QuotationTermsTemplateAttributes>[];
  taxRules: QuotationTaxRule[];
  relationshipsError?: string;
  relationshipsLoading?: boolean;
  relationshipsHaveMore?: boolean;
  onLoadMoreRelationships?: () => void;
  onCreateTemplate?: (
    name: string,
    lines: QuotationMaterialLine[],
  ) => Promise<Resource<MaterialScopeTemplateAttributes> | void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const isCreate = mode === "create";
  const isRevision = mode === "revision";
  const [relationshipId, setRelationshipId] = useState("");
  const [relationshipSearch, setRelationshipSearch] = useState("");
  const [leadLinkedRelationship, setLeadLinkedRelationship] = useState<LookupOption | null>(null);
  const [leadId, setLeadId] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [purpose, setPurpose] = useState(initialPurpose);
  const [liftUnitCodes, setLiftUnitCodes] = useState(() => initialLiftUnitCodes || (
    Array.isArray(initialTerms?.elevator_units)
      ? initialTerms.elevator_units.map((unit) => String((unit as Record<string, unknown>).unit_code || "")).filter(Boolean).join(", ")
      : "Lift 1"
  ));
  const [leadRequirement, setLeadRequirement] = useState<Resource<RequirementRevisionAttributes> | null>(null);
  const [leadRequirementLoading, setLeadRequirementLoading] = useState(false);
  const [leadRequirementError, setLeadRequirementError] = useState("");
  const [associatedAssets, setAssociatedAssets] = useState<Resource<GenericAttributes>[]>([]);
  const [associatedAssetsLoading, setAssociatedAssetsLoading] = useState(false);
  const [associatedAssetsError, setAssociatedAssetsError] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const usesLiftAssetScope = isCreate && ["SERVICE", "CONTRACT_RENEWAL"].includes(purpose);
  const assetUnitCode = (asset: Resource<GenericAttributes>) => String(asset.attributes.equipment_code || asset.attributes.asset_code || asset.attributes.code || asset.attributes.name || `Lift ${asset.id.slice(0, 8)}`);
  const createTypeLabel: Record<string, string> = { INSTALLATION: "New installation", MODIFICATION: "Modification", TAKEOVER: "Takeover", SERVICE: "Service / repair", CONTRACT_RENEWAL: "AMC / contract renewal", MAINTENANCE_CONTRACT: "AMC quotation" };
  const title = isCreate
    ? `${createTypeLabel[purpose] || "New"} quotation`
    : isRevision
      ? "New quotation revision"
      : "Update quotation draft";
  const description = isCreate
    ? `Prepare a ${createTypeLabel[purpose] || "new"} quotation with the right customer and scope details.`
    : isRevision
      ? "Create a new editable revision while preserving the previously issued version."
      : "Update the draft revision before it is issued or reviewed.";
  const relationshipLookupOptions: LookupOption[] = [
    ...relationshipOptions.map(
    (item) => ({
      id: item.id,
      label: item.label,
      detail: "Authorized customer relationship",
    }),
    ),
    ...(leadLinkedRelationship && !relationshipOptions.some((item) => item.id === leadLinkedRelationship.id) ? [leadLinkedRelationship] : []),
  ];
  const leadLookupOptions: LookupOption[] = leads.map((item) => ({
    id: item.id,
    label: String(item.attributes.title || "Lead"),
    detail: String(item.attributes.reference_code || "Authorized Lead"),
  }));
  const requirementUnitOptions = Array.from(
    new Set(
      (leadRequirement?.attributes.requirement_scope?.units || [])
        .map((unit, index) => String(unit.unit_code || unit.code || unit.label || unit.name || `Lift ${index + 1}`).trim())
        .concat(initialRequirementUnitCodes)
        .filter(Boolean),
    ),
  );
  const selectedLiftUnitCodes = new Set(
    liftUnitCodes
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean),
  );
  const quoteUnitCodes = Array.from(selectedLiftUnitCodes);
  const toggleRequirementUnit = (unitCode: string, checked: boolean) => {
    const next = new Set(selectedLiftUnitCodes);
    if (checked) next.add(unitCode);
    else next.delete(unitCode);
    setLiftUnitCodes(Array.from(next).join(", "));
  };

  useEffect(() => {
    if (!isCreate || !leadId) {
      setLeadRequirement(null);
      setLeadRequirementError("");
      setLeadRequirementLoading(false);
      return;
    }
    let active = true;
    setLeadRequirementLoading(true);
    setLeadRequirementError("");
    void operationsData.requirementRevisions(providerId, leadId)
      .then((result) => {
        if (!active) return;
        const latest = result.data[0] || null;
        setLeadRequirement(latest);
        const units = latest?.attributes.requirement_scope?.units || [];
        const codes = units.map((unit) => String(unit.unit_code || unit.code || "")).filter(Boolean);
        if (codes.length) setLiftUnitCodes(codes.join(", "));
        if (!latest) setLeadRequirementError("The selected Lead has no submitted requirement revision yet.");
      })
      .catch((cause) => {
        if (active) setLeadRequirementError((cause as Error).message || "The Lead requirements could not be loaded.");
      })
      .finally(() => { if (active) setLeadRequirementLoading(false); });
    return () => { active = false; };
  }, [isCreate, leadId, providerId]);

  useEffect(() => {
    if (!usesLiftAssetScope || !relationshipId) {
      setAssociatedAssets([]);
      setSelectedAssetIds([]);
      setAssociatedAssetsError("");
      setAssociatedAssetsLoading(false);
      return;
    }
    let active = true;
    setAssociatedAssets([]);
    setSelectedAssetIds([]);
    setAssociatedAssetsLoading(true);
    setAssociatedAssetsError("");
    void operationsData.assets(providerId, { customerRelationshipId: relationshipId, limit: 100 })
      .then((result) => {
        if (!active) return;
        const assets = result.data;
        setAssociatedAssets(assets);
        setSelectedAssetIds(assets.map((asset) => asset.id));
        if (assets.length) setLiftUnitCodes(assets.map(assetUnitCode).join(", "));
      })
      .catch((cause) => { if (active) setAssociatedAssetsError((cause as Error).message || "Customer lifts could not be loaded."); })
      .finally(() => { if (active) setAssociatedAssetsLoading(false); });
    return () => { active = false; };
  }, [usesLiftAssetScope, relationshipId, providerId]);

  const toggleAssociatedAsset = (asset: Resource<GenericAttributes>, checked: boolean) => {
    const next = new Set(selectedAssetIds);
    if (checked) next.add(asset.id); else next.delete(asset.id);
    setSelectedAssetIds(Array.from(next));
    const codes = associatedAssets.filter((item) => next.has(item.id)).map(assetUnitCode);
    setLiftUnitCodes(codes.join(", "));
  };

  return (
    <section className="quotation-form-page" aria-label={title}>
      <PageHeader
        eyebrow="Sales & Marketing"
        title={title}
        description={description}
        action={
          <Button type="button" variant="secondary" onClick={onCancel}>
          ← {isCreate && initialPurpose ? "Back to quotation types" : "Back to quotations"}
          </Button>
        }
      />
      <section className="quotation-form-shell detail-card">
        <div className="quotation-form-intro">
          <div>
            <span className="eyebrow">Commercial proposal workspace</span>
            <h2>{isCreate ? "Prepare the quotation" : "Review the revision before saving"}</h2>
          </div>
          <p className="notice">
            {isCreate
              ? "Start with a master material template when available, then adjust quantities, prices, and customer-readable specifications."
              : "All changes are validated by the API. Issued or accepted revisions remain immutable; use a new revision when the commercial scope changes."}
          </p>
        </div>
        {!relationshipOptions.length && isCreate && (
          <p className="notice">
            A provider customer or prospect relationship is required before a
            quotation can be created.
          </p>
        )}
        {isCreate && relationshipsError && (
          <p className="notice state-error" role="alert">{relationshipsError}</p>
        )}
        <form onSubmit={onSubmit}>
          <div className="form-grid quotation-form-grid">
            {isCreate && (
              <>
                <div className="quotation-form-lookup">
                  <SearchableSelect
                    label="Customer relationship"
                    searchLabel="Search customer name, reference, or type"
                    search={relationshipSearch}
                    onSearch={setRelationshipSearch}
                    value={relationshipId}
                    onChange={setRelationshipId}
                    options={relationshipLookupOptions}
                    placeholder="Select an authorized customer relationship"
                    required
                    disabled={!relationshipLookupOptions.length}
                  />
                  <input
                    type="hidden"
                    name="customer_relationship_id"
                    value={relationshipId}
                  />
                  {relationshipsHaveMore && (
                    <Button
                      type="button"
                      variant="quiet"
                      disabled={relationshipsLoading}
                      onClick={onLoadMoreRelationships}
                    >
                      {relationshipsLoading ? "Loading customers…" : "Load more customers"}
                    </Button>
                  )}
                </div>
                <div className="quotation-form-lookup">
                  <SearchableSelect
                    label="Lead"
                    searchLabel="Search lead title or reference"
                    search={leadSearch}
                    onSearch={setLeadSearch}
                    value={leadId}
                    onChange={(nextLeadId) => {
                      setLeadId(nextLeadId);
                      const selectedLead = leads.find((item) => item.id === nextLeadId);
                      const linked = selectedLead?.relationships.customer_relationship;
                      if (linked && !Array.isArray(linked)) {
                        setRelationshipId(linked.id);
                        const known = relationshipOptions.find((item) => item.id === linked.id);
                        setLeadLinkedRelationship(known ? null : { id: linked.id, label: String(selectedLead?.attributes.customer_relationship_name || "Linked customer relationship"), detail: "Authorized relationship carried from Lead" });
                      } else {
                        setRelationshipId("");
                        setLeadLinkedRelationship(null);
                      }
                    }}
                    options={leadLookupOptions}
                    placeholder="No linked lead"
                    required={false}
                  />
                  <input type="hidden" name="lead_id" value={leadId} />
                <QuotationRequirementSnapshot requirement={leadRequirement} loading={leadRequirementLoading} error={leadRequirementError} />
                </div>
                <div className="quotation-type-locked" aria-label={`Quotation type: ${createTypeLabel[purpose] || "New installation"}`}>
                  <span>Quotation type</span>
                  <strong>{createTypeLabel[purpose] || "New installation"}</strong>
                  <small>The type was selected on the previous step. Stage payments apply to installation, modification and takeover quotations.</small>
                  <input type="hidden" name="purpose" value={purpose} />
                </div>
              </>
            )}
            <label>
              Description
              <input name="description" required defaultValue={initialDescription} />
            </label>
            {usesLiftAssetScope && <fieldset className="quotation-associated-lifts"><legend>Customer’s associated lifts</legend><p>Select the lifts included in this service or AMC quotation. Selecting a customer loads its linked elevator assets automatically.</p>{associatedAssetsLoading ? <p role="status">Loading customer lifts…</p> : associatedAssetsError ? <p className="state-error" role="alert">{associatedAssetsError}</p> : associatedAssets.length ? <div>{associatedAssets.map((asset) => <label key={asset.id}><input type="checkbox" checked={selectedAssetIds.includes(asset.id)} onChange={(event) => toggleAssociatedAsset(asset, event.target.checked)} /><span><strong>{String(asset.attributes.display_name || asset.attributes.name || assetUnitCode(asset))}</strong><small>{assetUnitCode(asset)}{asset.attributes.location_name ? ` · ${String(asset.attributes.location_name)}` : ""}</small></span></label>)}</div> : relationshipId ? <p>No elevator assets are linked to this customer. You can still enter lift unit codes manually below.</p> : <p>Select a customer relationship to load its associated lifts.</p>}<input type="hidden" name="associated_assets_json" value={JSON.stringify(associatedAssets.filter((asset) => selectedAssetIds.includes(asset.id)).map((asset) => ({ id: asset.id, unit_code: assetUnitCode(asset) })))} /></fieldset>}
            {(isCreate || mode === "edit") && (
              <div className="quotation-unit-selection">
                <label>
                  Lift unit codes (comma separated)
                  <input
                    aria-label="Lift unit codes (comma separated)"
                    aria-describedby="lift-unit-code-help"
                    name="lift_unit_codes"
                    required
                    maxLength={8100}
                    value={liftUnitCodes}
                    onChange={(event) => setLiftUnitCodes(event.target.value)}
                  />
                  <small id="lift-unit-code-help">
                    {requirementUnitOptions.length
                      ? "Select the submitted Lead units below, or adjust the final list if the approved scope changed."
                      : "Use one unique unit code per quoted lift."}
                  </small>
                </label>
                {requirementUnitOptions.length > 0 && (
                  <fieldset className="quotation-requirement-unit-options">
                    <legend>Units from latest submitted requirements ({requirementUnitOptions.length})</legend>
                    <small>{selectedLiftUnitCodes.size} of {requirementUnitOptions.length} selected for this quotation</small>
                    <div>
                      {requirementUnitOptions.map((unitCode) => (
                        <label key={unitCode}>
                          <input
                            type="checkbox"
                            checked={selectedLiftUnitCodes.has(unitCode)}
                            onChange={(event) => toggleRequirementUnit(unitCode, event.target.checked)}
                          />
                          <span>{unitCode}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
              </div>
            )}
            <MaterialScopeEditor
              initialMaterials={initialMaterials}
              unitCodes={quoteUnitCodes}
              templates={templates}
              taxRules={taxRules}
              onCreateTemplate={onCreateTemplate}
            />
            <QuotationTermsEditor
              initialTerms={initialTerms}
              templates={termsTemplates}
              initialTemplateId={initialTemplateId}
              stagePaymentsEnabled={supportsStagePayments(purpose)}
            />
            <label>
              Manual total (INR)
              <input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional when material prices are entered"
                defaultValue={initialAmount}
              />
              <small>
                If priced material lines are present, their total is used.
              </small>
            </label>
          </div>
          <div className="provider-form-actions quotation-form-actions">
            <Button type="button" variant="quiet" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" busy={busy} disabled={busy || (isCreate && !relationshipLookupOptions.length)}>
              {busy
                ? "Saving…"
                : isCreate
                  ? "Create draft"
                  : isRevision
                    ? "Create revision"
                    : "Save draft"}
            </Button>
          </div>
        </form>
      </section>
    </section>
  );
}

const journeyLabel = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const journeyTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Time unavailable";
const dateInputValue = (value: Date) =>
  new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
const quotationLeadId = (quotation: Resource<GenericAttributes> | null) => {
  const relationship = quotation?.relationships.marketing_lead;
  return relationship && !Array.isArray(relationship) ? relationship.id : null;
};
const sortQuotationActivities = (rows: Resource<GenericAttributes>[]) =>
  [...rows].sort(
    (left, right) =>
      new Date(
        String(left.attributes.occurred_at || left.attributes.created_at || 0),
      ).getTime() -
      new Date(
        String(
          right.attributes.occurred_at || right.attributes.created_at || 0,
        ),
      ).getTime(),
  );

function amcRulePreview(plan: Resource<GenericAttributes> | undefined, context: { floors: string; capacity: string; stops: string; liftType: string; travelHeight: string; audience: string; usageClass?: string }) {
  if (!plan) return { rule: "Choose an AMC catalog", amount: null as number | null, error: "No catalog selected for this lift." };
  const version = plan.attributes.current_version && typeof plan.attributes.current_version === "object" ? plan.attributes.current_version as Record<string, unknown> : {};
  const definition = version.plan && typeof version.plan === "object" ? version.plan as Record<string, unknown> : {};
  const pricing = definition.pricing && typeof definition.pricing === "object" ? definition.pricing as Record<string, unknown> : {};
  const cards = Array.isArray(pricing.rate_cards) ? pricing.rate_cards.map((item) => item && typeof item === "object" ? item as Record<string, unknown> : {}) : [];
  const facts: Record<string, unknown> = { audience: context.audience, passenger_capacity: context.capacity, lift_type: context.liftType, number_of_stops: context.stops, travel_height_m: context.travelHeight, usage_class: context.usageClass };
  const matches = (rule: Record<string, unknown>) => Object.entries(rule).every(([key, expected]) => {
    const actual = facts[key];
    if (Array.isArray(expected)) return expected.map(String).includes(String(actual));
    if (expected && typeof expected === "object") {
      const range = expected as Record<string, unknown>;
      if (actual === undefined || actual === null || String(actual).trim() === "") return false;
      const number = Number(actual);
      return Number.isFinite(number) && (range.min == null || number >= Number(range.min)) && (range.max == null || number <= Number(range.max));
    }
    return String(actual || "").toUpperCase() === String(expected || "").toUpperCase();
  });
  if (cards.length) {
    const matched = cards.find((card) => {
      const dimensions = card.match && typeof card.match === "object" ? card.match as Record<string, unknown> : {};
      return matches(dimensions);
    });
    if (!matched) return { rule: "No matching price rule", amount: null, error: "This lift does not match a pricing rule in the selected catalog." };
    const base = matched.base && typeof matched.base === "object" ? matched.base as Record<string, unknown> : {};
    const floors = Number(context.floors);
    const includedFloors = Number(base.included_floors_above_ground || 4);
    if (!Number.isFinite(floors) || floors < includedFloors) return { rule: "Matched rule · floor details need review", amount: null, error: `This rule requires at least G+${includedFloors} floors.` };
    let amount = Number(base.amount || 0);
    let coveredThrough = includedFloors;
    const bands = (Array.isArray(matched.floor_rates) ? matched.floor_rates : []).map((item) => item as Record<string, unknown>).sort((left, right) => Number(left.from || 0) - Number(right.from || 0));
    for (const band of bands) {
      const from = Number(band.from || 0);
      const to = band.to == null || band.to === "" ? floors : Number(band.to);
      const first = Math.max(from, coveredThrough + 1);
      const last = Math.min(to, floors);
      if (last < first) continue;
      amount += (last - first + 1) * Number(band.amount_per_floor || 0);
      coveredThrough = last;
    }
    if (coveredThrough < floors) return { rule: "Matched rule · floor band incomplete", amount: null, error: "The selected catalog does not price every floor for this lift." };
    const labels: Record<string, string> = { audience: "Audience", passenger_capacity: "Capacity", lift_type: "Lift type", number_of_stops: "Stops", travel_height_m: "Travel height", usage_class: "Usage" };
    const typeLabels: Record<string, string> = { PASSENGER_TRACTION: "Passenger traction lift", PASSENGER_MRL: "Machine-room-less passenger lift", HOME_VILLA_LIFT: "Home and villa lift", HYDRAULIC_PASSENGER: "Hydraulic passenger lift", SERVICE_LIFT: "Service lift", HOSPITAL_BED_LIFT: "Hospital and bed lift", STRETCHER_LIFT: "Stretcher lift", GOODS_PASSENGER_LIFT: "Goods and passenger lift", INDUSTRIAL_FREIGHT_LIFT: "Industrial freight lift", CAR_LIFT: "Vehicle and car lift", DUMBWAITER: "Dumbwaiter", PLATFORM_LIFT: "Vertical platform lift", STAIR_CHAIR_LIFT: "Stairway chair lift", FIRE_EMERGENCY_LIFT: "Firefighter and emergency lift", EVACUATION_LIFT: "Occupant evacuation lift", ESCALATOR: "Escalator", MOVING_WALK: "Moving walk and travelator" };
    const matchSummary = Object.entries((matched.match || {}) as Record<string, unknown>).map(([key, value]) => {
      const humanize = (item: unknown) => key === "lift_type" ? typeLabels[String(item)] || String(item).replaceAll("_", " ").toLowerCase() : key === "audience" ? String(item).toUpperCase() === "RESIDENTIAL" ? "Residential community" : "Commercial building" : String(item).replaceAll("_", " ").toLowerCase();
      const shown = Array.isArray(value) ? value.map(humanize).join(" / ") : value && typeof value === "object" ? `${(value as Record<string, unknown>).min ?? "any"}–${(value as Record<string, unknown>).max ?? "any"}` : humanize(value);
      return `${labels[key] || key.replaceAll("_", " ")} ${shown}${key === "passenger_capacity" ? " passengers" : key === "number_of_stops" ? " stops" : key === "travel_height_m" ? " m" : ""}`;
    }).join(" · ");
    return { rule: `Matched rule · ${matchSummary || "catalog default"}`, amount, error: "" };
  }
  const eligibility = definition.eligibility && typeof definition.eligibility === "object" ? definition.eligibility as Record<string, unknown> : {};
  const baseFloors = Number(pricing.base_floors || eligibility.base_floors || 4);
  const floors = Number(context.floors);
  const amount = Number(pricing.base_price || version.base_price || 0) + Math.max(floors - baseFloors, 0) * Number(pricing.additional_floor_price || 0);
  return Number.isFinite(amount) && Number.isFinite(floors) ? { rule: "Legacy catalog pricing", amount, error: "" } : { rule: "Pricing needs review", amount: null, error: "Pricing context is incomplete." };
}

function ProviderAmcQuotationCreatePage({ providerId, relationshipOptions }: { providerId: string; relationshipOptions: Array<{ id: string; label: string }> }) {
  type LiftContext = { floors: string; capacity: string; stops: string; liftType: string; travelHeight: string; usageClass: string; audience: "RESIDENTIAL" | "COMMERCIAL" };
  const [step, setStep] = useState(0);
  const [relationshipId, setRelationshipId] = useState("");
  const [assets, setAssets] = useState<Resource<GenericAttributes>[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [contexts, setContexts] = useState<Record<string, LiftContext>>({});
  const [plans, setPlans] = useState<Collection<GenericAttributes> | null>(null);
  const [planIdsByAsset, setPlanIdsByAsset] = useState<Record<string, string>>({});
  const [bulkPlanId, setBulkPlanId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(dateInputValue(new Date()));
  const [effectiveTo, setEffectiveTo] = useState(dateInputValue(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)));
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [specificationStatus, setSpecificationStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const equipmentCode = (asset: Resource<GenericAttributes>) => {
    const primary = asset.attributes.primary_identifier && typeof asset.attributes.primary_identifier === "object" ? asset.attributes.primary_identifier as Record<string, unknown> : {};
    const identifiers = Array.isArray(asset.attributes.identifiers) ? asset.attributes.identifiers as Array<Record<string, unknown>> : [];
    const identifiedCode = identifiers.find((identifier) => String(identifier.identifier_type_code || "").toUpperCase() === "EQUIPMENT_CODE");
    return String(asset.attributes.equipment_code || (String(primary.identifier_type_code || "").toUpperCase() === "EQUIPMENT_CODE" ? primary.value : "") || identifiedCode?.value || "");
  };
  const assetCode = (asset: Resource<GenericAttributes>) => equipmentCode(asset) || String(asset.attributes.asset_code || asset.attributes.code || asset.attributes.name || `Lift ${asset.id.slice(0, 8)}`);
  useEffect(() => { let active = true; operationsData.providerAmcPlans(providerId, "ACTIVE").then((result) => { if (active) setPlans(result); }).catch((cause) => { if (active) setError((cause as Error).message || "Published AMC plans could not be loaded."); }); return () => { active = false; }; }, [providerId]);
  useEffect(() => {
    if (!relationshipId) { setAssets([]); setSelectedAssetIds([]); setContexts({}); setPlanIdsByAsset({}); setSpecificationStatus(""); return; }
    let active = true;
    setLoadingAssets(true); setAssets([]); setSelectedAssetIds([]); setContexts({}); setPlanIdsByAsset({});
    setSpecificationStatus("");
    operationsData.assets(providerId, { customerRelationshipId: relationshipId, limit: 100 }).then((result) => {
      if (!active) return;
      const next = result.data;
      setAssets(next); setSelectedAssetIds(next.map((asset) => asset.id));
      const initialContexts = Object.fromEntries(next.map((asset) => [asset.id, {
        floors: String(asset.attributes.served_floors_above_ground || asset.attributes.floors_above_ground || ""),
        capacity: String(asset.attributes.passenger_capacity || asset.attributes.passenger_capacity_count || ""),
        stops: String(asset.attributes.number_of_stops || asset.attributes.stops || ""),
        liftType: String(asset.attributes.equipment_type_code || asset.attributes.lift_type || ""),
        travelHeight: String(asset.attributes.travel_height_m || ""),
        usageClass: String(asset.attributes.usage_class || ""),
        audience: String(asset.attributes.audience || "").toUpperCase() === "RESIDENTIAL" ? "RESIDENTIAL" : "COMMERCIAL",
      }])) as Record<string, LiftContext>;
      setContexts(initialContexts);
      if (!next.length) { setSpecificationStatus("No lifts are linked to this customer."); return; }
      void (async () => {
        try {
          const cases = await operationsData.serviceCases(providerId, { limit: 100 });
          if (!active) return;
          const selectedIds = new Set(next.map((asset) => asset.id));
          const projects = cases.data.filter((project) =>
            project.attributes.customer_relationship_id === relationshipId &&
            (project.attributes.asset_ids || project.attributes.project_assets?.map((item) => item.id) || []).some((id) => selectedIds.has(id)),
          );
          const sourceIds = [...new Set(projects.map((project) => project.attributes.source_quotation_id).filter((id): id is string => Boolean(id)))];
          const sourceQuotations = await Promise.all(sourceIds.map(async (id) => {
            try { return [id, await operationsData.quotation(providerId, id)] as const; }
            catch { return [id, null] as const; }
          }));
          if (!active) return;
          const quotationById = new Map(sourceQuotations);
          const toRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
          const text = (record: Record<string, unknown>, keys: string[]) => {
            for (const key of keys) {
              const value = record[key];
              if (value !== null && value !== undefined && String(value).trim() !== "") return String(value);
            }
            return "";
          };
          const projectValues: Record<string, Partial<LiftContext>> = {};
          for (const project of projects) {
            const quotation = quotationById.get(project.attributes.source_quotation_id || "");
            if (!quotation) continue;
            const quotationAttributes = quotation.attributes;
            const scope = toRecord(quotationAttributes.requirement_scope);
            const shared = toRecord(scope.requirements || quotationAttributes.requirements);
            const units = Array.isArray(scope.units) ? scope.units.map(toRecord) : Array.isArray(shared.units) ? shared.units.map(toRecord) : [];
            const projectAssetIds = project.attributes.asset_ids || project.attributes.project_assets?.map((item) => item.id) || [];
            for (const asset of next.filter((item) => projectAssetIds.includes(item.id))) {
              const code = assetCode(asset).toLowerCase();
              const unit = units.find((item) => [item.asset_id, item.asset_code, item.unit_code, item.equipment_code, item.label, item.name].some((value) => {
                const candidate = String(value || "").toLowerCase();
                return candidate === asset.id.toLowerCase() || candidate === code;
              }))
                || (units.length === 1 ? units[0] : null);
              const values = { ...shared, ...toRecord(unit?.requirements), ...(unit || {}) };
              const audienceValue = text(values, ["audience", "building_audience", "building_use", "building_type"]).toUpperCase();
              const projectContext: Partial<LiftContext> = {
                floors: text(values, ["served_floors_above_ground", "floors_above_ground"]),
                // Capacity in kilograms is a rated load, not a passenger count.
                capacity: text(values, ["passenger_capacity", "passenger_capacity_count", "passenger_capacity_persons"]),
                stops: text(values, ["number_of_stops", "stops"]),
                liftType: text(values, ["equipment_type_code", "lift_type", "type"]),
                travelHeight: text(values, ["travel_height_m", "travel_height"]),
                usageClass: text(values, ["usage_class", "building_usage_class"]),
                ...(audienceValue.includes("RESIDENT") ? { audience: "RESIDENTIAL" as const } : audienceValue.includes("COMMERCIAL") ? { audience: "COMMERCIAL" as const } : {}),
              };
              const populatedContext = Object.fromEntries(Object.entries(projectContext).filter(([, value]) => Boolean(value))) as Partial<LiftContext>;
              if (Object.keys(populatedContext).length) projectValues[asset.id] = { ...projectValues[asset.id], ...populatedContext };
            }
          }
          if (Object.keys(projectValues).length) {
            setContexts((current) => Object.fromEntries(Object.entries(current).map(([id, context]) => [id, { ...context, ...projectValues[id] }])));
            setSpecificationStatus("Project specifications were loaded where available. Review the editable lift details before continuing.");
          } else {
            setSpecificationStatus("No linked project specifications were found. Available lift record details have been prefilled.");
          }
        } catch {
          if (active) setSpecificationStatus("Project specifications could not be loaded. Available lift record details are prefilled and can be edited.");
        }
      })();
    }).catch((cause) => { if (active) setError((cause as Error).message || "Customer lifts could not be loaded."); }).finally(() => { if (active) setLoadingAssets(false); });
    return () => { active = false; };
  }, [providerId, relationshipId]);
  const availablePlans = (plans?.data || []).filter((plan) => {
    const version = plan.attributes.current_version as Record<string, unknown> | undefined;
    return String(version?.status || "").toUpperCase() === "PUBLISHED" && !/^FREE_AMC(?:_|$)/i.test(String(plan.attributes.code || ""));
  });
  const chosenAssets = assets.filter((asset) => selectedAssetIds.includes(asset.id));
  const planForAsset = (assetId: string) => availablePlans.find((plan) => plan.id === planIdsByAsset[assetId]);
  const versionForPlan = (plan: Resource<GenericAttributes> | undefined) => plan?.attributes.current_version && typeof plan.attributes.current_version === "object" ? plan.attributes.current_version as Record<string, unknown> : {};
  const definitionForPlan = (plan: Resource<GenericAttributes> | undefined) => { const version = versionForPlan(plan); return version.plan && typeof version.plan === "object" ? version.plan as Record<string, unknown> : {}; };
  const planNeedsUsageClass = (plan: Resource<GenericAttributes> | undefined) => {
    const pricing = definitionForPlan(plan).pricing;
    const cards = pricing && typeof pricing === "object" ? (pricing as Record<string, unknown>).rate_cards : undefined;
    return Array.isArray(cards) && cards.some((item) => { const match = item && typeof item === "object" ? (item as Record<string, unknown>).match : undefined; return match && typeof match === "object" && "usage_class" in match; });
  };
  const previewForAsset = (asset: Resource<GenericAttributes>) => amcRulePreview(planForAsset(asset.id), contexts[asset.id] || { floors: "", capacity: "", stops: "", liftType: "", travelHeight: "", usageClass: "", audience: "COMMERCIAL" });
  const estimateRows = chosenAssets.map((asset) => ({ asset, plan: planForAsset(asset.id), preview: previewForAsset(asset) }));
  const estimateTotal = estimateRows.every((row) => row.preview.amount !== null && !row.preview.error) ? estimateRows.reduce((sum, row) => sum + (row.preview.amount || 0), 0) : null;
  function toggleAsset(assetId: string, checked: boolean) { setSelectedAssetIds((current) => checked ? [...new Set([...current, assetId])] : current.filter((id) => id !== assetId)); }
  function setPlanForAsset(assetId: string, selectedPlanId: string) { setPlanIdsByAsset((current) => ({ ...current, [assetId]: selectedPlanId })); }
  function applyPlanToSelectedAssets() { if (bulkPlanId) setPlanIdsByAsset((current) => Object.fromEntries([...new Set([...Object.keys(current), ...chosenAssets.map((asset) => asset.id)])].map((id) => [id, selectedAssetIds.includes(id) ? bulkPlanId : current[id] || ""]))); }
  function continueStep() {
    setError("");
    if (step === 0 && (!relationshipId || chosenAssets.length === 0)) { setError("Select a customer and at least one associated lift."); return; }
    if (step === 1 && chosenAssets.some((asset) => !planForAsset(asset.id))) { setError("Choose a published AMC catalog for every selected lift. You can use the same catalog or assign different catalogs lift by lift."); return; }
    if (step === 2 && (!effectiveFrom || !effectiveTo || effectiveTo <= effectiveFrom || chosenAssets.some((asset) => !contexts[asset.id]?.capacity || !contexts[asset.id]?.floors))) { setError("Enter a valid term and the passenger capacity and floors for every selected lift."); return; }
    if (step === 2 && estimateRows.some((row) => row.preview.error)) { setError(estimateRows.find((row) => row.preview.error)?.preview.error || "Fix the catalog pricing match before continuing."); return; }
    setStep((value) => Math.min(3, value + 1));
  }
  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!relationshipId || chosenAssets.length === 0 || chosenAssets.some((asset) => !planForAsset(asset.id) || !versionForPlan(planForAsset(asset.id)).id)) return;
    setBusy(true); setError("");
    try {
      const from = `${effectiveFrom}T00:00:00Z`; const to = `${effectiveTo}T00:00:00Z`;
      const termsForm = new FormData(event.currentTarget);
      const terms = quotationTermsForApi({ effective_from: from, effective_to: to, paid_renewal: false, included_free_amc: { months: 0 } }, quotationTermSelectionFromForm(termsForm), false);
      terms.included_free_amc = { months: 0 };
      const created = await operationsData.createQuotation(providerId, {
        customer_relationship_id: relationshipId,
        purpose: "MAINTENANCE_CONTRACT",
        terms,
        currency: "INR",
        lines: chosenAssets.map((asset) => {
          const context = contexts[asset.id];
          const selectedPlan = planForAsset(asset.id);
          const selectedVersion = versionForPlan(selectedPlan);
          return { description: `${String(selectedPlan?.attributes.name || "AMC")} · ${String(asset.attributes.name || assetCode(asset))}`, quantity: 1, provider_service_plan_version_id: String(selectedVersion.id), asset_id: asset.id, pricing_context: { served_floors_above_ground: Number(context.floors), passenger_capacity: Number(context.capacity), ...(context.stops ? { number_of_stops: Number(context.stops) } : {}), audience: context.audience, ...(context.liftType ? { lift_type: context.liftType.toUpperCase() } : {}), ...(context.travelHeight ? { travel_height_m: Number(context.travelHeight) } : {}), ...(context.usageClass ? { usage_class: context.usageClass.toUpperCase() } : {}) } };
        }),
      }, crypto.randomUUID());
      window.location.hash = `quotations/${created.id}`;
    } catch (cause) { setError((cause as Error).message || "AMC quotation draft could not be created."); } finally { setBusy(false); }
  }
  const steps = ["Customer & lifts", "Catalog per lift", "Term & lift details", "Review"];
  return <section className="quotation-form-page amc-quotation-page" aria-label="New AMC quotation"><PageHeader eyebrow="Sales & Marketing · AMC" title="New AMC quotation" description="Choose the customer’s lifts and a published plan. The selected plan supplies the coverage and the server calculates each lift’s price." action={<Button type="button" variant="secondary" onClick={() => { window.location.hash = "quotations/new"; }}>Cancel</Button>} /><section className="quotation-form-shell detail-card"><div className="quotation-form-intro"><div><span className="eyebrow">Step {step + 1} of 4</span><h2>{steps[step]}</h2></div><p className="notice">{["Select a customer to load their associated lifts.", "Choose the published AMC plan to apply to this quote.", "Check the term and fill any pricing details missing from the lift record.", "Review each lift and plan coverage before creating the draft."][step]}</p></div><nav className="amc-form-steps" aria-label="AMC quotation setup">{steps.map((label, index) => <button type="button" key={label} className={index === step ? "is-active" : index < step ? "is-complete" : ""} onClick={() => { if (index < step) setStep(index); }}><span>{index < step ? "✓" : index + 1}</span>{label}</button>)}</nav><form className="amc-quotation-steps-form" onSubmit={(event) => { event.preventDefault(); if (step < 3) continueStep(); else void createDraft(event); }}>
    {step === 0 && <div className="amc-quotation-step-grid"><label>Customer relationship *<SortedSelect required value={relationshipId} onChange={(event) => setRelationshipId(event.target.value)}><option value="">Select customer</option>{relationshipOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SortedSelect></label><fieldset className="quotation-associated-lifts"><legend>Associated lifts</legend><p>Lifts linked to this customer are selected by default. Each E-Code identifies the registered equipment asset; the quotation keeps the underlying asset link.</p>{loadingAssets ? <p role="status">Loading customer lifts…</p> : assets.length ? <div>{assets.map((asset) => <label key={asset.id}><input type="checkbox" checked={selectedAssetIds.includes(asset.id)} onChange={(event) => toggleAsset(asset.id, event.target.checked)} /><span><strong>{String(asset.attributes.display_name || asset.attributes.name || assetCode(asset))}</strong><small>{equipmentCode(asset) ? `E-Code · ${equipmentCode(asset)}` : `Asset code · ${assetCode(asset)}`}</small></span></label>)}</div> : relationshipId ? <p>No elevator assets are linked to this customer.</p> : <p>Select a customer to load their lifts.</p>}</fieldset></div>}
    {step === 1 && <div className="amc-quotation-step-grid"><div className="amc-plan-bulk-apply"><label>Apply one catalog to selected lifts<SortedSelect value={bulkPlanId} onChange={(event) => setBulkPlanId(event.target.value)} disabled={!plans}><option value="">{plans ? "Select a published catalog" : "Loading catalogs…"}</option>{availablePlans.map((plan) => <option key={plan.id} value={plan.id}>{String(plan.attributes.name || "AMC plan")} · v{String((plan.attributes.current_version as Record<string, unknown> | undefined)?.version || "1")}</option>)}</SortedSelect></label><Button type="button" variant="secondary" disabled={!bulkPlanId || !chosenAssets.length} onClick={applyPlanToSelectedAssets}>Apply to all selected lifts</Button><small>Use one catalog for every lift, or choose a different catalog below for any lift.</small></div>{chosenAssets.map((asset) => { const selectedPlan = planForAsset(asset.id); const definition = definitionForPlan(selectedPlan); const entitlements = definition.entitlements && typeof definition.entitlements === "object" ? definition.entitlements as Record<string, unknown> : {}; const includedItems = Array.isArray(definition.included) ? definition.included.map(String) : []; const excludedItems = Array.isArray(definition.excluded) ? definition.excluded.map(String) : []; return <fieldset className="amc-lift-catalog-assignment" key={asset.id}><legend>{String(asset.attributes.display_name || asset.attributes.name || assetCode(asset))} · {equipmentCode(asset) ? `E-Code ${equipmentCode(asset)}` : assetCode(asset)}</legend><label>AMC catalog for this lift *<SortedSelect value={planIdsByAsset[asset.id] || ""} onChange={(event) => setPlanForAsset(asset.id, event.target.value)} disabled={!plans}><option value="">{plans ? "Select a published catalog" : "Loading catalogs…"}</option>{availablePlans.map((plan) => <option key={plan.id} value={plan.id}>{String(plan.attributes.name || "AMC plan")} · v{String((plan.attributes.current_version as Record<string, unknown> | undefined)?.version || "1")}</option>)}</SortedSelect></label>{selectedPlan && <div className="amc-lift-catalog-summary"><strong>{String(selectedPlan.attributes.name || "AMC plan")} · {String(entitlements.preventive_frequency || "Frequency not set").replaceAll("_", " ")} · {String(entitlements.scheduled_visits || "—")} visits / year · {String(entitlements.breakdown_callbacks || "—")} callbacks</strong><div><span>Included</span><p>{includedItems.join(" · ") || "No included items listed"}</p></div><div><span>Excluded / chargeable</span><p>{excludedItems.join(" · ") || "No exclusions listed"}</p></div></div>}</fieldset>; })}{plans && availablePlans.length === 0 && <p className="notice">No published paid AMC catalogs are available. Publish an approved plan before creating an AMC quotation.</p>}</div>}
    {step === 2 && <div className="amc-quotation-step-grid"><div className="quotation-renewal-date-grid"><label>Effective from *<input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} required /></label><label>Effective to *<input type="date" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} required /></label></div><p className="amc-context-hint">{specificationStatus || "Loading project specifications…"} Each lift is checked against its assigned catalog’s Type, Audience, passenger capacity, stops, floors and travel height rules.</p>{chosenAssets.map((asset) => { const plan = planForAsset(asset.id); const preview = previewForAsset(asset); return <fieldset className="amc-lift-context" key={asset.id}><legend>{String(asset.attributes.name || assetCode(asset))} · {equipmentCode(asset) ? `E-Code ${equipmentCode(asset)}` : assetCode(asset)}</legend><small className="amc-lift-assigned-catalog">Catalog: {String(plan?.attributes.name || "Not selected")}</small><div><label>Audience *<SortedSelect value={contexts[asset.id]?.audience || "COMMERCIAL"} onChange={(event) => setContexts((current) => ({ ...current, [asset.id]: { ...current[asset.id], audience: event.target.value as LiftContext["audience"] } }))}><option value="RESIDENTIAL">Residential community</option><option value="COMMERCIAL">Commercial building</option></SortedSelect></label><label>Passenger capacity *<input type="number" min="1" value={contexts[asset.id]?.capacity || ""} onChange={(event) => setContexts((current) => ({ ...current, [asset.id]: { ...current[asset.id], capacity: event.target.value } }))} /></label><label>Floors above ground *<input type="number" min="1" value={contexts[asset.id]?.floors || ""} onChange={(event) => setContexts((current) => ({ ...current, [asset.id]: { ...current[asset.id], floors: event.target.value } }))} /></label><label>Stops<input type="number" min="1" value={contexts[asset.id]?.stops || ""} onChange={(event) => setContexts((current) => ({ ...current, [asset.id]: { ...current[asset.id], stops: event.target.value } }))} /></label><label>Lift type<SortedSelect value={contexts[asset.id]?.liftType || ""} onChange={(event) => setContexts((current) => ({ ...current, [asset.id]: { ...current[asset.id], liftType: event.target.value } }))}><option value="">Select lift type</option><option value="PASSENGER_TRACTION">Passenger traction lift</option><option value="PASSENGER_MRL">Machine-room-less passenger lift</option><option value="HOME_VILLA_LIFT">Home and villa lift</option><option value="HYDRAULIC_PASSENGER">Hydraulic passenger lift</option><option value="SERVICE_LIFT">Service lift</option><option value="HOSPITAL_BED_LIFT">Hospital and bed lift</option><option value="STRETCHER_LIFT">Stretcher lift</option><option value="GOODS_PASSENGER_LIFT">Goods and passenger lift</option><option value="INDUSTRIAL_FREIGHT_LIFT">Industrial freight lift</option><option value="CAR_LIFT">Vehicle and car lift</option><option value="DUMBWAITER">Dumbwaiter</option><option value="PLATFORM_LIFT">Vertical platform lift</option><option value="STAIR_CHAIR_LIFT">Stairway chair lift</option><option value="FIRE_EMERGENCY_LIFT">Firefighter and emergency lift</option><option value="EVACUATION_LIFT">Occupant evacuation lift</option><option value="ESCALATOR">Escalator</option><option value="MOVING_WALK">Moving walk and travelator</option></SortedSelect></label>{planNeedsUsageClass(plan) && <label>Usage class *<input value={contexts[asset.id]?.usageClass || ""} onChange={(event) => setContexts((current) => ({ ...current, [asset.id]: { ...current[asset.id], usageClass: event.target.value } }))} placeholder="e.g. passenger" /></label>}<label>Travel height (m)<input type="number" min="0.1" step="0.1" value={contexts[asset.id]?.travelHeight || ""} onChange={(event) => setContexts((current) => ({ ...current, [asset.id]: { ...current[asset.id], travelHeight: event.target.value } }))} /></label></div><div className={`amc-lift-price-match${preview.error ? " has-error" : ""}`}><span>{preview.rule}</span>{preview.amount !== null && <strong>{formatMoneyForQuotation(preview.amount)} / year before GST</strong>}{preview.error && <small>{preview.error}</small>}</div></fieldset>; })}</div>}
    {step === 3 && <div className="amc-quotation-review"><section><h3>Customer &amp; covered lifts</h3><p>{relationshipOptions.find((item) => item.id === relationshipId)?.label || "Customer not selected"}</p>{estimateRows.map(({ asset, plan, preview }) => <div className="amc-quote-lift-review" key={asset.id}><strong>{String(asset.attributes.name || assetCode(asset))} · {equipmentCode(asset) ? `E-Code ${equipmentCode(asset)}` : assetCode(asset)}</strong><span>{contexts[asset.id]?.capacity || "—"} passengers · {contexts[asset.id]?.floors || "—"} floors · {contexts[asset.id]?.stops || "—"} stops</span><span>Catalog: {String(plan?.attributes.name || "Not selected")} · {preview.rule}</span>{plan && <span>Scope: {Array.isArray(definitionForPlan(plan).included) ? (definitionForPlan(plan).included as unknown[]).map(String).join(" · ") : "Included work follows this catalog"} · Exclusions: {Array.isArray(definitionForPlan(plan).excluded) ? (definitionForPlan(plan).excluded as unknown[]).map(String).join(" · ") : "see catalog terms"}</span>}<b>{preview.amount === null ? "Price needs review" : `${formatMoneyForQuotation(preview.amount)} / year before GST`}</b></div>)}</section><section><h3>Term &amp; estimate</h3><p>{chosenAssets.length} lift(s) · {effectiveFrom} to {effectiveTo}</p><p><strong>Estimated subtotal before GST:</strong> {estimateTotal === null ? "Resolve unmatched pricing rules" : formatMoneyForQuotation(estimateTotal)}</p><p>Each lift uses its assigned published catalog. Included work, exclusions, visits, callbacks and terms follow that catalog; each catalog version is retained on the quote line and contract asset scope.</p></section><p className="notice">The subtotal above previews the matched catalog rules before tax. Create the draft to let the server calculate authoritative line amounts, discounts and tax. Then review the full total in customer preview/PDF before issuing.</p></div>}
    {error && <p className="notice state-error" role="alert">{error}</p>}<div className="provider-form-actions">{step === 0 ? <Button type="button" variant="secondary" onClick={() => { window.location.hash = "quotations/new"; }}>Cancel</Button> : <Button type="button" variant="secondary" onClick={() => { setError(""); setStep((value) => Math.max(0, value - 1)); }}>Back</Button>}{step < 3 ? <Button type="button" onClick={continueStep}>Continue</Button> : <Button type="submit" busy={busy} disabled={busy || !chosenAssets.length || chosenAssets.some((asset) => !planForAsset(asset.id))}>Create draft quotation</Button>}</div></form></section></section>;
}

function formatMoneyForQuotation(value: unknown) { const amount = Number(value); return Number.isFinite(amount) ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount) : "Price on review"; }

export function QuotationsWorkspace({
  providerId,
  initialQuotationId,
  initialCreate = false,
  initialTemplateId,
  initialPurpose,
}: Props) {
  const { session } = useAuth();
  const [quotations, setQuotations] =
    useState<Collection<GenericAttributes> | null>(null);
  const [leads, setLeads] = useState<Collection<GenericAttributes> | null>(
    null,
  );
  const [relationships, setRelationships] =
    useState<Collection<GenericAttributes> | null>(null);
  const [relationshipsLoading, setRelationshipsLoading] = useState(false);
  const [relationshipsError, setRelationshipsError] = useState("");
  const [loadingMoreRelationships, setLoadingMoreRelationships] = useState(false);
  const [contracts, setContracts] =
    useState<Collection<GenericAttributes> | null>(null);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractsError, setContractsError] = useState(false);
  const [amcPlans, setAmcPlans] =
    useState<Collection<GenericAttributes> | null>(null);
  const [amcAssets, setAmcAssets] =
    useState<Collection<GenericAttributes> | null>(null);
  const [convertedContract, setConvertedContract] =
    useState<Resource<GenericAttributes> | null>(null);
  const [selected, setSelected] = useState<Resource<GenericAttributes> | null>(
    null,
  );
  const [selectedJourney, setSelectedJourney] =
    useState<ProviderWorkJourney | null>(null);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const moreActionsRef = useRef<HTMLDetailsElement>(null);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journeyError, setJourneyError] = useState("");
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [scheduledFollowUpOpen, setScheduledFollowUpOpen] = useState(false);
  const [followUpActivities, setFollowUpActivities] = useState<
    Resource<GenericAttributes>[]
  >([]);
  const [followUpLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pageCursor, setPageCursor] = useState<{
    after?: string;
    before?: string;
    filterKey?: string;
  }>({});
  const pageLimit = DEFAULT_PAGE_SIZE;
  const [queryText, setQueryText] = useState("");
  const [debouncedQueryText, setDebouncedQueryText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const roleContext = session?.providerCapabilities
    .find((context) => context.providerId === providerId)
    ?.roleContext?.toUpperCase();
  const canAbandon = Boolean(
    session?.platformAdmin ||
    [
      "PROVIDER_ADMIN",
      "ADMIN",
      "MARKETING_MANAGER",
      "OPERATIONS_REVIEWER",
    ].includes(roleContext || ""),
  );
  const canLinkQuotationJourney = Boolean(
    session?.providerCapabilities.some(
      (context) =>
        context.providerId === providerId &&
        context.capabilities.includes("quotations"),
    ),
  );
  const [quotationSearchMode, setQuotationSearchMode] = useState<"quotation" | "quotation_id" | "email" | "phone">("quotation");
  const [debouncedQuotationSearchMode, setDebouncedQuotationSearchMode] = useState<"quotation" | "quotation_id" | "email" | "phone">("quotation");
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [renewalFormPredecessorId, setRenewalFormPredecessorId] = useState("");
  const [initialAmcOpen, setInitialAmcOpen] = useState(false);
  const [detailDialog, setDetailDialog] = useState<
    "edit" | "revision" | "negotiation" | "customer-preview" | "customer-change" | null
  >(null);
  const [customerChangeRelationshipId, setCustomerChangeRelationshipId] = useState("");
  const [customerChangeSearch, setCustomerChangeSearch] = useState("");
  const [customerChangeReason, setCustomerChangeReason] = useState("");
  const [quotationPdfPreviewUrl, setQuotationPdfPreviewUrl] = useState("");
  useEffect(() => {
    if (!moreActionsOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!moreActionsRef.current?.contains(event.target as Node)) {
        if (moreActionsRef.current) moreActionsRef.current.open = false;
        setMoreActionsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (moreActionsRef.current) moreActionsRef.current.open = false;
        setMoreActionsOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreActionsOpen]);
  useEffect(() => {
    if (!quotationPdfPreviewUrl) return;
    return () => URL.revokeObjectURL(quotationPdfPreviewUrl);
  }, [quotationPdfPreviewUrl]);
  const [reviewDialog, setReviewDialog] = useState<"approve" | "reject" | null>(
    null,
  );
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryChannel, setDeliveryChannel] = useState<QuotationDeliveryChannel>("EMAIL");
  const [deliveryRecipientMode, setDeliveryRecipientMode] = useState<"saved" | "manual">("saved");
  const [deliveryRecipients, setDeliveryRecipients] = useState<
    Array<{ id: string; display_name: string; email?: string | null; phone?: string | null }>
  >([]);
  const [deliveryHistory, setDeliveryHistory] =
    useState<Collection<GenericAttributes> | null>(null);
  const [effectivePermissions, setEffectivePermissions] = useState<
    string[] | null
  >(null);
  const [materialScopeTemplates, setMaterialScopeTemplates] = useState<
    Resource<MaterialScopeTemplateAttributes>[]
  >([]);
  const [quotationTermsTemplates, setQuotationTermsTemplates] = useState<
    Resource<QuotationTermsTemplateAttributes>[]
  >([]);
  const [quotationPreviewLogoUrl, setQuotationPreviewLogoUrl] = useState("");
  const [quotationTaxRules, setQuotationTaxRules] = useState<QuotationTaxRule[]>(
    [],
  );
  const [activeDetailTab, setActiveDetailTab] = useState<
    "overview" | "quoted" | "commercial" | "review"
  >("overview");
  const [openMaterialDetailIndex, setOpenMaterialDetailIndex] = useState(0);
  const renewalFormPredecessor = contracts?.data.find(
    (item) => item.id === renewalFormPredecessorId,
  );
  const renewalFormCustomerRelationship =
    renewalFormPredecessor?.relationships.customer_relationship;
  const renewalFormAssets = amcAssets?.data.filter((item) => {
    const relationship = item.relationships.customer_relationship;
    return Boolean(
      renewalFormCustomerRelationship &&
        !Array.isArray(renewalFormCustomerRelationship) &&
        relationship &&
        !Array.isArray(relationship) &&
        relationship.id === renewalFormCustomerRelationship.id,
    );
  }) || [];
  const automaticQuotationSelection = useRef(true);
  const quotationListRequestId = useRef(0);
  const quotationListInFlight = useRef<{
    key: string;
    promise: Promise<Collection<GenericAttributes>>;
  } | null>(null);
  const relationshipPageRequest = useRef<{
    providerId: string;
    promise: Promise<Collection<GenericAttributes>>;
  } | null>(null);
  const relationshipNextPage = useRef<string | null>(null);
  const relationshipPageLoading = useRef(false);
  const leadRequest = useRef<{
    providerId: string;
    promise: Promise<Collection<GenericAttributes>>;
  } | null>(null);
  const contractRequest = useRef<{
    providerId: string;
    promise: Promise<Collection<GenericAttributes>>;
  } | null>(null);
  const quotationConfigurationRequest = useRef<{
    providerId: string;
    promise: Promise<[
      Collection<MaterialScopeTemplateAttributes>,
      Collection<QuotationTermsTemplateAttributes>,
      Collection<QuotationTaxRuleAttributes>,
    ]>;
  } | null>(null);

  useEffect(() => {
    let active = true;
    setEffectivePermissions(null);
    if (!session?.userId) return;
    void accessData
      .selfEffectivePermissions(providerId)
      .then((preview) => {
        if (active)
          setEffectivePermissions(
            preview.data.attributes.membership_active
              ? preview.data.attributes.permissions
                  .filter((permission) => permission.grant_effective)
                  .map((permission) => permission.code)
              : [],
          );
      })
      .catch(() => {
        if (active) setEffectivePermissions([]);
      });
    return () => {
      active = false;
    };
  }, [providerId, session?.userId]);

  const hasPermission = (code: string) =>
    effectivePermissions?.includes(code) === true;

  const quotationFilterKey = JSON.stringify([
    debouncedQueryText.trim(),
    statusFilter,
    debouncedQuotationSearchMode,
    pageLimit,
  ]);
  const activePageCursor = pageCursor.filterKey === quotationFilterKey
    ? { after: pageCursor.after, before: pageCursor.before }
    : {};

  const reload = useCallback((forceRefresh = false) => {
    const searchTerm = debouncedQueryText.trim();
    const searchDigits = searchTerm.replace(/\D/g, "").length;
    if (
      searchTerm &&
      ((debouncedQuotationSearchMode === "quotation_id" && searchTerm.length < 3) ||
        (debouncedQuotationSearchMode === "email" && searchTerm.length < 3) ||
        (debouncedQuotationSearchMode === "phone" && (searchDigits < 3 || searchDigits > 20)))
    ) return;

    const requestId = ++quotationListRequestId.current;
    const requestKey = JSON.stringify([
      providerId,
      activePageCursor.after,
      activePageCursor.before,
      pageLimit,
      debouncedQueryText.trim(),
      statusFilter,
      debouncedQuotationSearchMode,
    ]);
    setQuotations(null);
    setError("");
    let request = !forceRefresh && quotationListInFlight.current?.key === requestKey
      ? quotationListInFlight.current.promise
      : null;
    if (!request) {
      request = operationsData.quotations(providerId, {
        ...activePageCursor,
        limit: pageLimit,
        query: debouncedQuotationSearchMode === "quotation" ? debouncedQueryText.trim() || undefined : undefined,
        status: statusFilter || undefined,
        quotationId: debouncedQuotationSearchMode === "quotation_id" ? debouncedQueryText.trim() || undefined : undefined,
        customerEmail: debouncedQuotationSearchMode === "email" && debouncedQueryText.trim().length >= 3 ? debouncedQueryText.trim() : undefined,
        customerPhone: debouncedQuotationSearchMode === "phone" && debouncedQueryText.replace(/\D/g, "").length >= 3 && debouncedQueryText.replace(/\D/g, "").length <= 20 ? debouncedQueryText : undefined,
      });
      quotationListInFlight.current = { key: requestKey, promise: request };
      void request.then(
        () => { if (quotationListInFlight.current?.promise === request) quotationListInFlight.current = null; },
        () => { if (quotationListInFlight.current?.promise === request) quotationListInFlight.current = null; },
      );
    }
    void request
      .then((quoteRows) => {
        if (requestId === quotationListRequestId.current) setQuotations(quoteRows);
      })
      .catch((cause) => {
        if (requestId === quotationListRequestId.current) setError((cause as Error).message);
      });
  }, [
    providerId,
    activePageCursor.after,
    activePageCursor.before,
    pageLimit,
    debouncedQueryText,
    statusFilter,
    debouncedQuotationSearchMode,
  ]);

  async function saveMaterialScopeTemplate(
    name: string,
    lines: QuotationMaterialLine[],
  ): Promise<Resource<MaterialScopeTemplateAttributes>> {
    const created = await operationsData.createMaterialScopeTemplate(
      providerId,
      {
        name,
        lines: lines.map((line) => ({
          description: line.description,
          category: line.category,
          quantity: line.quantity,
          unit_code: line.unit_code,
          customer_visibility: line.customer_visibility,
          default_unit_price: line.unit_price || "0",
          notes: line.notes || undefined,
          warranty_months: line.warranty_months.trim()
            ? Number(line.warranty_months)
            : undefined,
          specifications: line.specifications.trim()
            ? specificationPairsFromText(line.specifications, true)
            : undefined,
        })),
      },
      crypto.randomUUID(),
    );
    setMaterialScopeTemplates((current) => [created, ...current]);
    return created;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQueryText(queryText);
      setDebouncedQuotationSearchMode(quotationSearchMode);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [queryText, quotationSearchMode]);

  useEffect(() => {
    reload();
    return () => {
      quotationListRequestId.current += 1;
    };
  }, [reload]);

  useEffect(() => {
    setSelected(null);
    setSelectedJourney(null);
    setJourneyOpen(false);
    setFollowUpOpen(false);
    setFollowUpActivities([]);
    setActiveDetailTab("overview");
    setOpenMaterialDetailIndex(0);
    automaticQuotationSelection.current = true;
  }, [providerId, debouncedQueryText, statusFilter, debouncedQuotationSearchMode]);

  const loadMoreCustomerRelationships = useCallback(async () => {
    const after = relationshipNextPage.current;
    if (!after || relationshipPageLoading.current) return;
    relationshipPageLoading.current = true;
    setLoadingMoreRelationships(true);
    setRelationshipsError("");
    try {
      const page = await operationsData.customerRelationshipsPage(providerId, {
        after,
        limit: 100,
      });
      relationshipNextPage.current = page.page?.next || null;
      setRelationships((current) => ({
        data: [...(current?.data || []), ...page.data],
        page: page.page,
      }));
    } catch (cause) {
      setRelationshipsError((cause as Error).message || "Customer options could not be loaded.");
    } finally {
      relationshipPageLoading.current = false;
      setLoadingMoreRelationships(false);
    }
  }, [providerId]);

  useEffect(() => {
    let active = true;
    setLeads(null);
    if (!initialCreate) return;
    if (leadRequest.current?.providerId !== providerId) {
      const promise = operationsData.marketingLeads(providerId, { limit: 100 }).catch(() => ({ data: [] }));
      leadRequest.current = { providerId, promise };
    }
    void leadRequest.current.promise.then((result) => { if (active) setLeads(result); });
    return () => { active = false; };
  }, [providerId, initialCreate]);

  useEffect(() => {
    let active = true;
    if (!initialCreate) return;
    setRelationships(null);
    setContracts(null);
    setRelationshipsLoading(true);
    setRelationshipsError("");
    relationshipNextPage.current = null;
    if (relationshipPageRequest.current?.providerId !== providerId) {
      const promise = operationsData.customerRelationshipsPage(providerId, { limit: 100 }).catch(() => ({ data: [] }));
      relationshipPageRequest.current = { providerId, promise };
    }
    void relationshipPageRequest.current.promise.then((page) => {
      if (!active) return;
      setRelationships(page);
      relationshipNextPage.current = page.page?.next || null;
      setRelationshipsLoading(false);
    });
    return () => { active = false; };
  }, [providerId, initialCreate]);

  const selectedQuotationTermsForContract = selected?.attributes.terms as
    | { predecessor_contract_id?: string }
    | undefined;
  const needsMaintenanceContracts = (!initialCreate && !initialQuotationId) || renewalOpen || Boolean(
    selectedQuotationTermsForContract?.predecessor_contract_id ||
    convertedContract?.attributes.predecessor_contract_id,
  );
  useEffect(() => {
    if (!needsMaintenanceContracts) return;
    let active = true;
    setContracts(null);
    setContractsLoading(true);
    setContractsError(false);
    if (contractRequest.current?.providerId !== providerId) {
      const promise = operationsData.genericCollection(providerId, "/maintenance-contracts?page[limit]=100");
      contractRequest.current = { providerId, promise };
    }
    void contractRequest.current.promise
      .then((result) => { if (active) setContracts(result); })
      .catch(() => { if (active) { setContracts({ data: [] }); setContractsError(true); } })
      .finally(() => { if (active) setContractsLoading(false); });
    return () => { active = false; };
  }, [providerId, needsMaintenanceContracts]);

  const needsQuotationConfiguration = initialCreate || initialAmcOpen || renewalOpen || detailDialog === "edit" || detailDialog === "revision" || detailDialog === "customer-preview";
  useEffect(() => {
    if (!needsQuotationConfiguration) return;
    if (quotationConfigurationRequest.current?.providerId !== providerId) {
      const promise = Promise.all([
        operationsData.materialScopeTemplates(providerId).catch(() => ({ data: [] })),
        operationsData.quotationTermsTemplates(providerId).catch(() => ({ data: [] })),
        operationsData.quotationTaxRules(providerId).catch(() => ({ data: [] })),
      ]) as Promise<[
        Collection<MaterialScopeTemplateAttributes>,
        Collection<QuotationTermsTemplateAttributes>,
        Collection<QuotationTaxRuleAttributes>,
      ]>;
      quotationConfigurationRequest.current = { providerId, promise };
    }
    let active = true;
    void quotationConfigurationRequest.current.promise.then(([materials, terms, taxRules]) => {
      if (!active) return;
      setMaterialScopeTemplates((current) => {
        const byId = new Map(materials.data.map((template) => [template.id, template]));
        current.forEach((template) => byId.set(template.id, template));
        return Array.from(byId.values());
      });
      setQuotationTermsTemplates(terms.data);
      setQuotationTaxRules(taxRules.data);
    });
    return () => { active = false; };
  }, [providerId, needsQuotationConfiguration]);

  useEffect(() => {
    if (!renewalOpen && !initialAmcOpen) return;
    let active = true;
    void Promise.all([
      operationsData.providerAmcPlans(providerId, "ACTIVE"),
      operationsData.assets(providerId, { limit: 100 }),
    ])
      .then(([plans, assets]) => {
        if (!active) return;
        setAmcPlans(plans);
        setAmcAssets(assets);
      })
      .catch(() => {
        if (!active) return;
        setAmcPlans({ data: [] });
        setAmcAssets({ data: [] });
      });
    return () => {
      active = false;
    };
  }, [providerId, renewalOpen, initialAmcOpen]);

  useEffect(() => {
    if (!initialQuotationId) {
      setSelected(null);
      setSelectedJourney(null);
      setJourneyOpen(false);
      setFollowUpOpen(false);
      setFollowUpActivities([]);
      setActiveDetailTab("overview");
      setOpenMaterialDetailIndex(0);
      automaticQuotationSelection.current = true;
      return;
    }
    let active = true;
    setSelected(null);
    setSelectedJourney(null);
    setJourneyOpen(false);
    setFollowUpOpen(false);
    setFollowUpActivities([]);
    setActiveDetailTab("overview");
    setOpenMaterialDetailIndex(0);
    setJourneyError("");
    setError("");
    operationsData
      .quotation(providerId, initialQuotationId)
      .then((quotation) => {
        if (!active) return;
        automaticQuotationSelection.current = false;
        setSelected(quotation);
        const leadId = quotationLeadId(quotation);
        if (leadId)
          void operationsData
            .leadActivities(providerId, leadId)
            .then((activities) => {
              if (active) setFollowUpActivities(activities.data);
            })
            .catch(() => {
              if (active) setFollowUpActivities([]);
            });
        setJourneyLoading(true);
        void operationsData
          .quotationJourney(providerId, initialQuotationId)
          .then(async (journey) => {
            const hasQuotationLink = journey?.attributes.links.some(
              (link) =>
                link.resource_kind === "Quotation" &&
                link.resource_id === initialQuotationId,
            );
            let ensuredJourney = journey;
            if (canLinkQuotationJourney && (!journey || !hasQuotationLink)) {
              ensuredJourney = await operationsData.ensureQuotationJourney(
                providerId,
                initialQuotationId,
                crypto.randomUUID(),
              );
            }
            if (active) setSelectedJourney(ensuredJourney);
          })
          .catch(() => {
            if (active)
              setJourneyError("The shared journey could not be loaded.");
          })
          .finally(() => {
            if (active) setJourneyLoading(false);
          });
      })
      .catch((cause) => {
        if (active)
          setError(
            (cause as Error).message || "The quotation could not be loaded.",
          );
      });
    return () => {
      active = false;
    };
  }, [providerId, initialQuotationId, canAbandon, canLinkQuotationJourney]);

  useEffect(() => {
    let active = true;
    setQuotationPreviewLogoUrl("");
    const terms = selected?.attributes.terms;
    const letterhead = terms && typeof terms === "object" ? (terms as Record<string, unknown>).letterhead : null;
    const logo = letterhead && typeof letterhead === "object" ? (letterhead as Record<string, unknown>).logo : null;
    if (!selected || !logo || typeof logo !== "object" || (logo as Record<string, unknown>).enabled !== true) return;
    void operationsData
      .providerLogo(providerId)
      .then((result) => {
        if (active) setQuotationPreviewLogoUrl(String(result.data?.transfer?.url || ""));
      })
      .catch(() => {
        if (active) setQuotationPreviewLogoUrl("");
      });
    return () => {
      active = false;
    };
  }, [providerId, selected?.id]);

  async function openJourneyTimeline() {
    setJourneyOpen(true);
    if (selectedJourney || !selected) return;
    setJourneyLoading(true);
    setJourneyError("");
    try {
      setSelectedJourney(
        await operationsData.quotationJourney(providerId, selected.id),
      );
    } catch (cause) {
      setJourneyError(
        (cause as Error).message || "The shared journey could not be loaded.",
      );
    } finally {
      setJourneyLoading(false);
    }
  }

  useEffect(() => {
    if (!journeyOpen) return;
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(".quotation-journey-dialog")
        ?.scrollTo({ top: 0, behavior: "auto" }),
    );
  }, [journeyOpen, selectedJourney]);

  async function recordQuotationFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quotation = selected;
    const leadId = quotationLeadId(quotation);
    if (!quotation || !leadId) {
      setError(
        "Follow-up is available after a Lead is linked to this quotation.",
      );
      return;
    }
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await operationsData.createLeadActivity(
        providerId,
        leadId,
        {
          activity_type: form.get("activity_type"),
          occurred_at: form.get("occurred_at")
            ? new Date(String(form.get("occurred_at"))).toISOString()
            : undefined,
          outcome: form.get("outcome") || undefined,
          next_action: form.get("next_action") || undefined,
          notes: form.get("notes"),
          target_resource_kind: "Quotation",
          target_resource_id: quotation.id,
        },
        crypto.randomUUID(),
      );
      setFollowUpActivities(
        (await operationsData.leadActivities(providerId, leadId)).data,
      );
      setSelectedJourney(
        await operationsData.quotationJourney(providerId, quotation.id),
      );
      setFollowUpOpen(false);
      setMessage("Follow-up recorded and added to the shared journey.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createQuotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const formMaterials = quotationMaterialsFromForm(form);
      const commercial = quotationCommercialLinesAndAmount(form);
      const termSelection = quotationTermSelectionFromForm(form);
      const purpose = String(form.get("purpose") || "INSTALLATION");
      let selectedAssets: Array<{ id: string; unit_code: string }> = [];
      try {
        const parsedAssets = JSON.parse(String(form.get("associated_assets_json") || "[]"));
        if (Array.isArray(parsedAssets)) selectedAssets = parsedAssets.filter((asset): asset is { id: string; unit_code: string } => Boolean(asset) && typeof asset.id === "string" && typeof asset.unit_code === "string");
      } catch { throw new Error("The selected customer lift list could not be read. Refresh and try again."); }
      const scopedLines = commercial.lines.map((line) => {
        const lineCodes = Array.isArray(line.unit_codes) ? line.unit_codes.map(String) : [];
        const matchedAsset = lineCodes.length === 1 ? selectedAssets.find((asset) => asset.unit_code === lineCodes[0]) : undefined;
        return matchedAsset ? { ...line, asset_id: matchedAsset.id } : line;
      });
      const unitCodes = String(form.get("lift_unit_codes") || "")
        .split(",")
        .map((code) => code.trim())
        .filter(Boolean);
      if (
        !unitCodes.length ||
        unitCodes.length > 100 ||
        unitCodes.some((code) => code.length > 80) ||
        new Set(unitCodes.map((code) => code.toLowerCase())).size !==
          unitCodes.length
      ) {
        throw new Error(
          "Enter 1–100 unique lift unit codes, each no longer than 80 characters.",
        );
      }
      validateQuotationMaterialLiftAssignments(formMaterials, unitCodes);
      const materials = quotationMaterialsForApi(formMaterials);
      const effectiveFrom = new Date();
      const effectiveTo = new Date(effectiveFrom);
      effectiveTo.setDate(
        effectiveTo.getDate() +
          (termSelection.validity
            ? Math.max(1, Number(termSelection.validityDays) || 30)
            : 30),
      );
      const created = await operationsData.createQuotation(
        providerId,
        {
          customer_relationship_id: form.get("customer_relationship_id"),
          lead_id: form.get("lead_id") || undefined,
          quotation_terms_template_id: form.get("quotation_terms_template_id") || undefined,
          purpose,
          terms: quotationTermsForApi({
            elevator_units: unitCodes.map((unit_code) => ({ unit_code })),
            materials,
            installation_charges: String(commercial.amount),
            tax_source: "CANONICAL_PROVIDER_TAX",
            effective_from: effectiveFrom.toISOString(),
            effective_to: effectiveTo.toISOString(),
          }, termSelection, supportsStagePayments(purpose)),
          currency: "INR",
          lines: scopedLines,
        },
        crypto.randomUUID(),
      );
      automaticQuotationSelection.current = false;
      setMessage(
        "Quotation draft saved. It is ready for provider review; customer delivery remains blocked until it is issued and approved.",
      );
      window.location.hash = `quotations/${created.id}`;
      reload(true);
      formElement.reset();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function issueQuotation() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const updated = await operationsData.transitionQuotation(
        providerId,
        selected.id,
        {
          action: "issue",
          expected_revision: Number(selected.attributes.revision),
        },
        crypto.randomUUID(),
      );
      setSelected(updated);
      setMessage(
        "Quotation issued; awaiting Provider review before customer acceptance.",
      );
      reload(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function updateDraftQuotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const formMaterials = quotationMaterialsFromForm(form);
      const commercial = quotationCommercialLinesAndAmount(form);
      const termSelection = quotationTermSelectionFromForm(form);
      const purpose = String(selected.attributes.purpose || "INSTALLATION");
      const existingTerms =
        (selected.attributes.terms as Record<string, unknown> | undefined) || {};
      const unitCodes = Array.from(new Set(String(form.get("lift_unit_codes") || "")
        .split(",").map((code) => code.trim()).filter(Boolean)));
      if (!unitCodes.length) throw new Error("Add at least one quoted lift unit before saving this quotation.");
      validateQuotationMaterialLiftAssignments(formMaterials, unitCodes);
      const materials = quotationMaterialsForApi(formMaterials);
      const updated = await operationsData.updateQuotation(
        providerId,
        selected.id,
        {
          expected_revision: Number(selected.attributes.revision),
          lines: commercial.lines,
          quotation_terms_template_id: form.get("quotation_terms_template_id") || undefined,
          terms: quotationTermsForApi({
            ...existingTerms,
            elevator_units: unitCodes.map((unit_code) => ({ unit_code })),
            materials,
          }, termSelection, supportsStagePayments(purpose)),
        },
        crypto.randomUUID(),
      );
      setSelected(updated);
      setMessage(
        "Quotation draft updated. The revised scope is saved and remains subject to provider review.",
      );
      setDetailDialog(null);
      reload(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createQuotationRevision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const materials = quotationMaterialsForApi(quotationMaterialsFromForm(form));
      const commercial = quotationCommercialLinesAndAmount(form);
      const termSelection = quotationTermSelectionFromForm(form);
      const purpose = String(selected.attributes.purpose || "INSTALLATION");
      const existingTerms =
        (selected.attributes.terms as Record<string, unknown> | undefined) || {};
      const revised = await operationsData.createQuotationRevision(
        providerId,
        selected.id,
        {
          expected_revision: Number(selected.attributes.revision),
          lines: commercial.lines,
          quotation_terms_template_id: form.get("quotation_terms_template_id") || undefined,
          terms: quotationTermsForApi({
            ...existingTerms,
            materials,
          }, termSelection, supportsStagePayments(purpose)),
        },
        crypto.randomUUID(),
      );
      setSelected(revised);
      setMessage(
        "New quotation revision created; the prior issued revision remains immutable.",
      );
      setDetailDialog(null);
      reload(true);
      formElement.reset();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changeQuotationCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const customerRelationshipId = String(form.get("customer_relationship_id") || "").trim();
    const reason = String(form.get("reason") || "").trim();
    if (!customerRelationshipId) {
      setError("Select the customer relationship for the replacement quotation.");
      return;
    }
    if (!reason || reason.length > 1000) {
      setError("Enter a reason for the customer change (up to 1,000 characters).");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const replacement = await operationsData.changeQuotationCustomer(
        providerId,
        selected.id,
        {
          customer_relationship_id: customerRelationshipId,
          expected_revision: Number(selected.attributes.revision),
          reason,
        },
        crypto.randomUUID(),
      );
      automaticQuotationSelection.current = false;
      setSelected(replacement);
      setDetailDialog(null);
      setCustomerChangeRelationshipId("");
      setCustomerChangeReason("");
      setMessage("Replacement quotation draft created for the new customer. The previous revision and its delivery history remain in the timeline.");
      window.location.hash = `quotations/${replacement.id}`;
      reload(true);
    } catch (cause) {
      setError((cause as Error).message || "The customer could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  async function createRenewalQuotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const contract = contracts?.data.find(
      (item) => item.id === form.get("predecessor_contract_id"),
    );
    const relationship = contract?.relationships.customer_relationship;
    if (!contract || !relationship || Array.isArray(relationship)) {
      setError(
        "Select an authorized maintenance contract with a customer relationship.",
      );
      return;
    }
    const planId = String(form.get("provider_service_plan_id") || "");
    const plan = amcPlans?.data.find((item) => item.id === planId);
    const version = plan?.attributes.current_version as Record<string, unknown> | undefined;
    const assetId = String(form.get("asset_id") || "");
    const asset = amcAssets?.data.find((item) => item.id === assetId);
    const assetRelationship = asset?.relationships.customer_relationship;
    if (
      !asset ||
      !assetRelationship ||
      Array.isArray(assetRelationship) ||
      assetRelationship.id !== relationship.id
    ) {
      setError("Select an elevator asset linked to the predecessor contract's customer.");
      return;
    }
    if (!plan || !version || String(version.status).toUpperCase() !== "PUBLISHED") {
      setError("Select an active published AMC plan before creating the renewal quotation.");
      return;
    }
    if (!assetId) {
      setError("Select the elevator asset covered by this renewal.");
      return;
    }
    const numeric = (name: string) => {
      const value = Number(form.get(name));
      return Number.isFinite(value) && value > 0 ? value : undefined;
    };
    const termSelection = quotationTermSelectionFromForm(form);
    const quotationTerms = quotationTermsForApi({
      effective_from: `${String(form.get("effective_from"))}T00:00:00Z`,
      effective_to: `${String(form.get("effective_to"))}T00:00:00Z`,
      predecessor_contract_id: contract.id,
      paid_renewal: true,
      included_free_amc: { months: 0 },
    }, termSelection, false);
    quotationTerms.included_free_amc = { months: 0 };
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const created = await operationsData.createQuotation(
        providerId,
        {
          customer_relationship_id: relationship.id,
          purpose: "CONTRACT_RENEWAL",
          quotation_terms_template_id: form.get("quotation_terms_template_id") || undefined,
          terms: quotationTerms,
          currency: "INR",
          lines: [
            {
              description: String(form.get("description") || plan.attributes.name || "AMC renewal"),
              quantity: 1,
              provider_service_plan_version_id: version.id,
              asset_id: assetId,
              pricing_context: {
                served_floors_above_ground: numeric("served_floors_above_ground"),
                audience: String(form.get("audience") || plan.attributes.audience || "MIXED").toUpperCase(),
                passenger_capacity: numeric("passenger_capacity"),
                lift_type: String(form.get("lift_type") || "").trim().toUpperCase() || undefined,
                usage_class: String(form.get("usage_class") || "").trim().toUpperCase() || undefined,
                number_of_stops: numeric("number_of_stops"),
                travel_height_m: numeric("travel_height_m"),
              },
            },
          ],
        },
        crypto.randomUUID(),
      );
      automaticQuotationSelection.current = false;
      setRenewalOpen(false);
      setMessage(
        "Paid AMC renewal quotation draft created. Customer acceptance remains required before contract activation.",
      );
      window.location.hash = `quotations/${created.id}`;
      reload(true);
      formElement.reset();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createInitialAmcQuotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const asset = amcAssets?.data.find((item) => item.id === form.get("asset_id"));
    const relationship = asset?.relationships.customer_relationship;
    if (!asset || !relationship || Array.isArray(relationship)) {
      setError("Select an elevator asset with an active customer relationship.");
      return;
    }
    const plan = amcPlans?.data.find((item) => item.id === form.get("provider_service_plan_id"));
    const version = plan?.attributes.current_version as Record<string, unknown> | undefined;
    if (!plan || !version || String(version.status).toUpperCase() !== "PUBLISHED") {
      setError("Select an active published AMC plan before creating the quotation.");
      return;
    }
    const effectiveFrom = String(form.get("effective_from") || "");
    const effectiveTo = String(form.get("effective_to") || "");
    if (!effectiveFrom || !effectiveTo || effectiveTo <= effectiveFrom) {
      setError("Enter a valid AMC term with an end date after the start date.");
      return;
    }
    const numeric = (name: string) => {
      const value = Number(form.get(name));
      return Number.isFinite(value) && value > 0 ? value : undefined;
    };
    const termSelection = quotationTermSelectionFromForm(form);
    const quotationTerms = quotationTermsForApi({
      effective_from: `${effectiveFrom}T00:00:00Z`,
      effective_to: `${effectiveTo}T00:00:00Z`,
      paid_renewal: false,
      included_free_amc: { months: 0 },
    }, termSelection, false);
    quotationTerms.included_free_amc = { months: 0 };
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const created = await operationsData.createQuotation(
        providerId,
        {
          customer_relationship_id: relationship.id,
          purpose: "MAINTENANCE_CONTRACT",
          quotation_terms_template_id: form.get("quotation_terms_template_id") || undefined,
          terms: quotationTerms,
          currency: "INR",
          lines: [
            {
              description: String(form.get("description") || plan.attributes.name || "AMC service agreement"),
              quantity: 1,
              provider_service_plan_version_id: version.id,
              asset_id: asset.id,
              pricing_context: {
                served_floors_above_ground: numeric("served_floors_above_ground"),
                audience: String(form.get("audience") || plan.attributes.audience || "MIXED").toUpperCase(),
                passenger_capacity: numeric("passenger_capacity"),
                lift_type: String(form.get("lift_type") || "").trim().toUpperCase() || undefined,
                usage_class: String(form.get("usage_class") || "").trim().toUpperCase() || undefined,
                number_of_stops: numeric("number_of_stops"),
                travel_height_m: numeric("travel_height_m"),
              },
            },
          ],
        },
        crypto.randomUUID(),
      );
      automaticQuotationSelection.current = false;
      setInitialAmcOpen(false);
      setMessage("Initial paid AMC quotation draft created. Customer acceptance is required before contract activation.");
      window.location.hash = `quotations/${created.id}`;
      reload();
      formElement.reset();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function recordNegotiation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    try {
      await operationsData.createQuotationNegotiation(
        providerId,
        selected.id,
        {
          event_type: form.get("event_type"),
          notes: form.get("notes"),
          offered_total: form.get("offered_total") || undefined,
          currency_code: "INR",
        },
        crypto.randomUUID(),
      );
      setMessage("Negotiation event recorded in immutable history.");
      setDetailDialog(null);
      formElement.reset();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function recordProviderReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reviewDialog || !hasPermission("QUOTATION_APPROVE"))
      return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const review = await operationsData.reviewProviderQuotation(
        providerId,
        selected.id,
        {
          decision: reviewDialog === "approve" ? "APPROVED" : "REJECTED",
          expected_revision: Number(selected.attributes.revision),
          ...(reviewDialog === "reject"
            ? { reason: String(form.get("reason") || "").trim() }
            : {}),
        },
        crypto.randomUUID(),
      );
      setSelected({
        ...selected,
        attributes: {
          ...selected.attributes,
          provider_review: {
            decision: String(review.attributes.decision).toLowerCase(),
            quotation_revision: Number(review.attributes.quotation_revision),
            reason: review.attributes.reason || null,
            decided_at: review.attributes.decided_at,
          },
        },
      });
      setMessage(
        reviewDialog === "approve"
          ? "Provider review approved for this exact quotation revision. Customer acceptance remains separate."
          : "Provider review rejected for this quotation revision.",
      );
      setReviewDialog(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function convertQuotation() {
    if (!selected) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const renewal =
        String(selected.attributes.purpose || "").toUpperCase() ===
        "CONTRACT_RENEWAL";
      const convertedPayload = await operationsData.convertQuotation(
        providerId,
        selected.id,
        {
          target: renewal ? "DRAFT_MAINTENANCE_CONTRACT" : "INSTALLATION_CASE",
          expected_revision: Number(selected.attributes.revision),
        },
        crypto.randomUUID(),
      );
      const converted = ((
        convertedPayload as unknown as { data?: Resource<GenericAttributes> }
      ).data || convertedPayload) as Resource<GenericAttributes>;
      if (renewal) {
        const terms = selected.attributes.terms as
          { effective_from?: string } | undefined;
        converted.attributes = {
          ...converted.attributes,
          effective_from: terms?.effective_from,
        };
      }
      setMessage(
        renewal
          ? `Renewal draft contract ${converted.id} created; activation remains separately authorized.`
          : `Quotation converted to installation project ${converted.id}.`,
      );
      if (renewal) setConvertedContract(converted);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function activateConvertedContract() {
    if (!convertedContract) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const activated = await operationsData.transitionMaintenanceContract(
        providerId,
        convertedContract.id,
        {
          action: "activate",
          effective_at: String(
            convertedContract.attributes.effective_from ||
              new Date().toISOString(),
          ),
          reason: "Customer accepted paid AMC renewal",
          expected_revision: Number(convertedContract.attributes.revision || 1),
        },
        crypto.randomUUID(),
      );
      setConvertedContract(activated);
      setContracts((current) =>
        current
          ? {
              ...current,
              data: [
                activated,
                ...current.data.filter((item) => item.id !== activated.id),
              ],
            }
          : current,
      );
      setMessage(`Paid AMC renewal contract ${activated.id} activated.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadQuotationPdf() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const blob = await operationsData.quotationPdf(providerId, selected.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${String(selected.attributes.quotation_number || selected.id)}-revision-${String(selected.attributes.revision)}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Immutable quotation PDF downloaded.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reviewQuotationPdf() {
    if (!selected) return;
    if (quotationPdfPreviewUrl) {
      setQuotationPdfPreviewUrl("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const blob = await operationsData.quotationPdf(providerId, selected.id);
      setQuotationPdfPreviewUrl(URL.createObjectURL(blob));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function closeCustomerQuotationPreview() {
    setQuotationPdfPreviewUrl("");
    setDetailDialog(null);
  }

  async function openQuotationDelivery() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const [recipients, history] = await Promise.all([
        operationsData.quotationDeliveryRecipients(providerId, selected.id),
        operationsData.quotationDeliveries(providerId, selected.id),
      ]);
      setDeliveryRecipients(recipients.data);
      setDeliveryHistory(history);
      setDeliveryChannel("EMAIL");
      setDeliveryRecipientMode(recipients.data.some((contact) => contact.email) ? "saved" : "manual");
      setDeliveryOpen(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendQuotationRevision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const contactPointId = String(form.get("contact_point_id") || "").trim();
    const recipientEmail = String(form.get("recipient_email") || "").trim();
    if (deliveryChannel !== "EMAIL") {
      setError(`${deliveryChannel === "SMS" ? "SMS" : "WhatsApp"} delivery is not configured for this provider yet. Email delivery remains available.`);
      return;
    }
    if (deliveryRecipientMode === "saved" && !contactPointId) {
      setError("Choose an authorized contact before sending.");
      return;
    }
    if (deliveryRecipientMode === "manual" && !recipientEmail) {
      setError("Enter a customer email address before sending.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await operationsData.createQuotationDelivery(
        providerId,
        selected.id,
        {
          expected_revision: Number(selected.attributes.revision),
          ...(deliveryRecipientMode === "saved"
            ? { contact_point_id: contactPointId }
            : { recipient_email: recipientEmail }),
        },
        crypto.randomUUID(),
      );
      setDeliveryHistory(
        await operationsData.quotationDeliveries(providerId, selected.id),
      );
      setMessage(
        "Delivery request queued for the approved quotation revision. SMTP acceptance will appear in delivery history.",
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !quotations)
    return (
      <section className="notice state-error" role="alert">
        <strong>{error}</strong>
      </section>
    );
  if (!quotations)
    return (
      <section className="notice" role="status">
        <strong>Loading quotations…</strong>
      </section>
    );
  const relationshipOptions = relationships?.data || [];
  const leadRelationshipOptions = (leads?.data || []).flatMap((lead) => {
    const relationship = lead.relationships.customer_relationship;
    return relationship && !Array.isArray(relationship)
      ? [
          {
            id: relationship.id,
            label: `${String(lead.attributes.customer_relationship_name || "Linked customer")} · ${String(lead.attributes.title || "Lead")}${lead.attributes.reference_code ? ` · ${String(lead.attributes.reference_code)}` : ""}`,
          },
        ]
      : [];
  });
  const selectableRelationships = [
    ...leadRelationshipOptions,
    ...relationshipOptions.map((item) => ({
      id: item.id,
      label: String(
        item.attributes.display_name || item.attributes.name || "Customer relationship",
      ),
    })),
  ].filter(
    (item, index, values) =>
      values.findIndex((candidate) => candidate.id === item.id) === index,
  );
  const customerChangeRelationshipOptions = relationshipOptions
    .filter((item) => String(item.attributes.status || "").toUpperCase() === "ACTIVE")
    .map((item) => ({
      id: item.id,
      label: String(item.attributes.display_name || item.attributes.name || "Customer relationship"),
      detail: "Active customer relationship",
    }));
  const eligibleCustomerChangeOptions = customerChangeRelationshipOptions.filter((item) => {
    const current = selected?.relationships.customer_relationship;
    const currentId = current && !Array.isArray(current) ? current.id : "";
    return item.id !== currentId;
  });
  const selectedTerms = selected?.attributes.terms as
    { predecessor_contract_id?: string } | undefined;
  const selectedLines =
    (selected?.attributes.lines as
      | Array<{
          description?: string;
          quantity?: string | number;
          unit_price?: string | number;
          taxable_unit_price?: string | number;
          amount?: string | number;
          taxable_amount?: string | number;
          tax_amount?: string | number;
          pricing_mode?: string;
          tax?: {
            rule_code?: string;
            tax_treatment?: string;
            total_tax?: string;
            components?: Array<{ code?: string; amount?: string }>;
          } | null;
          unit_codes?: string[];
        }>
      | undefined) || [];
  const selectedQuotationTerms = selected?.attributes.terms as
    Record<string, unknown> | undefined;
  const selectedQuotationMaterials = quotationMaterialsFromTerms(
    selectedQuotationTerms,
  ).map((material, index) => ({
    ...material,
    unit_codes: material.unit_codes.length
      ? material.unit_codes
      : selectedLines[index]?.unit_codes || [],
  }));
  const selectedTaxSummary = selected?.attributes.tax_summary as
    | {
        status?: string;
        tax_total?: string;
        components?: Array<{ code?: string; amount?: string }>;
      }
    | undefined;
  const pricedMaterialCount = selectedQuotationMaterials.filter(
    (material) => material.unit_price.trim() !== "",
  ).length;
  const quotationTaxRequired = pricedMaterialCount > 0;
  const quotationTaxReady =
    !quotationTaxRequired || selectedTaxSummary?.status === "CALCULATED";
  const renewalPredecessorId =
    selectedTerms?.predecessor_contract_id ||
    String(convertedContract?.attributes.predecessor_contract_id || "");
  const renewalPredecessor = contracts?.data.find(
    (item) => item.id === renewalPredecessorId,
  );
  const quoteStatus = (quotation: Resource<GenericAttributes>) =>
    String(quotation.attributes.status || "").toLowerCase();
  const draftCount = quotations.data.filter(
    (quotation) => quoteStatus(quotation) === "draft",
  ).length;
  const approvalCount = quotations.data.filter((quotation) =>
    ["issued", "viewed", "under_review"].includes(quoteStatus(quotation)),
  ).length;
  const acceptedCount = quotations.data.filter((quotation) =>
    ["accepted", "approved"].includes(quoteStatus(quotation)),
  ).length;
  const visibleQuotations = quotations.data;
  const customerNameFor = (quotation: Resource<GenericAttributes>) => {
    const customerRelationshipName = quotation.attributes.customer_relationship_name;
    if (typeof customerRelationshipName === "string" && customerRelationshipName.trim()) {
      return customerRelationshipName;
    }
    const link = quotation.relationships.customer_relationship;
    const relationshipId = link && !Array.isArray(link) ? link.id : "";
    const linkedLead = (leads?.data || []).find((lead) => {
      const leadLink = lead.relationships.customer_relationship;
      return (
        relationshipId &&
        leadLink &&
        !Array.isArray(leadLink) &&
        leadLink.id === relationshipId
      );
    });
    const relationship = relationshipOptions.find(
      (item) => item.id === relationshipId,
    );
    if (relationship)
      return String(
        relationship.attributes.display_name ||
          relationship.attributes.name ||
          "Customer relationship",
      );
    if (linkedLead)
      return String(
        linkedLead.attributes.prospect_name ||
          linkedLead.attributes.title ||
          "Prospect",
      );
    return "Customer not linked";
  };
  const amountFor = (quotation: Resource<GenericAttributes>) => {
    return moneyFor(
      quotation.attributes.total || quotation.attributes.grand_total || 0,
      String(quotation.attributes.currency || "INR"),
    );
  };
  const moneyFor = (value: unknown, currency = "INR") => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  };
  const dateTimeFor = (value: unknown) => {
    if (typeof value !== "string" || !value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(date);
  };
  const dateFor = (value: unknown) => {
    if (typeof value !== "string" || !value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : new Intl.DateTimeFormat("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(date);
  };
  const quotationLabelFor = (value: string) =>
    value === "terms_and_conditions"
      ? "Apply terms and conditions"
      : value === "payment_methods"
        ? "Payment Mode & Details"
        : value
          .replaceAll("_", " ")
          .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const selectedRequirements =
    (selected?.attributes.requirements as Record<string, unknown> | undefined) ||
    {};
  const selectedRequirementScope = selected?.attributes.requirement_scope as Record<string, unknown> | undefined;
  const selectedRequirementUnits = Array.isArray(selectedRequirementScope?.units)
    ? selectedRequirementScope.units
    : Array.isArray(selectedRequirements.units)
      ? selectedRequirements.units
      : [];
  const selectedRequirementUnitCodes = selectedRequirementUnits.length
    ? (selectedRequirementUnits as Array<Record<string, unknown>>)
        .map((unit, index) => String(unit.unit_code || unit.code || unit.label || unit.name || `Lift ${index + 1}`).trim())
        .filter(Boolean)
    : [];
  const selectedQuotationUnitCodes = Array.isArray(selectedQuotationTerms?.elevator_units)
    ? (selectedQuotationTerms.elevator_units as Array<Record<string, unknown>>)
        .map((unit) => String(unit.unit_code || "").trim())
        .filter(Boolean)
    : [];
  const editableQuotationUnitCodes = selectedRequirementUnitCodes.length
    ? selectedRequirementUnitCodes
    : selectedQuotationUnitCodes;
  const uncoveredRequirementUnitCodes = selectedRequirementUnitCodes.filter((unitCode) =>
    !selectedQuotationUnitCodes.includes(unitCode) || !selectedLines.some((line) => {
      const lineUnitCodes = Array.isArray(line.unit_codes) ? line.unit_codes : [];
      return lineUnitCodes.length
        ? lineUnitCodes.includes(unitCode)
        : selectedQuotationUnitCodes.includes(unitCode);
    }),
  );
  const quotationUnitCoverageReady = uncoveredRequirementUnitCodes.length === 0;
  const requirementsForQuotationOverview = {
    ...selectedRequirements,
    units: Array.isArray(selectedRequirementScope?.units) ? selectedRequirementScope.units : selectedRequirements.units,
    unit_requirement_mode: selectedRequirementScope?.unit_requirement_mode || selectedRequirements.unit_requirement_mode,
  };
  const selectedCommercialRoles =
    (selected?.attributes.commercial_party_roles as
      | Record<string, unknown>
      | undefined) || {};
  const visibleRequirementEntries = Object.entries(selectedRequirements).filter(
    ([key, value]) =>
      !["notes", "units", "quantity", "profile_mode", "unit_requirement_mode", "business_operation_code"].includes(key) &&
      value !== null &&
      value !== undefined &&
      value !== "" &&
      (!Array.isArray(value) || value.length > 0),
  );
  const selectedQuotationTermsForView = (() => {
    const terms = { ...(selectedQuotationTerms || {}) };
    if (!terms.terms_and_conditions) {
      const legacyTerms = [terms.delivery_terms, terms.warranty_terms]
        .filter((value) => typeof value === "string" && value.trim())
        .join("<br>");
      if (legacyTerms) terms.terms_and_conditions = legacyTerms;
    }
    return terms;
  })();
  const selectedTermsTemplate = selectedQuotationTermsForView.quotation_terms_template && typeof selectedQuotationTermsForView.quotation_terms_template === "object"
    ? selectedQuotationTermsForView.quotation_terms_template as Record<string, unknown>
    : null;
  const selectedPaymentStagesForView = quotationPaymentScheduleForView(
    selectedQuotationTermsForView,
  );
  const selectedProviderReview = selected?.attributes.provider_review as
    | { decision?: string; quotation_revision?: number; decided_at?: string; reason?: string | null; reviewer?: { name?: string; email?: string } | null }
    | null
    | undefined;
  const selectedPreparedBy = selected?.attributes.prepared_by as
    | { name?: string; email?: string }
    | null
    | undefined;
  const selectedIssuedBy = selected?.attributes.issued_by as
    | { name?: string; email?: string }
    | null
    | undefined;
  const selectedCustomerApproval = selected?.attributes.customer_approval as
    | { mode?: string; status?: string; accepted_at?: string; sent_at?: string }
    | null
    | undefined;
  const selectedQuotationStatus = String(selected?.attributes.status || "").toLowerCase();
  const quotationCustomerChangeAllowed = ["draft", "issued", "viewed", "under_review", "revision_requested"].includes(selectedQuotationStatus);
  const customerAccepted =
    String(selectedCustomerApproval?.status || "").toUpperCase() === "ACCEPTED" ||
    Boolean(selected?.attributes.accepted_at) ||
    selectedQuotationStatus === "accepted";
  const projectRelationship = selected?.relationships.project;
  const linkedProjectId =
    projectRelationship && !Array.isArray(projectRelationship)
      ? projectRelationship.id
      : "";
  const projectDraftReady = Boolean(linkedProjectId);
  const projectConversionEligible = ["INSTALLATION", "MODIFICATION", "TAKEOVER"].includes(
    String(selected?.attributes.purpose || "").toUpperCase(),
  );
  const providerReviewApproved = selectedProviderReview?.decision === "approved";
  const quotationActionPhase = selectedQuotationStatus === "draft"
    ? "draft"
    : customerAccepted
      ? projectDraftReady
        ? "project"
        : "handoff"
      : providerReviewApproved
        ? "customer"
        : "review";
  const quotationWorkflowSteps = [
    {
      key: "draft",
      label: "Scope draft",
      detail: "Build and validate the commercial scope.",
      state: quotationActionPhase === "draft" ? "current" : "complete",
      icon: "pencil",
    },
    {
      key: "review",
      label: "Provider review",
      detail: providerReviewApproved ? "Revision approved." : "Awaiting an authorised reviewer.",
      state: quotationActionPhase === "review" ? "current" : providerReviewApproved || customerAccepted ? "complete" : "upcoming",
      icon: "shield",
    },
    {
      key: "customer",
      label: "Customer acceptance",
      detail: customerAccepted ? "Acceptance recorded." : "Send and await customer approval.",
      state: quotationActionPhase === "customer" ? "current" : customerAccepted ? "complete" : "upcoming",
      icon: "users",
    },
    {
      key: "handoff",
      label: projectDraftReady ? "Project draft" : "Project handoff",
      detail: projectDraftReady ? "Draft is ready for planning." : "Created automatically after acceptance.",
      state: quotationActionPhase === "handoff" ? "current" : projectDraftReady ? "complete" : "upcoming",
      icon: "arrow-right",
    },
    {
      key: "project",
      label: "Project planning",
      detail: "Continue in Projects & Installation.",
      state: quotationActionPhase === "project" ? "current" : "upcoming",
      icon: "building",
    },
  ] as const;
  const quotationNextAction = quotationActionPhase === "draft"
    ? { label: "Prepare the quotation", detail: "Complete the scope, pricing and tax controls before issuing this revision." }
    : quotationActionPhase === "review"
      ? { label: "Provider review required", detail: "An authorised provider reviewer must approve this exact revision before customer delivery." }
      : quotationActionPhase === "customer"
        ? { label: "Customer approval pending", detail: "Send the approved revision to the authorised customer contact and wait for acceptance." }
        : quotationActionPhase === "handoff"
          ? { label: "Create the project draft", detail: "Customer acceptance is complete. Create the provider project draft to start planning." }
          : { label: "Continue project planning", detail: "The project draft is ready. Open Projects & Installation for the next authorised step." };
  const quotationIsDraft = selectedQuotationStatus === "draft";
  const quotationReadyToSend =
    ["issued", "viewed", "under_review"].includes(selectedQuotationStatus) &&
    hasPermission("QUOTATION_ISSUE") &&
    selectedProviderReview?.decision === "approved";
  const onlineCustomerApprovalEnabled = selectedCustomerApproval?.mode
    ? String(selectedCustomerApproval.mode).toUpperCase() === "ONLINE"
    : selectedQuotationTerms?.online_customer_approval !== false;
  const quotationAgreementState =
    selectedQuotationStatus === "cancelled" || selectedQuotationStatus === "rejected"
      ? "blocked"
      : customerAccepted
        ? "accepted"
        : selectedProviderReview?.decision === "approved"
          ? onlineCustomerApprovalEnabled ? "customer-approval" : "offline-signature"
          : ["issued", "viewed", "under_review"].includes(selectedQuotationStatus)
            ? "provider-review"
            : "draft";
  const customerDeliveryQueued = Boolean(
    ["QUEUED", "PROCESSING", "SENT", "DELIVERED"].includes(String(selectedCustomerApproval?.status || "").toUpperCase()) ||
    deliveryHistory?.data.some((delivery) =>
      ["queued", "processing", "sent", "delivered"].includes(
        String(delivery.attributes.status || "").toLowerCase(),
      ),
    ),
  );
  const customerApprovalLabel = customerDeliveryQueued
    ? "Sent for customer approval"
    : "Ready for customer approval";
  const customerApprovalMessage = customerDeliveryQueued
    ? "The approved revision has been queued for the authorised customer contact. The PDF is the customer-facing soft copy of the agreement."
    : "The provider-approved revision is ready to send to the authorised customer contact. Customer acceptance remains pending.";
  const customerApprovalStatusLabel = !onlineCustomerApprovalEnabled
    ? "Offline agreement copy"
    : ["approved", "accepted"].includes(selectedQuotationStatus)
      ? dateTimeFor(selected?.attributes.accepted_at)
      : customerDeliveryQueued
        ? "Sent for approval"
        : selectedProviderReview?.decision === "approved"
          ? "Ready for approval"
          : "Pending";
  const hasDeliveryRecipientForChannel = (channel: QuotationDeliveryChannel) =>
    deliveryRecipients.some((contact) =>
      channel === "EMAIL" ? Boolean(contact.email) : Boolean(contact.phone),
    );
  const deliveryContactsForChannel = deliveryRecipients.filter((contact) =>
    deliveryChannel === "EMAIL" ? Boolean(contact.email) : Boolean(contact.phone),
  );
  const quotationAgreementLabel = {
    draft: "Draft — not sent",
    "provider-review": "Awaiting provider approval",
    "customer-approval": customerApprovalLabel,
    "offline-signature": "Offline agreement copy",
    accepted: projectDraftReady ? "Accepted — project draft ready" : "Accepted — project handoff ready",
    blocked: selectedQuotationStatus === "rejected" ? "Rejected — agreement not active" : "Cancelled — agreement not active",
  }[quotationAgreementState];
  const quotationAgreementMessage = {
    draft: "Complete the provider review before this quotation can be sent to the customer.",
    "provider-review": "The quotation revision is awaiting the authorised provider reviewer. Customer delivery remains blocked.",
    "customer-approval": customerApprovalMessage,
    "offline-signature": "Online customer approval is disabled for this quotation. Add customer signature, company seal and date only when they are available.",
    accepted: projectDraftReady
      ? "Customer acceptance is recorded and the installation project draft is ready for provider planning."
      : "Customer acceptance is recorded. The eligible installation project draft will be created by the provider workflow.",
    blocked: "This quotation cannot be accepted or progressed in its current state.",
  }[quotationAgreementState];
  const linkedLeadId = quotationLeadId(selected);
  const linkedLead = linkedLeadId
    ? leads?.data.find((lead) => lead.id === linkedLeadId)
    : undefined;
  const workflowConcluded =
    selected?.attributes.journey_stage_status === "COMPLETED" ||
    (selectedJourney ? selectedJourney.attributes.status !== "ACTIVE" : false);
  const quotationJourneyAbandoned = selectedJourney?.attributes.status === "CANCELLED";
  const detailTabVisible = Boolean(initialQuotationId);
  const openQuotationDetail = (quotationId: string) => {
    window.location.hash = `quotations/${quotationId}`;
  };
  const navigateQuotationNextStep = () => {
    if (quotationActionPhase === "project" && linkedProjectId) {
      window.location.hash = `projects/${linkedProjectId}`;
      return;
    }
    setActiveDetailTab("review");
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(".quotation-review-actions-card")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const quotationAgreementBanner = selected ? (
    <section
      className={`quotation-agreement-banner quotation-agreement-banner--${quotationAgreementState}`}
      aria-label="Quotation agreement status"
      data-state={quotationAgreementState}
    >
      <span className="quotation-agreement-banner-icon" aria-hidden="true">
        <SvgIcon
          name={quotationAgreementState === "accepted" ? "shield" : quotationAgreementState === "blocked" ? "x" : "clipboard"}
          size={18}
        />
      </span>
      <div>
        <span className="eyebrow">Customer approval &amp; agreement</span>
        <strong>{quotationAgreementLabel}</strong>
        <p>{quotationAgreementMessage}</p>
      </div>
      <dl className="quotation-agreement-banner-facts">
        <div><dt>Revision</dt><dd>R{String(selected.attributes.revision || "—")}</dd></div>
        <div><dt>Approval mode</dt><dd>{onlineCustomerApprovalEnabled ? "Online approval" : "Offline signature"}</dd></div>
        <div><dt>Provider review</dt><dd>{selectedProviderReview?.decision ? quotationLabelFor(String(selectedProviderReview.decision)) : "Pending"}</dd></div>
        <div><dt>Customer approval</dt><dd>{customerApprovalStatusLabel}</dd></div>
      </dl>
    </section>
  ) : null;
  const quotationDetailPanel = selected ? (
    <aside
      className="quotation-detail-panel detail-card"
      aria-label="Quotation detail"
    >
      {!detailTabVisible && (
        <div className="section-heading">
          <div>
            <span className="eyebrow">Quotation detail</span>
            <h2>
              {String(selected.attributes.quotation_number || "Quotation")}
            </h2>
            <p>
              Commercial scope carried from the Lead survey and requirements
              journey.
            </p>
          </div>
          <Status>
            {selectedJourney?.attributes.status === "CANCELLED"
              ? "ABANDONED"
              : displayLabel(selected.attributes.status, "Not available")}
          </Status>
        </div>
      )}
      {workflowConcluded && !detailTabVisible && (
        <div className={`workflow-concluded-inline${quotationJourneyAbandoned ? " workflow-concluded-inline--abandoned" : ""}`} role="status">
          <span className="workflow-concluded-inline-icon" aria-hidden="true">
            <SvgIcon name={quotationJourneyAbandoned ? "x" : "shield"} size={14} />
          </span>
          <span className="workflow-concluded-inline-copy">
            <strong>{quotationJourneyAbandoned ? "Journey abandoned — read-only" : "Workflow concluded — read-only"}</strong>
            <small>
              {quotationJourneyAbandoned ? "No further updates or downstream actions are allowed." : "Quotation is final. Review and customer history remain available."}
            </small>
          </span>
        </div>
      )}
      {!detailTabVisible && quotationAgreementBanner}
      {(!detailTabVisible || activeDetailTab === "overview") && (
        <div className="quotation-proposal-overview">
          <section className="quotation-commercial-hero" aria-label="Commercial summary">
            <div className="quotation-commercial-hero-copy">
              <span className="eyebrow">Commercial summary</span>
              <strong>
                {amountFor(selected)}
              </strong>
              <small>
                Quoted total · {String(selected.attributes.currency || "INR")}
              </small>
              {String(selected.attributes.currency || "INR").toUpperCase() === "INR" && (
                <small className="quotation-amount-words quotation-commercial-amount-words">
                  {amountInWordsFor(selected.attributes.grand_total || selected.attributes.total || 0, "INR")}
                </small>
              )}
            </div>
            <div className="quotation-commercial-stats">
              <div>
                <span>Revision</span>
                <strong>R{String(selected.attributes.revision || "—")}</strong>
              </div>
              <div>
                <span>Line items</span>
                <strong>{selectedLines.length}</strong>
              </div>
              <div>
                <span>Valid until</span>
                <strong>
                  {dateFor(
                    selected.attributes.valid_until ||
                      selectedQuotationTerms?.effective_to,
                  )}
                </strong>
              </div>
            </div>
          </section>

          <div className="quotation-overview-grid">
            <section className="quotation-proposal-card" aria-label="Proposal routing">
              <div className="quotation-proposal-card-heading">
                <div>
                  <span className="eyebrow">Proposal routing</span>
                  <h4>Source and preparation</h4>
                </div>
                <span className="quotation-proposal-icon" aria-hidden="true">
                  <SvgIcon name="clipboard" size={16} />
                </span>
              </div>
              <dl className="quotation-facts-grid">
                <div>
                  <dt>Linked lead</dt>
                  <dd>
                    {linkedLead
                      ? String(
                          linkedLead.attributes.reference_code ||
                            linkedLead.attributes.title ||
                            "Lead record linked",
                        )
                      : selected.relationships.marketing_lead &&
                          !Array.isArray(selected.relationships.marketing_lead)
                        ? "Lead record linked"
                        : "Not linked"}
                  </dd>
                </div>
                <div>
                  <dt>Requirement source</dt>
                  <dd>
                    {quotationLabelFor(
                      String(selectedQuotationTerms?.source || "Lead & survey"),
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Prepared</dt>
                  <dd>{dateTimeFor(selected.attributes.created_at)}</dd>
                </div>
                <div>
                  <dt>Provider</dt>
                  <dd>{String(selected.attributes.provider_name || "Current service provider")}</dd>
                </div>
                <div>
                  <dt>Prepared by</dt>
                  <dd>{selectedPreparedBy?.name || "Recorded from provider workflow"}</dd>
                </div>
                <div>
                  <dt>Scope readiness</dt>
                  <dd>
                    {visibleRequirementEntries.length
                      ? `${visibleRequirementEntries.length} specifications linked`
                      : "Requirements pending"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="quotation-proposal-card" aria-label="Proposal control">
              <div className="quotation-proposal-card-heading">
                <div>
                  <span className="eyebrow">Control &amp; readiness</span>
                  <h4>Quotation status</h4>
                </div>
                <Status>
                  {selectedJourney?.attributes.status === "CANCELLED"
                    ? "ABANDONED"
                    : String(selected.attributes.status)}
                </Status>
              </div>
              <dl className="quotation-facts-grid">
                <div>
                  <dt>Review state</dt>
                  <dd>
                    {(selected.attributes.provider_review as
                      | { decision?: string }
                      | null)?.decision
                      ? quotationLabelFor(
                          String(
                            (
                              selected.attributes.provider_review as {
                                decision: string;
                              }
                            ).decision,
                          ),
                        )
                      : "Internal review pending"}
                  </dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>{dateTimeFor(selected.attributes.updated_at)}</dd>
                </div>
                <div>
                  <dt>Customer delivery</dt>
                  <dd>
                    {String(
                      selectedQuotationTerms?.customer_delivery ||
                        (String(selected.attributes.status).toLowerCase() ===
                        "draft"
                          ? "Blocked until issued and approved"
                          : "Controlled by approval workflow"),
                    ).replaceAll("_", " ")}
                  </dd>
                </div>
                <div>
                  <dt>Commercial roles</dt>
                  <dd>
                    {Object.keys(selectedCommercialRoles).length
                      ? `${Object.keys(selectedCommercialRoles).length} configured`
                      : "Provider defaults"}
                  </dd>
                </div>
                <div>
                  <dt>Issued by</dt>
                  <dd>{selectedIssuedBy?.name || "Not issued yet"}</dd>
                </div>
                <div>
                  <dt>Issued at</dt>
                  <dd>{selected.attributes.issued_at ? dateTimeFor(selected.attributes.issued_at) : "Not issued yet"}</dd>
                </div>
              </dl>
            </section>
          </div>

          <section className="quotation-proposal-card quotation-requirement-preview" aria-label="Quotation scope source">
            <div className="quotation-proposal-card-heading">
              <div>
                <span className="eyebrow">Elevator &amp; service scope</span>
                  <h4>Latest lift specifications</h4>
                <p>
                  Shared requirements and per-lift differences from the latest submitted survey.
                </p>
              </div>
              <Button
                type="button"
                variant="quiet"
                onClick={() => setActiveDetailTab("commercial")}
              >
                View full scope <span aria-hidden="true">→</span>
              </Button>
            </div>
            <QuotationOverviewSpecifications requirements={requirementsForQuotationOverview} />
            <div className="quotation-scope-compact-summary">
              <div>
                <strong>{visibleRequirementEntries.length}</strong>
                <span>specifications carried forward</span>
              </div>
              <div>
                <strong>{selectedLines.length}</strong>
                <span>priced line items</span>
              </div>
              <div>
                <strong>
                  {visibleRequirementEntries.length ? "Ready" : "Pending"}
                </strong>
                <span>engineering scope status</span>
              </div>
            </div>
          </section>
        </div>
      )}
      {(!detailTabVisible || (activeDetailTab !== "overview" && activeDetailTab !== "review")) && (
        <>
          {(!detailTabVisible || activeDetailTab === "quoted") && (
          <>
          <section
            className="quotation-detail-section quotation-scope-section"
            aria-label="Quoted scope"
          >
            {(selectedRequirementUnitCodes.length > 0 || visibleRequirementEntries.length > 0) && (
              <section className="quotation-quoted-survey-scope" aria-label="Lift units and survey values">
                <div className="quotation-quoted-survey-scope-heading">
                  <div>
                    <span className="eyebrow">Engineering reference</span>
                    <h4>Lift units &amp; survey values</h4>
                    <p>Latest submitted unit specifications are shown beside the priced items below. They remain separate when lift requirements differ.</p>
                  </div>
                  {selectedRequirementUnitCodes.length > 0 && (
                    <Status>{selectedRequirementUnitCodes.length} lifts</Status>
                  )}
                </div>
                <QuotationOverviewSpecifications requirements={requirementsForQuotationOverview} />
                {!quotationUnitCoverageReady && (
                  <div className="quotation-quoted-scope-warning" role="status">
                    <div>
                      <strong>Quoted items are missing lift coverage</strong>
                      <p>Assign priced material lines to: {uncoveredRequirementUnitCodes.join(", ")}.</p>
                    </div>
                    {String(selected.attributes.status).toLowerCase() === "draft" && hasPermission("QUOTATION_EDIT") && (
                      <Button type="button" variant="secondary" onClick={() => setDetailDialog("edit")}>
                        Edit lift coverage
                      </Button>
                    )}
                  </div>
                )}
              </section>
            )}
            <div className="section-heading">
              <div>
                <h4>Quotation items</h4>
                <p>
                  Original line items, tax values and totals from this quotation revision.
                </p>
              </div>
              <div className="quotation-section-heading-actions">
                <span className="quotation-section-count">
                  {selectedLines.length} {selectedLines.length === 1 ? "line" : "lines"}
                </span>
              </div>
            </div>
            {selectedLines.length ? (
              <div className="quotation-line-table-wrap">
                <table className="quotation-line-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Description</th>
                      <th>Applies to lifts</th>
                      <th>Qty</th>
                      <th>Rate</th>
                      <th>Tax</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLines.map((line, index) => {
                      const material = selectedQuotationMaterials[index];
                      return (
                      <Fragment key={`${String(line.description)}-${index}`}>
                      <tr>
                        <td className="quotation-line-number">{String(index + 1).padStart(2, "0")}</td>
                        <td>
                          <div className="quotation-line-description-with-action">
                            <span>{String(line.description || "—")}</span>
                            {material && (
                              <Button
                                type="button"
                                variant="quiet"
                                className={`quotation-line-details-toggle${openMaterialDetailIndex === index ? " is-open" : ""}`}
                                aria-expanded={openMaterialDetailIndex === index}
                                aria-controls={`quotation-material-detail-${index}`}
                                onClick={() => setOpenMaterialDetailIndex((current) => current === index ? -1 : index)}
                              >
                                <SvgIcon name="eye" size={13} /> View details
                              </Button>
                            )}
                          </div>
                        </td>
                        <td><QuotationLiftAssignmentValue unitCodes={Array.isArray(line.unit_codes) ? line.unit_codes : undefined} allUnitCodes={selectedQuotationUnitCodes} /></td>
                        <td>{String(line.quantity ?? "—")}</td>
                        <td>
                          {moneyFor(
                            line.unit_price || 0,
                            String(selected.attributes.currency || "INR"),
                          )}
                        </td>
                        <td>
                          {line.tax ? (
                            <div className="quotation-tax-line-summary">
                              <strong>
                                {String(line.tax.rule_code || line.tax.tax_treatment || "Configured")}
                              </strong>
                              <small>
                                {String(line.pricing_mode || "EXCLUSIVE")} · {moneyFor(line.tax_amount || 0, String(selected.attributes.currency || "INR"))}
                              </small>
                            </div>
                          ) : (
                            <span className="status status-warning">Not configured</span>
                          )}
                        </td>
                        <td>
                          {moneyFor(
                            line.amount || 0,
                            String(selected.attributes.currency || "INR"),
                          )}
                        </td>
                      </tr>
                      {material && openMaterialDetailIndex === index && (
                        <tr className="quotation-line-material-child">
                          <td colSpan={6}>
                            <div id={`quotation-material-detail-${index}`} className="quotation-line-details-body" role="region" aria-label={`${material.description || "Material"} material scope details`}>
                                <div className="quotation-material-detail-heading">
                                  <strong>{material.description || "Unnamed material"}</strong>
                                  <span>{material.quantity} {material.unit_code}</span>
                                </div>
                                <dl className="quotation-material-detail-grid">
                                  <div>
                                    <dt>Category</dt>
                                    <dd>{quotationLabelFor(material.category)}</dd>
                                  </div>
                                  <div>
                                    <dt>Customer visibility</dt>
                                    <dd>{material.customer_visibility === "EXCLUDED" ? "Internal / excluded" : "Included"}</dd>
                                  </div>
                                  <div>
                                    <dt>Item warranty</dt>
                                    <dd>{material.warranty_months ? `${material.warranty_months} months` : "As agreed"}</dd>
                                  </div>
                                  {material.specifications && (
                                    <div className="quotation-material-detail-grid-wide">
                                      <dt>Specifications</dt>
                                      <dd className="quotation-material-specification-list">{material.specifications.split("\n").map((specification) => <span key={specification}>{specification}</span>)}</dd>
                                    </div>
                                  )}
                                  {material.notes && (
                                    <div className="quotation-material-detail-grid-wide">
                                      <dt>Notes</dt>
                                      <dd>{material.notes}</dd>
                                    </div>
                                  )}
                                </dl>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="notice">
                No quotation lines have been supplied yet.
              </p>
            )}
            <section className="quotation-pricing-summary" aria-label="Quotation totals">
              <div className="quotation-pricing-summary-heading">
                <div>
                  <span className="eyebrow">Amount summary</span>
                  <strong>Quotation totals</strong>
                </div>
                <span className="quotation-currency-badge">{String(selected.attributes.currency || "INR")}</span>
              </div>
              <div className="quotation-pricing-breakdown">
                <div className="quotation-pricing-row">
                  <span>Subtotal</span>
                  <strong>
                    {moneyFor(
                      selected.attributes.subtotal || selected.attributes.total || 0,
                      String(selected.attributes.currency || "INR"),
                    )}
                  </strong>
                </div>
                <div className="quotation-pricing-row">
                  <span>Discount</span>
                  <strong>
                    {moneyFor(
                      selected.attributes.discount_total || 0,
                      String(selected.attributes.currency || "INR"),
                    )}
                  </strong>
                </div>
                <div className="quotation-pricing-row quotation-pricing-row-tax">
                  <span>
                    <strong>Tax</strong>
                    <small>CGST + SGST</small>
                  </span>
                  <strong>
                    {moneyFor(
                      selected.attributes.tax_total || 0,
                      String(selected.attributes.currency || "INR"),
                    )}
                  </strong>
                </div>
                {selectedTaxSummary?.components?.map((component) => (
                  <div className="quotation-pricing-row quotation-pricing-tax-component" key={String(component.code)}>
                    <span>{String(component.code || "Tax")}</span>
                    <strong>
                      {moneyFor(
                        component.amount || 0,
                        String(selected.attributes.currency || "INR"),
                      )}
                    </strong>
                  </div>
                ))}
              </div>
              <div className="quotation-pricing-total">
                <span>Quoted total</span>
                <div className="quotation-pricing-total-value">
                  <strong>{amountFor(selected)}</strong>
                  {String(selected.attributes.currency || "INR").toUpperCase() === "INR" && (
                    <small>{amountInWordsFor(selected.attributes.grand_total || selected.attributes.total || 0, "INR")}</small>
                  )}
                </div>
              </div>
            </section>
            {selectedTaxSummary?.status !== "CALCULATED" && (
              <p className="notice">
                Tax status: {String(selectedTaxSummary?.status || "NOT_CONFIGURED").replaceAll("_", " ").toLowerCase()}. Select a published central tax rule for each priced package or item before issuing the quotation.
              </p>
            )}
          </section>
          </>
          )}
          {(!detailTabVisible || activeDetailTab === "commercial") && (
          <>
          {visibleRequirementEntries.length > 0 && (
            <section
              className="quotation-detail-section quotation-requirement-detail"
              aria-label="Elevator requirement details"
            >
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Engineering scope</span>
                  <h4>Elevator &amp; service requirements</h4>
                  <p>
                    Latest requirement values carried from Work Intake and Lead &amp; Survey.
                  </p>
                </div>
                {Boolean(selectedRequirements.notes) && (
                  <span className="quotation-source-badge">Latest submitted revision</span>
                )}
              </div>
              <QuotationOverviewSpecifications requirements={requirementsForQuotationOverview} />
              {Boolean(selectedRequirements.notes) && (
                <div className="quotation-requirement-notes">
                  <span>Survey / requirement notes</span>
                  <p>{String(selectedRequirements.notes)}</p>
                </div>
              )}
            </section>
          )}
          {selectedQuotationTerms && (
            <section
              className="quotation-detail-section quotation-template-selected-terms quotation-commercial-terms-section"
              aria-label="Commercial Terms and Payment Details"
            >
              <div className="quotation-template-preview-section-heading">
                <div>
                  <h4>Commercial Terms &amp; Payment Details</h4>
                  <small>Original customer-ready values attached to this quotation revision.</small>
                </div>
                {selectedTermsTemplate && <Status>Template: {String(selectedTermsTemplate.name || "Applied terms")} · v{String(selectedTermsTemplate.revision || "1")}</Status>}
              </div>
              <div className="quotation-template-approval-mode">
                <span>Customer approval</span>
                <QuotationCustomerApprovalSummary value={selectedQuotationTermsForView.online_customer_approval !== false} />
              </div>
              {Boolean(selectedQuotationTermsForView.terms_and_conditions) && (
                <div className="quotation-template-terms-conditions">
                  <div className="quotation-template-terms-conditions-heading">
                    <h5>Terms &amp; Conditions</h5>
                    <small>Applied to this quotation revision</small>
                  </div>
                  <RichTextViewer value={String(selectedQuotationTermsForView.terms_and_conditions)} />
                </div>
              )}
              <dl className="quotation-terms-list quotation-template-terms-grid">
                {selectedPaymentStagesForView && <div className="quotation-template-term-card quotation-template-term-card--payment_stages"><dt>Payment stages</dt><dd><QuotationPaymentStagesCustomerSummary value={selectedPaymentStagesForView} total={selected.attributes.grand_total || selected.attributes.total || 0} currency={String(selected.attributes.currency || "INR")} moneyFor={moneyFor} /></dd></div>}
                {Boolean(selectedQuotationTermsForView.payment_methods) && <div className="quotation-template-term-card quotation-template-term-card--payment_methods"><dt>Payment Mode &amp; Details</dt><dd><QuotationPaymentMethodsSummary value={selectedQuotationTermsForView.payment_methods} interactive /></dd></div>}
                {Boolean(selectedQuotationTermsForView.bank_account) && !selectedQuotationTermsForView.payment_methods && <div className="quotation-template-term-card quotation-template-term-card--payment_methods"><dt>Payment account</dt><dd><QuotationBankAccountSummary value={selectedQuotationTermsForView.bank_account} interactive /></dd></div>}
                {Boolean(selectedQuotationTermsForView.exclusions) && <div className="quotation-template-term-card quotation-template-term-card--exclusions"><dt>Exclusions</dt><dd><QuotationExclusionsSummary value={selectedQuotationTermsForView.exclusions} /></dd></div>}
                {Boolean(selectedQuotationTermsForView.included_free_amc) && <div className="quotation-template-term-card quotation-template-term-card--included_free_amc"><dt>Included free AMC</dt><dd><QuotationIncludedAmcSummary value={selectedQuotationTermsForView.included_free_amc} /></dd></div>}
                <div className="quotation-template-term-card quotation-template-term-card--show_tax_details"><dt>Tax details</dt><dd><QuotationTaxVisibilitySummary value={selectedQuotationTermsForView.show_tax_details !== false} /></dd></div>
                {Boolean(selectedQuotationTermsForView.letterhead) && <div className="quotation-template-term-card quotation-template-term-card--letterhead"><dt>Letterhead</dt><dd><QuotationLetterheadSummary value={selectedQuotationTermsForView.letterhead} /></dd></div>}
              </dl>
            </section>
          )}
          </>
          )}
        </>
      )}
      {(!detailTabVisible || activeDetailTab === "review") && (
        <div className="quotation-review-layout">
          <section className="quotation-proposal-card quotation-review-actions-card" aria-label="Available quotation actions">
            <div className="quotation-proposal-card-heading">
              <div>
                <span className="eyebrow">Next actions</span>
                <h4>Continue this quotation</h4>
                <p>Follow the highlighted step. Actions below are limited to this revision and your provider permissions.</p>
              </div>
              <span className="quotation-proposal-icon quotation-proposal-icon--review" aria-hidden="true">
                <SvgIcon name="activity" size={16} />
              </span>
            </div>
            <div className="quotation-workflow-stepper" aria-label="Quotation workflow progress">
              {quotationWorkflowSteps.map((step, index) => (
                <div
                  className={`quotation-workflow-step quotation-workflow-step--${step.state}`}
                  data-state={step.state}
                  key={step.key}
                >
                  <span className="quotation-workflow-step-marker" aria-hidden="true">
                    {step.state === "complete" ? "✓" : <SvgIcon name={step.icon} size={14} />}
                  </span>
                  <span className="quotation-workflow-step-copy">
                    <strong>{step.label}</strong>
                    <small>{step.detail}</small>
                  </span>
                  {index < quotationWorkflowSteps.length - 1 && <span className="quotation-workflow-step-connector" aria-hidden="true" />}
                </div>
              ))}
            </div>
            <div className={`quotation-next-action quotation-next-action--${quotationActionPhase}`} role="status">
              <span className="quotation-next-action-marker" aria-hidden="true">
                <SvgIcon name={quotationActionPhase === "project" ? "building" : "arrow-right"} size={16} />
              </span>
              <span>
                <small>Next action</small>
                <strong>{quotationNextAction.label}</strong>
                <em>{quotationNextAction.detail}</em>
              </span>
            </div>
            <fieldset disabled={workflowConcluded}>
              <div className="quotation-detail-actions">
                {quotationCustomerChangeAllowed &&
                  hasPermission("QUOTATION_EDIT") && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setCustomerChangeRelationshipId("");
                        setCustomerChangeSearch("");
                        setCustomerChangeReason("");
                        setDetailDialog("customer-change");
                      }}
                    >
                      Change customer
                    </Button>
                  )}
                {String(selected.attributes.status).toLowerCase() === "draft" &&
                  hasPermission("QUOTATION_EDIT") && (
                    <Button
                      variant="secondary"
                      onClick={() => setDetailDialog("edit")}
                    >
                      Edit draft
                    </Button>
                  )}
                {String(selected.attributes.status).toLowerCase() === "draft" &&
                  hasPermission("QUOTATION_ISSUE") && (
                    <Button
                      onClick={() => void issueQuotation()}
                      disabled={busy || !quotationUnitCoverageReady || (quotationTaxRequired && !quotationTaxReady)}
                    >
                      Issue quotation
                    </Button>
                  )}
                {["issued", "viewed", "under_review"].includes(
                  String(selected.attributes.status).toLowerCase(),
                ) &&
                  hasPermission("QUOTATION_EDIT") && (
                    <Button
                      variant="secondary"
                      onClick={() => setDetailDialog("revision")}
                    >
                      Create revision
                    </Button>
                  )}
                {["approved", "accepted"].includes(
                  String(selected.attributes.status).toLowerCase(),
                ) &&
                  hasPermission("QUOTATION_CONVERT") &&
                  (String(selected.attributes.purpose || "").toUpperCase() === "CONTRACT_RENEWAL" ||
                    (projectConversionEligible && !projectDraftReady)) && (
                    <Button
                      onClick={() => void convertQuotation()}
                      disabled={busy}
                    >
                      {String(selected.attributes.purpose || "").toUpperCase() ===
                      "CONTRACT_RENEWAL"
                        ? "Create renewal contract draft"
                        : "Create project draft"}
                    </Button>
                  )}
                {projectConversionEligible && projectDraftReady && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      window.location.hash = `projects/${linkedProjectId}`;
                    }}
                  >
                    <SvgIcon name="building" size={15} /> Open project draft
                  </Button>
                )}
                {hasPermission("QUOTATION_NEGOTIATE") && (
                  <Button
                    variant="quiet"
                    onClick={() => setDetailDialog("negotiation")}
                  >
                    Record negotiation
                  </Button>
                )}
              </div>
            </fieldset>
          </section>
          <section
            className="quotation-proposal-card quotation-readiness-card"
            aria-label="Quotation readiness"
          >
            <div className="quotation-proposal-card-heading">
              <div>
                <span className="eyebrow">Proposal controls</span>
                <h4>Review before customer delivery</h4>
              </div>
              <span
                className="quotation-proposal-icon quotation-proposal-icon--review"
                aria-hidden="true"
              >
                <SvgIcon name="shield" size={16} />
              </span>
            </div>
            <ul className="quotation-readiness-list">
              <li className="is-ready">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>Requirement scope linked</strong>
                  <small>
                    {visibleRequirementEntries.length
                      ? "Latest submitted requirement values are attached."
                      : "Requirement values are still pending."}
                  </small>
                </div>
              </li>
              <li className={selectedLines.length ? "is-ready" : ""}>
                <span aria-hidden="true">{selectedLines.length ? "✓" : "2"}</span>
                <div>
                  <strong>Commercial lines priced</strong>
                  <small>
                    {selectedLines.length
                      ? `${selectedLines.length} proposal line${selectedLines.length === 1 ? "" : "s"} included.`
                      : "Add at least one line before issuing."}
                  </small>
                </div>
              </li>
              {selectedRequirementUnitCodes.length > 0 && (
                <li className={quotationUnitCoverageReady ? "is-ready" : ""}>
                  <span aria-hidden="true">{quotationUnitCoverageReady ? "✓" : "3"}</span>
                  <div>
                    <strong>Lift scope coverage</strong>
                    <small>
                      {quotationUnitCoverageReady
                        ? "Every lift from the submitted survey has priced coverage."
                        : `Add priced coverage for ${uncoveredRequirementUnitCodes.join(", ")} before issuing.`}
                    </small>
                    {!quotationUnitCoverageReady && (
                      <Button type="button" variant="quiet" onClick={() => setDetailDialog("edit")}>
                        Edit lift coverage
                      </Button>
                    )}
                  </div>
                </li>
              )}
              {quotationTaxRequired && (
                <li className={quotationTaxReady ? "is-ready" : ""}>
                  <span aria-hidden="true">{quotationTaxReady ? "✓" : "3"}</span>
                  <div>
                    <strong>Tax classification complete</strong>
                    <small>
                      {quotationTaxReady
                        ? "Every priced material line uses a published central tax rule."
                        : "Select a published central tax rule for every priced material line before issuing."}
                    </small>
                  </div>
                </li>
              )}
              <li
                className={
                  String(selected.attributes.status).toLowerCase() === "draft"
                    ? ""
                    : "is-ready"
                }
              >
                <span aria-hidden="true">
                  {String(selected.attributes.status).toLowerCase() === "draft"
                    ? "3"
                    : "✓"}
                </span>
                <div>
                  <strong>Customer delivery gate</strong>
                  <small>
                    {String(selected.attributes.status).toLowerCase() ===
                    "draft"
                      ? "Issue and approve the revision before sending it to the customer."
                      : "Delivery follows the approved revision and authorized contact flow."}
                  </small>
                </div>
              </li>
            </ul>
          </section>
          {["issued", "viewed", "under_review"].includes(
            String(selected.attributes.status).toLowerCase(),
          ) && (
            <section
              className="detail-card quotation-provider-review"
              aria-label="Provider quotation review"
            >
              <header className="quotation-provider-review-header">
                <div>
                  <span className="eyebrow">Internal approval</span>
                  <h4>Provider review</h4>
                </div>
                <Status>
                  {selectedProviderReview?.decision
                    ? quotationLabelFor(selectedProviderReview.decision).toUpperCase()
                    : "PENDING"}
                </Status>
              </header>
              {(
                selected.attributes.provider_review as {
                  decision?: string;
                  quotation_revision?: number;
                  reason?: string | null;
                  reviewer?: { name?: string; email?: string } | null;
                } | null
              )?.decision ? (
                <div className="quotation-provider-review-record">
                  <div className="quotation-provider-review-decision">
                    <strong>
                      {quotationLabelFor(selectedProviderReview?.decision || "")}
                      {" for revision R"}
                      {String(selectedProviderReview?.quotation_revision || selected.attributes.revision)}
                    </strong>
                    <small>Customer acceptance remains a separate action.</small>
                  </div>
                  {selectedProviderReview?.reviewer && (
                    <div className="quotation-provider-review-reviewer">
                      <small>Reviewed by</small>
                      <strong>{selectedProviderReview.reviewer.name || "Provider reviewer"}</strong>
                      {selectedProviderReview.reviewer.email && <span>{selectedProviderReview.reviewer.email}</span>}
                    </div>
                  )}
                  {selectedProviderReview?.reason && (
                    <p className="quotation-provider-review-reason">{selectedProviderReview.reason}</p>
                  )}
                </div>
              ) : (
                <div className="quotation-provider-review-pending">
                  <p>
                    Internal approval is required before the customer can accept
                    this issued revision.
                  </p>
                  {hasPermission("QUOTATION_APPROVE") && (
                    <div className="quotation-detail-actions">
                      <Button
                        disabled={busy}
                        onClick={() => setReviewDialog("approve")}
                      >
                        Approve revision
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => setReviewDialog("reject")}
                      >
                        Reject revision
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}
      {(!detailTabVisible || activeDetailTab === "review") && (
        <>
          {convertedContract &&
            String(convertedContract.attributes.status || "").toLowerCase() ===
              "draft" && (
              <div className="detail-card">
                <h4>Renewal contract draft</h4>
                <p>
                  Customer acceptance is recorded. Activate this successor only
                  through the authorized provider workflow.
                </p>
                <Button
                  onClick={() => void activateConvertedContract()}
                  disabled={busy}
                >
                  Activate paid AMC renewal
                </Button>
              </div>
            )}
          {String(selected.attributes.purpose || "").toUpperCase() ===
            "CONTRACT_RENEWAL" && (
            <section className="detail-card" aria-label="AMC renewal history">
              <h4>AMC renewal history</h4>
              <dl>
                <dt>Predecessor</dt>
                <dd>
                  {renewalPredecessor
                    ? `${String(renewalPredecessor.attributes.name || renewalPredecessor.attributes.contract_number || "Previous contract")} · ${displayLabel(renewalPredecessor.attributes.status, "Not available")}`
                    : "Not recorded"}
                </dd>
                <dt>Successor</dt>
                <dd>
                  {convertedContract
                    ? `${String(convertedContract.attributes.name || convertedContract.attributes.contract_number || "Successor contract")} · ${displayLabel(convertedContract.attributes.status, "Not available")}`
                    : "Not activated"}
                </dd>
              </dl>
              <p className="notice">
                The predecessor coverage remains historical; the successor is a
                separate accepted provider contract.
              </p>
            </section>
          )}
          <QuotationConversationPanel
            providerId={providerId}
            quotationId={selected.id}
            revision={Number(selected.attributes.revision || 1)}
            quotationStatus={String(selected.attributes.status || "")}
          />
        </>
      )}
    </aside>
  ) : null;

function QuotationConversationPanel({ providerId, quotationId, revision, quotationStatus }: { providerId: string; quotationId: string; revision: number; quotationStatus: string }) {
  const [thread, setThread] = useState<Collection<GenericAttributes> | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => { let active = true; setThread(null); operationsData.quotationCommunications(providerId, quotationId).then((value) => { if (active) setThread(value); }).catch(() => { if (active) setThread({ data: [] }); }); return () => { active = false; }; }, [providerId, quotationId]);
  const canReply = ["issued", "viewed", "under_review", "revision_requested"].includes(quotationStatus.toLowerCase());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!body.trim()) return; setBusy(true); setNotice("");
    try { await operationsData.createQuotationCommunication(providerId, quotationId, { expected_revision: revision, message_type: "REPLY", body: body.trim() }, crypto.randomUUID()); setThread(await operationsData.quotationCommunications(providerId, quotationId)); setBody(""); setNotice("Reply sent. The customer will see it in their secure quotation review."); }
    catch (cause) { setNotice((cause as Error)?.message || "Reply could not be sent."); }
    finally { setBusy(false); }
  }
  return <section className="detail-card quotation-communication-panel" aria-label="Customer quotation conversation"><h4>Customer conversation</h4><p>Replies are visible to the linked customer after sign-in and are recorded against this quotation version.</p><div className="quotation-communication-thread" aria-live="polite">{thread === null ? <p role="status">Loading conversation…</p> : thread.data.length ? thread.data.map((item) => <article key={item.id}><header><strong>{String(item.attributes.author_name || "Quotation participant")}</strong><span>{String(item.attributes.message_type || "message").replaceAll("_", " ")} · R{String(item.attributes.quotation_revision || "—")}</span></header><p>{String(item.attributes.body || "")}</p></article>) : <p>No customer messages yet.</p>}</div>{canReply ? <form onSubmit={(event) => void submit(event)}><label>Reply to customer<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} rows={4} required /></label><Button type="submit" disabled={busy || !body.trim()}>{busy ? "Sending…" : "Send reply"}</Button>{notice && <p role="status">{notice}</p>}</form> : <p>This quotation is closed for new messages. Existing conversation remains available.</p>}</section>;
}

  if (initialCreate && !hasPermission("QUOTATION_CREATE")) {
    return (
      <section className="content provider-leads quotation-form-route">
        <PageHeader
          eyebrow="Sales &amp; Marketing"
          title="Quotation access"
          description="Quotation creation is controlled by the provider role and server capability."
        />
        <p className="notice state-error" role="alert">
          This session can review authorized quotations, but it cannot create a
          quotation. Return to the quotation register to continue reviewing the
          lifecycle.
        </p>
        <Button variant="secondary" onClick={() => { window.location.hash = "quotations"; }}>
          Back to quotations
        </Button>
      </section>
    );
  }

  if (initialCreate && !initialPurpose && !initialTemplateId) {
    const projectTypes = [
      ["INSTALLATION", "New installation", "New elevator supply, installation and handover scope.", "building", "01"],
      ["MODIFICATION", "Modification", "Modernization, upgrade or changes to installed equipment.", "settings", "02"],
      ["TAKEOVER", "Takeover", "Take over ongoing maintenance for an existing installation.", "clipboard", "03"],
    ] as const;
    const serviceTypes = [
      ["SERVICE", "Service / repair", "Quote a repair, callout or other elevator service work.", "activity", "04"],
      ["MAINTENANCE_CONTRACT", "AMC quotation", "Select a published AMC plan and quote it against the customer’s lifts.", "calendar", "05"],
    ] as const;
    const renderType = ([purpose, title, description, icon, number]: typeof projectTypes[number] | typeof serviceTypes[number]) => <button type="button" className="quotation-type-card" key={purpose} onClick={() => { window.location.hash = `quotations/new/${purpose}`; }}><span className="quotation-type-card-icon"><SvgIcon name={icon} size={21} /></span><span className="quotation-type-card-copy"><small className="quotation-type-number">TYPE {number}</small><strong>{title}</strong><span>{description}</span></span><span className="quotation-type-arrow" aria-hidden="true">→</span></button>;
    return <section className="content feature-page quotation-type-picker"><PageHeader eyebrow="Sales & Marketing · Quotations" title="Choose quotation type" description="Start with the work you’re quoting. We’ll open a form tailored to that quotation type." action={<Button variant="secondary" onClick={() => { window.location.hash = "quotations"; }}>← Back to quotations</Button>} /><div className="quotation-type-intro"><div className="quotation-type-intro-mark"><SvgIcon name="clipboard" size={23} /></div><div><strong>What are you quoting today?</strong><span>Choose a category below. You can review customer, scope and commercial details on the next page.</span></div></div><section className="quotation-type-section"><header><div><span>PROJECT &amp; DELIVERY</span><h2>Installation and project work</h2></div><small>3 quotation types</small></header><div className="quotation-type-grid">{projectTypes.map(renderType)}</div></section><section className="quotation-type-section"><header><div><span>SERVICE &amp; MAINTENANCE</span><h2>Ongoing service</h2></div><small>2 quotation types</small></header><div className="quotation-type-grid">{serviceTypes.map(renderType)}</div></section></section>;
  }

  if (initialCreate && initialPurpose === "MAINTENANCE_CONTRACT") {
    return <ProviderAmcQuotationCreatePage providerId={providerId} relationshipOptions={selectableRelationships} />;
  }

  if (initialCreate) {
    return (
      <section className="content provider-leads quotation-form-route">
        <QuotationFormPage
          mode="create"
          busy={busy}
          providerId={providerId}
          relationshipOptions={selectableRelationships}
          leads={leads?.data || []}
          relationshipsError={relationshipsError}
          relationshipsLoading={relationshipsLoading || loadingMoreRelationships}
          relationshipsHaveMore={Boolean(relationships?.page?.next)}
          onLoadMoreRelationships={() => void loadMoreCustomerRelationships()}
          initialDescription="Elevator installation"
          initialLiftUnitCodes="Lift 1"
          initialPurpose={initialPurpose || "INSTALLATION"}
          initialTemplateId={initialTemplateId}
          templates={materialScopeTemplates}
          termsTemplates={quotationTermsTemplates}
          taxRules={quotationTaxRules}
          onCreateTemplate={saveMaterialScopeTemplate}
          onSubmit={createQuotation}
          onCancel={() => {
            window.location.hash = initialPurpose ? "quotations/new" : "quotations";
          }}
        />
        <QuotationActionNotifications
          message={message}
          error={error}
          onDismissMessage={() => setMessage("")}
          onDismissError={() => setError("")}
        />
      </section>
    );
  }

  if (initialQuotationId && selected && (detailDialog === "edit" || detailDialog === "revision")) {
    const editMode = detailDialog;
    return (
      <section className="content provider-leads quotation-form-route">
        <QuotationFormPage
          mode={editMode}
          busy={busy}
          providerId={providerId}
          initialDescription={
            editMode === "edit"
              ? String(selectedLines[0]?.description || "Elevator installation")
              : "Revised elevator installation"
          }
          initialLiftUnitCodes={editableQuotationUnitCodes.join(", ") || "Lift 1"}
          initialRequirementUnitCodes={selectedRequirementUnitCodes}
          initialPurpose={String(selected.attributes.purpose || "INSTALLATION")}
          initialAmount={String(selectedLines[0]?.amount || "")}
          initialMaterials={selectedQuotationMaterials}
          initialTerms={selected.attributes.terms as Record<string, unknown> | undefined}
          templates={materialScopeTemplates}
          termsTemplates={quotationTermsTemplates}
          taxRules={quotationTaxRules}
          onCreateTemplate={saveMaterialScopeTemplate}
          onSubmit={editMode === "edit" ? updateDraftQuotation : createQuotationRevision}
          onCancel={() => setDetailDialog(null)}
        />
        <QuotationActionNotifications
          message={message}
          error={error}
          onDismissMessage={() => setMessage("")}
          onDismissError={() => setError("")}
        />
      </section>
    );
  }

  return (
    <section
      className={`content provider-leads${initialQuotationId ? " quotation-detail-route" : ""}`}
    >
      {!initialQuotationId && (
        <PageHeader
          eyebrow="Sales & Marketing"
          title="Quotations & Orders"
          description="Build, review and convert provider-scoped commercial revisions."
          action={
            <div className="quotation-workspace-actions">
              {hasPermission("QUOTATION_CREATE") && (
                <Button
                  type="button"
                  onClick={() => {
                    window.location.hash = "quotations/new";
                  }}
                >
                  + New quotations
                </Button>
              )}
            </div>
          }
        />
      )}
      <div className="feature-summary-grid quotation-summary-grid">
        <div>
          <span>Drafts on page</span>
          <strong>{draftCount}</strong>
          <small>Current server page</small>
        </div>
        <div>
          <span>Awaiting approval</span>
          <strong>{approvalCount}</strong>
          <small>Current server page</small>
        </div>
        <div>
          <span>Accepted on page</span>
          <strong>{acceptedCount}</strong>
          <small>Current server page</small>
        </div>
        <div>
          <span>Stage billing due</span>
          <strong>—</strong>
          <small>View Projects &amp; Stages</small>
        </div>
      </div>
      {initialAmcOpen && (
        <OperationsDialog
          title="Create initial AMC quotation"
          busy={busy}
          onClose={() => setInitialAmcOpen(false)}
        >
          <div className="quotation-renewal-dialog-content">
            <p className="notice">
              Create an asset-scoped paid AMC quotation for an existing customer. The accepted quotation becomes the contract source; acceptance and activation remain separate steps.
            </p>
            <form className="quotation-modal-form" onSubmit={(event) => void createInitialAmcQuotation(event)}>
              <label>
                Elevator asset
                <SortedSelect name="asset_id" required defaultValue="">
                  <option value="">Select customer elevator</option>
                  {amcAssets?.data.map((item) => {
                    const relationship = item.relationships.customer_relationship;
                    return (
                      <option key={item.id} value={item.id} disabled={!relationship || Array.isArray(relationship)}>
                        {String(item.attributes.name || "Elevator asset")} · {String(item.attributes.customer_name || "Customer relationship unavailable")}
                      </option>
                    );
                  })}
                </SortedSelect>
              </label>
              <label>
                Paid AMC plan
                <SortedSelect name="provider_service_plan_id" required defaultValue="">
                  <option value="">Select published plan</option>
                  {amcPlans?.data.filter((item) => {
                    const version = item.attributes.current_version as Record<string, unknown> | undefined;
                    return String(version?.status || "").toUpperCase() === "PUBLISHED" && !/^FREE_AMC(?:_|$)/i.test(String(item.attributes.code || ""));
                  }).map((item) => (
                    <option key={item.id} value={item.id}>{String(item.attributes.name || item.attributes.code || "AMC plan")}</option>
                  ))}
                </SortedSelect>
              </label>
              <p className="field-hint">Included free AMC is granted through accepted installation and handover; it cannot be sold as a paid quotation.</p>
              <label>
                Quotation description
                <input name="description" required defaultValue="Paid AMC service agreement" />
              </label>
              <div className="quotation-renewal-date-grid">
                <label>
                  Effective from
                  <input name="effective_from" type="date" required defaultValue={dateInputValue(new Date())} />
                </label>
                <label>
                  Effective to
                  <input name="effective_to" type="date" required defaultValue={dateInputValue(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))} />
                </label>
              </div>
              <div className="quotation-renewal-date-grid">
                <label>Floors served<input name="served_floors_above_ground" type="number" min="1" /></label>
                <label>Passenger capacity<input name="passenger_capacity" type="number" min="1" /></label>
              </div>
              <div className="quotation-renewal-date-grid">
                <label>Number of stops<input name="number_of_stops" type="number" min="1" /></label>
                <label>Lift type<input name="lift_type" placeholder="e.g. PASSENGER" /></label>
              </div>
              <div className="quotation-renewal-date-grid">
                <label>Usage class<input name="usage_class" placeholder="e.g. RESIDENTIAL" /></label>
                <label>Audience<SortedSelect name="audience" defaultValue="MIXED"><option value="MIXED">Mixed</option><option value="RESIDENTIAL">Residential</option><option value="COMMERCIAL">Commercial</option></SortedSelect></label>
              </div>
              <label>Travel height (m)<input name="travel_height_m" type="number" min="0.1" step="0.1" /></label>
              <QuotationTermsEditor
                initialTerms={{ validity_days: 30, included_free_amc: { months: 0 } }}
                templates={quotationTermsTemplates}
                stagePaymentsEnabled={false}
                amcMode
              />
              <div className="provider-form-actions">
                <Button type="button" variant="secondary" onClick={() => setInitialAmcOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!amcPlans?.data.length || !amcAssets?.data.length}>Create draft quotation</Button>
              </div>
            </form>
          </div>
        </OperationsDialog>
      )}
      {renewalOpen && (
        <OperationsDialog
          title="Create paid AMC renewal quotation"
          busy={busy}
          onClose={() => {
            setRenewalOpen(false);
            setRenewalFormPredecessorId("");
          }}
        >
          <div className="quotation-renewal-dialog-content">
            <p className="notice">
              This creates a provider-scoped renewal quotation against an active
              predecessor. The customer must accept the exact quotation revision
              before a separate successor contract can be activated.
            </p>
            <form
              className="quotation-modal-form"
              onSubmit={(event) => {
                void createRenewalQuotation(event);
              }}
            >
              <label>
                Predecessor contract
                <SortedSelect
                  name="predecessor_contract_id"
                  value={renewalFormPredecessorId}
                  onChange={(event) => setRenewalFormPredecessorId(event.target.value)}
                  required
                  disabled={!contracts}
                >
                  <option value="">{contractsLoading || !contracts ? "Loading active contracts…" : "Select active contract"}</option>
                  {contracts?.data
                    .filter((item) =>
                      ["active", "approved"].includes(
                        String(item.attributes.status || "").toLowerCase(),
                      ),
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {String(
                          item.attributes.name ||
                            item.attributes.contract_number ||
                            "Active contract",
                        )}{" "}
                        · {displayLabel(item.attributes.status, "Not available")}
                      </option>
                    ))}
                </SortedSelect>
              </label>
              {contracts && !contracts.data.some((item) =>
                ["active", "approved"].includes(String(item.attributes.status || "").toLowerCase()),
              ) && <p className="notice">No active maintenance contracts are available for renewal.</p>}
              <label>
                Description
                <input
                  name="description"
                  required
                  defaultValue="Paid AMC renewal"
                />
              </label>
              <div className="form-grid-two">
                <label>
                  AMC plan
                  <SortedSelect name="provider_service_plan_id" required disabled={!amcPlans}>
                    <option value="">{amcPlans ? "Select active published plan" : "Loading plans…"}</option>
                    {amcPlans?.data.map((item) => {
                      const version = item.attributes.current_version as Record<string, unknown> | undefined;
                      if (String(version?.status || "").toUpperCase() !== "PUBLISHED" || /^FREE_AMC(?:_|$)/i.test(String(item.attributes.code || ""))) return null;
                      return <option key={item.id} value={item.id}>{String(item.attributes.name || item.attributes.code || "AMC plan")} · v{String(version?.version || "1")}</option>;
                    })}
                  </SortedSelect>
                  <small>Rates and tax treatment are evaluated by the published provider catalogue.</small>
                </label>
                <label>
                  Covered elevator asset
                  <SortedSelect name="asset_id" required disabled={!amcAssets}>
                    <option value="">
                      {amcAssets
                        ? renewalFormPredecessorId
                          ? renewalFormAssets.length
                            ? "Select covered elevator asset"
                            : "No assets linked to this customer"
                          : "Select a predecessor contract first"
                        : "Loading assets…"}
                    </option>
                    {renewalFormAssets.map((item) => (
                      <option key={item.id} value={item.id}>
                        {String(item.attributes.display_name || item.attributes.name || item.attributes.equipment_code || "Elevator asset")}
                      </option>
                    ))}
                  </SortedSelect>
                  {renewalFormPredecessorId && renewalFormAssets.length === 0 && (
                    <small role="status">
                      No elevator assets are linked to the predecessor contract's customer relationship.
                    </small>
                  )}
                </label>
              </div>
              <div className="form-grid-three quotation-amc-context-grid">
                <label>Audience<SortedSelect name="audience" defaultValue="MIXED"><option>RESIDENTIAL</option><option>COMMERCIAL</option><option>MIXED</option></SortedSelect></label>
                <label>Passenger capacity<input name="passenger_capacity" type="number" min="1" step="1" required /></label>
                <label>Floors above ground<input name="served_floors_above_ground" type="number" min="1" step="1" required /></label>
                <label>Lift type<input name="lift_type" placeholder="MRL" /></label>
                <label>Usage class<input name="usage_class" placeholder="PASSENGER" /></label>
                <label>Stops<input name="number_of_stops" type="number" min="1" step="1" /></label>
                <label>Travel height (m)<input name="travel_height_m" type="number" min="0.1" step="0.1" /></label>
              </div>
              <p className="notice">No manual price is accepted here. The selected published plan version calculates the renewal amount on the server and stores the exact pricing context in the quotation snapshot.</p>
              <div className="quotation-renewal-date-grid">
                <label>
                  Effective from
                  <input name="effective_from" type="date" required />
                </label>
                <label>
                  Effective to
                  <input name="effective_to" type="date" required />
                </label>
              </div>
              <QuotationTermsEditor
                initialTerms={{ validity_days: 30, included_free_amc: { months: 0 } }}
                templates={quotationTermsTemplates}
                stagePaymentsEnabled={false}
                amcMode
              />
              <div className="provider-form-actions">
                <Button
                  type="button"
                  variant="quiet"
                  disabled={busy}
                  onClick={() => setRenewalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    !contracts?.data.some((item) =>
                      ["active", "approved"].includes(
                        String(item.attributes.status || "").toLowerCase(),
                      ),
                    )
                  }
                >
                  {busy ? "Saving…" : "Create renewal quotation"}
                </Button>
              </div>
            </form>
          </div>
        </OperationsDialog>
      )}
      <div className="leads-filters quotations-filters">
        <label>
          Search quotations
          <input
            aria-label="Search quotations"
            type="search"
            maxLength={quotationSearchMode === "email" ? 254 : quotationSearchMode === "phone" ? 32 : quotationSearchMode === "quotation_id" ? 64 : 200}
            autoComplete="off"
            inputMode={quotationSearchMode === "phone" ? "tel" : quotationSearchMode === "email" ? "email" : undefined}
            placeholder={quotationSearchMode === "quotation" ? "Quotation number or description" : quotationSearchMode === "quotation_id" ? "Quotation UUID or number" : quotationSearchMode === "email" ? "Customer email" : "Customer phone"}
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
          />
        </label>
        <label>
          Search by
          <SortedSelect
            aria-label="Search quotations by"
            value={quotationSearchMode}
            onChange={(event) => setQuotationSearchMode(event.target.value as "quotation" | "quotation_id" | "email" | "phone")}
          >
            <option value="quotation">Quotation details</option>
            <option value="quotation_id">Quotation ID / number</option>
            <option value="email">Customer email</option>
            <option value="phone">Customer phone</option>
          </SortedSelect>
        </label>
        <label>
          Quote status
          <SortedSelect
            aria-label="Filter quotations by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            {[
              ...new Set(
                quotations.data.map((quotation) => quoteStatus(quotation)),
              ),
            ].map((status) => (
              <option key={status} value={status}>
                {status.toUpperCase()}
              </option>
            ))}
          </SortedSelect>
        </label>
        {queryText.trim() && quotationSearchMode === "quotation_id" && queryText.trim().length < 3 && (
          <small>Enter a quotation UUID or number to search.</small>
        )}
        {queryText.trim() && quotationSearchMode === "email" && queryText.trim().length < 3 && (
          <small>Enter at least 3 characters to search by email.</small>
        )}
        {queryText.trim() && quotationSearchMode === "phone" && (queryText.replace(/\D/g, "").length < 3 || queryText.replace(/\D/g, "").length > 20) && (
          <small>Enter 3 to 20 digits to search by phone.</small>
        )}
        <span className="quotations-filter-result">
          Showing {visibleQuotations.length} quotations on this server page
        </span>
      </div>
      <section className="quotations-workspace quotations-workspace--full">
        <div className="quotations-list-panel">
          <div className="section-heading">
            <div>
              <h3>Quotations ({visibleQuotations.length})</h3>
              <p>
                Provider-scoped quotations and accepted orders. Choose View to
                open the authorized quotation workspace.
              </p>
            </div>
            <span>{quotations.data.length} loaded</span>
          </div>
          {visibleQuotations.length === 0 ? (
            <p className="notice">
              {quotations.data.length
                ? "No quotations match the current filters."
                : "No quotations are visible in this provider."}
            </p>
          ) : (
            <div className="quotation-register-scroll">
              <table className="quotation-register">
                <thead>
                  <tr>
                    <th scope="col">Quote no. / customer</th>
                    <th scope="col">Scope / revision</th>
                    <th scope="col">Status</th>
                    <th scope="col">Value (₹)</th>
                    <th scope="col">Last updated</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleQuotations.map((quotation) => {
                    const selectedRow = selected?.id === quotation.id;
                    const lines = quotation.attributes.lines as
                      Array<{ description?: string }> | undefined;
                    const quoteNumber = String(
                      quotation.attributes.quotation_number || "Quotation",
                    );
                    return (
                      <tr
                        key={quotation.id}
                        aria-selected={selectedRow}
                        className={selectedRow ? "is-selected" : undefined}
                      >
                        <td data-label="Quote no. / customer">
                          <button
                            type="button"
                            className="quotation-row-select"
                            aria-pressed={selectedRow}
                            onClick={() => openQuotationDetail(quotation.id)}
                          >
                            {quoteNumber}
                          </button>
                          <small>{customerNameFor(quotation)}</small>
                        </td>
                        <td data-label="Scope / revision">
                          {String(
                            lines?.[0]?.description ||
                              quotation.attributes.purpose ||
                              "—",
                          )}
                          <small>
                            Revision R
                            {String(quotation.attributes.revision || "—")}
                          </small>
                        </td>
                        <td data-label="Status">
                          <Status>
                            {String(
                              quotation.attributes.journey_status_label ||
                                quotation.attributes.status ||
                                "DRAFT",
                            )}
                          </Status>
                          {quotation.attributes.journey_status_label ===
                          "ABANDONED" ? (
                            <small className="workflow-concluded-label">
                              Journey abandoned
                            </small>
                          ) : (
                            quotation.attributes.journey_stage_status ===
                              "COMPLETED" && (
                              <small className="workflow-concluded-label">
                                Workflow concluded
                              </small>
                            )
                          )}
                        </td>
                        <td data-label="Value">{amountFor(quotation)}</td>
                        <td data-label="Last updated">
                          {dateFor(
                            quotation.attributes.updated_at ||
                              quotation.attributes.created_at,
                          )}
                        </td>
                        <td data-label="Actions">
                          <ProviderActionMenu
                            label={`Actions for quotation ${quoteNumber}`}
                            actions={[
                              {
                                id: "view",
                                label: "View quotation",
                                onSelect: () =>
                                  openQuotationDetail(quotation.id),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="server-pagination" aria-label="Quotation pages">
            <div>
              <Button
                type="button"
                variant="secondary"
                disabled={!quotations.page?.previous}
                onClick={() => {
                  automaticQuotationSelection.current = true;
                  setSelected(null);
                  setPageCursor({
                    filterKey: quotationFilterKey,
                    before: quotations.page?.previous || undefined,
                  });
                }}
              >
                Previous
              </Button>
              <Button
                type="button"
                disabled={!quotations.page?.next}
                onClick={() => {
                  automaticQuotationSelection.current = true;
                  setSelected(null);
                  setPageCursor({
                    filterKey: quotationFilterKey,
                    after: quotations.page?.next || undefined,
                  });
                }}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </section>
      {initialQuotationId && !selected && (
        <p className="notice quotation-detail-loading">
          Loading quotation details…
        </p>
      )}
      {selected ? (
        <>
          {initialQuotationId ? (
            <section className="quotation-detail-page">
              <PageHeader
                eyebrow="Sales & Marketing"
                title="Quotation details"
                description="Review the commercial revision and continue the shared business journey."
                action={
                  <div className="quotation-detail-page-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      className="workflow-back-action"
                      onClick={() => {
                        window.location.hash = "quotations";
                      }}
                      title="Back to Sales and Quotations"
                    >
                      <SvgIcon name="arrow-left" size={15} /> Back
                    </Button>
                    <WorkflowChainAction
                      journey={selectedJourney}
                      loading={journeyLoading}
                      currentResourceKind="Quotation"
                      currentResourceId={selected.id}
                    />
                    <WorkflowFollowUpAction
                      providerId={providerId}
                      journeyId={selectedJourney?.id}
                      targetResourceKind="Quotation"
                      targetResourceId={selected?.id || ""}
                      onClick={() => setScheduledFollowUpOpen(true)}
                    />
                    <details
                      ref={moreActionsRef}
                      className="quotation-more-actions"
                      onToggle={(event) => setMoreActionsOpen(event.currentTarget.open)}
                    >
                      <summary aria-label="More actions">
                        More actions <SvgIcon name="chevron-down" size={15} />
                      </summary>
                      <div className="quotation-more-actions-menu" aria-label="More actions">
                        <button type="button" onClick={() => { moreActionsRef.current?.removeAttribute("open"); void openJourneyTimeline(); }}>
                          <SvgIcon name="activity" size={15} /> Timeline
                        </button>
                        <button type="button" onClick={() => { moreActionsRef.current?.removeAttribute("open"); setDetailDialog("customer-preview"); }}>
                          <SvgIcon name="eye" size={15} /> Preview
                        </button>
                        {!quotationIsDraft && (
                          <button type="button" disabled={busy} onClick={() => { moreActionsRef.current?.removeAttribute("open"); void downloadQuotationPdf(); }}>
                            <SvgIcon name="download" size={15} /> PDF
                          </button>
                        )}
                        {quotationReadyToSend && (
                          <button type="button" disabled={busy} onClick={() => { moreActionsRef.current?.removeAttribute("open"); void openQuotationDelivery(); }}>
                            <SvgIcon name="send" size={15} /> Share / send
                          </button>
                        )}
                        <JourneyAbandonAction
                          providerId={providerId}
                          journey={selectedJourney}
                          canAbandon={canAbandon && !workflowConcluded}
                          onAbandoned={(updated) => {
                            setSelectedJourney(updated);
                            setMessage("Journey abandoned. Linked records are now read-only.");
                          }}
                        />
                      </div>
                    </details>
                  </div>
                }
              />
              <div className="quotation-detail-record-header">
                <div className="quotation-detail-identity">
                  <span className="eyebrow">Sales &amp; Quotation</span>
                  <div className="quotation-detail-identity-title">
                    <h2>
                      {String(
                        selected.attributes.quotation_number || "Quotation",
                      )}
                    </h2>
                    <span className="quotation-detail-proposal-label">
                      Commercial proposal
                    </span>
                  </div>
                  <p>
                    {customerNameFor(selected)} · Revision R
                    {String(selected.attributes.revision)} ·{" "}
                    {displayLabel(selected.attributes.purpose, "Commercial scope")}
                  </p>
                </div>
                <div className="quotation-detail-current-step">
                  <span>Current workflow step</span>
                  <strong>
                    {workflowConcluded
                      ? "Quotation stage concluded"
                      : String(
                          selected.attributes.status || "Draft",
                        )}
                  </strong>
                  <small>
                    {workflowConcluded
                      ? "Continue in the linked downstream workflow; this quotation remains read-only."
                      : "Use the focused tabs below to review scope, approvals, and handoff."}
                  </small>
                </div>
                <div className="quotation-detail-record-actions">
                  {!workflowConcluded && (
                    <Button
                      type="button"
                      variant="primary"
                      className="workflow-next-step-action"
                      onClick={navigateQuotationNextStep}
                      title={quotationNextAction.detail}
                    >
                      <SvgIcon name={quotationActionPhase === "project" ? "building" : "arrow-right"} size={15} /> Next step
                    </Button>
                  )}
                  {String(selected.attributes.status).toLowerCase() === "draft" &&
                    hasPermission("QUOTATION_EDIT") && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="quotation-scope-action quotation-scope-action--edit"
                        onClick={() => setDetailDialog("edit")}
                      >
                        Edit material scope
                      </Button>
                    )}
                  <Status>
                    {selectedJourney?.attributes.status === "CANCELLED"
                      ? "ABANDONED"
                      : displayLabel(selected.attributes.status, "Not available")}
                  </Status>
                </div>
                {workflowConcluded && (
                  <div className={`workflow-concluded-inline${quotationJourneyAbandoned ? " workflow-concluded-inline--abandoned" : ""}`} role="status">
                    <span className="workflow-concluded-inline-icon" aria-hidden="true">
                      <SvgIcon name={quotationJourneyAbandoned ? "x" : "shield"} size={14} />
                    </span>
                    <span className="workflow-concluded-inline-copy">
                      <strong>{quotationJourneyAbandoned ? "Journey abandoned — read-only" : "Workflow concluded — read-only"}</strong>
                      <small>
                        {quotationJourneyAbandoned ? "No further updates or downstream actions are allowed." : "Quotation is final. Review and customer history remain available."}
                      </small>
                    </span>
                  </div>
                )}
                {detailTabVisible && quotationAgreementBanner}
              </div>
              <nav
                className="quotation-detail-tabs workflow-detail-tabs"
                role="tablist"
                aria-label="Quotation lifecycle sections"
              >
                {(
                  [
                    ["overview", "Overview"],
                    ["quoted", "Quoted scope"],
                    ["commercial", "Commercial terms"],
                    ["review", "Review & actions"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={activeDetailTab === key}
                    onClick={() => setActiveDetailTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              {quotationDetailPanel}
            </section>
          ) : (
            <OperationsDialog
              title={String(
                selected.attributes.quotation_number || "Quotation",
              )}
              onClose={() => {
                automaticQuotationSelection.current = false;
                setSelected(null);
              }}
              className="quotation-detail-dialog"
            >
              {quotationDetailPanel}
            </OperationsDialog>
          )}
      {detailDialog === "customer-change" && (
        <OperationsDialog
          title="Change quotation customer"
          busy={busy}
          onClose={() => setDetailDialog(null)}
          className="quotation-customer-change-dialog"
        >
          <p className="notice">
            This creates a new draft revision for the selected customer. The current revision stays in quotation history; if it was issued, its delivery and review history stay attached to it and the replacement must be reviewed and issued again.
          </p>
          <p className="notice">
            The linked Lead, request or job, site and assets must belong to the selected customer. The API checks this before making any change. Accepted quotations cannot be reassigned.
          </p>
          {error && <p className="notice state-error" role="alert">{error}</p>}
          <form className="quotation-modal-form" onSubmit={(event) => void changeQuotationCustomer(event)}>
            <SearchableSelect
              label="New customer relationship"
              searchLabel="Search active customer relationships"
              search={customerChangeSearch}
              onSearch={setCustomerChangeSearch}
              value={customerChangeRelationshipId}
              onChange={setCustomerChangeRelationshipId}
              options={eligibleCustomerChangeOptions}
              placeholder="Select the correct customer"
              required
            />
            {!eligibleCustomerChangeOptions.length && (
              <p className="notice">No other active customer relationship is available. Add or activate the correct customer relationship before creating a replacement.</p>
            )}
            <label>
              Reason for change
              <textarea
                name="reason"
                required
                rows={3}
                maxLength={1000}
                value={customerChangeReason}
                onChange={(event) => setCustomerChangeReason(event.target.value)}
              />
            </label>
            <div className="provider-form-actions">
              <Button type="button" variant="quiet" onClick={() => setDetailDialog(null)}>
                Cancel
              </Button>
              <Button type="submit" busy={busy} disabled={busy || !customerChangeRelationshipId || !customerChangeReason.trim()}>
                Create replacement draft
              </Button>
            </div>
          </form>
        </OperationsDialog>
      )}
      {detailDialog === "customer-preview" && (
        <OperationsDialog
          title="Customer quotation preview"
          onClose={closeCustomerQuotationPreview}
          className="quotation-customer-preview-dialog"
        >
          {quotationPdfPreviewUrl ? (
            <section className="quotation-pdf-preview-panel" aria-label="Generated quotation PDF preview">
              <iframe src={quotationPdfPreviewUrl} title="Generated quotation PDF" />
            </section>
          ) : (
            <CustomerQuotationPreview
              quotation={selected}
              customerName={customerNameFor(selected)}
              lines={selectedLines}
              materials={selectedQuotationMaterials}
              terms={selectedQuotationTermsForView}
              taxSummary={selectedTaxSummary}
              moneyFor={moneyFor}
              logoUrl={quotationPreviewLogoUrl}
            />
          )}
          <div className="quotation-customer-preview-actions">
            <small className="quotation-action-hint">{quotationPdfPreviewUrl ? "Generated from the saved quotation revision. Drafts remain unissued." : "Open the generated A4 PDF here to check page breaks and print layout."}</small>
            <div className="quotation-customer-preview-buttons">
              {quotationPdfPreviewUrl && <Button type="button" variant="secondary" onClick={() => void reviewQuotationPdf()}>Web preview</Button>}
              <Button type="button" variant="secondary" onClick={closeCustomerQuotationPreview}>Close preview</Button>
              {!quotationPdfPreviewUrl && <Button type="button" busy={busy} disabled={busy} onClick={() => void reviewQuotationPdf()}>Review PDF</Button>}
            </div>
          </div>
        </OperationsDialog>
      )}
          {detailDialog === "edit" && (
            <OperationsDialog
              title="Edit draft quotation"
              busy={busy}
              onClose={() => setDetailDialog(null)}
            >
              <form
                className="quotation-modal-form"
                onSubmit={(event) => void updateDraftQuotation(event)}
              >
                <input type="hidden" name="lift_unit_codes" value={editableQuotationUnitCodes.join(", ")} readOnly />
                <label>
                  Description
                  <input
                    name="description"
                    required
                    defaultValue={String(
                      (
                        selected.attributes.lines as
                          Array<{ description?: string }> | undefined
                      )?.[0]?.description || "Elevator installation",
                    )}
                  />
                </label>
                <label>
                  Manual total (INR)
                  <input
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Optional when material prices are entered"
                    defaultValue={String(
                      (
                        selected.attributes.lines as
                          Array<{ amount?: string }> | undefined
                      )?.[0]?.amount || "",
                    )}
                  />
                </label>
                <MaterialScopeEditor
                  initialMaterials={quotationMaterialsFromTerms(selected.attributes.terms)}
                  unitCodes={editableQuotationUnitCodes}
                  templates={materialScopeTemplates}
                  taxRules={quotationTaxRules}
                  onCreateTemplate={saveMaterialScopeTemplate}
                />
                <QuotationTermsEditor
                  initialTerms={selected.attributes.terms as Record<string, unknown> | undefined}
                  templates={quotationTermsTemplates}
                  stagePaymentsEnabled={supportsStagePayments(String(selected.attributes.purpose || "INSTALLATION"))}
                />
                <div className="provider-form-actions">
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => setDetailDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" busy={busy}>
                    Save draft
                  </Button>
                </div>
              </form>
            </OperationsDialog>
          )}
          {detailDialog === "revision" && (
            <OperationsDialog
              title="Create quotation revision"
              busy={busy}
              onClose={() => setDetailDialog(null)}
            >
              <p className="notice">
                This creates a new revision; the issued revision remains
                immutable.
              </p>
              <form
                className="quotation-modal-form"
                onSubmit={(event) => void createQuotationRevision(event)}
              >
                <input type="hidden" name="lift_unit_codes" value={editableQuotationUnitCodes.join(", ")} readOnly />
                <label>
                  Description
                  <input
                    name="description"
                    required
                    defaultValue="Revised elevator installation"
                  />
                </label>
                <label>
                  Manual total (INR)
                  <input
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Optional when material prices are entered"
                  />
                </label>
                <MaterialScopeEditor
                  initialMaterials={quotationMaterialsFromTerms(selected.attributes.terms)}
                  unitCodes={editableQuotationUnitCodes}
                  templates={materialScopeTemplates}
                  taxRules={quotationTaxRules}
                  onCreateTemplate={saveMaterialScopeTemplate}
                />
                <QuotationTermsEditor
                  initialTerms={selected.attributes.terms as Record<string, unknown> | undefined}
                  templates={quotationTermsTemplates}
                  stagePaymentsEnabled={supportsStagePayments(String(selected.attributes.purpose || "INSTALLATION"))}
                />
                <div className="provider-form-actions">
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => setDetailDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" busy={busy}>
                    Create revision
                  </Button>
                </div>
              </form>
            </OperationsDialog>
          )}
          {detailDialog === "negotiation" && (
            <OperationsDialog
              title="Record negotiation"
              busy={busy}
              onClose={() => setDetailDialog(null)}
            >
              <form
                className="quotation-modal-form"
                onSubmit={(event) => void recordNegotiation(event)}
              >
                <label>
                  Event
                  <SortedSelect name="event_type">
                    <option value="CUSTOMER_FEEDBACK">Customer feedback</option>
                    <option value="DISCOUNT_REQUESTED">
                      Discount requested
                    </option>
                    <option value="SCOPE_CHANGE">Scope change</option>
                    <option value="TERMS_CHANGE">Terms change</option>
                    <option value="COUNTER_OFFER">Counter offer</option>
                  </SortedSelect>
                </label>
                <label>
                  Notes
                  <textarea name="notes" required maxLength={4000} />
                </label>
                <label>
                  Offered total
                  <input
                    name="offered_total"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </label>
                <div className="provider-form-actions">
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => setDetailDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" busy={busy}>
                    Record negotiation
                  </Button>
                </div>
              </form>
            </OperationsDialog>
          )}
          {reviewDialog && (
            <OperationsDialog
              title={
                reviewDialog === "approve"
                  ? "Approve quotation revision"
                  : "Reject quotation revision"
              }
              busy={busy}
              onClose={() => setReviewDialog(null)}
            >
              <form
                className="quotation-modal-form"
                onSubmit={(event) => void recordProviderReview(event)}
              >
                <p className="notice">
                  This internal decision applies only to quotation revision R
                  {String(selected.attributes.revision)}. It does not record
                  customer acceptance or activate a project.
                </p>
                {reviewDialog === "reject" && (
                  <label>
                    Reason for rejection
                    <textarea
                      name="reason"
                      required
                      minLength={1}
                      maxLength={4000}
                    />
                  </label>
                )}
                <div className="provider-form-actions">
                  <Button
                    type="button"
                    variant="quiet"
                    disabled={busy}
                    onClick={() => setReviewDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" busy={busy}>
                    {reviewDialog === "approve"
                      ? "Approve revision"
                      : "Reject revision"}
                  </Button>
                </div>
              </form>
            </OperationsDialog>
          )}
          {deliveryOpen && (
            <OperationsDialog
              title="Send approved quotation revision"
              busy={busy}
              onClose={() => setDeliveryOpen(false)}
              className="quotation-delivery-dialog"
            >
              <div className="quotation-delivery-modal">
                <section className="quotation-delivery-summary-panel" aria-label="Approved quotation summary">
                  <div className="quotation-delivery-summary-icon" aria-hidden="true">
                    <SvgIcon name="send" size={20} />
                  </div>
                  <div className="quotation-delivery-summary-copy">
                    <span className="eyebrow">Customer delivery</span>
                    <h3>{String(selected.attributes.quotation_number || "Quotation")} · Revision R{String(selected.attributes.revision)}</h3>
                    <p>Send the provider-approved commercial revision to an authorised customer email or mobile contact.</p>
                  </div>
                  <Status>Approved</Status>
                </section>

                <dl className="quotation-delivery-facts">
                  <div><dt>Customer</dt><dd>{customerNameFor(selected)}</dd></div>
                  <div><dt>Approval mode</dt><dd>{onlineCustomerApprovalEnabled ? "Online approval" : "Offline agreement copy"}</dd></div>
                  <div><dt>Provider review</dt><dd>{selectedProviderReview?.decided_at ? dateTimeFor(selectedProviderReview.decided_at) : "Approved"}</dd></div>
                  <div><dt>Document</dt><dd>Quotation PDF · v{String(selected.attributes.version_number || 1)}</dd></div>
                </dl>
                <section className="quotation-delivery-customer-contacts" aria-label="Contacts available for this quotation">
                  <div><strong>Contacts available for this quotation</strong><small>Saved provider contacts attached to the quotation parties.</small></div>
                  {deliveryRecipients.length ? (
                    <ul>{deliveryRecipients.map((contact) => <li key={contact.id}><strong>{contact.display_name}</strong><span>{contact.email || "No email"}</span><span>{contact.phone || "No mobile"}</span></li>)}</ul>
                  ) : <p>No saved contact details are available. Enter a one-time email below to send this revision.</p>}
                </section>

                <form className="quotation-delivery-form" onSubmit={(event) => void sendQuotationRevision(event)}>
                  <div className="quotation-delivery-section-heading">
                    <div>
                      <span className="eyebrow">Delivery channel</span>
                      <h4>Choose how to send this revision</h4>
                      <p>Email is enabled for this environment. SMS and WhatsApp remain visible for provider channel setup.</p>
                    </div>
                  </div>
                  <div className="quotation-delivery-channels" role="tablist" aria-label="Quotation delivery channel">
                    {(["EMAIL", "SMS", "WHATSAPP"] as QuotationDeliveryChannel[]).map((channel) => (
                      <button key={channel} type="button" role="tab" aria-selected={deliveryChannel === channel} className={deliveryChannel === channel ? "is-active" : ""} onClick={() => { setDeliveryChannel(channel); setDeliveryRecipientMode(hasDeliveryRecipientForChannel(channel) ? "saved" : "manual"); }}>
                        <SvgIcon name={channel === "EMAIL" ? "send" : "users"} size={15} />
                        <span>{channel === "WHATSAPP" ? "WhatsApp" : channel === "SMS" ? "SMS" : "Email"}</span>
                        <small>{channel === "EMAIL" ? "Ready" : "Setup required"}</small>
                      </button>
                    ))}
                  </div>
                  {deliveryChannel !== "EMAIL" && <div className="quotation-delivery-channel-note" role="status"><strong>{deliveryChannel === "SMS" ? "SMS delivery is not configured" : "WhatsApp delivery is not configured"}</strong><span>Enter or select the customer mobile number now. Sending will be enabled when the provider channel adapter is configured.</span></div>}
                  <div className="quotation-delivery-section-heading">
                    <div>
                      <span className="eyebrow">Recipient</span>
                      <h4>Choose or enter a recipient</h4>
                      <p>Use a saved provider contact or enter a one-time email or mobile number for this approved revision.</p>
                    </div>
                    <span className="quotation-delivery-count">{deliveryContactsForChannel.length} saved</span>
                  </div>
                  <div className="quotation-delivery-recipient-modes" role="tablist" aria-label="Recipient entry method">
                    <button type="button" role="tab" aria-selected={deliveryRecipientMode === "saved"} className={deliveryRecipientMode === "saved" ? "is-active" : ""} onClick={() => setDeliveryRecipientMode("saved")}>Saved contact</button>
                    <button type="button" role="tab" aria-selected={deliveryRecipientMode === "manual"} className={deliveryRecipientMode === "manual" ? "is-active" : ""} onClick={() => setDeliveryRecipientMode("manual")}>{deliveryChannel === "EMAIL" ? "Enter email" : "Enter mobile"}</button>
                  </div>
                  {deliveryRecipientMode === "saved" ? (
                    deliveryContactsForChannel.length ? (
                      <label className="quotation-delivery-recipient-field">
                        {deliveryChannel === "EMAIL" ? "Customer email contact" : "Customer mobile contact"}
                        <SortedSelect name="contact_point_id" required defaultValue="">
                          <option value="">Choose authorized contact</option>
                          {deliveryContactsForChannel.map((contact) => (
                            <option key={contact.id} value={contact.id}>
                              {contact.display_name} · {deliveryChannel === "EMAIL" ? contact.email : contact.phone}
                            </option>
                          ))}
                        </SortedSelect>
                      </label>
                    ) : (
                      <div className="quotation-delivery-empty" role="status">
                        <span className="quotation-delivery-empty-icon" aria-hidden="true"><SvgIcon name="users" size={18} /></span>
                        <div><strong>No saved {deliveryChannel === "EMAIL" ? "email" : "mobile"} contact</strong><p>There are no active provider-scoped contacts with a valid {deliveryChannel === "EMAIL" ? "email address" : "mobile number"}. Switch to {deliveryChannel === "EMAIL" ? "Enter email" : "Enter mobile"} to continue.</p></div>
                      </div>
                    )
                  ) : (
                    <label className="quotation-delivery-recipient-field">
                      {deliveryChannel === "EMAIL" ? "One-time recipient email" : "One-time recipient mobile"}
                      {deliveryChannel === "EMAIL" ? <input name="recipient_email" type="email" required maxLength={320} placeholder="customer@example.com" autoComplete="email" /> : <input name="recipient_phone" type="tel" required maxLength={20} placeholder="+91 98765 43210" autoComplete="tel" />}
                      <small className="quotation-delivery-field-note">This one-time delivery address is recorded in delivery history. It does not change the customer linked to the quotation.</small>
                    </label>
                  )}
                  <div className="quotation-delivery-actions">
                    <Button type="button" variant="quiet" disabled={busy} onClick={() => setDeliveryOpen(false)}>Close</Button>
                    <Button type="submit" busy={busy} disabled={busy || deliveryChannel !== "EMAIL" || (deliveryRecipientMode === "saved" && !deliveryContactsForChannel.length)}>Send {deliveryChannel === "EMAIL" ? "email" : deliveryChannel === "SMS" ? "SMS" : "WhatsApp"}</Button>
                  </div>
                </form>

                <section className="quotation-delivery-history" aria-label="Quotation delivery history">
                  <div className="quotation-delivery-section-heading">
                    <div><span className="eyebrow">Audit trail</span><h4>Delivery history</h4></div>
                    <span className="quotation-delivery-count">{deliveryHistory?.data.length || 0} attempts</span>
                  </div>
                  {deliveryHistory?.data.length ? (
                    <ul>
                      {deliveryHistory.data.map((row) => (
                        <li key={row.id}>
                          <Status>{displayLabel(row.attributes.status, "Queued")}</Status>
                          <div><strong>{String(row.attributes.recipient_name || "Customer contact")}</strong><small>{String(row.attributes.recipient_email || "Email unavailable")} · Revision R{String(row.attributes.quotation_revision || selected.attributes.revision)}</small></div>
                          <time>{dateTimeFor(row.attributes.requested_at)}</time>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="quotation-delivery-history-empty">No delivery attempts have been recorded for this revision.</p>
                  )}
                </section>
              </div>
            </OperationsDialog>
          )}
          {journeyOpen && (
            <JourneyTimelineDialog
              journey={selectedJourney}
              loading={journeyLoading}
              error={journeyError}
              onClose={() => setJourneyOpen(false)}
            />
          )}
          <WorkflowFollowUpDialog
            open={scheduledFollowUpOpen}
            onClose={() => setScheduledFollowUpOpen(false)}
            providerId={providerId}
            targetResourceKind="Quotation"
            targetResourceId={selected?.id || ""}
            stage="QUOTATION"
            readOnly={workflowConcluded}
            title="Activity & follow-up history"
          />
          {followUpOpen && (
            <OperationsDialog
              title="Record interaction"
              busy={busy || followUpLoading}
              className="lead-workflow-dialog"
              onClose={() => setFollowUpOpen(false)}
            >
              <div className="lead-follow-up-dialog">
                <section className="lead-follow-up-dialog-history">
                  <div className="lead-dialog-section-heading">
                    <div>
                      <span className="eyebrow">Quotation interactions</span>
                      <h3>Interaction history</h3>
                      <p>
                        Previous interactions for the linked Lead are shown from
                        oldest to newest.
                      </p>
                    </div>
                    <strong>{followUpActivities.length} recorded</strong>
                  </div>
                  {!linkedLeadId ? (
                    <p className="notice">
                      This quotation has no linked Lead. Link it to a Lead
                      before recording follow-up activity.
                    </p>
                  ) : followUpActivities.length ? (
                    <ol className="lead-detail-activity-list">
                      {sortQuotationActivities(followUpActivities).map(
                        (activity) => (
                          <li key={activity.id}>
                            <div>
                              <strong>
                                {journeyLabel(
                                  String(
                                    activity.attributes.activity_type ||
                                      "Activity",
                                  ),
                                )}
                              </strong>
                              <small>
                                {journeyTime(
                                  String(activity.attributes.occurred_at || ""),
                                )}
                              </small>
                            </div>
                            <p>
                              {String(
                                activity.attributes.notes ||
                                  activity.attributes.outcome ||
                                  "No notes recorded",
                              )}
                            </p>
                            {activity.attributes.outcome != null && (
                              <small>
                                Outcome: {String(activity.attributes.outcome)}
                              </small>
                            )}
                            {activity.attributes.next_action != null && (
                              <small>
                                Next action:{" "}
                                {String(activity.attributes.next_action)}
                              </small>
                            )}
                          </li>
                        ),
                      )}
                    </ol>
                  ) : (
                    <p className="notice">
                      No interaction has been recorded yet.
                    </p>
                  )}
                </section>
                {linkedLeadId && (
                  <form
                    className="lead-workflow-form lead-follow-up-dialog-form"
                    onSubmit={(event) => void recordQuotationFollowUp(event)}
                  >
                    <h3>New interaction details</h3>
                    <fieldset>
                      <legend>Interaction</legend>
                      <label>
                        Lead
                        <input
                          value={
                            linkedLead
                              ? `${String(linkedLead.attributes.reference_code || "Linked Lead")} · ${String(linkedLead.attributes.title || "Lead")}`
                              : "Linked Lead"
                          }
                          readOnly
                        />
                      </label>
                      <label>
                        Activity type
                        <SortedSelect name="activity_type" defaultValue="CALL">
                          <option value="CALL">Call</option>
                          <option value="EMAIL">Email</option>
                          <option value="MEETING">Meeting</option>
                          <option value="SITE_VISIT">Site visit</option>
                          <option value="OTHER">Other</option>
                        </SortedSelect>
                      </label>
                      <label>
                        Activity date
                        <input
                          name="occurred_at"
                          type="datetime-local"
                          defaultValue={new Date().toISOString().slice(0, 16)}
                        />
                      </label>
                      <label>
                        Outcome
                        <input name="outcome" maxLength={500} />
                      </label>
                    </fieldset>
                    <fieldset>
                      <legend>Next action and notes</legend>
                      <label>
                        Next action
                        <input name="next_action" maxLength={500} />
                      </label>
                      <label className="lead-form-span">
                        Summary / notes
                        <textarea
                          name="notes"
                          required
                          maxLength={4000}
                          rows={4}
                        />
                      </label>
                    </fieldset>
                    <div className="lead-workflow-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => setFollowUpOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={busy}>
                        {busy ? "Saving…" : "Save interaction"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </OperationsDialog>
          )}
        </>
      ) : null}
      <QuotationActionNotifications
        message={message}
        error={error}
        onDismissMessage={() => setMessage("")}
        onDismissError={() => setError("")}
      />
    </section>
  );
}
