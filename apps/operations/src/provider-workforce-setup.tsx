import { useEffect, useState } from 'react';
import { Button, PageHeader, SortedSelect } from '@trise/ui';
import { operationsData, type Collection, type GenericAttributes, type Resource } from './data';

type Mode = 'support-coverage' | 'extra-day-credits';
const label = (row: Resource<GenericAttributes>) => String(row.attributes.display_name || row.attributes.name || row.attributes.title || 'Workforce member');
const messageOf = (error: unknown) => (error as { message?: string })?.message || 'The requested operation could not be completed.';
const asRevision = (row: Resource<GenericAttributes>) => Number(row.attributes.revision || 0);
const compOffOptionLabel = (session: Resource<GenericAttributes>) => {
  const minutes = Number(session.attributes.eligible_minutes || 0);
  const duration = `${minutes} ${minutes === 1 ? 'min' : 'mins'}`;
  const reason = String(session.attributes.comp_off_ineligibility_reason || 'Needs review');
  const eligibility = session.attributes.comp_off_eligible ? 'Eligible' : reason.startsWith('CompOff has already') ? 'Already submitted' : reason.includes('recorded; at least') ? 'Below minimum' : 'Weekend/holiday required';
  return [session.attributes.business_date, session.attributes.workforce_name || 'Team member', duration, session.attributes.service_type_name || session.attributes.job_summary || 'Completed job', eligibility].map(String).join(' · ');
};

export function ProviderWorkforceSetup({ providerId, mode, canAssign, canReview, canSubmit }: { providerId: string; mode: Mode; canAssign: boolean; canReview: boolean; canSubmit: boolean }) {
  const [rows, setRows] = useState<Collection<GenericAttributes> | null>(null);
  const [agents, setAgents] = useState<Collection<GenericAttributes> | null>(null);
  const [sessions, setSessions] = useState<Collection<GenericAttributes> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ workforce_profile_id: '', coverage_date: '', slot_code: 'WEEKEND_DAY', starts_at: '09:00', ends_at: '17:00', coverage_role: 'PRIMARY', coverage_mode: 'PLANNED', reason: '' });
  const [creditForm, setCreditForm] = useState({ work_session_id: '', reason: '' });
  const [reviewReason, setReviewReason] = useState<Record<string, string>>({});
  const refresh = async () => {
    const result = mode === 'support-coverage' ? await operationsData.supportCoverage(providerId) : await operationsData.extraDayCredits(providerId);
    setRows(result);
  };
  useEffect(() => {
    let disposed = false;
    const loadSelfSessions = async () => {
      if (mode !== 'extra-day-credits' || !canSubmit) return null;
      const result = await operationsData.eligibleExtraDaySessions(providerId);
      if (!disposed) setSessions(result);
      return null;
    };
    Promise.all([refresh(), mode === 'support-coverage' ? operationsData.agents(providerId) : Promise.resolve(null), loadSelfSessions()])
      .then(([, people]) => { if (!disposed && people) setAgents(people as Collection<GenericAttributes>); })
      .catch((cause) => { if (!disposed) setError(messageOf(cause)); });
    return () => { disposed = true; };
  }, [providerId, mode, canSubmit]);

  async function createCoverage(event: React.FormEvent) {
    event.preventDefault();
    if (!form.workforce_profile_id || !form.coverage_date || !form.reason.trim()) return;
    const overnight = form.ends_at <= form.starts_at;
    const [year, month, day] = form.coverage_date.split('-').map(Number);
    const endDay = overnight ? new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10) : form.coverage_date;
    setBusy(true); setError(''); setNotice('');
    try {
      await operationsData.createSupportCoverage(providerId, {
        workforce_profile_id: form.workforce_profile_id,
        coverage_date: form.coverage_date,
        slot_code: form.slot_code,
        starts_at: new Date(`${form.coverage_date}T${form.starts_at}:00+05:30`).toISOString(),
        ends_at: new Date(`${endDay}T${form.ends_at}:00+05:30`).toISOString(),
        coverage_role: form.coverage_role,
        coverage_mode: form.coverage_mode,
        reason: form.reason.trim(),
      }, crypto.randomUUID());
      setNotice('Coverage draft saved. Publish it after confirming the date, slot and assignee.');
      setForm((current) => ({ ...current, workforce_profile_id: '', coverage_date: '', reason: '' }));
      await refresh();
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }

  async function publish(id: string, revision: number) {
    setBusy(true); setError(''); setNotice('');
    try { await operationsData.publishSupportCoverage(providerId, id, revision, crypto.randomUUID()); setNotice('Support coverage published.'); await refresh(); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }

  async function review(id: string, revision: number, action: string) {
    const reason = reviewReason[id]?.trim();
    if (!reason) { setError('Enter a review reason before recording the decision.'); return; }
    setBusy(true); setError(''); setNotice('');
    try { await operationsData.reviewExtraDayCredit(providerId, id, action, revision, reason, crypto.randomUUID()); setNotice(`CompOff credit ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'returned for correction'}.`); await refresh(); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }

  async function submitCredit(event: React.FormEvent) {
    event.preventDefault();
    const workforceProfileId = String(selectedCreditSession?.attributes.workforce_profile_id || '');
    if (!selectedCreditSession?.attributes.comp_off_eligible || !workforceProfileId || !creditForm.reason.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await operationsData.submitExtraDayCredit(providerId, workforceProfileId, creditForm.work_session_id, creditForm.reason.trim(), crypto.randomUUID());
      setNotice('Completed session submitted for CompOff review.');
      setCreditForm({ work_session_id: '', reason: '' });
      await refresh();
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }

  const selectedCreditSession = sessions?.data.find((session) => session.id === creditForm.work_session_id);
  const isCoverage = mode === 'support-coverage';
  return <section className="content feature-page provider-workforce-setup">
    <PageHeader title={isCoverage ? 'Support coverage allocation' : 'Extra day & CompOff ledger'} description={isCoverage ? 'Plan named, provider-scoped support coverage. A saved draft does not represent job assignment or guarantee availability.' : 'Review CompOff earned from completed weekend or holiday work sessions. Approved credit is consumed through the existing leave request flow.'} action={<Button type="button" variant="secondary" onClick={() => { window.location.hash = '#configuration'; }}>Back to provider setup</Button>} />
    {error && <div className="feature-error" role="alert">{error}<Button type="button" variant="quiet" onClick={() => void refresh()}>Retry</Button></div>}
    {notice && <div className="notice" role="status">{notice}</div>}
    {isCoverage && <section className="detail-section"><div className="section-heading"><div><h2>Allocate support coverage</h2><p>Choose an active team member and schedule a clear coverage slot in Asia/Kolkata.</p></div></div>
      {canAssign ? <form className="provider-workforce-coverage-form" onSubmit={(event) => void createCoverage(event)}>
        <label>Team member<SortedSelect required value={form.workforce_profile_id} onChange={(event) => setForm({ ...form, workforce_profile_id: event.target.value })}><option value="">Select active team member</option>{(agents?.data || []).filter((person) => String(person.attributes.status || 'ACTIVE').toUpperCase() === 'ACTIVE').map((person) => <option key={person.id} value={person.id}>{label(person)}</option>)}</SortedSelect></label>
        <label>Coverage date<input type="date" required value={form.coverage_date} onChange={(event) => setForm({ ...form, coverage_date: event.target.value })} /></label>
        <label>Slot<SortedSelect value={form.slot_code} onChange={(event) => setForm({ ...form, slot_code: event.target.value })}><option value="WEEKDAY_DAY">Weekday day</option><option value="WEEKEND_DAY">Weekend day</option><option value="NIGHT">Night</option><option value="EMERGENCY">Emergency</option></SortedSelect></label>
        <label>Start<input type="time" required value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></label><label>End<input type="time" required value={form.ends_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} /></label>
        <label>Coverage role<SortedSelect value={form.coverage_role} onChange={(event) => setForm({ ...form, coverage_role: event.target.value })}><option value="PRIMARY">Primary</option><option value="BACKUP">Backup</option></SortedSelect></label>
        <label>Mode<SortedSelect value={form.coverage_mode} onChange={(event) => setForm({ ...form, coverage_mode: event.target.value })}><option value="PLANNED">Planned</option><option value="EMERGENCY_ONLY">Emergency only</option></SortedSelect></label>
        <label className="provider-workforce-coverage-reason">Reason<input required maxLength={500} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="For example, weekend rescue rota" /></label>
        <div className="provider-form-actions"><Button type="submit" busy={busy} disabled={busy || !form.workforce_profile_id || !form.coverage_date || !form.reason.trim()}>Save coverage draft</Button></div>
      </form> : <p className="notice">Your role can view coverage but cannot assign or publish it.</p>}</section>}
    {!isCoverage && canSubmit && <section className="detail-section"><div className="section-heading"><div><h2>Submit completed work for CompOff</h2><p>{canReview ? 'Choose a completed session from your provider team. Only sessions meeting the CompOff policy can be submitted.' : 'Choose your completed weekend or holiday session. The server checks the holiday/weekend and minimum-hours rules.'}</p></div></div>
      {!sessions ? <p className="notice">Loading completed sessions…</p> : sessions.data.length === 0 ? <p className="notice">No completed work sessions are available in the current CompOff window.</p> : <form className="provider-workforce-coverage-form provider-comp-off-form" onSubmit={(event) => void submitCredit(event)}>
        <label>Completed work session<SortedSelect required value={creditForm.work_session_id} onChange={(event) => setCreditForm({ ...creditForm, work_session_id: event.target.value })}><option value="">Select a completed session</option>{sessions.data.map((session) => <option key={session.id} value={session.id}>{compOffOptionLabel(session)}</option>)}</SortedSelect></label>
        <label>Work summary<input required maxLength={1000} value={creditForm.reason} onChange={(event) => setCreditForm({ ...creditForm, reason: event.target.value })} placeholder="Briefly describe the weekend or holiday work" /></label>
        <div className="provider-form-actions"><Button type="submit" busy={busy} disabled={busy || !selectedCreditSession?.attributes.comp_off_eligible || !creditForm.reason.trim()}>Submit for review</Button></div>
        {selectedCreditSession && <p className={`notice provider-comp-off-eligibility${selectedCreditSession.attributes.comp_off_eligible ? ' is-eligible' : ''}`} role="status">{selectedCreditSession.attributes.comp_off_eligible ? `Eligible completed session · ${String(selectedCreditSession.attributes.eligible_minutes || 0)} minutes. The reviewer will confirm the credit.` : String(selectedCreditSession.attributes.comp_off_ineligibility_reason || 'This session does not meet the CompOff policy.')}</p>}
      </form>}</section>}
    <section className="detail-section"><div className="section-heading"><div><h2>{isCoverage ? 'Coverage schedule' : 'CompOff review ledger'}</h2><p>{isCoverage ? 'Publish each draft after an authorized manager confirms the slot.' : 'Four hours earns a half-day; eight hours earns one day. Each credit needs an authorized review.'}</p></div><span>{rows?.data.length || 0} records</span></div>
      {!rows ? <p className="notice">Loading provider records…</p> : !rows.data.length ? <p className="notice">No {isCoverage ? 'coverage allocations' : 'CompOff credits'} recorded yet.</p> : <div className="provider-workforce-setup-list">{rows.data.map((row) => {
        const attrs = row.attributes;
        const status = String(attrs.status || '').toUpperCase();
        return <article key={row.id} className="provider-workforce-setup-row"><div className="provider-workforce-setup-row-main"><strong>{String(isCoverage ? attrs.workforce_name || attrs.slot_code : attrs.workforce_name || 'Workforce member')}</strong><span className={`status status-${status === 'PUBLISHED' || status === 'APPROVED' ? 'success' : status === 'PENDING_REVIEW' || status === 'DRAFT' ? 'warning' : 'neutral'}`}>{status.replaceAll('_', ' ')}</span><small>{isCoverage ? `${String(attrs.coverage_date || '')} · ${String(attrs.slot_code || '')} · ${String(attrs.coverage_role || '')}` : `${String(attrs.business_date || '')} · ${String(attrs.eligible_minutes || 0)} minutes · ${String(attrs.credit_units || 0)} day(s)`}</small>{isCoverage && <small>{new Date(String(attrs.starts_at)).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}–{new Date(String(attrs.ends_at)).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST · {String(attrs.coverage_mode || '').replaceAll('_', ' ')}</small>}</div>
          {isCoverage && canAssign && status === 'DRAFT' && <Button type="button" busy={busy} disabled={busy} onClick={() => void publish(row.id, asRevision(row))}>Publish</Button>}
          {!isCoverage && status === 'PENDING_REVIEW' && canReview && <div className="provider-workforce-credit-actions"><input aria-label="CompOff review reason" placeholder="Review reason" value={reviewReason[row.id] || ''} onChange={(event) => setReviewReason({ ...reviewReason, [row.id]: event.target.value })} /><Button type="button" busy={busy} disabled={busy} onClick={() => void review(row.id, asRevision(row), 'approve')}>Approve</Button><Button type="button" variant="secondary" busy={busy} disabled={busy} onClick={() => void review(row.id, asRevision(row), 'correction_required')}>Return</Button><Button type="button" variant="quiet" busy={busy} disabled={busy} onClick={() => void review(row.id, asRevision(row), 'reject')}>Reject</Button></div>}
        </article>;
      })}</div>}
    </section>
  </section>;
}
