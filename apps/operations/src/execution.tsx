import { useEffect, useMemo, useState } from 'react';
import { Button, SortedSelect } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { ActionNotification } from './operations-shared';
import { operationsData, type ChecklistAttributes, type Collection, type GenericAttributes, type Resource, type ServiceReportAttributes, type ServiceProofAttributes, type WorkSessionAttributes } from './data';

function messageOf(error: unknown) { return (error as { message?: string })?.message || 'The execution request could not be completed.'; }

export function ExecutionPanel({ providerId, jobId, visitId, agentId }: { providerId: string; jobId: string; visitId?: string; agentId?: string }) {
  const [templates, setTemplates] = useState<Collection<GenericAttributes> | null>(null);
  const [checklists, setChecklists] = useState<Collection<ChecklistAttributes> | null>(null);
  const [sessions, setSessions] = useState<Collection<WorkSessionAttributes> | null>(null);
  const [reports, setReports] = useState<Collection<ServiceReportAttributes> | null>(null);
  const [proofs, setProofs] = useState<Collection<ServiceProofAttributes> | null>(null);
  const [summary, setSummary] = useState('');
  const [workPerformed, setWorkPerformed] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState(false); const [reportBusy, setReportBusy] = useState(false); const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!visitId || !expanded) return; operationsData.checklistTemplates(providerId).then(setTemplates).catch((cause) => setError(messageOf(cause))); }, [expanded, providerId, visitId]);
  useEffect(() => { if (!visitId || !expanded) return; operationsData.checklists(providerId, jobId).then(setChecklists).catch((cause) => setError(messageOf(cause))); }, [expanded, providerId, jobId, visitId]);
  useEffect(() => { if (!visitId || !expanded) return; operationsData.reports(providerId, jobId).then(setReports).catch((cause) => setError(messageOf(cause))); operationsData.proofs(providerId, jobId).then(setProofs).catch((cause) => setError(messageOf(cause))); }, [expanded, providerId, jobId, visitId]);
  useEffect(() => {
    if (!agentId || !expanded) return;
    let cancelled = false;
    operationsData.workSessions(providerId, agentId)
      .then((result) => {
        if (cancelled) return;
        setSessions({ ...result, data: result.data.filter((session) => {
          const link = session.relationships.job;
          return Boolean(link && !Array.isArray(link) && link.id === jobId);
        }) });
      })
      .catch((cause) => {
        if (!cancelled) setError(messageOf(cause));
      });
    return () => { cancelled = true; };
  }, [expanded, providerId, agentId, jobId]);
  useEffect(() => {
    if (!expanded || !sessions?.data.some((session) => !['ENDED', 'COMPLETED'].includes(session.attributes.status))) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expanded, sessions]);
  async function createChecklist() { if (!visitId || !templateId) return; setBusy(true); setError(''); try { const created = await operationsData.createChecklist(providerId, jobId, { visit_id: visitId, template_id: templateId }, crypto.randomUUID()); setChecklists((current) => current ? { ...current, data: [created, ...current.data] } : { data: [created] }); setMessage('Checklist created from the authorized template'); } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); } }
  async function updateChecklist(checklist: Resource<ChecklistAttributes>, itemKey: string, value: unknown) { setBusy(true); setError(''); try { const updated = await operationsData.updateChecklist(providerId, jobId, checklist.id, { item_key: itemKey, value }, crypto.randomUUID()); setChecklists((current) => current ? { ...current, data: current.data.map((item) => item.id === updated.id ? updated : item) } : current); } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); } }
  async function completeChecklist(checklist: Resource<ChecklistAttributes>) { setBusy(true); setError(''); try { const completed = await operationsData.completeChecklist(providerId, jobId, checklist.id, crypto.randomUUID()); setChecklists((current) => current ? { ...current, data: current.data.map((item) => item.id === completed.id ? completed : item) } : current); setMessage('Checklist completion accepted.'); } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); } }
  async function startSession() { if (!agentId) return; setBusy(true); setError(''); try { const started = await operationsData.startWorkSession(providerId, agentId, { started_at: new Date().toISOString() }, crypto.randomUUID()); setSessions((current) => current ? { ...current, data: [started, ...current.data] } : { data: [started] }); setMessage('Work session started.'); } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); } }
  async function endSession(session: Resource<WorkSessionAttributes>) { if (!agentId) return; setBusy(true); setError(''); try { const ended = await operationsData.endWorkSession(providerId, agentId, session.id, { ended_at: new Date().toISOString(), expected_revision: session.attributes.revision }, crypto.randomUUID()); setSessions((current) => current ? { ...current, data: current.data.map((item) => item.id === ended.id ? ended : item) } : current); setMessage('Work session ended.'); } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); } }
  async function changeSession(session: Resource<WorkSessionAttributes>, action: 'pause' | 'resume') { if (!agentId) return; setBusy(true); setError(''); try { const body = { [action === 'pause' ? 'paused_at' : 'resumed_at']: new Date().toISOString(), expected_revision: session.attributes.revision }; const next = action === 'pause' ? await operationsData.pauseWorkSession(providerId, agentId, session.id, body, crypto.randomUUID()) : await operationsData.resumeWorkSession(providerId, agentId, session.id, body, crypto.randomUUID()); setSessions((current) => current ? { ...current, data: current.data.map((item) => item.id === next.id ? next : item) } : current); setMessage(`Work session ${action} accepted.`); } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); } }
  async function createReport() { if (!visitId || !summary.trim() || !workPerformed.trim()) return; setReportBusy(true); setError(''); try { const created = await operationsData.createReport(providerId, jobId, { visit_id: visitId, summary: summary.trim(), work_performed: workPerformed.trim() }, crypto.randomUUID()); setReports((current) => current ? { ...current, data: [created, ...current.data] } : { data: [created] }); setSummary(''); setWorkPerformed(''); setMessage('Service report saved as a draft.'); } catch (cause) { setError(messageOf(cause)); } finally { setReportBusy(false); } }
  async function submitReport(report: Resource<ServiceReportAttributes>) { setReportBusy(true); setError(''); try { const submitted = await operationsData.submitReport(providerId, jobId, report.id, crypto.randomUUID()); setReports((current) => current ? { ...current, data: current.data.map((item) => item.id === submitted.id ? submitted : item) } : current); setMessage('Service report submitted for review.'); } catch (cause) { setError(messageOf(cause)); } finally { setReportBusy(false); } }
  function activeSeconds(session: Resource<WorkSessionAttributes>) { return (session.attributes.intervals || []).reduce((sum, interval) => sum + (interval.duration_seconds || 0) + (interval.status === 'OPEN' ? Math.max(0, Math.floor((now - new Date(interval.started_at).getTime()) / 1000)) : 0), 0); }
  function checklistValue(checklist: Resource<ChecklistAttributes>, item: Record<string, unknown>) {
    const key = String(item.key || '');
    return checklist.attributes.answers?.find((answer) => (answer.key || (answer as { item_key?: string }).item_key) === key)?.value;
  }
  function checklistEditor(checklist: Resource<ChecklistAttributes>, item: Record<string, unknown>) {
    const key = String(item.key || '');
    const label = String(item.label || key);
    const type = String(item.type || 'TEXT').toUpperCase();
    const value = checklistValue(checklist, item);
    const disabled = busy || ['COMPLETED', 'CANCELLED'].includes(checklist.attributes.status);
    if (type === 'BOOLEAN') return <input aria-label={label} type="checkbox" checked={value === true} disabled={disabled} onChange={(event) => void updateChecklist(checklist, key, event.target.checked)} />;
    if (type === 'OPTION') return <SortedSelect aria-label={label} value={value == null ? '' : String(value)} disabled={disabled} onChange={(event) => void updateChecklist(checklist, key, event.target.value)}><option value="">Select an option</option>{(Array.isArray(item.options) ? item.options : []).map((option) => <option value={String(option)} key={String(option)}>{String(option)}</option>)}</SortedSelect>;
    const inputType = type === 'NUMBER' ? 'number' : type === 'DATE' ? 'date' : type === 'TIME' ? 'time' : 'text';
    return <input aria-label={label} type={inputType} value={value == null ? '' : String(value)} disabled={disabled} onChange={(event) => void updateChecklist(checklist, key, inputType === 'number' ? (event.target.value === '' ? null : Number(event.target.value)) : event.target.value)} />;
  }
  const openSession = useMemo(() => sessions?.data.find((session) => !['ENDED', 'COMPLETED'].includes(session.attributes.status)), [sessions]);
  return <details className="agent-artifacts execution-workspace" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary><span className="execution-summary-main"><strong>Execution workspace</strong><small>Checklist, service report, work session and evidence</small></span><span className="execution-summary-hint">Open only when needed</span></summary>
    {!visitId && <p className="notice">A server-created visit is required before execution evidence can begin.</p>}
    {visitId && <div className="execution-grid">
      <section className="execution-card execution-checklist">
        <div className="execution-card-heading"><div><h4>Service checklist</h4><p>Use an authorized checklist template for this provider.</p></div><Status>{checklists?.data.length ? `${checklists.data.length} active` : 'Ready'}</Status></div>
        <div className="inline-actions"><SortedSelect aria-label="Checklist template" value={templateId} onChange={(event) => setTemplateId(event.target.value)}><option value="">Select an authorized checklist template</option>{templates?.data.map((template) => <option value={template.id} key={template.id}>{String(template.attributes.name || template.attributes.code || template.id)}</option>)}</SortedSelect><Button disabled={busy || !templateId} onClick={() => void createChecklist()}>Create checklist</Button></div>
        {checklists && checklists.data.length === 0 && <p className="execution-empty">No checklist has been created for this visit.</p>}
        {checklists?.data.map((checklist) => <article className="execution-record" key={checklist.id}><div className="execution-card-heading"><strong>{checklist.attributes.template_name || 'Checklist'}</strong><Status>{checklist.attributes.status}</Status></div>{(checklist.attributes.items || []).map((item) => <label className="execution-check-item" key={String(item.key)}><span>{String(item.label || item.key)}</span>{checklistEditor(checklist, item)}</label>)}{checklist.attributes.status !== 'COMPLETED' && <Button disabled={busy} onClick={() => void completeChecklist(checklist)}>Complete checklist</Button>}</article>)}
      </section>
      <div className="execution-support-column">
        {agentId && <section className="execution-card"><div className="execution-card-heading"><div><h4>Work session</h4><p>Elapsed time uses persisted server intervals.</p></div>{openSession && <Status>{openSession.attributes.status}</Status>}</div>{!openSession && <Button disabled={busy} onClick={() => void startSession()}>Start work session</Button>}{sessions?.data.filter((session) => !['ENDED', 'COMPLETED'].includes(session.attributes.status)).map((session) => <div className="session-row" key={session.id}><span>{Math.floor(activeSeconds(session) / 60)}m {activeSeconds(session) % 60}s active</span>{session.attributes.status === 'ACTIVE' && <Button variant="secondary" disabled={busy} onClick={() => void changeSession(session, 'pause')}>Pause</Button>}{session.attributes.status === 'PAUSED' && <Button disabled={busy} onClick={() => void changeSession(session, 'resume')}>Resume</Button>}<Button variant="secondary" disabled={busy} onClick={() => void endSession(session)}>Finish session</Button></div>)}</section>}
        <section className="execution-card"><div className="execution-card-heading"><div><h4>Service report</h4><p>Record the technician's findings and work performed.</p></div></div>{reports && reports.data.length === 0 && <p className="execution-empty">No service report has been recorded for this visit.</p>}{reports?.data.map((report) => <div className="session-row" key={report.id}><Status>{report.attributes.status}</Status><span>{report.attributes.summary}</span>{report.attributes.status !== 'submitted' && <Button variant="secondary" disabled={reportBusy} onClick={() => void submitReport(report)}>Submit report</Button>}</div>)}<label>Summary<input aria-label="Report summary" value={summary} onChange={(event) => setSummary(event.target.value)} /></label><label>Work performed<textarea aria-label="Report work performed" value={workPerformed} onChange={(event) => setWorkPerformed(event.target.value)} rows={3} /></label><Button disabled={reportBusy || !summary.trim() || !workPerformed.trim()} onClick={() => void createReport()}>Create service report</Button></section>
        <section className="execution-card"><div className="execution-card-heading"><div><h4>Technical evidence</h4><p>Evidence records are read from the authorized visit.</p></div></div>{proofs ? <p className="execution-empty">{proofs.data.length ? `${proofs.data.length} technical proof record(s) attached.` : 'No technical proof records are attached to this visit.'}</p> : <p className="execution-empty">Loading authorized evidence…</p>}</section>
      </div>
    </div>}
    {error && <ActionNotification kind="error" title="Execution action needs attention" onClose={() => setError('')}>{error}</ActionNotification>}{message && <ActionNotification title="Execution update completed" onClose={() => setMessage('')}>{message}</ActionNotification>}
  </details>;
}
