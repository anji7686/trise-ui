import { useEffect, useRef, useState } from 'react';
import { Button, DetailSection, StatePanel, Status } from '@trise/ui';
import { operationsData, type DocumentTransfer, type ProviderDocument } from './data';
import { SvgIcon } from './icons';
import { humanFileSize, PROVIDER_DOCUMENT_MAX_BYTES, PROVIDER_DOCUMENT_MEDIA_TYPES, providerDocumentFileError, sha256Hex } from './provider-document-upload';

type PendingUpload = {
  file: File;
  checksum: string;
  requestKey: string;
  documentId: string;
  versionId: string;
  transfer: DocumentTransfer;
  uploaded: boolean;
};

function uploadFailure(response: Response): Error {
  if (response.status === 403) return new Error('Private storage denied this upload. Request a new upload or ask an operator to verify the scoped storage permissions.');
  if (response.status === 400) return new Error('Private storage rejected the signed upload headers or file metadata.');
  return new Error(`Private storage rejected the upload (HTTP ${response.status}).`);
}

export function ProviderDocumentsStep({ providerId, canUpload, onChanged, showDocumentList = true }: { providerId: string; canUpload: boolean; onChanged?: () => void | Promise<void>; showDocumentList?: boolean }) {
  const [documents, setDocuments] = useState<ProviderDocument[]>([]);
  const [selected, setSelected] = useState<File | null>(null);
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);

  async function load() {
    setLoading(true);
    try {
      const result = await operationsData.platformDocuments(providerId);
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
        const created = await operationsData.createPlatformDocument(providerId, {
          filename: selected.name,
          media_type: selected.type.toLowerCase(),
          size_bytes: selected.size,
          checksum,
          classification: 'BUSINESS_VERIFICATION',
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
      await operationsData.finalizePlatformDocument(providerId, target.documentId, { version_id: target.versionId, checksum, size_bytes: selected.size }, `${target.requestKey}-finalize`);
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
    {canUpload ? <DetailSection title="Upload business verification evidence" description="Files remain private and provider-scoped. Accepted files receive no malware scan under the current platform policy.">
      <div className="provider-document-upload">
        <input ref={input} className="logo-file-input" type="file" accept={PROVIDER_DOCUMENT_MEDIA_TYPES.join(',')} onChange={(event) => { choose(event.target.files?.[0] || null); event.currentTarget.value = ''; }} disabled={busy} />
        <button className="provider-document-dropzone" type="button" onClick={() => input.current?.click()} disabled={busy}>
          <span className="platform-summary-icon"><SvgIcon name="upload" size={20} /></span>
          <strong>{selected ? selected.name : 'Choose a private document'}</strong>
          <span>{selected ? `${selected.type} · ${humanFileSize(selected.size)}` : 'PDF, PNG, JPEG, or WebP · maximum 25 MiB'}</span>
        </button>
        <dl className="platform-definition-list provider-document-policy"><dt>Classification</dt><dd>Business verification</dd><dt>Visibility</dt><dd>Internal</dd><dt>Malware scan</dt><dd>Disabled by platform policy</dd></dl>
        <div className="platform-form-actions"><Button type="button" variant="secondary" onClick={() => input.current?.click()} disabled={busy}>{selected ? 'Choose another file' : 'Browse files'}</Button><Button type="button" onClick={() => void upload()} disabled={!selected || busy} busy={busy}>{pending?.uploaded ? 'Retry finalization' : 'Upload document'}</Button></div>
      </div>
      {message && <p className="platform-form-note" role="status">{message}</p>}
      {error && <StatePanel title="Document action needs attention"><span>{error}</span>{selected && <Button variant="secondary" onClick={() => void upload()} disabled={busy}>{pending?.uploaded ? 'Retry finalization' : 'Retry upload'}</Button>}</StatePanel>}
    </DetailSection> : <StatePanel title="Document upload is restricted"><span>Your authenticated platform grant permits document metadata access but not provider document uploads.</span></StatePanel>}
    {showDocumentList && <DetailSection title="Provider documents" description="Only authorized metadata is shown. Storage keys and unrestricted URLs are never exposed.">
      {loading ? <p className="platform-muted">Loading provider documents…</p> : documents.length ? <div className="platform-provider-table-wrap"><table className="platform-provider-table"><caption className="sr-only">Private provider documents</caption><thead><tr><th scope="col">Document</th><th scope="col">Classification</th><th scope="col">Size</th><th scope="col">Version</th><th scope="col">Lifecycle</th><th scope="col">Scan policy</th></tr></thead><tbody>{documents.map((document) => <tr key={document.id}><td><strong>{document.attributes.filename}</strong><small>{document.attributes.media_type}</small></td><td>{document.attributes.classification.replaceAll('_', ' ')}</td><td>{humanFileSize(document.attributes.size_bytes)}</td><td>{document.attributes.current_version || 'Pending'}</td><td><Status>{document.attributes.status.replaceAll('_', ' ')}</Status></td><td><Status>{document.attributes.scan_state === 'not_scanned' ? 'Not scanned — platform policy' : document.attributes.scan_state.replaceAll('_', ' ')}</Status>{document.attributes.scan_recorded_at && <small>{new Date(document.attributes.scan_recorded_at).toLocaleString()}</small>}</td></tr>)}</tbody></table></div> : <p className="platform-empty-inline">No provider documents have been uploaded.</p>}
      <p className="platform-form-note">Use Preview to inspect supported files after fresh authorization. Downloads remain separately authorized and are forced as attachments.</p>
    </DetailSection>}
  </>;
}

export { PROVIDER_DOCUMENT_MAX_BYTES };
