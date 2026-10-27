import { useCallback, useEffect, useRef, useState } from 'react';
import { operationsData, type Collection, type NotificationAttributes, type Resource } from './data';
import { SvgIcon } from './icons';
import { PlatformNotificationBell } from './platform-notifications';

type NotificationResource = Resource<NotificationAttributes>;

function errorText(error: unknown) {
  return (error as { message?: string })?.message || 'Notifications could not be loaded.';
}

function timeAgo(value?: string | null) {
  if (!value) return 'Time unavailable';
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const absolute = Math.abs(seconds);
  const unit: Intl.RelativeTimeFormatUnit = absolute < 60 ? 'second' : absolute < 3600 ? 'minute' : absolute < 86400 ? 'hour' : 'day';
  const divisor = unit === 'second' ? 1 : unit === 'minute' ? 60 : unit === 'hour' ? 3600 : 86400;
  return new Intl.RelativeTimeFormat(document.documentElement.lang || 'en', { numeric: 'auto' }).format(Math.round(seconds / divisor), unit);
}

function dateTime(value?: string | null) {
  if (!value) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(value));
}

async function fetchNotifications(
  providerId: string,
  params: { limit?: number; unreadOnly?: boolean; forceRefresh?: boolean } = {},
) {
  return operationsData.notifications(providerId, params);
}

export function NotificationBell({ providerId, allowed, onViewAll }: { providerId: string; allowed: boolean; onViewAll: () => void }) {
  if (!providerId) return <PlatformNotificationBell allowed={allowed} />;
  return <ProviderNotificationBell providerId={providerId} allowed={allowed} onViewAll={onViewAll} />;
}

function ProviderNotificationBell({ providerId, allowed, onViewAll }: { providerId: string; allowed: boolean; onViewAll: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationResource[]>([]);
  const [hasMoreUnread, setHasMoreUnread] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (forceRefresh = false) => {
    if (!allowed || !providerId) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchNotifications(providerId, { limit: 5, unreadOnly: true, forceRefresh });
      setItems(result.data);
      setHasMoreUnread(Boolean(result.page?.next));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, [allowed, providerId]);

  useEffect(() => {
    setOpen(false);
    setItems([]);
    setHasMoreUnread(false);
    setError('');
    if (!allowed || !providerId) return;
    void load();
    const refreshOnFocus = () => void load();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [allowed, load, providerId]);

  useEffect(() => {
    const refresh = () => void load(true);
    window.addEventListener('trise-notifications-refresh', refresh);
    return () => window.removeEventListener('trise-notifications-refresh', refresh);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 60_000);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [load, open]);

  if (!allowed || !providerId) return null;

  async function markRead(notificationId: string) {
    if (busyId) return;
    setBusyId(notificationId);
    setError('');
    try {
      await operationsData.markNotificationRead(providerId, notificationId, crypto.randomUUID());
      await load(true);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusyId('');
    }
  }

  return <div className="notification-bell-anchor">
    <button ref={triggerRef} type="button" className="account-notifications notification-bell-trigger" aria-label={items.length ? `View ${items.length} unread notifications` : 'View notifications'} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <SvgIcon name="bell" size={19} />
      {items.length > 0 && <span className="notification-badge" aria-label={hasMoreUnread ? `${items.length} or more unread` : `${items.length} unread`}>{hasMoreUnread ? `${items.length}+` : items.length > 99 ? '99+' : items.length}</span>}
    </button>
    {open && <div ref={menuRef} className="notification-menu" role="dialog" aria-label="Notifications">
      <div className="notification-menu-heading"><div><strong>Notifications</strong><small>{items.length ? `${items.length}${hasMoreUnread ? '+' : ''} unread` : 'All caught up'}</small></div><button type="button" className="notification-refresh" onClick={() => void load(true)} aria-label="Refresh notifications" disabled={loading}><SvgIcon name="activity" size={15} /></button></div>
      {error && <p className="notification-error" role="alert">{error}</p>}
      {loading && !items.length && <p className="notification-state" role="status">Loading notifications…</p>}
      {!loading && !items.length && !error && <p className="notification-state" role="status">You’re all caught up.</p>}
      <div className="notification-list">{items.slice(0, 5).map((notification) => <button type="button" className="notification-row is-unread" key={notification.id} onClick={() => void markRead(notification.id)} disabled={busyId === notification.id}>
        <span className="notification-row-dot" aria-hidden="true" />
        <span className="notification-row-copy"><strong>{notification.attributes.title}</strong><small>{notification.attributes.body}</small><em>{notification.attributes.category} · {timeAgo(notification.attributes.created_at)}</em></span>
        <span className="notification-row-action" aria-hidden="true">{busyId === notification.id ? '…' : '✓'}</span>
      </button>)}</div>
      <div className="notification-menu-footer"><button type="button" className="notification-view-all" onClick={() => { setOpen(false); onViewAll(); }}>View all notifications <SvgIcon name="arrow-right" size={15} /></button></div>
    </div>}
  </div>;
}

export function NotificationHistoryPage({ providerId }: { providerId: string }) {
  const [result, setResult] = useState<Collection<NotificationAttributes> | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setResult(await fetchNotifications(providerId));
    } catch (cause) {
      setError(errorText(cause));
    }
  }, [providerId]);

  useEffect(() => {
    setResult(null);
    void load();
  }, [load]);

  async function markRead(notificationId: string) {
    setBusyId(notificationId);
    setError('');
    try {
      const updated = await operationsData.markNotificationRead(providerId, notificationId, crypto.randomUUID());
      setResult((current) => current && { ...current, data: current.data.map((item) => item.id === notificationId ? { ...item, attributes: { ...item.attributes, read_at: updated.attributes?.read_at || new Date().toISOString() } } : item) });
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusyId('');
    }
  }

  if (error && !result) return <section className="content"><p className="notification-error" role="alert">{error}</p><button type="button" className="button" onClick={() => void load()}>Retry</button></section>;
  if (!result) return <section className="content"><p className="notification-state" role="status">Loading notifications…</p></section>;
  return <section className="content notification-history"><div className="section-heading"><div><span className="status">Provider notifications</span><h2>Notification history</h2></div><button type="button" className="text-button" onClick={() => void load()}>Refresh</button></div>{error && <p className="notification-error" role="alert">{error}</p>}{result.data.length === 0 ? <p className="notification-state">No notifications are available for this provider context.</p> : <div className="notification-history-list">{result.data.map((notification) => <article className={`notification-history-row${notification.attributes.read_at ? ' is-read' : ' is-unread'}`} key={notification.id}><span className="notification-row-dot" aria-hidden="true" /><div className="notification-row-copy"><strong>{notification.attributes.title}</strong><small>{notification.attributes.body}</small><em>{notification.attributes.category} · <time dateTime={notification.attributes.created_at || undefined} title={dateTime(notification.attributes.created_at)}>{timeAgo(notification.attributes.created_at)}</time></em></div><div className="notification-history-action">{notification.attributes.read_at ? <span>Read</span> : <button type="button" className="notification-read-button" onClick={() => void markRead(notification.id)} disabled={busyId === notification.id}>{busyId === notification.id ? 'Saving…' : 'Mark read'}</button>}</div></article>)}</div>}</section>;
}
