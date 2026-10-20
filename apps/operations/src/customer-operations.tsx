import { useEffect, useState, type FormEvent } from "react";
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

const fail = (cause: unknown) =>
  (cause as { message?: string })?.message ||
  "The request could not be completed.";
const attrs = (row: GenericAttributes) =>
  row.attributes as Record<string, unknown>;
const titleOf = (row: GenericAttributes) =>
  String(
    attrs(row).display_name || attrs(row).name || attrs(row).title || row.id,
  );
const relatedId = (value: Resource<GenericAttributes>["relationships"][string]) => Array.isArray(value) ? value[0]?.id : value?.id;
const revisionOf = (row: Resource<GenericAttributes>) =>
  Number(attrs(row).revision || attrs(row).updated_at || 0);
type EditKind = "customer" | "location" | "asset";

export function CustomerOperations({ providerId, canManage = false }: { providerId: string; canManage?: boolean }) {
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
  const [locationQuery, setLocationQuery] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
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
  const [pageLimit, setPageLimit] = useState(10);
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
  const [editingKind, setEditingKind] = useState<EditKind | null>(null);
  const [locationForm, setLocationForm] = useState({ address: "", city: "", cityCode: "", district: "", districtCode: "", state: "", stateCode: "" });
  const locationGeography = useIndiaGeography(locationForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try {
    const [c, r, l, f, t, d, ad, a] = await Promise.all([
      operationsData.customers(providerId, {
        query: customerQuery,
        ...customerPage,
        limit: pageLimit,
      }),
      operationsData.customerRelationships(providerId),
      operationsData.locations(providerId, selectedRelationshipId || undefined, {
        query: locationQuery,
        ...locationPage,
        limit: pageLimit,
      }),
      operationsData.assetFamilies(providerId),
      operationsData.assetTypes(providerId),
      operationsData.assetDefinitions(providerId),
      operationsData.attributeDefinitions(providerId),
      operationsData.assets(providerId, {
        query: assetQuery,
        ...assetPage,
        limit: pageLimit,
        customerRelationshipId: selectedRelationshipId || undefined,
        locationId: selectedLocationId || undefined,
      }),
    ]);
    setCustomers(c);
    setRelationships(r);
    setLocations(l);
    setAssetFamilies(f);
    setAssetTypes(t);
    setDefinitions(d);
    setAttributeDefinitions(ad);
    setAssets(a);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load().catch((cause) => setError(fail(cause)));
  }, [
    providerId,
    selectedRelationshipId,
    selectedLocationId,
    customerQuery,
    locationQuery,
    assetQuery,
    customerPage,
    locationPage,
    assetPage,
    pageLimit,
  ]);
  useEffect(() => {
    if (!customers.data.length && !relationships.data.length) return;
    const customerRelationshipIds = customers.data.map((row) => relatedId(row.relationships.customer_relationship)).filter((id): id is string => Boolean(id));
    if (!selectedRelationshipId || (!relationships.data.some((row) => row.id === selectedRelationshipId) && !customerRelationshipIds.includes(selectedRelationshipId))) {
      setSelectedRelationshipId(customerRelationshipIds[0] || relationships.data[0]?.id || "");
    }
  }, [customers.data, relationships.data, selectedRelationshipId]);
  useEffect(() => {
    if (!locations.data.length) {
      setSelectedLocationId("");
      return;
    }
    if (!locations.data.some((row) => row.id === selectedLocationId)) setSelectedLocationId(locations.data[0].id);
  }, [locations.data, selectedLocationId]);
  useEffect(() => {
    if (!assets.data.length) {
      setSelectedAssetId("");
      return;
    }
    if (!assets.data.some((row) => row.id === selectedAssetId)) setSelectedAssetId(assets.data[0].id);
  }, [assets.data, selectedAssetId]);
  const selectedDefinition = definitions.data.find((row) => row.id === selectedDefinitionId);
  const definitionAttributeIds = selectedDefinition?.relationships.attributes;
  const selectedAttributeIds = Array.isArray(definitionAttributeIds) ? definitionAttributeIds.map((link) => link.id) : definitionAttributeIds ? [definitionAttributeIds.id] : [];
  const selectedAttributes = attributeDefinitions.data.filter((row) => selectedAttributeIds.includes(row.id));
  const selectedRelationship = relationships.data.find((row) => row.id === selectedRelationshipId);
  const selectedCustomer = customers.data.find((row) => relatedId(row.relationships.customer_relationship) === selectedRelationshipId) || customers.data.find((row) => row.id === relatedId(selectedRelationship?.relationships.customer));
  const ownerPartyId = relatedId(selectedRelationship?.relationships.customer) || selectedCustomer?.id || "";
  const customerRelationshipChoices = [
    ...customers.data.flatMap((customer) => {
      const id = relatedId(customer.relationships.customer_relationship);
      return id ? [{ id, label: titleOf(customer) }] : [];
    }),
    ...relationships.data.filter((relationship) => !customers.data.some((customer) => relatedId(customer.relationships.customer_relationship) === relationship.id)).map((relationship) => ({ id: relationship.id, label: titleOf(customers.data.find((customer) => customer.id === relatedId(relationship.relationships.customer)) || relationship) })),
  ];
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
  };
  const chooseLocationReference = (key: "state" | "district" | "city", id: string) => {
    const options = key === "state" ? locationGeography.stateOptions : key === "district" ? locationGeography.districtOptions : locationGeography.cityOptions;
    const selected = options.find((option) => option.id === id);
    setLocationForm((current) => ({ ...current, [key]: selected?.label || "", [`${key}Code`]: selected?.id || "", ...(key === "state" ? { district: "", districtCode: "", city: "", cityCode: "" } : key === "district" ? { city: "", cityCode: "" } : {}) }));
    if (key === "state") { locationGeography.setDistrictSearch(""); locationGeography.setCitySearch(""); }
    if (key === "district") locationGeography.setCitySearch("");
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (mode === "customer")
        await operationsData.createCustomer(
          providerId,
          {
            party_kind: form.get("party_kind"),
            display_name: form.get("display_name"),
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
            address_references: { country_code: "IN", state_code: locationGeography.stateCode, district_code: locationGeography.districtCode, city_code: locationGeography.cityCode, state: locationForm.state, district: locationForm.district, city: locationForm.city },
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
            location_id: form.get("location_id"),
            values,
            identifier_inputs: identifierValue && identifierTypeId ? [{ identifier_type_id: identifierTypeId, value: identifierValue }] : [],
          },
          crypto.randomUUID(),
        );
      }
      setMessage("Record saved by the server.");
      setMode(null);
      await load();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  async function editCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await operationsData.updateCustomer(
        providerId,
        editing.id,
        {
          display_name: form.get("display_name"),
          expected_revision: revisionOf(editing),
        },
        crypto.randomUUID(),
      );
      setMessage("Customer updated by the server.");
      closeEditor();
      await load();
    } catch (cause) {
      setError(fail(cause));
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
          address_references: { country_code: "IN", state_code: locationGeography.stateCode, district_code: locationGeography.districtCode, city_code: locationGeography.cityCode, state: locationForm.state, district: locationForm.district, city: locationForm.city },
          expected_revision: revisionOf(editing),
        },
        crypto.randomUUID(),
      );
      setMessage("Service location updated by the server.");
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
      setMessage("Asset updated by the server.");
      closeEditor();
      await load();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  const editAttributes = editing ? attrs(editing) : {};
  const editButton = (row: Resource<GenericAttributes>, kind: EditKind) => (
    canManage && kind !== "customer" ? <Button
      variant="secondary"
      onClick={() => {
        setEditing(row);
        setEditingKind(kind);
        if (kind === "location") {
          const values = attrs(row);
          const references = (values.address_references || {}) as Record<string, unknown>;
          const lines = Array.isArray(values.address_lines) ? values.address_lines.map(String) : [];
          setLocationForm({ address: lines[0] || "", city: String(references.city || ""), cityCode: String(references.city_code || ""), district: String(references.district || ""), districtCode: String(references.district_code || ""), state: String(references.state || ""), stateCode: String(references.state_code || "") });
        }
      }}
    >
      {kind === "location" ? "Edit location" : "Edit asset"}
    </Button> : null
  );
  return (
    <section className="content feature-page">
      <PageHeader
        title="Customers, sites & assets"
        description="Explore provider-scoped customer relationships, service locations and configurable asset families."
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {canManage && <div className="action-footer">
        <Button onClick={() => setMode("customer")}>Add customer</Button>
        <Button
          variant="secondary"
          onClick={() => setMode("location")}
          disabled={!relationships.data.length}
        >
          Add service location
        </Button>
        <Button
          variant="secondary"
          onClick={() => setMode("asset")}
          disabled={!relationships.data.length || !definitions.data.length}
        >
          Register asset
        </Button>
      </div>}
      {mode && (
        <OperationsDialog busy={busy} onClose={() => setMode(null)} title={
            mode === "customer"
              ? "Add customer"
              : mode === "location"
                ? "Add service location"
                : "Register asset"}
        >
          <form
            className={`provider-form customer-operation-form${mode === "customer" ? " customer-create-form" : mode === "asset" ? " asset-registration-form" : ""}`}
            onSubmit={(event) => void submit(event)}
          >
            {mode === "customer" && (
              <>
                <label>
                  Display name *<input name="display_name" required />
                </label>
                <label>
                  Customer type
                  <select name="party_kind" required>
                    <option>ORGANIZATION</option>
                    <option>PERSON</option>
                  </select>
                </label>
                <p className="notice customer-create-note">This action creates the customer identity and this provider's relationship. Contacts, sites and assets are managed in their separate authorized workflows.</p>
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
                <SearchableSelect label="State / UT" searchLabel="Search Indian states and UTs" search={locationGeography.stateSearch} onSearch={locationGeography.setStateSearch} value={locationGeography.stateCode} onChange={(id) => chooseLocationReference("state", id)} options={locationGeography.stateOptions} placeholder="Select state / UT" required />
                <SearchableSelect label="District" searchLabel="Search districts in selected state" search={locationGeography.districtSearch} onSearch={locationGeography.setDistrictSearch} value={locationGeography.districtCode} onChange={(id) => chooseLocationReference("district", id)} options={locationGeography.districtOptions} placeholder="Select district" required disabled={!locationGeography.stateCode} />
                <SearchableSelect label="City" searchLabel="Search cities in selected district" search={locationGeography.citySearch} onSearch={locationGeography.setCitySearch} value={locationGeography.cityCode} onChange={(id) => chooseLocationReference("city", id)} options={locationGeography.cityOptions} placeholder="Select city" required disabled={!locationGeography.districtCode} />
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
                  Asset family / definition *
                  <select name="asset_definition_id" required value={selectedDefinitionId} onChange={(event) => setSelectedDefinitionId(event.target.value)}>
                    <option value="">Select definition</option>
                    {definitions.data.map((row) => (
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
                {selectedDefinition && String(attrs(selectedDefinition).primary_identifier_strategy || "OPTIONAL").toUpperCase() !== "NONE" && (attrs(selectedDefinition).primary_identifier_type_id || attrs(selectedDefinition).identifier_policy_id || String(attrs(selectedDefinition).primary_identifier_strategy || "OPTIONAL").toUpperCase() === "REQUIRED") && <label>Primary identifier{String(attrs(selectedDefinition).primary_identifier_strategy || "OPTIONAL").toUpperCase() === "REQUIRED" ? " *" : " (optional)"}<input name="primary_identifier" required={String(attrs(selectedDefinition).primary_identifier_strategy || "OPTIONAL").toUpperCase() === "REQUIRED"} /></label>}
                {selectedDefinition && selectedAttributes.length === 0 && <p className="notice">This definition has no additional configured attributes.</p>}
              </>
            )}
            <div className="provider-form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMode(null)}
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
              onSubmit={(event) => void editCustomer(event)}
            >
              <label>
                Display name *
                <input
                  name="display_name"
                  required
                  defaultValue={titleOf(editing)}
                />
              </label>
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
                <SearchableSelect label="State / UT" searchLabel="Search Indian states and UTs" search={locationGeography.stateSearch} onSearch={locationGeography.setStateSearch} value={locationGeography.stateCode} onChange={(id) => chooseLocationReference("state", id)} options={locationGeography.stateOptions} placeholder="Select state / UT" required />
                <SearchableSelect label="District" searchLabel="Search districts in selected state" search={locationGeography.districtSearch} onSearch={locationGeography.setDistrictSearch} value={locationGeography.districtCode} onChange={(id) => chooseLocationReference("district", id)} options={locationGeography.districtOptions} placeholder="Select district" required disabled={!locationGeography.stateCode} />
                <SearchableSelect label="City" searchLabel="Search cities in selected district" search={locationGeography.citySearch} onSearch={locationGeography.setCitySearch} value={locationGeography.cityCode} onChange={(id) => chooseLocationReference("city", id)} options={locationGeography.cityOptions} placeholder="Select city" required disabled={!locationGeography.districtCode} />
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
      <div className="record-grid">
        <section className="detail-card customer-register-panel">
          <h2>Customers</h2>
          <label>
            Search customers
            <input
              aria-label="Search customers"
              value={customerQuery}
              onChange={(event) => {
                setCustomerQuery(event.target.value);
                setCustomerPage({});
              }}
              placeholder="Name or customer ID"
            />
          </label>
          {loading ? <p className="notice" role="status">Loading authorized customers…</p> : customers.data.length ? (
            <div className="customer-record-list" aria-label="Authorized customers">
            {customers.data.map((row) => (
              <article className="record-card" key={row.id}>
                <Status>{String(attrs(row).status || "ACTIVE")}</Status>
                <strong>{titleOf(row)}</strong>
                <small>{String(attrs(row).party_kind || "Provider relationship").replaceAll("_", " ").toLowerCase()}</small>
                <Button variant="secondary" disabled={!relatedId(row.relationships.customer_relationship)} aria-pressed={relatedId(row.relationships.customer_relationship) === selectedRelationshipId} onClick={() => { const relationshipId = relatedId(row.relationships.customer_relationship); if (relationshipId) { setSelectedRelationshipId(relationshipId); setSelectedLocationId(""); setSelectedAssetId(""); } }}>View sites</Button>
              </article>
            ))}
            </div>
          ) : (
            <p className="notice">
              No authorized customers match this server query.
            </p>
          )}
          {selectedCustomer && <section className="asset-selected-detail" aria-label="Selected customer profile">
            <h3>{titleOf(selectedCustomer)}</h3>
            <dl><dt>Party type</dt><dd>{String(attrs(selectedCustomer).party_kind || "—")}</dd><dt>Provider relationship</dt><dd>{String(attrs(selectedRelationship || { id: "", attributes: {} }).status || "—")}</dd></dl>
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
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
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
        </section>
        <section className="detail-card customer-register-panel">
          <h2>Sites &amp; service locations</h2>
          <label>
            Search locations
            <input
              aria-label="Search service locations"
              value={locationQuery}
              onChange={(event) => {
                setLocationQuery(event.target.value);
                setLocationPage({});
              }}
              placeholder="Location name, address or ID"
            />
          </label>
          {selectedRelationship && <p className="customer-scope-label">Customer: <strong>{String(attrs(customers.data.find((customer) => customer.id === relatedId(selectedRelationship.relationships.customer)) || selectedRelationship).display_name || titleOf(customers.data.find((customer) => customer.id === relatedId(selectedRelationship.relationships.customer)) || selectedRelationship))}</strong></p>}
          {loading ? <p className="notice" role="status">Loading authorized sites…</p> : locations.data.length ? (
            <div className="customer-record-list" aria-label="Authorized service locations">
            {locations.data.map((row) => (
              <article className="record-card" key={row.id}>
                <Status>{String(attrs(row).status || "ACTIVE")}</Status>
                <strong>{titleOf(row)}</strong>
                <small>{String(attrs(row).address_lines || attrs(row).service_location_code || "Address not recorded")}</small>
                <Button variant="secondary" aria-pressed={selectedLocationId === row.id} onClick={() => { setSelectedLocationId(row.id); setSelectedAssetId(""); }}>View assets</Button>
                {editButton(row, "location")}
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
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
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
        </section>
        <section className="detail-card customer-register-panel">
          <h2>Assets</h2>
          <label>
            Search assets
            <input
              aria-label="Search assets"
              value={assetQuery}
              onChange={(event) => {
                setAssetQuery(event.target.value);
                setAssetPage({});
              }}
              placeholder="Asset name or ID"
            />
          </label>
          {loading ? <p className="notice" role="status">Loading authorized assets…</p> : assets.data.length ? (
            <div className="customer-record-list" aria-label="Authorized assets">
            {assets.data.map((row) => (
              <article className="record-card" key={row.id}>
                <Status>
                  {String(
                    attrs(row).status || attrs(row).lifecycle_state || "ACTIVE",
                  )}
                </Status>
                <strong>{titleOf(row)}</strong>
                <small>{String(attrs(row).primary_identifier && (attrs(row).primary_identifier as Record<string, unknown>).value || attrs(row).asset_code || attrs(row).code || "Identifier not recorded")}</small>
                <Button variant="secondary" aria-pressed={selectedAssetId === row.id} onClick={() => setSelectedAssetId(row.id)}>View details</Button>
                {editButton(row, "asset")}
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
              <dt>Customer relationship</dt><dd>{titleOf(relationships.data.find((item) => item.id === relatedId(selectedAsset.relationships.customer_relationship)) || selectedRelationship || { id: "", type: "", attributes: {} as GenericAttributes, relationships: {} })}</dd>
              <dt>Asset identifiers</dt><dd>{Array.isArray(attrs(selectedAsset).identifiers) ? (attrs(selectedAsset).identifiers as Array<Record<string, unknown>>).map((identifier) => String(identifier.value || "")).filter(Boolean).join(", ") || "Not recorded" : "Not recorded"}</dd>
              <dt>Configured attributes</dt><dd>{Array.isArray(attrs(selectedAsset).values) ? (attrs(selectedAsset).values as Array<{ definition_id?: string; value?: unknown }>).map((value) => { const definition = attributeDefinitions.data.find((candidate) => candidate.id === value.definition_id); return `${definition ? String(attrs(definition).label || attrs(definition).key) : "Attribute"}: ${String(value.value ?? "—")}`; }).join(" · ") || "None recorded" : "None recorded"}</dd>
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
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
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
        </section>
      </div>
    </section>
  );
}
