import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@trise/ui';

export function validReviewReason(value: string) { return value.trim().length > 0 && value.trim().length <= 1000; }

/** One modal at a time; route changes cancel the pending decision. */
export function useReviewReason(scope: string) {
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const resolver = useRef<((value: string | null) => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const label = useId();
  function finish(value: string | null) {
    const resolve = resolver.current; resolver.current = null; setTitle(''); setReason(''); resolve?.(value);
  }
  useEffect(() => { const element = dialog.current; if (title && element && !element.open) element.showModal(); }, [title]);
  useEffect(() => { setTitle(''); setReason(''); return () => { const resolve = resolver.current; resolver.current = null; resolve?.(null); }; }, [scope]);
  function ask(nextTitle: string): Promise<string | null> {
    if (resolver.current) return Promise.resolve(null);
    setReason(''); setTitle(nextTitle);
    return new Promise(resolve => { resolver.current = resolve; });
  }
  const modal = title ? <dialog ref={dialog} className="platform-document-modal subscription-review-dialog" aria-labelledby={label} onCancel={() => finish(null)}>
    <h2 id={label}>{title}</h2><form onSubmit={event => { event.preventDefault(); if (validReviewReason(reason)) finish(reason.trim()); }}>
      <label>Review reason<textarea autoFocus required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} rows={4} /></label>
      <p>Record the decision and any corrections needed. This reason is sent to the review API.</p>
      <div className="platform-form-actions"><Button type="button" variant="secondary" onClick={() => finish(null)}>Cancel</Button><Button type="submit" disabled={!validReviewReason(reason)}>Confirm decision</Button></div>
    </form>
  </dialog> : null;
  return { ask, modal };
}

export function EvidenceReviewFeedback({ reviews }: { reviews?: { id: string; decision: string; reason?: string | null; reviewed_at: string }[] }) {
  return reviews?.length ? <ul className="platform-audit-list">{reviews.map(review => <li key={review.id}><strong>{review.decision.replaceAll('_', ' ')}</strong><p>{review.reason || 'No reason recorded'}</p><time dateTime={review.reviewed_at}>{new Date(review.reviewed_at).toLocaleString()}</time></li>)}</ul> : null;
}
