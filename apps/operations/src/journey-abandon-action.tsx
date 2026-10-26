import { useState, type FormEvent } from 'react';
import { Button } from '@trise/ui';
import { operationsData, type ProviderWorkJourney } from './data';
import { OperationsDialog } from './operations-dialog';
import { SvgIcon } from './icons';

type Props = { providerId: string; journey: ProviderWorkJourney | null; canAbandon: boolean; onAbandoned: (journey: ProviderWorkJourney) => void };

export function JourneyAbandonAction({ providerId, journey, canAbandon, onAbandoned }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [paymentDisposition, setPaymentDisposition] = useState<'NO_REFUND_DUE' | 'REFUND_REQUIRED' | 'REFUND_ALREADY_COMPLETED'>('NO_REFUND_DUE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!canAbandon || !journey || journey.attributes.status !== 'ACTIVE') return null;
  const activeJourney = journey;

  async function abandon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 3) { setError('Provide a reason of at least 3 characters.'); return; }
    setBusy(true); setError('');
    try {
      const updated = await operationsData.abandonProviderWorkJourney(providerId, activeJourney.id, { reason: trimmed, payment_disposition: paymentDisposition }, crypto.randomUUID());
      setOpen(false); setReason(''); onAbandoned(updated);
    } catch (cause) { setError((cause as Error).message || 'The journey could not be abandoned.'); }
    finally { setBusy(false); }
  }

  return <>
    <Button type="button" variant="danger" className="workflow-abandon-action" onClick={() => setOpen(true)} title="Stop this shared workflow journey"><SvgIcon name="x" size={15} /> Stop</Button>
    {open && <OperationsDialog title="Abandon provider journey" busy={busy} onClose={() => setOpen(false)}><form className="provider-form" onSubmit={(event) => void abandon(event)}><p className="provider-form-note">This authority-controlled action stops the shared journey across the linked Work Intake, Lead, Survey, quotation, project, handover, and AMC/service records. Existing history remains available for audit.</p>{error && <p className="error" role="alert">{error}</p>}<label>Reason *<textarea required minLength={3} maxLength={2000} rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this journey is being abandoned." /></label><label>Payment disposition<select value={paymentDisposition} onChange={(event) => setPaymentDisposition(event.target.value as typeof paymentDisposition)}><option value="NO_REFUND_DUE">No refund due</option><option value="REFUND_REQUIRED">Refund required — Finance must process it</option><option value="REFUND_ALREADY_COMPLETED">Refund already completed — payments must be reversed</option></select></label><div className="provider-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Keep journey open</Button><Button type="submit" variant="danger" busy={busy}>Abandon journey</Button></div></form></OperationsDialog>}
  </>;
}
