import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, PageHeader } from "@trise/ui";
import { OperationsDialog } from "./operations-dialog";
import {
  operationsData,
  type Collection,
  type GenericAttributes,
  type Resource,
} from "./data";
import { OperationsStatus as Status } from "./operations-status";
import { SearchableSelect } from "./searchable-select";
import { useIndiaGeography } from "./use-india-geography";
import { ActionNotification, ProviderActionMenu, type ProviderAction } from "./operations-shared";

const fail = (cause: unknown) =>
  (cause as { message?: string })?.message ||
  "The request could not be completed.";
const attrs = (row: GenericAttributes) =>
  row.attributes as Record<string, unknown>;
const titleOf = (row: GenericAttributes) =>
  String(
    attrs(row).display_name || attrs(row).name || attrs(row).title || row.id,
  );
const primaryIdentifierOf = (row: GenericAttributes) => {
  const identifier = attrs(row).primary_identifier;
  return identifier && typeof identifier === "object"
    ? (identifier as Record<string, unknown>)
    : undefined;
};
const serviceLocationHierarchyOf = (row: GenericAttributes) => {
  const hierarchy = attrs(row).service_location_hierarchy;
  return Array.isArray(hierarchy)
    ? hierarchy.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    : [];
};
const equipmentCodeOf = (row: GenericAttributes) => {
  const identifiers = attrs(row).identifiers;
  if (!Array.isArray(identifiers)) return "";
  const code = identifiers.find((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && String((item as Record<string, unknown>).identifier_type_code || "").toUpperCase() === "EQUIPMENT_CODE"));
  return code ? String(code.value || "") : "";
};
const relatedId = (value: Resource<GenericAttributes>["relationships"][string]) => Array.isArray(value) ? value[0]?.id : value?.id;
const revisionOf = (row: Resource<GenericAttributes>) =>
  Number(attrs(row).revision || attrs(row).updated_at || 0);
type EditKind = "customer" | "location" | "asset";
export type CustomerWorkspaceView = "customers" | "sites" | "assets";
type BillingForm = {
  address_line: string;
  address_line_2: string;
  locality: string;
  city: string;
  cityCode: string;
  district: string;
  districtCode: string;
  state: string;
  stateCode: string;
  pin_code: string;
};
type CustomerContactForm = { phone: string; email: string };
type CustomerContactErrors = { phone: string; email: string };
type CustomerFieldErrors = {
  displayName: string;
  addressLine: string;
  city: string;
  state: string;
  pinCode: string;
};
const emptyBillingForm: BillingForm = {
  address_line: "",
  address_line_2: "",
  locality: "",
  city: "",
  cityCode: "",
  district: "",
  districtCode: "",
  state: "",
  stateCode: "",
  pin_code: "",
};
const emptyCustomerContact: CustomerContactForm = { phone: "", email: "" };
const emptyCustomerContactErrors: CustomerContactErrors = { phone: "", email: "" };
const emptyCustomerFieldErrors: CustomerFieldErrors = { displayName: "", addressLine: "", city: "", state: "", pinCode: "" };
const duplicatePhoneError = "This phone number is already used by another customer in this provider.";
const duplicateEmailError = "This email address is already used by another customer in this provider.";
const customerDisplayNameError = (value: string) => value.trim() ? "" : "Display name is required.";
const customerPhoneError = (value: string) => {
  const phone = value.trim();
  if (!phone) return "Phone number is required.";
  return /^[6-9][0-9]{9}$/.test(phone)
    ? ""
    : "Enter a valid Indian mobile number with exactly 10 digits.";
};
const customerEmailError = (value: string) => {
  const email = value.trim();
  if (!email) return "";
  return email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    ? ""
    : "Enter a valid email address.";
};
const validateCustomerContact = (value: CustomerContactForm): CustomerContactErrors => ({
  phone: customerPhoneError(value.phone),
  email: customerEmailError(value.email),
});
const customerSiteRelationshipRoles = [
  ["OWNER", "Owner"],
  ["IN_CHARGE", "In-charge"],
  ["BUILDER", "Builder"],
  ["DEVELOPER", "Developer"],
  ["SECURITY", "Security"],
  ["TENANT", "Tenant"],
  ["COMMITTEE", "Committee"],
  ["FACILITY_MANAGER", "Facility manager"],
  ["PROVIDER_RESPONSIBILITY", "Provider responsibility"],
  ["MEMBER", "Member"],
] as const;

export function CustomerOperations({ providerId, canManage = false, view = "customers" }: { providerId: string; canManage?: boolean; view?: CustomerWorkspaceView }) {
  const [customers, setCustomers] = useState<Collection<GenericAttributes>>({
    data: [],
  });
  const [relationships, setRelationships] = useState<
    Collection<GenericAttributes>
  >({ data: [] });
  const [locations, setLocations] = useState<Collection<GenericAttributes>>({
    data: [],
  });
  const [definitions, setDefinitions] = useState<Collection<GenericAttributes>>(
    { data: [] },
  );
  const [assetFamilies, setAssetFamilies] = useState<Collection<GenericAttributes>>({ data: [] });
  const [assetTypes, setAssetTypes] = useState<Collection<GenericAttributes>>({ data: [] });
  const [attributeDefinitions, setAttributeDefinitions] = useState<Collection<GenericAttributes>>({ data: [] });
  const [assets, setAssets] = useState<Collection<GenericAttributes>>({
    data: [],
  });
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerPhoneQuery, setCustomerPhoneQuery] = useState("");
  const [customerEmailQuery, setCustomerEmailQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
  const [customerFilterSearch, setCustomerFilterSearch] = useState("");
  const [locationFilterSearch, setLocationFilterSearch] = useState("");
  const [customerPage, setCustomerPage] = useState<{
    after?: string;
    before?: string;
  }>({});
  const [locationPage, setLocationPage] = useState<{
    after?: string;
    before?: string;
  }>({});
  const [assetPage, setAssetPage] = useState<{
    after?: string;
    before?: string;
  }>({});
  const [pageLimit, setPageLimit] = useState(15);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedDefinitionId, setSelectedDefinitionId] = useState("");
  const [mode, setMode] = useState<"customer" | "location" | "asset" | null>(
    null,
  );
  const [editing, setEditing] = useState<Resource<GenericAttributes> | null>(
    null,
  );
  const [customerToView, setCustomerToView] = useState<Resource<GenericAttributes> | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Resource<GenericAttributes> | null>(null);
  const [editingKind, setEditingKind] = useState<EditKind | null>(null);
  const [locationForm, setLocationForm] = useState({ address: "", city: "", cityCode: "", district: "", districtCode: "", state: "", stateCode: "", pin_code: "" });
  const [billingForm, setBillingForm] = useState<BillingForm>(emptyBillingForm);
  const [customerContactForm, setCustomerContactForm] = useState<CustomerContactForm>(emptyCustomerContact);
  const [customerContactErrors, setCustomerContactErrors] = useState<CustomerContactErrors>(emptyCustomerContactErrors);
  const [customerContactChecking, setCustomerContactChecking] = useState(false);
  const [customerFieldErrors, setCustomerFieldErrors] = useState<CustomerFieldErrors>(emptyCustomerFieldErrors);
  const [customerAddressOpen, setCustomerAddressOpen] = useState(false);
  const locationGeography = useIndiaGeography(locationForm);
  const billingGeography = useIndiaGeography(billingForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [debouncedQueries, setDebouncedQueries] = useState({ customer: "", phone: "", email: "", location: "", asset: "" });
  const loadGeneration = useRef(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQueries({ customer: customerQuery, phone: customerPhoneQuery, email: customerEmailQuery, location: locationQuery, asset: assetQuery }), 250);
    return () => window.clearTimeout(timer);
  }, [customerQuery, customerPhoneQuery, customerEmailQuery, locationQuery, assetQuery]);
  async function load() {
    const generation = ++loadGeneration.current;
    setLoading(true);
    try {
      const [c, r] = await Promise.all([
        operationsData.customers(providerId, { query: debouncedQueries.customer, phone: debouncedQueries.phone, email: debouncedQueries.email, ...customerPage, limit: pageLimit }),
        operationsData.customerRelationships(providerId),
      ]);
      if (generation !== loadGeneration.current) return;
      setCustomers(c);
      setRelationships(r);
      if (view === "customers") {
        setLocations({ data: [] });
        setAssets({ data: [] });
        return;
      }
      const l = await operationsData.locations(providerId, selectedRelationshipId || undefined, { query: debouncedQueries.location, ...locationPage, limit: pageLimit });
      if (generation !== loadGeneration.current) return;
      setLocations(l);
      if (view === "sites") {
        setAssets({ data: [] });
        return;
      }
      const [f, t, d, ad, a] = await Promise.all([
        operationsData.assetFamilies(providerId),
        operationsData.assetTypes(providerId),
        operationsData.assetDefinitions(providerId),
        operationsData.attributeDefinitions(providerId),
        operationsData.assets(providerId, { query: debouncedQueries.asset, ...assetPage, limit: pageLimit, customerRelationshipId: selectedRelationshipId || undefined, locationId: selectedLocationId || undefined }),
      ]);
      if (generation !== loadGeneration.current) return;
      setAssetFamilies(f);
      setAssetTypes(t);
      setDefinitions(d);
      setAttributeDefinitions(ad);
      setAssets(a);
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load().catch((cause) => setError(fail(cause)));
  }, [
    providerId,
    selectedRelationshipId,
    selectedLocationId,
    debouncedQueries,
    customerPage,
    locationPage,
    assetPage,
    pageLimit,
    view,
  ]);
  useEffect(() => {
    setSelectedRelationshipId("");
    setSelectedLocationId("");
    setSelectedAssetId("");
    setCustomerQuery("");
    setCustomerFilterSearch("");
    setLocationFilterSearch("");
    setCustomerPhoneQuery("");
    setCustomerEmailQuery("");
    setLocationQuery("");
    setAssetQuery("");
  }, [providerId, view]);
  useEffect(() => {
    const customerFormOpen = mode === "customer" || editingKind === "customer";
    const phone = customerContactForm.phone.trim();
    const email = customerContactForm.email.trim();
    const phoneDigits = phone.replace(/\D/g, "");
    const canCheckPhone = phoneDigits.length === 10 && !customerPhoneError(phone);
    const canCheckEmail = Boolean(email) && !customerEmailError(email);
    if (!customerFormOpen || (!canCheckPhone && !canCheckEmail)) {
      setCustomerContactChecking(false);
      return;
    }
    let cancelled = false;
    setCustomerContactChecking(true);
    const timer = window.setTimeout(() => {
      const checks = [
        canCheckPhone
          ? operationsData.customers(providerId, { phone: phoneDigits, limit: 15 }).then((result) => ({ kind: "phone" as const, result }))
          : Promise.resolve(null),
        canCheckEmail
          ? operationsData.customers(providerId, { email, limit: 15 }).then((result) => ({ kind: "email" as const, result }))
          : Promise.resolve(null),
      ];
      void Promise.all(checks).then((results) => {
        if (cancelled) return;
        const phoneMatch = results.find((item) => item?.kind === "phone")?.result.data.find((row) => {
          const contact = (attrs(row).contact || {}) as Record<string, unknown>;
          return row.id !== editing?.id && String(contact.phone || "").replace(/\D/g, "") === phoneDigits;
        });
        const emailMatch = results.find((item) => item?.kind === "email")?.result.data.find((row) => {
          const contact = (attrs(row).contact || {}) as Record<string, unknown>;
          return row.id !== editing?.id && String(contact.email || "").trim().toLowerCase() === email.toLowerCase();
        });
        setCustomerContactErrors((current) => ({
          phone: phoneMatch ? duplicatePhoneError : current.phone === duplicatePhoneError ? "" : current.phone,
          email: emailMatch ? duplicateEmailError : current.email === duplicateEmailError ? "" : current.email,
        }));
      }).catch(() => {
        // A transient background lookup failure must not become a form alert.
      }).finally(() => {
        if (!cancelled) setCustomerContactChecking(false);
      });
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setCustomerContactChecking(false);
    };
  }, [customerContactForm.email, customerContactForm.phone, editing?.id, editingKind, mode, providerId]);
  const selectedDefinition = definitions.data.find((row) => row.id === selectedDefinitionId);
  const definitionAttributeIds = selectedDefinition?.relationships.attributes;
  const selectedAttributeIds = Array.isArray(definitionAttributeIds) ? definitionAttributeIds.map((link) => link.id) : definitionAttributeIds ? [definitionAttributeIds.id] : [];
  const selectedAttributes = attributeDefinitions.data.filter((row) => selectedAttributeIds.includes(row.id));
  const selectedRelationship = relationships.data.find((row) => row.id === selectedRelationshipId);
  const selectedCustomer = customers.data.find((row) => relatedId(row.relationships.customer_relationship) === selectedRelationshipId) || customers.data.find((row) => row.id === relatedId(selectedRelationship?.relationships.customer));
  const customerRelationshipActive = (row: Resource<GenericAttributes>) => {
    const relationship = relationships.data.find((item) => item.id === relatedId(row.relationships.customer_relationship));
    return String(attrs(relationship || row).status || "INACTIVE").toUpperCase() === "ACTIVE";
  };
  const ownerPartyId = relatedId(selectedRelationship?.relationships.customer) || selectedCustomer?.id || "";
  const customerRelationshipChoices = [
    ...customers.data.flatMap((customer) => {
      const id = relatedId(customer.relationships.customer_relationship);
      return id ? [{ id, label: titleOf(customer) }] : [];
    }),
    ...relationships.data.filter((relationship) => !customers.data.some((customer) => relatedId(customer.relationships.customer_relationship) === relationship.id)).map((relationship) => ({ id: relationship.id, label: titleOf(customers.data.find((customer) => customer.id === relatedId(relationship.relationships.customer)) || relationship) })),
  ];
  const linkedRows = (value: unknown) => Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
  const linkedPreview = (value: unknown, kind: "location" | "asset") => {
    const rows = linkedRows(value);
    const labels = rows.map((item) => {
      const name = String(item.name || "Unnamed");
      if (kind === "asset") return [name, item.type, item.status].filter(Boolean).map(String).join(" · ");
      return [name, item.classification].filter(Boolean).map(String).join(" · ").replaceAll("_", " ");
    });
    if (!labels.length) return "—";
    return labels.slice(0, 3).join("; ") + (labels.length > 3 ? ` +${labels.length - 3} more` : "");
  };
  const selectedLocation = locations.data.find((row) => row.id === selectedLocationId);
  const selectedAsset = assets.data.find((row) => row.id === selectedAssetId);
  const selectedAssetDefinition = definitions.data.find((row) => row.id === relatedId(selectedAsset?.relationships.definition));
  const selectedAssetType = assetTypes.data.find((row) => row.id === relatedId(selectedAssetDefinition?.relationships.asset_type));
  const selectedAssetFamily = assetFamilies.data.find((row) => row.id === relatedId(selectedAssetType?.relationships.family));
  const definitionLabel = (definition: Resource<GenericAttributes>) => {
    const type = assetTypes.data.find((item) => item.id === relatedId(definition.relationships.asset_type));
    const family = assetFamilies.data.find((item) => item.id === relatedId(type?.relationships.family));
    const definitionName = attrs(definition).display_name || attrs(definition).name || attrs(definition).title || attrs(definition).code || attrs(definition).key || `Definition v${String(attrs(definition).version || "current")}`;
    return [family && titleOf(family), type && titleOf(type), String(definitionName)].filter(Boolean).join(" / ");
  };
  const closeEditor = () => {
    setEditing(null);
    setEditingKind(null);
    setError("");
  };
  const chooseLocationReference = (key: "state" | "district" | "city", id: string) => {
    const options = key === "state" ? locationGeography.stateOptions : key === "district" ? locationGeography.districtOptions : locationGeography.cityOptions;
    const selected = options.find((option) => option.id === id);
    setLocationForm((current) => ({ ...current, [key]: selected?.label || "", [`${key}Code`]: selected?.id || "", ...(key === "state" ? { district: "", districtCode: "", city: "", cityCode: "" } : key === "district" ? { city: "", cityCode: "" } : {}) }));
    if (key === "state") { locationGeography.setDistrictSearch(""); locationGeography.setCitySearch(""); }
    if (key === "district") locationGeography.setCitySearch("");
  };
  const chooseBillingReference = (key: "state" | "district" | "city", id: string) => {
    const options = key === "state" ? billingGeography.stateOptions : key === "district" ? billingGeography.districtOptions : billingGeography.cityOptions;
    const selected = options.find((option) => option.id === id);
    setBillingForm((current) => ({ ...current, [key]: selected?.label || "", [`${key}Code`]: selected?.id || "", ...(key === "state" ? { district: "", districtCode: "", city: "", cityCode: "" } : key === "district" ? { city: "", cityCode: "" } : {}) }));
    if (key === "state") { billingGeography.setDistrictSearch(""); billingGeography.setCitySearch(""); }
    if (key === "district") billingGeography.setCitySearch("");
  };
  const hasBillingAddress = () => Object.values(billingForm).some((value) => String(value).trim().length > 0);
  const billingAddressPayload = () => ({
    country: "India",
    address_line: billingForm.address_line.trim(),
    address_line_2: billingForm.address_line_2.trim(),
    locality: billingForm.locality.trim(),
    city: billingForm.city,
    district: billingForm.district,
    state: billingForm.state,
    pin_code: billingForm.pin_code.trim(),
    country_code: "IN",
    state_code: billingGeography.stateCode,
    district_code: billingGeography.districtCode,
    city_code: billingGeography.cityCode,
  });
  const billingAddressFields = (
    <fieldset className="customer-address-fieldset">
      <legend>Billing address</legend>
      <label>Address line 1 <span className="optional">Optional</span><input aria-invalid={Boolean(customerFieldErrors.addressLine)} aria-describedby={customerFieldErrors.addressLine ? "customer-address-line-error" : undefined} value={billingForm.address_line} onChange={(event) => { setBillingForm((current) => ({ ...current, address_line: event.target.value })); setCustomerFieldErrors((current) => ({ ...current, addressLine: event.target.value.trim() ? "" : current.addressLine })); }} />{customerFieldErrors.addressLine && <span id="customer-address-line-error" className="customer-field-error" role="alert">{customerFieldErrors.addressLine}</span>}</label>
      <label>Address line 2<input value={billingForm.address_line_2} onChange={(event) => setBillingForm((current) => ({ ...current, address_line_2: event.target.value }))} /></label>
      <label>Locality / area<input value={billingForm.locality} onChange={(event) => setBillingForm((current) => ({ ...current, locality: event.target.value }))} /></label>
      <SearchableSelect label="State / UT" searchLabel="Search Indian states and UTs" search={billingGeography.stateSearch} onSearch={billingGeography.setStateSearch} value={billingGeography.stateCode} onChange={(id) => { chooseBillingReference("state", id); setCustomerFieldErrors((current) => ({ ...current, state: id ? "" : current.state })); }} options={billingGeography.stateOptions} placeholder="Select state / UT" required={false} error={customerFieldErrors.state} />
      <SearchableSelect label="District" searchLabel="Search districts in selected state" search={billingGeography.districtSearch} onSearch={billingGeography.setDistrictSearch} value={billingGeography.districtCode} onChange={(id) => chooseBillingReference("district", id)} options={billingGeography.districtOptions} placeholder="Select district" required={false} disabled={!billingGeography.stateCode} />
      <SearchableSelect label="City" searchLabel="Search cities in selected district" search={billingGeography.citySearch} onSearch={billingGeography.setCitySearch} value={billingGeography.cityCode} onChange={(id) => { chooseBillingReference("city", id); setCustomerFieldErrors((current) => ({ ...current, city: id ? "" : current.city })); }} options={billingGeography.cityOptions} placeholder="Select city" required={false} disabled={!billingGeography.districtCode} error={customerFieldErrors.city} />
      <label>PIN code <span className="optional">Optional</span><input aria-invalid={Boolean(customerFieldErrors.pinCode)} aria-describedby={customerFieldErrors.pinCode ? "customer-pin-error" : undefined} inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} value={billingForm.pin_code} onChange={(event) => { const value = event.target.value.replace(/[^0-9]/g, "").slice(0, 6); setBillingForm((current) => ({ ...current, pin_code: value })); setCustomerFieldErrors((current) => ({ ...current, pinCode: value && !/^[1-9][0-9]{5}$/.test(value) ? "Enter a valid 6-digit Indian PIN code." : "" })); }} />{customerFieldErrors.pinCode && <span id="customer-pin-error" className="customer-field-error" role="alert">{customerFieldErrors.pinCode}</span>}</label>
    </fieldset>
  );
  const updateCustomerContact = (field: keyof CustomerContactForm, value: string) => {
    const next = { ...customerContactForm, [field]: value };
    setCustomerContactForm(next);
    setCustomerContactErrors((current) => ({
      ...current,
      [field]: field === "phone" ? customerPhoneError(value) : customerEmailError(value),
    }));
    setError("");
  };
  const validateCustomerContactForm = (value: CustomerContactForm) => {
    const nextErrors = validateCustomerContact(value);
    setCustomerContactErrors(nextErrors);
    return !nextErrors.phone && !nextErrors.email;
  };
  const validateCustomerForm = (displayName: string, contactForm = customerContactForm) => {
    const nextFieldErrors = { ...emptyCustomerFieldErrors };
    nextFieldErrors.displayName = customerDisplayNameError(displayName);
    if (hasBillingAddress()) {
      if (!billingForm.address_line.trim()) nextFieldErrors.addressLine = "Address line 1 is required when an address is added.";
      if (!billingForm.city.trim()) nextFieldErrors.city = "Select a city when an address is added.";
      if (!billingForm.state.trim()) nextFieldErrors.state = "Select a state / UT when an address is added.";
      if (!/^[1-9][0-9]{5}$/.test(billingForm.pin_code.trim())) nextFieldErrors.pinCode = "Enter a valid 6-digit Indian PIN code.";
    }
    setCustomerFieldErrors(nextFieldErrors);
    const contactsValid = validateCustomerContactForm(contactForm);
    return !Object.values(nextFieldErrors).some(Boolean) && contactsValid;
  };
  const applyCustomerApiValidationError = (cause: unknown) => {
    const api = cause as { message?: unknown; details?: unknown };
    const message = String(api.message || "");
    const details = api.details && typeof api.details === "object" && !Array.isArray(api.details)
      ? api.details as Record<string, unknown>
      : {};
    const phoneCustomerIds = details.code === "customer_contact_exists" && Array.isArray(details.phone_customer_ids) ? details.phone_customer_ids : [];
    const emailCustomerIds = details.code === "customer_contact_exists" && Array.isArray(details.email_customer_ids) ? details.email_customer_ids : [];
    const contactErrors = {
      phone: phoneCustomerIds.length || /phone number is required|phone number must contain/i.test(message)
        ? (phoneCustomerIds.length ? duplicatePhoneError : message)
        : "",
      email: emailCustomerIds.length || /email must be valid/i.test(message)
        ? (emailCustomerIds.length ? duplicateEmailError : message)
        : "",
    };
    const fieldErrors = { ...emptyCustomerFieldErrors };
    if (/display_name|display name/i.test(message)) fieldErrors.displayName = "Display name is required.";
    if (/billing_address\.address_line/i.test(message)) fieldErrors.addressLine = "Address line 1 is required when an address is added.";
    if (/billing_address\.city/i.test(message)) fieldErrors.city = "Select a city when an address is added.";
    if (/billing_address\.state/i.test(message)) fieldErrors.state = "Select a state / UT when an address is added.";
    if (/billing_address\.pin_code/i.test(message)) fieldErrors.pinCode = "Enter a valid 6-digit Indian PIN code.";
    const handled = details.code === "customer_contact_exists" || Object.values(contactErrors).some(Boolean) || Object.values(fieldErrors).some(Boolean);
    if (!handled) return false;
    setCustomerContactErrors(contactErrors);
    setCustomerFieldErrors(fieldErrors);
    setError("");
    return true;
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const contactForm = {
      phone: String(form.get("contact_phone") || ""),
      email: String(form.get("contact_email") || ""),
    };
    if (mode === "customer") {
      setCustomerContactForm(contactForm);
    }
    if (mode === "customer" && !validateCustomerForm(String(form.get("display_name") || ""), contactForm)) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "customer")
        await operationsData.createCustomer(
          providerId,
          {
            party_kind: form.get("party_kind"),
            display_name: form.get("display_name"),
            contact: { phone: String(form.get("contact_phone") || "").trim(), email: String(form.get("contact_email") || "").trim() },
            ...(hasBillingAddress() ? { billing_address: billingAddressPayload() } : {}),
          },
          crypto.randomUUID(),
        );
      if (mode === "location")
        await operationsData.createLocation(
          providerId,
          {
            customer_relationship_id: form.get("customer_relationship_id"),
            classification: form.get("classification"),
            name: form.get("name"),
            address_lines: [locationForm.address, locationForm.city, locationForm.district, locationForm.state].map((value) => value.trim()).filter(Boolean),
            address_references: { country_code: "IN", state_code: locationGeography.stateCode, district_code: locationGeography.districtCode, city_code: locationGeography.cityCode, state: locationForm.state, district: locationForm.district, city: locationForm.city, pin_code: locationForm.pin_code },
          },
          crypto.randomUUID(),
        );
      if (mode === "asset")
      {
        if (!selectedDefinition || !ownerPartyId) throw new Error("Choose a customer relationship with an authorized customer before registering an asset.");
        const values = selectedAttributes.flatMap((definition) => {
          const raw = form.get(`attribute:${definition.id}`);
          const valueType = String(attrs(definition).value_type || "STRING").toUpperCase();
          if (["BOOLEAN", "BOOL"].includes(valueType)) return [{ definition_id: definition.id, value: raw === "on" }];
          if (raw === null || raw === "") return [];
          let value: unknown = raw;
          if (["INTEGER", "DECIMAL", "NUMBER", "NUMERIC", "FLOAT"].includes(valueType)) {
            value = Number(raw);
            if (!Number.isFinite(value)) throw new Error(`${String(attrs(definition).label || "Attribute")} must be a valid number.`);
          } else if (["JSON", "OBJECT", "ARRAY"].includes(valueType)) {
            try { value = JSON.parse(String(raw)); } catch { throw new Error(`${String(attrs(definition).label || "Attribute")} must contain valid JSON.`); }
          }
          return [{ definition_id: definition.id, value }];
        });
        const definitionAttrs = attrs(selectedDefinition);
        const identifierTypeId = String(definitionAttrs.primary_identifier_type_id || definitionAttrs.identifier_policy_id || "");
        const identifierValue = String(form.get("primary_identifier") || "").trim();
        const identifiersRequired = String(definitionAttrs.primary_identifier_strategy || "OPTIONAL").toUpperCase() === "REQUIRED";
        if (identifiersRequired && (!identifierTypeId || !identifierValue)) throw new Error("This asset definition requires its configured primary identifier.");
        await operationsData.createAsset(
          providerId,
          {
            name: form.get("name"),
            asset_definition_id: form.get("asset_definition_id"),
            definition_version: definitionAttrs.version,
            customer_relationship_id: form.get("customer_relationship_id"),
            owner_party_id: ownerPartyId,
            site_relationship_role: form.get("site_relationship_role") || undefined,
            location_id: form.get("location_id"),
            values,
            identifier_inputs: identifierValue && identifierTypeId ? [{ identifier_type_id: identifierTypeId, value: identifierValue }] : [],
          },
          crypto.randomUUID(),
        );
      }
      setMessage("Record saved.");
      setMode(null);
      await load();
    } catch (cause) {
      if (mode === "customer" && !applyCustomerApiValidationError(cause)) setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  async function editCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const contactForm = {
      phone: String(form.get("contact_phone") || ""),
      email: String(form.get("contact_email") || ""),
    };
    setCustomerContactForm(contactForm);
    if (!validateCustomerForm(String(form.get("display_name") || ""), contactForm)) return;
    setBusy(true);
    setError("");
    try {
      await operationsData.updateCustomer(
        providerId,
        editing.id,
        {
          display_name: form.get("display_name"),
          contact: { phone: String(form.get("contact_phone") || "").trim(), email: String(form.get("contact_email") || "").trim() },
          ...(hasBillingAddress() ? { billing_address: billingAddressPayload() } : {}),
          expected_revision: revisionOf(editing),
        },
        crypto.randomUUID(),
      );
      setMessage("Customer updated.");
      closeEditor();
      await load();
    } catch (cause) {
      if (!applyCustomerApiValidationError(cause)) setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  async function editLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await operationsData.updateLocation(
        providerId,
        editing.id,
        {
          name: form.get("name"),
          address_lines: [locationForm.address, locationForm.city, locationForm.district, locationForm.state].map((value) => value.trim()).filter(Boolean),
          address_references: { country_code: "IN", state_code: locationGeography.stateCode, district_code: locationGeography.districtCode, city_code: locationGeography.cityCode, state: locationForm.state, district: locationForm.district, city: locationForm.city, pin_code: locationForm.pin_code },
          expected_revision: revisionOf(editing),
        },
        crypto.randomUUID(),
      );
      setMessage("Service location updated.");
      closeEditor();
      await load();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  async function editAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await operationsData.updateAsset(
        providerId,
        editing.id,
        { name: form.get("name"), expected_revision: revisionOf(editing) },
        crypto.randomUUID(),
      );
      setMessage("Asset updated.");
      closeEditor();
      await load();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  async function deleteCustomer() {
    if (!customerToDelete) return;
    setBusy(true);
    setError("");
    try {
      await operationsData.deleteCustomer(providerId, customerToDelete.id, crypto.randomUUID());
      setMessage("Customer unlinked from this provider. The customer identity and history were retained.");
      setCustomerToDelete(null);
      await load();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  const editAttributes = editing ? attrs(editing) : {};
  const viewCustomer = (row: Resource<GenericAttributes>) => {
    setCustomerToView(row);
    const relationshipId = relatedId(row.relationships.customer_relationship);
    if (relationshipId) {
      setSelectedRelationshipId(relationshipId);
      setSelectedLocationId("");
      setSelectedAssetId("");
    }
  };
  const customerRowActions = (row: Resource<GenericAttributes>): ProviderAction[] => {
    const actions: ProviderAction[] = [{ id: "view", label: "View", onSelect: () => viewCustomer(row) }];
    if (!canManage) return actions;
    actions.push({ id: "edit", label: "Edit customer", onSelect: () => openEditor(row, "customer") });
    if (customerRelationshipActive(row)) actions.push({ id: "delete", label: "Delete", tone: "danger", onSelect: () => setCustomerToDelete(row) });
    return actions;
  };
  const openEditor = (row: Resource<GenericAttributes>, kind: EditKind) => {
    setError("");
    setEditing(row);
    setEditingKind(kind);
    if (kind === "customer") {
      const values = attrs(row);
      const contact = (values.contact || {}) as Record<string, unknown>;
      setCustomerContactForm({ phone: String(contact.phone || ""), email: String(contact.email || "") });
      setCustomerContactErrors(emptyCustomerContactErrors);
      setCustomerFieldErrors(emptyCustomerFieldErrors);
      billingGeography.setStateSearch("");
      billingGeography.setDistrictSearch("");
      billingGeography.setCitySearch("");
      const address = (values.billing_address || {}) as Record<string, unknown>;
      setBillingForm({
        ...emptyBillingForm,
        address_line: String(address.address_line || ""),
        address_line_2: String(address.address_line_2 || ""),
        locality: String(address.locality || ""),
        city: String(address.city || ""),
        cityCode: String(address.city_code || ""),
        district: String(address.district || ""),
        districtCode: String(address.district_code || ""),
        state: String(address.state || ""),
        stateCode: String(address.state_code || ""),
        pin_code: String(address.pin_code || ""),
      });
    }
    if (kind === "location") {
      const values = attrs(row);
      const references = (values.address_references || {}) as Record<string, unknown>;
      const lines = Array.isArray(values.address_lines) ? values.address_lines.map(String) : [];
      setLocationForm({ address: lines[0] || "", city: String(references.city || ""), cityCode: String(references.city_code || ""), district: String(references.district || ""), districtCode: String(references.district_code || ""), state: String(references.state || ""), stateCode: String(references.state_code || ""), pin_code: String(references.pin_code || "") });
    }
  };
  const editButton = (row: Resource<GenericAttributes>, kind: EditKind) => (
    canManage ? <Button
      variant="secondary"
      onClick={() => openEditor(row, kind)}
    >
      {kind === "customer" ? "Edit customer" : kind === "location" ? "Edit location" : "Edit asset"}
    </Button> : null
  );
  const copySelectedBillingToShipping = () => {
    const address = (selectedCustomer && attrs(selectedCustomer).billing_address || {}) as Record<string, unknown>;
    setLocationForm({
      address: [address.address_line, address.address_line_2, address.locality].map(String).map((value) => value === "undefined" ? "" : value).filter(Boolean).join(", "),
      city: String(address.city || ""),
      cityCode: String(address.city_code || ""),
      district: String(address.district || ""),
      districtCode: String(address.district_code || ""),
      state: String(address.state || ""),
      stateCode: String(address.state_code || ""),
      pin_code: String(address.pin_code || ""),
    });
    locationGeography.setStateSearch("");
    locationGeography.setDistrictSearch("");
    locationGeography.setCitySearch("");
  };
  const workspaceTitle = view === "customers" ? "Customers" : view === "sites" ? "Sites & locations" : "Assets";
  const workspaceDescription = view === "customers"
    ? "Manage provider-authorized customer identities, billing addresses and relationships."
    : view === "sites"
      ? "Manage physical service and shipping locations linked to authorized customers."
      : "Manage elevators, lifts, escalators and other equipment installed at customer sites.";
  const openCustomerCreate = () => {
    setBillingForm(emptyBillingForm);
    billingGeography.setStateSearch("");
    billingGeography.setDistrictSearch("");
    billingGeography.setCitySearch("");
    setCustomerContactForm(emptyCustomerContact);
    setCustomerContactErrors(emptyCustomerContactErrors);
    setCustomerFieldErrors(emptyCustomerFieldErrors);
    setCustomerAddressOpen(false);
    setError("");
    setMode("customer");
  };
  const customerFormOpen = mode === "customer" || editingKind === "customer";
  return (
    <section className="content feature-page">
      <PageHeader
        title={workspaceTitle}
        description={workspaceDescription}
      />
      {error && !customerFormOpen && <ActionNotification kind="error" title="Customer and asset action needs attention" onClose={() => setError("")}>{error}</ActionNotification>}
      {message && <ActionNotification title="Customer and asset update completed" onClose={() => setMessage("")}>{message}</ActionNotification>}
      {canManage && view !== "customers" && <div className="action-footer customer-workspace-actions">
        {view === "sites" && <Button onClick={() => { setLocationForm({ address: "", city: "", cityCode: "", district: "", districtCode: "", state: "", stateCode: "", pin_code: "" }); setMode("location"); }} disabled={!relationships.data.length}>Add site</Button>}
        {view === "assets" && <Button onClick={() => setMode("asset")} disabled={!relationships.data.length || !definitions.data.length}>Register asset</Button>}
      </div>}
      {mode && (
        <OperationsDialog busy={busy} onClose={() => { setMode(null); setError(""); }} title={
            mode === "customer"
              ? "Add customer"
              : mode === "location"
                ? "Add service location"
                : "Register asset"}
        >
          <form
            className={`provider-form customer-operation-form${mode === "customer" ? " customer-create-form" : mode === "asset" ? " asset-registration-form" : ""}`}
            noValidate={mode === "customer"}
            onSubmit={(event) => void submit(event)}
          >
            {mode === "customer" && error && <p className="customer-form-error" role="alert">{error}</p>}
            {mode === "customer" && (
              <>
                <input type="hidden" name="party_kind" value="PERSON" />
                <fieldset className="customer-contact-fieldset">
                  <legend>Contact details</legend>
                  <label>Display name *<input name="display_name" required aria-invalid={Boolean(customerFieldErrors.displayName)} aria-describedby={customerFieldErrors.displayName ? "customer-display-name-error" : undefined} onChange={(event) => setCustomerFieldErrors((current) => ({ ...current, displayName: customerDisplayNameError(event.target.value) }))} />{customerFieldErrors.displayName && <span id="customer-display-name-error" className="customer-field-error" role="alert">{customerFieldErrors.displayName}</span>}</label>
                  <label>Phone number <span className="required">Required</span><input name="contact_phone" type="tel" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} title="Enter an Indian mobile number with exactly 10 digits." value={customerContactForm.phone} onChange={(event) => updateCustomerContact("phone", event.target.value.replace(/\D/g, "").slice(0, 10))} aria-invalid={Boolean(customerContactErrors.phone)} aria-describedby={customerContactErrors.phone ? "customer-phone-error" : undefined} placeholder="e.g. 8892576065" />{customerContactErrors.phone && <span id="customer-phone-error" className="customer-field-error" role="alert">{customerContactErrors.phone}</span>}</label>
                  <label>Email address <span className="optional">Optional</span><input name="contact_email" type="email" value={customerContactForm.email} onChange={(event) => updateCustomerContact("email", event.target.value)} aria-invalid={Boolean(customerContactErrors.email)} aria-describedby={customerContactErrors.email ? "customer-email-error" : undefined} placeholder="name@example.com" />{customerContactErrors.email && <span id="customer-email-error" className="customer-field-error" role="alert">{customerContactErrors.email}</span>}</label>
                  {customerContactChecking && <small className="customer-contact-checking">Checking provider contacts…</small>}
                </fieldset>
                <Button type="button" variant="secondary" className="customer-add-address-button" onClick={() => setCustomerAddressOpen((open) => !open)}>{customerAddressOpen ? "Hide address" : "Add address"}</Button>
                {customerAddressOpen && billingAddressFields}
              </>
            )}
            {mode === "location" && (
              <>
                <label>
                  Customer relationship *
                  <select name="customer_relationship_id" required>
                    <option value="">Select customer</option>
                    {customerRelationshipChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
                  </select>
                </label>
                <label>
                  Location name *<input name="name" required />
                </label>
                <label>Country<select value="IN" disabled><option value="IN">India</option></select></label>
                <label>Address line / locality *<textarea name="address" required value={locationForm.address} onChange={(event) => setLocationForm((current) => ({ ...current, address: event.target.value }))} /></label>
                <label>PIN code *<input required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} value={locationForm.pin_code} onChange={(event) => setLocationForm((current) => ({ ...current, pin_code: event.target.value.replace(/[^0-9]/g, "").slice(0, 6) }))} /></label>
                <SearchableSelect label="State / UT" searchLabel="Search Indian states and UTs" search={locationGeography.stateSearch} onSearch={locationGeography.setStateSearch} value={locationGeography.stateCode} onChange={(id) => chooseLocationReference("state", id)} options={locationGeography.stateOptions} placeholder="Select state / UT" required />
                <SearchableSelect label="District" searchLabel="Search districts in selected state" search={locationGeography.districtSearch} onSearch={locationGeography.setDistrictSearch} value={locationGeography.districtCode} onChange={(id) => chooseLocationReference("district", id)} options={locationGeography.districtOptions} placeholder="Select district" required disabled={!locationGeography.stateCode} />
                <SearchableSelect label="City" searchLabel="Search cities in selected district" search={locationGeography.citySearch} onSearch={locationGeography.setCitySearch} value={locationGeography.cityCode} onChange={(id) => chooseLocationReference("city", id)} options={locationGeography.cityOptions} placeholder="Select city" required disabled={!locationGeography.districtCode} />
                <div className="customer-address-copy-row"><Button type="button" variant="secondary" disabled={!selectedCustomer || !String((attrs(selectedCustomer).billing_address as Record<string, unknown> | undefined)?.address_line || "").trim()} onClick={copySelectedBillingToShipping}>Copy billing to shipping/site</Button><small>Shipping/site address is the physical location used for delivery, visits and lift service.</small></div>
                <label>
                  Classification
                  <select name="classification">
                    <option>PRIMARY</option>
                    <option>SERVICE_SITE</option>
                  </select>
                </label>
              </>
            )}
            {mode === "asset" && (
              <>
                <label>
                  Customer relationship *
                  <select name="customer_relationship_id" required value={selectedRelationshipId} onChange={(event) => { setSelectedRelationshipId(event.target.value); setSelectedLocationId(""); setSelectedAssetId(""); }}>
                    <option value="">Select customer</option>
                    {customerRelationshipChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
                  </select>
                </label>
                <label>
                  Service location *
                  <select name="location_id" required value={selectedLocationId} onChange={(event) => { setSelectedLocationId(event.target.value); setSelectedAssetId(""); }}>
                    <option value="">Select location</option>
                    {locations.data.map((row) => (
                      <option key={row.id} value={row.id}>
                        {titleOf(row)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Customer role at this site <span className="optional">Optional</span>
                  <select name="site_relationship_role" defaultValue="" disabled={!selectedLocationId}>
                    <option value="">Not specified</option>
                    {customerSiteRelationshipRoles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <small className="form-help">This records a site relationship only. It does not grant portal access or permissions.</small>
                </label>
                <label>
                  Asset family / definition *
                  <select name="asset_definition_id" required value={selectedDefinitionId} onChange={(event) => setSelectedDefinitionId(event.target.value)}>
                    <option value="">Select definition</option>
                    {definitions.data.filter((row) => ["active", "approved"].includes(String(attrs(row).status || "").toLowerCase())).map((row) => (
                      <option key={row.id} value={row.id}>
                        {definitionLabel(row)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Asset name *
                  <input name="name" required />
                </label>
                {selectedAttributes.map((definition) => {
                  const definitionAttrs = attrs(definition);
                  const valueType = String(definitionAttrs.value_type || "STRING").toUpperCase();
                  const label = String(definitionAttrs.label || definitionAttrs.key || "Attribute");
                  const validation = (definitionAttrs.validation_schema || {}) as Record<string, unknown>;
                  const enumValues = Array.isArray(validation.enum) ? validation.enum : [];
                  const common = { name: `attribute:${definition.id}`, required: Boolean(definitionAttrs.required) };
                  const textConstraints = { minLength: typeof validation.minLength === "number" ? validation.minLength : undefined, maxLength: typeof validation.maxLength === "number" ? validation.maxLength : undefined, min: typeof validation.minimum === "number" ? validation.minimum : undefined, max: typeof validation.maximum === "number" ? validation.maximum : undefined, pattern: typeof validation.pattern === "string" ? validation.pattern : undefined };
                  return <label key={definition.id}>{label}{definitionAttrs.unit ? ` (${String(definitionAttrs.unit)})` : ""}{definitionAttrs.required ? " *" : ""}{enumValues.length ? <select {...common}><option value="">Select {label.toLowerCase()}</option>{enumValues.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}</select> : ["BOOLEAN", "BOOL"].includes(valueType) ? <input type="checkbox" name={`attribute:${definition.id}`} /> : ["JSON", "OBJECT", "ARRAY"].includes(valueType) ? <textarea {...common} {...textConstraints} placeholder="Enter the configured JSON value" /> : <input {...common} {...textConstraints} type={["INTEGER", "DECIMAL", "NUMBER", "NUMERIC", "FLOAT"].includes(valueType) ? "number" : valueType === "DATE" ? "date" : "text"} step={["DECIMAL", "NUMBER", "NUMERIC", "FLOAT"].includes(valueType) ? "any" : undefined} />}</label>;
                })}
                {selectedDefinition && String(attrs(selectedDefinition).primary_identifier_strategy || "OPTIONAL").toUpperCase() !== "NONE" && (attrs(selectedDefinition).primary_identifier_type_id || attrs(selectedDefinition).identifier_policy_id || String(attrs(selectedDefinition).primary_identifier_strategy || "OPTIONAL").toUpperCase() === "REQUIRED") && <label>E-Code / primary identifier{String(attrs(selectedDefinition).primary_identifier_strategy || "OPTIONAL").toUpperCase() === "REQUIRED" ? " *" : " (optional)"}<input name="primary_identifier" required={String(attrs(selectedDefinition).primary_identifier_strategy || "OPTIONAL").toUpperCase() === "REQUIRED"} placeholder="For example KAB123A" /><small className="form-help">For elevator, lift and escalator equipment, use the E-Code assigned by your existing system. It is normalized for search and must be unique.</small></label>}
                {selectedDefinition && selectedAttributes.length === 0 && <p className="notice">This definition has no additional configured attributes.</p>}
              </>
            )}
            <div className="provider-form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setMode(null); setError(""); }}
              >
                Cancel
              </Button>
              <Button type="submit" busy={busy}>
                Save
              </Button>
            </div>
          </form>
        </OperationsDialog>
      )}
      {editing && (
        <OperationsDialog busy={busy} onClose={closeEditor} title={
            "Edit " + (editingKind === "customer"
              ? "customer"
              : editingKind === "asset"
                ? "asset"
                : "service location")
        }>
          {editingKind === "customer" && (
            <form
              className="provider-form"
              noValidate
              onSubmit={(event) => void editCustomer(event)}
            >
              {error && <p className="customer-form-error" role="alert">{error}</p>}
              <fieldset className="customer-contact-fieldset">
                <legend>Contact details</legend>
                <label>
                  Display name *
                  <input
                    name="display_name"
                    required
                    defaultValue={titleOf(editing)}
                    aria-invalid={Boolean(customerFieldErrors.displayName)}
                    aria-describedby={customerFieldErrors.displayName ? "customer-display-name-error" : undefined}
                    onChange={(event) => setCustomerFieldErrors((current) => ({ ...current, displayName: customerDisplayNameError(event.target.value) }))}
                  />
                  {customerFieldErrors.displayName && <span id="customer-display-name-error" className="customer-field-error" role="alert">{customerFieldErrors.displayName}</span>}
                </label>
                <label>Phone number <span className="required">Required</span><input name="contact_phone" type="tel" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} title="Enter an Indian mobile number with exactly 10 digits." value={customerContactForm.phone} onChange={(event) => updateCustomerContact("phone", event.target.value.replace(/\D/g, "").slice(0, 10))} aria-invalid={Boolean(customerContactErrors.phone)} aria-describedby={customerContactErrors.phone ? "customer-phone-error" : undefined} placeholder="e.g. 8892576065" />{customerContactErrors.phone && <span id="customer-phone-error" className="customer-field-error" role="alert">{customerContactErrors.phone}</span>}</label>
                <label>Email address <span className="optional">Optional</span><input name="contact_email" type="email" value={customerContactForm.email} onChange={(event) => updateCustomerContact("email", event.target.value)} aria-invalid={Boolean(customerContactErrors.email)} aria-describedby={customerContactErrors.email ? "customer-email-error" : undefined} placeholder="name@example.com" />{customerContactErrors.email && <span id="customer-email-error" className="customer-field-error" role="alert">{customerContactErrors.email}</span>}</label>
                {customerContactChecking && <small className="customer-contact-checking">Checking provider contacts…</small>}
              </fieldset>
              {billingAddressFields}
              <div className="provider-form-actions">
                <Button type="button" variant="secondary" onClick={closeEditor}>
                  Cancel
                </Button>
                <Button type="submit" busy={busy}>
                  Save customer
                </Button>
              </div>
            </form>
          )}
          {editingKind === "asset" && (
            <form
              className="provider-form"
              onSubmit={(event) => void editAsset(event)}
            >
              <label>
                Asset name *
                <input
                  name="name"
                  required
                  defaultValue={String(
                    editAttributes.display_name || editAttributes.name || "",
                  )}
                />
              </label>
              <div className="provider-form-actions">
                <Button type="button" variant="secondary" onClick={closeEditor}>
                  Cancel
                </Button>
                <Button type="submit" busy={busy}>
                  Save asset
                </Button>
              </div>
            </form>
          )}
          {editingKind === "location" && (
            <form
              className="provider-form"
              onSubmit={(event) => void editLocation(event)}
            >
              <label>
                Location name *
                <input
                  name="name"
                  required
                  defaultValue={String(
                    editAttributes.name || editAttributes.display_name || "",
                  )}
                />
              </label>
                <label>Country<select value="IN" disabled><option value="IN">India</option></select></label>
                <label>Address line / locality *<textarea name="address" required value={locationForm.address} onChange={(event) => setLocationForm((current) => ({ ...current, address: event.target.value }))} /></label>
                <label>PIN code *<input required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} value={locationForm.pin_code} onChange={(event) => setLocationForm((current) => ({ ...current, pin_code: event.target.value.replace(/[^0-9]/g, "").slice(0, 6) }))} /></label>
                <SearchableSelect label="State / UT" searchLabel="Search Indian states and UTs" search={locationGeography.stateSearch} onSearch={locationGeography.setStateSearch} value={locationGeography.stateCode} onChange={(id) => chooseLocationReference("state", id)} options={locationGeography.stateOptions} placeholder="Select state / UT" required />
                <SearchableSelect label="District" searchLabel="Search districts in selected state" search={locationGeography.districtSearch} onSearch={locationGeography.setDistrictSearch} value={locationGeography.districtCode} onChange={(id) => chooseLocationReference("district", id)} options={locationGeography.districtOptions} placeholder="Select district" required disabled={!locationGeography.stateCode} />
                <SearchableSelect label="City" searchLabel="Search cities in selected district" search={locationGeography.citySearch} onSearch={locationGeography.setCitySearch} value={locationGeography.cityCode} onChange={(id) => chooseLocationReference("city", id)} options={locationGeography.cityOptions} placeholder="Select city" required disabled={!locationGeography.districtCode} />
                <div className="customer-address-copy-row"><Button type="button" variant="secondary" disabled={!selectedCustomer || !String((attrs(selectedCustomer).billing_address as Record<string, unknown> | undefined)?.address_line || "").trim()} onClick={copySelectedBillingToShipping}>Copy billing to shipping/site</Button><small>Shipping/site address is the physical location used for delivery, visits and lift service.</small></div>
              <div className="provider-form-actions">
                <Button type="button" variant="secondary" onClick={closeEditor}>
                  Cancel
                </Button>
                <Button type="submit" busy={busy}>
                  Save location
                </Button>
              </div>
            </form>
          )}
        </OperationsDialog>
      )}
      {customerToView && (
        <OperationsDialog title="Customer details" onClose={() => setCustomerToView(null)}>
          <section className="customer-view-dialog" aria-label="Customer details">
            <div className="customer-view-summary">
              <div>
                <span className="customer-view-eyebrow">Provider-authorized customer</span>
                <h3>{titleOf(customerToView)}</h3>
              </div>
              <Status>{String(attrs(customerToView).status || "ACTIVE")}</Status>
            </div>
            <div className="customer-view-grid">
              <div><span>Customer type</span><strong>{String(attrs(customerToView).party_kind || "PERSON").replaceAll("_", " ")}</strong></div>
              <div><span>Phone</span><strong>{String(((attrs(customerToView).contact || {}) as Record<string, unknown>).phone || "Not recorded")}</strong></div>
              <div><span>Email</span><strong>{String(((attrs(customerToView).contact || {}) as Record<string, unknown>).email || "Not recorded")}</strong></div>
              <div><span>Communities / sites</span><strong>{linkedPreview(attrs(customerToView).linked_communities, "location")} · {linkedPreview(attrs(customerToView).linked_sites, "location")}</strong></div>
              <div><span>Linked assets</span><strong>{linkedPreview(attrs(customerToView).linked_assets, "asset")}</strong></div>
              <div className="customer-view-address"><span>Billing address</span><strong>{(() => { const address = (attrs(customerToView).billing_address || {}) as Record<string, unknown>; return [address.address_line, address.address_line_2, address.locality, address.city, address.district, address.state, address.pin_code].filter(Boolean).map(String).join(", ") || "Not recorded"; })()}</strong></div>
            </div>
            <div className="provider-form-actions customer-view-actions">
              {canManage && <Button variant="secondary" onClick={() => { setCustomerToView(null); openEditor(customerToView, "customer"); }}>Edit customer</Button>}
              <Button type="button" variant="secondary" onClick={() => setCustomerToView(null)}>Close</Button>
            </div>
          </section>
        </OperationsDialog>
      )}
      {customerToDelete && (
        <OperationsDialog title={`Unlink ${titleOf(customerToDelete)}`} busy={busy} onClose={() => setCustomerToDelete(null)}>
          <div className="customer-delete-dialog">
            <p>This removes only the active relationship between this provider and the customer. The canonical customer record, linked assets, audit history, and any relationship held by another provider remain safe.</p>
            <div className="provider-form-actions">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setCustomerToDelete(null)}>Cancel</Button>
              <Button type="button" variant="danger" busy={busy} onClick={() => void deleteCustomer()}>Delete</Button>
            </div>
          </div>
        </OperationsDialog>
      )}
      <div className={`record-grid customer-workspace-grid view-${view}`}>
        {view === "customers" && <section className="detail-card customer-register-panel customer-index-panel">
          <div className="section-heading customer-index-heading">
            <div>
              <div className="customer-index-title-line"><h2>Customers</h2><span className="customer-index-scope">Provider scope</span></div>
              <p>Provider-authorized customers with their linked communities, sites and elevator assets.</p>
            </div>
            <div className="customer-index-heading-actions">
              {canManage && <Button onClick={openCustomerCreate}>Add customer</Button>}
            </div>
          </div>
          <div className="customer-index-filter-grid" aria-label="Customer filters">
            <label>Name<input aria-label="Filter customers by name" value={customerQuery} onChange={(event) => { setCustomerQuery(event.target.value); setCustomerPage({}); }} placeholder="Customer name" /></label>
            <label>Phone<input aria-label="Filter customers by phone" inputMode="tel" value={customerPhoneQuery} onChange={(event) => { setCustomerPhoneQuery(event.target.value); setCustomerPage({}); }} placeholder="Phone number" /></label>
            <label>Email<input aria-label="Filter customers by email" type="email" value={customerEmailQuery} onChange={(event) => { setCustomerEmailQuery(event.target.value); setCustomerPage({}); }} placeholder="Email address" /></label>
          </div>
          {loading ? <p className="notice" role="status">Loading authorized customers…</p> : customers.data.length ? (
            <div className="customer-index-table-wrap">
              <table className="customer-index-table">
                <thead><tr><th>Customer</th><th>Phone</th><th>Email</th><th>Community / sites</th><th>Linked assets</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>{customers.data.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Customer"><strong>{titleOf(row)}</strong><small>{String(attrs(row).party_kind || "PERSON").replaceAll("_", " ").toLowerCase()}</small></td>
                    <td data-label="Phone">{String(((attrs(row).contact || {}) as Record<string, unknown>).phone || "Not recorded")}</td>
                    <td data-label="Email">{String(((attrs(row).contact || {}) as Record<string, unknown>).email || "Not recorded")}</td>
                    <td data-label="Community / sites"><strong>{linkedPreview(attrs(row).linked_communities, "location")}</strong><small>{linkedPreview(attrs(row).linked_sites, "location") === "—" ? "No sites linked" : linkedPreview(attrs(row).linked_sites, "location")}</small></td>
                    <td data-label="Linked assets">{linkedPreview(attrs(row).linked_assets, "asset")}</td>
                    <td data-label="Status"><Status>{String(attrs(row).status || "ACTIVE")}</Status></td>
                    <td data-label="Actions"><ProviderActionMenu label={`Actions for ${titleOf(row)}`} actions={customerRowActions(row)} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <p className="notice">No authorized customers match this server query.</p>
          )}
          {view !== "customers" && selectedCustomer && <section className="asset-selected-detail" aria-label="Selected customer profile">
            <h3>{titleOf(selectedCustomer)}</h3>
            <dl><dt>Party type</dt><dd>{String(attrs(selectedCustomer).party_kind || "—")}</dd><dt>Provider relationship</dt><dd>{String(attrs(selectedRelationship || { id: "", attributes: {} }).status || "—")}</dd><dt>Phone</dt><dd>{String(((attrs(selectedCustomer).contact || {}) as Record<string, unknown>).phone || "Not recorded")}</dd><dt>Email</dt><dd>{String(((attrs(selectedCustomer).contact || {}) as Record<string, unknown>).email || "Not recorded")}</dd><dt>Billing address</dt><dd>{(() => { const address = (attrs(selectedCustomer).billing_address || {}) as Record<string, unknown>; return [address.address_line, address.address_line_2, address.locality, address.city, address.district, address.state, address.pin_code].filter(Boolean).map(String).join(", ") || "Not recorded"; })()}</dd></dl>
          </section>}
          <div className="server-pagination">
            <label>
              Rows per page
              <select
                value={pageLimit}
                onChange={(event) => {
                  setPageLimit(Number(event.target.value));
                  setCustomerPage({});
                  setLocationPage({});
                  setAssetPage({});
                }}
              >
                <option value="15">15</option>
                <option value="30">30</option>
              </select>
            </label>
            <Button
              variant="secondary"
              disabled={!customers.page?.previous}
              onClick={() =>
                setCustomerPage({
                  before: customers.page?.previous || undefined,
                })
              }
            >
              Previous
            </Button>
            <Button
              disabled={!customers.page?.next}
              onClick={() =>
                setCustomerPage({ after: customers.page?.next || undefined })
              }
            >
              Next
            </Button>
          </div>
        </section>}
        {view === "sites" && <section className="detail-card customer-register-panel">
          <h2>Sites &amp; locations</h2>
          <div className="customer-workspace-filter-grid">
            <SearchableSelect label="Customer" searchLabel="Search authorized customers" search={customerFilterSearch} onSearch={setCustomerFilterSearch} value={selectedRelationshipId} onChange={(value) => { setSelectedRelationshipId(value); setSelectedLocationId(""); setSelectedAssetId(""); setLocationFilterSearch(""); }} options={customerRelationshipChoices} placeholder="All authorized customers" required={false} />
          </div>
          <label>
            Search locations
            <input
              aria-label="Search service locations"
              value={locationQuery}
              onChange={(event) => {
                setLocationQuery(event.target.value);
                setLocationPage({});
              }}
              placeholder="Shipping site, address or ID"
            />
          </label>
          {selectedRelationship && <p className="customer-scope-label">Customer: <strong>{String(attrs(customers.data.find((customer) => customer.id === relatedId(selectedRelationship.relationships.customer)) || selectedRelationship).display_name || titleOf(customers.data.find((customer) => customer.id === relatedId(selectedRelationship.relationships.customer)) || selectedRelationship))}</strong> · These physical service locations are the customer’s shipping/delivery addresses.</p>}
          {loading ? <p className="notice" role="status">Loading authorized sites…</p> : locations.data.length ? (
            <div className="customer-record-list" aria-label="Authorized service locations">
            {locations.data.map((row) => (
              <article className="record-card" key={row.id}>
                <Status>{String(attrs(row).status || "ACTIVE")}</Status>
                <strong>{titleOf(row)}</strong>
                <small>{String(attrs(row).address_lines || attrs(row).service_location_code || "Address not recorded")}</small>
                <div className="record-card-actions"><Button variant="secondary" aria-pressed={selectedLocationId === row.id} onClick={() => { setSelectedLocationId(row.id); setSelectedAssetId(""); }}>View assets</Button>{editButton(row, "location")}</div>
              </article>
            ))}
            </div>
          ) : (
            <p className="notice">No authorized locations match this server query.</p>
          )}
          {selectedLocation && <section className="asset-selected-detail" aria-label="Selected site details">
            <h3>{titleOf(selectedLocation)}</h3>
            <dl><dt>Classification</dt><dd>{String(attrs(selectedLocation).classification || "—")}</dd><dt>Site code</dt><dd>{String(attrs(selectedLocation).service_location_code || "—")}</dd><dt>Service location type</dt><dd>{String(attrs(selectedLocation).service_location_type || "—")}</dd><dt>Parent site</dt><dd>{titleOf(locations.data.find((row) => row.id === relatedId(selectedLocation.relationships.parent)) || selectedLocation)}</dd><dt>Address</dt><dd>{Array.isArray(attrs(selectedLocation).address_lines) ? (attrs(selectedLocation).address_lines as unknown[]).map(String).join(", ") : "—"}</dd><dt>Time zone</dt><dd>{String(attrs(selectedLocation).time_zone || "—")}</dd></dl>
          </section>}
          <div className="server-pagination">
            <label>
              Rows per page
              <select
                aria-label="Locations rows per page"
                value={pageLimit}
                onChange={(event) => {
                  setPageLimit(Number(event.target.value));
                  setCustomerPage({});
                  setLocationPage({});
                  setAssetPage({});
                }}
              >
                <option value="15">15</option>
                <option value="30">30</option>
              </select>
            </label>
            <Button
              variant="secondary"
              disabled={!locations.page?.previous}
              onClick={() =>
                setLocationPage({ before: locations.page?.previous || undefined })
              }
            >
              Previous
            </Button>
            <Button
              disabled={!locations.page?.next}
              onClick={() =>
                setLocationPage({ after: locations.page?.next || undefined })
              }
            >
              Next
            </Button>
          </div>
        </section>}
        {view === "assets" && <section className="detail-card customer-register-panel">
          <h2>Assets</h2>
          <div className="customer-workspace-filter-grid">
            <SearchableSelect label="Customer" searchLabel="Search authorized customers" search={customerFilterSearch} onSearch={setCustomerFilterSearch} value={selectedRelationshipId} onChange={(value) => { setSelectedRelationshipId(value); setSelectedLocationId(""); setSelectedAssetId(""); setLocationFilterSearch(""); }} options={customerRelationshipChoices} placeholder="All authorized customers" required={false} />
            <SearchableSelect label="Site / location" searchLabel="Search loaded sites" search={locationFilterSearch} onSearch={setLocationFilterSearch} value={selectedLocationId} onChange={(value) => { setSelectedLocationId(value); setSelectedAssetId(""); }} options={locations.data.map((row) => ({ id: row.id, label: titleOf(row), detail: String(attrs(row).service_location_code || "") }))} placeholder="All sites" required={false} disabled={!locations.data.length} />
          </div>
          <label>
            Search assets
            <input
              aria-label="Search assets"
              value={assetQuery}
              onChange={(event) => {
                setAssetQuery(event.target.value);
                setAssetPage({});
              }}
              placeholder="Asset name, E-Code, or ID"
            />
          </label>
          <p className="form-help">Search an imported E-Code such as KAB123A to locate the asset and its customer, building or community path.</p>
          {loading ? <p className="notice" role="status">Loading authorized assets…</p> : assets.data.length ? (
            <div className="customer-record-list" aria-label="Authorized assets">
            {assets.data.map((row) => (
              <article className="record-card" key={row.id}>
                {(() => {
                  const primaryIdentifier = primaryIdentifierOf(row);
                  const hierarchy = serviceLocationHierarchyOf(row);
                  const isEquipmentCode = String(primaryIdentifier?.identifier_type_code || "").toUpperCase() === "EQUIPMENT_CODE";
                  return <>
                <Status>
                  {String(
                    attrs(row).status || attrs(row).lifecycle_state || "ACTIVE",
                  )}
                </Status>
                <strong>{titleOf(row)}</strong>
                <small>{isEquipmentCode ? "E-Code: " : "Identifier: "}{String(primaryIdentifier?.value || attrs(row).asset_code || attrs(row).code || "Not recorded")}</small>
                <small>Customer: {String(attrs(row).customer_name || "Not linked")}</small>
                <small>Site: {String(attrs(row).service_location_name || "Not linked")}{attrs(row).service_location_code ? ` · ${String(attrs(row).service_location_code)}` : ""}</small>
                {hierarchy.length > 1 && <small>Property: {hierarchy.map((item) => String(item.name || "")).filter(Boolean).join(" / ")}</small>}
                <div className="record-card-actions"><Button variant="secondary" aria-pressed={selectedAssetId === row.id} onClick={() => setSelectedAssetId(row.id)}>View details</Button>{editButton(row, "asset")}</div>
                  </>;
                })()}
              </article>
            ))}
            </div>
          ) : (
            <p className="notice">
              No authorized assets match this server query.
            </p>
          )}
          {selectedAsset && <section className="asset-selected-detail" aria-label="Selected asset details">
            <h3>{titleOf(selectedAsset)}</h3>
            <dl>
              <dt>Status</dt><dd>{String(attrs(selectedAsset).status || attrs(selectedAsset).lifecycle_state || "—")}</dd>
              <dt>Definition version</dt><dd>{String(attrs(selectedAsset).definition_version || "—")}</dd>
              <dt>Asset family</dt><dd>{selectedAssetFamily ? titleOf(selectedAssetFamily) : "—"}</dd>
              <dt>Asset type</dt><dd>{selectedAssetType ? titleOf(selectedAssetType) : "—"}</dd>
              <dt>Customer</dt><dd>{String(attrs(selectedAsset).customer_name || titleOf(relationships.data.find((item) => item.id === relatedId(selectedAsset.relationships.customer_relationship)) || selectedRelationship || { id: "", type: "", attributes: {} as GenericAttributes, relationships: {} }))}</dd>
              <dt>Site / location</dt><dd>{String(attrs(selectedAsset).service_location_name || "Not linked")}{attrs(selectedAsset).service_location_code ? ` · ${String(attrs(selectedAsset).service_location_code)}` : ""}</dd>
              <dt>Building / community</dt><dd>{serviceLocationHierarchyOf(selectedAsset).map((item) => String(item.name || "")).filter(Boolean).join(" / ") || "Not linked"}</dd>
              <dt>Site address</dt><dd>{Array.isArray(attrs(selectedAsset).service_location_address) ? (attrs(selectedAsset).service_location_address as unknown[]).map(String).join(", ") || "Not recorded" : "Not recorded"}</dd>
              <dt>E-Code</dt><dd>{equipmentCodeOf(selectedAsset) || "Not recorded"}</dd>
              <dt>Asset identifiers</dt><dd>{Array.isArray(attrs(selectedAsset).identifiers) ? (attrs(selectedAsset).identifiers as Array<Record<string, unknown>>).map((identifier) => String(identifier.value || "")).filter(Boolean).join(", ") || "Not recorded" : "Not recorded"}</dd>
              <dt>Configured attributes</dt><dd>{Array.isArray(attrs(selectedAsset).values) ? (attrs(selectedAsset).values as Array<{ definition_id?: string; value?: unknown }>).map((value) => { const definition = attributeDefinitions.data.find((candidate) => candidate.id === value.definition_id); return `${definition ? String(attrs(definition).label || attrs(definition).key) : "Attribute"}: ${String(value.value ?? "—")}`; }).join(" · ") || "None recorded" : "None recorded"}</dd>
              <dt>Site relationship roles</dt><dd>{Array.isArray(attrs(selectedAsset).site_relationship_roles) ? (attrs(selectedAsset).site_relationship_roles as unknown[]).map((role) => String(role).replaceAll("_", " ")).join(", ") || "Not specified" : "Not specified"}</dd>
            </dl>
          </section>}
          <div className="server-pagination">
            <label>
              Rows per page
              <select
                aria-label="Assets rows per page"
                value={pageLimit}
                onChange={(event) => {
                  setPageLimit(Number(event.target.value));
                  setCustomerPage({});
                  setLocationPage({});
                  setAssetPage({});
                }}
              >
                <option value="15">15</option>
                <option value="30">30</option>
              </select>
            </label>
            <Button
              variant="secondary"
              disabled={!assets.page?.previous}
              onClick={() =>
                setAssetPage({ before: assets.page?.previous || undefined })
              }
            >
              Previous
            </Button>
            <Button
              disabled={!assets.page?.next}
              onClick={() =>
                setAssetPage({ after: assets.page?.next || undefined })
              }
            >
              Next
            </Button>
          </div>
        </section>}
      </div>
    </section>
  );
}
