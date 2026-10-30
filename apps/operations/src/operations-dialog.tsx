import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@trise/ui';

export function OperationsDialog({ title, titleInfo, children, onClose, busy = false, className }: { title: string; titleInfo?: ReactNode; children: ReactNode; onClose: () => void; busy?: boolean; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { element?.close(); trigger?.focus(); };
  }, []);
  return <dialog ref={dialog} className={`operations-dialog${className ? ` ${className}` : ''}`} aria-labelledby={heading} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(element => element.getClientRects().length > 0);
    const first = controls[0]; const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onCancel={event => { event.preventDefault(); if (!busy) close.current(); }}>
    <header className="operations-dialog-heading"><div className="operations-dialog-title-row"><h2 id={heading}>{title}</h2>{titleInfo}</div><Button type="button" variant="quiet" aria-label={`Close ${title}`} disabled={busy} onClick={onClose}>×</Button></header>
    {children}
  </dialog>;
}
