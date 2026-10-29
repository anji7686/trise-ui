import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Status } from '@trise/ui';
import { customerData, type AssetAttributes, type BookingAttributes, type ContractAttributes, type DocumentAttributes, type FeedbackAttributes, type InstallationProjectAttributes, type ProviderAttributes, type ProviderSupportContact, type QuotationAttributes, type Resource, type ServiceJobAttributes, type TimelineEntryAttributes, type WarrantyAttributes } from './data';
import { classifyCustomerState, CustomerStatePanel, type CustomerStateKind } from './customer-state';
import { pendingFeedbackJobs, serviceFeedbackEligible, serviceStatusLabel } from './customer-services';
import { customerCoverageStatus, customerPlanDisplayName, customerReadableName } from './coverage-list';
import { renewalEnquiryMailto } from './coverage-renewal';
import { customerVisibleAddressText } from './customer-display';
import { customerDocumentClassificationLabel, customerDocumentDisplayName } from './document-list';
import { appointmentActionsAvailable, appointmentIsConfirmed, appointmentStageDescription, customerCancellationNotice, indiaDateTimeLocal, indiaDateTimeToIso, serviceTrackingEventTitle, serviceTrackingStage, serviceTrackingTitle, validFutureAppointmentWindow } from './customer-booking-actions';
import { customerProjectDisplayName, customerProjectJourney, customerProjectProgressLabel, handoverEvidenceIds } from './customer-projects';

type Provider = Resource<ProviderAttributes>;
type Scoped<T> = { providerId: string; providerName: string; resource: Resource<T> };
type ProjectDocumentRow = { id: string; attributes: Pick<DocumentAttributes, 'filename' | 'media_type' | 'classification' | 'status'> };
type T = (key: string) => string;
const messageFor = (error: unknown) => (error as { message?: string })?.message || 'The request could not be completed.';
const objectValue = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const textValue = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export function relatedResourceId(relationships: Resource<unknown>['relationships'], name: string): string | null {
  const relation = relationships[name];
  const link = Array.isArray(relation) ? relation[0] : relation;
  return link?.id || null;
}
export function technicianInitials(name?: string | null): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) || [];
  return words.slice(0, 2).map((word) => word[0]).join('').toLocaleUpperCase('en-IN') || 'T';
}
export function projectQuotationPanelHeading(status?: string | null, linked = false): string {
  if (!linked) return 'Project scope';
  return ['ACCEPTED', 'APPROVED'].includes((status || '').toUpperCase()) ? 'What you approved' : 'Quotation for this project';
}
export function customerAgreementVersionLabel(summaryVersion?: number | null, contractVersion?: number | null): string {
  const version = [summaryVersion, contractVersion].find((value) => typeof value === 'number' && Number.isFinite(value) && value > 0);
  return typeof version === 'number' ? String(version) : 'Not provided';
}
const mergeTimelineEntries = (current: Resource<TimelineEntryAttributes>[], incoming: Resource<TimelineEntryAttributes>[]) => Array.from(
  new Map([...current, ...incoming].map((entry) => [entry.id, entry])).values(),
).sort((left, right) => left.attributes.occurred_at.localeCompare(right.attributes.occurred_at));
const date = (value?: string | null) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(value)) : 'Not provided';
const page = (title: string, description: string, children: ReactNode, pageClass = '') => <section className={`content customer-detail-page ${pageClass}`.trim()}><div className="section-heading"><div><Status>Customer account</Status><h2>{title}</h2><p>{description}</p></div></div>{children}</section>;
const state = (text: string, kind = classifyCustomerState(text)) => { const onAction = kind === 'denied' ? () => { window.location.hash = '/'; } : ['loading', 'error', 'conflict', 'offline'].includes(kind) ? () => window.location.reload() : undefined; return <CustomerStatePanel kind={kind as CustomerStateKind} message={text} onAction={onAction} />; };

export function CustomerCoverageDetail({ providerId, providerName, id, kind, onBack, onOpenAsset, t }: { providerId: string; providerName: string; id: string; kind: 'warranty' | 'contract'; onBack: () => void; onOpenAsset: (providerId: string, assetId: string) => void; t: T }) {
  const [record, setRecord] = useState<Resource<WarrantyAttributes | ContractAttributes> | null>(null);
  const [coveredAsset, setCoveredAsset] = useState<Resource<AssetAttributes> | null>(null);
  const [sharedDocuments, setSharedDocuments] = useState<Resource<DocumentAttributes>[] | null>(null);
  const [documentsError, setDocumentsError] = useState('');
  const [error, setError] = useState('');
  const [renewalDialogOpen, setRenewalDialogOpen] = useState(false);
  const [renewalContact, setRenewalContact] = useState<ProviderSupportContact | null>(null);
  const [renewalContactState, setRenewalContactState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [renewalSubject, setRenewalSubject] = useState('');
  const [renewalMessage, setRenewalMessage] = useState('');
  const renewalDialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    setRecord(null); setCoveredAsset(null); setSharedDocuments(null); setDocumentsError(''); setError('');
    const load = kind === 'warranty' ? customerData.warranty(providerId, id) : customerData.contract(providerId, id);
    load.then((value) => {
      if (!active) return;
      setRecord(value);
      if (kind === 'contract') {
        customerData.documents(providerId, { limit: 15 }, id)
          .then((result) => { if (active) setSharedDocuments(result.data); })
          .catch((cause) => { if (active) { setSharedDocuments([]); setDocumentsError(messageFor(cause)); } });
      }
      const assetId = kind === 'warranty'
        ? relatedResourceId(value.relationships, 'asset')
        : (value.attributes as ContractAttributes).customer_safe_summary?.covered_assets?.length === 1
          ? (value.attributes as ContractAttributes).customer_safe_summary?.covered_assets?.[0]?.asset_id
          : undefined;
      if (assetId) {
        customerData.asset(providerId, assetId).then((asset) => { if (active) setCoveredAsset(asset); }).catch(() => { if (active) setCoveredAsset(null); });
      }
    }).catch((cause) => { if (active) setError(messageFor(cause)); });
    return () => { active = false; };
  }, [providerId, id, kind]);
  useEffect(() => {
    const dialog = renewalDialogRef.current;
    if (!dialog) return;
    if (renewalDialogOpen && !dialog.open) dialog.showModal();
    if (!renewalDialogOpen && dialog.open) dialog.close();
  }, [renewalDialogOpen]);
  if (error) return page('Coverage details', 'Authorized warranty or maintenance agreement.', <><Button className="customer-coverage-detail-back" onClick={onBack}>AMC &amp; warranty</Button>{state(error)}</>, 'customer-coverage-detail-page');
  if (!record) return page('Coverage details', 'Authorized warranty or maintenance agreement.', state(t('loading')), 'customer-coverage-detail-page');
  const contract = kind === 'contract' ? record.attributes as ContractAttributes : null;
  const warranty = kind === 'warranty' ? record.attributes as WarrantyAttributes : null;
  const summary = contract?.customer_safe_summary;
  const agreementDisplayName = summary ? customerPlanDisplayName(summary.plan_name, record.attributes.name) : customerPlanDisplayName(undefined, record.attributes.name);
  async function openRenewalDialog() {
    setRenewalDialogOpen(true);
    setRenewalContact(null);
    setRenewalContactState('loading');
    setRenewalSubject(`AMC renewal enquiry · ${agreementDisplayName}`);
    setRenewalMessage('Please share the renewal options and terms for this agreement.');
    try {
      const result = await customerData.supportContact(providerId);
      setRenewalContact(result.data);
      setRenewalContactState('ready');
    } catch {
      setRenewalContactState('error');
    }
  }
  const customerTerms = objectValue(summary?.customer_terms);
  const includedAmc = objectValue(customerTerms.included_free_amc);
  const materials = Array.isArray(customerTerms.materials) ? customerTerms.materials.map(objectValue).filter((item) => textValue(item.description)) : [];
  const exclusions = Array.isArray(customerTerms.exclusions) ? customerTerms.exclusions.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];
  const warrantyTerms = textValue(customerTerms.warranty_terms);
  const deliveryTerms = textValue(customerTerms.delivery_terms);
  const termsAndConditions = textValue(customerTerms.terms_and_conditions);
  const hasCustomerTerms = Number(includedAmc.months) > 0 || Boolean(warrantyTerms || deliveryTerms || termsAndConditions || materials.length || exclusions.length);
  const coveredAssetNames = summary?.covered_assets?.map((asset) => customerReadableName(asset.display_name)).filter(Boolean) || [];
  const coveredLiftCount = summary?.covered_elevator_count ?? summary?.covered_assets?.length ?? 0;
  const coveredAssetSummary = coveredLiftCount > 1 ? `${coveredLiftCount} covered lifts` : coveredAssetNames[0] || (coveredAsset?.attributes.name ? customerReadableName(coveredAsset.attributes.name) : '') || 'Details not shared';
  const siteSummary = coveredLiftCount > 1 ? 'See each covered lift for its site' : summary?.upcoming_service?.service_location_name ? customerReadableName(summary.upcoming_service.service_location_name) : coveredAsset?.attributes.service_location_name ? customerReadableName(coveredAsset.attributes.service_location_name) : customerVisibleAddressText(coveredAsset?.attributes.service_location_address) || 'Site details not shared';
  const detailSubtitle = contract
    ? [summary?.plan_code, coveredAssetNames.length === 1 ? coveredAssetNames[0] : coveredAssetNames.length > 1 ? `${coveredAssetNames.length} covered lifts` : ''].filter(Boolean).join(' · ') || 'Review your authorized maintenance coverage.'
    : [warranty?.name ? customerReadableName(warranty.name) : '', coveredAsset?.attributes.name ? customerReadableName(coveredAsset.attributes.name) : ''].filter(Boolean).join(' · ') || 'Review your authorized warranty coverage.';
  return page(kind === 'warranty' ? 'Your warranty' : 'Your maintenance agreement', detailSubtitle, <>
    <Button className="customer-coverage-detail-back" onClick={onBack}>AMC &amp; warranty</Button>
    <article className="customer-feature-panel customer-detail-card customer-coverage-detail"><div className="customer-feature-panel-heading"><div><h3>{summary ? customerPlanDisplayName(summary.plan_name, record.attributes.name) : record.attributes.name}</h3><p>{providerName}</p></div><Status>{customerCoverageStatus(record.attributes.status, record.attributes.effective_from, record.attributes.effective_to).replace(/\b\w/g, (letter) => letter.toUpperCase())}</Status></div>
      <dl className="customer-feature-details"><div><dt>Coverage period</dt><dd>{date(record.attributes.effective_from)} – {date(record.attributes.effective_to)}</dd></div>
        {contract && <><div><dt>{coveredLiftCount === 1 ? 'Covered lift' : 'Covered lifts'}</dt><dd>{coveredAssetSummary}</dd></div><div><dt>Site</dt><dd>{siteSummary}</dd></div><div><dt>Provider</dt><dd>{providerName}</dd></div><div><dt>Next preventive visit</dt><dd>{summary?.upcoming_service ? date(summary.upcoming_service.due_at) : 'Not shared'}</dd></div><div><dt>Agreement version</dt><dd>{customerAgreementVersionLabel(summary?.plan_version, contract.version)}</dd></div></>}
        {warranty && <div><dt>Agreement</dt><dd>{warranty.name}</dd></div>}
      </dl>
      <div className="customer-coverage-grid"><div className="customer-coverage-main">
      {warranty && coveredAsset && <section className="customer-coverage-asset"><h4>Covered lift</h4><button type="button" onClick={() => onOpenAsset(providerId, coveredAsset.id)}><strong>{customerReadableName(coveredAsset.attributes.name)}</strong><span>{[coveredAsset.attributes.service_location_name ? customerReadableName(coveredAsset.attributes.service_location_name) : '', customerVisibleAddressText(coveredAsset.attributes.service_location_address)].filter(Boolean).join(' · ') || 'Site details not available'}</span><small>Status · {coveredAsset.attributes.status.replaceAll('_', ' ').toLowerCase()}</small></button></section>}
      {contract && summary && (summary.covered_assets?.length ? <section className="customer-coverage-asset"><h4>Covered lifts · {summary.covered_elevator_count ?? summary.covered_assets.length}</h4><div className="customer-coverage-asset-grid">{summary.covered_assets.map((asset) => <button type="button" key={asset.asset_id} onClick={() => onOpenAsset(providerId, asset.asset_id)}><strong>{customerReadableName(asset.display_name)}</strong><span>{asset.status.replaceAll('_', ' ').toLowerCase()} · Covered from {date(asset.effective_from)}{asset.effective_to ? ` to ${date(asset.effective_to)}` : ''}</span><small>{asset.service_location_name ? customerReadableName(asset.service_location_name) : 'Site details not shared'}</small></button>)}</div>{summary.covered_assets_truncated && <p className="customer-feature-footnote">Showing the first 100 currently authorized covered lifts.</p>}</section> : <p className="customer-feature-footnote">No covered lifts are currently available through your authorized customer relationship.</p>)}
      {contract && <section className="customer-coverage-agreement"><h4>What your agreement covers</h4>{Number(includedAmc.months) > 0 || summary?.preventive_frequency || Number(summary?.scheduled_visits) > 0 ? <div className="customer-coverage-chips">{Number(includedAmc.months) > 0 && <span>{String(includedAmc.months)} months free AMC{typeof includedAmc.frequency === 'string' ? ` · ${includedAmc.frequency.toLowerCase().replaceAll('_', ' ')} visits` : ''}</span>}{summary?.preventive_frequency && <span>{summary.preventive_frequency.toLowerCase().replaceAll('_', ' ')} preventive visits</span>}{Number(summary?.scheduled_visits) > 0 && <span>{summary?.scheduled_visits} visits included</span>}</div> : null}{hasCustomerTerms ? <>{warrantyTerms && <article><strong>Warranty</strong><p>{warrantyTerms}</p></article>}{deliveryTerms && <article><strong>Delivery and handover</strong><p>{deliveryTerms}</p></article>}{materials.length > 0 && <div className="customer-coverage-materials"><h5>Included materials</h5>{materials.map((material, index) => <article key={`${textValue(material.description)}-${index}`}><strong>{textValue(material.description)}</strong><span>Qty {String(material.quantity ?? '—')}{textValue(material.unit_code) ? ` ${textValue(material.unit_code)}` : ''}</span>{Array.isArray(material.specifications) && material.specifications.map((item, specIndex) => { const spec = objectValue(item); return <small key={specIndex}>{textValue(spec.name)}: {textValue(spec.value)}</small>; })}{Number(material.warranty_months) > 0 && <small>{String(material.warranty_months)} month material warranty</small>}</article>)}</div>}{exclusions.length > 0 && <div><strong>Exclusions</strong><ul>{exclusions.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}{termsAndConditions && <details><summary>Terms &amp; Conditions</summary><p>{termsAndConditions}</p></details>}</> : <p className="customer-feature-footnote">Detailed coverage terms have not been shared for this agreement.</p>}</section>}
      </div><aside className="customer-coverage-aside">
      {contract && <section className="customer-coverage-upcoming"><h4>Upcoming care</h4>{summary?.upcoming_service ? <><dl className="customer-feature-details"><div><dt>Next planned maintenance</dt><dd>{date(summary.upcoming_service.due_at)} · {summary.upcoming_service.status.replaceAll('_', ' ').toLowerCase()}</dd></div>{(summary.upcoming_service.asset_name || summary.upcoming_service.service_location_name) && <div><dt>Service context</dt><dd>{[summary.upcoming_service.asset_name, summary.upcoming_service.service_location_name].filter(Boolean).join(' · ')}</dd></div>}</dl><p className="customer-feature-footnote">This is the provider’s planned maintenance date. A confirmed appointment appears in Service &amp; bookings.</p></> : <p className="customer-feature-footnote">No upcoming maintenance plan is currently available for this authorized coverage.</p>}</section>}
      {contract && <section className="customer-coverage-documents"><h4>Agreement documents</h4>{sharedDocuments === null ? <p className="customer-feature-footnote">Loading shared documents…</p> : documentsError ? <p className="customer-feature-footnote">Shared documents could not be loaded. {documentsError}</p> : sharedDocuments.length ? <div className="record-grid">{sharedDocuments.map((document) => <button className="record-card customer-document-card" type="button" key={document.id} onClick={() => { window.location.hash = `#/documents/${document.id}`; }}><Status>{document.attributes.status.replaceAll('_', ' ')}</Status><strong>{customerDocumentDisplayName(document.attributes.filename)}</strong><span>{customerDocumentClassificationLabel(document.attributes.classification)} · {document.attributes.media_type}</span><span className="customer-document-open">Open agreement document&nbsp; ›</span></button>)}</div> : <p className="customer-feature-footnote">No documents have been shared for this agreement.</p>}</section>}
      {contract && <section className="customer-coverage-renewal"><h4>Thinking ahead?</h4><p>Your provider can prepare a renewal offer. Any new commercial terms will need your approval.</p><Button variant="secondary" onClick={() => void openRenewalDialog()}>Ask about renewal</Button></section>}
      </aside></div>
      <p className="customer-feature-footnote">Eligibility and service decisions are confirmed by the authorized provider using the current agreement.</p>
      {renewalDialogOpen && <dialog ref={renewalDialogRef} className="customer-confirm-dialog customer-renewal-dialog" aria-labelledby="customer-renewal-dialog-title" onCancel={() => setRenewalDialogOpen(false)} onClose={() => setRenewalDialogOpen(false)}>
        <div className="customer-renewal-dialog-heading"><Status>Coverage enquiry</Status><h2 id="customer-renewal-dialog-title">Ask about renewal</h2><p>{providerName} will receive your enquiry through its published support contact.</p></div>
        {renewalContactState === 'loading' ? <p role="status">Loading provider contact details…</p>
          : renewalContactState === 'error' ? <div role="alert"><p>Provider contact details could not be loaded.</p><Button variant="secondary" onClick={() => void openRenewalDialog()}>Try again</Button></div>
            : !renewalContact?.attributes.contact_methods.email ? <div><p>The provider has not shared an email address for renewal enquiries.</p><Button variant="secondary" onClick={() => { setRenewalDialogOpen(false); window.location.hash = '#/help'; }}>View provider contact options</Button></div>
              : <form className="customer-renewal-form" onSubmit={(event) => event.preventDefault()}>
                <label className="field">Subject<input value={renewalSubject} onChange={(event) => setRenewalSubject(event.target.value)} maxLength={200} required /></label>
                <label className="field">Message<textarea value={renewalMessage} onChange={(event) => setRenewalMessage(event.target.value)} maxLength={4000} rows={5} required /></label>
                <p className="customer-renewal-note">Your email app will open with this message for you to review and send. TRISE will not send it automatically.</p>
                {renewalEnquiryMailto(renewalContact.attributes.contact_methods.email, renewalSubject, renewalMessage)
                  ? <a className="button primary customer-renewal-send" href={renewalEnquiryMailto(renewalContact.attributes.contact_methods.email, renewalSubject, renewalMessage) || undefined}>Send enquiry</a>
                  : <Button disabled>Send enquiry</Button>}
              </form>}
        <Button variant="secondary" onClick={() => renewalDialogRef.current?.close()}>Close</Button>
      </dialog>}
    </article>
  </>, 'customer-coverage-detail-page');
}

export function CustomerServiceDetail({ providerId, providerName, id, onBack, onOpenAsset, t }: { providerId: string; providerName: string; id: string; onBack: () => void; onOpenAsset: (providerId: string, assetId: string) => void; t: T }) {
  const [job, setJob] = useState<Resource<ServiceJobAttributes> | null>(null);
  const [history, setHistory] = useState<Resource<TimelineEntryAttributes>[] | null>(null);
  const [booking, setBooking] = useState<Resource<BookingAttributes> | null>(null);
  const [asset, setAsset] = useState<Resource<AssetAttributes> | null>(null);
  const [report, setReport] = useState<Resource<DocumentAttributes> | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionDialog, setActionDialog] = useState<'reschedule' | 'cancel' | null>(null);
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleEnd, setRescheduleEnd] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [savingAction, setSavingAction] = useState(false);
  useEffect(() => {
    let active = true;
    setJob(null); setHistory(null); setBooking(null); setAsset(null); setReport(null); setError(''); setActionError('');
    Promise.allSettled([customerData.job(providerId, id), customerData.timelineForSource(providerId, id)]).then(([jobResult, historyResult]) => {
      if (!active) return;
      if (jobResult.status === 'fulfilled') {
        const currentJob = jobResult.value;
        setJob(currentJob);
        const bookingId = relatedResourceId(currentJob.relationships, 'booking');
        const assetId = relatedResourceId(currentJob.relationships, 'asset');
        const reads: Array<Promise<unknown>> = [];
        if (bookingId) {
          reads.push(customerData.booking(providerId, bookingId).then((value) => { if (active) setBooking(value); }).catch((cause) => { if (active) setActionError(messageFor(cause)); }));
          reads.push(customerData.timelineForSource(providerId, bookingId).then((result) => { if (active) setHistory((current) => mergeTimelineEntries(current || [], result.data)); }).catch(() => undefined));
        }
        if (assetId) reads.push(customerData.asset(providerId, assetId).then((value) => { if (active) setAsset(value); }).catch(() => undefined));
        if (serviceFeedbackEligible(currentJob.attributes.customer_status || currentJob.attributes.status)) reads.push(customerData.documents(providerId, { limit: 15 }, id).then((result) => { if (active) setReport(result.data[0] || null); }).catch(() => undefined));
        void Promise.allSettled(reads);
      } else setError(messageFor(jobResult.reason));
      if (historyResult.status === 'fulfilled') setHistory((current) => mergeTimelineEntries(current || [], historyResult.value.data)); else setHistory((current) => current || []);
    });
    return () => { active = false; };
  }, [providerId, id]);
  const trackingShell = (children: ReactNode, showIntro = false) => <section className="content customer-detail-page customer-service-tracking-page"><Button className="customer-service-tracking-back" onClick={onBack}>Service & bookings</Button>{showIntro && <header className="customer-service-tracking-heading"><div><h1>Service tracking</h1><p>Progress and details shared by your service provider.</p></div></header>}{children}</section>;
  if (error) return trackingShell(state(error), true);
  if (!job) return trackingShell(state(t('loading')), true);
  const assetLinkId = relatedResourceId(job.relationships, 'asset');
  const bookingId = relatedResourceId(job.relationships, 'booking');
  const bookingStatus = booking?.attributes.status;
  const completed = serviceFeedbackEligible(job.attributes.customer_status || job.attributes.status);
  const cancelledBooking = bookingStatus?.toUpperCase() === 'CANCELLED';
  const confirmedBooking = appointmentIsConfirmed(bookingStatus);
  const manageable = Boolean(bookingId && appointmentActionsAvailable(bookingStatus) && !completed);
  const scheduledWindow = booking?.attributes.scheduled_window || job.attributes.scheduled_window || (!confirmedBooking ? booking?.attributes.requested_window : undefined);
  const location = job.attributes.historical_location;
  const placeName = location && (typeof location.service_location_name === 'string' ? customerReadableName(location.service_location_name) : typeof location.name === 'string' ? customerReadableName(location.name) : null);
  const placeAddress = location && (typeof location.address === 'string' ? customerVisibleAddressText(location.address) : Array.isArray(location.address_lines) ? customerVisibleAddressText(location.address_lines) : null);
  const events = [...(history || [])].sort((left, right) => left.attributes.occurred_at.localeCompare(right.attributes.occurred_at));
  const requestId = relatedResourceId(job.relationships, 'request');
  const recordTitle = serviceTrackingTitle(job.attributes.summary, asset?.attributes.name);
  const recordSubtitle = asset?.attributes.name
    ? `${customerReadableName(asset.attributes.name)}${asset.attributes.identifiers?.[0]?.value ? ` · ${asset.attributes.identifiers[0].value}` : ''}`
    : null;
  const trackingStatus = booking ? serviceStatusLabel(bookingStatus!) : job.attributes.customer_status?.trim() || serviceStatusLabel(job.attributes.status);
  const step = serviceTrackingStage(job.attributes.customer_status || job.attributes.status, bookingStatus);
  const startTime = scheduledWindow?.starts_at ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(new Date(scheduledWindow.starts_at)) : '';
  const endTime = scheduledWindow?.ends_at ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(new Date(scheduledWindow.ends_at)) : '';
  const scheduleLabel = cancelledBooking ? 'Appointment cancelled' : scheduledWindow?.starts_at ? `${confirmedBooking ? 'Visit confirmed' : 'Preferred window'} · ${date(scheduledWindow.starts_at)}${startTime ? ` · ${startTime}${endTime ? `–${endTime}` : ''}` : ''}` : job.attributes.status.toUpperCase() === 'CREATED' ? 'The provider has not shared a time yet' : 'Visit time not provided';
  const stageTitles = [cancelledBooking ? 'Visit cancelled' : step < 0 ? 'Visit requested' : 'Visit confirmed', 'Technician arrived', 'Service in progress', 'Service completed'];
  const stageDescriptions = [appointmentStageDescription(bookingStatus, job.attributes.customer_status || job.attributes.status, scheduleLabel), 'Check-in updates will appear when shared by the service team.', 'Service progress updates will appear here.', completed ? 'The provider has completed this visit.' : 'Your submitted report will appear here after completion.'];
  async function rescheduleVisit() {
    if (!booking || !bookingId || !validFutureAppointmentWindow(rescheduleStart, rescheduleEnd)) return;
    setSavingAction(true); setActionError('');
    try {
      const updated = await customerData.rescheduleAppointment(providerId, bookingId, { expected_revision: booking.attributes.revision, starts_at: indiaDateTimeToIso(rescheduleStart), ends_at: indiaDateTimeToIso(rescheduleEnd) }, crypto.randomUUID());
      setBooking(updated); setActionDialog(null); setRescheduleStart(''); setRescheduleEnd('');
      void customerData.timelineForSource(providerId, bookingId).then((result) => setHistory((current) => mergeTimelineEntries(current || [], result.data))).catch(() => undefined);
    } catch (cause) { setActionError(messageFor(cause)); }
    finally { setSavingAction(false); }
  }
  async function cancelVisit() {
    if (!booking || !bookingId || !cancellationReason.trim()) return;
    setSavingAction(true); setActionError('');
    try {
      const reason = cancellationReason.trim();
      const updated = await customerData.cancelAppointment(providerId, bookingId, { expected_revision: booking.attributes.revision, reason }, crypto.randomUUID());
      setBooking(updated); setActionDialog(null); setCancellationReason('');
      void customerData.timelineForSource(providerId, bookingId).then((result) => setHistory((current) => mergeTimelineEntries(current || [], result.data))).catch(() => undefined);
    } catch (cause) { setActionError(messageFor(cause)); }
    finally { setSavingAction(false); }
  }
  return trackingShell(<>
    <header className="customer-service-tracking-record-heading"><div><h1>{recordTitle}</h1>{recordSubtitle && <p>{recordSubtitle}</p>}</div><Status>{trackingStatus}</Status></header>
    {actionError && <p className="customer-feature-error" role="alert">{actionError}</p>}
    <div className="customer-service-tracking-layout">
      <article className="customer-feature-panel customer-detail-card customer-service-tracking-main"><section aria-labelledby="customer-service-steps-title"><div className="customer-feature-panel-heading"><div><h2 id="customer-service-steps-title">Your visit, step by step</h2><p>Only the service updates you need.</p></div></div><ol className="customer-service-steps">{stageTitles.map((title, index) => <li key={title} className={index < Math.max(0, step) ? 'complete' : index === Math.max(0, step) ? 'current' : 'pending'} aria-current={index === Math.max(0, step) ? 'step' : undefined}><span className="customer-service-step-marker" aria-hidden="true">{index < Math.max(0, step) ? '✓' : ''}</span><span className="customer-service-step-copy"><strong>{title}</strong><span>{index === 0 && step < 0 ? 'Waiting for provider confirmation' : stageDescriptions[index]}</span>{index === Math.max(0, step) && <small>{step < 0 ? 'Waiting for provider' : 'Current step'}</small>}</span></li>)}</ol></section>
        <dl className="customer-service-tracking-facts"><div><dt>Asset</dt><dd>{asset?.attributes.name ? customerReadableName(asset.attributes.name) : assetLinkId ? 'Linked asset details unavailable' : 'No asset linked'}</dd></div><div><dt>Site</dt><dd>{[placeName, placeAddress].filter(Boolean).join(' · ') || 'Location details are not available.'}</dd></div><div><dt>Appointment</dt><dd>{booking ? scheduleLabel : 'No confirmed appointment is linked to this visit.'}</dd></div>{job.attributes.eta_at && <div><dt>Estimated arrival</dt><dd>{date(job.attributes.eta_at)} · {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(new Date(job.attributes.eta_at))}</dd></div>}</dl>
        {assetLinkId && <Button onClick={() => onOpenAsset(providerId, assetLinkId)}>View linked asset</Button>}
        {requestId && <Button onClick={() => { window.location.hash = `/request/${requestId}`; }}>View service request</Button>}
        {events.length > 0 && <section className="customer-service-tracking-events"><h3>Updates shared by your provider</h3><ol>{events.map((event) => <li key={event.id}><strong>{serviceTrackingEventTitle(event.attributes.event_name)}</strong><time>{date(event.attributes.occurred_at)}</time></li>)}</ol></section>}
        <p className="customer-feature-footnote">Appointment details reflect the latest information shared by {providerName}. A preferred time is not confirmed until the provider confirms it.</p>
      </article>
      <aside className="customer-service-tracking-side">
        <section className="customer-feature-panel customer-detail-card customer-technician-card"><h2>Your technician</h2>{job.attributes.assigned_technician ? <div className="customer-technician-identity"><span className="customer-technician-avatar" aria-hidden="true">{technicianInitials(job.attributes.assigned_technician.display_name)}</span><div><strong>{job.attributes.assigned_technician.display_name}</strong><span>{providerName}</span></div></div> : <><p>{providerName}</p><p className="customer-feature-footnote">Technician details will appear here once your provider shares an assignment.</p></>}<Button onClick={() => { window.location.hash = '/help'; }}>Contact service team</Button></section>
        <section className="customer-feature-panel customer-detail-card"><h2>Manage this visit</h2>{manageable ? <><Button onClick={() => { setActionError(''); setRescheduleStart(scheduledWindow?.starts_at ? indiaDateTimeLocal(scheduledWindow.starts_at) : ''); setRescheduleEnd(scheduledWindow?.ends_at ? indiaDateTimeLocal(scheduledWindow.ends_at) : ''); setActionDialog('reschedule'); }}>Request a different time</Button><Button className="customer-service-cancel-button" onClick={() => { setActionError(''); setActionDialog('cancel'); }}>Cancel booking</Button></> : <p className="customer-feature-footnote">{cancelledBooking ? 'This booking has been cancelled.' : completed ? 'This service visit is complete.' : 'Reschedule or cancel options are available after a visit time is confirmed.'}</p>}</section>
        <section className="customer-feature-panel customer-detail-card"><h2>After the visit</h2><div className="customer-service-after-row"><strong>Service report</strong><span>{report ? <button type="button" onClick={() => { window.location.hash = `/document/${report.id}`; }}>View the submitted report</button> : completed ? 'Your provider has not shared a report yet.' : 'Available after the service is completed.'}</span></div><div className="customer-service-after-row"><strong>Share your feedback</strong><span>{completed ? <button type="button" onClick={() => { window.location.hash = `/feedback/${id}`; }}>Tell us how the service went.</button> : 'Available after the service is completed.'}</span></div></section>
      </aside>
    </div>
    {actionDialog && <div className="customer-confirm-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingAction) setActionDialog(null); }}><section className="customer-confirm-dialog customer-appointment-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-appointment-dialog-title"><Status>{actionDialog === 'reschedule' ? 'Appointment change' : 'Cancel appointment'}</Status><h2 id="customer-appointment-dialog-title">{actionDialog === 'reschedule' ? 'Choose a new visit time' : 'Cancel this booking?'}</h2><p>{actionDialog === 'reschedule' ? 'Times are shown in India Standard Time. Your new time will be checked against the provider’s available capacity.' : customerCancellationNotice}</p>{actionDialog === 'reschedule' ? <><label>New start time (IST)<input type="datetime-local" value={rescheduleStart} onChange={(event) => setRescheduleStart(event.target.value)} required /></label><label>New end time (IST)<input type="datetime-local" value={rescheduleEnd} onChange={(event) => setRescheduleEnd(event.target.value)} required /></label><div className="inline-actions"><Button disabled={savingAction || !validFutureAppointmentWindow(rescheduleStart, rescheduleEnd)} onClick={() => void rescheduleVisit()}>{savingAction ? 'Saving…' : 'Confirm new time'}</Button><Button variant="secondary" disabled={savingAction} onClick={() => setActionDialog(null)}>Keep current time</Button></div></> : <><label>Reason for cancellation<textarea value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} maxLength={200} rows={3} required /></label><div className="inline-actions"><Button className="customer-service-cancel-button" disabled={savingAction || !cancellationReason.trim()} onClick={() => void cancelVisit()}>{savingAction ? 'Cancelling…' : 'Confirm cancellation'}</Button><Button variant="secondary" disabled={savingAction} onClick={() => setActionDialog(null)}>Keep booking</Button></div></>}</section></div>}
  </>);
}

export function CustomerProjectDetail({ providerId, providerName, id, onBack, onAccepted, t }: { providerId: string; providerName: string; id: string; onBack: () => void; onAccepted: (saved: Resource<InstallationProjectAttributes>) => void; t: T }) {
  const [project, setProject] = useState<Resource<InstallationProjectAttributes> | null>(null);
  const [projectDocuments, setProjectDocuments] = useState<Resource<DocumentAttributes>[] | null>(null);
  const [sourceQuotation, setSourceQuotation] = useState<Resource<QuotationAttributes> | null>(null);
  const [quotationLoading, setQuotationLoading] = useState(false);
  const [quotationError, setQuotationError] = useState('');
  const [documentsError, setDocumentsError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const [handoverToConfirm, setHandoverToConfirm] = useState<NonNullable<InstallationProjectAttributes['handover_events']>[number] | null>(null);
  const loadSourceQuotation = useCallback((quotationId: string) => {
    setQuotationLoading(true); setQuotationError(''); setSourceQuotation(null);
    customerData.quotation(providerId, quotationId)
      .then((value) => setSourceQuotation(value))
      .catch((cause) => setQuotationError(messageFor(cause)))
      .finally(() => setQuotationLoading(false));
  }, [providerId]);
  useEffect(() => {
    let active = true;
    setProject(null); setProjectDocuments(null); setDocumentsError(''); setSourceQuotation(null); setQuotationError(''); setQuotationLoading(false); setError('');
    customerData.installationProject(providerId, id).then((value) => {
      if (!active) return;
      setProject(value);
      if (value.attributes.source_quotation_id) loadSourceQuotation(value.attributes.source_quotation_id);
      customerData.documents(providerId, { limit: 50 }, id)
        .then((result) => { if (active) setProjectDocuments(result.data); })
        .catch((cause) => { if (active) { setProjectDocuments([]); setDocumentsError(messageFor(cause)); } });
    }).catch((cause) => { if (active) setError(messageFor(cause)); });
    return () => { active = false; };
  }, [providerId, id, loadSourceQuotation]);
  useEffect(() => {
    if (!handoverToConfirm) return;
    const dismissOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) setHandoverToConfirm(null); };
    window.addEventListener('keydown', dismissOnEscape);
    return () => window.removeEventListener('keydown', dismissOnEscape);
  }, [handoverToConfirm, saving]);
  async function accept(event: NonNullable<InstallationProjectAttributes['handover_events']>[number]) {
    if (!project) return;
    setSaving(event.id); setError('');
    try {
      const evidenceIds = handoverEvidenceIds(event);
      if (!evidenceIds.length) throw new Error('Review the handover report from the service provider before accepting this unit.');
      const result = await customerData.acceptHandover(providerId, project.id, { expected_revision: project.attributes.revision, asset_id: event.asset_id || undefined, evidence_ids: evidenceIds, acknowledgement_method: 'ONLINE' }, crypto.randomUUID());
      const updated = { ...project, attributes: { ...project.attributes, revision: result.attributes.service_case_revision ?? project.attributes.revision, handover_events: [...(project.attributes.handover_events || []), { id: result.id, event_kind: result.attributes.event_kind, asset_id: result.attributes.asset_id, service_case_revision: result.attributes.service_case_revision, evidence_count: event.evidence_count, occurred_at: result.attributes.occurred_at }] } };
      setProject(updated); onAccepted(updated); setHandoverToConfirm(null);
    } catch (cause) { setError(messageFor(cause)); }
    finally { setSaving(''); }
  }
  if (error && !project) return page('Project & handover', 'Installation progress and customer handover actions.', <><Button onClick={onBack}>Back to projects</Button>{state(error)}</>);
  if (!project) return page('Project & handover', 'Installation progress and customer handover actions.', state(t('loading')));
  if (project.attributes.status.toUpperCase() === 'DRAFT') return page('Project & handover', 'Installation progress and customer handover actions.', <><Button onClick={onBack}>Back to projects</Button>{state('This project is still being prepared by the service provider.', 'empty')}</>);
  const assets = project.attributes.project_assets || [];
  const events = project.attributes.handover_events || [];
  const projectDocumentRows = Array.from(new Map<string, ProjectDocumentRow>([
    ...(projectDocuments || []).map((document) => [document.id, { id: document.id, attributes: document.attributes }] as const),
    ...events.flatMap((event) => event.evidence_documents || []).map((document) => [document.id, {
      id: document.id,
      attributes: { filename: document.filename, media_type: document.media_type, classification: document.classification, status: 'available' },
    }] as const),
  ]).values());
  const acceptedAssets = new Set(events.filter((event) => event.event_kind.toUpperCase() === 'ACCEPTED').map((event) => event.asset_id || 'PROJECT'));
  const pending = events.filter((event) => event.event_kind.toUpperCase() === 'REQUESTED' && !acceptedAssets.has(event.asset_id || 'PROJECT'));
  const handoverUnitName = (event: NonNullable<InstallationProjectAttributes['handover_events']>[number]) => event.asset_id ? customerReadableName(project.attributes.project_assets?.find((asset) => asset.id === event.asset_id)?.display_name || 'this unit') : 'all project units';
  const journey = customerProjectJourney(project.attributes);
  const projectStatus = pending.length ? 'Handover review' : acceptedAssets.size ? 'Handover in progress' : project.attributes.status.replaceAll('_', ' ');
  const projectKind = project.attributes.project_classification_key?.replaceAll('_', ' ').toLowerCase() || 'installation project';
  const rawProjectLocationName = project.attributes.service_location_name?.trim();
  const projectLocationName = rawProjectLocationName ? customerReadableName(rawProjectLocationName) : undefined;
  const projectTitleDetail = customerProjectDisplayName(project.attributes.title, rawProjectLocationName);
  const projectSubtitle = [projectLocationName, projectTitleDetail, providerName].filter(Boolean).join(' · ');
  const sourceQuotationId = project.attributes.source_quotation_id;
  const quotationStatus = sourceQuotation?.attributes.status.toUpperCase();
  const quotationAccepted = quotationStatus === 'ACCEPTED' || quotationStatus === 'APPROVED';
  const quoteTotal = sourceQuotation ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: sourceQuotation.attributes.currency || 'INR', maximumFractionDigits: 2 }).format(Number(sourceQuotation.attributes.total)) : null;
  const projectScope = `${assets.length} elevator unit${assets.length === 1 ? '' : 's'}`;
  const unitHandover = (assetId: string) => {
    if (acceptedAssets.has('PROJECT') || acceptedAssets.has(assetId)) return { kind: 'accepted' as const, accepted: events.find((event) => event.event_kind.toUpperCase() === 'ACCEPTED' && (event.asset_id === assetId || !event.asset_id)) };
    const requested = pending.find((event) => event.asset_id === assetId || !event.asset_id);
    return requested ? { kind: 'requested' as const, requested } : { kind: 'not-requested' as const };
  };
  const unitProgressText = (assetId: string) => {
    const stages = (project.attributes.stages || []).filter((stage) => stage.asset_id === assetId);
    const qualityStages = stages.filter((stage) => /test|commission|inspection|quality/i.test(`${stage.code} ${stage.title}`));
    const installationStages = stages.filter((stage) => /install/i.test(`${stage.code} ${stage.title}`));
    const incomplete = (items: typeof stages) => items.length > 0 && items.some((stage) => !['COMPLETED', 'COMPLETE', 'DONE'].includes(stage.status.toUpperCase()));
    if (incomplete(qualityStages)) return 'Quality checks in progress';
    if (incomplete(installationStages)) return 'Installation in progress';
    if (stages.length && stages.every((stage) => ['COMPLETED', 'COMPLETE', 'DONE'].includes(stage.status.toUpperCase()))) return 'Ready for handover request';
    return 'Project progress not shared';
  };
  return <section className="content customer-detail-page customer-project-detail-page">
    <Button className="customer-project-back" onClick={onBack}>Projects</Button>
    <header className="customer-feature-heading customer-project-heading"><div><Status>{projectStatus}</Status><h1>A new chapter for your space.</h1><p>{projectSubtitle}</p></div></header>
    {error && <p className="customer-feature-error" role="alert">{error}</p>}
    <div className="customer-project-summary"><div className="customer-project-progress"><strong>{project.attributes.progress_percent}%</strong><span>·</span><span>{customerProjectProgressLabel(project.attributes)}</span></div><h3>Installation journey</h3><ol className="customer-project-journey" aria-label="Installation journey">{journey.map((step, index) => <li key={step.key} data-state={step.state}><span className="customer-project-journey-marker" aria-hidden="true">{step.state === 'complete' ? '✓' : index + 1}</span><span className="customer-project-journey-copy"><strong>{step.label}</strong><small>{step.state === 'complete' ? 'Complete' : step.state === 'current' ? 'In progress' : step.state === 'not-shared' ? 'Not shared by provider' : 'Not started'}</small></span></li>)}</ol></div>
    <div className="customer-project-detail-grid">
      <section className="customer-feature-panel customer-project-units-panel"><div className="customer-feature-panel-heading"><div><h2>Your installed units</h2><p>Each unit has its own readiness and handover status.</p></div></div>
        {assets.length ? <div className="customer-project-unit-list">{assets.map((asset) => {
          const progress = project.attributes.unit_progress?.find((unit) => unit.asset_id === asset.id);
          const handover = unitHandover(asset.id);
          const unitName = customerReadableName(asset.display_name);
          return <article className="customer-project-unit" key={asset.id}><div className="customer-project-unit-heading"><div><strong>{unitName}</strong><small>{progress ? `${progress.progress_percent}% complete · ${progress.completed_stage_count} of ${progress.stage_count} stages` : unitProgressText(asset.id)}</small></div><Status>{handover.kind === 'accepted' ? 'Handed over' : handover.kind === 'requested' ? 'Ready for your review' : unitProgressText(asset.id)}</Status></div>
            {handover.kind === 'accepted' ? <p className="customer-project-unit-note">Handover accepted{handover.accepted?.occurred_at ? ` · ${date(handover.accepted.occurred_at)}` : ''}. Coverage commencement remains a separate provider action.</p> : handover.kind === 'requested' ? <><p className="customer-project-unit-note">{handover.requested.evidence_documents?.length ? `${handover.requested.evidence_documents.length} handover report${handover.requested.evidence_documents.length === 1 ? '' : 's'} available to review.` : 'The handover quality report is not available yet.'}</p>{Boolean(handover.requested.evidence_documents?.length) && <div className="customer-project-evidence-links">{handover.requested.evidence_documents?.map((document) => <button className="customer-project-evidence-link" type="button" key={document.id} onClick={() => { window.location.hash = `#/documents/${document.id}`; }}>Review {document.filename}</button>)}</div>}<Button disabled={saving === handover.requested.id} onClick={() => { setError(''); setHandoverToConfirm(handover.requested); }}>{saving === handover.requested.id ? 'Saving…' : `Review & accept ${unitName}`}</Button></> : <p className="customer-project-unit-note">{unitProgressText(asset.id)}. Handover will appear here when your provider shares the report.</p>}
          </article>;
        })}</div> : state('Unit details are not available for this project.', 'empty')}
        {project.attributes.stages?.length ? <details className="customer-project-stage-details"><summary>Project stage activity <span>{project.attributes.stages.length} stages</span></summary><ol className="customer-project-stages">{project.attributes.stages.map((stage) => <li key={stage.id}><span><strong>{stage.title}</strong><small>{stage.asset_id ? assets.find((asset) => asset.id === stage.asset_id)?.display_name || 'Assigned unit' : 'All units'}</small></span><Status>{stage.status.replaceAll('_', ' ')}</Status></li>)}</ol></details> : null}
        {pending.some((event) => !event.asset_id) && <Button disabled={saving === pending.find((event) => !event.asset_id)?.id} onClick={() => { const event = pending.find((item) => !item.asset_id); if (event) { setError(''); setHandoverToConfirm(event); } }}>Review &amp; accept project handover</Button>}
      </section>
      <aside className="customer-project-aside">
        <section className="customer-feature-panel"><div className="customer-feature-panel-heading"><div><h2>{projectQuotationPanelHeading(sourceQuotation?.attributes.status, Boolean(sourceQuotationId))}</h2><p>{sourceQuotationId ? 'The quotation linked to this installation.' : 'Installation details shared by your service provider.'}</p></div></div>
          {sourceQuotation ? <><div className="customer-project-quote-total"><span>{sourceQuotation.attributes.quotation_number || 'Quotation'}</span>{quoteTotal && <strong>{quoteTotal}</strong>}</div><dl className="customer-feature-details customer-project-quote-details"><div><dt>Decision</dt><dd>{sourceQuotation.attributes.status.replaceAll('_', ' ')}</dd></div><div><dt>Scope</dt><dd>{projectScope} · {projectKind}</dd></div><div><dt>Service provider</dt><dd>{sourceQuotation.attributes.provider_name || providerName}</dd></div><div><dt>Site</dt><dd>{project.attributes.service_location_name || 'Site details not shared'}</dd></div></dl>{sourceQuotation.attributes.lines.length > 0 && <ul className="customer-project-quote-lines">{sourceQuotation.attributes.lines.slice(0, 3).map((line, index) => <li key={`${index}-${line.description}`}>{line.description}</li>)}</ul>}<Button variant="secondary" onClick={() => { window.location.hash = `#/quotation/${sourceQuotation.id}`; }}>{quotationAccepted ? 'View approved quotation' : 'Review quotation'}</Button></> : quotationLoading ? <p className="customer-feature-footnote" role="status">Loading quotation details…</p> : sourceQuotationId ? <div className="customer-project-quote-unavailable" role="alert"><p>Quotation details are not available right now.</p>{quotationError && <small>{quotationError}</small>}<Button variant="secondary" onClick={() => loadSourceQuotation(sourceQuotationId)}>Retry quotation details</Button></div> : <><dl className="customer-feature-details customer-project-quote-details"><div><dt>Project type</dt><dd>{projectKind}</dd></div><div><dt>Units</dt><dd>{projectScope}</dd></div><div><dt>Service provider</dt><dd>{providerName}</dd></div><div><dt>Site</dt><dd>{project.attributes.service_location_name || 'Site details not shared'}</dd></div></dl><p className="customer-feature-footnote">The provider has not linked an approved quotation to this project.</p></>}
        </section>
        <section className="customer-feature-panel"><div className="customer-feature-panel-heading"><div><h2>After handover</h2></div></div><p className="customer-feature-footnote">Warranty and AMC stay linked to the covered asset and approved agreement. Handover alone does not activate coverage.</p><Button variant="secondary" onClick={() => { window.location.hash = '#/coverage'; }}>View AMC &amp; warranty</Button></section>
        <section className="customer-feature-panel"><div className="customer-feature-panel-heading"><div><h2>Project documents</h2><p>Reports and evidence shared for this project.</p></div></div>{projectDocuments === null ? <p className="customer-feature-footnote" role="status">Loading shared project documents…</p> : documentsError ? <p className="customer-feature-footnote" role="alert">Project documents could not be loaded. {documentsError}</p> : projectDocumentRows.length ? <div className="customer-project-document-list">{projectDocumentRows.map((document) => <button className="customer-project-document-link" type="button" key={document.id} onClick={() => { window.location.hash = `#/documents/${document.id}`; }}><span><strong>{customerDocumentDisplayName(document.attributes.filename)}</strong><small>{customerDocumentClassificationLabel(document.attributes.classification)}</small></span><Status>{document.attributes.status.replaceAll('_', ' ')}</Status></button>)}</div> : state('No documents have been shared for this project.', 'empty')}</section>
        {events.length > 0 && <details className="customer-feature-panel customer-project-history"><summary>Handover activity history <span>{events.length} events</span></summary><div className="customer-handover-list">{events.map((event) => <div key={event.id}><Status>{event.event_kind.replaceAll('_', ' ')}</Status><span>{handoverUnitName(event)}</span><small>{date(event.occurred_at)}</small></div>)}</div></details>}
      </aside>
    </div>
    {handoverToConfirm && <div className="customer-confirm-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setHandoverToConfirm(null); }}><section className="customer-confirm-dialog customer-handover-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-handover-dialog-title" aria-describedby="customer-handover-dialog-description"><Status>Customer handover</Status><h2 id="customer-handover-dialog-title">Accept handover for {handoverUnitName(handoverToConfirm)}?</h2><p id="customer-handover-dialog-description">Review the unit and project details before you continue. Acceptance applies to {handoverToConfirm.asset_id ? 'this unit' : 'all project units'} only and does not activate AMC or warranty.</p>{!handoverToConfirm.evidence_documents?.length && <p className="customer-handover-missing-evidence" role="status">The provider has not shared the handover quality report yet. You can accept after the evidence is available to review.</p>}{Boolean(handoverToConfirm.evidence_documents?.length) && <div className="customer-project-evidence-links">{handoverToConfirm.evidence_documents?.map((document) => <button className="customer-project-evidence-link" type="button" key={document.id} onClick={() => { window.location.hash = `#/documents/${document.id}`; }}>Review {document.filename}</button>)}</div>}<div className="inline-actions"><Button variant="secondary" autoFocus disabled={Boolean(saving)} onClick={() => setHandoverToConfirm(null)}>Review details</Button><Button disabled={Boolean(saving) || !handoverToConfirm.evidence_documents?.length} onClick={() => void accept(handoverToConfirm)}>{saving ? 'Recording…' : `Accept ${handoverToConfirm.asset_id ? handoverUnitName(handoverToConfirm) : 'project handover'}`}</Button></div></section></div>}
  </section>;
}

export function CustomerFeedbackPage({ providers, jobId, t }: { providers: Provider[] | null; jobId?: string; t: T }) {
  const [entries, setEntries] = useState<Scoped<FeedbackAttributes>[] | null>(null);
  const [jobs, setJobs] = useState<Array<{ providerId: string; providerName: string; resource: Resource<ServiceJobAttributes> }> | null>(null);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    setEntries(null); setJobs(null); setError(''); setSaved(false);
    if (!providers) return () => { active = false; };
    Promise.all(providers.map(async (provider) => {
      const providerName = provider.attributes.display_name || 'Service provider';
      const [feedback, completedJobs, closedJobs] = await Promise.allSettled([
        customerData.feedback(provider.id, { limit: 50 }),
        customerData.jobs(provider.id, { limit: 100 }, 'COMPLETED'),
        customerData.jobs(provider.id, { limit: 100 }, 'CLOSED'),
      ]);
      const jobs = [
        ...(completedJobs.status === 'fulfilled' ? completedJobs.value.data : []),
        ...(closedJobs.status === 'fulfilled' ? closedJobs.value.data : []),
      ];
      const seen = new Set<string>();
      const uniqueJobs = jobs.filter((job) => !seen.has(job.id) && Boolean(seen.add(job.id)));
      return {
        providerId: provider.id,
        providerName,
        feedback: feedback.status === 'fulfilled' ? feedback.value.data : [],
        jobs: uniqueJobs,
        feedbackError: feedback.status === 'rejected' ? messageFor(feedback.reason) : '',
        jobsError: completedJobs.status === 'rejected' && closedJobs.status === 'rejected' ? messageFor(completedJobs.reason) : '',
      };
    })).then((results) => {
      if (!active) return;
      setEntries(results.flatMap((result) => result.feedback.map((resource) => ({ providerId: result.providerId, providerName: result.providerName, resource }))));
      setJobs(results.flatMap((result) => result.jobs.map((resource) => ({ providerId: result.providerId, providerName: result.providerName, resource }))));
      const failures = results.filter((result) => result.feedbackError && result.jobsError);
      if (failures.length === results.length && results.length) setError(failures[0].feedbackError);
    }).catch((cause) => { if (active) setError(messageFor(cause)); });
    return () => { active = false; };
  }, [providers?.map((provider) => provider.id).join('|') ?? 'loading']);
  async function submit(providerId: string) {
    if (!jobId || rating < 1) return;
    setSaving(true); setError('');
    try { await customerData.submitFeedback(providerId, jobId, { rating, comment: comment.trim() }, crypto.randomUUID()); setSaved(true); }
    catch (cause) { setError(messageFor(cause)); }
    finally { setSaving(false); }
  }
  const feedbackTitle = jobId ? 'How did we do?' : 'Service feedback';
  const feedbackPageClass = jobId ? 'customer-feedback-page' : '';
  if (error && (!entries || !jobs)) return page(feedbackTitle, jobId ? 'Feedback for a completed service visit.' : 'Share feedback on completed service visits.', state(error), feedbackPageClass);
  if (!entries || !jobs) return page(feedbackTitle, jobId ? 'Feedback for a completed service visit.' : 'Share feedback on completed service visits.', state(t('loading')), feedbackPageClass);
  if (jobId) {
    const job = jobs.find((entry) => entry.resource.id === jobId);
    if (error && !job) return page(feedbackTitle, 'Feedback is available only for an eligible completed service visit.', <>{state(error)}<Button onClick={() => window.location.hash = '/feedback'}>Back to service feedback</Button></>, feedbackPageClass);
    if (!job) return page(feedbackTitle, 'Feedback is available only for an eligible completed service visit.', <>{error && <p className="customer-feature-error" role="alert">{error}</p>}{state('This service visit is unavailable or not eligible for feedback.', 'empty')}</>, feedbackPageClass);
    const alreadySubmitted = entries.some((entry) => {
      const relation = entry.resource.relationships.job;
      const linkedJobId = Array.isArray(relation) ? relation[0]?.id : relation?.id;
      return entry.providerId === job.providerId && linkedJobId === jobId;
    }) || saved;
    const canSubmit = serviceFeedbackEligible(job.resource.attributes.status);
    const technicianName = job.resource.attributes.assigned_technician?.display_name?.trim();
    const feedbackPerson = technicianName ? `${technicianName} · ${job.providerName}` : job.providerName;
    const feedbackInitials = (technicianName || job.providerName).trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'SP';
    const visitSummary = customerReadableName(job.resource.attributes.summary || 'service visit');
    const completedText = job.resource.attributes.completed_at ? `Completed ${visitSummary} · ${date(job.resource.attributes.completed_at)}` : `Completed ${visitSummary}`;
    return page(feedbackTitle, 'Feedback for the completed service visit.', <article className="customer-feature-panel customer-detail-card customer-feedback-card">
      <div className="customer-feedback-person"><span className="customer-feedback-avatar" aria-hidden="true">{feedbackInitials}</span><div><strong>{feedbackPerson}</strong><small>{completedText}</small></div></div>
      {error && <p className="customer-feature-error" role="alert">{error}</p>}
      {alreadySubmitted ? state('Thank you for sharing feedback. It has been recorded for this visit.') : !canSubmit ? state('Feedback becomes available after the provider records this visit as completed.') : <form className="customer-feedback-form" onSubmit={(event) => { event.preventDefault(); void submit(job.providerId); }}>
        <fieldset><legend className="sr-only">How was your service?</legend><div className="customer-rating-options" role="radiogroup" aria-label="Rating from 1 to 5">{[1, 2, 3, 4, 5].map((value) => <label key={value}><input type="radio" name="rating" aria-label={`${value} star${value === 1 ? '' : 's'}`} value={value} checked={rating === value} onChange={() => setRating(value)} required /><span aria-hidden="true">{value <= rating ? '★' : '☆'}</span></label>)}</div></fieldset>
        <label>Anything you’d like to share?<textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={4000} rows={4} /></label>
        <Button disabled={saving || rating < 1}>{saving ? 'Sending…' : <>Send feedback <span className="customer-feedback-arrow" aria-hidden="true">→</span></>}</Button>
      </form>}
    </article>, feedbackPageClass);
  }
  const sorted = [...entries].sort((a, b) => b.resource.attributes.submitted_at.localeCompare(a.resource.attributes.submitted_at));
  const pending = pendingFeedbackJobs(jobs, entries);
  if (error) return page('Service feedback', 'Your feedback for completed service visits.', state(error));
  return page('Service feedback', 'Your feedback for completed service visits.', <>
    {pending.length > 0 && <section className="customer-feedback-pending" aria-labelledby="customer-feedback-pending-title"><div className="customer-feature-panel-heading"><div><h3 id="customer-feedback-pending-title">Visits ready for feedback</h3><p>Share your experience after a completed service visit.</p></div><Status>{pending.length} ready</Status></div><div className="customer-feedback-pending-list">{pending.map(({ providerId, providerName, resource }) => <article className="customer-feature-panel" key={`${providerId}:${resource.id}`}><div><h4>{customerReadableName(resource.attributes.summary || 'Completed service visit')}</h4><p>{providerName} · {resource.attributes.completed_at ? `Completed ${date(resource.attributes.completed_at)}` : 'Completed service visit'}</p></div><Button onClick={() => { window.location.hash = `/feedback/${encodeURIComponent(resource.id)}`; }}>Share feedback</Button></article>)}</div></section>}
    {sorted.length ? <div className="customer-feature-grid">{sorted.map(({ providerId, providerName, resource }) => <article className="customer-feature-panel" key={`${providerId}:${resource.id}`}><div className="customer-feature-panel-heading"><div><h3>{'★'.repeat(resource.attributes.rating)}{'☆'.repeat(5 - resource.attributes.rating)}</h3><p>{providerName}</p></div><time dateTime={resource.attributes.submitted_at}>{date(resource.attributes.submitted_at)}</time></div><p>{resource.attributes.comment || 'No comment added.'}</p></article>)}</div> : pending.length === 0 ? state('Feedback for your completed service visits will appear here.', 'empty') : null}
  </>);
}
