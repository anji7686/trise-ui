import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@trise/ui';

export type WorkspaceTab = { id: string; label: string; disabled?: boolean };

export function WorkspaceTabs({ tabs, activeId, onChange, label = 'Workspace sections' }: { tabs: WorkspaceTab[]; activeId: string; onChange: (id: string) => void; label?: string }) {
  return <div className="workspace-tabs" role="tablist" aria-label={label}>{tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={tab.id === activeId} aria-controls={`${tab.id}-panel`} className={tab.id === activeId ? 'active' : ''} disabled={tab.disabled} onClick={() => onChange(tab.id)}>{tab.label}</button>)}</div>;
}

export function OperationsDrawer({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { element?.close(); trigger?.focus(); };
  }, []);
  return <dialog ref={dialog} className="operations-drawer" aria-labelledby={heading} onCancel={(event) => { event.preventDefault(); if (!busy) close.current(); }}>
    <header className="operations-drawer-heading"><div><span className="page-eyebrow">Operations</span><h2 id={heading}>{title}</h2></div><Button type="button" variant="quiet" aria-label={`Close ${title}`} disabled={busy} onClick={onClose}>×</Button></header>
    <div className="operations-drawer-content">{children}</div>
  </dialog>;
}

export function ActionFeedback({ kind = 'success', children }: { kind?: 'success' | 'error' | 'warning' | 'info'; children: ReactNode }) {
  return <div className={`action-feedback action-feedback-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <section className="operations-empty-state"><div className="operations-empty-state-icon" aria-hidden="true">·</div><div><h3>{title}</h3><p>{description}</p>{action && <div className="operations-empty-state-action">{action}</div>}</div></section>;
}
