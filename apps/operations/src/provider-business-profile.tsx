import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Button, DetailSection, PageHeader, StatePanel } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { operationsData, type PlatformLogo, type ProviderBusinessProfile, type ProviderDocument, type ProviderVerificationReviewAttributes, type Resource } from './data';
import { containFrame, logoFileError, LOGO_OUTPUT_SIZE } from './logo-crop';
import { SvgIcon } from './icons';
import { INDIAN_STATES_AND_UTS } from './india-geography';

type Review = Resource<ProviderVerificationReviewAttributes>;
type ProfileFields = ProviderBusinessProfile['profile'];
const emptyProfile: ProfileFields = { legal_name: '', registration_number: '', tax_identifier: '', gstin: '', pan_number: '', address: {}, contact_point_ids: [] };
const errorText = (error: unknown) => (error as { message?: string })?.message || 'The business profile request could not be completed.';
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Not available';

async function storageUploadError(response: Response) {
  const body = await response.text().catch(() => '');
  const code = body.match(/<Code>([^<]+)<\/Code>/i)?.[1] || '';
  const message = body.match(/<Message>([^<]+)<\/Message>/i)?.[1] || '';
  const requestId = body.match(/<(?:RequestId|RequestID)>([^<]+)<\/(?:RequestId|RequestID)>/i)?.[1] || '';
  const detail = requestId ? ` AWS request ${requestId}.` : '';
  const explanation = code === 'InvalidAccessKeyId' || code === 'InvalidToken' || code === 'InvalidClientTokenId'
    ? 'Private storage credentials were rejected. Refresh the Rails AWS credentials and restart the API.'
    : code === 'SignatureDoesNotMatch'
      ? 'The private upload signature did not match the request. Check the bucket region and signed headers.'
      : code === 'AccessDenied'
        ? 'Private storage denied this upload. Check the scoped bucket, object, and encryption permissions.'
        : code === 'ExpiredToken' || code === 'RequestExpired'
          ? 'The private upload authorization expired. Request a fresh upload and try again.'
          : message || `Private storage rejected the upload (HTTP ${response.status}).`;
  return new Error(`${explanation}${detail}`);
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

type CropSource = { file: File; url: string; image: HTMLImageElement };
type CropOffset = { x: number; y: number };
type PendingLogoUpload = {
  file: File;
  checksum: string;
  key: string;
  documentId: string;
  versionId: string;
  transfer: { url: string; method: string; headers: Record<string, string>; expires_at: string };
  uploaded: boolean;
};

function drawLogo(canvas: HTMLCanvasElement, image: HTMLImageElement, zoom: number, offset: CropOffset, size: number) {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, size, size);
  const frame = containFrame(image.naturalWidth, image.naturalHeight, size);
  const width = frame.width * zoom;
  const height = frame.height * zoom;
  context.drawImage(image, size / 2 - width / 2 + offset.x, size / 2 - height / 2 + offset.y, width, height);
}

function LogoCropModal({ source, onClose, onChooseAnother, onExport }: { source: CropSource; onClose: () => void; onChooseAnother: () => void; onExport: (file: File) => void }) {
  const previewCanvas = useRef<HTMLCanvasElement>(null);
  const outputCanvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; offset: CropOffset } | null>(null);
  useEffect(() => { drawLogo(previewCanvas.current!, source.image, zoom, offset, 280); drawLogo(outputCanvas.current!, source.image, zoom, offset, LOGO_OUTPUT_SIZE); }, [source.image, zoom, offset]);
  useEffect(() => {
    resetButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')].filter((element) => !element.hasAttribute('disabled'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>) { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, offset }; }
  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) { if (!drag.current) return; setOffset({ x: drag.current.offset.x + event.clientX - drag.current.x, y: drag.current.offset.y + event.clientY - drag.current.y }); }
  function pointerUp() { drag.current = null; }
  function nudge(x: number, y: number) { setOffset((current) => ({ x: current.x + x, y: current.y + y })); }
  function reset() { setZoom(1); setOffset({ x: 0, y: 0 }); }
  function exportCrop() {
    outputCanvas.current?.toBlob((blob) => {
      if (!blob) return;
      const extension = source.file.type === 'image/png' ? 'png' : source.file.type === 'image/webp' ? 'webp' : 'jpg';
      onExport(new File([blob], `provider-logo.${extension}`, { type: source.file.type }));
    }, source.file.type, source.file.type === 'image/jpeg' ? .92 : undefined);
  }
  return <div className="logo-crop-backdrop" role="presentation"><div className="logo-crop-modal" role="dialog" aria-modal="true" aria-labelledby="logo-crop-title" ref={dialog}>
    <div className="logo-crop-header"><div><p className="platform-eyebrow">Provider logo</p><h2 id="logo-crop-title">Fit and position your logo</h2><p className="platform-muted">The square output preserves transparent backgrounds. Wide logos are fitted with padding instead of being stretched or clipped.</p></div><button className="logo-crop-close" type="button" aria-label="Cancel logo crop" onClick={onClose}><SvgIcon name="x" size={18} /></button></div>
    <div className="logo-crop-workspace"><div><p className="logo-crop-label">Crop area</p><div className="logo-crop-square"><canvas width={280} height={280} ref={previewCanvas} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} aria-label="Drag to position logo crop" /></div><div className="logo-crop-nudge" aria-label="Nudge crop position"><button type="button" onClick={() => nudge(0, -8)} aria-label="Move logo up"><SvgIcon name="arrow-up" size={16} /></button><button type="button" onClick={() => nudge(-8, 0)} aria-label="Move logo left"><SvgIcon name="arrow-left" size={16} /></button><button type="button" onClick={() => nudge(8, 0)} aria-label="Move logo right"><SvgIcon name="arrow-right" size={16} /></button><button type="button" onClick={() => nudge(0, 8)} aria-label="Move logo down"><SvgIcon name="arrow-down" size={16} /></button></div></div><div><p className="logo-crop-label">Final logo preview</p><div className="logo-crop-final"><canvas width={LOGO_OUTPUT_SIZE} height={LOGO_OUTPUT_SIZE} ref={outputCanvas} /></div><label className="logo-crop-zoom">Zoom <output>{zoom.toFixed(2)}×</output><input aria-label="Logo zoom" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label></div></div>
    <div className="logo-crop-actions"><button ref={resetButton} type="button" className="button secondary" onClick={reset}>Reset</button><button type="button" className="button secondary" onClick={onChooseAnother}>Choose another image</button><span className="logo-crop-spacer" /><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="button" className="button" onClick={exportCrop}>Upload logo</button></div>
  </div></div>;
}

export function ProviderLogoEditor({ providerId, platform = false, onChanged }: { providerId: string; platform?: boolean; onChanged?: () => void | Promise<void> }) {
  const [logo, setLogo] = useState<PlatformLogo | null>(null);
  const [source, setSource] = useState<CropSource | null>(null);
  const [processedFile, setProcessedFile] = useState<File | null>(null);
  const [processedPreviewUrl, setProcessedPreviewUrl] = useState('');
  const [pendingUpload, setPendingUpload] = useState<PendingLogoUpload | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const load = async () => {
    setError(''); setPreviewError(false);
    try { const result = platform ? await operationsData.platformLogo(providerId) : await operationsData.providerLogo(providerId); setLogo(result.data); } catch (cause) {
      const failure = cause as { status?: number; message?: string };
      const message = failure.status === 401 ? 'Your session has expired. Sign in again before loading the private logo.' : failure.status === 403 ? 'You do not have permission to view this provider logo.' : failure.status === 503 ? 'Private logo storage is temporarily unavailable.' : failure.message || 'The current logo could not be loaded.';
      setError(message);
    }
  };
  useEffect(() => { void load(); }, [providerId, platform]);
  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url); }, [source]);
  useEffect(() => {
    if (!processedFile) { setProcessedPreviewUrl(''); return undefined; }
    const url = URL.createObjectURL(processedFile);
    setProcessedPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [processedFile]);
  async function choose(selected: File | null) {
    if (!selected) return;
    setError(''); setMessage(''); setProcessedFile(null); setPendingUpload(null);
    const basicError = logoFileError(selected);
    if (basicError) { setError(basicError); return; }
    const url = URL.createObjectURL(selected);
    const image = new Image();
    image.onload = () => {
      const imageError = logoFileError(selected, { width: image.naturalWidth, height: image.naturalHeight });
      if (imageError) { URL.revokeObjectURL(url); setError(imageError); return; }
      setSource({ file: selected, url, image });
    };
    image.onerror = () => { URL.revokeObjectURL(url); setError('This image could not be decoded. Choose a valid PNG, JPEG, or WebP file.'); };
    image.src = url;
  }
  async function upload(file: File) {
    setBusy(true); setError(''); setMessage('Preparing private upload…');
    try {
      const checksum = pendingUpload?.file === file ? pendingUpload.checksum : await sha256(file);
      let requestKey = pendingUpload?.file === file ? pendingUpload.key : `provider-logo-${providerId}-${checksum}`;
      const finalizeDocument = platform ? operationsData.finalizePlatformDocument : operationsData.finalizeProviderDocument;
      let uploadTarget = pendingUpload?.file === file ? pendingUpload : null;
      if (!uploadTarget || new Date(uploadTarget.transfer.expires_at).getTime() <= Date.now()) {
        const createDocument = platform ? operationsData.createPlatformDocument : operationsData.createProviderDocument;
        if (pendingUpload?.file === file) requestKey = `${pendingUpload.key}-renew-${Date.now()}`;
        const created = await createDocument(providerId, { filename: file.name, media_type: file.type, size_bytes: file.size, checksum, classification: 'PROVIDER_LOGO', owner: { type: 'SERVICE_PROVIDER', id: providerId }, source: { type: 'SERVICE_PROVIDER', id: providerId }, visibility: 'internal' }, requestKey);
        uploadTarget = { file, checksum, key: requestKey, documentId: created.document.id, versionId: created.version.id, transfer: created.transfer, uploaded: false };
        setPendingUpload(uploadTarget);
      }
      if (!uploadTarget.uploaded) {
        setMessage('Uploading logo…');
        const transfer = uploadTarget.transfer;
        const response = await fetch(transfer.url, { method: transfer.method, headers: transfer.headers, body: file, mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw await storageUploadError(response);
        uploadTarget = { ...uploadTarget, uploaded: true };
        setPendingUpload(uploadTarget);
      }
      setMessage('Finalizing logo upload…');
      await finalizeDocument(providerId, uploadTarget.documentId, { version_id: uploadTarget.versionId, checksum, size_bytes: file.size }, `${uploadTarget.key}-finalize`);
      setMessage('Activating logo…');
      if (platform) await operationsData.activatePlatformLogo(providerId, { document_id: uploadTarget.documentId, version_id: uploadTarget.versionId }, `${uploadTarget.key}-activate`);
      else await operationsData.activateProviderLogo(providerId, { document_id: uploadTarget.documentId, version_id: uploadTarget.versionId }, `${uploadTarget.key}-activate`);
      setProcessedFile(null); setPendingUpload(null); await load(); await onChanged?.(); setMessage('Logo saved. Malware scanning is disabled by platform policy; the private logo remains authorization-protected.');
    } catch (cause) {
      const failure = cause as { message?: string; name?: string };
      const message = failure.name === 'TypeError' && failure.message === 'Failed to fetch'
        ? 'The browser could not reach private object storage. Check the object-storage endpoint and preflight for this Operations origin.'
        : failure.message || 'Logo upload could not be completed. The previous logo remains active.';
      setMessage(''); setError(message);
    } finally { setBusy(false); }
  }
  function closeCrop() { if (source) URL.revokeObjectURL(source.url); setSource(null); trigger.current?.focus(); }
  function chooseAnother() { if (source) URL.revokeObjectURL(source.url); setSource(null); fileInput.current?.click(); }
  function exportAndUpload(file: File) { if (source) URL.revokeObjectURL(source.url); setSource(null); setProcessedFile(file); setPendingUpload(null); trigger.current?.focus(); void upload(file); }
  async function remove() {
    setBusy(true); setError('');
    try { if (platform) await operationsData.removePlatformLogo(providerId, `provider-logo-remove-${providerId}`); else await operationsData.removeProviderLogo(providerId, `provider-logo-remove-${providerId}`); await load(); await onChanged?.(); setMessage('The logo was removed.'); } catch (cause) { setError((cause as { message?: string })?.message || 'The logo could not be removed.'); } finally { setBusy(false); }
  }
  return <DetailSection title="Provider logo" description="Private PNG, JPEG, or WebP logo. Malware scanning is disabled by platform policy; the previous logo remains active until the replacement is finalized.">
    <div className="provider-logo-previews">
      <div className="provider-logo-preview-card">
        <p className="platform-eyebrow">Active logo</p>
        {logo?.transfer?.url && !previewError ? <img src={logo.transfer.url} alt="Current active provider logo" onError={() => setPreviewError(true)} /> : logo ? <StatePanel title="Logo preview unavailable"><span>The private logo transfer expired or was blocked by storage policy. The saved logo is unchanged.</span><Button variant="secondary" onClick={() => void load()}>Refresh preview</Button></StatePanel> : <p className="platform-muted">No active provider logo.</p>}
        {logo?.filename && <small>{logo.filename} · {logo.scan_state === 'not_scanned' ? 'Not scanned — platform policy' : logo.scan_state}</small>}
      </div>
      {processedFile && processedPreviewUrl && <div className="provider-logo-preview-card provider-logo-preview-pending">
        <p className="platform-eyebrow">Selected logo preview</p>
        <img src={processedPreviewUrl} alt="Selected provider logo preview" />
        <small>{busy ? 'Upload in progress; not saved yet.' : 'Not saved. Retry the upload or choose another image.'}</small>
        <a className="button secondary provider-logo-preview-link" href={processedPreviewUrl} target="_blank" rel="noreferrer">Open preview</a>
      </div>}
    </div>
    <input ref={fileInput} className="logo-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void choose(event.target.files?.[0] || null); event.currentTarget.value = ''; }} disabled={busy} />
    <div className="platform-form-actions"><button ref={trigger} type="button" className="button" onClick={() => fileInput.current?.click()} disabled={busy}>{logo ? 'Replace logo' : 'Upload logo'}</button>{logo && <Button type="button" variant="secondary" onClick={() => void remove()} disabled={busy}>Remove logo</Button>}</div>
    {message && <p className="platform-form-note" role="status">{message}</p>}{busy && <p className="platform-form-note">Upload is in progress; cancellation is unavailable after the private transfer begins.</p>}{error && <StatePanel title="Logo action needs attention"><span>{error}</span>{processedFile && <Button variant="secondary" onClick={() => void upload(processedFile)} disabled={busy}>{pendingUpload?.uploaded ? 'Retry finalization' : 'Retry upload'}</Button>}</StatePanel>}
    {source && !busy && <LogoCropModal source={source} onClose={closeCrop} onChooseAnother={chooseAnother} onExport={exportAndUpload} />}
  </DetailSection>;
}

export function ProviderBusinessProfilePage({ providerId }: { providerId: string }) {
  const [profile, setProfile] = useState<ProviderBusinessProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [documents, setDocuments] = useState<ProviderDocument[]>([]);
  const [fields, setFields] = useState<ProfileFields>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [documentSubmitting, setDocumentSubmitting] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const [current, history, documentResult] = await Promise.all([operationsData.providerBusinessProfile(providerId), operationsData.providerBusinessProfileReviews(providerId), operationsData.providerDocuments(providerId)]);
      setProfile(current.data); setFields({ ...emptyProfile, ...current.data.profile, address: { ...(current.data.profile.address || {}) } }); setReviews(history.data as Review[]); setDocuments(documentResult.data as ProviderDocument[]);
    } catch (cause) { setError(errorText(cause)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [providerId]);

  function change(key: keyof ProfileFields, value: string) { setFields((current) => ({ ...current, [key]: value })); }
  function changeAddress(key: string, value: string) { setFields((current) => ({ ...current, address: { ...(current.address || {}), [key]: value } })); }
  function validate() { if (!fields.legal_name?.trim()) return 'Legal name is required.'; if (!fields.address?.city?.trim()) return 'City is required.'; if (!fields.address?.state?.trim()) return 'State is required.'; if (!/^[1-9]\d{5}$/.test(fields.address?.pin_code?.trim() || '')) return 'Enter a valid 6-digit Indian PIN code.'; return ''; }
  async function save(event: FormEvent) { event.preventDefault(); setError(''); setMessage(''); const validation = validate(); if (validation) { setError(validation); return; } if (!profile) return; setSaving(true); try { const result = await operationsData.updateProviderBusinessProfile(providerId, { business_profile: fields, expected_revision: profile.revision }, `provider-business-profile-${providerId}-${profile.revision}`); setProfile(result.data); setFields({ ...emptyProfile, ...result.data.profile, address: { ...(result.data.profile.address || {}) } }); setMessage(result.data.verification_status === 'NOT_SUBMITTED' && profile.verification_status === 'VERIFIED' ? 'Saved. This material change requires a new review.' : 'Business profile saved.'); } catch (cause) { setError(errorText(cause)); } finally { setSaving(false); } }
  async function submit() { setError(''); setMessage(''); const validation = validate(); if (validation) { setError(validation); return; } if (!profile) return; setSubmitting(true); try { await operationsData.submitProviderBusinessProfile(providerId, profile.revision, `provider-business-profile-submit-${providerId}-${profile.revision}`); await load(); setMessage('Submitted for platform review.'); } catch (cause) { setError(errorText(cause)); } finally { setSubmitting(false); } }
  async function submitDocument(document: ProviderDocument) { const version = document.relationships.current_version; const versionId = version && !Array.isArray(version) ? version.id : ''; if (!versionId) return; setError(''); setMessage(''); setDocumentSubmitting(document.id); try { await operationsData.submitProviderDocumentReview(providerId, document.id, versionId, `provider-document-review-${document.id}-${versionId}`); await load(); setMessage('The exact document version was submitted for platform review.'); } catch (cause) { setError(errorText(cause)); } finally { setDocumentSubmitting(''); } }

  if (loading) return <StatePanel title="Loading business profile">Retrieving the authorized provider profile…</StatePanel>;
  if (error && !profile) return <StatePanel title="Business profile unavailable"><span>{error}</span><Button onClick={() => void load()}>Retry</Button></StatePanel>;
  if (!profile) return <StatePanel title="Business profile unavailable">No provider context is available for this screen.</StatePanel>;
  const locked = profile.verification_status === 'PENDING_REVIEW';
  return <section className="platform-page provider-business-profile-page">
    <PageHeader eyebrow="Provider administration" title="Business profile" description="Maintain the provider details used for verification. Saving does not activate the provider or grant access." action={<Button onClick={() => void submit()} disabled={locked || submitting || saving}>{submitting ? 'Submitting…' : locked ? 'Awaiting review' : 'Submit for review'}</Button>} />
    <div className="platform-detail-grid">
      <DetailSection title="Verification status" description="Review status belongs to this exact profile revision."><dl className="platform-definition-list"><dt>Current status</dt><dd><Status>{profile.verification_status}</Status></dd><dt>Profile revision</dt><dd>{profile.revision}</dd><dt>Submitted</dt><dd>{formatDate(profile.submitted_at)}</dd><dt>Verified</dt><dd>{formatDate(profile.verified_at)}</dd></dl>{profile.verification_status === 'CORRECTIONS_REQUESTED' && <p className="platform-form-note">Corrections were requested. Update the fields below and submit the new revision.</p>}{profile.verification_status === 'REJECTED' && <p className="platform-form-note">The last submission was rejected. Review the reason below, correct the profile, and resubmit.</p>}</DetailSection>
      <DetailSection title="Review history" description="Previous decisions remain preserved after correction and resubmission.">{reviews.length ? <ul className="platform-audit-list">{reviews.map((review) => <li key={review.id}><div><strong>{review.attributes.review_kind === 'BUSINESS_PROFILE' ? `Profile revision ${review.attributes.business_profile_revision}` : 'Document version'}</strong><span>{review.attributes.status.replaceAll('_', ' ')}</span>{review.attributes.reason && <small>{review.attributes.reason}</small>}</div><span>{formatDate(review.attributes.reviewed_at || review.attributes.submitted_at)}</span></li>)}</ul> : <p className="platform-muted">No review history yet.</p>}</DetailSection>
    </div>
    <form className="platform-form-card platform-form" onSubmit={save}>
      <div className="platform-form-section"><h2>Indian tax registration</h2><p className="platform-muted">Capture GSTIN and registered PAN when they apply to this provider. Supporting documents are reviewed as separate private document versions.</p><label>GSTIN <span className="platform-muted">(when applicable)</span><input value={fields.gstin || ''} onChange={(event) => change('gstin', event.target.value.toUpperCase())} maxLength={15} pattern="[0-9A-Z]{15}" disabled={locked} /></label><label>Registered PAN <span className="platform-muted">(when applicable)</span><input value={fields.pan_number || ''} onChange={(event) => change('pan_number', event.target.value.toUpperCase())} maxLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" disabled={locked} /></label></div>
      <div className="platform-form-section"><h2>Business details</h2><p className="platform-muted">Use the registered or operating information your platform reviewer can verify.</p><label className="admin-form-field--full">Legal name <span aria-hidden="true">*</span><input value={fields.legal_name || ''} onChange={(event) => change('legal_name', event.target.value)} maxLength={200} disabled={locked} autoComplete="organization" /></label><label>Registration number <span className="platform-muted">(optional)</span><input value={fields.registration_number || ''} onChange={(event) => change('registration_number', event.target.value)} maxLength={100} disabled={locked} /></label><label>Tax identifier <span className="platform-muted">(optional)</span><input value={fields.tax_identifier || ''} onChange={(event) => change('tax_identifier', event.target.value)} maxLength={100} disabled={locked} /></label></div>
      <div className="platform-form-section"><h2>Business address</h2><p className="platform-form-note">India-only address. Enter the address manually, including State, District, City, and PIN code. The PIN is validated as six digits but does not autofill any field.</p><div className="platform-form-grid"><label>Country<select value="IN" disabled><option value="IN">India</option></select></label>{[['address_line', 'Address line'], ['locality', 'Locality / area'], ['city', 'City'], ['district', 'District'], ['state', 'State'], ['pin_code', 'PIN code'], ['landmark', 'Landmark']].map(([key, label]) => <label key={key} className={key === 'address_line' ? 'admin-form-field--full' : undefined}>{label}{['city', 'state', 'pin_code'].includes(key) && <span aria-hidden="true"> *</span>}{key === 'state' ? <select required value={String(fields.address?.[key] || '')} onChange={(event) => changeAddress(key, event.target.value)} disabled={locked}><option value="">Select state / UT</option>{INDIAN_STATES_AND_UTS.map((state) => <option key={state} value={state}>{state}</option>)}</select> : <input value={String(fields.address?.[key] || '')} onChange={(event) => changeAddress(key, event.target.value)} inputMode={key === 'pin_code' ? 'numeric' : undefined} pattern={key === 'pin_code' ? '[1-9][0-9]{5}' : undefined} maxLength={200} disabled={locked} />}</label>)}</div></div>
      {error && <StatePanel title="Business profile action needs attention"><span>{error}</span></StatePanel>}{message && <p className="platform-form-note" role="status">{message}</p>}
      <div className="platform-form-actions"><Button type="button" variant="quiet" onClick={() => void load()} disabled={saving || submitting}>Reload current revision</Button><Button type="submit" disabled={locked || saving || submitting}>{saving ? 'Saving…' : 'Save business profile'}</Button></div>
    </form>
    <DetailSection title="Documents" description="Document transfer remains private and authorization-protected. New uploads are recorded as not scanned under the current platform policy.">{documents.length ? <div className="platform-document-list">{documents.map((document) => { const currentVersion = document.relationships.current_version; const versionId = currentVersion && !Array.isArray(currentVersion) ? currentVersion.id : ''; const pending = reviews.some((review) => review.attributes.review_kind === 'DOCUMENT_VERSION' && review.attributes.document_version_id === versionId && review.attributes.status === 'PENDING_REVIEW'); return <article className="platform-document-row" key={document.id}><div><strong>{document.attributes.filename}</strong><span>{document.attributes.classification} · {document.attributes.media_type} · {Math.ceil(document.attributes.size_bytes / 1024)} KB</span></div><div><Status>{document.attributes.status} / {document.attributes.scan_state === 'not_scanned' ? 'not scanned' : document.attributes.scan_state}</Status><Button variant="secondary" disabled={!versionId || pending || documentSubmitting === document.id} onClick={() => void submitDocument(document)}>{pending ? 'Awaiting review' : documentSubmitting === document.id ? 'Submitting…' : 'Submit version for review'}</Button></div></article>; })}</div> : <p className="platform-muted">No provider documents are visible. Private storage must still be configured before upload.</p>}<p className="platform-form-note">New files retain a timestamp and the reason “malware scanning disabled by platform policy”. No storage path or public URL is exposed here.</p></DetailSection>
    <ProviderLogoEditor providerId={providerId} />
  </section>;
}
