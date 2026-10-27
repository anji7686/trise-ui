import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, PageHeader } from '@trise/ui';
import { operationsData, type Collection, type NotificationAttributes, type Resource } from './data';
import { SvgIcon } from './icons';
import { OperationsStatus as Status } from './operations-status';

type NotificationResource = Resource<NotificationAttributes>;

function errorText(error: unknown) { return (error as { message?: string })?.message || 'Platform notifications could not be loaded.'; }
function timeAgo(value?: string | null) {
  if (!value) return 'Time unavailable';
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const absolute = Math.abs(seconds);
  const unit: Intl.RelativeTimeFormatUnit = absolute < 60 ? 'second' : absolute < 3600 ? 'minute' : absolute < 86400 ? 'hour' : 'day';
  const divisor = unit === 'second' ? 1 : unit === 'minute' ? 60 : unit === 'hour' ? 3600 : 86400;
  return new Intl.RelativeTimeFormat(document.documentElement.lang || 'en', { numeric: 'auto' }).format(Math.round(seconds / divisor), unit);
}
function dateTime(value?: string | null) { return value ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(value)) : 'Time unavailable'; }

export function PlatformNotificationBell({ allowed }: { allowed: boolean }) {
  const [open, setOpen] = useState(false); const [items, setItems] = useState<NotificationResource[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [busyId, setBusyId] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null); const menuRef = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => { if (!allowed) return; setLoading(true); setError(''); try { const result = await operationsData.platformNotifications(); setItems(result.data.filter((item) => !item.attributes.read_at)); } catch (cause) { setError(errorText(cause)); } finally { setLoading(false); } }, [allowed]);
  useEffect(() => { setOpen(false); setItems([]); if (!allowed) return; void load(); const timer = window.setInterval(() => void load(), 60_000); return () => window.clearInterval(timer); }, [allowed, load]);
  useEffect(() => { if (!open) return; void load(); const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); } }; const onPointer = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener('keydown', onKey); document.addEventListener('pointerdown', onPointer); return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); }; }, [load, open]);
  async function markRead(id: string) { if (busyId) return; setBusyId(id); setError(''); try { await operationsData.markPlatformNotificationRead(id, crypto.randomUUID()); setItems((current) => current.filter((item) => item.id !== id)); } catch (cause) { setError(errorText(cause)); } finally { setBusyId(''); } }
  if (!allowed) return null;
  return <div className="notification-bell-anchor"><button ref={triggerRef} type="button" className="account-notifications notification-bell-trigger" aria-label={items.length ? `View ${items.length} unread platform notifications` : 'View platform notifications'} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}><SvgIcon name="bell" size={19} />{items.length > 0 && <span className="notification-badge" aria-label={`${items.length} unread`}>{items.length > 99 ? '99+' : items.length}</span>}</button>{open && <div ref={menuRef} className="notification-menu" role="dialog" aria-label="Platform notifications"><div className="notification-menu-heading"><div><strong>Platform notifications</strong><small>{items.length ? `${items.length} unread` : 'All caught up'}</small></div><button type="button" className="notification-refresh" onClick={() => void load()} aria-label="Refresh platform notifications" disabled={loading}><SvgIcon name="activity" size={15} /></button></div>{error && <p className="notification-error" role="alert">{error}</p>}{loading && !items.length && <p className="notification-state" role="status">Loading notifications…</p>}{!loading && !items.length && !error && <p className="notification-state" role="status">You’re all caught up.</p>}<div className="notification-list">{items.slice(0, 5).map((notification) => <button type="button" className="notification-row is-unread" key={notification.id} onClick={() => void markRead(notification.id)} disabled={busyId === notification.id}><span className="notification-row-dot" aria-hidden="true" /><span className="notification-row-copy"><strong>{notification.attributes.title}</strong><small>{notification.attributes.body}</small><em>{notification.attributes.category} · {timeAgo(notification.attributes.created_at)}</em></span><span className="notification-row-action" aria-hidden="true">{busyId === notification.id ? '…' : '✓'}</span></button>)}</div><div className="notification-menu-footer"><button type="button" className="notification-view-all" onClick={() => { setOpen(false); window.location.hash = 'platform/notifications'; }}>View all platform notifications <SvgIcon name="arrow-right" size={15} /></button></div></div>}</div>;
}

export function PlatformNotificationHistoryPage() {
  const [result, setResult] = useState<Collection<NotificationAttributes> | null>(null); const [error, setError] = useState(''); const [busyId, setBusyId] = useState(''); const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const load = useCallback(async () => { setError(''); try { setResult(await operationsData.platformNotifications()); } catch (cause) { setError(errorText(cause)); } }, []);
  useEffect(() => { setResult(null); void load(); }, [load]);
  async function markRead(id: string) { setBusyId(id); setError(''); try { const updated = await operationsData.markPlatformNotificationRead(id, crypto.randomUUID()); setResult((current) => current && { ...current, data: current.data.map((item) => item.id === id ? { ...item, attributes: { ...item.attributes, read_at: updated.attributes?.read_at || new Date().toISOString() } } : item) }); } catch (cause) { setError(errorText(cause)); } finally { setBusyId(''); } }
  const notifications = result?.data || [];
  const unreadCount = notifications.filter((item) => !item.attributes.read_at).length;
  const readCount = notifications.length - unreadCount;
  const visible = notifications.filter((item) => filter === 'all' || (filter === 'unread' ? !item.attributes.read_at : Boolean(item.attributes.read_at)));
  const pageHeader = <PageHeader title="Platform notifications" description="System alerts and review updates for your Global Administrator account." action={<Button type="button" variant="secondary" onClick={() => void load()} disabled={!result}>Refresh</Button>} />;
  if (!result && !error) return <section className="content platform-notification-page">{pageHeader}<div className="platform-notification-state" role="status"><span className="platform-notification-state-icon"><SvgIcon name="bell" size={22} /></span><strong>Loading platform notifications…</strong></div></section>;
  return <section className="content platform-notification-page">
    {pageHeader}
    {error && <p className="notification-error" role="alert">{error}<Button type="button" variant="quiet" onClick={() => void load()}>Retry</Button></p>}
    {result && <>
      <div className="platform-notification-summary" aria-label="Notification counts">
        <article><span>All notifications</span><strong>{notifications.length}</strong><small>Latest 25 delivered to your account</small></article>
        <article className="is-unread"><span>Unread</span><strong>{unreadCount}</strong><small>Awaiting your review</small></article>
        <article className="is-read"><span>Read</span><strong>{readCount}</strong><small>Already reviewed</small></article>
      </div>
      <section className="platform-notification-inbox" aria-label="Platform notification inbox">
        <div className="platform-notification-inbox-heading"><div><h2>Inbox</h2><p>Newest notifications appear first.</p></div><Status>{unreadCount ? `${unreadCount} unread` : 'Up to date'}</Status></div>
        <div className="platform-notification-filters" role="group" aria-label="Filter notifications">
          {(['all', 'unread', 'read'] as const).map((value) => <button type="button" key={value} className={filter === value ? 'is-active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value[0].toUpperCase() + value.slice(1)}<span>{value === 'all' ? notifications.length : value === 'unread' ? unreadCount : readCount}</span></button>)}
        </div>
        {visible.length ? <div className="platform-notification-list">{visible.map((notification) => <article className={`platform-notification-row${notification.attributes.read_at ? ' is-read' : ' is-unread'}`} key={notification.id}>
          <span className="platform-notification-row-icon" aria-hidden="true"><SvgIcon name="bell" size={17} /></span>
          <div className="platform-notification-row-copy"><div className="platform-notification-row-title"><h3>{notification.attributes.title}</h3><Status>{notification.attributes.read_at ? 'Read' : 'Unread'}</Status></div><p>{notification.attributes.body}</p><small>{notification.attributes.category.replaceAll('_', ' ')} · <time dateTime={notification.attributes.created_at || undefined} title={dateTime(notification.attributes.created_at)}>{timeAgo(notification.attributes.created_at)}</time></small></div>
          <div className="platform-notification-row-action">{notification.attributes.read_at ? <span>Read {dateTime(notification.attributes.read_at)}</span> : <Button type="button" variant="secondary" disabled={busyId === notification.id} onClick={() => void markRead(notification.id)}>{busyId === notification.id ? 'Saving…' : 'Mark read'}</Button>}</div>
        </article>)}</div> : <div className="platform-notification-empty" role="status"><span className="platform-notification-empty-icon"><SvgIcon name="bell" size={24} /></span><h3>{notifications.length === 0 ? 'No platform notifications yet' : `No ${filter} notifications`}</h3><p>{notifications.length === 0 ? 'System alerts and review updates will appear here when they are delivered to your account.' : `There are no ${filter} notifications in the latest results.`}</p>{filter !== 'all' && <Button type="button" variant="quiet" onClick={() => setFilter('all')}>View all notifications</Button>}</div>}
      </section>
    </>}
  </section>;
}
