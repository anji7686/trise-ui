import { useEffect, useState, type FormEvent } from 'react';
import { Button, PageHeader, SortedSelect } from '@trise/ui';
import { operationsData, type Collection, type GenericAttributes, type Resource } from './data';
import { OperationsStatus as Status } from './operations-status';
import { ActionFeedback, EmptyState, WorkspaceTabs } from './operations-shared';
import { OperationsDialog } from './operations-dialog';
import { formatIndiaDateTime, indiaDateTimeToIso, localDateTime } from './subscription-support';
import { SvgIcon } from './icons';
import './amc-plans.css';
import './amc-lifecycle.css';

type PlanResource = Resource<GenericAttributes>;
type PlanForm = {
  code: string;
  name: string;
  audience: 'RESIDENTIAL' | 'COMMERCIAL';
  price: string;
  frequency: string;
  visits: string;
  callbacks: string;
  priority: string;
  extraFloorPrice: string;
  rateCards: string;
  included: string;
  excluded: string;
  effectiveFrom: string;
};

const referencePlans: PlanResource[] = [
  { id: 'reference-essential', type: 'provider-service-plans', relationships: {}, attributes: { code: 'ESSENTIAL_AMC', name: 'Essential AMC', audience: 'RESIDENTIAL / COMMERCIAL', status: 'REFERENCE', current_version: { version: 1, status: 'REFERENCE', base_price: '12000', plan: { pricing: { base_price: '12000', additional_floor_price: '850' }, entitlements: { preventive_frequency: 'QUARTERLY', scheduled_visits: 4, breakdown_callbacks: 12, service_priority: 'STANDARD', service_report: true, recommendations: false }, eligibility: { base_floors: 4, passenger_capacities: [6, 8, 10, 13] }, included: ['Preventive maintenance every 3 months', 'Basic service report'], excluded: ['Spare parts and major component replacement'] } } } },
  { id: 'reference-standard', type: 'provider-service-plans', relationships: {}, attributes: { code: 'STANDARD_AMC', name: 'Standard AMC', audience: 'RESIDENTIAL / COMMERCIAL', status: 'REFERENCE', current_version: { version: 1, status: 'REFERENCE', base_price: '18000', plan: { pricing: { base_price: '18000', additional_floor_price: '850' }, entitlements: { preventive_frequency: 'BI_MONTHLY', scheduled_visits: 6, breakdown_callbacks: 24, service_priority: 'FAST', service_report: true, recommendations: true }, eligibility: { base_floors: 4, passenger_capacities: [6, 8, 10, 13] }, included: ['Preventive maintenance every 2 months', 'Service report after visits', 'Maintenance observations and recommendations'], excluded: ['Spare parts and major component replacement'] } } } },
  { id: 'reference-premium', type: 'provider-service-plans', relationships: {}, attributes: { code: 'PREMIUM_AMC', name: 'Premium AMC', audience: 'RESIDENTIAL / COMMERCIAL', status: 'REFERENCE', current_version: { version: 1, status: 'REFERENCE', base_price: '24000', plan: { pricing: { base_price: '24000', additional_floor_price: '850' }, entitlements: { preventive_frequency: 'MONTHLY', scheduled_visits: 12, breakdown_callbacks: 'UNLIMITED', service_priority: 'PRIORITY', service_report: true, recommendations: true }, eligibility: { base_floors: 4, passenger_capacities: [6, 8, 10, 13] }, included: ['Preventive maintenance every month', 'Unlimited breakdown / callback support', 'Detailed inspection and recommendations'], excluded: ['Spare parts and major component replacement'] } } } },
];

const defaultEffectiveFrom = () => localDateTime(new Date(Date.now() + 5 * 60 * 1000));
const effectiveInputValue = (value: unknown) => { if (!value) return ''; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? '' : localDateTime(date); };
const effectiveLabel = (value: unknown) => value ? formatIndiaDateTime(String(value)) : 'Not scheduled';
const effectiveIso = (value: string) => value ? indiaDateTimeToIso(value) : undefined;
const starterRateCards = JSON.stringify([
  { match: { audience: 'COMMERCIAL', passenger_capacity: 6, lift_type: 'PASSENGER_TRACTION' }, base: { included_floors_above_ground: 4, amount: 22500 }, floor_rates: [{ from: 5, amount_per_floor: 850 }] },
], null, 2);
const starterForm: PlanForm = { code: 'STANDARD_AMC', name: 'Standard AMC', audience: 'COMMERCIAL', price: '22500', frequency: 'BI_MONTHLY', visits: '6', callbacks: '24', priority: 'FAST', extraFloorPrice: '850', rateCards: starterRateCards, included: 'Scheduled preventive maintenance visits\nLubrication, cleaning and routine adjustments\nInspection of doors, locks and safety interlocks\nInspection of brakes, ropes and suspension\nBreakdown attendance and troubleshooting\nService visit report\nTraction machine, brake and ropes inspection\nLanding and car door operation checks', excluded: 'Spare parts not included in this plan\nMajor motor, drive or controller replacement\nCivil, structural or building electrical work\nDamage caused by misuse, vandalism or external events', effectiveFrom: defaultEffectiveFrom() };
const fail = (error: unknown) => (error as { message?: string })?.message || 'The request could not be completed.';
const asObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const currentVersion = (item: PlanResource) => asObject(item.attributes.current_version);
const planData = (item: PlanResource) => asObject(currentVersion(item).plan);
const formatPrice = (value: unknown) => { const amount = Number(value); return Number.isFinite(amount) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount) : '—'; };
const titleCase = (value: unknown) => String(value || '—').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const splitLines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean);
const generalIncludedItems = ['Scheduled preventive maintenance visits', 'Lubrication, cleaning and routine adjustments', 'Inspection of doors, locks and safety interlocks', 'Inspection of brakes, ropes and suspension', 'Breakdown attendance and troubleshooting', 'Service visit report'];
const includedItemsByLift: Record<string, string[]> = {
  PASSENGER_TRACTION: ['Traction machine, brake and ropes inspection', 'Landing and car door operation checks'],
  PASSENGER_MRL: ['Shaft-mounted machinery inspection', 'Landing and car door operation checks'],
  HOME_VILLA_LIFT: ['Compact drive and controller inspection', 'Landing and car door operation checks'],
  HYDRAULIC_PASSENGER: ['Hydraulic oil level and leakage checks', 'Pump, valve and cylinder inspection'],
  SERVICE_LIFT: ['Service lift door and interlock inspection'],
  HOSPITAL_BED_LIFT: ['Bed/stretcher car and door operation checks', 'Emergency communication check'],
  STRETCHER_LIFT: ['Stretcher car and door operation checks', 'Emergency communication check'],
  GOODS_PASSENGER_LIFT: ['Load-rated car, doors and safety equipment inspection'],
  INDUSTRIAL_FREIGHT_LIFT: ['Heavy-duty drive, doors and safety equipment inspection'],
  CAR_LIFT: ['Vehicle platform, barriers and safety interlock inspection'],
  DUMBWAITER: ['Small-car doors and goods restraint inspection'],
  PLATFORM_LIFT: ['Platform, access gates and safety interlock inspection'],
  STAIR_CHAIR_LIFT: ['Rail, chair and safety-belt inspection'],
  FIRE_EMERGENCY_LIFT: ['Emergency operation and fire-service controls check'],
  EVACUATION_LIFT: ['Emergency operation and evacuation controls check'],
};
const commonExclusions = ['Spare parts not included in this plan', 'Major motor, drive or controller replacement', 'Civil, structural or building electrical work', 'Damage caused by misuse, vandalism or external events'];
function ServiceItemChecklist({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const selected = splitLines(value);
  const [other, setOther] = useState('');
  function toggle(item: string, checked: boolean) { onChange([...new Set(checked ? [...selected, item] : selected.filter((entry) => entry !== item))].join('\n')); }
  return <fieldset className="amc-service-checklist"><legend>{label}</legend><div>{options.map((item) => <label key={item}><input type="checkbox" checked={selected.includes(item)} onChange={(event) => toggle(item, event.target.checked)} /><span>{item}</span></label>)}</div>{selected.filter((item) => !options.includes(item)).map((item) => <label className="amc-service-custom-item" key={item}><input type="checkbox" checked onChange={() => toggle(item, false)} /><span>{item} <small>Custom</small></span></label>)}<div className="amc-service-add-other"><input aria-label={`Add other ${label.toLowerCase()} item`} value={other} onChange={(event) => setOther(event.target.value)} placeholder="Add another item" /><Button type="button" variant="secondary" disabled={!other.trim()} onClick={() => { toggle(other.trim(), true); setOther(''); }}>Add item</Button></div></fieldset>;
}
const textItems = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const go = (path: string) => { window.location.hash = path; };

type RateCardBandDraft = { id: string; from: string; to: string; amount: string };
type RateCardDraft = {
  id: string;
  code: string;
  audience: 'RESIDENTIAL' | 'COMMERCIAL';
  passengerCapacity: string;
  liftType: string;
  usageClass: string;
  numberOfStops: string;
  travelHeightM: string;
  includedFloors: string;
  baseAmount: string;
  floorRates: RateCardBandDraft[];
};

const newRateCard = (index: number): RateCardDraft => ({
  id: `rate-card-${index}-${Date.now()}`,
  code: '',
  audience: 'COMMERCIAL',
  passengerCapacity: '6',
  liftType: 'PASSENGER_TRACTION',
  usageClass: '',
  numberOfStops: '',
  travelHeightM: '',
  includedFloors: '4',
  baseAmount: '0',
  floorRates: [{ id: `floor-band-${index}-${Date.now()}`, from: '5', to: '', amount: '0' }],
});

function rateCardsFromJson(value: string): RateCardDraft[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return [newRateCard(0)];
    return parsed.map((item, index) => {
      const card = asObject(item);
      const match = asObject(card.match);
      const base = asObject(card.base);
      const floorRates = Array.isArray(card.floor_rates) ? card.floor_rates : [];
      return {
        id: `rate-card-${index}`,
        code: String(card.code || ''),
        audience: (String(match.audience || 'COMMERCIAL') === 'RESIDENTIAL' ? 'RESIDENTIAL' : 'COMMERCIAL'),
        passengerCapacity: String(match.passenger_capacity || '6'),
        liftType: String(match.lift_type || ''),
        usageClass: String(match.usage_class || ''),
        numberOfStops: String(match.number_of_stops || ''),
        travelHeightM: String(match.travel_height_m || ''),
        includedFloors: String(base.included_floors_above_ground || '4'),
        baseAmount: String(base.amount || '0'),
        floorRates: floorRates.map((band, bandIndex) => {
          const input = asObject(band);
          return { id: `floor-band-${index}-${bandIndex}`, from: String(input.from || ''), to: String(input.to || ''), amount: String(input.amount_per_floor || '0') };
        }),
      };
    });
  } catch {
    return [newRateCard(0)];
  }
}

function rateCardsToJson(cards: RateCardDraft[]) {
  return JSON.stringify(cards.map((card) => {
    const match: Record<string, unknown> = {
      audience: card.audience,
      passenger_capacity: Number(card.passengerCapacity),
    };
    if (card.liftType.trim()) match.lift_type = card.liftType.trim().toUpperCase();
    if (card.usageClass.trim()) match.usage_class = card.usageClass.trim().toUpperCase();
    if (card.numberOfStops.trim()) match.number_of_stops = Number(card.numberOfStops);
    if (card.travelHeightM.trim()) match.travel_height_m = Number(card.travelHeightM);
    return {
      ...(card.code.trim() ? { code: card.code.trim().toUpperCase() } : {}),
      match,
      base: { included_floors_above_ground: Number(card.includedFloors), amount: Number(card.baseAmount) },
      floor_rates: card.floorRates.filter((band) => band.from.trim() && band.amount.trim()).map((band) => ({
        from: Number(band.from),
        ...(band.to.trim() ? { to: Number(band.to) } : {}),
        amount_per_floor: Number(band.amount),
      })),
    };
  }), null, 2);
}

function RateCardMatrixEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [cards, setCards] = useState<RateCardDraft[]>(() => rateCardsFromJson(value));

  function commit(next: RateCardDraft[]) {
    setCards(next);
    onChange(rateCardsToJson(next));
  }

  function updateCard(index: number, changes: Partial<RateCardDraft>) {
    commit(cards.map((card, cardIndex) => cardIndex === index ? { ...card, ...changes } : card));
  }

  function updateBand(cardIndex: number, bandIndex: number, changes: Partial<RateCardBandDraft>) {
    updateCard(cardIndex, { floorRates: cards[cardIndex].floorRates.map((band, index) => index === bandIndex ? { ...band, ...changes } : band) });
  }

  return <section className="amc-rate-card-editor" aria-label="AMC rate-card builder">
    <div className="amc-rate-card-editor-heading"><div><span className="amc-rate-card-eyebrow">Guided pricing rules</span><strong>Who gets which AMC price?</strong><p>Start with one rule. Add another only when a lift needs different pricing. The first matching rule is used by the server.</p></div><Button type="button" variant="secondary" onClick={() => commit([...cards, newRateCard(cards.length)])}>+ Add pricing rule</Button></div>
    <div className="amc-rate-card-help"><span aria-hidden="true">ⓘ</span><p><strong>Example:</strong> Residential 6-passenger lifts can use one base price, while commercial 13-passenger lifts can use another. Add floor bands when the price changes after G+4.</p></div>
    <div className="amc-rate-card-list">
      {cards.map((card, cardIndex) => <article className="amc-rate-card" key={card.id}>
        <div className="amc-rate-card-header"><div><span>Pricing rule {cardIndex + 1}</span><strong>{titleCase(card.audience)} · {card.passengerCapacity || '—'} passengers</strong></div>{cards.length > 1 && <Button type="button" variant="danger" onClick={() => commit(cards.filter((_, index) => index !== cardIndex))}>Remove rule</Button>}</div>
        <div className="amc-rate-card-grid">
          <label>Audience *<SortedSelect required value={card.audience} onChange={(event) => updateCard(cardIndex, { audience: event.target.value as RateCardDraft['audience'] })}><option value="RESIDENTIAL">Residential community</option><option value="COMMERCIAL">Commercial building</option></SortedSelect></label>
          <label>Passenger capacity *<input required min="1" type="number" value={card.passengerCapacity} onChange={(event) => updateCard(cardIndex, { passengerCapacity: event.target.value })} placeholder="6" /><small>Number of passengers</small></label>
          <label>Lift type<SortedSelect value={card.liftType} onChange={(event) => updateCard(cardIndex, { liftType: event.target.value })}><option value="">Any lift type</option><option value="PASSENGER_TRACTION">Passenger traction lift</option><option value="PASSENGER_MRL">Machine-room-less passenger lift</option><option value="HOME_VILLA_LIFT">Home and villa lift</option><option value="HYDRAULIC_PASSENGER">Hydraulic passenger lift</option><option value="SERVICE_LIFT">Service lift</option><option value="HOSPITAL_BED_LIFT">Hospital and bed lift</option><option value="STRETCHER_LIFT">Stretcher lift</option><option value="GOODS_PASSENGER_LIFT">Goods and passenger lift</option><option value="INDUSTRIAL_FREIGHT_LIFT">Industrial freight lift</option><option value="CAR_LIFT">Vehicle and car lift</option><option value="DUMBWAITER">Dumbwaiter</option><option value="PLATFORM_LIFT">Vertical platform lift</option><option value="STAIR_CHAIR_LIFT">Stairway chair lift</option><option value="FIRE_EMERGENCY_LIFT">Firefighter and emergency lift</option><option value="EVACUATION_LIFT">Occupant evacuation lift</option><option value="ESCALATOR">Escalator</option><option value="MOVING_WALK">Moving walk and travelator</option></SortedSelect><small>Uses the same equipment types as project requirements and handover.</small></label>
          <label>Number of stops<input min="1" type="number" value={card.numberOfStops} onChange={(event) => updateCard(cardIndex, { numberOfStops: event.target.value })} placeholder="Optional" /></label>
          <label>Travel height (m)<input min="0" step="0.01" type="number" value={card.travelHeightM} onChange={(event) => updateCard(cardIndex, { travelHeightM: event.target.value })} placeholder="Optional" /></label>
        </div>
        <div className="amc-rate-card-pricing"><div className="amc-rate-card-section-heading"><div><strong>Annual price</strong><small>Base amount for the included floor count</small></div></div><div className="amc-rate-card-price-grid"><label>Includes floors up to<input required min="1" type="number" value={card.includedFloors} onChange={(event) => updateCard(cardIndex, { includedFloors: event.target.value })} /><small>Example: 4 means G+4</small></label><label>Base price / year (INR)<input required min="0" type="number" value={card.baseAmount} onChange={(event) => updateCard(cardIndex, { baseAmount: event.target.value })} /></label></div></div>
        <div className="amc-rate-card-bands"><div className="amc-rate-card-section-heading"><div><strong>Additional floor bands</strong><small>Different per-floor prices can be applied to different ranges</small></div><Button type="button" variant="secondary" onClick={() => updateCard(cardIndex, { floorRates: [...card.floorRates, { id: `floor-band-${cardIndex}-${Date.now()}`, from: '', to: '', amount: '0' }] })}>+ Add floor band</Button></div>{card.floorRates.length ? <div className="amc-rate-band-list">{card.floorRates.map((band, bandIndex) => <div className="amc-rate-band-row" key={band.id}><label>From floor<input required min="1" type="number" value={band.from} onChange={(event) => updateBand(cardIndex, bandIndex, { from: event.target.value })} /></label><label>To floor<input min="1" type="number" value={band.to} onChange={(event) => updateBand(cardIndex, bandIndex, { to: event.target.value })} placeholder="No limit" /></label><label>Charge / floor / year (INR)<input required min="0" type="number" value={band.amount} onChange={(event) => updateBand(cardIndex, bandIndex, { amount: event.target.value })} /></label>{card.floorRates.length > 1 && <Button type="button" variant="quiet" onClick={() => updateCard(cardIndex, { floorRates: card.floorRates.filter((_, index) => index !== bandIndex) })}>Remove</Button>}</div>)}</div> : <p className="amc-rate-card-empty">No additional floor charge. This rule covers the included floor count only.</p>}</div>
        <div className="amc-rate-card-preview"><span>Rule preview</span><strong>{card.audience} · {card.passengerCapacity || '—'} passengers{card.liftType ? ` · ${card.liftType.toUpperCase()}` : ''}</strong><small>{formatPrice(card.baseAmount)} / year up to G+{card.includedFloors || '—'}{card.floorRates.length ? ` · ${card.floorRates.length} floor band${card.floorRates.length === 1 ? '' : 's'}` : ''}</small></div>
      </article>)}
    </div>
  </section>;
}

function formFromPlan(item: PlanResource): PlanForm {
  const data = planData(item);
  const pricing = asObject(data.pricing);
  const entitlements = asObject(data.entitlements);
  return {
    code: String(item.attributes.code || ''), name: String(item.attributes.name || ''),
    audience: String(item.attributes.audience || 'COMMERCIAL') === 'RESIDENTIAL' ? 'RESIDENTIAL' : 'COMMERCIAL',
    price: String(pricing.base_price || currentVersion(item).base_price || ''),
    frequency: String(entitlements.preventive_frequency || 'QUARTERLY'),
    visits: String(entitlements.scheduled_visits || '4'), callbacks: String(entitlements.breakdown_callbacks || '0'),
    priority: String(entitlements.service_priority || 'STANDARD'), extraFloorPrice: String(pricing.additional_floor_price || '850'),
    rateCards: JSON.stringify(pricing.rate_cards || [{ code: 'DEFAULT', match: { audience: String(item.attributes.audience || 'COMMERCIAL') }, base: { included_floors_above_ground: Number(asObject(data.eligibility).base_floors || 4), amount: Number(pricing.base_price || currentVersion(item).base_price || 0) }, floor_rates: [{ from: 5, to: 99, amount_per_floor: Number(pricing.additional_floor_price || 0) }] }], null, 2),
    included: Array.isArray(data.included) ? data.included.join('\n') : '', excluded: Array.isArray(data.excluded) ? data.excluded.join('\n') : '',
    effectiveFrom: effectiveInputValue(currentVersion(item).effective_from),
  };
}

function toPayload(form: PlanForm) {
  let rateCards: unknown[];
  try { rateCards = JSON.parse(form.rateCards); } catch { throw new Error('Rate-card matrix must be valid JSON.'); }
  if (!Array.isArray(rateCards) || rateCards.length === 0) throw new Error('Add at least one rate card to the pricing matrix.');
  return {
    term_months: 12,
    pricing: { model: 'RATE_CARD_MATRIX_V1', rate_cards: rateCards, base_price: Number(form.price), additional_floor_price: Number(form.extraFloorPrice), base_floor_label: 'G+4', tax_pricing_mode: 'EXCLUSIVE' },
    eligibility: { base_floors: 4, passenger_capacities: [6, 8, 10, 13] },
    entitlements: { preventive_frequency: form.frequency, scheduled_visits: Number(form.visits), breakdown_callbacks: form.callbacks.trim().toUpperCase() === 'UNLIMITED' ? 'UNLIMITED' : Number(form.callbacks), service_priority: form.priority, service_report: true, recommendations: form.priority !== 'STANDARD' },
    included: splitLines(form.included), excluded: splitLines(form.excluded), terms: ['12-month AMC term', 'GST applied as per prevailing regulations', 'Additional floor charge applies above G+4'],
  };
}

const amcLifecycleSteps = [
  { label: 'Plan catalogue', detail: 'Create · review · publish', phase: 'Phase 1', icon: 'grid' as const },
  { label: 'Quotation', detail: 'Select published plan', phase: 'Phase 2', icon: 'clipboard' as const },
  { label: 'Customer approval', detail: 'Accept commercial terms', phase: 'Phase 2', icon: 'users' as const },
  { label: 'AMC contract', detail: 'Snapshot price & coverage', phase: 'Phase 3', icon: 'shield' as const },
  { label: 'Service execution', detail: 'Visits · callbacks · reports', phase: 'Phase 4', icon: 'activity' as const },
  { label: 'Renewal', detail: 'Review · renew · amend', phase: 'Phase 4', icon: 'calendar' as const },
];

function AmcSubscriptionLifecycle({ selectedStatus, planStatus, onClose }: { selectedStatus: string; planStatus: string; onClose: () => void }) {
  return <OperationsDialog title="AMC subscription journey" onClose={onClose} className="amc-lifecycle-dialog">
    <section className="amc-lifecycle-modal-content" aria-label="AMC subscription workflow map">
    <div className="amc-lifecycle-heading"><div><span className="page-eyebrow">Workflow map</span><p>One published provider plan becomes a customer contract and then drives recurring elevator service.</p></div><span className="amc-lifecycle-current">Current: Phase 1</span></div>
    <div className="amc-lifecycle-track" role="list" aria-label="AMC subscription lifecycle">
      {amcLifecycleSteps.map((step, index) => <div className={`amc-lifecycle-step ${index === 0 ? 'is-current' : 'is-future'}`} role="listitem" key={step.label}><div className="amc-lifecycle-node"><SvgIcon name={step.icon} size={17} /></div><div className="amc-lifecycle-step-copy"><strong>{step.label}</strong><span>{step.detail}</span><small>{step.phase}</small></div>{index < amcLifecycleSteps.length - 1 && <i className="amc-lifecycle-connector" aria-hidden="true">→</i>}</div>)}
    </div>
    <div className="amc-lifecycle-handoff"><div><strong>Current plan control</strong><span>Version: {titleCase(selectedStatus)} · Availability: {titleCase(planStatus)}</span></div><div><strong>Next handoff</strong><span>{selectedStatus === 'PUBLISHED' && planStatus === 'ACTIVE' ? 'This plan is ready to be selected in a quotation.' : 'Publish an approved version before quotation selection.'}</span></div><span className="amc-lifecycle-note">Quotation and contract snapshot integration is planned for Phases 2–3.</span></div>
    </section>
  </OperationsDialog>;
}

export function ProviderAmcPlanCatalogue({ providerId, canManage, canEdit, canSubmit, canReview, canPublish, canActivate, canSuspend, isProviderAdmin }: { providerId: string; canManage: boolean; canEdit: boolean; canSubmit: boolean; canReview: boolean; canPublish: boolean; canActivate: boolean; canSuspend: boolean; isProviderAdmin: boolean }) {
  const [plans, setPlans] = useState<Collection<GenericAttributes> & { summary?: { total: number; published: number; drafts: number; pending_review: number } } | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [tab, setTab] = useState<'catalogue' | 'review'>('catalogue');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PlanResource | null>(null);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [form, setForm] = useState<PlanForm>(starterForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [formStep, setFormStep] = useState(0);

  async function reload(preferredId = selectedId) {
    setError('');
    const result = await operationsData.providerAmcPlans(providerId);
    setPlans(result);
    const next = result.data.find((item) => item.id === preferredId) || result.data[0];
    setSelectedId(next?.id || '');
  }
  useEffect(() => { void reload().catch((cause) => setError(fail(cause))); }, [providerId]);

  const realPlans = plans?.data || [];
  const visiblePlans = tab === 'review' ? realPlans.filter((item) => currentVersion(item).status === 'SUBMITTED') : realPlans;
  const selected = realPlans.find((item) => item.id === selectedId) || null;
  const cards = realPlans.length ? visiblePlans : referencePlans;
  const selectedCard = selected || (cards.find((item) => item.id === selectedId) || cards[0]) || null;
  const selectedStatus = selectedCard ? String(currentVersion(selectedCard).status || selectedCard.attributes.status || 'REFERENCE') : 'REFERENCE';
  const selectedPlanStatus = selected ? String(selected.attributes.status || 'ACTIVE') : 'REFERENCE';
  const editable = Boolean(selected && ['DRAFT', 'CHANGES_REQUESTED'].includes(selectedStatus) && canEdit);

  function openCreate() { setEditing(null); setCreatingVersion(false); setForm({ ...starterForm, effectiveFrom: defaultEffectiveFrom() }); setFormStep(0); setEditorOpen(true); setError(''); }
  function openEdit() { if (!selected || !editable) return; setEditing(selected); setCreatingVersion(false); setForm(formFromPlan(selected)); setFormStep(0); setEditorOpen(true); setError(''); }
  function openNewVersion() { if (!selected || !canEdit || !['PUBLISHED', 'RETIRED'].includes(selectedStatus)) return; setEditing(selected); setCreatingVersion(true); setForm({ ...formFromPlan(selected), effectiveFrom: defaultEffectiveFrom() }); setFormStep(0); setEditorOpen(true); setError(''); }
  function continueForm() {
    setError('');
    if (formStep === 0 && (!form.code.trim() || !form.name.trim() || !form.audience || !form.price.trim() || !form.extraFloorPrice.trim())) { setError('Add a plan code, name, audience, and fallback prices to continue.'); return; }
    if (formStep === 1) {
      try { const parsed = JSON.parse(form.rateCards); if (!Array.isArray(parsed) || parsed.length === 0) throw new Error(); }
      catch { setError('Add at least one valid pricing rule to continue.'); return; }
    }
    if (formStep === 2 && (!form.frequency || !form.visits.trim() || !form.callbacks.trim() || !form.priority || Number(form.visits) < 0)) { setError('Complete the service coverage details to continue.'); return; }
    setFormStep((step) => Math.min(3, step + 1));
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (editing && creatingVersion) {
        await operationsData.createProviderAmcPlanVersion(providerId, editing.id, { effective_from: effectiveIso(form.effectiveFrom), plan: toPayload(form) }, crypto.randomUUID());
        setMessage('New draft version created. Its effective date will be used when the reviewer-approved version is published.');
      } else if (editing) {
        await operationsData.updateProviderAmcPlan(providerId, editing.id, { name: form.name, audience: form.audience, effective_from: effectiveIso(form.effectiveFrom), expected_revision: currentVersion(editing).revision, plan: toPayload(form) }, crypto.randomUUID());
        setMessage('Draft saved. It remains unpublished until submitted and independently reviewed.');
      } else {
        await operationsData.createProviderAmcPlan(providerId, { name: form.name, audience: form.audience, business_operation_code: 'ELEVATOR_SERVICES', effective_from: effectiveIso(form.effectiveFrom), plan: toPayload(form) }, crypto.randomUUID());
        setMessage('AMC plan draft created.');
      }
      setEditorOpen(false); await reload();
    } catch (cause) { setError(fail(cause)); } finally { setBusy(false); }
  }
  async function action(kind: 'submit' | 'approve' | 'changes' | 'publish' | 'activate' | 'suspend') {
    if (!selected || selectedStatus === 'REFERENCE') return;
    setBusy(true); setError('');
    try {
      const revision = ['activate', 'suspend'].includes(kind) ? selected.attributes.revision : currentVersion(selected).revision;
      if (kind === 'submit') await operationsData.submitProviderAmcPlan(providerId, selected.id, { expected_revision: revision }, crypto.randomUUID());
      if (kind === 'approve' || kind === 'changes') await operationsData.reviewProviderAmcPlan(providerId, selected.id, { decision: kind === 'approve' ? 'APPROVE' : 'REQUEST_CHANGES', reason: kind === 'changes' ? 'Please clarify service inclusions and commercial limits.' : 'Reviewed against the elevator AMC service policy.' , expected_revision: revision }, crypto.randomUUID());
      if (kind === 'publish') await operationsData.publishProviderAmcPlan(providerId, selected.id, { expected_revision: revision, effective_from: currentVersion(selected).effective_from }, crypto.randomUUID());
      if (kind === 'activate') await operationsData.activateProviderAmcPlan(providerId, selected.id, { expected_revision: revision }, crypto.randomUUID());
      if (kind === 'suspend') await operationsData.suspendProviderAmcPlan(providerId, selected.id, { expected_revision: revision }, crypto.randomUUID());
      setMessage(kind === 'submit' ? 'Plan submitted for reviewer approval.' : kind === 'approve' ? 'Plan approved. It is ready for publication.' : kind === 'changes' ? 'Changes requested from the plan owner.' : kind === 'publish' ? 'Plan published for quotation and contract selection.' : kind === 'activate' ? 'Plan activated and available for new commercial work.' : 'Plan suspended and removed from new commercial selection.');
      await reload(selected.id);
    } catch (cause) { setError(fail(cause)); } finally { setBusy(false); }
  }

  const summary = plans?.summary || { total: 0, published: 0, drafts: 0, pending_review: 0 };
  const selectedLiftTypes = [...new Set(rateCardsFromJson(form.rateCards).map((card) => card.liftType).filter(Boolean))];
  const includedOptions = [...new Set([...generalIncludedItems, ...selectedLiftTypes.flatMap((liftType) => includedItemsByLift[liftType] || [])])];
  if (editorOpen) return <section className="quotation-form-page amc-plan-create-page" aria-label="AMC plan form">
    <PageHeader eyebrow="Service · AMC plan catalogue" title={creatingVersion ? 'New AMC plan version' : editing ? 'Edit AMC plan' : 'New AMC plan'} description="Set up an elevator AMC plan in a few guided steps." action={<Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>← Back to plan catalogue</Button>} />
    <section className="quotation-form-shell detail-card">
      <div className="quotation-form-intro"><div><span className="eyebrow">Step {formStep + 1} of 4</span><h2>{['Plan details', 'Pricing rules', 'Service coverage', 'Review plan'][formStep]}</h2></div><p className="notice">{['Name this plan and choose who it serves.', 'Set annual prices for the lift types this plan covers.', 'Choose included and chargeable services for those lift types.', 'Check the customer-facing summary before saving.'][formStep]}</p></div>
      <nav className="amc-form-steps" aria-label="Plan setup progress">{['Plan details', 'Pricing rules', 'Service coverage', 'Review'].map((label, index) => <button type="button" key={label} className={index === formStep ? 'is-active' : index < formStep ? 'is-complete' : ''} onClick={() => { if (index < formStep) setFormStep(index); }}><span>{index < formStep ? '✓' : index + 1}</span>{label}</button>)}</nav>
      <form className="amc-plan-editor" noValidate onSubmit={(event) => { event.preventDefault(); if (formStep < 3) { continueForm(); return; } void save(event); }}>
        {formStep === 0 && <div className="amc-plan-form-grid"><label>Display name *<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Standard AMC" /></label><label>Who is this plan for?<SortedSelect value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value as PlanForm['audience'] })}><option value="RESIDENTIAL">Residential community</option><option value="COMMERCIAL">Commercial building</option></SortedSelect></label><label>Effective from (India time)<input required={creatingVersion} type="datetime-local" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} /><small>For a new version, this date starts the new terms.</small></label><label>Fallback annual price (INR)<input required min="0" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /><small>Used only if no pricing rule matches.</small></label><label>Fallback extra floor price (INR / floor / year)<input required min="0" type="number" value={form.extraFloorPrice} onChange={(event) => setForm({ ...form, extraFloorPrice: event.target.value })} /></label></div>}
        {formStep === 1 && <RateCardMatrixEditor value={form.rateCards} onChange={(rateCards) => setForm({ ...form, rateCards })} />}
        {formStep === 2 && <div className="amc-plan-form-grid"><label>Preventive maintenance frequency<SortedSelect value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })}><option value="MONTHLY">Monthly</option><option value="BI_MONTHLY">Every 2 months</option><option value="QUARTERLY">Every 3 months</option><option value="HALF_YEARLY">Every 6 months</option><option value="ANNUAL">Annually</option></SortedSelect></label><label>Scheduled service visits / year<input required min="0" type="number" value={form.visits} onChange={(event) => setForm({ ...form, visits: event.target.value })} /></label><label>Breakdown callbacks / year<input required value={form.callbacks} onChange={(event) => setForm({ ...form, callbacks: event.target.value })} placeholder="12 or Unlimited" /></label><label>Service priority<SortedSelect value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="STANDARD">Standard</option><option value="FAST">Fast response</option><option value="PRIORITY">Priority response</option></SortedSelect></label><div className="amc-plan-full-field"><ServiceItemChecklist label="Included service items" value={form.included} options={includedOptions} onChange={(included) => setForm({ ...form, included })} /></div><div className="amc-plan-full-field"><ServiceItemChecklist label="Excluded / chargeable items" value={form.excluded} options={commonExclusions} onChange={(excluded) => setForm({ ...form, excluded })} /></div></div>}
        {formStep === 3 && <div className="amc-form-review"><section><h3>Plan details</h3><p><strong>{form.name || 'Unnamed plan'}</strong> · {titleCase(form.audience)}</p><p>Fallback {formatPrice(form.price)} / year · Starts {form.effectiveFrom ? effectiveLabel(effectiveIso(form.effectiveFrom)) : 'not scheduled'}</p></section><section><h3>Service coverage</h3><p>{titleCase(form.frequency)} maintenance · {form.visits || '0'} visits / year · {form.callbacks || '0'} callbacks · {titleCase(form.priority)} priority</p><p><strong>Included:</strong> {splitLines(form.included).join(' · ') || 'No items listed'}</p><p><strong>Excluded:</strong> {splitLines(form.excluded).join(' · ') || 'No exclusions listed'}</p></section><section><h3>Pricing rules</h3>{rateCardsFromJson(form.rateCards).map((card, index) => <p key={card.id}><strong>{index + 1}. {titleCase(card.audience)}, {card.passengerCapacity} passengers{card.liftType ? ` · ${titleCase(card.liftType)}` : ''}</strong> — {formatPrice(card.baseAmount)} / year up to G+{card.includedFloors}; {card.floorRates.length} floor band(s)</p>)}</section></div>}
        {error && <ActionFeedback kind="error">{error}</ActionFeedback>}
        <div className="provider-form-actions">{formStep === 0 ? <Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>Cancel</Button> : <Button type="button" variant="secondary" onClick={() => { setError(''); setFormStep((step) => Math.max(0, step - 1)); }}>Back</Button>}{formStep < 3 ? <Button type="button" formNoValidate onClick={(event) => { event.preventDefault(); event.stopPropagation(); continueForm(); }}>Continue</Button> : <Button type="submit" busy={busy}>{creatingVersion ? 'Create draft version' : editing ? 'Save draft' : 'Create draft plan'}</Button>}</div>
      </form>
    </section>
  </section>;
  const referenceMode = realPlans.length === 0;
  return <section className="content feature-page amc-plan-catalogue">
    <PageHeader title="Elevator AMC Plan Catalogue" description="Create reusable service packages for elevator and lift AMC quotations. This catalogue is provider-owned and independent from the TRISE platform subscription." action={<div className="amc-plan-header-actions"><Button variant="secondary" onClick={() => setLifecycleOpen(true)}><SvgIcon name="activity" size={15} /> AMC Journey</Button><Button variant="secondary" onClick={() => go('amc')}>Back to AMC contracts</Button>{canManage && <Button onClick={openCreate}><SvgIcon name="plus" size={15} /> New AMC plan</Button>}</div>} />
    <div className="amc-plan-scope-banner"><span className="amc-plan-scope-icon" aria-hidden="true">↗</span><div><strong>Elevator &amp; Lift Services · Provider workspace</strong><p>Plan cards are customer-facing previews. Pricing, entitlements and snapshots are controlled by the provider plan version selected in a quotation or AMC contract.</p></div><Status>{isProviderAdmin ? 'Provider Admin · Full lifecycle' : canReview ? 'Reviewer view' : 'Admin view'}</Status></div>
    {message && <ActionFeedback>{message}</ActionFeedback>}{error && <ActionFeedback kind="error">{error}</ActionFeedback>}
    <div className="feature-summary-grid amc-plan-summary"><div><span>Published plans</span><strong>{referenceMode ? '—' : summary.published}</strong><small>Available for new quotations</small></div><div><span>Drafts in progress</span><strong>{referenceMode ? '—' : summary.drafts}</strong><small>Editable by plan owners</small></div><div><span>Pending review</span><strong>{referenceMode ? '—' : summary.pending_review}</strong><small>Maker-checker queue</small></div><div><span>Business type</span><strong>Elevator</strong><small>AMC &amp; preventive maintenance</small></div></div>
    {lifecycleOpen && <AmcSubscriptionLifecycle selectedStatus={selectedStatus} planStatus={selectedPlanStatus} onClose={() => setLifecycleOpen(false)} />}
    <WorkspaceTabs label="AMC plan workspace" activeId={tab} onChange={(id) => setTab(id as 'catalogue' | 'review')} tabs={[{ id: 'catalogue', label: 'Catalogue' }, { id: 'review', label: `Review queue${summary.pending_review ? ` (${summary.pending_review})` : ''}`, disabled: !canReview }]} />
    {referenceMode && <div className="amc-plan-reference-note"><strong>Brochure starter preview</strong><span>No provider plans have been saved yet. These reference cards reflect the attached residential/commercial AMC brochures and are not persisted records.</span>{canManage && <Button variant="secondary" onClick={openCreate}>Use Standard AMC starter</Button>}</div>}
    <div className="amc-plan-workspace">
      <section className="amc-plan-list-panel"><div className="section-heading"><div><h2>{tab === 'review' ? 'Plans awaiting review' : 'Provider plan catalogue'}</h2><p>{tab === 'review' ? 'Review submitted versions without editing the owner’s draft.' : 'Use a clear package ladder for residential communities and commercial buildings.'}</p></div><span>{cards.length} {cards.length === 1 ? 'plan' : 'plans'}</span></div>{cards.length ? <div className="amc-plan-card-grid">{cards.map((item) => { const version = currentVersion(item); const data = asObject(version.plan); const entitlements = asObject(data.entitlements); const pricing = asObject(data.pricing); return <button type="button" className={`amc-plan-card ${item.id === selectedCard?.id ? 'is-selected' : ''} ${String(item.attributes.code || '').includes('STANDARD') ? 'is-featured' : ''}`} key={item.id} onClick={() => setSelectedId(item.id)}><div className="amc-plan-card-top"><Status>{String(version.status || item.attributes.status || 'REFERENCE')}</Status><span className="amc-plan-lifecycle">{titleCase(item.attributes.status || 'REFERENCE')}</span>{String(item.attributes.code || '').includes('STANDARD') && <span className="amc-plan-recommended">Most recommended</span>}</div><h3>{String(item.attributes.name || 'AMC plan')}</h3><p>{String(item.attributes.audience || 'Elevator service')}</p><strong>{formatPrice(pricing.base_price || version.base_price)} <small>+ GST / Year</small></strong><div className="amc-plan-card-facts"><span>{titleCase(entitlements.preventive_frequency)} PM</span><span>{String(entitlements.scheduled_visits || '—')} visits</span><span>{String(entitlements.breakdown_callbacks || '—')} callbacks</span></div></button>; })}</div> : <EmptyState title="No plans awaiting review" description="Submitted provider plans will appear here when they are ready for an independent reviewer." />}</section>
      {selectedCard && <section className="amc-plan-detail-panel"><div className="amc-plan-detail-heading"><div><span className="page-eyebrow">Plan Studio · {String(selectedCard.attributes.code || 'REFERENCE')}</span><h2>{String(selectedCard.attributes.name || 'AMC plan')}</h2><p>Version {String(currentVersion(selectedCard).version || '1')} · {titleCase(selectedStatus)} · Plan {titleCase(selectedPlanStatus)}</p><p className="amc-plan-effective-window">Effective from <strong>{effectiveLabel(currentVersion(selectedCard).effective_from)}</strong>{currentVersion(selectedCard).effective_to ? <> · through <strong>{effectiveLabel(currentVersion(selectedCard).effective_to)}</strong></> : ' · open-ended'}</p></div><div className="amc-plan-detail-actions">{editable && <Button variant="secondary" onClick={openEdit}>Edit draft</Button>}{selected && canEdit && ['PUBLISHED', 'RETIRED'].includes(selectedStatus) && <Button variant="secondary" onClick={openNewVersion}>Create new version</Button>}{canSubmit && ['DRAFT', 'CHANGES_REQUESTED'].includes(selectedStatus) && <Button onClick={() => void action('submit')} busy={busy}>Submit for review</Button>}{canReview && selectedStatus === 'SUBMITTED' && <><Button variant="secondary" onClick={() => void action('changes')} busy={busy}>Request changes</Button><Button onClick={() => void action('approve')} busy={busy}>Approve plan</Button></>}{canPublish && selectedStatus === 'APPROVED' && <Button onClick={() => void action('publish')} busy={busy}>Publish version</Button>}{selected && canActivate && selectedStatus === 'PUBLISHED' && selectedPlanStatus === 'SUSPENDED' && <Button onClick={() => void action('activate')} busy={busy}>Activate plan</Button>}{selected && canSuspend && selectedStatus === 'PUBLISHED' && selectedPlanStatus === 'ACTIVE' && <Button variant="danger" onClick={() => void action('suspend')} busy={busy}>Suspend plan</Button>}</div></div><div className="amc-plan-preview-card"><div className="amc-plan-preview-ribbon">Customer plan card preview</div><div className="amc-plan-preview-title"><div><h3>{String(selectedCard.attributes.name || 'AMC plan')}</h3><span>{titleCase(selectedCard.attributes.audience || 'Elevator AMC')}</span></div><strong>{formatPrice(asObject(asObject(currentVersion(selectedCard).plan).pricing).base_price || currentVersion(selectedCard).base_price)}<small>+ GST / Year</small></strong></div><div className="amc-plan-preview-grid"><div><span>Preventive visits</span><strong>{String(asObject(asObject(dataFor(selectedCard)).entitlements).scheduled_visits || '—')} / year</strong></div><div><span>Callback support</span><strong>{String(asObject(asObject(dataFor(selectedCard)).entitlements).breakdown_callbacks || '—')}</strong></div><div><span>Service priority</span><strong>{titleCase(asObject(asObject(dataFor(selectedCard)).entitlements).service_priority)}</strong></div><div><span>Base configuration</span><strong>G+{String(asObject(asObject(dataFor(selectedCard)).eligibility).base_floors || '4')}</strong></div></div></div><div className="amc-plan-detail-columns"><div><h3>Included service</h3><ul>{textItems(planData(selectedCard).included).map((item: unknown) => <li key={String(item)}>✓ {String(item)}</li>)}</ul></div><div><h3>Not included</h3><ul className="is-excluded">{textItems(planData(selectedCard).excluded).map((item: unknown) => <li key={String(item)}>× {String(item)}</li>)}</ul></div></div><div className="amc-plan-governance"><strong>Workflow</strong><span className={selectedStatus === 'DRAFT' ? 'is-current' : ''}>Draft</span><i>→</i><span className={selectedStatus === 'SUBMITTED' ? 'is-current' : ''}>Submitted</span><i>→</i><span className={selectedStatus === 'APPROVED' ? 'is-current' : ''}>Approved</span><i>→</i><span className={selectedStatus === 'PUBLISHED' ? 'is-current' : ''}>Published</span><span className="amc-plan-availability">Availability: {titleCase(selectedPlanStatus)}</span></div>{selected && Array.isArray(selected.attributes.versions) && <div className="amc-plan-version-history"><strong>Version history</strong><div>{(selected.attributes.versions as unknown[]).map((item) => { const version = asObject(item); return <span key={String(version.id || version.version)}><b>v{String(version.version)}</b><Status>{String(version.status || '—')}</Status><small>{effectiveLabel(version.effective_from)}</small></span>; })}</div></div>}</section>}
    </div>
  </section>;
}

function dataFor(item: PlanResource) { return planData(item); }
