import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@trise/ui';

export type WorkspaceTab = { id: string; label: string; disabled?: boolean };

export type ProviderAction = { id: string; label: string; onSelect: () => void; disabled?: boolean; tone?: 'default' | 'danger'; icon?: ReactNode };

const INTERNAL_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DISPLAY_ACRONYMS = new Set(['AMC', 'API', 'CGST', 'GSTIN', 'INR', 'MRL', 'PAN', 'PDF', 'QA', 'SGST', 'SMS', 'UPI', 'XLS']);

/**
 * Convert server enum values into readable UI labels while keeping the raw
 * value available to the request/transition layer. UUIDs are never useful to
 * an operator, so callers get the supplied fallback instead of rendering one.
 */
export function displayLabel(value: unknown, fallback = 'Not supplied') {
  const raw = String(value ?? '').trim();
  if (!raw || INTERNAL_ID_PATTERN.test(raw)) return fallback;
  if (!/[_-]/.test(raw) && raw !== raw.toUpperCase()) return raw;
  return raw
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .map((word) => DISPLAY_ACRONYMS.has(word.toUpperCase()) ? word.toUpperCase() : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');
}

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
    return <Button type="button" variant={action.tone === 'danger' ? 'danger' : 'secondary'} disabled={action.disabled} onClick={action.onSelect}>{action.icon && <span className="provider-action-icon" aria-hidden="true">{action.icon}</span>}{action.label}</Button>;
  }
  const primary = actions[0];
  return <div className="provider-action-menu" ref={root}>
    <div className="provider-action-menu-group">
      <Button type="button" variant={primary.tone === 'danger' ? 'danger' : 'secondary'} disabled={primary.disabled} onClick={primary.onSelect}>{primary.icon && <span className="provider-action-icon" aria-hidden="true">{primary.icon}</span>}{primary.label}</Button>
      <button type="button" className="provider-action-menu-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true">⋯</span>
      </button>
    </div>
    {open && <div className="provider-action-menu-list" role="menu" aria-label={label}>
      {actions.slice(1).map((action) => <button key={action.id} type="button" role="menuitem" className={action.tone === 'danger' ? 'is-danger' : undefined} disabled={action.disabled} onClick={() => { setOpen(false); action.onSelect(); }}>{action.icon && <span className="provider-action-icon" aria-hidden="true">{action.icon}</span>}{action.label}</button>)}
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

export function ActionNotification({ kind = 'success', title, children, onClose, durationMs = 5000 }: { kind?: 'success' | 'error' | 'warning' | 'info'; title: string; children: ReactNode; onClose: () => void; durationMs?: number | null }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (durationMs === null) return;
    const timer = window.setTimeout(() => close.current(), durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs]);
  const symbol = kind === 'success' ? '✓' : kind === 'error' ? '!' : kind === 'warning' ? '!' : 'i';
  return <aside className={`action-notification action-notification-${kind}`} role={kind === 'error' || kind === 'warning' ? 'alert' : 'status'} aria-live={kind === 'error' || kind === 'warning' ? 'assertive' : 'polite'}>
    <span className="action-notification-bar" aria-hidden="true" />
    <span className="action-notification-symbol" aria-hidden="true">{symbol}</span>
    <div className="action-notification-copy"><strong>{title}</strong><p>{children}</p></div>
    <button type="button" className="action-notification-close" aria-label={`Dismiss ${title}`} onClick={onClose}>×</button>
  </aside>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <section className="operations-empty-state"><div className="operations-empty-state-icon" aria-hidden="true">·</div><div><h3>{title}</h3><p>{description}</p>{action && <div className="operations-empty-state-action">{action}</div>}</div></section>;
}
