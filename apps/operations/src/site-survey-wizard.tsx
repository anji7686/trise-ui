import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Button, SortedSelect } from '@trise/ui';
import { operationsData, type ProviderWorkJourney, type RequirementCatalogue, type RequirementRevisionAttributes, type Resource, type SiteSurveyAttributes } from './data';
import { emptyIndiaPostalAddress, formatIndiaPostalAddress, indiaPostalAddressComplete, parseIndiaPostalAddressSummary, IndiaPostalAddressFields, type IndiaPostalAddress } from './india-postal-address-fields';
import { RequirementMultiChoice } from './requirement-multi-choice';
import { ActionFeedback, ActionNotification } from './operations-shared';
import { OperationsDialog } from './operations-dialog';
import './site-survey-wizard.css';

const steps = ['Details', 'Validate', 'Authorize / Save'];
const siteContactRoles = ['Customer / property owner', 'Facility manager', 'Building manager', 'Site engineer', 'Society / community representative', 'Security / maintenance staff', 'Architect / consultant', 'Contractor', 'Other'];
const todayDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
type Contact = { name: string; role: string; phone: string };
type RequirementProfile = { application: string; technology: string; capacityBand: string; driveType: string; speedBand: string; doorConfiguration: string; doorType: string; machineRoom: string; controlSystem: string; accessibilityFeatures: string[]; safetyFeatures: string[]; finish: string; standardsReferences: string[]; accessNotes: string };
type UnitMeasurements = { shaftWidth: string; shaftDepth: string; pitDepth: string; headroom: string };
type Unit = { label: string; stops: string; capacity: string; type: string; requirements?: RequirementProfile; measurements?: UnitMeasurements };
type RequirementMode = 'SHARED' | 'PER_UNIT';
type SurveyForm = { surveyDate: string; siteName: string; siteAddress: string; postalAddress: IndiaPostalAddress; latitude: string; longitude: string; accuracy: string; gpsSource: string; buildingType: string; contacts: Contact[]; referralName: string; referralContact: string; units: Unit[]; unitRequirementsMode: RequirementMode; shaftWidth: string; shaftDepth: string; pitDepth: string; headroom: string; capacity: string; requirementsStops: string; quantity: string; liftType: string; industrySegment: string; step: number } & RequirementProfile;
const initialForm: SurveyForm = { surveyDate: todayDate(), siteName: '', siteAddress: '', postalAddress: emptyIndiaPostalAddress(), latitude: '', longitude: '', accuracy: '', gpsSource: 'MANUAL', buildingType: '', contacts: [{ name: '', role: '', phone: '' }], referralName: '', referralContact: '', units: [{ label: 'Unit 1', stops: '', capacity: '', type: 'PASSENGER_TRACTION' }], unitRequirementsMode: 'SHARED', shaftWidth: '', shaftDepth: '', pitDepth: '', headroom: '', accessNotes: '', capacity: '', requirementsStops: '', quantity: '1', liftType: '', application: '', industrySegment: '', technology: '', capacityBand: '', driveType: '', speedBand: '', doorConfiguration: '', doorType: '', machineRoom: '', controlSystem: '', accessibilityFeatures: [], safetyFeatures: [], finish: '', standardsReferences: [], step: 0 };
const objectValue = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const firstArray = (...values: unknown[]): unknown[] =>
  values.find((value): value is unknown[] => Array.isArray(value) && value.length > 0) || [];
const textValue = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const surveyGpsSource = (value: unknown) => textValue(value).toUpperCase() === 'BROWSER_GEOLOCATION' || textValue(value).toUpperCase() === 'GPS' ? 'GPS' : 'MANUAL';
const positiveNumber = (value: string) => value.trim() ? Number(value) : undefined;
const sharedUnitRequirementTitle = (units: Unit[]) => {
  const names = units.map((unit, index) => unit.label || `Unit ${index + 1}`);
  const subjects = names.length > 1 ? names.join(' & ') : names[0] || 'This lift';
  return `${subjects} ${names.length > 1 ? 'have' : 'has'} the same requirements`;
};
const isDraftSurvey = (survey: Resource<SiteSurveyAttributes>) => String(survey.attributes.status || '').toUpperCase() === 'DRAFT';
const newestSurveyFirst = (
  left: Resource<SiteSurveyAttributes>,
  right: Resource<SiteSurveyAttributes>,
) => {
  const createdDifference =
    Date.parse(right.attributes.created_at || '') -
    Date.parse(left.attributes.created_at || '');
  return createdDifference || right.attributes.revision - left.attributes.revision;
};

function fromSurvey(record: Resource<SiteSurveyAttributes>): SurveyForm {
  const context = objectValue(record.attributes.survey_context);
  const gps = objectValue(context.gps);
  const contacts = Array.isArray(context.contacts) ? context.contacts.map((entry) => { const item = objectValue(entry); return { name: textValue(item.name), role: textValue(item.role), phone: textValue(item.phone) }; }) : initialForm.contacts;
  const scope = objectValue(record.attributes.requirement_scope);
  const scopeRequirements = objectValue(scope.requirements);
  const requirements = {
    ...objectValue(record.attributes.requirements),
    ...scopeRequirements,
  };
  const sourceUnits = firstArray(
    record.attributes.unit_details,
    scope.units,
    scopeRequirements.units,
    requirements.units,
  );
  const units = sourceUnits.length
    ? sourceUnits.map((entry, index) => {
        const unit = objectValue(entry);
        return {
          label: textValue(unit.label) || `Unit ${index + 1}`,
          stops: textValue(unit.stops),
          capacity: textValue(unit.capacity_kg),
          type: textValue(unit.equipment_type_code || unit.type),
          ...(Object.keys(objectValue(unit.requirements)).length ? { requirements: requirementProfileFromApi(unit.requirements), measurements: measurementsFromApi(unit.requirements) } : {}),
        };
      })
    : initialForm.units;
  const unitRequirementsMode: RequirementMode = textValue(requirements.unit_requirement_mode) === 'PER_UNIT' || units.some((unit) => unit.requirements) ? 'PER_UNIT' : 'SHARED';
  const building = objectValue(record.attributes.building_details);
  const measures = objectValue(record.attributes.technical_measurements);
  const access = objectValue(record.attributes.access_conditions);
  const referral = objectValue(context.referral);
  const previousStep = Number(context.step) || 0;
  const step = previousStep >= 7
    ? 2
    : previousStep >= 5
      ? 1
      : Math.min(2, Math.max(0, previousStep));
  const arrayValue = (value: unknown) => Array.isArray(value) ? value.map(textValue) : [];
  const firstUnit = units[0];
  const industrySegment = textValue(
    requirements.industry_segment ||
      requirements.building_type ||
      building.building_type,
  );
  return { ...initialForm, surveyDate: record.attributes.survey_date || todayDate(), siteName: textValue(context.site_name || context.site_address), siteAddress: textValue(context.site_address), postalAddress: { ...emptyIndiaPostalAddress(), ...objectValue(context.postal_address) } as IndiaPostalAddress, latitude: textValue(gps.latitude), longitude: textValue(gps.longitude), accuracy: textValue(gps.accuracy_m), gpsSource: surveyGpsSource(gps.source), buildingType: industrySegment, contacts: contacts.length ? contacts : initialForm.contacts, referralName: textValue(referral.name), referralContact: textValue(referral.contact), units, unitRequirementsMode, shaftWidth: textValue(measures.shaft_width_mm), shaftDepth: textValue(measures.shaft_depth_mm), pitDepth: textValue(measures.pit_depth_mm), headroom: textValue(measures.headroom_mm), accessNotes: textValue(access.notes), capacity: textValue(firstUnit?.capacity || requirements.capacity_kg), requirementsStops: textValue(firstUnit?.stops || requirements.stops), quantity: String(units.length || Number(requirements.quantity) || 1), liftType: textValue(firstUnit?.type || requirements.equipment_type_code || requirements.lift_type), application: textValue(requirements.application), industrySegment, technology: textValue(requirements.technology), capacityBand: textValue(requirements.capacity_band), driveType: textValue(requirements.drive_type), speedBand: textValue(requirements.speed_band), doorConfiguration: textValue(requirements.door_configuration), doorType: textValue(requirements.door_type), machineRoom: textValue(requirements.machine_room), controlSystem: textValue(requirements.control_system), accessibilityFeatures: arrayValue(requirements.accessibility_features), safetyFeatures: arrayValue(requirements.safety_features), finish: textValue(requirements.finish), standardsReferences: arrayValue(requirements.standards_references), step };
}

function fromExistingLeadData(journey: ProviderWorkJourney | null, revision: Resource<RequirementRevisionAttributes> | null): SurveyForm {
  const context = journey?.attributes.context || {};
  const site = context.site || {};
  const requester = context.requester || {};
  const referral = context.referral || {};
  const capturedRequirements = objectValue(context.requirements?.captured);
  const text = (value: unknown) => textValue(value);
  const revisionRequirements = objectValue(revision?.attributes.requirements);
  const revisionScope = objectValue(revision?.attributes.requirement_scope);
  const revisionScopeRequirements = objectValue(revisionScope.requirements);
  const latestRequirements = objectValue(context.requirements?.latest);
  const requirements = {
    ...revisionRequirements,
    ...revisionScopeRequirements,
    ...capturedRequirements,
    ...latestRequirements,
  };
  const industrySegment =
    text(latestRequirements.industry_segment) ||
    text(capturedRequirements.industry_segment) ||
    text(revisionRequirements.industry_segment) ||
    text(
      requirements.industrySegment ||
        requirements.site_segment ||
        requirements.building_type ||
        objectValue(site).industry_segment,
    );
  const array = (value: unknown) => Array.isArray(value) ? value.map(text) : [];
  const requirementUnits = Array.isArray(requirements.units)
    ? requirements.units
    : Array.isArray(revisionScope.units)
      ? revisionScope.units
      : [];
  const quantity = Math.max(1, Number(requirements.quantity) || requirementUnits.length || 1);
  const units: Unit[] = requirementUnits.length
    ? requirementUnits.map((entry, index) => ({
        label: text(objectValue(entry).label) || `Unit ${index + 1}`,
        stops: text(objectValue(entry).stops),
        capacity: text(objectValue(entry).capacity_kg),
        type: text(
          objectValue(entry).equipment_type_code || objectValue(entry).type,
        ),
        ...(Object.keys(objectValue(objectValue(entry).requirements)).length ? { requirements: requirementProfileFromApi(objectValue(entry).requirements), measurements: measurementsFromApi(objectValue(entry).requirements) } : {}),
      }))
    : Array.from({ length: quantity }, (_, index) => ({
        label: `Unit ${index + 1}`,
        stops: index === 0 ? text(requirements.stops) : '',
        capacity: index === 0 ? text(requirements.capacity_kg) : '',
        type:
          index === 0
            ? text(
                requirements.equipment_type_code || requirements.lift_type,
              ) || 'PASSENGER_TRACTION'
            : '',
      }));
  const unitRequirementsMode: RequirementMode = text(requirements.unit_requirement_mode) === 'PER_UNIT' || units.some((unit) => unit.requirements) ? 'PER_UNIT' : 'SHARED';
  const requesterContact = text(requester.contact_reference);
  const requesterName = text(requester.name);
  const intakeSite = parseIndiaPostalAddressSummary(text(site.summary));
  return {
    ...initialForm,
    siteName: intakeSite.siteName,
    siteAddress: formatIndiaPostalAddress(intakeSite.postalAddress),
    postalAddress: intakeSite.postalAddress,
    latitude: text(site.latitude),
    longitude: text(site.longitude),
    accuracy: text(site.accuracy_m),
    gpsSource: surveyGpsSource(site.source),
    buildingType: industrySegment,
    contacts: requesterName || requesterContact ? [{ name: requesterName, role: 'Requester', phone: requesterContact }] : initialForm.contacts,
    referralName: text(referral.name),
    referralContact: text(referral.number || referral.email),
    units,
    unitRequirementsMode,
    shaftWidth: text(requirements.shaft_width_mm),
    shaftDepth: text(requirements.shaft_depth_mm),
    pitDepth: text(requirements.pit_depth_mm),
    headroom: text(requirements.headroom_mm),
    accessNotes: text(requirements.notes),
    capacity: text(requirements.capacity_kg),
    requirementsStops: text(requirements.stops),
    quantity: text(requirements.quantity) || '1',
    liftType: text(requirements.equipment_type_code || requirements.lift_type),
    application: text(requirements.application),
    industrySegment,
    technology: text(requirements.technology),
    capacityBand: text(requirements.capacity_band),
    driveType: text(requirements.drive_type),
    speedBand: text(requirements.speed_band),
    doorConfiguration: text(requirements.door_configuration),
    doorType: text(requirements.door_type),
    machineRoom: text(requirements.machine_room),
    controlSystem: text(requirements.control_system),
    accessibilityFeatures: array(requirements.accessibility_features),
    safetyFeatures: array(requirements.safety_features),
    finish: text(requirements.finish),
    standardsReferences: array(requirements.standards_references),
  };
}

const optionsFor = (catalogue: RequirementCatalogue | null, code: string) => catalogue?.groups.find((group) => group.code === code)?.options || [];
const requirementProfileToApi = (profile: RequirementProfile) => ({
  application: profile.application || undefined,
  technology: profile.technology || undefined,
  capacity_band: profile.capacityBand || undefined,
  drive_type: profile.driveType || undefined,
  speed_band: profile.speedBand || undefined,
  door_configuration: profile.doorConfiguration || undefined,
  door_type: profile.doorType || undefined,
  machine_room: profile.machineRoom || undefined,
  control_system: profile.controlSystem || undefined,
  accessibility_features: profile.accessibilityFeatures,
  safety_features: profile.safetyFeatures,
  finish: profile.finish || undefined,
  standards_references: profile.standardsReferences,
  notes: profile.accessNotes || undefined,
});
const requirementProfileFromApi = (value: unknown): RequirementProfile => {
  const profile = objectValue(value);
  const list = (key: string) => Array.isArray(profile[key]) ? (profile[key] as unknown[]).map(textValue) : [];
  return {
    application: textValue(profile.application),
    technology: textValue(profile.technology),
    capacityBand: textValue(profile.capacity_band),
    driveType: textValue(profile.drive_type),
    speedBand: textValue(profile.speed_band),
    doorConfiguration: textValue(profile.door_configuration),
    doorType: textValue(profile.door_type),
    machineRoom: textValue(profile.machine_room),
    controlSystem: textValue(profile.control_system),
    accessibilityFeatures: list('accessibility_features'),
    safetyFeatures: list('safety_features'),
    finish: textValue(profile.finish),
    standardsReferences: list('standards_references'),
    accessNotes: textValue(profile.notes),
  };
};
const measurementsToApi = (measurements: UnitMeasurements) => ({
  shaft_width_mm: positiveNumber(measurements.shaftWidth),
  shaft_depth_mm: positiveNumber(measurements.shaftDepth),
  pit_depth_mm: positiveNumber(measurements.pitDepth),
  headroom_mm: positiveNumber(measurements.headroom),
});
const measurementsFromApi = (value: unknown): UnitMeasurements => {
  const measurements = objectValue(value);
  return {
    shaftWidth: textValue(measurements.shaft_width_mm),
    shaftDepth: textValue(measurements.shaft_depth_mm),
    pitDepth: textValue(measurements.pit_depth_mm),
    headroom: textValue(measurements.headroom_mm),
  };
};
const requirementProfileForForm = (form: SurveyForm): RequirementProfile => ({
  application: form.application,
  technology: form.technology,
  capacityBand: form.capacityBand,
  driveType: form.driveType,
  speedBand: form.speedBand,
  doorConfiguration: form.doorConfiguration,
  doorType: form.doorType,
  machineRoom: form.machineRoom,
  controlSystem: form.controlSystem,
  accessibilityFeatures: [...form.accessibilityFeatures],
  safetyFeatures: [...form.safetyFeatures],
  finish: form.finish,
  standardsReferences: [...form.standardsReferences],
  accessNotes: form.accessNotes,
});
const unitDetailsPayload = (units: Unit[], includeRequirements = false) =>
  units.map((unit, index) => ({
    unit_key: `UNIT-${index + 1}`,
    label: unit.label || `Unit ${index + 1}`,
    equipment_type_code: unit.type || undefined,
    stops: positiveNumber(unit.stops),
    capacity_kg: positiveNumber(unit.capacity),
    ...(includeRequirements && unit.requirements ? { requirements: { ...requirementProfileToApi(unit.requirements), ...(unit.measurements ? measurementsToApi(unit.measurements) : {}) } } : {}),
  }));
const requirementPayload = (form: SurveyForm) => ({ business_operation_code: 'ELEVATOR_SERVICES', profile_mode: 'PER_UNIT', unit_requirement_mode: form.unitRequirementsMode, quantity: form.units.length, units: unitDetailsPayload(form.units, form.unitRequirementsMode === 'PER_UNIT'), application: form.application || undefined, industry_segment: form.industrySegment || undefined, technology: form.technology || undefined, capacity_band: form.capacityBand || undefined, drive_type: form.driveType || undefined, speed_band: form.speedBand || undefined, door_configuration: form.doorConfiguration || undefined, door_type: form.doorType || undefined, machine_room: form.machineRoom || undefined, control_system: form.controlSystem || undefined, accessibility_features: form.accessibilityFeatures, safety_features: form.safetyFeatures, finish: form.finish || undefined, standards_references: form.standardsReferences, notes: form.accessNotes || undefined });
const defaultRequiredRequirementFields = ['equipment_type_code', 'industry_segment', 'application', 'technology', 'drive_type', 'capacity_kg', 'stops', 'quantity', 'speed_band', 'door_configuration', 'door_type', 'machine_room', 'control_system', 'finish'];
const defaultRequiredMultiRequirementFields = ['safety_features', 'standards_references'];
const missingRequirementFields = (catalogue: RequirementCatalogue | null, values: Record<string, unknown>) => {
  const required = catalogue?.completion?.required_fields || defaultRequiredRequirementFields;
  const requiredMulti = catalogue?.completion?.required_multi_fields || defaultRequiredMultiRequirementFields;
  const perUnit = Array.isArray(values.units) && values.units.length > 0;
  const missing = required.filter((field) => perUnit && ['equipment_type_code', 'capacity_kg', 'stops', 'quantity'].includes(field) ? false : values[field] === undefined || values[field] === null || values[field] === '');
  if (perUnit) (values.units as Array<Record<string, unknown>>).forEach((unit, index) => { if (!unit.equipment_type_code) missing.push(`units[${index}].equipment_type_code`); if (!unit.stops) missing.push(`units[${index}].stops`); if (!unit.capacity_kg) missing.push(`units[${index}].capacity_kg`); });
  return [...missing, ...requiredMulti.filter((field) => !Array.isArray(values[field]) || !(values[field] as unknown[]).length)];
};
const humanizeKey = (key: string) => key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const detailLabels: Record<string, string> = {
  status: 'Submission status', revision: 'Survey revision', survey_date: 'Survey date', created_at: 'Submitted at', workflow_step: 'Survey step',
  site_name: 'Site or project name', site_address: 'Site address', building_details: 'Building type', gps_coordinates: 'Site coordinates', location_source: 'Location source', accuracy_m: 'GPS accuracy', captured_at: 'Location captured',
  contacts: 'Site contacts', referral: 'Referral source', site_role: 'Site role', contact_reference: 'Contact reference', email: 'Email', quantity: 'Total units', stops: 'Stops / floors', capacity_kg: 'Capacity (kg)', equipment_type_code: 'Equipment type', industry_segment: 'Industry / site segment',
  application: 'Application', technology: 'Technology', drive_type: 'Drive type', speed_band: 'Speed band', door_configuration: 'Door configuration', door_type: 'Door type', machine_room: 'Machine room',
  control_system: 'Control system', finish: 'Finish', accessibility_features: 'Accessibility features', safety_features: 'Safety / emergency features', standards_references: 'Standards references', notes: 'Additional requirements',
  label: 'Unit name', type: 'Equipment type', unit_count: 'Units captured', unit_details: 'Unit profiles', shaft_width_mm: 'Shaft width (mm)', shaft_depth_mm: 'Shaft depth (mm)', pit_depth_mm: 'Pit depth (mm)', headroom_mm: 'Headroom (mm)'
};
const detailLabel = (key: string) => detailLabels[key] || humanizeKey(key);
const readableCode = (value: string) => value.split('_').map((part) => /^[A-Z]{2,}\d*$/.test(part) ? part : part.charAt(0) + part.slice(1).toLowerCase()).join(' ');
const hasDetailValue = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.some(hasDetailValue);
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).some(hasDetailValue);
  return true;
};
const readableValue = (value: unknown, key?: string): string => {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map((item) => readableValue(item, key)).join(', ') : 'None recorded';
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([nestedKey, item]) => `${detailLabel(nestedKey)}: ${readableValue(item, nestedKey)}`).join(' · ');
  const text = String(value);
  if (['created_at', 'captured_at'].includes(key || '') && !Number.isNaN(new Date(text).getTime())) return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(text));
  if (key === 'survey_date' && /^\d{4}-\d{2}-\d{2}$/.test(text)) return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(`${text}T00:00:00+05:30`));
  return /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(text) ? readableCode(text) : text;
};

function SubmittedDetailList({ values, highlightKeys = [] }: { values: Record<string, unknown>; highlightKeys?: string[] }) {
  const entries = Object.entries(values).filter(([, value]) => hasDetailValue(value));
  return entries.length ? <dl className="site-survey-submitted-fields">{entries.map(([key, value]) => <div className={highlightKeys.includes(key) ? 'site-survey-difference-highlight' : undefined} key={key}><dt>{detailLabel(key)}</dt><dd>{readableValue(value, key)}</dd></div>)}</dl> : null;
}

function SubmittedCard({ icon, title, description, values, children, wide = false }: { icon: string; title: string; description: string; values: Record<string, unknown>; children?: ReactNode; wide?: boolean }) {
  if (!Object.values(values).some(hasDetailValue) && !children) return null;
  return <article className={`site-survey-submitted-card${wide ? ' site-survey-submitted-card-wide' : ''}`}><div className="site-survey-submitted-card-heading"><span className="site-survey-card-icon">{icon}</span><div><h4>{title}</h4><p>{description}</p></div></div>{children || <SubmittedDetailList values={values} />}</article>;
}

function withoutKeys(values: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !keys.includes(key)));
}

function SubmittedUnitProfiles({ units, defaultRequirements = {}, compare = false }: { units: Array<Record<string, unknown>>; defaultRequirements?: Record<string, unknown>; compare?: boolean }) {
  const unitProfiles = units.map((unit) => ({
    unit,
    requirements: objectValue(unit.requirements),
  }));
  const unitDetails = unitProfiles.map(({ unit }) => ({ type: unit.equipment_type_code || unit.type, stops: unit.stops, capacity_kg: unit.capacity_kg }));
  const differingKeys = (profiles: Array<Record<string, unknown>>) => Object.keys(profiles[0] || {}).filter((key) => {
    const values = profiles.map((profile) => JSON.stringify(profile[key] ?? null));
    return new Set(values).size > 1;
  });
  const differingUnitKeys = differingKeys(unitDetails);
  const profileKeys = [...new Set([...Object.keys(defaultRequirements), ...unitProfiles.flatMap(({ requirements }) => Object.keys(requirements))])];
  const effectiveProfiles = unitProfiles.map(({ requirements }) => Object.fromEntries(profileKeys.map((key) => [key, hasDetailValue(requirements[key]) ? requirements[key] : defaultRequirements[key]])));
  const differingProfileKeys = differingKeys(effectiveProfiles);
  const compareKeys = new Set(differingProfileKeys);
  const compareProfiles = compare && units.length > 1;
  return units.length ? <div className={`site-survey-submitted-units${compareProfiles ? ' site-survey-submitted-units-compare' : ''}`}>
    {compareProfiles && <p className="site-survey-comparison-note">Highlighted rows differ between lifts.</p>}
    {unitProfiles.map(({ unit }, index) => {
    const defaultLabel = `Unit ${index + 1}`;
    const label = readableValue(unit.label);
    const customLabel = label !== 'Not recorded' && label !== defaultLabel;
    const displayedProfileKeys = compareProfiles
      ? profileKeys.filter((key) => differingProfileKeys.includes(key) || effectiveProfiles.some((profile) => hasDetailValue(profile[key]) && JSON.stringify(profile[key]) !== JSON.stringify(defaultRequirements[key])))
      : profileKeys.filter((key) => hasDetailValue(unitProfiles[index].requirements[key]) && JSON.stringify(unitProfiles[index].requirements[key]) !== JSON.stringify(defaultRequirements[key]));
    const profileValues = Object.fromEntries(displayedProfileKeys.map((key) => {
      const value = effectiveProfiles[index][key];
      return [key, hasDetailValue(value) ? value : compareProfiles ? 'Not recorded' : value];
    }).filter(([, value]) => hasDetailValue(value)));
    return <article className="site-survey-submitted-unit" key={`submitted-unit-${index}`}>
      <div className="site-survey-submitted-unit-heading"><strong>{customLabel ? label : defaultLabel}</strong>{customLabel && <span>{defaultLabel}</span>}</div>
      <SubmittedDetailList values={Object.fromEntries(Object.entries(unitDetails[index]).map(([key, value]) => [key, hasDetailValue(value) ? value : compareProfiles ? 'Not recorded' : value]))} highlightKeys={differingUnitKeys} />
      {Object.keys(profileValues).length > 0 ? <div className="site-survey-unit-profile-differences"><small>{compareProfiles ? 'Lift-specific values' : 'Requirements that differ from the default profile'}</small><SubmittedDetailList values={profileValues} highlightKeys={[...compareKeys]} /></div> : <p className="site-survey-unit-default-note">{compareProfiles ? 'No technical requirement differences.' : 'Uses the default technical profile.'}</p>}
    </article>;
  })}</div> : <p className="site-survey-empty-detail">Unit details have not been recorded.</p>;
}

function RequirementProfileFields({
  values,
  catalogue,
  namePrefix,
  onChange,
}: {
  values: RequirementProfile;
  catalogue: RequirementCatalogue | null;
  namePrefix: string;
  onChange: <K extends keyof RequirementProfile>(key: K, value: RequirementProfile[K]) => void;
}) {
  const selectField = (label: string, key: keyof RequirementProfile, group: string) => (
    <label key={key}>{label}<SortedSelect value={values[key] as string} onChange={(event) => onChange(key, event.target.value as never)}><option value="">Select from catalogue</option>{optionsFor(catalogue, group).map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</SortedSelect></label>
  );
  return <>
    <div className="site-survey-technical-grid">
      {selectField('Application', 'application', 'APPLICATION')}
      {selectField('Technology', 'technology', 'TECHNOLOGY')}
      {selectField('Drive type', 'driveType', 'DRIVE_TYPE')}
      {selectField('Door configuration', 'doorConfiguration', 'DOOR_CONFIGURATION')}
      {selectField('Door type', 'doorType', 'DOOR_TYPE')}
      {selectField('Machine room', 'machineRoom', 'MACHINE_ROOM')}
      {selectField('Control system', 'controlSystem', 'CONTROL_SYSTEM')}
      {selectField('Finish', 'finish', 'FINISH')}
      {selectField('Speed band', 'speedBand', 'SPEED_BAND')}
    </div>
    <div className="site-survey-choice-grid">
      <RequirementMultiChoice name={`${namePrefix}_accessibility_features`} title="Accessibility features" help="Select every accessibility feature required for this lift." options={optionsFor(catalogue, 'ACCESSIBILITY_FEATURE')} value={values.accessibilityFeatures} onChange={(value) => onChange('accessibilityFeatures', value)} />
      <RequirementMultiChoice name={`${namePrefix}_safety_features`} title="Safety / emergency features" help="Select the safety and emergency functions for this lift." options={optionsFor(catalogue, 'SAFETY_FEATURE')} value={values.safetyFeatures} onChange={(value) => onChange('safetyFeatures', value)} />
      <RequirementMultiChoice name={`${namePrefix}_standards_references`} title="Standards references" help="Select applicable reference standards; final compliance remains subject to authority review." options={optionsFor(catalogue, 'STANDARDS_REFERENCE')} value={values.standardsReferences} onChange={(value) => onChange('standardsReferences', value)} />
    </div>
    <label>Access conditions / notes<textarea rows={3} value={values.accessNotes} onChange={(event) => onChange('accessNotes', event.target.value)} /></label>
  </>;
}

function SubmittedContactProfiles({
  contacts,
  referral,
}: {
  contacts: unknown[];
  referral: Record<string, unknown>;
}) {
  const contactProfiles = contacts
    .map(objectValue)
    .filter((contact) => Object.values(contact).some(hasDetailValue));
  const referralDetails = {
    name: referral.name,
    contact: referral.contact || referral.number || referral.email,
  };
  return (
    <div className="site-survey-contact-snapshot">
      {contactProfiles.length > 0 ? (
        <section>
          <h5>Site contacts</h5>
          <div className="site-survey-contact-snapshot-grid">
            {contactProfiles.map((contact, index) => (
              <article className="site-survey-submitted-unit" key={`survey-contact-${index}`}>
                <div className="site-survey-submitted-unit-heading">
                  <strong>{textValue(contact.name) || `Contact ${index + 1}`}</strong>
                </div>
                <SubmittedDetailList values={{
                  site_role: contact.role,
                  contact_reference: contact.phone || contact.mobile || contact.contact_reference,
                  email: contact.email,
                }} />
              </article>
            ))}
          </div>
        </section>
      ) : (
        <p className="site-survey-empty-detail">No site contacts recorded.</p>
      )}
      {Object.values(referralDetails).some(hasDetailValue) && (
        <section className="site-survey-referral-snapshot">
          <h5>Referral</h5>
          <SubmittedDetailList values={referralDetails} />
        </section>
      )}
    </div>
  );
}

function FinalRequirementDetails({ revision }: { revision: Resource<RequirementRevisionAttributes> }) {
  const attributes = revision.attributes;
  const scope = objectValue(attributes.requirement_scope);
  const values = {
    ...objectValue(attributes.requirements),
    ...objectValue(scope.requirements),
  };
  const units = firstArray(scope.units, values.units).map((unit) => objectValue(unit));
  const shared = withoutKeys(values, ['units', 'profile_mode', 'unit_requirement_mode', 'business_operation_code', 'quantity', 'stops', 'capacity_kg']);
  return <section className="site-survey-final-requirements"><div className="site-survey-submitted-heading"><div><span className="eyebrow">Final active requirements</span><strong>Current requirement scope</strong><small>{attributes.approved ? 'Approved requirement scope' : 'Latest captured requirement scope · approval pending'}</small></div><span className="site-survey-readonly">Current</span></div><div className="site-survey-requirement-history-content">{Object.values(shared).some(hasDetailValue) ? <SubmittedDetailList values={shared} /> : <p className="site-survey-empty-detail">No shared requirements are recorded.</p>}{units.length > 0 && <><h4>Elevator units</h4><SubmittedUnitProfiles units={units} defaultRequirements={shared} compare={units.length > 1} /></>}</div></section>;
}

function SubmittedSurveySnapshot({ survey, label = 'Submitted survey', open = true, includeRequirements = true, showSurveyMetadata = true, finalRevision = null }: { survey: Resource<SiteSurveyAttributes>; label?: string; open?: boolean; includeRequirements?: boolean; showSurveyMetadata?: boolean; finalRevision?: Resource<RequirementRevisionAttributes> | null }) {
  const attributes = survey.attributes;
  const surveyScope = objectValue(attributes.requirement_scope);
  const surveyScopeRequirements = objectValue(surveyScope.requirements);
  const surveyRequirements = objectValue(attributes.requirements);
  const revisionScope = objectValue(finalRevision?.attributes.requirement_scope);
  const revisionScopeRequirements = objectValue(revisionScope.requirements);
  const context = objectValue(attributes.survey_context);
  const gps = objectValue(context.gps);
  const contacts = Array.isArray(context.contacts) ? context.contacts : [];
  const referral = objectValue(context.referral);
  const unitSource = firstArray(
    attributes.unit_details,
    surveyScope.units,
    surveyScopeRequirements.units,
    surveyRequirements.units,
    revisionScope.units,
    revisionScopeRequirements.units,
    finalRevision?.attributes.requirements &&
      objectValue(finalRevision.attributes.requirements).units,
  );
  const units = unitSource.map((unit) => objectValue(unit));
  const requirementValues = {
    ...((includeRequirements && surveyRequirements) || {}),
    ...objectValue(finalRevision?.attributes.requirements),
    ...revisionScopeRequirements,
    ...surveyScopeRequirements,
  };
  const unitValuesAreCaptured = units.length > 0 && units.every((unit) => hasDetailValue(unit.stops) && hasDetailValue(unit.capacity_kg));
  const hasPerUnitRequirementProfiles = requirementValues.unit_requirement_mode === 'PER_UNIT';
  const sharedRequirementValues = unitValuesAreCaptured ? withoutKeys(requirementValues, ['quantity', 'stops', 'capacity_kg', 'units', 'profile_mode', 'unit_requirement_mode', 'business_operation_code']) : withoutKeys(requirementValues, ['units', 'profile_mode', 'unit_requirement_mode', 'business_operation_code']);
  const unitDefaultValues = { ...sharedRequirementValues, ...objectValue(attributes.technical_measurements) };
  const measurementValues = withoutKeys({ ...objectValue(attributes.technical_measurements), ...objectValue(attributes.access_conditions) }, ['notes']);
  const remainingContext = Object.fromEntries(Object.entries(context).filter(([key]) => !['gps', 'contacts', 'referral', 'site_address', 'site_name', 'postal_address', 'step'].includes(key)));
  const hasVisitContext = Object.values(remainingContext).some(hasDetailValue);
  const statusLabel = isDraftSurvey(survey)
    ? 'Draft saved'
    : attributes.status === 'SUBMITTED'
      ? 'Submitted'
      : readableCode(attributes.status);
  return <details className="site-survey-history-item" open={open}>
    <summary className="site-survey-history-summary">
      <div><span className="eyebrow">{label}</span>{showSurveyMetadata && <><strong>{statusLabel}</strong><small>{attributes.survey_date || 'Date not set'}{attributes.created_at ? ` · ${isDraftSurvey(survey) ? 'saved' : 'submitted'} ${new Date(attributes.created_at).toLocaleString()}` : ''}</small></>}</div>
      <span className="site-survey-history-summary-side"><span className="site-survey-readonly">Read-only snapshot</span><span className="site-survey-accordion-chevron" aria-hidden="true">⌄</span></span>
    </summary>
    <div className="site-survey-history-item-body"><div className="site-survey-submitted-grid">
      {showSurveyMetadata && <SubmittedCard icon="01" title="Survey" description="Status and timing" values={{ status: statusLabel, survey_date: attributes.survey_date, created_at: attributes.created_at, workflow_step: context.step }} />}
      <SubmittedCard icon={showSurveyMetadata ? '02' : '01'} title="Site & location" description="Visit location and building context" values={{ site_name: context.site_name, site_address: context.site_address, building_details: attributes.building_details, gps_coordinates: gps.latitude && gps.longitude ? `${gps.latitude}, ${gps.longitude}` : undefined, location_source: gps.source ? surveyGpsSource(gps.source) : undefined, accuracy_m: gps.accuracy_m, captured_at: gps.captured_at }} />
      <SubmittedCard icon={showSurveyMetadata ? '03' : '02'} title="Contacts & referral" description="People and attribution captured during the visit" values={{}}><SubmittedContactProfiles contacts={contacts} referral={referral} /></SubmittedCard>
      <SubmittedCard icon={showSurveyMetadata ? '04' : '03'} title={hasPerUnitRequirementProfiles ? 'Default technical profile' : 'Shared requirement profile'} description={hasPerUnitRequirementProfiles ? 'Baseline values · lift cards below compare unit details' : finalRevision?.attributes.approved ? 'Approved requirements shared by all captured units' : 'Latest captured requirements shared by all captured units'} values={sharedRequirementValues} wide />
      <SubmittedCard icon={showSurveyMetadata ? '05' : '04'} title="Technical measurements" description="Recorded dimensions and access conditions" values={measurementValues} />
      <SubmittedCard icon={showSurveyMetadata ? '06' : '05'} title="Visit context" description="Additional context captured during this survey" values={remainingContext} />
      <SubmittedCard icon={showSurveyMetadata ? '07' : hasVisitContext ? '06' : '05'} title="Elevator units" description={units.length > 1 ? 'Side-by-side comparison · highlighted values differ' : 'Unit identity and unit-level sizing'} values={{}} wide><SubmittedUnitProfiles units={units} defaultRequirements={unitDefaultValues} compare={units.length > 1} /></SubmittedCard>
    </div></div>
  </details>;
}

export function SiteSurveyWizard({ providerId, leadId, leadTitle, onSubmitted, onMessage, onRequirementSaved, onLocationCaptured, onNextStep, nextStepLabel, nextStepUnavailable, readOnly = false, locationReadOnly = false }: { providerId: string; leadId: string; leadTitle: string; onSubmitted: (id: string) => void; onMessage: (value: string) => void; onRequirementSaved?: () => Promise<void>; onLocationCaptured?: (location: { latitude: number; longitude: number; accuracy: number; capturedAt: string }) => void; onNextStep?: () => void; nextStepLabel?: string; nextStepUnavailable?: string; readOnly?: boolean; locationReadOnly?: boolean }) {
  const [surveys, setSurveys] = useState<Resource<SiteSurveyAttributes>[]>([]);
  const [record, setRecord] = useState<Resource<SiteSurveyAttributes> | null>(null);
  const [latestRevision, setLatestRevision] = useState<Resource<RequirementRevisionAttributes> | null>(null);
  const [requirementRevisions, setRequirementRevisions] = useState<Resource<RequirementRevisionAttributes>[]>([]);
  const [catalogue, setCatalogue] = useState<RequirementCatalogue | null>(null);
  const [prefilledForm, setPrefilledForm] = useState<SurveyForm>(initialForm);
  const [form, setForm] = useState<SurveyForm>(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [gpsMessage, setGpsMessage] = useState('');
  const [prefillNotice, setPrefillNotice] = useState('');
  const [active, setActive] = useState(false);
  const [showSharedMergeConfirmation, setShowSharedMergeConfirmation] = useState(false);
  const [sharedMergeSourceIndex, setSharedMergeSourceIndex] = useState(0);
  const activeSurveys = useMemo(
    () => surveys.filter(isDraftSurvey).sort(newestSurveyFirst),
    [surveys],
  );
  const currentDraft = activeSurveys[0] || null;
  const latestSubmitted = useMemo(
    () =>
      surveys
        .filter((survey) => !isDraftSurvey(survey))
        .sort(newestSurveyFirst)[0] || null,
    [surveys],
  );

  useEffect(() => {
    let current = true;
    setRecord(null); setSurveys([]); setLatestRevision(null); setRequirementRevisions([]); setActive(false); setForm(initialForm); setPrefilledForm(initialForm); setPrefillNotice(''); setError('');
    void Promise.all([
      operationsData.siteSurveys(providerId, leadId),
      operationsData.elevatorRequirementCatalogue(providerId),
      operationsData.marketingLeadJourney(providerId, leadId).catch(() => null),
      operationsData.requirementRevisions(providerId, leadId).catch(() => ({ data: [] })),
    ]).then(([result, options, journey, revisions]) => {
      if (!current) return;
      const orderedRevisions = [...revisions.data].sort((left, right) => right.attributes.revision_number - left.attributes.revision_number);
      setSurveys(result.data); setCatalogue(options); setLatestRevision(orderedRevisions[0] || null); setRequirementRevisions(orderedRevisions);
      const submitted = result.data.find((survey) => !isDraftSurvey(survey));
      const draft = result.data.find(isDraftSurvey);
      if (submitted) onSubmitted(submitted.id);
      const existing = fromExistingLeadData(journey, orderedRevisions[0] || null);
      setPrefilledForm(existing);
      if (!draft && !submitted && (journey?.attributes.context.site?.summary || revisions.data.length || journey?.attributes.context.referral?.name)) {
        setForm(existing);
        setPrefillNotice('Lead, Work Intake, referral, location, and saved requirement details have been prefilled. Confirm only the survey-specific changes.');
      }
    }).catch((cause) => { if (current) setError((cause as Error).message || 'Survey setup could not be loaded.'); });
    return () => { current = false; };
  }, [providerId, leadId]);

  function update<K extends keyof SurveyForm>(key: K, value: SurveyForm[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function updateSharedRequirement<K extends keyof RequirementProfile>(key: K, value: RequirementProfile[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function changeUnitRequirementsMode(mode: RequirementMode, sourceUnitIndex = 0) {
    if (mode === form.unitRequirementsMode) return;
    if (mode === 'PER_UNIT') {
      const profile = requirementProfileForForm(form);
      const measurements = { shaftWidth: form.shaftWidth, shaftDepth: form.shaftDepth, pitDepth: form.pitDepth, headroom: form.headroom };
      setForm((current) => ({ ...current, unitRequirementsMode: mode, units: current.units.map((unit) => ({ ...unit, requirements: unit.requirements || { ...profile }, measurements: unit.measurements || { ...measurements } })) }));
      return;
    }
    setForm((current) => {
      const sourceUnit = current.units[sourceUnitIndex] || current.units[0];
      return { ...current, ...(sourceUnit?.requirements || {}), ...(sourceUnit?.measurements || {}), unitRequirementsMode: mode, units: current.units.map((unit) => { const next = { ...unit }; delete next.requirements; delete next.measurements; return next; }) };
    });
  }
  function unitRequirementProfilesDiffer() {
    const defaultProfile = requirementProfileForForm(form);
    const defaultMeasurements = { shaftWidth: form.shaftWidth, shaftDepth: form.shaftDepth, pitDepth: form.pitDepth, headroom: form.headroom };
    const signatures = form.units.map((unit) => JSON.stringify({ requirements: unit.requirements || defaultProfile, measurements: unit.measurements || defaultMeasurements }));
    return signatures.some((signature) => signature !== signatures[0]);
  }
  function selectSharedRequirements() {
    if (form.unitRequirementsMode === 'PER_UNIT' && unitRequirementProfilesDiffer()) {
      setSharedMergeSourceIndex(0);
      setShowSharedMergeConfirmation(true);
    }
    else changeUnitRequirementsMode('SHARED');
  }
  function updateUnitRequirement<K extends keyof RequirementProfile>(index: number, key: K, value: RequirementProfile[K]) {
    setForm((current) => ({ ...current, units: current.units.map((unit, unitIndex) => unitIndex === index ? { ...unit, requirements: { ...(unit.requirements || requirementProfileForForm(current)), [key]: value } } : unit) }));
  }
  function updateUnitMeasurement(index: number, key: keyof UnitMeasurements, value: string) {
    setForm((current) => ({ ...current, units: current.units.map((unit, unitIndex) => unitIndex === index ? { ...unit, measurements: { shaftWidth: unit.measurements?.shaftWidth ?? current.shaftWidth, shaftDepth: unit.measurements?.shaftDepth ?? current.shaftDepth, pitDepth: unit.measurements?.pitDepth ?? current.pitDepth, headroom: unit.measurements?.headroom ?? current.headroom, [key]: value } } : unit) }));
  }
  function copyFirstUnitSpecifications() {
    const firstUnit = form.units[0];
    if (!firstUnit) return;
    update(
      'units',
      form.units.map((unit, index) =>
        index === 0
          ? unit
          : {
              ...unit,
              type: firstUnit.type,
              stops: firstUnit.stops,
              capacity: firstUnit.capacity,
              ...(firstUnit.requirements ? { requirements: { ...firstUnit.requirements, accessibilityFeatures: [...firstUnit.requirements.accessibilityFeatures], safetyFeatures: [...firstUnit.requirements.safetyFeatures], standardsReferences: [...firstUnit.requirements.standardsReferences] } } : {}),
              ...(firstUnit.measurements ? { measurements: { ...firstUnit.measurements } } : {}),
            },
      ),
    );
  }
  function begin() {
    if (readOnly) return;
    setRecord(null);
    setForm(latestSubmitted ? fromSurvey(latestSubmitted) : prefilledForm);
    setActive(true);
    setNotice(latestSubmitted ? 'Submitted survey loaded. Edit the details and submit the updated survey.' : '');
    setError('');
  }
  function resume(draft: Resource<SiteSurveyAttributes>) { if (readOnly) return; setRecord(draft); setForm(fromSurvey(draft)); setActive(true); setNotice('Draft loaded. Continue where you left off.'); setError(''); }

  async function save(
    status: 'DRAFT' | 'SUBMITTED',
    formToSave: SurveyForm = form,
  ): Promise<boolean> {
    if (readOnly) return false;
    if (status === 'SUBMITTED' && (!formToSave.siteName.trim() || !indiaPostalAddressComplete(formToSave.postalAddress))) { setError('Enter the site or project name and complete the PIN based site address before submitting.'); return false; }
    setBusy(true); setError(''); setNotice('');
    const payload = {
      status,
      survey_date: formToSave.surveyDate || undefined,
      proposed_elevator_count: formToSave.units.length,
      unit_details: unitDetailsPayload(formToSave.units, formToSave.unitRequirementsMode === 'PER_UNIT'),
      building_details: { building_type: formToSave.industrySegment || formToSave.buildingType || undefined },
      technical_measurements: { shaft_width_mm: positiveNumber(formToSave.shaftWidth), shaft_depth_mm: positiveNumber(formToSave.shaftDepth), pit_depth_mm: positiveNumber(formToSave.pitDepth), headroom_mm: positiveNumber(formToSave.headroom) },
      access_conditions: { notes: formToSave.accessNotes || undefined },
      requirements: requirementPayload(formToSave),
      survey_context: { step: formToSave.step, site_name: formToSave.siteName, site_address: formatIndiaPostalAddress(formToSave.postalAddress), postal_address: formToSave.postalAddress, gps: { latitude: formToSave.latitude || undefined, longitude: formToSave.longitude || undefined, accuracy_m: positiveNumber(formToSave.accuracy), source: surveyGpsSource(formToSave.gpsSource), captured_at: formToSave.latitude && formToSave.longitude ? new Date().toISOString() : undefined }, contacts: formToSave.contacts.filter((contact) => contact.name || contact.role || contact.phone), referral: { name: formToSave.referralName || undefined, contact: formToSave.referralContact || undefined } },
    };
    try {
      let saved: Resource<SiteSurveyAttributes>;
      if (record) saved = await operationsData.updateSiteSurveyDraft(providerId, leadId, record.id, { ...payload, expected_revision: record.attributes.revision }, crypto.randomUUID());
      else saved = await operationsData.createSiteSurvey(providerId, leadId, payload, crypto.randomUUID());
      const normalizedSaved = { ...saved, attributes: { ...saved.attributes, status } };
      setRecord(normalizedSaved); setSurveys((current) => [normalizedSaved, ...current.filter((item) => item.id !== normalizedSaved.id)]);
      if (status === 'SUBMITTED') { setActive(false); onSubmitted(saved.id); onMessage('Site survey submitted. A provider-only draft quotation was created; customer delivery remains unavailable until it is reviewed and published.'); }
      else setNotice('Draft saved securely. You can resume it from this lead later.');
      return true;
    } catch (cause) { setError((cause as Error).message || 'Survey could not be saved.'); return false; }
    finally { setBusy(false); }
  }

  async function saveRequirements() {
    const saved = await save('DRAFT');
    if (!saved) return;
    await onRequirementSaved?.();
    setNotice('Partial requirements saved in the survey draft. Complete all mandatory fields before submitting the survey.');
  }

  async function saveDraftAndNext() {
    if (form.step === 0 && (!form.siteName.trim() || !indiaPostalAddressComplete(form.postalAddress))) {
      setError('Enter the site or project name and complete the PIN based site address before continuing.');
      return;
    }
    const nextForm = { ...form, step: form.step + 1 };
    if (await save('DRAFT', nextForm)) setForm(nextForm);
  }

  function captureGps() {
    if (readOnly || locationReadOnly) return;
    setGpsMessage('');
    if (!navigator.geolocation) { setGpsMessage('Location access is unavailable in this browser. Enter coordinates manually.'); return; }
    navigator.geolocation.getCurrentPosition((position) => { const capturedAt = new Date().toISOString(); update('latitude', String(position.coords.latitude)); update('longitude', String(position.coords.longitude)); update('accuracy', String(Math.round(position.coords.accuracy))); update('gpsSource', 'GPS'); onLocationCaptured?.({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt }); setGpsMessage('Coordinates captured from this device. Review and confirm the location before saving.'); }, () => setGpsMessage('Location permission was not granted. Enter coordinates manually to continue.'), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (readOnly) return; if (form.step < 2) { void saveDraftAndNext(); return; } if (!form.surveyDate || !form.units.length) { setError('Add a survey date and at least one proposed unit before submitting.'); return; } const missing = missingRequirementFields(catalogue, requirementPayload(form)); if (missing.length) { setError(`Complete mandatory requirements before submitting: ${missing.map(humanizeKey).join(', ')}`); return; } void save('SUBMITTED'); }

  if (readOnly) {
    return <div className="site-survey-workspace">
      <div className="workflow-concluded-banner site-survey-concluded-banner" role="status"><div><strong>Survey &amp; requirements are read-only</strong><span>This Lead journey stage is concluded. The submitted requirement snapshot is retained below for reference; editing and new submissions are disabled.</span></div>{onNextStep ? <Button type="button" onClick={onNextStep}>{nextStepLabel || 'Continue to next step'}</Button> : nextStepUnavailable ? <p><strong>Next step:</strong> {nextStepUnavailable}</p> : null}</div>
      {latestSubmitted ? <div className="site-survey-history-stack"><SubmittedSurveySnapshot survey={latestSubmitted} label="Final survey & requirements" includeRequirements={false} finalRevision={requirementRevisions[0]} /></div> : requirementRevisions[0] ? <FinalRequirementDetails revision={requirementRevisions[0]} /> : <p className="site-survey-empty-detail">No submitted survey details are available for this lead.</p>}
    </div>;
  }

  return <div className="site-survey-workspace">
    {error && <ActionNotification kind="error" title="Survey action needs attention" onClose={() => setError('')}>{error}</ActionNotification>}
    {notice && <ActionNotification kind="success" title="Survey update saved" onClose={() => setNotice('')}>{notice}</ActionNotification>}
    {readOnly && <ActionFeedback kind="info"><span>This Lead journey is concluded. Survey and location updates are read-only.</span></ActionFeedback>}
    {!readOnly && !active && <div className="site-survey-draft-toolbar"><div><strong>{currentDraft ? 'Current draft' : 'Survey & requirements'}</strong><span>{currentDraft ? `Draft saved · ${currentDraft.attributes.survey_date || 'Date not set'} · ${currentDraft.attributes.proposed_elevator_count || currentDraft.attributes.unit_details.length} lifts · last saved ${currentDraft.attributes.created_at ? new Date(currentDraft.attributes.created_at).toLocaleString() : 'recently'}` : latestSubmitted ? `Submitted survey · ${latestSubmitted.attributes.status}` : latestRevision ? 'Saved requirements available' : 'No submitted survey yet'}</span></div><Button type="button" onClick={() => currentDraft ? resume(currentDraft) : begin()}>{currentDraft ? 'Resume draft' : latestSubmitted ? 'Edit & submit update' : latestRevision ? 'Start survey from saved requirements' : 'Start survey'}</Button></div>}
    {!active && latestSubmitted && <SubmittedSurveySnapshot survey={latestSubmitted} label="Final survey & requirements" includeRequirements={false} finalRevision={requirementRevisions[0]} />}
    {!active && currentDraft && <SubmittedSurveySnapshot survey={currentDraft} label="Draft details" open={false} includeRequirements showSurveyMetadata={false} />}
    {!active && !currentDraft && !latestSubmitted && requirementRevisions[0] && <FinalRequirementDetails revision={requirementRevisions[0]} />}
    {active && !readOnly && <form className="site-survey-wizard" onSubmit={submit}>
      <header><div><span className="eyebrow">Marketing · Site survey</span><h3>{record ? 'Resume survey draft' : latestSubmitted ? 'Update submitted survey' : 'New site survey'}</h3><p>{leadTitle}</p></div><Button type="button" variant="secondary" disabled={busy} onClick={() => setActive(false)}>Close</Button></header>
      {prefillNotice && <ActionFeedback kind="info"><span>{prefillNotice}</span></ActionFeedback>}
      <nav className="site-survey-stepper" aria-label="Survey steps">{steps.map((label, index) => <button key={label} type="button" aria-current={form.step === index ? 'step' : undefined} className={form.step === index ? 'current' : index < form.step ? 'complete' : ''} disabled={index > form.step} onClick={() => update('step', index)}><span>{index + 1}</span>{label}</button>)}</nav>
      <div className={`site-survey-step-content site-survey-step-${form.step}`}>
        {form.step === 0 && <>
          <section><h4>Survey setup</h4><p>Confirm the site or project and complete its PIN based address before continuing. This survey stays with its authorized Lead and does not create a customer or quotation recipient.</p><label>Lead<input readOnly value={leadTitle} /></label><label>Site visit date<input type="date" required value={form.surveyDate} onChange={(event) => update('surveyDate', event.target.value)} /></label><label>Building / site segment<SortedSelect value={form.industrySegment} onChange={(event) => update('industrySegment', event.target.value)}><option value="">Select from catalogue</option>{optionsFor(catalogue, 'INDUSTRY_SEGMENT').map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</SortedSelect></label><label>Site or project name *<input required maxLength={240} value={form.siteName} onChange={(event) => update('siteName', event.target.value)} /></label><div className="site-survey-postal-address"><strong>Site address *</strong><IndiaPostalAddressFields value={form.postalAddress} required onChange={(postalAddress) => setForm((current) => ({ ...current, postalAddress, siteAddress: formatIndiaPostalAddress(postalAddress) }))} /></div><div className="site-survey-gps-grid"><label>Latitude<input inputMode="decimal" value={form.latitude} onChange={(event) => { update('latitude', event.target.value); update('gpsSource', 'MANUAL'); }} /></label><label>Longitude<input inputMode="decimal" value={form.longitude} onChange={(event) => { update('longitude', event.target.value); update('gpsSource', 'MANUAL'); }} /></label><label>Accuracy (m)<input type="number" min="0" value={form.accuracy} onChange={(event) => update('accuracy', event.target.value)} /></label></div>{!locationReadOnly && <Button type="button" variant="secondary" disabled={readOnly} onClick={captureGps}>Capture device location</Button>}{locationReadOnly ? <small className="site-survey-location-note" role="status">The linked Work Intake is read-only. Device location capture is unavailable; manual coordinates are saved with this survey.</small> : <p role="status">{gpsMessage || `Location source: ${surveyGpsSource(form.gpsSource)}. Manual entry remains available if permission is denied.`}</p>}</section>
          <section><h4>Site contacts</h4><p>Capture contacts relevant to this site survey only. A contact is not automatically authorized to accept quotations.</p>{form.contacts.map((contact, index) => <div className="site-survey-contact" key={index}><label>Name<input value={contact.name} onChange={(event) => update('contacts', form.contacts.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /></label><label>Site role<SortedSelect value={contact.role} onChange={(event) => update('contacts', form.contacts.map((item, i) => i === index ? { ...item, role: event.target.value } : item))}><option value="">Select site role</option>{!siteContactRoles.includes(contact.role) && contact.role && <option value={contact.role}>{contact.role}</option>}{siteContactRoles.map((role) => <option value={role} key={role}>{role}</option>)}</SortedSelect></label><label>Contact reference<input value={contact.phone} onChange={(event) => update('contacts', form.contacts.map((item, i) => i === index ? { ...item, phone: event.target.value } : item))} /></label><Button type="button" variant="secondary" disabled={form.contacts.length === 1} onClick={() => update('contacts', form.contacts.filter((_, i) => i !== index))}>Remove</Button></div>)}<Button type="button" variant="secondary" onClick={() => update('contacts', [...form.contacts, { name: '', role: '', phone: '' }])}>Add site contact</Button></section>
          <section>
            <h4>Referral and proposed units</h4>
            <p>
              Survey unit count: {form.units.length}. This count can differ
              from Work Intake and applies to this survey; referral details are
              attribution only and do not create a Customer or receive
              quotations automatically.
            </p>
            <label>
              Referrer name
              <input
                value={form.referralName}
                onChange={(event) => update('referralName', event.target.value)}
              />
            </label>
            <label>
              Referrer contact reference
              <input
                value={form.referralContact}
                onChange={(event) =>
                  update('referralContact', event.target.value)
                }
              />
            </label>
            {form.units.length > 1 && (
              <p className="site-survey-unit-guidance">
                  Each lift has its own type, stops, and capacity. Shared intake
                  values prefill Unit 1; other units need their own values, or
                  copy Unit 1 when the lifts have identical specifications.
              </p>
            )}
            {form.units.length > 1 && (
              <Button
                type="button"
                variant="secondary"
                disabled={
                  !form.units[0]?.type &&
                  !form.units[0]?.stops &&
                  !form.units[0]?.capacity
                }
                onClick={copyFirstUnitSpecifications}
              >
                Copy Unit 1 specifications to all units
              </Button>
            )}
            {form.units.map((unit, index) => (
              <div className="site-survey-unit" key={index}>
                <div className="site-survey-unit-heading">
                  <strong>Unit {index + 1}</strong>
                  <span>Specify this lift independently</span>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={form.units.length === 1}
                    onClick={() =>
                      update(
                        'units',
                        form.units.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
                <label>
                  Unit label
                  <input
                    value={unit.label}
                    onChange={(event) =>
                      update(
                        'units',
                        form.units.map((item, i) =>
                          i === index
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Equipment type
                  <SortedSelect
                    value={unit.type}
                    onChange={(event) =>
                      update(
                        'units',
                        form.units.map((item, i) =>
                          i === index
                            ? { ...item, type: event.target.value }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="">Select equipment type</option>
                    {optionsFor(catalogue, 'EQUIPMENT_TYPE').map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </SortedSelect>
                </label>
                <label>
                  Stops
                  <input
                    type="number"
                    min="1"
                    value={unit.stops}
                    onChange={(event) =>
                      update(
                        'units',
                        form.units.map((item, i) =>
                          i === index
                            ? { ...item, stops: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Capacity (kg)
                  <input
                    type="number"
                    min="1"
                    value={unit.capacity}
                    onChange={(event) =>
                      update(
                        'units',
                        form.units.map((item, i) =>
                          i === index
                            ? { ...item, capacity: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              disabled={form.units.length >= 50}
              onClick={() =>
                update('units', [
                  ...form.units,
                  {
                    label: `Unit ${form.units.length + 1}`,
                    stops: '',
                    capacity: '',
                    type: '',
                    ...(form.unitRequirementsMode === 'PER_UNIT' ? { requirements: requirementProfileForForm(form), measurements: { shaftWidth: form.shaftWidth, shaftDepth: form.shaftDepth, pitDepth: form.pitDepth, headroom: form.headroom } } : {}),
                  },
                ])
              }
            >
              Add another unit
            </Button>
          </section>
        </>}
        {form.step === 1 && <section>
          <h4>Site measurements and requirements</h4>
          <p>Choose whether technical requirements are shared across lifts or set separately for each lift. Lift type, stops, and capacity stay individual in either mode.</p>
          <fieldset className="site-survey-requirement-mode">
            <legend>How should requirements apply?</legend>
            <label>
              <input type="radio" name="unit-requirements-mode" checked={form.unitRequirementsMode === 'SHARED'} onChange={selectSharedRequirements} />
              <span><strong>Same requirements for all lifts</strong><small>Enter one shared technical profile and shared shaft measurements.</small></span>
            </label>
            <label>
              <input type="radio" name="unit-requirements-mode" checked={form.unitRequirementsMode === 'PER_UNIT'} onChange={() => changeUnitRequirementsMode('PER_UNIT')} />
              <span><strong>Different requirements by lift</strong><small>Set each lift’s technical profile and shaft measurements separately.</small></span>
            </label>
          </fieldset>
          <label>Industry / site segment<SortedSelect value={form.industrySegment} onChange={(event) => update('industrySegment', event.target.value)}><option value="">Select from catalogue</option>{optionsFor(catalogue, 'INDUSTRY_SEGMENT').map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</SortedSelect></label>
          {form.unitRequirementsMode === 'SHARED' ? <>
            <div className="site-survey-shared-profile-heading"><div><h5>{sharedUnitRequirementTitle(form.units)}</h5><p>One technical profile and one set of shaft measurements apply to these lifts.</p></div><Button type="button" variant="secondary" onClick={() => update('step', 0)}>Edit unit details</Button></div>
            <div className="site-survey-measurement-grid">
              <label>Shaft width (mm)<input type="number" min="1" value={form.shaftWidth} onChange={(event) => update('shaftWidth', event.target.value)} /></label>
              <label>Shaft depth (mm)<input type="number" min="1" value={form.shaftDepth} onChange={(event) => update('shaftDepth', event.target.value)} /></label>
              <label>Pit depth (mm)<input type="number" min="0" value={form.pitDepth} onChange={(event) => update('pitDepth', event.target.value)} /></label>
              <label>Headroom (mm)<input type="number" min="0" value={form.headroom} onChange={(event) => update('headroom', event.target.value)} /></label>
            </div>
            <h5>Shared technical profile</h5>
            <RequirementProfileFields values={requirementProfileForForm(form)} catalogue={catalogue} namePrefix="shared" onChange={updateSharedRequirement} />
          </> : <>
            <ActionFeedback kind="info"><span>Each profile starts with the current shared selections. Edit the values that differ for each lift. Choosing “Same requirements for all lifts” will let you choose which lift’s requirements and measurements to apply to every lift.</span></ActionFeedback>
            <div className="site-survey-unit-requirement-list">
              {form.units.map((unit, index) => <details className="site-survey-unit-requirement-card" key={`unit-requirements-${index}`}>
                <summary><span><strong>{unit.label || `Unit ${index + 1}`}</strong><small>{readableValue(unit.type, 'type')} · {unit.stops || 'Stops not set'} · {unit.capacity ? `${unit.capacity} kg` : 'Capacity not set'}</small></span><span>Edit requirements</span></summary>
                <div className="site-survey-unit-requirement-content">
                  <h5>Unit {index + 1} shaft measurements</h5>
                  <div className="site-survey-measurement-grid">
                    <label>Shaft width (mm)<input type="number" min="1" value={unit.measurements?.shaftWidth ?? form.shaftWidth} onChange={(event) => updateUnitMeasurement(index, 'shaftWidth', event.target.value)} /></label>
                    <label>Shaft depth (mm)<input type="number" min="1" value={unit.measurements?.shaftDepth ?? form.shaftDepth} onChange={(event) => updateUnitMeasurement(index, 'shaftDepth', event.target.value)} /></label>
                    <label>Pit depth (mm)<input type="number" min="0" value={unit.measurements?.pitDepth ?? form.pitDepth} onChange={(event) => updateUnitMeasurement(index, 'pitDepth', event.target.value)} /></label>
                    <label>Headroom (mm)<input type="number" min="0" value={unit.measurements?.headroom ?? form.headroom} onChange={(event) => updateUnitMeasurement(index, 'headroom', event.target.value)} /></label>
                  </div>
                  <h5>Unit {index + 1} technical requirements</h5>
                  <RequirementProfileFields values={unit.requirements || requirementProfileForForm(form)} catalogue={catalogue} namePrefix={`unit_${index + 1}`} onChange={(key, value) => updateUnitRequirement(index, key, value)} />
                </div>
              </details>)}
            </div>
          </>}
        </section>}
        {form.step === 2 && <section><h4>Review and authorize</h4><dl className="site-survey-summary"><dt>Lead</dt><dd>{leadTitle}</dd><dt>Survey date</dt><dd>{form.surveyDate || 'Not set'}</dd><dt>Site or project name</dt><dd>{form.siteName || 'Not recorded'}</dd><dt>Site address</dt><dd>{formatIndiaPostalAddress(form.postalAddress) || 'Not recorded'}</dd><dt>GPS</dt><dd>{form.latitude && form.longitude ? `${form.latitude}, ${form.longitude} · ${surveyGpsSource(form.gpsSource)}` : 'Not recorded'}</dd><dt>Contacts</dt><dd>{form.contacts.filter((item) => item.name || item.role || item.phone).length}</dd><dt>Referral</dt><dd>{form.referralName || 'Not recorded'}</dd><dt>Proposed units</dt><dd>{form.units.length}</dd><dt>Measurements</dt><dd>{form.shaftWidth || '—'} × {form.shaftDepth || '—'} mm</dd><dt>Evidence</dt><dd>Manage files in the shared Lead documents and photos section.</dd></dl><p>Submission freezes this survey revision. Further assessment should use a new survey record.</p></section>}
      </div>
      <footer><div>{form.step > 0 && <Button type="button" variant="secondary" disabled={busy} onClick={() => update('step', form.step - 1)}>Previous</Button>}<span>Step {form.step + 1} of {steps.length}</span></div><div>{form.step === 1 && <Button type="button" variant="secondary" busy={busy} disabled={busy} onClick={() => void saveRequirements()}>Save requirements</Button>}<Button type="button" variant="secondary" busy={busy} disabled={busy} onClick={() => void save('DRAFT')}>Save draft</Button>{form.step < 2 ? <Button type="submit" busy={busy} disabled={busy}>Save draft &amp; next</Button> : <Button type="submit" busy={busy} disabled={busy}>Submit survey</Button>}</div></footer>
    </form>}
    {showSharedMergeConfirmation && <OperationsDialog title="Apply one profile to every lift?" onClose={() => setShowSharedMergeConfirmation(false)} className="site-survey-merge-confirmation">
      <p>The selected lift’s technical requirements and shaft measurements will replace the different values for the other lifts. Each lift will keep its own equipment type, stops, and capacity.</p>
      <label className="site-survey-merge-source">Use this lift’s profile for all lifts
        <select value={sharedMergeSourceIndex} onChange={(event) => setSharedMergeSourceIndex(Number(event.target.value))}>
          {form.units.map((unit, index) => <option key={`merge-source-${index}`} value={index}>{unit.label || `Unit ${index + 1}`}</option>)}
        </select>
      </label>
      <div className="site-survey-merge-confirmation-actions"><Button type="button" variant="secondary" onClick={() => setShowSharedMergeConfirmation(false)}>Keep separate profiles</Button><Button type="button" onClick={() => { changeUnitRequirementsMode('SHARED', sharedMergeSourceIndex); setShowSharedMergeConfirmation(false); }}>Apply {form.units[sharedMergeSourceIndex]?.label || `Unit ${sharedMergeSourceIndex + 1}`} to all lifts</Button></div>
    </OperationsDialog>}
  </div>;
}
