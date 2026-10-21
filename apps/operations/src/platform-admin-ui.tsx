import { Children, Fragment, isValidElement, type FormEvent, type ReactNode } from 'react';
import { Button, PageHeader } from '@trise/ui';
import { SvgIcon } from './icons';
import { formatIndiaDateTime } from './subscription-support';

export type AdminCrumb = { label: string; href?: string };

export function AdminPageHeader({ breadcrumbs, eyebrow, title, description, action }: {
  breadcrumbs: AdminCrumb[];
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return <>
    <nav className="admin-breadcrumb" aria-label="Breadcrumb">
      {breadcrumbs.map((crumb, index) => <span className="admin-breadcrumb-item" key={`${crumb.label}-${index}`}>
        {index > 0 && <SvgIcon name="chevron-right" size={13} />}
        {crumb.href ? <button type="button" onClick={() => { window.location.hash = crumb.href!; }}>{crumb.label}</button> : <strong aria-current="page">{crumb.label}</strong>}
      </span>)}
    </nav>
    <PageHeader eyebrow={eyebrow} title={title} description={description} action={action} />
  </>;
}

export function AdminFilterBar({ children, onSubmit, className = '' }: { children: ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void; className?: string }) {
  return <form className={`platform-filter-toolbar admin-filter-bar ${className}`} onSubmit={onSubmit}>{children}</form>;
}

export function AdminDataTable({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`platform-provider-table-wrap admin-data-table ${className}`}>{children}</div>;
}

export function AdminPagination({ shown, scope = 'records loaded', hasMore, busy = false, onLoadMore, hasPrevious = false, hasNext = false, onPrevious, onNext }: {
  shown: number;
  scope?: string;
  hasMore: boolean;
  busy?: boolean;
  onLoadMore?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  if (onPrevious || onNext) return <div className="platform-pagination admin-pagination"><span>{shown} {scope}</span><div><Button variant="secondary" disabled={busy || !hasPrevious} onClick={onPrevious}>Previous</Button><Button variant="secondary" busy={busy} disabled={busy || !hasNext} onClick={onNext}>Next</Button></div></div>;
  return <div className="platform-pagination admin-pagination"><span>{shown} {scope}</span>{hasMore && <Button variant="secondary" busy={busy} disabled={busy} onClick={onLoadMore}>Load more</Button>}</div>;
}

export function AdminEmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <section className="admin-empty-state"><span className="admin-empty-icon" aria-hidden="true"><SvgIcon name="grid" size={18} /></span><div><h2>{title}</h2><p>{description}</p>{action && <div className="admin-empty-action">{action}</div>}</div></section>;
}

export function AdminDetailTabs({ items, active }: { items: Array<{ key: string; label: string; href: string }>; active: string }) {
  return <nav className="admin-detail-tabs" aria-label="Record details">{items.map(item => <button key={item.key} type="button" aria-current={active === item.key ? 'page' : undefined} className={active === item.key ? 'active' : ''} onClick={() => { window.location.hash = item.href; }}>{item.label}</button>)}</nav>;
}

export function AdminActionMenu({ label = 'More actions', children }: { label?: string; children: ReactNode }) {
  const actions = Children.toArray(children).flatMap((child) => {
    if (isValidElement(child) && child.type === Fragment) return Children.toArray((child.props as { children?: ReactNode }).children);
    return [child];
  });
  if (!actions.length) return null;
  if (actions.length === 1) return <span className="admin-single-action">{actions[0]}</span>;
  return <span className="admin-action-group"><span className="admin-single-action">{actions[0]}</span><details className="admin-action-menu"><summary aria-label={label}>•••</summary><div onClick={(event) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a')) {
      const menu = target.closest('details') as HTMLDetailsElement | null;
      if (menu) menu.open = false;
    }
  }}>{actions.slice(1)}</div></details></span>;
}

export function AdminAuditTimeline({ rows }: { rows: Array<{ action: string; occurred_at: string; actor_user_id?: string | null }> }) {
  if (!rows.length) return <AdminEmptyState title="No audit records returned" description="The authorized detail response contains no audit events for this record." />;
  return <ol className="admin-audit-timeline">{rows.map((row, index) => <li key={`${row.action}-${row.occurred_at}-${index}`}><span className="admin-audit-marker" aria-hidden="true" /><div><strong>{row.action.replaceAll('_', ' ')}</strong><small>Actor {row.actor_user_id || 'not supplied'} · {formatIndiaDateTime(row.occurred_at)}</small></div></li>)}</ol>;
}
