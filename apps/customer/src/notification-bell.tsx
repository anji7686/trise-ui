import { useCallback, useEffect, useRef, useState } from 'react';
import { customerData, type NotificationAttributes, type Resource } from './data';

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

export function CustomerNotificationBell({ providerId, onViewAll }: { providerId: string; onViewAll: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<{ providerId: string; promise: Promise<NotificationResource[]> } | null>(null);
  const lastLoadedAt = useRef(0);

  const load = useCallback(async (force = false) => {
    if (!providerId) return;
    if (!force && Date.now() - lastLoadedAt.current < 15_000) return;
    if (requestRef.current?.providerId === providerId) {
      try { setItems(await requestRef.current.promise); } catch (cause) { setError(errorText(cause)); }
      return;
    }
    setLoading(true);
    setError('');
    const promise = customerData.notifications(providerId, force).then((result) => result.data.filter((item) => !item.attributes.read_at));
    requestRef.current = { providerId, promise };
    try {
      setItems(await promise);
      lastLoadedAt.current = Date.now();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      if (requestRef.current?.promise === promise) requestRef.current = null;
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    setOpen(false);
    setItems([]);
    if (!providerId) return;
    void load();
    lastLoadedAt.current = 0;
    const timer = window.setInterval(() => void load(true), 60_000);
    return () => window.clearInterval(timer);
  }, [load, providerId]);

  useEffect(() => {
    if (!open) return;
    void load();
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
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [load, open]);

  async function markRead(notificationId: string) {
    if (busyId) return;
    setBusyId(notificationId);
    setError('');
    try {
      await customerData.markNotificationRead(providerId, notificationId, crypto.randomUUID());
      setItems((current) => current.filter((item) => item.id !== notificationId));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusyId('');
    }
  }

  if (!providerId) return null;
  return <div className="customer-notification-anchor">
    <button ref={triggerRef} type="button" className="icon-action customer-notification-trigger" aria-label={items.length ? `View ${items.length} unread notifications` : 'View notifications'} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {items.length > 0 && <span className="customer-notification-badge" aria-label={`${items.length} unread`}>{items.length > 99 ? '99+' : items.length}</span>}
    </button>
    {open && <div ref={menuRef} className="customer-notification-menu" role="dialog" aria-label="Notifications">
      <div className="customer-notification-heading"><strong>Notifications</strong><small>{items.length ? `${items.length} unread` : 'All caught up'}</small></div>
      {error && <p className="customer-notification-error" role="alert">{error}</p>}
      {loading && !items.length && <p className="customer-notification-state" role="status">Loading notifications…</p>}
      {!loading && !items.length && !error && <p className="customer-notification-state" role="status">You’re all caught up.</p>}
      <div className="customer-notification-list">{items.slice(0, 5).map((notification) => <button type="button" className="customer-notification-row" key={notification.id} onClick={() => void markRead(notification.id)} disabled={busyId === notification.id}>
        <span className="customer-notification-dot" aria-hidden="true" />
        <span><strong>{notification.attributes.title}</strong><small>{notification.attributes.body}</small><em>{notification.attributes.category} · {timeAgo(notification.attributes.created_at)}</em></span>
        <span aria-hidden="true">{busyId === notification.id ? '…' : '✓'}</span>
      </button>)}</div>
      <button type="button" className="customer-notification-view-all" onClick={() => { setOpen(false); onViewAll(); }}>View all notifications</button>
    </div>}
  </div>;
}
