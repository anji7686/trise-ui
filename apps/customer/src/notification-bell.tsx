import { useCallback, useEffect, useRef, useState } from 'react';
import { customerData, type NotificationAttributes, type ProviderAttributes, type Resource } from './data';

type NotificationResource = { providerId: string; resource: Resource<NotificationAttributes> };
function errorText(error: unknown) { return (error as { message?: string })?.message || 'Notifications could not be loaded.'; }
function timeAgo(value?: string | null) {
  if (!value) return 'Time unavailable';
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const absolute = Math.abs(seconds);
  const unit: Intl.RelativeTimeFormatUnit = absolute < 60 ? 'second' : absolute < 3600 ? 'minute' : absolute < 86400 ? 'hour' : 'day';
  const divisor = unit === 'second' ? 1 : unit === 'minute' ? 60 : unit === 'hour' ? 3600 : 86400;
  return new Intl.RelativeTimeFormat(document.documentElement.lang || 'en', { numeric: 'auto' }).format(Math.round(seconds / divisor), unit);
}

export function CustomerNotificationBell({ providers, onViewAll }: { providers: Resource<ProviderAttributes>[] | null; onViewAll: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const providersRef = useRef(providers); providersRef.current = providers;
  const requestRef = useRef<{ key: string; promise: Promise<NotificationResource[]> } | null>(null);
  const lastLoaded = useRef<{ key: string; at: number }>({ key: '', at: 0 });
  const providerKey = providers?.map(({ id }) => id).join('|') ?? 'loading';
  const providerNames = new Map((providers || []).map((provider) => [provider.id, provider.attributes.display_name || 'Service provider']));

  const load = useCallback(async (force = false) => {
    const currentProviders = providersRef.current;
    if (!currentProviders || currentProviders.length === 0) { setItems([]); return; }
    if (!force && lastLoaded.current.key === providerKey && Date.now() - lastLoaded.current.at < 15_000) return;
    if (requestRef.current?.key === providerKey) { try { setItems(await requestRef.current.promise); } catch (cause) { setError(errorText(cause)); } return; }
    setLoading(true); setError('');
    const promise = Promise.all(currentProviders.map(async ({ id }) => ({ providerId: id, page: await customerData.notifications(id, force, { limit: 25 }) })))
      .then((pages) => pages.flatMap(({ providerId, page }) => page.data.filter((item) => !item.attributes.read_at).map((resource) => ({ providerId, resource }))).sort((left, right) => (right.resource.attributes.created_at || '').localeCompare(left.resource.attributes.created_at || '')));
    requestRef.current = { key: providerKey, promise };
    try { setItems(await promise); lastLoaded.current = { key: providerKey, at: Date.now() }; }
    catch (cause) { setError(errorText(cause)); }
    finally { if (requestRef.current?.promise === promise) requestRef.current = null; setLoading(false); }
  }, [providerKey]);

  useEffect(() => { setItems([]); setOpen(false); setError(''); lastLoaded.current = { key: providerKey, at: 0 }; }, [providerKey]);
  useEffect(() => {
    const refreshUnread = () => { void load(true); };
    window.addEventListener('trise:customer-notifications-read', refreshUnread);
    return () => window.removeEventListener('trise:customer-notifications-read', refreshUnread);
  }, [load]);
  useEffect(() => {
    if (!open) return;
    void load();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); } };
    const onPointer = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey); document.addEventListener('pointerdown', onPointer);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
  }, [load, open]);

  async function markRead(item: NotificationResource) {
    const key = `${item.providerId}:${item.resource.id}`;
    if (busyKey) return;
    setBusyKey(key); setError('');
    try { await customerData.markNotificationRead(item.providerId, item.resource.id, crypto.randomUUID()); setItems((current) => current.filter(({ providerId, resource }) => `${providerId}:${resource.id}` !== key)); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusyKey(''); }
  }

  if (!providers) return null;
  return <div className="customer-notification-anchor">
    <button ref={triggerRef} type="button" className="icon-action customer-notification-trigger" aria-label={items.length ? `View ${items.length} unread notifications` : 'View notifications'} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {items.length > 0 && <span className="customer-notification-badge" aria-label={`${items.length} unread`}>{items.length > 99 ? '99+' : items.length}</span>}
    </button>
    {open && <div ref={menuRef} className="customer-notification-menu" role="dialog" aria-label="Notifications">
      <div className="customer-notification-heading"><strong>Account updates</strong><small>{items.length ? `${items.length} unread` : 'All caught up'}</small></div>
      {error && <p className="customer-notification-error" role="alert">{error}</p>}
      {loading && !items.length && <p className="customer-notification-state" role="status">Loading account updates…</p>}
      {!loading && !items.length && !error && <p className="customer-notification-state" role="status">You’re all caught up.</p>}
      <div className="customer-notification-list">{items.slice(0, 5).map((item) => { const key = `${item.providerId}:${item.resource.id}`; return <button type="button" className="customer-notification-row" key={key} onClick={() => void markRead(item)} disabled={busyKey === key}>
        <span className="customer-notification-dot" aria-hidden="true" />
        <span><strong>{item.resource.attributes.title}</strong><small>{item.resource.attributes.body}</small><em>{providerNames.get(item.providerId)} · {item.resource.attributes.category} · {timeAgo(item.resource.attributes.created_at)}</em></span>
        <span aria-hidden="true">{busyKey === key ? '…' : '✓'}</span>
      </button>; })}</div>
      <button type="button" className="customer-notification-view-all" onClick={() => { setOpen(false); onViewAll(); }}>View all updates</button>
    </div>}
  </div>;
}
