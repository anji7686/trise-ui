import { useEffect, useRef, useState } from 'react';
import { Button, DetailSection, StatePanel } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { operationsData, type DocumentTransfer, type ProviderDocument } from './data';
import { SvgIcon } from './icons';
import { humanFileSize, PROVIDER_DOCUMENT_MAX_BYTES, PROVIDER_DOCUMENT_MEDIA_TYPES, providerDocumentFileError, sha256Hex } from './provider-document-upload';
import { formatIndiaDateTime } from './subscription-support';
import { ProviderActionMenu } from './operations-shared';

type PendingUpload = {
  file: File;
  checksum: string;
  requestKey: string;
  documentId: string;
  versionId: string;
  transfer: DocumentTransfer;
  uploaded: boolean;
};
type ReplaceableDocument = { id: string; attributes: { filename: string; media_type: string; size_bytes: number; classification: string; status: string; current_version_id?: string | null; revision: number } };

function uploadFailure(response: Response): Error {
  if (response.status === 403) return new Error('Private storage denied this upload. Request a new upload or ask an operator to verify the scoped storage permissions.');
  if (response.status === 400) return new Error('Private storage rejected the signed upload headers or file metadata.');
  return new Error(`Private storage rejected the upload (HTTP ${response.status}).`);
}

export function ProviderDocumentsStep({ providerId, canUpload, onChanged, showDocumentList = true, scope = 'platform', showUploadHeading = true, initialClassification = 'BUSINESS_VERIFICATION', replaceDocument }: { providerId: string; canUpload: boolean; onChanged?: () => void | Promise<void>; showDocumentList?: boolean; scope?: 'platform' | 'provider' | 'business'; showUploadHeading?: boolean; initialClassification?: string; replaceDocument?: ReplaceableDocument }) {
  const [documents, setDocuments] = useState<ProviderDocument[]>([]);
  const [selected, setSelected] = useState<File | null>(null);
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [classification, setClassification] = useState(initialClassification);
  const [otherClassification, setOtherClassification] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);

  async function openDocument(document: ProviderDocument, disposition: 'inline' | 'attachment') {
    if (!document.attributes.current_version_id) return;
    setError('');
    try {
      const transfer = scope === 'business'
        ? await operationsData.authorizePlatformBusinessDocumentDownload(providerId, document.id, document.attributes.current_version_id, crypto.randomUUID(), disposition)
        : scope === 'provider'
        ? await operationsData.authorizeProviderDocumentDownload(providerId, document.id, document.attributes.current_version_id, crypto.randomUUID(), disposition)
        : await operationsData.authorizePlatformDocumentDownload(providerId, document.id, document.attributes.current_version_id, crypto.randomUUID(), disposition);
      const anchor = window.document.createElement('a');
      anchor.href = transfer.url;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
      if (disposition === 'attachment') anchor.download = document.attributes.filename;
      anchor.click();
    } catch (cause) {
      setError((cause as { message?: string })?.message || 'The private document transfer could not be authorized.');
    }
  }

  async function load() {
    setLoading(true);
    try {
      const result = scope === 'business' ? await operationsData.platformBusinessDocuments(providerId) : scope === 'provider' ? await operationsData.providerDocuments(providerId) : await operationsData.platformDocuments(providerId);
      setDocuments(result.data as ProviderDocument[]);
    } catch (cause) {
      setError((cause as { message?: string })?.message || 'Provider documents could not be loaded.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [providerId]);

  function choose(file: File | null) {
    setError(''); setMessage(''); setPending(null);
    if (!file) { setSelected(null); return; }
    const validation = providerDocumentFileError(file);
    if (validation) { setSelected(null); setError(validation); return; }
    setSelected(file);
  }

  async function upload() {
    if (!selected || inFlight.current) return;
    const validation = providerDocumentFileError(selected);
    if (validation) { setError(validation); return; }
    inFlight.current = true; setBusy(true); setError('');
    try {
      const checksum = pending?.file === selected ? pending.checksum : await sha256Hex(selected);
      let target = pending?.file === selected ? pending : null;
      if (!target || new Date(target.transfer.expires_at).getTime() <= Date.now()) {
        const requestKey = crypto.randomUUID();
        setMessage('Preparing an authorization-scoped private upload…');
        const created = scope === 'business' && replaceDocument ? await operationsData.createPlatformBusinessDocumentVersion(providerId, replaceDocument.id, {
          filename: selected.name, media_type: selected.type.toLowerCase(), size_bytes: selected.size, checksum,
          expected_revision: replaceDocument.attributes.revision
        }, requestKey) : scope === 'business' ? await operationsData.createPlatformBusinessDocument(providerId, {
          filename: selected.name, media_type: selected.type.toLowerCase(), size_bytes: selected.size, checksum,
          classification: classification === 'OTHER' ? otherClassification.trim() : classification, visibility: 'internal'
        }, requestKey) : await (scope === 'provider' ? operationsData.createProviderDocument : operationsData.createPlatformDocument)(providerId, {
          filename: selected.name,
          media_type: selected.type.toLowerCase(),
          size_bytes: selected.size,
          checksum,
          classification: classification === 'OTHER' ? otherClassification.trim() : classification,
          owner: { type: 'SERVICE_PROVIDER', id: providerId },
          source: { type: 'SERVICE_PROVIDER', id: providerId },
          visibility: 'internal'
        }, requestKey);
        target = { file: selected, checksum, requestKey, documentId: created.document.id, versionId: created.version.id, transfer: created.transfer, uploaded: false };
        setPending(target);
      }
      if (!target.uploaded) {
        setMessage('Uploading to private storage…');
        const response = await fetch(target.transfer.url, { method: target.transfer.method, headers: target.transfer.headers, body: selected, mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw uploadFailure(response);
        target = { ...target, uploaded: true };
        setPending(target);
      }
        setMessage('Verifying checksum, size, media type, and exact document version…');
      if (scope === 'business') await operationsData.finalizePlatformBusinessDocument(providerId, target.documentId, { version_id: target.versionId, checksum, size_bytes: selected.size }, `${target.requestKey}-finalize`);
      else if (scope === 'provider') await operationsData.finalizeProviderDocument(providerId, target.documentId, { version_id: target.versionId, checksum, size_bytes: selected.size }, `${target.requestKey}-finalize`);
      else await operationsData.finalizePlatformDocument(providerId, target.documentId, { version_id: target.versionId, checksum, size_bytes: selected.size }, `${target.requestKey}-finalize`);
      setSelected(null); setPending(null); await load(); await onChanged?.();
      setMessage('Document finalized in private storage. Malware scanning is disabled by platform policy; this file is explicitly recorded as not scanned.');
    } catch (cause) {
      const failure = cause as { message?: string; name?: string };
      setMessage('');
      setError(failure.name === 'TypeError' && failure.message === 'Failed to fetch'
        ? 'The browser could not reach private object storage. Check the private storage endpoint and CORS policy for this Operations origin.'
        : failure.message || 'The private document upload could not be completed. Retry will preserve the current upload stage when possible.');
    } finally {
      inFlight.current = false; setBusy(false);
    }
  }

  return <>
    {canUpload ? <>{showUploadHeading ? <DetailSection title={replaceDocument ? `Replace ${replaceDocument.attributes.filename}` : 'Upload document'} description={scope === 'business' ? 'Files remain private and Business-owned. Replacement creates a new immutable version while preserving prior versions and audit history.' : 'Files remain private and provider-scoped. New files are versioned and remain subject to evidence controls.'}><UploadBody /></DetailSection> : <UploadBody />}</> : <StatePanel title="Document upload is restricted"><span>Your authenticated platform grant permits document metadata access but not provider document uploads.</span></StatePanel>}
    {showDocumentList && <DetailSection title="Provider documents" description="Only authorized metadata is shown. Storage keys and unrestricted URLs are never exposed.">
      {loading ? <p className="platform-muted">Loading {scope === 'business' ? 'Business' : 'provider'} documents…</p> : documents.length ? <div className="platform-provider-table-wrap"><table className="platform-provider-table"><caption className="sr-only">Private {scope === 'business' ? 'Business' : 'provider'} documents</caption><thead><tr><th scope="col">Document</th><th scope="col">Classification</th><th scope="col">Size</th><th scope="col">Version</th><th scope="col">Lifecycle</th><th scope="col">Scan state</th><th scope="col">Actions</th></tr></thead><tbody>{documents.map((document) => <tr key={document.id}><td><strong>{document.attributes.filename}</strong><small>{document.attributes.media_type}</small></td><td>{document.attributes.classification.replaceAll('_', ' ')}</td><td>{humanFileSize(document.attributes.size_bytes)}</td><td>{document.attributes.current_version || 'Pending'}</td><td><Status>{document.attributes.status.replaceAll('_', ' ')}</Status></td><td><Status>{document.attributes.scan_state.replaceAll('_', ' ')}</Status>{document.attributes.scan_recorded_at && <small>{formatIndiaDateTime(document.attributes.scan_recorded_at)}</small>}</td><td><ProviderActionMenu label={`Actions for ${document.attributes.filename}`} actions={[{ id: 'preview', label: 'Preview document', disabled: !document.attributes.current_version_id, onSelect: () => void openDocument(document, 'inline') }, { id: 'download', label: 'Download document', disabled: !document.attributes.current_version_id, onSelect: () => void openDocument(document, 'attachment') }]} /></td></tr>)}</tbody></table></div> : <p className="platform-empty-inline">No {scope === 'business' ? 'Business' : 'provider'} documents have been uploaded.</p>}
      <p className="platform-form-note">Preview and download each require a fresh, authorization-scoped transfer. Storage keys are never exposed to the browser.</p>
    </DetailSection>}
  </>;
  function UploadBody() { return <div className="provider-document-upload">
        <input ref={input} className="logo-file-input" type="file" accept={PROVIDER_DOCUMENT_MEDIA_TYPES.join(',')} onChange={(event) => { choose(event.target.files?.[0] || null); event.currentTarget.value = ''; }} disabled={busy} />
        <label>Document type / scope<select required value={classification} onChange={(event) => { setClassification(event.target.value); setOtherClassification(''); }} disabled={busy}>{scope === 'business' ? <><option value="BUSINESS_VERIFICATION">Corporate / legal identity</option><option value="BUSINESS_LOGO">Business logo</option><option value="GST_CERTIFICATE">GST registration</option><option value="BUSINESS_LICENCE">Business licence</option><option value="REGISTRATION_EVIDENCE">Company / registration evidence</option><option value="BRAND_TRADEMARK">Brand / trademark</option><option value="GENERAL_SUPPORTING_EVIDENCE">Other supporting evidence</option></> : <><option value="BUSINESS_VERIFICATION">Business verification</option><option value="GST_CERTIFICATE">GST certificate</option><option value="BUSINESS_LICENCE">Business licence</option><option value="REGISTRATION_EVIDENCE">Registration evidence</option><option value="BRAND_TRADEMARK">Brand or trademark</option><option value="GENERAL_SUPPORTING_EVIDENCE">General supporting evidence</option></>}<option value="OTHER">Other</option></select></label>{classification === 'OTHER' && <label>Specify document type<input required value={otherClassification} onChange={(event) => setOtherClassification(event.target.value)} disabled={busy} maxLength={120} /></label>}
        <button className="provider-document-dropzone" type="button" onClick={() => input.current?.click()} disabled={busy}><span className="platform-summary-icon"><SvgIcon name="upload" size={20} /></span><strong>{selected ? selected.name : 'Choose a private document'}</strong><span>{selected ? `${selected.type} · ${humanFileSize(selected.size)}` : 'PDF, PNG, JPEG, or WebP · maximum 25 MiB'}</span></button>
        <dl className="platform-definition-list provider-document-policy"><dt>Classification</dt><dd>{classification === 'OTHER' ? otherClassification || 'Specify document type' : classification.replaceAll('_', ' ')}</dd><dt>Visibility</dt><dd>Internal</dd><dt>Scan state</dt><dd>Shown from the authoritative document version</dd></dl>
        <div className="platform-form-actions"><Button type="button" variant="secondary" onClick={() => input.current?.click()} disabled={busy}>{selected ? 'Choose another file' : 'Browse files'}</Button><Button type="button" onClick={() => void upload()} disabled={!selected || busy || (classification === 'OTHER' && !otherClassification.trim())} busy={busy}>{pending?.uploaded ? 'Retry finalization' : 'Upload document'}</Button></div>
      {message && <p className="platform-form-note" role="status">{message}</p>}{error && <StatePanel title="Document action needs attention"><span>{error}</span>{selected && <Button variant="secondary" onClick={() => void upload()} disabled={busy}>{pending?.uploaded ? 'Retry finalization' : 'Retry upload'}</Button>}</StatePanel>}
      </div>; }
}

export { PROVIDER_DOCUMENT_MAX_BYTES };
