import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@trise/ui';
import { operationsData, type Resource, type SiteSurveyAttributes } from './data';
import './site-survey-wizard.css';

const steps = ['Details', 'Validate', 'Authorize / Save'];
type Contact = { name: string; role: string; phone: string };
type Unit = { label: string; stops: string; capacity: string; type: string };
type SurveyForm = { surveyDate: string; siteAddress: string; latitude: string; longitude: string; accuracy: string; gpsSource: string; buildingType: string; contacts: Contact[]; referralName: string; referralContact: string; units: Unit[]; shaftWidth: string; shaftDepth: string; pitDepth: string; accessNotes: string; capacity: string; requirementsStops: string; liftType: string; step: number };
const initialForm: SurveyForm = { surveyDate: '', siteAddress: '', latitude: '', longitude: '', accuracy: '', gpsSource: 'MANUAL', buildingType: '', contacts: [{ name: '', role: '', phone: '' }], referralName: '', referralContact: '', units: [{ label: 'Unit 1', stops: '', capacity: '', type: 'PASSENGER' }], shaftWidth: '', shaftDepth: '', pitDepth: '', accessNotes: '', capacity: '', requirementsStops: '', liftType: '', step: 0 };
const objectValue = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const textValue = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const positiveNumber = (value: string) => value.trim() ? Number(value) : undefined;

function fromSurvey(record: Resource<SiteSurveyAttributes>): SurveyForm {
  const context = objectValue(record.attributes.survey_context);
  const gps = objectValue(context.gps);
  const contacts = Array.isArray(context.contacts) ? context.contacts.map((entry) => { const item = objectValue(entry); return { name: textValue(item.name), role: textValue(item.role), phone: textValue(item.phone) }; }) : initialForm.contacts;
  const units = record.attributes.unit_details.length ? record.attributes.unit_details.map((entry, index) => ({ label: textValue(entry.label) || `Unit ${index + 1}`, stops: textValue(entry.stops), capacity: textValue(entry.capacity_kg), type: textValue(entry.type) || 'PASSENGER' })) : initialForm.units;
  const building = objectValue(record.attributes.building_details);
  const measures = objectValue(record.attributes.technical_measurements);
  const access = objectValue(record.attributes.access_conditions);
  const requirements = objectValue(record.attributes.requirements);
  const referral = objectValue(context.referral);
  const previousStep = Number(context.step) || 0;
  const step = previousStep >= 7 ? 2 : previousStep >= 5 ? 1 : 0;
  return { ...initialForm, surveyDate: record.attributes.survey_date || '', siteAddress: textValue(context.site_address), latitude: textValue(gps.latitude), longitude: textValue(gps.longitude), accuracy: textValue(gps.accuracy_m), gpsSource: textValue(gps.source) || 'MANUAL', buildingType: textValue(building.building_type), contacts: contacts.length ? contacts : initialForm.contacts, referralName: textValue(referral.name), referralContact: textValue(referral.contact), units, shaftWidth: textValue(measures.shaft_width_mm), shaftDepth: textValue(measures.shaft_depth_mm), pitDepth: textValue(measures.pit_depth_mm), accessNotes: textValue(access.notes), capacity: textValue(requirements.capacity_kg), requirementsStops: textValue(requirements.stops), liftType: textValue(requirements.lift_type), step };
}

export function SiteSurveyWizard({ providerId, leadId, leadTitle, onSubmitted, onMessage }: { providerId: string; leadId: string; leadTitle: string; onSubmitted: (id: string) => void; onMessage: (value: string) => void }) {
  const [surveys, setSurveys] = useState<Resource<SiteSurveyAttributes>[]>([]);
  const [record, setRecord] = useState<Resource<SiteSurveyAttributes> | null>(null);
  const [form, setForm] = useState<SurveyForm>(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [gpsMessage, setGpsMessage] = useState('');
  const [active, setActive] = useState(false);
  const activeSurveys = useMemo(() => surveys.filter((survey) => survey.attributes.status === 'DRAFT'), [surveys]);

  useEffect(() => {
    let current = true;
    setRecord(null); setSurveys([]); setActive(false); setForm(initialForm); setError('');
    void operationsData.siteSurveys(providerId, leadId).then((result) => { if (current) { setSurveys(result.data); const submitted = result.data.find((survey) => survey.attributes.status !== 'DRAFT'); if (submitted) onSubmitted(submitted.id); } }).catch((cause) => { if (current) setError((cause as Error).message || 'Survey drafts could not be loaded.'); });
    return () => { current = false; };
  }, [providerId, leadId]);

  function update<K extends keyof SurveyForm>(key: K, value: SurveyForm[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function begin() { setRecord(null); setForm(initialForm); setActive(true); setNotice(''); setError(''); }
  function resume(draft: Resource<SiteSurveyAttributes>) { setRecord(draft); setForm(fromSurvey(draft)); setActive(true); setNotice('Draft loaded. Continue where you left off.'); setError(''); }

  async function save(status: 'DRAFT' | 'SUBMITTED') {
    setBusy(true); setError(''); setNotice('');
    const payload = {
      status,
      survey_date: form.surveyDate || undefined,
      building_details: { building_type: form.buildingType || undefined },
      proposed_elevator_count: form.units.length || undefined,
      floor_count: positiveNumber(form.requirementsStops),
      technical_measurements: { shaft_width_mm: positiveNumber(form.shaftWidth), shaft_depth_mm: positiveNumber(form.shaftDepth), pit_depth_mm: positiveNumber(form.pitDepth) },
      access_conditions: { notes: form.accessNotes || undefined },
      requirements: { capacity_kg: positiveNumber(form.capacity), stops: positiveNumber(form.requirementsStops), lift_type: form.liftType || undefined },
      survey_context: { step: form.step, site_address: form.siteAddress, gps: { latitude: form.latitude || undefined, longitude: form.longitude || undefined, accuracy_m: positiveNumber(form.accuracy), source: form.gpsSource, captured_at: form.latitude && form.longitude ? new Date().toISOString() : undefined }, contacts: form.contacts.filter((contact) => contact.name || contact.role || contact.phone), referral: { name: form.referralName || undefined, contact: form.referralContact || undefined } },
      unit_details: form.units.map((unit) => ({ label: unit.label, stops: positiveNumber(unit.stops), capacity_kg: positiveNumber(unit.capacity), type: unit.type })),
    };
    try {
      let saved: Resource<SiteSurveyAttributes>;
      if (record) saved = await operationsData.updateSiteSurveyDraft(providerId, leadId, record.id, { ...payload, expected_revision: record.attributes.revision }, crypto.randomUUID());
      else saved = await operationsData.createSiteSurvey(providerId, leadId, payload, crypto.randomUUID());
      setRecord(saved); setSurveys((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      if (status === 'SUBMITTED') { setActive(false); onSubmitted(saved.id); onMessage('Site survey submitted. The captured revision is now read-only.'); }
      else setNotice('Draft saved securely. You can resume it from this lead later.');
    } catch (cause) { setError((cause as Error).message || 'Survey could not be saved.'); }
    finally { setBusy(false); }
  }

  function captureGps() {
    setGpsMessage('');
    if (!navigator.geolocation) { setGpsMessage('Location access is unavailable in this browser. Enter coordinates manually.'); return; }
    navigator.geolocation.getCurrentPosition((position) => { update('latitude', String(position.coords.latitude)); update('longitude', String(position.coords.longitude)); update('accuracy', String(Math.round(position.coords.accuracy))); update('gpsSource', 'GPS'); setGpsMessage('Coordinates captured from this device.'); }, () => setGpsMessage('Location permission was not granted. Enter coordinates manually to continue.'), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (form.step < 2) { update('step', form.step + 1); return; } if (!form.surveyDate || !form.units.length) { setError('Add a survey date and at least one proposed unit before submitting.'); return; } void save('SUBMITTED'); }

  return <div className="site-survey-workspace">
    {!active && <div className="site-survey-draft-toolbar"><div><strong>Site surveys</strong><span>{surveys.length} saved · {activeSurveys.length} draft{activeSurveys.length === 1 ? '' : 's'}</span></div><Button type="button" onClick={begin}>Start survey</Button></div>}
    {!active && activeSurveys.map((draft) => <div className="site-survey-draft-row" key={draft.id}><div><strong>Draft · {draft.attributes.survey_date || 'Date not set'}</strong><span>Revision {draft.attributes.revision} · saved {draft.attributes.created_at ? new Date(draft.attributes.created_at).toLocaleString() : 'recently'}</span></div><Button type="button" variant="secondary" onClick={() => resume(draft)}>Resume draft</Button></div>)}
    {!active && surveys.filter((survey) => survey.attributes.status !== 'DRAFT').map((survey) => <div className="site-survey-draft-row" key={survey.id}><div><strong>{survey.attributes.status} · {survey.attributes.survey_date || 'Date not set'}</strong><span>Revision {survey.attributes.revision} · {survey.attributes.proposed_elevator_count || 0} proposed units</span></div><span className="site-survey-readonly">Read only</span></div>)}
    {active && <form className="site-survey-wizard" onSubmit={submit}>
      <header><div><span className="eyebrow">Marketing · Site survey</span><h3>{record ? 'Resume survey draft' : 'New site survey'}</h3><p>{leadTitle}</p></div><Button type="button" variant="secondary" disabled={busy} onClick={() => setActive(false)}>Close</Button></header>
      <nav className="site-survey-stepper" aria-label="Survey steps">{steps.map((label, index) => <button key={label} type="button" aria-current={form.step === index ? 'step' : undefined} className={form.step === index ? 'current' : index < form.step ? 'complete' : ''} onClick={() => update('step', index)}><span>{index + 1}</span>{label}</button>)}</nav>
      <div className="site-survey-step-content">
        {form.step === 0 && <>
          <section><h4>Survey setup</h4><p>The survey remains attached to its authorized marketing lead. A survey does not create a Customer or quotation recipient.</p><label>Lead<input readOnly value={leadTitle} /></label><label>Site visit date<input type="date" value={form.surveyDate} onChange={(event) => update('surveyDate', event.target.value)} /></label><label>Building type<input value={form.buildingType} onChange={(event) => update('buildingType', event.target.value)} /></label><label>Site address<textarea rows={3} value={form.siteAddress} onChange={(event) => update('siteAddress', event.target.value)} /></label><div className="site-survey-gps-grid"><label>Latitude<input inputMode="decimal" value={form.latitude} onChange={(event) => { update('latitude', event.target.value); update('gpsSource', 'MANUAL'); }} /></label><label>Longitude<input inputMode="decimal" value={form.longitude} onChange={(event) => { update('longitude', event.target.value); update('gpsSource', 'MANUAL'); }} /></label><label>Accuracy (m)<input type="number" min="0" value={form.accuracy} onChange={(event) => update('accuracy', event.target.value)} /></label></div><Button type="button" variant="secondary" onClick={captureGps}>Capture device location</Button><p role="status">{gpsMessage || `Location source: ${form.gpsSource}. Manual entry remains available if permission is denied.`}</p></section>
          <section><h4>Site contacts</h4><p>Capture contacts relevant to this site survey only. A contact is not automatically authorized to accept quotations.</p>{form.contacts.map((contact, index) => <div className="site-survey-contact" key={index}><label>Name<input value={contact.name} onChange={(event) => update('contacts', form.contacts.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /></label><label>Site role<input value={contact.role} onChange={(event) => update('contacts', form.contacts.map((item, i) => i === index ? { ...item, role: event.target.value } : item))} /></label><label>Contact reference<input value={contact.phone} onChange={(event) => update('contacts', form.contacts.map((item, i) => i === index ? { ...item, phone: event.target.value } : item))} /></label><Button type="button" variant="secondary" disabled={form.contacts.length === 1} onClick={() => update('contacts', form.contacts.filter((_, i) => i !== index))}>Remove</Button></div>)}<Button type="button" variant="secondary" onClick={() => update('contacts', [...form.contacts, { name: '', role: '', phone: '' }])}>Add site contact</Button></section>
          <section><h4>Referral and proposed units</h4><p>Referral details are attribution only; they do not create a Customer or receive quotations automatically.</p><label>Referrer name<input value={form.referralName} onChange={(event) => update('referralName', event.target.value)} /></label><label>Referrer contact reference<input value={form.referralContact} onChange={(event) => update('referralContact', event.target.value)} /></label>{form.units.map((unit, index) => <div className="site-survey-unit" key={index}><label>Unit label<input value={unit.label} onChange={(event) => update('units', form.units.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} /></label><label>Lift type<select value={unit.type} onChange={(event) => update('units', form.units.map((item, i) => i === index ? { ...item, type: event.target.value } : item))}><option>PASSENGER</option><option>GOODS</option><option>HOSPITAL</option><option>HOME</option><option>OTHER</option></select></label><label>Stops<input type="number" min="1" value={unit.stops} onChange={(event) => update('units', form.units.map((item, i) => i === index ? { ...item, stops: event.target.value } : item))} /></label><label>Capacity (kg)<input type="number" min="1" value={unit.capacity} onChange={(event) => update('units', form.units.map((item, i) => i === index ? { ...item, capacity: event.target.value } : item))} /></label><Button type="button" variant="secondary" disabled={form.units.length === 1} onClick={() => update('units', form.units.filter((_, i) => i !== index))}>Remove unit</Button></div>)}<Button type="button" variant="secondary" disabled={form.units.length >= 50} onClick={() => update('units', [...form.units, { label: `Unit ${form.units.length + 1}`, stops: '', capacity: '', type: 'PASSENGER' }])}>Add another unit</Button></section>
        </>}
        {form.step === 1 && <><section><h4>Site measurements and requirements</h4><div className="site-survey-gps-grid"><label>Shaft width (mm)<input type="number" min="0" value={form.shaftWidth} onChange={(event) => update('shaftWidth', event.target.value)} /></label><label>Shaft depth (mm)<input type="number" min="0" value={form.shaftDepth} onChange={(event) => update('shaftDepth', event.target.value)} /></label><label>Pit depth (mm)<input type="number" min="0" value={form.pitDepth} onChange={(event) => update('pitDepth', event.target.value)} /></label><label>Initial capacity (kg)<input type="number" min="1" value={form.capacity} onChange={(event) => update('capacity', event.target.value)} /></label><label>Initial stops<input type="number" min="1" value={form.requirementsStops} onChange={(event) => update('requirementsStops', event.target.value)} /></label><label>Lift specification<input value={form.liftType} onChange={(event) => update('liftType', event.target.value)} /></label></div><label>Access conditions / notes<textarea rows={3} value={form.accessNotes} onChange={(event) => update('accessNotes', event.target.value)} /></label></section><section><h4>Survey photos and documents</h4><div className="site-survey-upload-blocked" role="status"><strong>Evidence upload is unavailable</strong><p>The current platform document policy has no configured malware scanner. To protect the Provider and customer, files cannot be accepted as survey evidence until an approved scanner is available. Your survey draft can still be saved and resumed.</p></div></section></>}
        {form.step === 2 && <section><h4>Review and authorize</h4><dl className="site-survey-summary"><dt>Lead</dt><dd>{leadTitle}</dd><dt>Survey date</dt><dd>{form.surveyDate || 'Not set'}</dd><dt>Address</dt><dd>{form.siteAddress || 'Not recorded'}</dd><dt>GPS</dt><dd>{form.latitude && form.longitude ? `${form.latitude}, ${form.longitude} · ${form.gpsSource}` : 'Not recorded'}</dd><dt>Contacts</dt><dd>{form.contacts.filter((item) => item.name || item.role || item.phone).length}</dd><dt>Referral</dt><dd>{form.referralName || 'Not recorded'}</dd><dt>Proposed units</dt><dd>{form.units.length}</dd><dt>Measurements</dt><dd>{form.shaftWidth || '—'} × {form.shaftDepth || '—'} mm</dd><dt>Evidence</dt><dd>Unavailable until an approved scanner is configured</dd></dl><p>Submission freezes this survey revision. Further assessment should use a new survey record.</p></section>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}{notice && <p className="success" role="status">{notice}</p>}
      <footer><div>{form.step > 0 && <Button type="button" variant="secondary" disabled={busy} onClick={() => update('step', form.step - 1)}>Previous</Button>}<span>Step {form.step + 1} of {steps.length}</span></div><div><Button type="button" variant="secondary" busy={busy} disabled={busy} onClick={() => void save('DRAFT')}>Save draft</Button>{form.step < 2 ? <Button type="submit" disabled={busy}>Continue</Button> : <Button type="submit" busy={busy} disabled={busy || !form.surveyDate || !form.units.length}>Submit survey</Button>}</div></footer>
    </form>}
  </div>;
}
