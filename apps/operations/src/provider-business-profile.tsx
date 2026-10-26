import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Button, DetailSection, PageHeader, StatePanel } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { operationsData, type PlatformLogo, type ProviderBusinessProfile, type ProviderDocument, type ProviderVerificationReviewAttributes, type Resource } from './data';
import { containFrame, logoFileError, LOGO_OUTPUT_SIZE } from './logo-crop';
import { SvgIcon } from './icons';
import { SearchableSelect } from './searchable-select';
import { useIndiaGeography } from './use-india-geography';
import { formatIndiaDateTime } from './subscription-support';
import { ProviderDocumentsStep } from './provider-documents';
import { ProviderContactLocationDetails } from './provider-contact-location-details';
import { ProviderSubscriptionPage } from './provider-subscription';
import './operations-pages.css';

type Review = Resource<ProviderVerificationReviewAttributes>;
type ProfileFields = ProviderBusinessProfile['profile'];
type BusinessProfileTab = 'overview' | 'business' | 'contacts' | 'assets' | 'subscription';
const emptyProfile: ProfileFields = { legal_name: '', registration_number: '', tax_identifier: '', gstin: '', pan_number: '', address: {}, contact_point_ids: [] };
const errorText = (error: unknown) => (error as { message?: string })?.message || 'The business profile request could not be completed.';
const formatDate = (value?: string | null) => value ? formatIndiaDateTime(value) : 'Not available';

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
  return <div className={`provider-logo-editor${platform ? ' provider-logo-editor--platform' : ''}`}><DetailSection title="Provider logo" description="Private PNG, JPEG, or WebP logo. Malware scanning is disabled by platform policy; the previous logo remains active until the replacement is finalized.">
    <div className="provider-logo-section-actions"><button ref={trigger} type="button" className="button" onClick={() => fileInput.current?.click()} disabled={busy}><SvgIcon name="upload" size={14} /> {logo ? 'Replace logo' : 'Upload logo'}</button>{logo && <Button type="button" variant="secondary" onClick={() => void remove()} disabled={busy}><SvgIcon name="x" size={14} /> Remove</Button>}</div>
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
    {message && <p className="platform-form-note" role="status">{message}</p>}{busy && <p className="platform-form-note">Upload is in progress; cancellation is unavailable after the private transfer begins.</p>}{error && <StatePanel title="Logo action needs attention"><span>{error}</span>{processedFile && <Button variant="secondary" onClick={() => void upload(processedFile)} disabled={busy}>{pendingUpload?.uploaded ? 'Retry finalization' : 'Retry upload'}</Button>}</StatePanel>}
    {source && !busy && <LogoCropModal source={source} onClose={closeCrop} onChooseAnother={chooseAnother} onExport={exportAndUpload} />}
  </DetailSection></div>;
}

function documentVersionId(document: ProviderDocument) {
  const version = document.relationships.current_version;
  return version && !Array.isArray(version) ? version.id : document.attributes.current_version_id || '';
}

function ProviderAssetGallery({ providerId, documents, reviews, documentSubmitting, onSubmitDocument }: { providerId: string; documents: ProviderDocument[]; reviews: Review[]; documentSubmitting: string; onSubmitDocument: (document: ProviderDocument) => void; }) {
  const [selected, setSelected] = useState<ProviderDocument | null>(null);
  const [assetTab, setAssetTab] = useState<'images' | 'documents'>('images');
  const [assetView, setAssetView] = useState<'gallery' | 'list'>('gallery');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');
  useEffect(() => {
    if (!selected || selected.attributes.status.toLowerCase() !== 'available' || !documentVersionId(selected)) { setPreviewUrl(''); return undefined; }
    let cancelled = false;
    let objectUrl = '';
    setPreviewing(true); setPreviewError(''); setPreviewUrl('');
    operationsData.authorizeProviderDocumentDownload(providerId, selected.id, documentVersionId(selected), crypto.randomUUID(), 'inline')
      .then((transfer) => fetch(transfer.url, { method: transfer.method, headers: transfer.headers, credentials: 'omit' }))
      .then((response) => { if (!response.ok) throw new Error(`Private storage rejected the preview (HTTP ${response.status}).`); return response.blob(); })
      .then((blob) => { if (!cancelled) { objectUrl = URL.createObjectURL(blob); setPreviewUrl(objectUrl); } })
      .catch((cause) => { if (!cancelled) setPreviewError(errorText(cause)); })
      .finally(() => { if (!cancelled) setPreviewing(false); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [providerId, selected]);
  const images = documents.filter((document) => document.attributes.media_type.startsWith('image/'));
  const files = documents.filter((document) => !document.attributes.media_type.startsWith('image/'));
  const visibleDocuments = assetTab === 'images' ? images : files;
  const renderAsset = (document: ProviderDocument, list = false) => {
    const versionId = documentVersionId(document);
    const pending = reviews.some((review) => review.attributes.review_kind === 'DOCUMENT_VERSION' && review.attributes.document_version_id === versionId && review.attributes.status === 'PENDING_REVIEW');
    const image = assetTab === 'images';
    const kind = image ? 'Image / Photo' : 'Document';
    const scanState = document.attributes.scan_state === 'not_scanned' ? 'Not scanned' : document.attributes.scan_state;
    const actions = <div className="provider-asset-actions"><button type="button" className="text-button" onClick={() => setSelected(document)} disabled={!versionId}>View</button><Button variant="secondary" disabled={!versionId || pending || documentSubmitting === document.id} onClick={() => onSubmitDocument(document)}>{pending ? 'Awaiting review' : documentSubmitting === document.id ? 'Submitting…' : 'Submit version'}</Button></div>;
    if (list) return <article className={`provider-asset-list-row provider-asset-tile--${image ? 'image' : 'document'}`} key={document.id} role="listitem"><button type="button" className="provider-asset-preview-trigger" onClick={() => setSelected(document)} disabled={!versionId} aria-label={`View ${document.attributes.filename}`}><span className={`provider-asset-thumb${image ? ' provider-asset-thumb--image' : ''}`} aria-hidden="true"><SvgIcon name={image ? 'eye' : 'clipboard'} size={20} /></span><span className="provider-asset-copy"><strong title={document.attributes.filename}>{document.attributes.filename}</strong><small>{kind}</small></span></button><div className="provider-asset-list-details"><span><b>Classification</b>{document.attributes.classification.replaceAll('_', ' ')}</span><span><b>Type</b>{document.attributes.media_type}</span><span><b>Size</b>{Math.ceil(document.attributes.size_bytes / 1024)} KB</span><span><b>Status</b><Status>{document.attributes.status}</Status></span><span><b>Scan</b>{scanState} · v{document.attributes.current_version || '—'}</span></div>{actions}</article>;
    return <article className={`provider-asset-tile provider-asset-tile--${image ? 'image' : 'document'}`} key={document.id} role="listitem"><button type="button" className="provider-asset-preview-trigger" onClick={() => setSelected(document)} disabled={!versionId} aria-label={`View ${document.attributes.filename}`}><span className={`provider-asset-thumb${image ? ' provider-asset-thumb--image' : ''}`} aria-hidden="true"><SvgIcon name={image ? 'eye' : 'clipboard'} size={24} /></span><span className="provider-asset-copy"><strong title={document.attributes.filename}>{document.attributes.filename}</strong><small>{kind} · {Math.ceil(document.attributes.size_bytes / 1024)} KB</small></span></button><div className="provider-asset-meta"><Status>{document.attributes.status}</Status><small>{scanState} · v{document.attributes.current_version || '—'}</small></div>{actions}</article>;
  };
  if (!documents.length) return <DetailSection title="Assets & documents" description="Provider evidence, logos, and supporting files are kept private and provider-scoped."><div className="provider-asset-empty"><span className="provider-asset-empty-icon" aria-hidden="true"><SvgIcon name="upload" size={22} /></span><div><strong>No provider assets yet</strong><p>Uploaded documents and evidence will appear here as a gallery.</p></div></div></DetailSection>;
  return <>
    <DetailSection title="Assets & documents" description="Choose Images / Photos or Documents. Select View to open an authorized preview.">
      <div className="provider-asset-tabs" role="tablist" aria-label="Asset types">
        <button type="button" role="tab" aria-selected={assetTab === 'images'} className={assetTab === 'images' ? 'active provider-asset-tab--images' : ''} onClick={() => setAssetTab('images')}><SvgIcon name="eye" size={15} /><span>Images / Photos</span><small>{images.length}</small></button>
        <button type="button" role="tab" aria-selected={assetTab === 'documents'} className={assetTab === 'documents' ? 'active provider-asset-tab--documents' : ''} onClick={() => setAssetTab('documents')}><SvgIcon name="clipboard" size={15} /><span>Documents</span><small>{files.length}</small></button>
      </div>
      <div className="provider-asset-view-controls" role="group" aria-label="Asset view options"><span>View as</span><button type="button" className={assetView === 'gallery' ? 'active' : ''} aria-pressed={assetView === 'gallery'} onClick={() => setAssetView('gallery')}><SvgIcon name="grid" size={14} /> Gallery</button><button type="button" className={assetView === 'list' ? 'active' : ''} aria-pressed={assetView === 'list'} onClick={() => setAssetView('list')}><SvgIcon name="clipboard" size={14} /> List</button></div>
      {visibleDocuments.length ? assetView === 'gallery' ? <div className="provider-asset-gallery" role="list" aria-label={assetTab === 'images' ? 'Provider images and photos' : 'Provider documents'}>{visibleDocuments.map((document) => renderAsset(document))}</div> : <div className="provider-asset-list" role="list" aria-label={assetTab === 'images' ? 'Provider images and photos list' : 'Provider documents list'}>{visibleDocuments.map((document) => renderAsset(document, true))}</div> : <div className="provider-asset-empty provider-asset-empty--compact"><span className="provider-asset-empty-icon" aria-hidden="true"><SvgIcon name={assetTab === 'images' ? 'eye' : 'clipboard'} size={18} /></span><div><strong>No {assetTab === 'images' ? 'images or photos' : 'documents'} available</strong><p>Assets of this type will appear here when uploaded.</p></div></div>}
    </DetailSection>
    {selected && <div className="platform-modal-backdrop" role="presentation"><section className="platform-document-modal provider-asset-preview-modal" role="dialog" aria-modal="true" aria-labelledby="provider-asset-preview-title"><div className="platform-modal-header"><div><span className="platform-eyebrow">Private provider asset</span><h2 id="provider-asset-preview-title">{selected.attributes.filename}</h2></div><button type="button" className="logo-crop-close" aria-label="Close asset preview" onClick={() => setSelected(null)}><SvgIcon name="x" size={18} /></button></div>{previewing && <p className="platform-muted">Loading secure preview…</p>}{previewUrl && selected.attributes.media_type.startsWith('image/') && <img className="platform-document-image-preview" src={previewUrl} alt={`Preview of ${selected.attributes.filename}`} />}{previewUrl && selected.attributes.media_type === 'application/pdf' && <object className="platform-document-pdf-preview" data={previewUrl} type="application/pdf" aria-label={`Preview of ${selected.attributes.filename}`}><p>PDF preview is unavailable in this browser.</p></object>}{!previewing && !previewUrl && !previewError && <p className="platform-form-note">This file type is shown as metadata only. Download or an external office viewer is not opened from this screen.</p>}{previewError && <p className="error" role="alert">{previewError}</p>}<dl className="platform-definition-list"><dt>Classification</dt><dd>{selected.attributes.classification.replaceAll('_', ' ')}</dd><dt>Media type</dt><dd>{selected.attributes.media_type}</dd><dt>Size</dt><dd>{Math.ceil(selected.attributes.size_bytes / 1024)} KB</dd><dt>Scan state</dt><dd>{selected.attributes.scan_state}</dd><dt>Version</dt><dd>{selected.attributes.current_version || 'Not available'}</dd></dl><div className="platform-form-actions"><Button variant="secondary" onClick={() => setSelected(null)}>Close</Button></div></section></div>}
  </>;
}

export function ProviderBusinessProfileReadDetails({ profile }: { profile: ProviderBusinessProfile }) {
  const address = profile.profile.address || {};
  return <div className="provider-business-profile-field-sections">
    <DetailSection title="Profile details" description="Review state and revision information for this provider profile."><dl className="platform-definition-list provider-profile-overview-list"><dt>Verification status</dt><dd><Status>{profile.verification_status}</Status></dd><dt>Profile revision</dt><dd>{profile.revision}</dd><dt>Submitted</dt><dd>{formatDate(profile.submitted_at)}</dd><dt>Verified</dt><dd>{formatDate(profile.verified_at)}</dd></dl></DetailSection>
    <DetailSection title="Business details" description="Registered identity and provider account information."><dl className="platform-definition-list provider-profile-overview-list"><dt>Legal name</dt><dd>{profile.profile.legal_name || 'Not supplied'}</dd><dt>Registration number</dt><dd>{profile.profile.registration_number || 'Not supplied'}</dd></dl></DetailSection>
    <DetailSection title="Business address" description="The canonical India address associated with this provider profile."><dl className="platform-definition-list provider-profile-overview-list"><dt>Address line</dt><dd>{address.address_line || 'Not supplied'}</dd><dt>Locality / area</dt><dd>{address.locality || 'Not supplied'}</dd><dt>State / UT</dt><dd>{address.state || 'Not supplied'}</dd><dt>District</dt><dd>{address.district || 'Not supplied'}</dd><dt>City</dt><dd>{address.city || 'Not supplied'}</dd><dt>PIN code</dt><dd>{address.pin_code || 'Not supplied'}</dd><dt>Landmark</dt><dd>{address.landmark || 'Not supplied'}</dd><dt>Country</dt><dd>{address.country || 'India'}</dd></dl></DetailSection>
    <DetailSection title="Indian tax registration" description="Indian tax identity values saved with this provider revision."><dl className="platform-definition-list provider-profile-overview-list"><dt>GSTIN</dt><dd>{profile.profile.gstin || 'Not supplied'}</dd><dt>PAN</dt><dd>{profile.profile.pan_number || 'Not supplied'}</dd><dt>Other tax identifier</dt><dd>{profile.profile.tax_identifier || 'Not supplied'}</dd></dl></DetailSection>
  </div>;
}

function ProviderBusinessProfileReadView({ profile, onUpdate }: { profile: ProviderBusinessProfile; onUpdate: () => void }) {
  return <div className="provider-business-read-stack">
    <div className="provider-business-tab-toolbar"><div><span className="platform-eyebrow">Business details</span><strong>Saved provider information</strong><p>Provider administrators can update this revision. Changes to a reviewed profile are submitted for review again.</p></div><div className="provider-business-tab-actions"><span className="status status-info">Provider administrator</span><Button onClick={onUpdate}><SvgIcon name="pencil" size={15} /> Update business details</Button></div></div>
    <ProviderBusinessProfileReadDetails profile={profile} />
  </div>;
}

export function ProviderBusinessProfilePage({ providerId, canViewSubscription = false, initialTab = 'overview' }: { providerId: string; canViewSubscription?: boolean; initialTab?: BusinessProfileTab }) {
  const [profile, setProfile] = useState<ProviderBusinessProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [documents, setDocuments] = useState<ProviderDocument[]>([]);
  const [fields, setFields] = useState<ProfileFields>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [documentSubmitting, setDocumentSubmitting] = useState('');
  const [tab, setTab] = useState<BusinessProfileTab>(canViewSubscription && initialTab === 'subscription' ? 'subscription' : 'overview');
  const [businessEditing, setBusinessEditing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const geography = useIndiaGeography(fields.address as Record<string, unknown>);

  async function load() {
    setLoading(true); setError('');
    try {
      const [current, history, documentResult] = await Promise.all([operationsData.providerBusinessProfile(providerId), operationsData.providerBusinessProfileReviews(providerId), operationsData.providerDocuments(providerId)]);
      setProfile(current.data); setFields({ ...emptyProfile, ...current.data.profile, address: { ...(current.data.profile.address || {}) } }); setReviews(history.data as Review[]); setDocuments(documentResult.data as ProviderDocument[]); setDirty(false); setBusinessEditing(false);
    } catch (cause) { setError(errorText(cause)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [providerId]);
  useEffect(() => { if (canViewSubscription && initialTab === 'subscription') setTab('subscription'); }, [canViewSubscription, initialTab]);

  function change(key: keyof ProfileFields, value: string) { setDirty(true); setFields((current) => ({ ...current, [key]: value })); }
  function changeAddress(key: string, value: string) { setDirty(true); setFields((current) => ({ ...current, address: { ...(current.address || {}), [key]: value } })); }
  function chooseAddressReference(key: 'state' | 'district' | 'city', id: string) {
    const options = key === 'state' ? geography.stateOptions : key === 'district' ? geography.districtOptions : geography.cityOptions;
    const selected = options.find((option) => option.id === id);
    setDirty(true); setFields((current) => ({ ...current, address: { ...(current.address || {}), [key]: selected?.label || '', [`${key}_code`]: selected?.id || '', ...(key === 'state' ? { district: '', district_code: '', city: '', city_code: '' } : key === 'district' ? { city: '', city_code: '' } : {}) } }));
    if (key === 'state') { geography.setDistrictSearch(''); geography.setCitySearch(''); }
    if (key === 'district') geography.setCitySearch('');
  }
  function validate() { if (!fields.legal_name?.trim()) return 'Legal name is required.'; if (!fields.address?.state?.trim()) return 'State is required.'; if (!fields.address?.district?.trim()) return 'District is required.'; if (!fields.address?.city?.trim()) return 'City is required.'; if (!/^[1-9]\d{5}$/.test(fields.address?.pin_code?.trim() || '')) return 'Enter a valid 6-digit Indian PIN code.'; return ''; }
  function draftPayload() {
    const address = { ...(fields.address || {}), country: 'India', country_code: 'IN', ...(geography.stateCode ? { state_code: geography.stateCode } : {}), ...(geography.districtCode ? { district_code: geography.districtCode } : {}), ...(geography.cityCode ? { city_code: geography.cityCode } : {}) };
    return { business_profile: { ...fields, address } };
  }
  async function persistDraft() {
    if (!profile) throw new Error('The current business profile is unavailable. Reload and try again.');
    const result = await operationsData.updateProviderBusinessProfile(providerId, { ...draftPayload(), expected_revision: profile.revision }, `provider-business-profile-${providerId}-${profile.revision}`);
    setProfile(result.data); setFields({ ...emptyProfile, ...result.data.profile, address: { ...(result.data.profile.address || {}) } }); setDirty(false);
    return result.data;
  }
  async function save(event: FormEvent) { event.preventDefault(); setError(''); setMessage(''); const validation = validate(); if (validation) { setError(validation); return; } if (!profile) return; setSaving(true); try { const previousStatus = profile.verification_status; const result = await persistDraft(); setBusinessEditing(false); setMessage(result.verification_status === 'NOT_SUBMITTED' && previousStatus === 'VERIFIED' ? 'Saved. This material change requires a new review.' : 'Business profile saved.'); } catch (cause) { setError(errorText(cause)); } finally { setSaving(false); } }
  async function submit() { setError(''); setMessage(''); const validation = validate(); if (validation) { setError(validation); return; } if (!profile) return; setSubmitting(true); try { const saved = dirty ? await persistDraft() : profile; await operationsData.submitProviderBusinessProfile(providerId, saved.revision, `provider-business-profile-submit-${providerId}-${saved.revision}`); await load(); setMessage('Submitted for platform review.'); } catch (cause) { setError(errorText(cause)); } finally { setSubmitting(false); } }
  async function submitDocument(document: ProviderDocument) { const versionId = documentVersionId(document); if (!versionId) return; setError(''); setMessage(''); setDocumentSubmitting(document.id); try { await operationsData.submitProviderDocumentReview(providerId, document.id, versionId, `provider-document-review-${document.id}-${versionId}`); await load(); setMessage('The exact document version was submitted for platform review.'); } catch (cause) { setError(errorText(cause)); } finally { setDocumentSubmitting(''); } }

  if (loading) return <StatePanel title="Loading business profile">Retrieving the authorized provider profile…</StatePanel>;
  if (error && !profile) return <StatePanel title="Business profile unavailable"><span>{error}</span><Button onClick={() => void load()}>Retry</Button></StatePanel>;
  if (!profile) return <StatePanel title="Business profile unavailable">No provider context is available for this screen.</StatePanel>;
  // A pending revision is read-only until the Provider Administrator explicitly
  // enters edit mode. The API then resets a changed revision to NOT_SUBMITTED
  // so it can be submitted again for review.
  const locked = profile.verification_status === 'PENDING_REVIEW' && !businessEditing;
  const pendingReview = profile.verification_status === 'PENDING_REVIEW';
  const address = profile.profile.address || {};
  const businessLocation = [address.city, address.district, address.state, address.pin_code].filter(Boolean).join(', ') || 'Not supplied';
  const reviewActivities = reviews.flatMap((review) => [
    { at: review.attributes.reviewed_at || '', by: 'Platform reviewer', event: `Review ${review.attributes.status.replaceAll('_', ' ').toLowerCase()}` },
    { at: review.attributes.submitted_at || '', by: 'Provider administrator', event: `Submitted ${review.attributes.review_kind === 'BUSINESS_PROFILE' ? 'business profile' : 'document version'}` },
  ]).filter((item) => item.at).sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
  const latestActivity = reviewActivities[0] || (profile.verified_at ? { at: profile.verified_at, by: 'Platform reviewer', event: 'Profile verified' } : profile.submitted_at ? { at: profile.submitted_at, by: 'Provider administrator', event: 'Profile submitted' } : { at: '', by: 'Not available', event: 'No review activity yet' });
  return <section className="platform-page provider-business-profile-page">
    <PageHeader eyebrow="Provider administration" title="Business profile" description="Manage provider identity, verification records, subscription terms, and related activity." action={tab !== 'subscription' ? <Button onClick={() => void submit()} disabled={pendingReview && !dirty || submitting || saving}>{submitting ? 'Saving and submitting…' : pendingReview && !dirty ? 'Awaiting review' : 'Submit for review'}</Button> : undefined} />
    <div className="provider-profile-identity-banner">
      <div className="provider-profile-identity-main"><span className="provider-profile-identity-icon" aria-hidden="true"><SvgIcon name="building" size={22} /></span><div><span className="platform-eyebrow">Provider identity</span><h2>{fields.legal_name || 'Complete business identity'}</h2><p>{fields.address?.city && fields.address?.state ? `${fields.address.city}, ${fields.address.state}` : 'India provider account · Address not completed'}</p></div></div>
      <div className="provider-profile-identity-status"><Status>{profile.verification_status}</Status><small>Profile revision {profile.revision}</small></div>
    </div>
    {(error || message) && <div className="provider-profile-feedback">{error && <StatePanel title="Business profile action needs attention"><span>{error}</span></StatePanel>}{message && <p className="platform-form-note" role="status">{message}</p>}</div>}
    <div className="provider-profile-tabs" role="tablist" aria-label="Business profile sections">
      <button type="button" role="tab" aria-selected={tab === 'overview'} className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><SvgIcon name="activity" size={16} /><span>Overview</span></button>
      <button type="button" role="tab" aria-selected={tab === 'business'} className={tab === 'business' ? 'active' : ''} onClick={() => setTab('business')}><SvgIcon name="building" size={16} /><span>Business details</span></button>
      <button type="button" role="tab" aria-selected={tab === 'contacts'} className={tab === 'contacts' ? 'active' : ''} onClick={() => setTab('contacts')}><SvgIcon name="users" size={16} /><span>Contacts &amp; locations</span></button>
      <button type="button" role="tab" aria-selected={tab === 'assets'} className={tab === 'assets' ? 'active' : ''} onClick={() => setTab('assets')}><SvgIcon name="grid" size={16} /><span>Assets &amp; documents</span><small>{documents.length}</small></button>
      {canViewSubscription && <button type="button" role="tab" aria-selected={tab === 'subscription'} className={tab === 'subscription' ? 'active' : ''} onClick={() => setTab('subscription')}><SvgIcon name="clipboard" size={16} /><span>Subscription &amp; activity</span></button>}
    </div>
    {tab === 'overview' && <><ProviderLogoEditor providerId={providerId} /><div className="provider-profile-overview">
      <DetailSection title="Profile overview" description="Business Profile is the single source for provider identity, address, and Indian tax registration."><dl className="platform-definition-list provider-profile-overview-list"><dt>Legal name</dt><dd>{profile.profile.legal_name || 'Not supplied'}</dd><dt>Operating location</dt><dd>{businessLocation}</dd><dt>Provider revision</dt><dd>{profile.revision}</dd><dt>Document library</dt><dd>{documents.length} {documents.length === 1 ? 'private asset' : 'private assets'}</dd></dl><div className="provider-profile-overview-actions"><Button variant="secondary" onClick={() => setTab('business')}><SvgIcon name="building" size={14} /> View business details</Button><Button variant="secondary" onClick={() => setTab('assets')}><SvgIcon name="grid" size={14} /> Open assets &amp; documents</Button></div></DetailSection>
      <DetailSection title="Verification & activity" description="Review state and the latest recorded activity for this profile."><dl className="platform-definition-list provider-profile-overview-list"><dt>Verification status</dt><dd><Status>{profile.verification_status}</Status></dd><dt>Profile revision</dt><dd>{profile.revision}</dd><dt>Review history</dt><dd><strong className="provider-profile-review-count">{reviews.length}</strong> {reviews.length === 1 ? 'record' : 'records'}</dd><dt>Last activity</dt><dd>{formatDate(latestActivity.at)}</dd><dt>Activity</dt><dd>{latestActivity.event}</dd><dt>Activity by</dt><dd>{latestActivity.by}</dd><dt>Submitted</dt><dd>{formatDate(profile.submitted_at)}</dd><dt>Verified</dt><dd>{formatDate(profile.verified_at)}</dd></dl>{dirty && <p className="platform-form-note">Current form edits will be saved automatically when you submit for review.</p>}{profile.verification_status === 'CORRECTIONS_REQUESTED' && <p className="platform-form-note">Corrections were requested. Update the fields below and resubmit the new revision.</p>}{profile.verification_status === 'REJECTED' && <p className="platform-form-note">The last submission was rejected. Review the reason below, correct the profile, and resubmit.</p>}</DetailSection>
    </div></>}
    {tab === 'business' && (businessEditing ? <form className="platform-form-card platform-form provider-profile-form" onSubmit={save}>
      <div className="platform-form-section"><h2>Business details</h2><p className="platform-muted">Use the registered or operating information your platform reviewer can verify.</p><label className="admin-form-field--full">Legal name <span aria-hidden="true">*</span><input value={fields.legal_name || ''} onChange={(event) => change('legal_name', event.target.value)} maxLength={200} disabled={locked} autoComplete="organization" /></label><label>Registration number <span className="platform-muted">(optional)</span><input value={fields.registration_number || ''} onChange={(event) => change('registration_number', event.target.value)} maxLength={100} disabled={locked} /></label></div>
      <div className="platform-form-section"><h2>Business address</h2><p className="platform-form-note">India-only address. State/UT, district, and city use canonical platform reference data. Address lines, locality, landmark, and PIN remain provider-entered because they describe the exact premises.</p><div className="platform-form-grid"><label className="admin-form-field--full">Address line<input value={String(fields.address?.address_line || '')} onChange={(event) => changeAddress('address_line', event.target.value)} inputMode="text" maxLength={200} disabled={locked} /></label><label>Locality / area<input value={String(fields.address?.locality || '')} onChange={(event) => changeAddress('locality', event.target.value)} maxLength={200} disabled={locked} /></label><SearchableSelect label="State / UT" searchLabel="Search Indian states and UTs" search={geography.stateSearch} onSearch={geography.setStateSearch} value={geography.stateCode} onChange={(id) => chooseAddressReference('state', id)} options={geography.stateOptions} placeholder="Select state / UT" required disabled={locked} /><SearchableSelect label="District" searchLabel="Search districts in selected state" search={geography.districtSearch} onSearch={geography.setDistrictSearch} value={geography.districtCode} onChange={(id) => chooseAddressReference('district', id)} options={geography.districtOptions} placeholder="Select district" required disabled={!geography.stateCode || locked} /><SearchableSelect label="City" searchLabel="Search cities in selected district" onSearch={geography.setCitySearch} search={geography.citySearch} value={geography.cityCode} onChange={(id) => chooseAddressReference('city', id)} options={geography.cityOptions} placeholder="Select city" required disabled={!geography.districtCode || locked} /><label>PIN code <span aria-hidden="true">*</span><input value={String(fields.address?.pin_code || '')} onChange={(event) => changeAddress('pin_code', event.target.value)} inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} disabled={locked} /></label><label>Landmark<input value={String(fields.address?.landmark || '')} onChange={(event) => changeAddress('landmark', event.target.value)} maxLength={200} disabled={locked} /></label><label>Country<select value="IN" disabled><option value="IN">India</option></select></label></div></div>
      <div className="platform-form-section"><h2>Indian tax registration</h2><p className="platform-muted">Capture GSTIN, PAN, and any other tax identifier when they apply to this provider. Supporting documents are reviewed as separate private document versions.</p><label>GSTIN <span className="platform-muted">(when applicable)</span><input value={fields.gstin || ''} onChange={(event) => change('gstin', event.target.value.toUpperCase())} maxLength={15} pattern="[0-9A-Z]{15}" disabled={locked} /></label><label>PAN <span className="platform-muted">(when applicable)</span><input value={fields.pan_number || ''} onChange={(event) => change('pan_number', event.target.value.toUpperCase())} maxLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" disabled={locked} /></label><label>Other tax identifier <span className="platform-muted">(optional)</span><input value={fields.tax_identifier || ''} onChange={(event) => change('tax_identifier', event.target.value)} maxLength={100} disabled={locked} /></label></div>
      <div className="platform-form-actions"><Button type="button" variant="quiet" onClick={() => void load()} disabled={saving || submitting}>Reload current revision</Button><Button type="submit" disabled={locked || saving || submitting}>{saving ? 'Saving…' : 'Save business profile'}</Button></div>
    </form> : <ProviderBusinessProfileReadView profile={profile} onUpdate={() => { setError(''); setMessage(''); setBusinessEditing(true); }} />)}
    {tab === 'contacts' && <ProviderContactLocationDetails providerId={providerId} />}
    {tab === 'assets' && <><ProviderAssetGallery providerId={providerId} documents={documents} reviews={reviews} documentSubmitting={documentSubmitting} onSubmitDocument={(document) => void submitDocument(document)} /><DetailSection title="Upload provider documents" description="Provider administrators can add private business-verification evidence. Files are validated before upload, versioned, and kept provider-scoped."><ProviderDocumentsStep providerId={providerId} scope="provider" canUpload showUploadHeading={false} showDocumentList={false} onChanged={() => void load()} /></DetailSection></>}
    {tab === 'subscription' && canViewSubscription && <ProviderSubscriptionPage providerId={providerId} embedded />}
  </section>;
}
