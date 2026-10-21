import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@trise/ui';

export type WorkspaceTab = { id: string; label: string; disabled?: boolean };

export type ProviderAction = { id: string; label: string; onSelect: () => void; disabled?: boolean; tone?: 'default' | 'danger' };

/** Compact, accessible action surface for provider tables. */
export function ProviderActionMenu({ label = 'Actions', actions }: { label?: string; actions: ProviderAction[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [open]);
  if (!actions.length) return null;
  if (actions.length === 1) {
    const action = actions[0];
    return <Button type="button" variant={action.tone === 'danger' ? 'danger' : 'secondary'} disabled={action.disabled} onClick={action.onSelect}>{action.label}</Button>;
  }
  const primary = actions[0];
  return <div className="provider-action-menu" ref={root}>
    <div className="provider-action-menu-group">
      <Button type="button" variant={primary.tone === 'danger' ? 'danger' : 'secondary'} disabled={primary.disabled} onClick={primary.onSelect}>{primary.label}</Button>
      <button type="button" className="provider-action-menu-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true">⋯</span>
      </button>
    </div>
    {open && <div className="provider-action-menu-list" role="menu" aria-label={label}>
      {actions.slice(1).map((action) => <button key={action.id} type="button" role="menuitem" className={action.tone === 'danger' ? 'is-danger' : undefined} disabled={action.disabled} onClick={() => { setOpen(false); action.onSelect(); }}>{action.label}</button>)}
    </div>}
  </div>;
}

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
