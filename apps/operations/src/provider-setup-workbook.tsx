import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button, DetailSection, StatePanel, SortedSelect } from '@trise/ui';
import { operationsData, type BusinessOperation, type ProviderOnboardingContactAttributes, type ProviderOperation, type Resource } from './data';
import { SvgIcon } from './icons';
import './operations-pages.css';

type Contact = Resource<ProviderOnboardingContactAttributes>;
type Validation = { valid: boolean; errors: Array<{ sheet: string; field: string; message: string }>; warnings: Array<{ sheet: string; field: string; message: string }>; operation_name: string; expected_revision: number; summary: { profile_fields: number; contacts: number; locations: number; elevator_profile_selections?: number; configuration_types?: number; configuration_masters?: number }; preview: { legal_name?: string | null; registration_number?: string | null; gstin?: string | null; pan_number?: string | null; address: string; contacts: Array<{ name?: string; responsibility?: string }>; locations: Array<{ name?: string; city?: string; kind?: string }>; elevator_profile?: Record<string, string[]>; configuration_types?: string[]; configuration_masters?: number } };
const errorText = (error: unknown) => (error as { message?: string })?.message || 'The setup workbook action could not be completed.';

async function encodeWorkbook(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  return btoa(binary);
}

export function ProviderSetupWorkbook({ providerId, operationCode, providerStatus, verificationStatus, canChangeOperation = false, revision, canManage, canDownload = canManage, onImported, onConfigureOperation, platformMode = false, platformContacts }: { providerId: string; operationCode: string; providerStatus?: string; verificationStatus?: string; canChangeOperation?: boolean; revision: number; canManage: boolean; canDownload?: boolean; onImported: () => void | Promise<void>; onConfigureOperation?: () => void; platformMode?: boolean; platformContacts?: Contact[] }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientMode, setRecipientMode] = useState<'contact' | 'email'>('contact');
  const [file, setFile] = useState<File | null>(null);
  const [encoded, setEncoded] = useState('');
  const [validation, setValidation] = useState<Validation | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmImport, setConfirmImport] = useState(false);
  const [imported, setImported] = useState(false);
  const [operationCatalog, setOperationCatalog] = useState<BusinessOperation[]>([]);
  const [selectedOperationId, setSelectedOperationId] = useState('');
  const [linkedOperation, setLinkedOperation] = useState<ProviderOperation['attributes']['business_operation'] | null>(null);
  const [operationRevision, setOperationRevision] = useState(0);
  const [operationBusy, setOperationBusy] = useState(false);
  const [operationError, setOperationError] = useState('');
  const [operationMessage, setOperationMessage] = useState('');
  const [selectedOperationCode, setSelectedOperationCode] = useState(operationCode);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let current = true;
    if (platformMode) { if (platformContacts) setContacts(platformContacts.filter((entry) => entry.attributes.status === 'ACTIVE' && !!entry.attributes.contact_methods?.email)); return () => { current = false; }; }
    operationsData.providerOnboardingContacts(providerId, undefined, 100)
      .then((result) => { if (current) setContacts((result.data as Contact[]).filter((entry) => entry.attributes.status === 'ACTIVE' && !!entry.attributes.contact_methods?.email)); })
      .catch(() => { if (current) setContacts([]); });
    return () => { current = false; };
  }, [providerId, platformMode, platformContacts]);

  useEffect(() => {
    if (!platformMode) return;
    let current = true;
    void Promise.all([operationsData.businessOperations(), operationsData.platformProviderOperations(providerId)])
      .then(([catalog, configured]) => {
        if (!current) return;
        const activeCatalog = catalog.data.filter((item) => item.attributes.is_active && item.attributes.is_selectable);
        const active = configured.data.find((row) => row.attributes.status === 'ACTIVE' && row.attributes.is_primary) || null;
        setOperationCatalog(activeCatalog);
        setLinkedOperation(active?.attributes.business_operation || null);
        setSelectedOperationId(active?.attributes.business_operation.id || '');
        setSelectedOperationCode(active?.attributes.business_operation.code || '');
        setOperationRevision(configured.revision);
      })
      .catch((cause) => { if (current) setOperationError(errorText(cause)); });
    return () => { current = false; };
  }, [providerId, platformMode]);

  async function download() {
    setBusy('download'); setError(''); setMessage('');
    try {
      const blob = platformMode ? await operationsData.platformProviderSetupWorkbook(providerId) : await operationsData.providerSetupWorkbook(providerId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'trise-provider-setup.xlsx'; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setMessage('The workbook is ready. Complete the highlighted Value cells and upload documents separately.');
    } catch (cause) { setError(errorText(cause)); } finally { setBusy(''); }
  }

  async function emailWorkbook() {
    if (recipientMode === 'contact' ? !contactId : !recipientEmail.trim()) return;
    setBusy('email'); setError(''); setMessage('');
    try {
      const result = platformMode
        ? await operationsData.emailPlatformProviderSetupWorkbook(providerId, recipientMode === 'contact' ? { contact_id: contactId } : { email: recipientEmail.trim() }, 'platform-setup-workbook-email-' + crypto.randomUUID())
        : await operationsData.emailProviderSetupWorkbook(providerId, contactId, 'provider-setup-workbook-email-' + crypto.randomUUID());
      setMessage(result.data.message);
    } catch (cause) { setError(errorText(cause)); } finally { setBusy(''); }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0] || null;
    setError(''); setMessage(''); setValidation(null); setConfirmImport(false); setImported(false); setEncoded(''); setFile(null);
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith('.xlsx')) { setError('Choose the .xlsx setup workbook.'); event.currentTarget.value = ''; return; }
    if (selected.size > 5 * 1024 * 1024) { setError('The workbook must be 5 MiB or smaller.'); event.currentTarget.value = ''; return; }
    try { setFile(selected); setEncoded(await encodeWorkbook(selected)); }
    catch { setError('The workbook could not be read. Choose it again and retry.'); }
  }

  async function validateWorkbook() {
    if (!encoded) return;
    setBusy('validate'); setError(''); setMessage(''); setValidation(null); setConfirmImport(false);
    try { const result = platformMode ? await operationsData.validatePlatformProviderSetupWorkbook(providerId, encoded, revision) : await operationsData.validateProviderSetupWorkbook(providerId, encoded, revision); setValidation(result.data); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(''); }
  }

  async function importWorkbook() {
    if (!encoded || !validation?.valid) return;
    setBusy('import'); setError(''); setMessage('');
    try {
      const result = platformMode
        ? await operationsData.importPlatformProviderSetupWorkbook(providerId, encoded, revision, 'platform-setup-workbook-import-' + crypto.randomUUID())
        : await operationsData.importProviderSetupWorkbook(providerId, encoded, revision, 'provider-setup-workbook-import-' + crypto.randomUUID());
      setMessage(result.data.next_action + ' Profile revision ' + result.data.revision + '; ' + result.data.contacts_added + ' contacts and ' + result.data.locations_added + ' locations added.');
      setFile(null); setEncoded(''); setValidation(null); setConfirmImport(false); setImported(true); if (input.current) input.current.value = '';
      await onImported();
    } catch (cause) { setError(errorText(cause)); setValidation(null); setConfirmImport(false); }
    finally { setBusy(''); }
  }

  async function saveBusinessOperation() {
    if (!selectedOperationId || !canChangeOperation) return;
    setOperationBusy(true); setOperationError(''); setOperationMessage('');
    try {
      const result = await operationsData.replacePlatformProviderOperations(providerId, {
        expected_revision: operationRevision,
        operations: [{ business_operation_type_id: selectedOperationId, is_primary: true }],
      }, `setup-workbook-operation-${providerId}-${operationRevision}`);
      const saved = result.data.find((row) => row.attributes.status === 'ACTIVE' && row.attributes.is_primary);
      if (!saved) throw new Error('The Business Operation was not assigned. Reload and try again.');
      setLinkedOperation(saved.attributes.business_operation);
      setSelectedOperationId(saved.attributes.business_operation.id);
      setSelectedOperationCode(saved.attributes.business_operation.code);
      setOperationRevision(result.revision);
      setOperationMessage('Business Operation saved. You can now download or email the matching workbook.');
      setFile(null); setEncoded(''); setValidation(null); setConfirmImport(false); setImported(false);
      if (input.current) input.current.value = '';
    } catch (cause) { setOperationError(errorText(cause)); }
    finally { setOperationBusy(false); }
  }

  const canAssignOperation = canChangeOperation && !linkedOperation && ['ACTIVE', 'PENDING', 'PENDING_ACTIVATION'].includes(providerStatus || '');
  const canReplaceOperation = canChangeOperation && !!linkedOperation && ['PENDING', 'PENDING_ACTIVATION'].includes(providerStatus || '') && verificationStatus !== 'PENDING_REVIEW';
  const operationEditable = canAssignOperation || canReplaceOperation;
  const operationSaved = !platformMode || (!!linkedOperation && selectedOperationId === linkedOperation.id);

  if (!(platformMode ? selectedOperationCode : operationCode)) return <DetailSection title="Provider setup workbook" description="Choose the provider’s Business Operation before preparing a workbook.">
    {platformMode && operationError && <StatePanel title="Business Operations unavailable"><span>{operationError}</span></StatePanel>}
    <StatePanel title="Active primary Business Operation required">Select an active primary Business Operation here before downloading, emailing, validating, or importing a setup workbook.</StatePanel>
    {platformMode && operationCatalog.length > 0 && <div className="provider-setup-workbook-operation"><label htmlFor="setup-workbook-operation">Business Operation<SortedSelect id="setup-workbook-operation" value={selectedOperationId} onChange={(event) => setSelectedOperationId(event.target.value)} disabled={!operationEditable || operationBusy}><option value="">Select a Business Operation</option>{operationCatalog.map((item) => <option key={item.id} value={item.id}>{item.attributes.name}{item.attributes.industry_key ? ` · ${item.attributes.industry_key}` : ''}</option>)}</SortedSelect></label><Button onClick={() => void saveBusinessOperation()} disabled={!selectedOperationId || !operationEditable || operationBusy} busy={operationBusy}>{operationBusy ? 'Saving…' : 'Save Business Operation'}</Button>{!canChangeOperation && <small>Platform provider profile write permission is required to assign the operation.</small>}</div>}
    {platformMode && onConfigureOperation && (!canChangeOperation || operationError || !operationCatalog.length) && <div className="provider-setup-workbook-actions"><Button onClick={onConfigureOperation}>Open Business Operations</Button></div>}
  </DetailSection>;

  return <div className="provider-setup-workbook">
    <DetailSection title="Provider setup workbook" description="Choose the provider’s Business Operation, then complete one guided Excel workbook. TRISe checks it before saving anything.">
      {platformMode && <section className="provider-setup-workbook-operation"><label htmlFor="setup-workbook-operation">Linked Business Operation<SortedSelect id="setup-workbook-operation" value={selectedOperationId} onChange={(event) => { setSelectedOperationId(event.target.value); setValidation(null); setConfirmImport(false); setImported(false); }} disabled={!operationEditable || operationBusy}><option value="">Select a Business Operation</option>{operationCatalog.map((item) => <option key={item.id} value={item.id}>{item.attributes.name}{item.attributes.industry_key ? ` · ${item.attributes.industry_key}` : ''}</option>)}</SortedSelect></label>{operationEditable && <Button variant="secondary" onClick={() => void saveBusinessOperation()} disabled={!selectedOperationId || selectedOperationId === linkedOperation?.id || operationBusy} busy={operationBusy}>{linkedOperation ? 'Change Business Operation' : 'Save Business Operation'}</Button>}{linkedOperation && <p><strong>Linked Business Operation:</strong> {linkedOperation.name} · {linkedOperation.code}</p>}{!operationSaved && <p className="platform-field-error" role="status">Save the selected Business Operation before downloading, emailing, validating or importing a workbook.</p>}{!operationEditable && <small>{providerStatus === 'ACTIVE' ? 'Operation changes are locked after activation.' : 'Operation changes are unavailable while the business profile is pending review or your grant does not allow updates.'}</small>}{operationError && <p className="platform-field-error" role="alert">{operationError}</p>}{operationMessage && <p className="provider-setup-workbook-message" role="status">{operationMessage}</p>}</section>}
      <div className="provider-setup-workbook-grid">
        <section className="provider-setup-workbook-card">
          <span className="provider-setup-workbook-step">1</span><div><h3>Download or email the workbook</h3><p>The workbook is prepared for the active Business Operation. {(platformMode ? selectedOperationCode : operationCode) === 'ELEVATOR_SERVICES' ? 'It includes elevator service coverage and published configuration master selections.' : ''} Its document checklist reflects currently published requirements.</p></div>
          {canDownload && <div className="provider-setup-workbook-actions"><Button onClick={() => void download()} disabled={!!busy || !operationSaved}>{busy === 'download' ? 'Preparing…' : <><SvgIcon name="download" size={15} /> Download workbook</>}</Button></div>}
          {canManage && <div className="provider-setup-workbook-email"><label htmlFor="setup-workbook-contact">{platformMode ? 'Share workbook with a provider contact or email address' : 'Email blank workbook to an active provider contact'}</label><div>{platformMode && <SortedSelect aria-label="Recipient type" value={recipientMode} onChange={(event) => setRecipientMode(event.target.value as 'contact' | 'email')}><option value="contact">Select provider contact</option><option value="email">Enter email address</option></SortedSelect>}{recipientMode === 'contact' ? <SortedSelect id="setup-workbook-contact" value={contactId} onChange={(event) => setContactId(event.target.value)}><option value="">Select a contact with email</option>{contacts.map((entry) => <option key={entry.id} value={entry.attributes.contact_id}>{entry.attributes.display_name} · {entry.attributes.contact_methods.email}</option>)}</SortedSelect> : <input id="setup-workbook-contact" type="email" maxLength={320} placeholder="provider@example.com" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} /> }<Button variant="secondary" onClick={() => void emailWorkbook()} disabled={!(recipientMode === 'contact' ? contactId : recipientEmail.trim()) || !!busy || !operationSaved}>{busy === 'email' ? 'Queuing…' : platformMode ? 'Email workbook and link' : 'Email workbook'}</Button></div>{contacts.length === 0 && recipientMode === 'contact' && <small>{platformMode ? 'No active provider contact with an email address is available.' : 'Add an active provider contact with an email address in Contacts &amp; locations first.'}</small>}</div>}
        </section>
        <section className="provider-setup-workbook-card">
          <span className="provider-setup-workbook-step">2</span><div><h3>Return it securely</h3><p>{platformMode ? 'Upload the provider’s returned workbook here, or ask them to upload it through their signed-in provider workspace. Do not email completed workbooks or identity documents.' : 'Upload the completed workbook here while signed in. Do not email completed workbooks or identity documents.'}</p></div>
          <label className="provider-setup-workbook-file">Choose completed workbook<input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void chooseFile(event)} disabled={!canManage || !!busy || !operationSaved} /><small>{file ? file.name + ' · ' + (file.size / 1024).toFixed(0) + ' KB' : 'Excel workbook (.xlsx), up to 5 MiB'}</small></label>
          <div className="provider-setup-workbook-actions"><Button variant="secondary" onClick={() => void validateWorkbook()} disabled={!encoded || !!busy || !operationSaved}>{busy === 'validate' ? 'Checking workbook…' : 'Validate workbook'}</Button></div>
        </section>
      </div>
      <div className="provider-setup-workbook-doc-note"><SvgIcon name="info" size={17} /><span><strong>Documents and logo are separate uploads.</strong> After import, add them in Assets &amp; documents. They stay private and follow the existing scanning and platform review controls.</span></div>
      <section className="provider-setup-workbook-todo" aria-labelledby="provider-setup-workbook-todo-title"><div><p className="platform-eyebrow">Workflow TODO list</p><h3 id="provider-setup-workbook-todo-title">Before governance review and activation</h3><p>Keep each step on this provider’s operation-specific setup path.</p></div><ol><li className={operationSaved ? 'is-done' : 'is-pending'}><strong>{operationSaved ? 'Done' : 'To do'}</strong><span>Select and save the provider’s Business Operation before sharing its workbook.</span></li><li className={validation?.valid || imported ? 'is-done' : 'is-pending'}><strong>{validation?.valid || imported ? 'Done' : 'To do'}</strong><span>Complete and validate every required workbook answer. Import stays blocked while validation has errors.</span></li><li className={imported ? 'is-done' : 'is-pending'}><strong>{imported ? 'Done' : 'To do'}</strong><span>{imported ? 'Import the validated workbook as a draft.' : 'Import the validated workbook as a draft after review.'}</span></li><li className="is-pending"><strong>To do</strong><span>Upload the operation’s required and applicable conditional documents in Assets &amp; documents, then confirm them during governance review.</span></li><li className="is-pending"><strong>To do</strong><span>Submit the provider profile for governance review and complete activation checks.</span></li></ol></section>
      {!canManage && <StatePanel title={platformMode ? 'Platform provider write access required' : 'Provider administrator access required'}>{platformMode ? 'Your platform grant does not allow sending or importing provider setup workbooks.' : 'Only an authorized provider administrator can email, validate, or import setup details.'}</StatePanel>}
      {error && <StatePanel title="Setup workbook needs attention"><span>{error}</span></StatePanel>}
      {message && <p className="provider-setup-workbook-message" role="status">{message}</p>}
      {validation && <section className={'provider-setup-workbook-result' + (validation.valid ? ' is-valid' : ' has-errors')} aria-live="polite"><div className="provider-setup-workbook-result-head"><div><span className="platform-eyebrow">Workbook validation</span><h3>{validation.valid ? 'Ready to import as a draft' : 'Fix the highlighted workbook entries'}</h3><p>{validation.operation_name} · {validation.summary.contacts} contacts · {validation.summary.locations} office locations</p></div><span className="provider-setup-workbook-result-badge">{validation.valid ? 'VALID' : validation.errors.length + ' ISSUES'}</span></div>
        <dl className="provider-setup-workbook-preview"><dt>Business name</dt><dd>{validation.preview.legal_name || 'Not supplied'}</dd><dt>Business address</dt><dd>{validation.preview.address || 'Not supplied'}</dd><dt>Registration</dt><dd>{validation.preview.registration_number || 'Not supplied'}</dd><dt>GSTIN</dt><dd>{validation.preview.gstin || 'Not supplied'}</dd><dt>PAN</dt><dd>{validation.preview.pan_number || 'Not supplied'}</dd><dt>Contacts</dt><dd>{validation.preview.contacts.length ? validation.preview.contacts.map((entry) => [entry.name, entry.responsibility?.replaceAll('_', ' ')].filter(Boolean).join(' · ')).join('; ') : 'No new contacts'}</dd><dt>Office locations</dt><dd>{validation.preview.locations.length ? validation.preview.locations.map((entry) => [entry.name, entry.city, entry.kind?.replaceAll('_', ' ')].filter(Boolean).join(' · ')).join('; ') : 'No new locations'}</dd>{(platformMode ? selectedOperationCode : operationCode) === 'ELEVATOR_SERVICES' && <><dt>Elevator profile choices</dt><dd>{validation.summary.elevator_profile_selections || 0} selected</dd><dt>Configuration masters</dt><dd>{validation.summary.configuration_masters || 0} provider selections across {validation.summary.configuration_types || 0} types</dd></>}</dl>
        {[...validation.errors, ...validation.warnings].map((item, index) => <div className={'provider-setup-workbook-issue' + (validation.errors.includes(item) ? ' is-error' : ' is-warning')} key={item.sheet + '-' + item.field + '-' + index}><strong>{item.sheet} · {item.field}</strong><span>{item.message}</span></div>)}
        {validation.valid && !confirmImport && <div className="provider-setup-workbook-actions"><Button onClick={() => setConfirmImport(true)} disabled={!!busy}>Review import</Button></div>}
        {confirmImport && <div className="provider-setup-workbook-confirm"><p>Import these details into the existing provider profile, contact, and office-location records? This does not submit for verification or activate the provider.</p><Button variant="secondary" onClick={() => setConfirmImport(false)} disabled={busy === 'import'}>Back</Button><Button onClick={() => void importWorkbook()} disabled={busy === 'import'}>{busy === 'import' ? 'Importing…' : 'Confirm import'}</Button></div>}
      </section>}
    </DetailSection>
  </div>;
}

