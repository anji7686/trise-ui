import { StrictMode, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, GoogleSignInButton, useAuth } from '@trise/auth';
import { apiClient } from '@trise/api-client';
import { translate, type Locale } from '@trise/i18n';
import { Button, Status, TriseBrandHeader, SortedSelect } from '@trise/ui';
import '@trise/tokens/theme.css';
import './styles.css';
import './customer-portal.css';
import './brand-background.css';
import './workflow.css';
import '../../../packages/ui-primitives/src/primitives.css';
import { buildBookingPayload, customerData, type AssetAttributes, type BookingAttributes, type Collection, type ContractAttributes, type DocumentAttributes, type DocumentVersionAttributes, type InstallationProjectAttributes, type Link, type LocationAttributes, type NotificationAttributes, type ProviderAttributes, type RequestAttributes, type Resource, type ServiceJobAttributes, type ServiceTypeAttributes, type WarrantyAttributes } from './data';
import { CustomerNotificationBell } from './notification-bell';
import { QuotationProgress, QuotationsPage, QuotationReviewPage } from './quotation-review';

apiClient.setWebClientApp('customer');

type Theme = 'system' | 'light' | 'dark';
type View = { name: 'home' | 'providers' | 'assets' | 'asset' | 'request' | 'bookings' | 'requests' | 'request-detail' | 'projects' | 'alerts' | 'profile' | 'quotations' | 'quotation' | 'coverage' | 'documents' | 'document'; id?: string };
const BUSINESS_TIME_ZONE = 'Asia/Kolkata';
function formatIndiaDateTime(value: string | Date) { const date = value instanceof Date ? value : new Date(value); return new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(date); }
function formatIndiaDate(value: string | Date) { const date = value instanceof Date ? value : new Date(value); return new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIME_ZONE, dateStyle: 'medium' }).format(date); }

function readView(): View {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'service-providers') return { name: 'providers' };
  if (parts[0] === 'asset' && parts[1] && parts[2] === 'request') return { name: 'request', id: parts[1] };
  if (parts[0] === 'asset' && parts[1]) return { name: 'asset', id: parts[1] };
  if (parts[0] === 'bookings') return { name: 'bookings' };
  if (parts[0] === 'requests') return { name: 'requests' };
  if (parts[0] === 'request' && parts[1]) return { name: 'request-detail', id: parts[1] };
  if (parts[0] === 'projects') return { name: 'projects' };
  if (parts[0] === 'alerts') return { name: 'alerts' };
  if (parts[0] === 'profile') return { name: 'profile' };
  if (parts[0] === 'quotation' && parts[1]) return { name: 'quotation', id: parts[1] };
  if (parts[0] === 'quotations') return { name: 'quotations' };
  if (parts[0] === 'coverage') return { name: 'coverage' };
  if (parts[0] === 'documents' && parts[1]) return { name: 'document', id: parts[1] };
  if (parts[0] === 'documents') return { name: 'documents' };
  if (parts[0] === 'assets') return { name: 'assets' };
  return { name: 'home' };
}

function go(path: string) { window.location.hash = path; }
function errorText(error: unknown) { return (error as { message?: string })?.message || 'The API request could not be completed.'; }

function Shell() {
  const { session, loading: authLoading, error: authError, signOut, setProvider, refreshCurrentUser } = useAuth();
  const [theme, setTheme] = useState<Theme>((localStorage.getItem('trise-theme') as Theme) || 'system');
  const [locale, setLocale] = useState<Locale>((localStorage.getItem('trise-locale') as Locale) || 'en');
  const [view, setView] = useState<View>(readView);
  const [compactHeader, setCompactHeader] = useState(false);
  const [providers, setProviders] = useState<Collection<ProviderAttributes> | null>(null);
  const [providerId, setProviderId] = useState('');
  const [contextReady, setContextReady] = useState(true);
  const t = (key: string) => translate(locale, key);

  useEffect(() => { const onHash = () => setView(readView()); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  useEffect(() => { const onScroll = () => setCompactHeader(window.scrollY > 20); onScroll(); window.addEventListener('scroll', onScroll, { passive: true }); return () => window.removeEventListener('scroll', onScroll); }, []);
  useEffect(() => { const media = matchMedia('(prefers-color-scheme: dark)'); const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme; }; apply(); localStorage.setItem('trise-theme', theme); if (theme === 'system') media.addEventListener('change', apply); return () => media.removeEventListener('change', apply); }, [theme]);
  useEffect(() => { localStorage.setItem('trise-locale', locale); document.documentElement.lang = locale; document.documentElement.dir = 'ltr'; }, [locale]);
  useEffect(() => { if (!session) { setProviders(null); return; } customerData.providers().then(setProviders).catch(() => setProviders({ data: [] })); }, [session]);
  useEffect(() => { if (providerId) { sessionStorage.setItem('trise-customer-provider', providerId); setProvider(providerId); } else { sessionStorage.removeItem('trise-customer-provider'); setProvider(undefined); } setContextReady(true); }, [providerId, setProvider]);

  if (authLoading) return <main className="app-shell"><section className="notice"><Status>{t('loading')}</Status><p>{t('loading')}</p></section></main>;
  if (!session) return view.name === 'quotation'
    ? <main className="app-shell quotation-app-shell"><header className="quotation-app-header"><Wordmark variant="light" /><div className="quotation-app-header-right"><span className="quotation-secure-pill"><i />Secure quotation review</span></div></header><section className="quotation-login-intro"><Status>Customer quotation experience · secure review</Status><h1>Review and respond to a quotation</h1><p>Your secure link will return you to this exact quotation revision after sign-in.</p></section><QuotationProgress activeStep={2} /><section className="quotation-login-card"><div className="quotation-login-brand"><Wordmark /><h2>Your quotation is waiting in your secure account.</h2><p>We’ll verify your customer relationship before showing quotation details. Sign-in does not accept or change the quotation.</p></div><div className="quotation-login-form"><Status>Quotation access</Status><h2>Sign in to TRISE</h2><p>{authError || 'Continue with your existing TRISE customer account to securely review the quotation.'}</p><GoogleSignInButton /><small>Quotation details stay private until your account and customer relationship are verified.</small></div></section></main>
    : <CustomerLoginPage authError={authError} />;

  const providerOptions = providers?.data || [];
  const quotationPortal = view.name === 'quotation' || view.name === 'quotations';
  const chooseProvider = (id: string) => { setContextReady(false); setProviderId(id); };
  const providerDirectory = <ProviderDirectoryPage providers={providers ? providerOptions : null} activeProviderId={providerId} onSelect={(id) => { chooseProvider(id); if (!quotationPortal) go('/'); }} t={t} />;
  const content = view.name === 'providers'
    ? providerDirectory
    : view.name === 'profile'
      ? <ProfilePage session={session} refreshCurrentUser={refreshCurrentUser} locale={locale} setLocale={setLocale} theme={theme} setTheme={setTheme} t={t} />
    : view.name === 'home' ? <CustomerHome providerId={providerId || undefined} providers={providers?.data ?? null} displayName={session.displayName} onSelectProvider={chooseProvider} t={t} />
    : view.name === 'assets' ? providerId ? <AssetList providerId={providerId} t={t} /> : <CustomerAssetsAcrossProviders providers={providers ? providerOptions : null} onSelectProvider={chooseProvider} t={t} />
    : view.name === 'bookings' ? providerId ? !contextReady ? <DataState message={t('loading')} t={t} /> : <BookingList providerId={providerId} t={t} /> : <CustomerBookingsAcrossProviders providers={providers ? providerOptions : null} onSelectProvider={chooseProvider} t={t} />
    : !providerId ? providerDirectory
    : !contextReady ? <DataState message={t('loading')} t={t} />
    : view.name === 'asset' ? <AssetDetail providerId={providerId} id={view.id!} t={t} />
    : view.name === 'request' ? <RequestForm providerId={providerId} assetId={view.id!} t={t} />
    : view.name === 'requests' ? <RequestList providerId={providerId} t={t} />
    : view.name === 'request-detail' ? <RequestDetail providerId={providerId} id={view.id!} t={t} />
    : view.name === 'projects' ? <InstallationProjectsPage providerId={providerId} t={t} />
    : view.name === 'alerts' ? <NotificationsPage providerId={providerId} t={t} />
    : view.name === 'quotations' ? <QuotationsPage providerId={providerId} t={t} />
    : view.name === 'quotation' ? <QuotationReviewPage providerId={providerId} id={view.id!} t={t} />
    : view.name === 'coverage' ? <CoveragePage providerId={providerId} t={t} />
    : view.name === 'documents' ? <DocumentsPage providerId={providerId} t={t} />
    : view.name === 'document' ? <DocumentDetail providerId={providerId} id={view.id!} t={t} />
    : <CustomerBookingsAcrossProviders providers={providers ? providerOptions : null} onSelectProvider={chooseProvider} t={t} />;

  if (quotationPortal) return <main className="app-shell quotation-app-shell"><header className="quotation-app-header"><Wordmark variant="light" /><div className="quotation-app-header-right"><span className="quotation-secure-pill"><i />Secure quotation review</span><CustomerNotificationBell providerId={providerId} onViewAll={() => go('/alerts')} /><CustomerProfileMenu displayName={session.displayName} onSignOut={() => void signOut()} /></div></header>{content}</main>;

  return <main className="app-shell customer-app-shell">
    <header className={`customer-header${compactHeader ? ' is-compact' : ''}`}><div className="customer-brand"><Wordmark variant="dark" /></div><div className="customer-header-actions"><CustomerNotificationBell providerId={providerId} onViewAll={() => go('/alerts')} /><CustomerProfileMenu displayName={session.displayName} onSignOut={() => void signOut()} /></div></header>
    <div className="customer-layout"><aside className="customer-sidebar"><CustomerNavigation view={view} t={t} /></aside><section className="customer-workspace">{content}</section></div>
    <footer className="customer-footer"><span>TRISE Customer Portal</span><span className="customer-footer-tag" aria-label="Terms and Conditions">T&amp;C</span></footer>
  </main>;
}

function CustomerLoginPage({ authError }: { authError: string | null }) {
  return <main className="app-shell customer-login-shell">
    <header className="customer-login-header"><Wordmark variant="dark" /></header>
    <div className="customer-login-layout">
      <section className="customer-login-story">
        <span className="customer-login-eyebrow">CUSTOMER ACCESS</span>
        <h1>Service care that follows your asset.</h1>
        <p>One secure place for your assets, service updates, quotations and provider relationships.</p>
        <div className="customer-login-assurance"><CustomerNavIcon name="coverage" /><span>Your account only shows records you are authorized to access.</span></div>
        <CustomerOverviewArt />
      </section>
      <section className="customer-login-card" aria-labelledby="customer-login-title">
        <Status>Secure sign-in</Status>
        <h2 id="customer-login-title">Welcome to TRISE</h2>
        <p>Sign in to continue to your customer account.</p>
        {authError && <p className="customer-login-error" role="alert">{authError}</p>}
        <GoogleSignInButton />
        <small className="customer-login-privacy">Your assets and service records stay private until your identity and customer relationship are verified.</small>
      </section>
    </div>
    <footer className="customer-footer"><span>TRISE Customer Portal</span><span className="customer-footer-tag" aria-label="Terms and Conditions">T&amp;C</span></footer>
  </main>;
}

function CustomerNavigation({ view, t }: { view: View; t: T }) {
  const groups: Array<{ label: string; links: Array<{ name: string; route: string; title: string; icon: CustomerNavIconName }> }> = [
    { label: 'Workspace', links: [{ name: 'home', route: '/', title: 'Overview', icon: 'home' }, { name: 'assets', route: '/assets', title: t('assets'), icon: 'assets' }, { name: 'bookings', route: '/bookings', title: 'Service & bookings', icon: 'bookings' }, { name: 'requests', route: '/requests', title: 'Service requests', icon: 'requests' }, { name: 'projects', route: '/projects', title: 'Projects', icon: 'projects' }, { name: 'quotations', route: '/quotations', title: 'Quotations & approvals', icon: 'quotations' }, { name: 'coverage', route: '/coverage', title: 'AMC & warranty', icon: 'coverage' }, { name: 'documents', route: '/documents', title: 'Documents', icon: 'documents' }] },
    { label: 'Account', links: [{ name: 'providers', route: '/service-providers', title: 'My providers', icon: 'providers' }, { name: 'alerts', route: '/alerts', title: t('alerts'), icon: 'alerts' }, { name: 'profile', route: '/profile', title: t('profile'), icon: 'profile' }] },
  ];
  const activeName = view.name === 'asset' || view.name === 'request' ? 'assets' : view.name === 'request-detail' ? 'requests' : view.name === 'document' ? 'documents' : view.name;
  const allLinks = groups.flatMap((group) => group.links);
  const primaryLinks = allLinks.filter((link) => ['home', 'assets', 'bookings'].includes(link.name));
  const moreLinks = allLinks.filter((link) => !['home', 'assets', 'bookings'].includes(link.name));
  return <>
    <nav className="customer-navigation" aria-label="Customer navigation">{groups.map((group) => <div className="customer-navigation-group" key={group.label}><p>{group.label}</p>{group.links.map((link) => <button type="button" key={link.name} className={activeName === link.name ? 'active' : ''} aria-current={activeName === link.name ? 'page' : undefined} onClick={() => go(link.route)}><span className="customer-nav-icon-wrap" aria-hidden="true"><CustomerNavIcon name={link.icon} /></span>{link.title}</button>)}</div>)}</nav>
    <nav className="customer-mobile-navigation" aria-label="Customer mobile navigation">{primaryLinks.map((link) => <button type="button" key={link.name} className={activeName === link.name ? 'active' : ''} aria-current={activeName === link.name ? 'page' : undefined} onClick={() => go(link.route)}><CustomerNavIcon name={link.icon} /><span>{link.name === 'home' ? 'Overview' : link.name === 'bookings' ? 'Services' : link.title}</span></button>)}<details className="customer-mobile-more"><summary className={moreLinks.some((link) => link.name === activeName) ? 'active' : ''} aria-label="More navigation options"><CustomerNavIcon name="more" /><span>More</span></summary><div className="customer-mobile-more-panel">{moreLinks.map((link) => <button type="button" key={link.name} className={activeName === link.name ? 'active' : ''} aria-current={activeName === link.name ? 'page' : undefined} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); go(link.route); }}><CustomerNavIcon name={link.icon} /><span>{link.title}</span></button>)}</div></details></nav>
  </>;
}

type CustomerNavIconName = 'home' | 'providers' | 'assets' | 'bookings' | 'requests' | 'projects' | 'quotations' | 'coverage' | 'documents' | 'alerts' | 'profile' | 'logout' | 'more' | 'theme-system' | 'theme-light' | 'theme-dark';
function CustomerNavIcon({ name }: { name: CustomerNavIconName }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<CustomerNavIconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-7h6v7"/></>,
    providers: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c.5-3.3 2.6-5 6-5s5.5 1.7 6 5m1-4c2.8-.1 4.3 1.2 5 3"/></>,
    assets: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8v8H8zM12 8v8m-4-4h8"/></>,
    bookings: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h2m3 0h2m-7 4h2"/></>,
    requests: <><path d="M5 19 19 5M7 5h12v12"/><path d="M5 10v9h9"/></>,
    projects: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8m-8 4h8m-8 4h5"/></>,
    quotations: <><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5m-9 3h6m-6 4h6"/></>,
    coverage: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    documents: <><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7m-7 4h7"/></>,
    alerts: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    logout: <><path d="M10 17l5-5-5-5m5 5H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></>,
    more: <><circle cx="5" cy="5" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="19" cy="5" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="19" r="1"/><circle cx="12" cy="19" r="1"/><circle cx="19" cy="19" r="1"/></>,
    'theme-system': <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></>,
    'theme-light': <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    'theme-dark': <><path d="M20.5 14.4A8.5 8.5 0 0 1 9.6 3.5 8.5 8.5 0 1 0 20.5 14.4Z"/></>
  };
  return <svg className="customer-nav-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}>{paths[name]}</svg>;
}

function Wordmark({ variant = 'dark' }: { variant?: 'dark' | 'light' }) { return <div className="wordmark"><TriseBrandHeader variant={variant} /></div>; }
function CustomerProfileMenu({ displayName, onSignOut }: { displayName: string; onSignOut: () => void }) {
  return <details className="customer-profile-menu"><summary aria-label="Open profile menu"><span className="avatar" aria-hidden="true">{displayName.trim().slice(0, 1).toUpperCase() || 'C'}</span><span className="customer-profile-name">{displayName}</span><span className="customer-profile-chevron" aria-hidden="true">⌄</span></summary><div className="customer-profile-popover"><div className="customer-profile-identity"><strong>{displayName}</strong><small>Customer account</small></div><button type="button" onClick={() => go('/profile')}><CustomerNavIcon name="profile" />View profile details</button><button type="button" onClick={onSignOut}><CustomerNavIcon name="logout" />Logout</button></div></details>;
}
function ProviderDirectoryPage({ providers, activeProviderId, onSelect, t }: { providers: Resource<ProviderAttributes>[] | null; activeProviderId: string; onSelect: (id: string) => void; t: T }) {
  return <section className="content provider-directory"><div className="section-heading"><div><Status>Customer account</Status><h2>My service providers</h2></div></div><p className="provider-directory-intro">Your customer account can connect with multiple service providers. Choose a relationship to view its assets, requests, quotations, and service history.</p>{providers === null ? <DataState message={t('loading')} t={t} /> : providers.length ? <div className="record-grid">{providers.map((provider) => <article className="record-card provider-card" key={provider.id}><span className="provider-card-mark" aria-hidden="true">◎</span><strong>{provider.attributes.display_name || 'Service provider'}</strong><span>Authorized customer relationship</span><button type="button" className="provider-card-action" aria-pressed={activeProviderId === provider.id} onClick={() => onSelect(provider.id)}>{activeProviderId === provider.id ? 'Current provider' : 'View service data'}<span aria-hidden="true">→</span></button></article>)}</div> : <DataState message={t('noProvider')} t={t} />}</section>;
}
type T = (key: string) => string;
type ProviderBooking = { booking: Resource<BookingAttributes>; providerId: string };

function CustomerOverviewArt() {
  return <svg className="customer-overview-art" viewBox="0 0 250 180" fill="none" aria-hidden="true" focusable="false">
    <path d="M16 157h218M42 154V69l71-28 55 27v86M113 42v112m-71-84 71 26 55-26M62 90v12m20-4v12m-20 5v12m20-4v12m29-44v12m23-18v12m-23 10v12m23-18v12M91 154v-24l18 7v17m83 0v-46l25-11v57" />
    <path d="m28 55 9 9 16-18" className="overview-art-accent"/><circle cx="42" cy="56" r="23" className="overview-art-accent-ring"/>
    <circle cx="194" cy="39" r="22" className="overview-art-badge"/><path d="m185 39 6 6 12-14" className="overview-art-check"/>
    <path d="M171 13h37m-18-13v30M35 28l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z" className="overview-art-detail"/>
  </svg>;
}

function CustomerAssetIcon() {
  return <svg className="customer-asset-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h12v18H6zM9 7h6M9 11h6M10 16l2-2 2 2M12 14v5" /></svg>;
}

function CustomerHome({ providerId, providers, displayName, onSelectProvider, t }: { providerId?: string; providers: Resource<ProviderAttributes>[] | null; displayName: string; onSelectProvider: (id: string) => void; t: T }) {
  const [assets, setAssets] = useState<Collection<AssetAttributes> | null>(null);
  const [bookings, setBookings] = useState<ProviderBooking[] | null>(null);
  const [requests, setRequests] = useState<Collection<RequestAttributes> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setAssets(null); setBookings(null); setRequests(null); setError('');
    if (providerId) {
      Promise.all([customerData.assets(providerId, { limit: 3 }), customerData.bookings(providerId), customerData.requests(providerId, { limit: 3 })])
        .then(([assetResult, bookingResult, requestResult]) => { if (active) { setAssets(assetResult); setBookings(bookingResult.data.map((booking) => ({ booking, providerId }))); setRequests(requestResult); } })
        .catch((cause) => { if (active) setError(errorText(cause)); });
    } else if (providers) {
      Promise.all(providers.map(async (provider) => ({ providerId: provider.id, assets: await customerData.assets(provider.id, { limit: 3 }), bookings: await customerData.bookings(provider.id) })))
        .then((results) => {
          if (!active) return;
          const allAssets = results.flatMap((result) => result.assets.data).sort((left, right) => right.attributes.created_at.localeCompare(left.attributes.created_at) || left.id.localeCompare(right.id));
          setAssets({ data: allAssets.slice(0, 3), page: { next: results.some((result) => result.assets.page?.next) ? 'more-authorized-assets' : null } });
          setBookings(results.flatMap((result) => result.bookings.data.map((booking) => ({ booking, providerId: result.providerId }))));
        })
        .catch((cause) => { if (active) setError(errorText(cause)); });
    }
    return () => { active = false; };
  }, [providerId, providers]);
  if (error) return <DataState message={error} t={t} />;
  if (!assets || !bookings || (providerId && !requests)) return <DataState message={t('loading')} t={t} />;

  const upcomingItem = bookings.filter(({ booking }) => ['CONFIRMED', 'RESCHEDULED'].includes(booking.attributes.status) && new Date(booking.attributes.requested_window.starts_at).getTime() >= Date.now()).sort((left, right) => new Date(left.booking.attributes.requested_window.starts_at).getTime() - new Date(right.booking.attributes.requested_window.starts_at).getTime())[0];
  const upcoming = upcomingItem?.booking;
  const upcomingDate = upcoming ? new Date(upcoming.attributes.requested_window.starts_at) : null;
  const upcomingAssetRelation = upcoming?.relationships.asset;
  const upcomingAssetId = Array.isArray(upcomingAssetRelation) ? upcomingAssetRelation[0]?.id : upcomingAssetRelation && 'id' in upcomingAssetRelation ? upcomingAssetRelation.id : undefined;
  const upcomingAsset = upcomingAssetId ? assets.data.find((asset) => asset.id === upcomingAssetId) : undefined;
  const stats: Array<{ label: string; count: number | string; icon: CustomerNavIconName; route: string }> = providerId ? [
    { label: 'Assets in your care', count: `${assets.data.length}${assets.page?.next ? '+' : ''}`, icon: 'assets', route: '/assets' },
    { label: 'Upcoming visit', count: upcoming ? '1' : '—', icon: 'bookings', route: '/bookings' },
    { label: 'Recent requests', count: `${requests?.data.length || 0}${requests?.page?.next ? '+' : ''}`, icon: 'requests', route: '/requests' },
    { label: 'Quotation decisions', count: 'View', icon: 'quotations', route: '/quotations' }
  ] : [
    { label: 'Assets in your care', count: `${assets.data.length}${assets.page?.next ? '+' : ''}`, icon: 'assets', route: '/assets' },
    { label: 'Associated providers', count: providers?.length ?? '—', icon: 'providers', route: '/service-providers' },
    { label: 'Service & bookings', count: 'View', icon: 'bookings', route: '/bookings' },
    { label: 'Service requests', count: 'View', icon: 'requests', route: '/requests' }
  ];

  return <section className="customer-home">
    <div className="customer-overview-hero"><div className="customer-overview-hero-copy"><div className="customer-overview-meta"><div className="customer-overview-eyebrow">YOUR EVERYDAY, TAKEN CARE OF</div><span className="customer-overview-date">{formatIndiaDate(new Date())}</span></div><h1>{t('greeting')}, {displayName}.</h1><p>One place for your assets, trusted service and everything that comes after.</p><Button onClick={() => { const asset = assets.data[0]; if (asset && !providerId) onSelectProvider(asset.attributes.provider_id); go(asset ? `/asset/${asset.id}/request` : '/assets'); }}>{t('bookService')}</Button><span className="customer-overview-tag"><CustomerNavIcon name="coverage" />Care that stays connected</span></div><CustomerOverviewArt /></div>
    <div className="customer-overview-stats" aria-label="Account overview">{stats.map((item) => <button className="customer-overview-stat" type="button" key={item.label} onClick={() => go(item.route)}><span className="overview-stat-icon"><CustomerNavIcon name={item.icon} /></span><span className="overview-stat-value">{item.count}</span><span className="overview-stat-label">{item.label}</span></button>)}</div>
    <div className="customer-overview-columns">
      <div className="customer-overview-main">
        <section className="home-card upcoming-card"><div className="card-title"><div><h2>{t('upcomingVisit')}</h2><p>{providerId ? 'Your next confirmed service appointment.' : 'Appointments across your service relationships.'}</p></div><Status>{upcoming?.attributes.status || '—'}</Status></div>{upcoming && upcomingDate ? <div className="upcoming-visit-row"><div className="upcoming-date-tile"><small>{new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIME_ZONE, month: 'short' }).format(upcomingDate)}</small><strong>{new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIME_ZONE, day: '2-digit' }).format(upcomingDate)}</strong><small>{new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIME_ZONE, weekday: 'short' }).format(upcomingDate)}</small></div><div className="upcoming-visit-details"><strong>{upcoming.attributes.summary}</strong><span>{upcomingAsset ? `${upcomingAsset.attributes.name} · ` : ''}{formatIndiaDateTime(upcoming.attributes.requested_window.starts_at)}</span>{!providerId && <small>{providers?.find((provider) => provider.id === upcomingItem.providerId)?.attributes.display_name || 'Authorized service provider'}</small>}<small>Ends {formatIndiaDateTime(upcoming.attributes.requested_window.ends_at)}</small><button className="text-button" onClick={() => go('/bookings')}>View service bookings →</button></div></div> : <div className="overview-activity-empty"><span className="overview-activity-icon"><CustomerNavIcon name="bookings" /></span><div><strong>{t('noUpcomingVisit')}</strong><p>Confirmed appointments will appear here.</p></div><button className="text-button" onClick={() => go('/bookings')}>View service bookings →</button></div>}</section>
        <section className="overview-assets-section"><div className="section-heading"><div><Status>{t('assets')}</Status><h2>Assets you care about</h2><p>Quick access to the assets linked to your account.</p></div><button className="text-button" onClick={() => go('/assets')}>{t('view')} all <span aria-hidden="true">→</span></button></div>{assets.data.length ? <div className="home-asset-grid">{assets.data.slice(0, 3).map((asset) => { const identifier = asset.attributes.identifiers?.find((item) => item.value); return <button className="home-asset-card overview-asset-card" type="button" key={asset.id} onClick={() => { if (!providerId) onSelectProvider(asset.attributes.provider_id); go(`/asset/${asset.id}`); }} aria-label={`View ${asset.attributes.name} details`}><span className="overview-asset-top"><span className="overview-asset-icon"><CustomerAssetIcon /></span><span className="overview-asset-status">{asset.attributes.status.replaceAll('_', ' ')}</span></span><strong>{asset.attributes.name}</strong><span className="overview-asset-identifier">{identifier ? `${identifier.kind || 'Identifier'} · ${identifier.value}` : 'Asset details available'}</span><span className="overview-asset-footer">View asset details <CustomerNavIcon name="requests" /></span></button>; })}</div> : <DataState message={t('empty')} t={t} />}</section>
      </div>
      <aside className="customer-overview-aside">
        <section className="home-card quick-decision-card"><div className="card-title"><div><h2>Quotation decisions</h2><p>Review sent quotations and respond securely.</p></div><span className="overview-decision-icon"><CustomerNavIcon name="quotations" /></span></div>{providerId ? <button className="text-button" onClick={() => go('/quotations')}>View quotations →</button> : <button className="text-button" onClick={() => go('/service-providers')}>Choose a provider to view quotations →</button>}</section>
        <section className="home-card connected-links"><div className="card-title"><h2>Everything, connected</h2></div>{providerId ? <div className="overview-scan-row"><CustomerNavIcon name="assets" /><span><strong>Find or scan an asset</strong><small>Use its code to find the right record.</small></span><ScanAsset providerId={providerId} t={t} /></div> : <div className="overview-activity-empty"><span className="overview-activity-icon"><CustomerNavIcon name="assets" /></span><div><strong>Find an asset across your relationships</strong><p>Choose a provider to look up an asset code.</p></div><button className="text-button" onClick={() => go('/service-providers')}>My providers →</button></div>}<button className="overview-link-row" onClick={() => go('/documents')}><CustomerNavIcon name="documents" /><span><strong>Service documents</strong><small>Reports and shared files.</small></span><span aria-hidden="true">›</span></button><button className="overview-link-row" onClick={() => go('/coverage')}><CustomerNavIcon name="coverage" /><span><strong>Warranty and AMC</strong><small>See your available coverage.</small></span><span aria-hidden="true">›</span></button></section>
        <section className="home-card recent-activity-card"><div className="card-title"><div><h2>{t('recentActivity')}</h2><p>Your latest service requests.</p></div>{providerId && <button className="text-button" onClick={() => go('/requests')}>{t('view')} all <span aria-hidden="true">→</span></button>}</div>{!providerId ? <div className="overview-activity-empty"><span className="overview-activity-icon"><CustomerNavIcon name="requests" /></span><div><strong>View activity by provider</strong><p>Choose a service provider to see requests and updates.</p></div><button className="text-button" onClick={() => go('/service-providers')}>My providers →</button></div> : requests?.data.length ? <div className="overview-activity-list">{requests.data.slice(0, 3).map((request) => <button className="overview-activity-row" type="button" key={request.id} onClick={() => go(`/request/${request.id}`)} aria-label={`${request.attributes.summary}, ${request.attributes.status}`}><span className="overview-activity-icon"><CustomerNavIcon name="requests" /></span><span className="overview-activity-copy"><strong>{request.attributes.summary}</strong><span className="overview-activity-status">{request.attributes.status.replaceAll('_', ' ')}</span></span><time dateTime={request.attributes.created_at}>{formatIndiaDate(request.attributes.created_at)}</time></button>)}</div> : <div className="overview-activity-empty"><span className="overview-activity-icon"><CustomerNavIcon name="requests" /></span><div><strong>No recent service requests</strong><p>New requests and updates will appear here.</p></div><button className="text-button" onClick={() => go('/requests')}>View requests →</button></div>}</section>
      </aside>
    </div>
  </section>;
}

function ScanAsset({ providerId, t }: { providerId: string; t: T }) { const [open, setOpen] = useState(false); const [code, setCode] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); async function resolve() { setBusy(true); setMessage(''); try { const result = await customerData.resolveIdentifier(providerId, code.trim()); const asset = result.resource; if (!asset) throw new Error('The identifier did not resolve to an authorized asset.'); go(`/asset/${asset.id}`); } catch (cause) { setMessage(errorText(cause)); } finally { setBusy(false); } } return <div className="scan-action"><Button onClick={() => setOpen((value) => !value)}>{t('scanAsset')}</Button>{open && <form className="scan-panel" onSubmit={(event) => { event.preventDefault(); void resolve(); }}><label>Asset code or QR text<input value={code} onChange={(event) => setCode(event.target.value)} maxLength={200} required autoComplete="off" /></label><small>{t('scanHint')}</small><Button disabled={busy}>{busy ? t('loading') : t('resolve')}</Button>{message && <p className="error" role="alert">{message}</p>}</form>}</div>; }

function InstallationProjectsPage({ providerId, t }: { providerId: string; t: T }) {
  const [result, setResult] = useState<Collection<InstallationProjectAttributes> | null>(null);
  const [error, setError] = useState('');
  const [busyProjectId, setBusyProjectId] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { customerData.installationProjects(providerId).then((value) => setResult({ ...value, data: value.data.filter((item) => item.attributes.project_classification_key === 'ELEVATOR_INSTALLATION') })).catch((cause) => setError(errorText(cause))); }, [providerId]);
  async function accept(project: Resource<InstallationProjectAttributes>, event: NonNullable<InstallationProjectAttributes['handover_events']>[number]) {
    setBusyProjectId(project.id); setError(''); setMessage('');
    try {
      const accepted = await customerData.acceptHandover(providerId, project.id, { expected_revision: project.attributes.revision, asset_id: event.asset_id || undefined, evidence_ids: [], acknowledgement_method: 'ONLINE' }, crypto.randomUUID());
      setResult((current) => current && { ...current, data: current.data.map((item) => item.id === project.id ? { ...item, attributes: { ...item.attributes, handover_events: [...(item.attributes.handover_events || []), { id: accepted.id, event_kind: accepted.attributes.event_kind, asset_id: accepted.attributes.asset_id, service_case_revision: accepted.attributes.service_case_revision, occurred_at: accepted.attributes.occurred_at }] } } : item) });
      setMessage('Handover acknowledgment recorded.');
    } catch (cause) { setError(errorText(cause)); } finally { setBusyProjectId(''); }
  }
  if (error) return <DataState message={error} t={t} />;
  if (!result) return <DataState message={t('loading')} t={t} />;
  return <section className="content"><div className="section-heading"><div><Status>Customer tracking</Status><h2>Installation projects</h2></div><span>{result.data.length} authorized projects</span></div><p className="notice">Progress is read from the authorized provider project record. It does not imply dispatch, payment settlement or handover until the server records those states.</p>{error && <p className="error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}{result.data.length === 0 ? <DataState message="No installation projects are visible for this provider." t={t} /> : <div className="record-grid">{result.data.map((project) => { const events = project.attributes.handover_events || []; const acceptedAssets = new Set(events.filter((event) => event.event_kind === 'ACCEPTED').map((event) => event.asset_id || 'PROJECT')); const requests = events.filter((event) => event.event_kind === 'REQUESTED' && !acceptedAssets.has(event.asset_id || 'PROJECT')); const accepted = events.filter((event) => event.event_kind === 'ACCEPTED'); return <article className="record-card" key={project.id}><Status>{project.attributes.status}</Status><strong>{project.attributes.title}</strong><span>{project.attributes.progress_percent}% complete · {project.attributes.completed_stage_count}/{project.attributes.stage_count} stages</span><small>{project.attributes.project_assets?.map((asset) => asset.display_name).join(', ') || 'Elevator units not supplied'}</small>{project.attributes.stages?.slice(0, 5).map((stage) => <small key={stage.id}>{stage.title}: {stage.status}</small>)}{accepted.map((event) => <div key={event.id}><Status>Handover accepted</Status><small>{project.attributes.project_assets?.find((asset) => asset.id === event.asset_id)?.display_name || 'Project handover'}</small></div>)}{requests.map((event) => <div key={event.id}><Status>Handover requested</Status><small>{project.attributes.project_assets?.find((asset) => asset.id === event.asset_id)?.display_name || 'Project handover'}</small><Button disabled={busyProjectId === project.id} onClick={() => void accept(project, event)}>{busyProjectId === project.id ? 'Saving…' : 'Accept handover'}</Button></div>)}</article>; })}</div>}</section>;
}

function NotificationsPage({ providerId, t }: { providerId: string; t: T }) { const [result, setResult] = useState<Collection<NotificationAttributes> | null>(null); const [error, setError] = useState(''); useEffect(() => { customerData.notifications(providerId).then(setResult).catch((cause) => setError(errorText(cause))); }, [providerId]); async function mark(id: string) { try { await customerData.markNotificationRead(providerId, id, crypto.randomUUID()); setResult((current) => current && { ...current, data: current.data.map((item) => item.id === id ? { ...item, attributes: { ...item.attributes, read_at: new Date().toISOString() } } : item) }); } catch (cause) { setError(errorText(cause)); } } if (error) return <DataState message={error} t={t} />; if (!result) return <DataState message={t('loading')} t={t} />; return <section className="content"><div className="section-heading"><div><Status>{t('alerts')}</Status><h2>{t('alerts')}</h2></div></div>{result.data.length === 0 ? <DataState message={t('noAlerts')} t={t} /> : <div className="record-grid">{result.data.map((notification) => <article className={`record-card ${notification.attributes.read_at ? '' : 'unread'}`} key={notification.id}><strong>{notification.attributes.title}</strong><span>{notification.attributes.body}</span><small>{notification.attributes.category}</small>{!notification.attributes.read_at && <Button onClick={() => void mark(notification.id)}>Mark read</Button>}</article>)}</div>}</section>; }

function CoveragePage({ providerId, t }: { providerId: string; t: T }) { const [warranties, setWarranties] = useState<Collection<WarrantyAttributes> | null>(null); const [contracts, setContracts] = useState<Collection<ContractAttributes> | null>(null); const [error, setError] = useState(''); useEffect(() => { Promise.all([customerData.warranties(providerId), customerData.contracts(providerId)]).then(([warrantyResult, contractResult]) => { setWarranties(warrantyResult); setContracts(contractResult); }).catch((cause) => setError(errorText(cause))); }, [providerId]); if (error) return <DataState message={error} t={t} />; if (!warranties || !contracts) return <DataState message={t('loading')} t={t} />; return <section className="content"><div className="section-heading"><div><Status>Coverage</Status><h2>Warranty and AMC</h2></div></div><p className="notice">Coverage records are server-evaluated. The summary below is limited to your authorized customer relationship; provider pricing, internal rules and audit identifiers are not exposed.</p><h3>Warranties</h3>{warranties.data.length === 0 ? <p>{t('empty')}</p> : <div className="record-grid">{warranties.data.map((item) => <article className="record-card" key={item.id}><Status>{item.attributes.status}</Status><strong>{item.attributes.name}</strong><span>{item.attributes.effective_from || 'Unknown start'} → {item.attributes.effective_to || 'Unknown end'}</span><small>Asset coverage is available from the authorized provider relationship.</small></article>)}</div>}<h3>Maintenance contracts</h3>{contracts.data.length === 0 ? <p>{t('empty')}</p> : <div className="record-grid">{contracts.data.map((item) => { const summary = item.attributes.customer_safe_summary; return <article className="record-card" key={item.id}><Status>{item.attributes.status}</Status><strong>{summary?.plan_name || item.attributes.name}</strong><span>{summary?.plan_code ? `${summary.plan_code} · ` : ''}Version {summary?.plan_version || item.attributes.version} · {item.attributes.effective_from || 'Unknown start'} → {item.attributes.effective_to || 'Unknown end'}</span>{summary && <small>{summary.covered_elevator_count ?? 0} covered elevator{summary.covered_elevator_count === 1 ? '' : 's'} · {summary.preventive_frequency ? summary.preventive_frequency.toLowerCase().replaceAll('_', ' ') : 'Preventive schedule not supplied'}{summary.scheduled_visits ? ` · ${summary.scheduled_visits} scheduled visits` : ''}</small>}</article>; })}</div>}</section>; }

function DocumentsPage({ providerId, t }: { providerId: string; t: T }) { const [result, setResult] = useState<Collection<DocumentAttributes> | null>(null); const [error, setError] = useState(''); useEffect(() => { customerData.documents(providerId).then(setResult).catch((cause) => setError(errorText(cause))); }, [providerId]); if (error) return <DataState message={error} t={t} />; if (!result) return <DataState message={t('loading')} t={t} />; return <section className="content"><div className="section-heading"><div><Status>Documents</Status><h2>Authorized documents</h2></div></div>{result.data.length === 0 ? <DataState message="No authorized documents" t={t} /> : <div className="record-grid">{result.data.map((item) => <a className="record-card" href={`#/documents/${item.id}`} key={item.id}><Status>{item.attributes.scan_state === 'not_scanned' ? 'Not scanned' : item.attributes.scan_state}</Status><strong>{item.attributes.filename}</strong><span>{item.attributes.media_type} · {item.attributes.size_bytes} bytes</span><small>{item.attributes.status} · {item.attributes.visibility}</small></a>)}</div>}<p className="notice">Malware scanning is disabled by platform policy. Accepted files remain private, require authorization for each download, and are delivered as attachments.</p></section>; }

function DocumentDetail({ providerId, id, t }: { providerId: string; id: string; t: T }) { const [document, setDocument] = useState<Resource<DocumentAttributes> | null>(null); const [versions, setVersions] = useState<Collection<DocumentVersionAttributes> | null>(null); const [error, setError] = useState(''); const [download, setDownload] = useState(''); useEffect(() => { Promise.all([customerData.document(providerId, id), customerData.documentVersions(providerId, id)]).then(([doc, versionResult]) => { setDocument(doc); setVersions(versionResult); }).catch((cause) => setError(errorText(cause))); }, [providerId, id]); async function authorize(versionId: string) { try { const transfer = await customerData.authorizeDownload(providerId, id, { version_id: versionId, disposition: 'attachment' }); setDownload(transfer.url); window.open(transfer.url, '_blank', 'noopener,noreferrer'); } catch (cause) { setError(errorText(cause)); } } if (error) return <DataState message={error} t={t} />; if (!document || !versions) return <DataState message={t('loading')} t={t} />; const current = document.relationships.current_version as Link | null | undefined; return <section className="content"><button className="text-button" onClick={() => go('/documents')}>← {t('back')}</button><div className="detail-card"><Status>{document.attributes.scan_state === 'not_scanned' ? 'Not scanned' : document.attributes.scan_state}</Status><h2>{document.attributes.filename}</h2><p>{document.attributes.classification} · {document.attributes.status}</p>{document.attributes.scan_state === 'not_scanned' && <p className="notice">This private file was accepted without malware scanning under platform policy.</p>}<small>Current version: {current?.id || 'Not supplied'}</small>{versions.data.map((version) => <article className="record-card" key={version.id}><strong>Version {version.attributes.version}</strong><span>{version.attributes.scan_state === 'not_scanned' ? 'Not scanned' : version.attributes.scan_state} · {version.attributes.checksum}</span>{['clean', 'exempt', 'not_scanned'].includes(version.attributes.scan_state) && <Button onClick={() => void authorize(version.id)}>Authorize attachment download</Button>}</article>)}{download && <p className="notice">A short-lived attachment transfer was authorized by the API; the URL is not persisted.</p>}</div></section>; }

function ProfilePage({ session, refreshCurrentUser, locale, setLocale, theme, setTheme, t }: { session: { displayName: string; locale: string | null; revision: number }; refreshCurrentUser: () => Promise<void>; locale: Locale; setLocale: (value: Locale) => void; theme: Theme; setTheme: (value: Theme) => void; t: T }) {
  const [name, setName] = useState(session.displayName);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('');
    try { await customerData.updateMe({ display_name: name, locale, expected_revision: session.revision }); await refreshCurrentUser(); setMessage('Profile saved.'); }
    catch (cause) { setMessage(errorText(cause)); }
    finally { setSaving(false); }
  }
  const themes: Array<{ id: Theme; label: string; icon: CustomerNavIconName }> = [{ id: 'system', label: 'System', icon: 'theme-system' }, { id: 'light', label: 'Light', icon: 'theme-light' }, { id: 'dark', label: 'Dark', icon: 'theme-dark' }];
  return <section className="content"><div className="section-heading"><div><Status>{t('profile')}</Status><h2>{t('profile')}</h2></div></div><form className="form-card" onSubmit={save}><label>Display name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required /></label><label>Language <SortedSelect value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="en">English</option><option value="kn">ಕನ್ನಡ (draft)</option><option value="hi">हिन्दी (draft)</option></SortedSelect></label>{message && <p className="notice" role="status">{message}</p>}<Button disabled={saving}>{saving ? t('loading') : t('submit')}</Button></form><section className="form-card customer-preferences"><h3>Appearance</h3><span className="customer-setting-label">Theme</span><div className="customer-theme-options" role="group" aria-label="Theme">{themes.map((option) => <button type="button" key={option.id} className={theme === option.id ? 'active' : ''} aria-pressed={theme === option.id} onClick={() => setTheme(option.id)}><CustomerNavIcon name={option.icon} /><span>{option.label}</span></button>)}</div></section><div className="notice"><p>Commercial decisions are server-authorized and revision protected.</p><div className="inline-actions"><Button onClick={() => go('/quotations')}>View quotations</Button><Button onClick={() => go('/coverage')}>Coverage</Button><Button onClick={() => go('/documents')}>Documents</Button></div></div></section>;
}

function AssetList({ providerId, t }: { providerId: string; t: T }) {
  const [result, setResult] = useState<Collection<AssetAttributes> | null>(null); const [error, setError] = useState(''); const [loadingMore, setLoadingMore] = useState(false);
  const activeProvider = useRef(providerId); activeProvider.current = providerId;
  useEffect(() => { let active = true; setResult(null); setError(''); customerData.assets(providerId).then((value) => { if (active) setResult(value); }).catch((cause) => { if (active) setError(errorText(cause)); }); return () => { active = false; }; }, [providerId]);
  async function loadMore() { if (!result?.page?.next || loadingMore) return; const requestProvider = providerId; setLoadingMore(true); setError(''); try { const next = await customerData.assets(requestProvider, { after: result.page.next }); if (activeProvider.current === requestProvider) setResult((current) => current && ({ ...next, data: [...current.data, ...next.data] })); } catch (cause) { if (activeProvider.current === requestProvider) setError(errorText(cause)); } finally { if (activeProvider.current === requestProvider) setLoadingMore(false); } }
  if (error && !result) return <DataState message={error} retry={() => customerData.assets(providerId).then(setResult).catch((cause) => setError(errorText(cause)))} t={t} />;
  if (!result) return <DataState message={t('loading')} t={t} />;
  return <section className="content"><div className="section-heading"><div><Status>{t('assets')}</Status><h2>{t('assetList')}</h2></div><span>{result.data.length} authorized assets{result.page?.next ? ' · more available' : ''}</span></div>{error && <p className="error" role="alert">{error}</p>}{result.data.length === 0 ? <DataState message={t('empty')} t={t} /> : <div className="record-grid">{result.data.map((asset) => <a className="record-card" href={`#/asset/${asset.id}`} key={asset.id}><CustomerAssetIcon /><strong>{asset.attributes.name}</strong><span>{asset.attributes.status} · {asset.attributes.identifiers?.[0]?.value || 'No identifier'}</span><small>{asset.attributes.provider_id}</small></a>)}</div>}{result.page?.next && <MoreRecords loading={loadingMore} onClick={() => void loadMore()} />}</section>;
}

function CustomerAssetsAcrossProviders({ providers, onSelectProvider, t }: { providers: Resource<ProviderAttributes>[] | null; onSelectProvider: (id: string) => void; t: T }) {
  const [result, setResult] = useState<Collection<AssetAttributes> | null>(null);
  const [cursors, setCursors] = useState<Record<string, string | null>>({});
  const [visibleCount, setVisibleCount] = useState(10);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const providerKey = providers?.map((provider) => provider.id).join('|') ?? 'loading';
  const activeKey = useRef(providerKey); activeKey.current = providerKey;
  useEffect(() => {
    let active = true;
    setResult(null); setCursors({}); setVisibleCount(10); setError('');
    if (providers) Promise.all(providers.map(async (provider) => ({ providerId: provider.id, page: await customerData.assets(provider.id, { limit: 10 }) })))
      .then((pages) => {
        if (!active) return;
        const assets = pages.flatMap(({ page }) => page.data).sort((left, right) => right.attributes.created_at.localeCompare(left.attributes.created_at) || left.id.localeCompare(right.id));
        setResult({ data: assets, page: { next: pages.some(({ page }) => page.page?.next) ? 'more-authorized-assets' : null } });
        setCursors(Object.fromEntries(pages.map(({ providerId, page }) => [providerId, page.page?.next ?? null])));
      })
      .catch((cause) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [providerKey]);
  async function loadMore() {
    if (!providers || !result || loadingMore) return;
    if (result.data.length > visibleCount) { setVisibleCount((count) => count + 10); return; }
    const requestKey = providerKey; setLoadingMore(true); setError('');
    try {
      const pages = await Promise.all(providers.filter((provider) => cursors[provider.id]).map(async (provider) => ({ providerId: provider.id, page: await customerData.assets(provider.id, { limit: 10, after: cursors[provider.id]! }) })));
      if (activeKey.current !== requestKey) return;
      const nextCursors = { ...cursors };
      for (const { providerId, page } of pages) nextCursors[providerId] = page.page?.next ?? null;
      setCursors(nextCursors);
      setResult((current) => {
        if (!current) return current;
        const seen = new Set(current.data.map((asset) => `${asset.attributes.provider_id}:${asset.id}`));
        const added = pages.flatMap(({ page }) => page.data).filter((asset) => !seen.has(`${asset.attributes.provider_id}:${asset.id}`));
        return { data: [...current.data, ...added].sort((left, right) => right.attributes.created_at.localeCompare(left.attributes.created_at) || left.id.localeCompare(right.id)), page: { next: Object.values(nextCursors).some(Boolean) ? 'more-authorized-assets' : null } };
      });
      setVisibleCount((count) => count + 10);
    } catch (cause) { if (activeKey.current === requestKey) setError(errorText(cause)); }
    finally { if (activeKey.current === requestKey) setLoadingMore(false); }
  }
  if (error && !result) return <DataState message={error} t={t} />;
  if (!providers || !result) return <DataState message={t('loading')} t={t} />;
  const providerNames = new Map(providers.map((provider) => [provider.id, provider.attributes.display_name || 'Service provider']));
  return <section className="content"><div className="section-heading"><div><Status>{t('assets')}</Status><h2>{t('assetList')}</h2></div><span>{result.data.length > visibleCount ? `${visibleCount}+` : result.data.length} authorized assets{result.page?.next ? ' · more available' : ''}</span></div><p className="notice">Showing assets from your authorized service relationships. Each asset remains scoped to its provider.</p>{error && <p className="error" role="alert">{error}</p>}{result.data.length === 0 ? <DataState message={t('empty')} t={t} /> : <div className="record-grid">{result.data.slice(0, visibleCount).map((asset) => <button className="record-card customer-aggregate-asset" type="button" key={`${asset.attributes.provider_id}:${asset.id}`} onClick={() => { onSelectProvider(asset.attributes.provider_id); go(`/asset/${asset.id}`); }}><CustomerAssetIcon /><strong>{asset.attributes.name}</strong><span>{asset.attributes.status.replaceAll('_', ' ')} · {asset.attributes.identifiers?.[0]?.value || 'No identifier'}</span><small>{providerNames.get(asset.attributes.provider_id) || 'Authorized service provider'}</small></button>)}</div>}{(result.data.length > visibleCount || result.page?.next) && <MoreRecords loading={loadingMore} onClick={() => void loadMore()} />}</section>;
}

function CustomerBookingsAcrossProviders({ providers, onSelectProvider, t }: { providers: Resource<ProviderAttributes>[] | null; onSelectProvider: (id: string) => void; t: T }) {
  const [result, setResult] = useState<ProviderBooking[] | null>(null);
  const [cursors, setCursors] = useState<Record<string, string | null>>({});
  const [visibleCount, setVisibleCount] = useState(10);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const providerKey = providers?.map((provider) => provider.id).join('|') ?? 'loading';
  const activeKey = useRef(providerKey); activeKey.current = providerKey;
  useEffect(() => {
    let active = true;
    setResult(null); setCursors({}); setVisibleCount(10); setError('');
    if (providers) Promise.all(providers.map(async (provider) => ({ providerId: provider.id, page: await customerData.bookings(provider.id, { limit: 10 }) })))
      .then((pages) => {
        if (!active) return;
        const bookings = pages.flatMap(({ providerId, page }) => page.data.map((booking) => ({ booking, providerId }))).sort((left, right) => left.booking.attributes.requested_window.starts_at.localeCompare(right.booking.attributes.requested_window.starts_at) || left.booking.id.localeCompare(right.booking.id));
        setResult(bookings);
        setCursors(Object.fromEntries(pages.map(({ providerId, page }) => [providerId, page.page?.next ?? null])));
      })
      .catch((cause) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [providerKey]);
  async function loadMore() {
    if (!providers || !result || loadingMore) return;
    if (result.length > visibleCount) { setVisibleCount((count) => count + 10); return; }
    const requestKey = providerKey; setLoadingMore(true); setError('');
    try {
      const pages = await Promise.all(providers.filter((provider) => cursors[provider.id]).map(async (provider) => ({ providerId: provider.id, page: await customerData.bookings(provider.id, { limit: 10, after: cursors[provider.id]! }) })));
      if (activeKey.current !== requestKey) return;
      const nextCursors = { ...cursors };
      for (const { providerId, page } of pages) nextCursors[providerId] = page.page?.next ?? null;
      setCursors(nextCursors);
      setResult((current) => {
        if (!current) return current;
        const seen = new Set(current.map(({ booking, providerId }) => `${providerId}:${booking.id}`));
        const added = pages.flatMap(({ providerId, page }) => page.data.map((booking) => ({ booking, providerId }))).filter(({ booking, providerId }) => !seen.has(`${providerId}:${booking.id}`));
        return [...current, ...added].sort((left, right) => left.booking.attributes.requested_window.starts_at.localeCompare(right.booking.attributes.requested_window.starts_at) || left.booking.id.localeCompare(right.booking.id));
      });
      setVisibleCount((count) => count + 10);
    } catch (cause) { if (activeKey.current === requestKey) setError(errorText(cause)); }
    finally { if (activeKey.current === requestKey) setLoadingMore(false); }
  }
  if (error && !result) return <DataState message={error} t={t} />;
  if (!providers || !result) return <DataState message={t('loading')} t={t} />;
  const providerNames = new Map(providers.map((provider) => [provider.id, provider.attributes.display_name || 'Service provider']));
  return <section className="content"><div className="section-heading"><div><Status>Service &amp; bookings</Status><h2>{t('serviceBookings')}</h2></div><span>{result.length > visibleCount ? `${visibleCount}+` : result.length} appointments{Object.values(cursors).some(Boolean) ? ' · more available' : ''}</span></div><p className="notice">Appointments from your authorized service relationships.</p>{error && <p className="error" role="alert">{error}</p>}{result.length === 0 ? <DataState message={t('empty')} t={t} /> : <div className="record-grid">{result.slice(0, visibleCount).map(({ booking, providerId }) => <article className="record-card" key={`${providerId}:${booking.id}`}><Status>{booking.attributes.status}</Status><strong>{booking.attributes.summary}</strong><span>{formatIndiaDateTime(booking.attributes.requested_window.starts_at)}</span><small>{providerNames.get(providerId) || 'Authorized service provider'}</small><button className="text-button" type="button" onClick={() => { onSelectProvider(providerId); go('/bookings'); }}>View provider service history →</button></article>)}</div>}{(result.length > visibleCount || Object.values(cursors).some(Boolean)) && <MoreRecords loading={loadingMore} onClick={() => void loadMore()} />}</section>;
}

function AssetDetail({ providerId, id, t }: { providerId: string; id: string; t: T }) {
  const [asset, setAsset] = useState<Resource<AssetAttributes> | null>(null); const [location, setLocation] = useState<Resource<LocationAttributes> | null>(null); const [error, setError] = useState('');
  useEffect(() => { customerData.asset(providerId, id).then((value) => { setAsset(value); const link = value.relationships.location as Link | null | undefined; if (link) return customerData.location(providerId, link.id).then(setLocation); return undefined; }).catch((cause) => setError(errorText(cause))); }, [providerId, id]);
  if (error) return <DataState message={error} t={t} />; if (!asset) return <DataState message={t('loading')} t={t} />;
  const locationLink = asset.relationships.location as Link | null | undefined;
  return <section className="content"><button className="text-button" onClick={() => go('/assets')}>← {t('back')}</button><div className="detail-card"><CustomerAssetIcon /><Status>{asset.attributes.status}</Status><h2>{asset.attributes.name}</h2><dl><dt>Provider</dt><dd>{asset.attributes.provider_id}</dd><dt>Revision</dt><dd>{asset.attributes.revision}</dd><dt>Location</dt><dd>{location ? location.attributes.name || location.attributes.address?.lines?.join(', ') || location.id : locationLink ? t('loading') : t('locationRequired')}</dd><dt>Definition version</dt><dd>{asset.attributes.definition_version}</dd></dl><Button onClick={() => go(`/asset/${asset.id}/request`)}>{t('requestService')}</Button></div></section>;
}

function RequestForm({ providerId, assetId, t }: { providerId: string; assetId: string; t: T }) {
  const [asset, setAsset] = useState<Resource<AssetAttributes> | null>(null); const [services, setServices] = useState<Collection<ServiceTypeAttributes> | null>(null); const [form, setForm] = useState({ summary: '', description: '', serviceTypeId: '', startsAt: '', endsAt: '' }); const [error, setError] = useState(''); const [result, setResult] = useState<{ booking?: Resource<BookingAttributes> }>({}); const [saving, setSaving] = useState(false);
  useEffect(() => { customerData.asset(providerId, assetId).then(setAsset).catch((cause) => setError(errorText(cause))); customerData.serviceTypes(providerId).then(setServices).catch((cause) => setError(errorText(cause))); }, [providerId, assetId]);
  const relationship = asset?.relationships.customer_relationship as Link | undefined; const location = asset?.relationships.location as Link | null | undefined;
  const update = (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [field]: event.target.value }));
  async function submit(event: FormEvent) { event.preventDefault(); if (!asset || !relationship || !location) { setError(t('locationRequired')); return; } setSaving(true); setError(''); try { const booking = await customerData.createBooking(providerId, buildBookingPayload({ summary: form.summary, customerRelationshipId: relationship.id, assetId: asset.id, locationId: location.id, serviceTypeId: form.serviceTypeId, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() }), crypto.randomUUID()); setResult({ booking }); } catch (cause) { setError(errorText(cause)); } finally { setSaving(false); } }
  if (!asset || !services) return <DataState message={error || t('loading')} t={t} />;
  if (result.booking) return <section className="content"><div className="notice"><Status>{result.booking.attributes.status}</Status><h2>{t('bookingCreated')}</h2><p>Booking: {result.booking.id}. The requested window is not confirmed until an authorized appointment confirmation is persisted.</p><Button onClick={() => go('/bookings')}>{t('serviceBookings')}</Button></div></section>;
  return <section className="content"><button className="text-button" onClick={() => go(`/asset/${assetId}`)}>← {t('back')}</button><form className="form-card" onSubmit={submit}><Status>{t('requestService')}</Status><h2>{t('requestService')}</h2><p className="notice">{t('requestTypeUnavailable')}</p><label>{t('summary')}<input required maxLength={200} value={form.summary} onChange={update('summary')} /></label><label>{t('description')}<textarea maxLength={4000} value={form.description} onChange={update('description')} /></label><label>{t('chooseService')}<SortedSelect required value={form.serviceTypeId} onChange={update('serviceTypeId')}><option value="">{t('chooseService')}</option>{services.data.map((service) => <option value={service.id} key={service.id}>{service.attributes.name || service.attributes.code || service.id}</option>)}</SortedSelect></label><label>{t('start')}<input required type="datetime-local" value={form.startsAt} onChange={update('startsAt')} /></label><label>{t('end')}<input required type="datetime-local" value={form.endsAt} onChange={update('endsAt')} /></label>{!location && <p className="error">{t('locationRequired')}</p>}{error && <p className="error" role="alert">{error}</p>}<Button disabled={saving || !location}>{saving ? t('loading') : t('submit')}</Button></form></section>;
}

function BookingList({ providerId, t }: { providerId: string; t: T }) {
  const [result, setResult] = useState<Collection<BookingAttributes> | null>(null);
  const [jobs, setJobs] = useState<Collection<ServiceJobAttributes> | null>(null);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const activeProvider = useRef(providerId); activeProvider.current = providerId;
  useEffect(() => {
    let active = true;
    setResult(null); setJobs(null); setError('');
    Promise.all([customerData.bookings(providerId), customerData.jobs(providerId)])
      .then(([bookingResult, jobResult]) => { if (active) { setResult(bookingResult); setJobs(jobResult); } })
      .catch((cause) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [providerId]);
  async function loadMore() {
    if (!result?.page?.next || loadingMore) return;
    const requestProvider = providerId;
    setLoadingMore(true); setError('');
    try {
      const next = await customerData.bookings(requestProvider, { after: result.page.next });
      if (activeProvider.current === requestProvider) setResult((current) => current && ({ ...next, data: [...current.data, ...next.data] }));
    } catch (cause) { if (activeProvider.current === requestProvider) setError(errorText(cause)); }
    finally { if (activeProvider.current === requestProvider) setLoadingMore(false); }
  }
  if (error && !result) return <DataState message={error} t={t} />;
  if (!result || !jobs) return <DataState message={t('loading')} t={t} />;
  return <section className="content"><div className="section-heading"><h2>{t('serviceBookings')}</h2><span>{result.data.length} bookings{result.page?.next ? ' · more available' : ''}</span></div>{error && <p className="error" role="alert">{error}</p>}{result.data.length === 0 ? <DataState message={t('empty')} t={t} /> : <div className="record-grid">{result.data.map((booking) => <article className="record-card" key={booking.id}><Status>{booking.attributes.status}</Status><strong>{booking.attributes.summary}</strong><span>{formatIndiaDateTime(booking.attributes.requested_window.starts_at)}</span><small>Booking {booking.id}</small></article>)}</div>}{result.page?.next && <MoreRecords loading={loadingMore} onClick={() => void loadMore()} />}<div className="detail-card"><h3>Persisted service progress</h3>{jobs.data.length === 0 ? <p>No linked job is visible yet. A requested booking is not a confirmed job.</p> : jobs.data.map((job) => <article className="record-card" key={job.id}><Status>{job.attributes.status}</Status><strong>{job.attributes.summary || 'Service job'}</strong><span>Job {job.id}</span><small>Linked booking: {(job.relationships.booking as Link | null | undefined)?.id || 'not supplied by API'}</small></article>)}</div></section>;
}

function RequestList({ providerId, t }: { providerId: string; t: T }) { const [result, setResult] = useState<Collection<RequestAttributes> | null>(null); const [error, setError] = useState(''); const [loadingMore, setLoadingMore] = useState(false); const activeProvider = useRef(providerId); activeProvider.current = providerId; useEffect(() => { let active = true; setResult(null); setError(''); customerData.requests(providerId).then((value) => { if (active) setResult(value); }).catch((cause) => { if (active) setError(errorText(cause)); }); return () => { active = false; }; }, [providerId]); async function loadMore() { if (!result?.page?.next || loadingMore) return; const requestProvider = providerId; setLoadingMore(true); setError(''); try { const next = await customerData.requests(requestProvider, { after: result.page.next }); if (activeProvider.current === requestProvider) setResult((current) => current && ({ ...next, data: [...current.data, ...next.data] })); } catch (cause) { if (activeProvider.current === requestProvider) setError(errorText(cause)); } finally { if (activeProvider.current === requestProvider) setLoadingMore(false); } } if (error && !result) return <DataState message={error} retry={() => customerData.requests(providerId).then(setResult).catch((cause) => setError(errorText(cause)))} t={t} />; if (!result) return <DataState message={t('loading')} t={t} />; return <section className="content"><div className="section-heading"><h2>{t('serviceRequests')}</h2><span>{result.data.length} authorized requests{result.page?.next ? ' · more available' : ''}</span></div>{error && <p className="error" role="alert">{error}</p>}{result.data.length === 0 ? <DataState message={t('empty')} t={t} /> : <div className="record-grid">{result.data.map((request) => <a className="record-card" href={`#/request/${request.id}`} key={request.id}><Status>{request.attributes.status}</Status><strong>{request.attributes.summary}</strong><span>{request.attributes.description || t('noDescription')}</span><small>{formatIndiaDateTime(request.attributes.created_at)}</small></a>)}</div>}{result.page?.next && <MoreRecords loading={loadingMore} onClick={() => void loadMore()} />}</section>; }

function MoreRecords({ loading, onClick }: { loading: boolean; onClick: () => void }) { return <div className="customer-load-more"><Button disabled={loading} onClick={onClick}>{loading ? 'Loading…' : 'Load more'}</Button></div>; }

function RequestDetail({ providerId, id, t }: { providerId: string; id: string; t: T }) { const [request, setRequest] = useState<Resource<RequestAttributes> | null>(null); const [error, setError] = useState(''); useEffect(() => { customerData.request(providerId, id).then(setRequest).catch((cause) => setError(errorText(cause))); }, [providerId, id]); if (error) return <DataState message={error} t={t} />; if (!request) return <DataState message={t('loading')} t={t} />; const asset = request.relationships.asset as Link | null | undefined; const location = request.relationships.location as Link | null | undefined; return <section className="content"><button className="text-button" onClick={() => go('/requests')}>← {t('back')}</button><div className="detail-card"><Status>{request.attributes.status}</Status><h2>{request.attributes.summary}</h2><p>{request.attributes.description || t('noDescription')}</p><dl><dt>Created</dt><dd>{formatIndiaDateTime(request.attributes.created_at)}</dd><dt>Asset</dt><dd>{asset ? 'Authorized asset selected' : 'Not supplied by API'}</dd><dt>Location</dt><dd>{location ? 'Authorized service location' : 'Not supplied by API'}</dd></dl><p className="notice">Progress is shown only from authorized server relationships. A reported emergency is not a dispatch confirmation.</p><Button onClick={() => go('/bookings')}>{t('serviceBookings')}</Button></div></section>; }
function DataState({ message, retry, t }: { message: string; retry?: () => void; t: T }) { return <section className="notice" role="status"><p>{message}</p>{retry && <Button onClick={retry}>{t('retry')}</Button>}</section>; }

createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><Shell /></AuthProvider></StrictMode>);
