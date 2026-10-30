import { StrictMode, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, GoogleSignInButton, useAuth } from '@trise/auth';
import { apiClient } from '@trise/api-client';
import { translate, type Locale } from '@trise/i18n';
import { Button, Status, TriseBrandHeader, SortedSelect, InfoNotice } from '@trise/ui';
import '@trise/tokens/theme.css';
import './styles.css';
import './customer-portal.css';
import './brand-background.css';
import './workflow.css';
import '../../../packages/ui-primitives/src/primitives.css';
import { assetDisplaySubtitle, buildPreferredWindow, customerData, type AssetAttributes, type BookingAttributes, type Collection, type CollectionPage, type ContractAttributes, type CustomerServiceReportPreviewAttributes, type DocumentAttributes, type DocumentVersionAttributes, type Link, type LocationAttributes, type NotificationAttributes, type ProviderAttributes, type QuotationAttributes, type RequestAttributes, type Resource, type ServiceJobAttributes, type ServiceTypeAttributes, type PreferredWindowSlot, type TimelineEntryAttributes, type UserAttributes, type WarrantyAttributes } from './data';
import { classifyCustomerState, CustomerStatePanel } from './customer-state';
import { CustomerNotificationBell } from './notification-bell';
import { markAllUnreadNotifications, notificationBulkActionState, notificationCountLabel, notificationReadResultMessage } from './notification-actions';
import { QuotationProgress, QuotationsPage, QuotationReviewPage, quotationScopeSummary } from './quotation-review';
import { CustomerHelpPage, CustomerMembershipsPage, CustomerMorePage, CustomerNotificationPreferencesPage, CustomerPlaceDetailPage, CustomerPlacesPage, CustomerTimelinePage, customerSidebarDestinations, disambiguateProviderNames } from './account-experience';
import { CustomerCoverageDetail, CustomerFeedbackPage, CustomerProjectDetail, CustomerServiceDetail, relatedResourceId } from './customer-details';
import { coverageCountLabel, coverageEmptyMessage, coverageLiftDetailsFallback, coverageListRecords, coverageReferenceCode, coverageStatuses, customerCoverageStatus, customerPlanDisplayName, customerReadableName, filterCoverageRecords, visibleCoverageRecords, warrantyDisplayName } from './coverage-list';
import { activeCoverageCount, activeServiceCount, customerAssetCoverageLabel, customerAssetCoverageStatus, customerDecisionQuotes, customerGreeting, customerHomeDate, customerHomeProviderName, homeAssetLocation, homeCountLabel, nextConfirmedBookingForAsset } from './customer-home';
import { customerCanDownloadDocument, customerDocumentClassificationLabel, customerDocumentDisplayName, customerDocumentPreviousVersions, filterCustomerDocuments } from './document-list';
import { customerDocumentAssetChoiceLabel, customerDocumentRequestChoiceLabel, customerDocumentUploadReady, customerUploadValidation, newCustomerDocumentUploadKey, uploadCustomerDocument, type CustomerDocumentSource } from './document-upload';
import { customerVisibleAddressText } from './customer-display';
import { assetLocationOptions } from './asset-location-filter';
import { assetLocationFilterFromHash, customerAssetKey, customerAssetPlaceLabel, customerUpcomingBookingWindow, nextConfirmedAssetVisits, type ConfirmedAssetVisit } from './customer-assets';
import { CustomerRequestConfirmation, isCustomerRequestId, requestConfirmationBookingStatus, requestConfirmationRoute } from './customer-request-confirmation';
import { CustomerRequestReview } from './customer-request-review';
import { CustomerRequestContext } from './customer-request-context';
import { canSubmitCustomerRequest, customerRequestTypeLabel } from './customer-request-flow';
import { customerRequestAssetContext } from './customer-request-assets';
import { serviceTrackingTitle } from './customer-booking-actions';
import { CustomerServiceReportPreview } from './customer-report-preview';
import { globalSearchRoute, matchesGlobalSearch, type GlobalSearchKind } from './global-search';
import { isBookingRepresentedByJob, isRequestedBookingRepresentedByRequest, serviceActivityReference, serviceBookingWindowLabel, serviceFeedbackEligible, serviceScheduleLabel, serviceStatusLabel } from './customer-services';
import { customerProjectDisplayName, customerProjectListStatusLabel, customerProjectsEmptyMessage, visibleInstallationProjects } from './customer-projects';

apiClient.setWebClientApp('customer');

type Theme = 'system' | 'light' | 'dark';
type View = { name: 'home' | 'providers' | 'assets' | 'asset' | 'request-start' | 'request' | 'request-success' | 'bookings' | 'booking-detail' | 'requests' | 'request-detail' | 'service-detail' | 'projects' | 'project' | 'places' | 'place' | 'members' | 'alerts' | 'preferences' | 'timeline' | 'feedback' | 'more' | 'help' | 'profile' | 'quotations' | 'quotation' | 'coverage' | 'coverage-detail' | 'documents' | 'document'; id?: string; kind?: 'warranty' | 'contract'; sourceId?: string; locationName?: string };
const BUSINESS_TIME_ZONE = 'Asia/Kolkata';
function formatIndiaDateTime(value: string | Date) { const date = value instanceof Date ? value : new Date(value); return new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(date); }
function formatIndiaDate(value: string | Date) { const date = value instanceof Date ? value : new Date(value); return new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIME_ZONE, dateStyle: 'medium' }).format(date); }
function readView(): View {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?', 2);
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'service-providers') return { name: 'providers' };
  if (parts[0] === 'asset' && parts[1] && parts[2] === 'request') return { name: 'request', id: parts[1] };
  if (parts[0] === 'asset' && parts[1]) return { name: 'asset', id: parts[1] };
  if (parts[0] === 'request' && !parts[1]) return { name: 'request-start' };
  if (parts[0] === 'bookings') return { name: 'bookings' };
  if (parts[0] === 'booking' && parts[1]) return { name: 'booking-detail', id: parts[1] };
  if (parts[0] === 'service' && parts[1]) return { name: 'service-detail', id: parts[1] };
  if (parts[0] === 'requests') return { name: 'requests' };
  if (parts[0] === 'request' && parts[1]) return { name: 'request-detail', id: parts[1] };
  if (parts[0] === 'request-success') {
    try { return { name: 'request-success', id: parts[1] ? decodeURIComponent(parts[1]) : undefined }; }
    catch { return { name: 'request-success' }; }
  }
  if (parts[0] === 'projects' && parts[1]) return { name: 'project', id: parts[1] };
  if (parts[0] === 'projects') return { name: 'projects' };
  if (parts[0] === 'places' && parts[1]) return { name: 'place', id: parts[1] };
  if (parts[0] === 'places') return { name: 'places' };
  if (parts[0] === 'members') return { name: 'members' };
  if (parts[0] === 'notification-preferences') return { name: 'preferences' };
  if (parts[0] === 'timeline') return { name: 'timeline' };
  if (parts[0] === 'feedback') return { name: 'feedback', id: parts[1] };
  if (parts[0] === 'more') return { name: 'more' };
  if (parts[0] === 'help') return { name: 'help' };
  if (parts[0] === 'alerts') return { name: 'alerts' };
  if (parts[0] === 'profile') return { name: 'profile' };
  if (parts[0] === 'quotation' && parts[1]) return { name: 'quotation', id: parts[1] };
  if (parts[0] === 'quotations') return { name: 'quotations' };
  if (parts[0] === 'coverage' && parts[1] && parts[2]) return { name: 'coverage-detail', kind: parts[1] === 'warranty' ? 'warranty' : 'contract', id: parts[2] };
  if (parts[0] === 'coverage') return { name: 'coverage' };
  if (parts[0] === 'documents' && parts[1] === 'source' && parts[2]) return { name: 'documents', sourceId: parts[2] };
  if (parts[0] === 'documents' && parts[1]) return { name: 'document', id: parts[1] };
  if (parts[0] === 'documents') return { name: 'documents' };
  if (parts[0] === 'assets') return { name: 'assets', id: assetLocationFilterFromHash(`?${query}`) || undefined, locationName: new URLSearchParams(query).get('location_name') || undefined };
  return { name: 'home' };
}

function go(path: string) { window.location.hash = path; }
function errorText(error: unknown) { return (error as { message?: string })?.message || 'The API request could not be completed.'; }
function consumeGlobalSearchQuery(): string {
  const query = sessionStorage.getItem('trise-customer-global-search-query') || '';
  sessionStorage.removeItem('trise-customer-global-search-query');
  return query;
}

function Shell() {
  const { session, loading: authLoading, error: authError, signOut, setProvider, refreshCurrentUser } = useAuth();
  const [theme, setTheme] = useState<Theme>((localStorage.getItem('trise-theme') as Theme) || 'system');
  const [locale, setLocale] = useState<Locale>((localStorage.getItem('trise-locale') as Locale) || 'en');
  const [view, setView] = useState<View>(readView);
  const [compactHeader, setCompactHeader] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [providers, setProviders] = useState<Collection<ProviderAttributes> | null>(null);
  const [providerId, setProviderId] = useState('');
  const [contextReady, setContextReady] = useState(true);
  const t = (key: string) => translate(locale, key);

  useEffect(() => { const onHash = () => setView(readView()); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  useEffect(() => { const onScroll = () => setCompactHeader(window.scrollY > 20); onScroll(); window.addEventListener('scroll', onScroll, { passive: true }); return () => window.removeEventListener('scroll', onScroll); }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && session) {
        event.preventDefault();
        setGlobalSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session]);
  useEffect(() => { const media = matchMedia('(prefers-color-scheme: dark)'); const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme; }; apply(); localStorage.setItem('trise-theme', theme); if (theme === 'system') media.addEventListener('change', apply); return () => media.removeEventListener('change', apply); }, [theme]);
  useEffect(() => { localStorage.setItem('trise-locale', locale); document.documentElement.lang = locale; document.documentElement.dir = 'ltr'; }, [locale]);
  useEffect(() => { if (!session) { setProviders(null); return; } customerData.providers().then(setProviders).catch(() => setProviders({ data: [] })); }, [session]);
  useEffect(() => { setContextReady(false); if (providerId) { sessionStorage.setItem('trise-customer-provider', providerId); setProvider(providerId); } else { sessionStorage.removeItem('trise-customer-provider'); setProvider(undefined); } }, [providerId, setProvider]);
  useEffect(() => { if ((session?.providerId || '') === providerId) setContextReady(true); }, [providerId, session?.providerId]);

  if (authLoading) return <main className="app-shell"><section className="notice"><Status>{t('loading')}</Status><p>{t('loading')}</p></section></main>;
  if (!session) return view.name === 'quotation'
    ? <main className="app-shell quotation-app-shell"><header className="quotation-app-header"><Wordmark variant="dark" /><div className="quotation-app-header-right"><span className="quotation-secure-pill"><i />Secure quotation review</span></div></header><section className="quotation-login-intro"><Status>Customer quotation experience · secure review</Status><h1>Review and respond to a quotation</h1><p>Your secure link will return you to this exact quotation revision after sign-in.</p></section><QuotationProgress activeStep={2} /><section className="quotation-login-card"><div className="quotation-login-brand"><Wordmark /><h2>Your quotation is waiting in your secure account.</h2><p>We’ll verify your customer relationship before showing quotation details. Sign-in does not accept or change the quotation.</p></div><div className="quotation-login-form"><Status>Quotation access</Status><h2>Sign in to TRISE</h2><p>{authError || 'Continue with your existing TRISE customer account to securely review the quotation.'}</p><GoogleSignInButton /><small>Quotation details stay private until your account and customer relationship are verified.</small></div></section></main>
    : <CustomerLoginPage authError={authError} />;

  const rawProviderOptions = providers?.data || [];
  const providerDisplayNames = new Map(disambiguateProviderNames(rawProviderOptions.map((provider) => ({ providerId: provider.id, providerName: provider.attributes.display_name || 'Service provider' }))).map(({ providerId, providerName }) => [providerId, providerName]));
  const providerOptions = rawProviderOptions.map((provider) => ({ ...provider, attributes: { ...provider.attributes, display_name: providerDisplayNames.get(provider.id) || provider.attributes.display_name || 'Service provider' } }));
  const quotationPortal = view.name === 'quotation' || view.name === 'quotations';
  const chooseProvider = (id: string) => { if (providerId === id) { setContextReady(true); return; } setContextReady(false); setProviderId(id); };
  const providerDirectory = <ProviderDirectoryPage providers={providers ? providerOptions : null} activeProviderId={providerId} onSelect={(id) => { chooseProvider(id); if (!quotationPortal) go('/'); }} t={t} />;
  const content = view.name === 'providers'
    ? providerDirectory
    : view.name === 'profile'
      ? <ProfilePage session={session} refreshCurrentUser={refreshCurrentUser} signOut={signOut} locale={locale} setLocale={setLocale} t={t} />
    : view.name === 'places' ? <CustomerPlacesPage providers={providers ? providerOptions : null} onOpenPlace={(id) => go(`/places/${id}`)} t={t} />
    : view.name === 'place' ? <CustomerPlaceDetailPage id={view.id!} providers={providers ? providerOptions : null} onBack={() => go('/places')} onOpenMembers={() => go('/members')} onOpenAssets={(locationId, locationName) => go(`/assets?location_id=${encodeURIComponent(locationId)}&location_name=${encodeURIComponent(locationName)}`)} onOpenAsset={(providerId, id) => { chooseProvider(providerId); go(`/asset/${id}`); }} t={t} />
    : view.name === 'members' ? <CustomerMembershipsPage providers={providers ? providerOptions : null} t={t} />
    : view.name === 'preferences' ? <CustomerNotificationPreferencesPage providers={providers ? providerOptions : null} t={t} goTo={go} />
    : view.name === 'timeline' ? <CustomerTimelinePage providers={providers ? providerOptions : null} t={t} onNavigate={(id, path) => { chooseProvider(id); go(path); }} />
    : view.name === 'more' ? <CustomerMorePage goTo={go} />
    : view.name === 'help' ? <CustomerHelpPage providers={providers ? providerOptions : null} goTo={go} />
    : view.name === 'feedback' ? <CustomerFeedbackPage providers={providers ? providerOptions : null} jobId={view.id} t={t} />
    : view.name === 'request-success' && !view.id ? <DataState message="This request receipt is unavailable. Open a submitted request from Service requests." t={t} />
    : ['project', 'coverage-detail', 'service-detail', 'request-success'].includes(view.name) && !contextReady ? <DataState message={t('loading')} t={t} />
    : view.name === 'coverage-detail' && providerId ? <CustomerCoverageDetail providerId={providerId} providerName={providerOptions.find((provider) => provider.id === providerId)?.attributes.display_name || 'Service provider'} id={view.id!} kind={view.kind || 'contract'} onBack={() => go('/coverage')} onOpenAsset={(contextId, assetId) => { chooseProvider(contextId); go(`/asset/${assetId}`); }} t={t} />
    : view.name === 'service-detail' && providerId ? <CustomerServiceDetail providerId={providerId} providerName={providerOptions.find((provider) => provider.id === providerId)?.attributes.display_name || 'Service provider'} id={view.id!} onBack={() => go('/bookings')} onOpenAsset={(contextId, assetId) => { chooseProvider(contextId); go(`/asset/${assetId}`); }} t={t} />
    : view.name === 'project' && providerId ? <CustomerProjectDetail providerId={providerId} providerName={providerOptions.find((provider) => provider.id === providerId)?.attributes.display_name || 'Service provider'} id={view.id!} onBack={() => go('/projects')} onAccepted={() => undefined} t={t} />
    : view.name === 'home' ? <CustomerHome providers={providers ? providerOptions : null} displayName={session.displayName} onSelectProvider={chooseProvider} t={t} />
    : view.name === 'assets' ? <CustomerAssetsAcrossProviders providers={providers ? providerOptions : null} initialLocationId={view.id} initialLocationName={view.locationName} onSelectProvider={chooseProvider} t={t} />
    : view.name === 'request-start' ? <CustomerRequestStart providers={providers ? providerOptions : null} customerName={session.displayName} onSelectProvider={chooseProvider} t={t} />
    : view.name === 'bookings' ? <CustomerBookingsAcrossProviders providers={providers ? providerOptions : null} onSelectProvider={chooseProvider} t={t} />
    : view.name === 'requests' ? <CustomerRequestsAcrossProviders providers={providers ? providerOptions : null} onSelectProvider={chooseProvider} t={t} />
    : view.name === 'projects' ? <CustomerProjectsAcrossProviders providers={providers ? providerOptions : null} onSelectProvider={chooseProvider} t={t} />
    : view.name === 'alerts' ? <CustomerNotificationsAcrossProviders providers={providers ? providerOptions : null} t={t} />
    : view.name === 'quotations' ? <QuotationsPage providers={providers ? providerOptions : null} onSelectProvider={chooseProvider} t={t} />
    : view.name === 'coverage' ? <CustomerCoverageAcrossProviders providers={providers ? providerOptions : null} onSelectProvider={chooseProvider} t={t} />
    : view.name === 'documents' ? <CustomerDocumentsAcrossProviders providers={providers ? providerOptions : null} sourceId={view.sourceId} onSelectProvider={chooseProvider} t={t} />
    : ['asset', 'request', 'request-detail', 'request-success', 'booking-detail', 'service-detail', 'quotation', 'document', 'project', 'coverage-detail'].includes(view.name) && !providerId ? <CustomerScopedDetailResolver id={view.id!} providers={providers ? providerOptions : null} load={(id, contextId) => view.name === 'asset' || view.name === 'request' ? customerData.asset(contextId, id) : view.name === 'request-detail' || view.name === 'request-success' ? customerData.request(contextId, id) : view.name === 'booking-detail' ? customerData.booking(contextId, id) : view.name === 'service-detail' ? customerData.job(contextId, id) : view.name === 'quotation' ? customerData.quotation(contextId, id) : view.name === 'project' ? customerData.installationProject(contextId, id) : view.name === 'coverage-detail' && view.kind === 'warranty' ? customerData.warranty(contextId, id) : view.name === 'coverage-detail' ? customerData.contract(contextId, id) : customerData.document(contextId, id)} onProviderResolved={chooseProvider} t={t} />
    : ['asset', 'request', 'request-detail', 'request-success', 'booking-detail', 'service-detail', 'quotation', 'document', 'project', 'coverage-detail'].includes(view.name) && !contextReady ? <DataState message={t('loading')} t={t} />
    : view.name === 'asset' ? <AssetDetail providerId={providerId} providerName={providerOptions.find((provider) => provider.id === providerId)?.attributes.display_name || 'Service provider'} id={view.id!} t={t} />
    : view.name === 'request' ? <RequestForm key={`${providerId}:${view.id}`} providerId={providerId} providerName={providerOptions.find((provider) => provider.id === providerId)?.attributes.display_name || 'Service provider'} customerName={session.displayName} assetId={view.id!} t={t} />
    : view.name === 'request-detail' ? <RequestDetail providerId={providerId} id={view.id!} t={t} />
    : view.name === 'request-success' && providerId && view.id ? <CustomerRequestReceipt providerId={providerId} providerName={providerOptions.find((provider) => provider.id === providerId)?.attributes.display_name || 'Service provider'} id={view.id} t={t} />
    : view.name === 'booking-detail' ? <CustomerBookingDetail providerId={providerId} providerName={providerOptions.find((provider) => provider.id === providerId)?.attributes.display_name || 'Service provider'} id={view.id!} t={t} />
    : view.name === 'service-detail' ? <CustomerServiceDetail providerId={providerId} providerName={providerOptions.find((provider) => provider.id === providerId)?.attributes.display_name || 'Service provider'} id={view.id!} onBack={() => go('/bookings')} onOpenAsset={(contextId, assetId) => { chooseProvider(contextId); go(`/asset/${assetId}`); }} t={t} />
    : view.name === 'quotation' ? <QuotationReviewPage providerId={providerId} id={view.id!} t={t} />
    : view.name === 'document' ? <DocumentDetail providerId={providerId} id={view.id!} t={t} />
    : <CustomerBookingsAcrossProviders providers={providers ? providerOptions : null} onSelectProvider={chooseProvider} t={t} />;

  if (quotationPortal) return <main className="app-shell customer-app-shell quotation-app-shell"><header className="quotation-app-header"><Wordmark variant={theme === 'dark' ? 'dark' : 'light'} /><div className="quotation-app-header-right"><button className="customer-global-search-trigger" type="button" onClick={() => setGlobalSearchOpen(true)} aria-label="Find an asset or service" aria-haspopup="dialog"><CustomerNavIcon name="search" /><span>Find an asset or service</span><kbd>⌘ K</kbd></button><button className="customer-theme-toggle" type="button" aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><CustomerNavIcon name={theme === 'dark' ? 'theme-light' : 'theme-dark'} /></button><CustomerNotificationBell providers={providers?.data ?? null} onViewAll={() => go('/alerts')} /><CustomerProfileMenu displayName={session.displayName} onSignOut={() => void signOut()} /></div></header>{globalSearchOpen && <CustomerGlobalSearch providers={providers?.data ?? null} onSelectProvider={chooseProvider} onClose={() => setGlobalSearchOpen(false)} />}<div className="customer-layout"><aside className="customer-sidebar"><CustomerNavigation view={view} displayName={session.displayName} /></aside><section className="customer-workspace">{content}</section></div><footer className="customer-footer"><span>TRISE Customer Portal</span><span className="customer-footer-tag" aria-label="Terms and Conditions">T&amp;C</span></footer></main>;

  return <main className={`app-shell customer-app-shell${view.name === 'feedback' && view.id ? ' customer-feedback-shell' : ''}`}>
    <header className={`customer-header${compactHeader ? ' is-compact' : ''}`}><div className="customer-brand"><Wordmark variant={theme === 'dark' ? 'dark' : 'light'} /></div><div className="customer-header-actions"><button className="customer-global-search-trigger" type="button" onClick={() => setGlobalSearchOpen(true)} aria-label="Find an asset or service" aria-haspopup="dialog"><CustomerNavIcon name="search" /><span>Find an asset or service</span><kbd>⌘ K</kbd></button><button className="customer-theme-toggle" type="button" aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><CustomerNavIcon name={theme === 'dark' ? 'theme-light' : 'theme-dark'} /></button><CustomerNotificationBell providers={providers?.data ?? null} onViewAll={() => go('/alerts')} /><CustomerProfileMenu displayName={session.displayName} onSignOut={() => void signOut()} /></div></header>
    {globalSearchOpen && <CustomerGlobalSearch providers={providers?.data ?? null} onSelectProvider={chooseProvider} onClose={() => setGlobalSearchOpen(false)} />}
    <div className="customer-layout"><aside className="customer-sidebar"><CustomerNavigation view={view} displayName={session.displayName} /></aside><section className="customer-workspace">{content}</section></div>
    <footer className="customer-footer"><span>TRISE Customer Portal</span><span className="customer-footer-tag" aria-label="Terms and Conditions">T&amp;C</span></footer>
  </main>;
}

function CustomerLoginPage({ authError }: { authError: string | null }) {
  return <main className="app-shell customer-login-shell">
    <section className="customer-login-card" aria-labelledby="customer-login-title">
      <Wordmark variant="dark" />
      <span className="customer-login-eyebrow">WELCOME TO A LITTLE MORE PEACE OF MIND</span>
      <h1 id="customer-login-title">Your everyday.<br />Well cared for.</h1>
      <p>Your assets, services and trusted providers. Connected in one place.</p>
      {authError && <p className="customer-login-error" role="alert">{authError}</p>}
      <GoogleSignInButton />
      <small className="customer-login-privacy">Your assets and service records stay private until your identity and customer relationship are verified.</small>
      <details className="customer-login-help"><summary>Help with access</summary><p>Sign in with the Google account your service provider linked to your customer profile. If your account is missing a place or service record, ask the provider to share it with your customer account.</p></details>
    </section>
    <footer className="customer-footer"><span>TRISE Customer Portal</span><span className="customer-footer-tag" aria-label="Terms and Conditions">T&amp;C</span></footer>
  </main>;
}

function CustomerNavigation({ view, displayName }: { view: View; displayName: string }) {
  const links = customerSidebarDestinations.map(([name, route, title, icon]) => ({ name, route, title, icon }));
  const activeName = view.name === 'asset' || view.name === 'request' ? 'assets' : ['request-start', 'requests', 'request-detail', 'service-detail', 'booking-detail', 'feedback'].includes(view.name) ? 'bookings' : view.name === 'quotation' ? 'quotations' : view.name === 'document' ? 'documents' : view.name === 'place' ? 'places' : view.name;
  const moreActive = !['home', 'assets', 'bookings'].includes(activeName);
  const primaryLinks = links.filter((link) => ['home', 'assets', 'bookings'].includes(link.name));
  return <>
    <nav className="customer-navigation" aria-label="Customer navigation"><div className="customer-navigation-group"><p>Your workspace</p>{links.map((link) => <button type="button" key={link.name} className={activeName === link.name ? 'active' : ''} aria-current={activeName === link.name ? 'page' : undefined} onClick={() => go(link.route)}><span className="customer-nav-icon-wrap" aria-hidden="true"><CustomerNavIcon name={link.icon} /></span>{link.title}</button>)}</div></nav>
    <div className="customer-sidebar-bottom">
      <section className="customer-sidebar-help" aria-label="Help centre">
        <CustomerNavIcon name="help" />
        <h2>A little help?</h2>
        <p>Find the right next step for your service.</p>
        <button type="button" onClick={() => go('/help')}>Visit help centre <span aria-hidden="true">→</span></button>
      </section>
      <button type="button" className={`customer-sidebar-profile${activeName === 'profile' ? ' active' : ''}`} aria-current={activeName === 'profile' ? 'page' : undefined} onClick={() => go('/profile')}>
        <span className="customer-nav-icon-wrap" aria-hidden="true"><CustomerNavIcon name="profile" /></span>
        Profile &amp; security
      </button>
      <div className="customer-account"><span className="avatar" aria-hidden="true">{displayName.trim().slice(0, 1).toUpperCase() || 'C'}</span><span><strong>{displayName}</strong><small>Personal account</small></span></div>
    </div>
    <nav className="customer-mobile-navigation" aria-label="Customer mobile navigation">{primaryLinks.map((link) => <button type="button" key={link.name} className={activeName === link.name ? 'active' : ''} aria-current={activeName === link.name ? 'page' : undefined} onClick={() => go(link.route)}><CustomerNavIcon name={link.icon} /><span>{link.name === 'home' ? 'Home' : link.name === 'bookings' ? 'Services' : link.title}</span></button>)}<button type="button" className={moreActive ? 'active' : ''} aria-current={moreActive ? 'page' : undefined} onClick={() => go('/more')}><CustomerNavIcon name="more" /><span>More</span></button></nav>
  </>;
}

type CustomerNavIconName = 'home' | 'providers' | 'assets' | 'places' | 'members' | 'timeline' | 'help' | 'bookings' | 'requests' | 'projects' | 'quotations' | 'coverage' | 'documents' | 'alerts' | 'profile' | 'logout' | 'more' | 'search' | 'theme-system' | 'theme-light' | 'theme-dark';
function CustomerNavIcon({ name }: { name: CustomerNavIconName }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<CustomerNavIconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-7h6v7"/></>,
    providers: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c.5-3.3 2.6-5 6-5s5.5 1.7 6 5m1-4c2.8-.1 4.3 1.2 5 3"/></>,
    assets: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8v8H8zM12 8v8m-4-4h8"/></>,
    places: <><path d="M4 20V8l8-5 8 5v12"/><path d="M9 20v-6h6v6m-8-9h.01m10 0h.01"/></>,
    members: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c.4-3.2 2.4-5 6-5s5.6 1.8 6 5m1-4c2.5-.1 4.1 1.2 5 3"/></>,
    timeline: <><path d="M5 3v18M3 6h4m-4 6h4m-4 6h4m4-12h10m-10 6h7m-7 6h10"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.7 1.6c-.9 1-2.2 1.2-2.2 3m0 3h.01"/></>,
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
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    'theme-system': <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></>,
    'theme-light': <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    'theme-dark': <><path d="M20.5 14.4A8.5 8.5 0 0 1 9.6 3.5 8.5 8.5 0 1 0 20.5 14.4Z"/></>
  };
  return <svg className="customer-nav-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}>{paths[name]}</svg>;
}

function Wordmark({ variant = 'dark' }: { variant?: 'dark' | 'light' }) { return <div className="wordmark"><TriseBrandHeader variant={variant} /></div>; }
function CustomerProfileMenu({ displayName, onSignOut }: { displayName: string; onSignOut: () => void }) {
  return <details className="customer-profile-menu"><summary aria-label="Open profile menu"><span className="avatar" aria-hidden="true">{displayName.trim().slice(0, 1).toUpperCase() || 'C'}</span><span className="customer-profile-name">{displayName}</span><span className="customer-profile-chevron" aria-hidden="true">⌄</span></summary><div className="customer-profile-popover"><div className="customer-profile-identity"><strong>{displayName}</strong><small>Customer account</small></div><button type="button" onClick={() => go('/more')}><CustomerNavIcon name="more" />More customer tools</button><button type="button" onClick={() => go('/requests')}><CustomerNavIcon name="requests" />Service requests</button><button type="button" onClick={() => go('/service-providers')}><CustomerNavIcon name="providers" />My providers</button><button type="button" onClick={() => go('/profile')}><CustomerNavIcon name="profile" />View profile details</button><button type="button" onClick={onSignOut}><CustomerNavIcon name="logout" />Logout</button></div></details>;
}

type GlobalSearchResult = {
  providerId: string;
  id: string;
  title: string;
  subtitle: string;
  kind: GlobalSearchKind;
  route: string;
};

function CustomerGlobalSearch({ providers, onSelectProvider, onClose }: { providers: Resource<ProviderAttributes>[] | null; onSelectProvider: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'asset' | 'service'>('asset');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    inputRef.current?.focus();
    const onCloseDialog = () => onClose();
    dialog.addEventListener('close', onCloseDialog);
    return () => dialog.removeEventListener('close', onCloseDialog);
  }, [onClose]);

  useEffect(() => {
    const term = query.trim();
    setResults([]);
    setFailedCount(0);
    if (term.length < 2 || !providers?.length) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    const timeout = window.setTimeout(async () => {
      const tasks = kind === 'asset'
        ? providers.map((provider) => customerData.assets(provider.id, { limit: 15 }, { query: term }).then((page) => ({ providerId: provider.id, kind: 'asset' as const, page })))
        : providers.flatMap((provider) => [
            customerData.requests(provider.id, { limit: 15 }).then((page) => ({ providerId: provider.id, kind: 'request' as const, page })),
            customerData.bookings(provider.id, { limit: 15 }).then((page) => ({ providerId: provider.id, kind: 'booking' as const, page })),
            customerData.jobs(provider.id, { limit: 15 }).then((page) => ({ providerId: provider.id, kind: 'service' as const, page }))
          ]);
      const settled = await Promise.allSettled(tasks);
      if (!active) return;
      const found: GlobalSearchResult[] = [];
      let failed = 0;
      settled.forEach((result) => {
        if (result.status === 'rejected') { failed += 1; return; }
        const task = result.value;
        const providerName = providers.find((provider) => provider.id === task.providerId)?.attributes.display_name || 'Authorized service provider';
        if (task.kind === 'asset') {
          task.page.data.forEach((asset) => {
            const identifier = asset.attributes.identifiers?.find((item) => item.value)?.value;
            const place = [asset.attributes.service_location_name ? customerReadableName(asset.attributes.service_location_name) : '', customerVisibleAddressText(asset.attributes.service_location_address)].filter(Boolean).join(' · ');
            found.push({ providerId: task.providerId, id: asset.id, title: customerReadableName(asset.attributes.name), subtitle: [identifier, place, providerName].filter(Boolean).join(' · '), kind: 'asset', route: globalSearchRoute('asset', asset.id) });
          });
        } else {
          task.page.data.forEach((record) => {
            const attrs = record.attributes as RequestAttributes | BookingAttributes | ServiceJobAttributes;
            const title = attrs.summary || 'Service visit';
            const location = 'historical_location' in attrs ? attrs.historical_location?.name || attrs.historical_location?.service_location_name : undefined;
            if (!matchesGlobalSearch(term, [title, 'description' in attrs ? attrs.description : undefined, attrs.status, providerName, location])) return;
            found.push({ providerId: task.providerId, id: record.id, title, subtitle: [attrs.status.replaceAll('_', ' '), location, providerName].filter(Boolean).join(' · '), kind: task.kind, route: globalSearchRoute(task.kind, record.id) });
          });
        }
      });
      setResults(found);
      setFailedCount(failed);
      setLoading(false);
    }, 180);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [query, kind, providers]);

  function openResult(result: GlobalSearchResult) {
    onSelectProvider(result.providerId);
    go(result.route);
    dialogRef.current?.close();
  }

  function viewAllMatches() {
    sessionStorage.setItem('trise-customer-global-search-query', query.trim());
    window.dispatchEvent(new CustomEvent('trise:customer-global-search', { detail: { kind, query: query.trim() } }));
    go(kind === 'asset' ? '/assets' : '/bookings');
    dialogRef.current?.close();
  }

  return <dialog ref={dialogRef} className="customer-global-search-dialog" aria-labelledby="customer-global-search-title" onCancel={(event) => { event.preventDefault(); dialogRef.current?.close(); }} onMouseDown={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}>
    <div className="customer-global-search-head"><div><Status>Search your account</Status><h2 id="customer-global-search-title">Find an asset or service</h2><p>Search records shared with your customer account.</p></div><button className="customer-global-search-close" type="button" aria-label="Close search" onClick={() => dialogRef.current?.close()}>×</button></div>
    <label className="customer-global-search-input"><CustomerNavIcon name="search" /><span className="sr-only">Search by name, place, asset code or service</span><input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, place, asset code or service" autoComplete="off" /></label>
    <div className="customer-global-search-tabs" role="group" aria-label="Search category"><button type="button" aria-pressed={kind === 'asset'} className={kind === 'asset' ? 'active' : ''} onClick={() => setKind('asset')}>Assets</button><button type="button" aria-pressed={kind === 'service'} className={kind === 'service' ? 'active' : ''} onClick={() => setKind('service')}>Services</button></div>
    <div className="customer-global-search-results" aria-live="polite">
      {query.trim().length < 2 ? <p className="customer-global-search-hint">Enter at least two characters to search {kind === 'asset' ? 'authorized assets' : 'recent requests, appointments and service visits'}.</p>
        : !providers ? <p className="customer-global-search-hint">Loading your linked service accounts…</p>
        : providers.length === 0 ? <p className="customer-global-search-hint">No service providers are linked to this customer account.</p>
        : loading ? <p className="customer-global-search-hint">Searching your linked service accounts…</p>
        : results.length ? <>{kind === 'service' && <p className="customer-global-search-hint">Showing matches from the 15 most recent records of each service type and provider.</p>}{results.map((result) => <button className="customer-global-search-result" type="button" key={`${result.kind}:${result.providerId}:${result.id}`} onClick={() => openResult(result)}><span className="customer-global-search-result-icon"><CustomerNavIcon name={result.kind === 'asset' ? 'assets' : 'bookings'} /></span><span><strong>{result.title}</strong><small>{result.subtitle}</small></span><span aria-hidden="true">›</span></button>)}<button className="customer-global-search-view-all" type="button" onClick={viewAllMatches}>View all matching {kind === 'asset' ? 'assets' : 'service activity'} <span aria-hidden="true">→</span></button></>
        : <p className="customer-global-search-hint">{failedCount > 0 && failedCount === (providers.length || 0) * (kind === 'service' ? 3 : 1) ? 'Search is temporarily unavailable. Try again in a moment.' : `No matching ${kind === 'asset' ? 'assets' : 'recent service records'} were found in your customer account.`}</p>}
    </div>
    {failedCount > 0 && <p className="customer-global-search-partial" role="status">Some linked accounts could not be searched. Results may be incomplete.</p>}
    <div className="customer-global-search-footer"><span>Only records you are authorized to view are searched.</span><kbd>ESC</kbd></div>
  </dialog>;
}

function ProviderDirectoryPage({ providers, activeProviderId, onSelect, t }: { providers: Resource<ProviderAttributes>[] | null; activeProviderId: string; onSelect: (id: string) => void; t: T }) {
  const displayNames = new Map(disambiguateProviderNames((providers || []).map(provider => ({ providerId: provider.id, providerName: provider.attributes.display_name || 'Service provider' }))).map(entry => [entry.providerId, entry.providerName]));
  return <section className="content provider-directory"><div className="section-heading"><div><Status>Customer account</Status><h2>My service providers</h2></div></div><p className="provider-directory-intro">Your assets, service requests, quotations and coverage already appear together across these relationships. Choose a provider only when opening a provider-specific record or action.</p>{providers === null ? <DataState message={t('loading')} t={t} /> : providers.length ? <div className="record-grid">{providers.map((provider) => <article className="record-card provider-card" key={provider.id}><span className="provider-card-mark" aria-hidden="true">◎</span><strong>{displayNames.get(provider.id)}</strong><span>Authorized customer relationship</span><button type="button" className="provider-card-action" aria-pressed={activeProviderId === provider.id} onClick={() => onSelect(provider.id)}>{activeProviderId === provider.id ? 'Current session context' : 'Use for record actions'}<span aria-hidden="true">→</span></button></article>)}</div> : <DataState message={t('noProvider')} t={t} />}</section>;
}
type T = (key: string) => string;
type ProviderBooking = { booking: Resource<BookingAttributes>; providerId: string };
type ProviderQuote = { quote: Resource<QuotationAttributes>; providerId: string };
type ProviderRecord<T> = { resource: Resource<T>; providerId: string };

function useProviderRecords<T>(providers: Resource<ProviderAttributes>[] | null, load: (providerId: string, page?: CollectionPage) => Promise<Collection<T>>, pageSize = 15, allowPartial = false) {
  const [records, setRecords] = useState<ProviderRecord<T>[] | null>(null);
  const [cursors, setCursors] = useState<Record<string, string | null>>({});
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [retryRevision, setRetryRevision] = useState(0);
  const providerKey = providers?.map((provider) => provider.id).join('|') ?? 'loading';
  const providerRef = useRef(providers); providerRef.current = providers;
  const activeKey = useRef(providerKey); activeKey.current = providerKey;
  const loader = useRef(load); loader.current = load;
  useEffect(() => {
    let active = true;
    setRecords(null); setCursors({}); setError(''); setLoadingMore(false);
    if (!providers) return () => { active = false; };
    if (providers.length === 0) { setRecords([]); return () => { active = false; }; }
    Promise.all(providers.map(async ({ id }) => {
      try { return { providerId: id, page: await loader.current(id, { limit: pageSize }) }; }
      catch (cause) {
        if (!allowPartial) throw cause;
        return { providerId: id, failure: cause };
      }
    }))
      .then((results) => {
        if (!active) return;
        const pages = results.filter((result): result is { providerId: string; page: Collection<T> } => 'page' in result);
        const failures = results.filter((result): result is { providerId: string; failure: unknown } => 'failure' in result);
        if (failures.length === results.length) {
          setError(errorText(failures[0]?.failure));
          return;
        }
        setRecords(pages.flatMap(({ providerId, page }) => page.data.map((resource) => ({ providerId, resource }))));
        setCursors(Object.fromEntries(pages.map(({ providerId, page }) => [providerId, page.page?.next ?? null])));
        if (failures.length) setError('Some service-provider alerts could not load. Retry to load the full account feed.');
      })
      .catch((cause) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [providerKey, pageSize, retryRevision, allowPartial]);
  function retry() { setRetryRevision((revision) => revision + 1); }
  async function loadMore() {
    const currentProviders = providerRef.current;
    const currentRecords = records;
    if (!currentProviders || !currentRecords || loadingMore || error || !Object.values(cursors).some(Boolean)) return;
    const requestKey = providerKey;
    setLoadingMore(true); setError('');
    try {
      const results = await Promise.all(currentProviders.filter(({ id }) => cursors[id]).map(async ({ id }) => {
        try { return { providerId: id, page: await loader.current(id, { limit: pageSize, after: cursors[id]! }) }; }
        catch (cause) {
          if (!allowPartial) throw cause;
          return { providerId: id, failure: cause };
        }
      }));
      if (activeKey.current !== requestKey) return;
      const pages = results.filter((result): result is { providerId: string; page: Collection<T> } => 'page' in result);
      const failures = results.filter((result): result is { providerId: string; failure: unknown } => 'failure' in result);
      if (failures.length) setError('Some service-provider alerts could not load. Retry to load the full account feed.');
      const nextCursors = { ...cursors };
      pages.forEach(({ providerId, page }) => { nextCursors[providerId] = page.page?.next ?? null; });
      setCursors(nextCursors);
      setRecords((current) => {
        if (!current) return current;
        const seen = new Set(current.map(({ providerId, resource }) => `${providerId}:${resource.id}`));
        const added = pages.flatMap(({ providerId, page }) => page.data.map((resource) => ({ providerId, resource }))).filter(({ providerId, resource }) => !seen.has(`${providerId}:${resource.id}`));
        return [...current, ...added];
      });
    } catch (cause) { if (activeKey.current === requestKey) setError(errorText(cause)); }
    finally { if (activeKey.current === requestKey) setLoadingMore(false); }
  }
  function updateRecord(providerId: string, id: string, update: (current: Resource<T>) => Resource<T>) {
    setRecords((current) => current?.map((entry) => entry.providerId === providerId && entry.resource.id === id ? { ...entry, resource: update(entry.resource) } : entry) ?? null);
  }
  return { records, cursors, error, loadingMore, loadMore, retry, hasMore: Object.values(cursors).some(Boolean), updateRecord };
}

function CustomerScopedDetailResolver({ id, providers, load, onProviderResolved, t }: { id: string; providers: Resource<ProviderAttributes>[] | null; load: (id: string, providerId: string) => Promise<Resource<unknown>>; onProviderResolved: (providerId: string) => void; t: T }) {
  const [state, setState] = useState<'loading' | 'resolved' | 'unavailable' | 'error'>('loading');
  const loader = useRef(load); loader.current = load;
  useEffect(() => {
    let active = true;
    setState('loading');
    if (!providers) return () => { active = false; };
    if (providers.length === 0) { setState('unavailable'); return () => { active = false; }; }
    (async () => {
      let failures = 0;
      for (const provider of providers) {
        try { await loader.current(id, provider.id); if (!active) return; setState('resolved'); onProviderResolved(provider.id); return; }
        catch { failures += 1; }
      }
      if (active) setState(failures === providers.length ? 'unavailable' : 'error');
    })();
    return () => { active = false; };
  }, [id, providers?.map((provider) => provider.id).join('|')]);
  if (state === 'loading' || state === 'resolved') return <DataState message={t('loading')} t={t} />;
  if (state === 'error') return <DataState message="We could not verify access to this customer record. Try again." t={t} />;
  return <DataState message="This record is not available in your customer account." t={t} />;
}

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

function CustomerHome({ providers, displayName, onSelectProvider, t }: { providers: Resource<ProviderAttributes>[] | null; displayName: string; onSelectProvider: (id: string) => void; t: T }) {
  const [assets, setAssets] = useState<Collection<AssetAttributes> | null>(null);
  const [bookings, setBookings] = useState<ProviderBooking[] | null>(null);
  const [jobs, setJobs] = useState<Array<Resource<ServiceJobAttributes>> | null>(null);
  const [quotes, setQuotes] = useState<ProviderQuote[] | null>(null);
  const [warranties, setWarranties] = useState<Array<Resource<WarrantyAttributes>> | null>(null);
  const [contracts, setContracts] = useState<Array<Resource<ContractAttributes>> | null>(null);
  const [hasMore, setHasMore] = useState({ assets: false, jobs: false, quotes: false, coverage: false });
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setAssets(null); setBookings(null); setJobs(null); setQuotes(null); setWarranties(null); setContracts(null); setHasMore({ assets: false, jobs: false, quotes: false, coverage: false }); setError('');
    if (providers) {
      Promise.all(providers.map(async (provider) => {
        const [assetsPage, bookingsPage, jobsPage, quotationsPage, warrantiesPage, contractsPage] = await Promise.all([
          customerData.assets(provider.id, { limit: 100 }),
          customerData.bookings(provider.id, { limit: 100 }),
          customerData.jobs(provider.id, { limit: 100 }),
          customerData.quotations(provider.id, { limit: 100 }),
          customerData.warranties(provider.id, { limit: 100 }),
          customerData.contracts(provider.id, { limit: 100 })
        ]);
        return { providerId: provider.id, assets: assetsPage, bookings: bookingsPage, jobs: jobsPage, quotations: quotationsPage, warranties: warrantiesPage, contracts: contractsPage };
      }))
        .then((results) => {
          if (!active) return;
          const allAssets = results.flatMap((result) => result.assets.data).sort((left, right) => right.attributes.created_at.localeCompare(left.attributes.created_at) || left.id.localeCompare(right.id));
          const assetsHaveMore = results.some((result) => result.assets.page?.next);
          setAssets({ data: allAssets, page: { next: assetsHaveMore ? 'more-authorized-assets' : null } });
          setBookings(results.flatMap((result) => result.bookings.data.map((booking) => ({ booking, providerId: result.providerId }))));
          const allJobs = results.flatMap((result) => result.jobs.data);
          const allQuotes = results.flatMap((result) => result.quotations.data.map((quote) => ({ quote, providerId: result.providerId })));
          const allWarranties = results.flatMap((result) => result.warranties.data);
          const allContracts = results.flatMap((result) => result.contracts.data);
          setJobs(allJobs);
          setQuotes(allQuotes);
          setWarranties(allWarranties);
          setContracts(allContracts);
          setHasMore({
            assets: assetsHaveMore,
            jobs: results.some((result) => result.jobs.page?.next),
            quotes: results.some((result) => result.quotations.page?.next),
            coverage: results.some((result) => result.warranties.page?.next || result.contracts.page?.next),
          });
        })
        .catch((cause) => { if (active) setError(errorText(cause)); });
    }
    return () => { active = false; };
  }, [providers]);
  if (error) return <DataState message={error} t={t} />;
  if (!assets || !bookings || !jobs || !quotes || !warranties || !contracts) return <DataState message={t('loading')} t={t} />;

  const upcomingItem = bookings.filter(({ booking }) => ['CONFIRMED', 'RESCHEDULED'].includes(booking.attributes.status) && new Date(booking.attributes.requested_window.starts_at).getTime() >= Date.now()).sort((left, right) => new Date(left.booking.attributes.requested_window.starts_at).getTime() - new Date(right.booking.attributes.requested_window.starts_at).getTime())[0];
  const upcoming = upcomingItem?.booking;
  const upcomingDate = upcoming ? new Date(upcoming.attributes.requested_window.starts_at) : null;
  const upcomingAssetRelation = upcoming?.relationships.asset;
  const upcomingAssetId = Array.isArray(upcomingAssetRelation) ? upcomingAssetRelation[0]?.id : upcomingAssetRelation && 'id' in upcomingAssetRelation ? upcomingAssetRelation.id : undefined;
  const upcomingAsset = upcomingAssetId ? assets.data.find((asset) => asset.id === upcomingAssetId) : undefined;
  const approvalQuotes = customerDecisionQuotes(quotes);
  const featuredQuote = approvalQuotes[0];
  const coverageCount = activeCoverageCount(warranties, contracts);
  const stats: Array<{ label: string; count: number | string; icon: CustomerNavIconName; route: string }> = [
    { label: 'Assets in your care', count: homeCountLabel(assets.data.length, hasMore.assets), icon: 'assets', route: '/assets' },
    { label: 'Active services', count: homeCountLabel(activeServiceCount(jobs), hasMore.jobs), icon: 'bookings', route: '/bookings' },
    { label: 'Needs your approval', count: homeCountLabel(approvalQuotes.length, hasMore.quotes), icon: 'quotations', route: '/quotations' },
    { label: 'Active coverages', count: homeCountLabel(coverageCount, hasMore.coverage), icon: 'coverage', route: '/coverage' }
  ];

  return <section className="customer-home">
    <header className="customer-home-greeting"><time dateTime={new Date().toISOString()}>{customerHomeDate()}</time><div><h1>{customerGreeting(displayName)}</h1><p>A little care today. Fewer surprises tomorrow.</p></div></header>
    <div className="customer-overview-hero"><div className="customer-overview-hero-copy"><div className="customer-overview-eyebrow">YOUR EVERYDAY, TAKEN CARE OF</div><h2>Your spaces.<br />In good hands.</h2><p>One place for your assets, trusted service and everything that comes after.</p><div className="customer-overview-actions"><Button onClick={() => go('/request')}><span aria-hidden="true">+</span> Request a service</Button><span className="customer-overview-trust"><CustomerNavIcon name="coverage" />Care that stays connected</span></div></div><CustomerOverviewArt /></div>
    <div className="customer-overview-stats" aria-label="Account overview">{stats.map((item) => <button className="customer-overview-stat" type="button" key={item.label} onClick={() => go(item.route)}><span className="overview-stat-icon"><CustomerNavIcon name={item.icon} /></span><span className="overview-stat-value">{item.count}</span><span className="overview-stat-label">{item.label}</span></button>)}</div>
    <div className="customer-overview-columns">
      <div className="customer-overview-main">
        <section className="home-card upcoming-card"><div className="card-title"><div><h2>Your next visit</h2><p>We’ll keep you updated along the way.</p></div>{upcoming && <Status>{upcoming.attributes.status}</Status>}</div>{upcoming && upcomingDate ? <div className="upcoming-visit-row"><div className="upcoming-date-tile"><small>{new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIME_ZONE, month: 'short' }).format(upcomingDate)}</small><strong>{new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIME_ZONE, day: '2-digit' }).format(upcomingDate)}</strong><small>{new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIME_ZONE, weekday: 'short' }).format(upcomingDate)}</small></div><div className="upcoming-visit-details"><strong>{serviceTrackingTitle(upcoming.attributes.summary, upcomingAsset?.attributes.name)}</strong><span>{upcomingAsset ? `${customerReadableName(upcomingAsset.attributes.name)} · ` : ''}{formatIndiaDateTime(upcoming.attributes.requested_window.starts_at)}</span><small>{providers?.find((provider) => provider.id === upcomingItem.providerId)?.attributes.display_name || 'Authorized service provider'}</small><small>Ends {formatIndiaDateTime(upcoming.attributes.requested_window.ends_at)}</small><button className="text-button" onClick={() => go('/bookings')}>View service bookings →</button></div></div> : <div className="overview-activity-empty"><span className="overview-activity-icon"><CustomerNavIcon name="bookings" /></span><div><strong>{t('noUpcomingVisit')}</strong><p>Confirmed appointments will appear here.</p></div><button className="text-button" onClick={() => go('/bookings')}>View service bookings →</button></div>}</section>
        <section className="overview-assets-section"><div className="section-heading"><div><Status>{t('assets')}</Status><h2>Assets you care about</h2><p>Quick access to the assets linked to your account.</p></div><button className="text-button" onClick={() => go('/assets')}>{t('view')} all <span aria-hidden="true">→</span></button></div>{assets.data.length ? <div className="home-asset-grid">{assets.data.slice(0, 3).map((asset) => { const assetName = customerReadableName(asset.attributes.name); const location = homeAssetLocation(asset.attributes); const nextService = nextConfirmedBookingForAsset(asset.id, bookings); const coverageLabel = customerAssetCoverageLabel(asset.id, warranties, contracts); return <button className="home-asset-card overview-asset-card" type="button" key={asset.id} onClick={() => { onSelectProvider(asset.attributes.provider_id); go(`/asset/${asset.id}`); }} aria-label={`View ${assetName} details`}><span className="overview-asset-top"><span className="overview-asset-icon"><CustomerAssetIcon /></span><span className="overview-asset-status">{coverageLabel || asset.attributes.status.replaceAll('_', ' ')}</span></span><strong>{assetName}</strong><span className="overview-asset-identifier">{location || 'Site details not shared'}</span><span className="overview-asset-footer">{nextService ? `Next service · ${formatIndiaDate(nextService.booking.attributes.requested_window.starts_at)}` : 'No confirmed visit scheduled'} <CustomerNavIcon name="requests" /></span></button>; })}</div> : <DataState message={t('empty')} t={t} />}</section>
      </div>
      <aside className="customer-overview-aside">
        <section className="home-card quick-decision-card"><div className="card-title"><div><h2>A quick decision</h2><p>{featuredQuote ? 'One approval to keep things moving.' : 'Review sent quotations and respond securely.'}</p></div><span className="overview-decision-icon"><CustomerNavIcon name="quotations" /></span></div>{featuredQuote ? <><Status>Needs your approval</Status><h3>{quotationScopeSummary(featuredQuote.quote.attributes).title}</h3><p>{featuredQuote.quote.attributes.quotation_number || `Quotation ${featuredQuote.quote.id.slice(0, 8)}`} · Revision {featuredQuote.quote.attributes.revision}</p><div className="quote-total"><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: featuredQuote.quote.attributes.currency }).format(Number(featuredQuote.quote.attributes.total))}</span><Status>{featuredQuote.quote.attributes.valid_until ? `Due ${formatIndiaDate(featuredQuote.quote.attributes.valid_until)}` : 'Review needed'}</Status></div><small>{customerHomeProviderName(featuredQuote.providerId, providers || [], featuredQuote.quote.attributes.provider_name)}</small><Button onClick={() => { onSelectProvider(featuredQuote.providerId); go(`/quotation/${featuredQuote.quote.id}`); }}>Review quotation</Button></> : <div className="overview-activity-empty"><span className="overview-activity-icon"><CustomerNavIcon name="quotations" /></span><div><strong>No quotation needs your approval</strong><p>Quotations ready for your response will appear here.</p></div><button className="text-button" onClick={() => go('/quotations')}>View quotations →</button></div>}</section>
        <section className="home-card connected-links"><div className="card-title"><h2>Everything, connected</h2></div><div className="overview-scan-row"><CustomerNavIcon name="assets" /><span><strong>Find or scan an asset</strong><small>Use its E-Code to find the asset and registered place.</small></span><ScanAsset providers={providers || []} onSelectProvider={onSelectProvider} t={t} buttonLabel="Find by E-Code" /></div><button className="overview-link-row" onClick={() => go('/documents')}><CustomerNavIcon name="documents" /><span><strong>Your service documents</strong><small>Reports, quotations and coverage.</small></span><span aria-hidden="true">›</span></button><button className="overview-link-row" onClick={() => go('/members')}><CustomerNavIcon name="profile" /><span><strong>Share with family</strong><small>Give the right people the right access.</small></span><span aria-hidden="true">›</span></button></section>
      </aside>
    </div>
  </section>;
}

function CustomerRequestStart({ providers, customerName, onSelectProvider, t }: { providers: Resource<ProviderAttributes>[] | null; customerName: string; onSelectProvider: (id: string) => void; t: T }) {
  const [records, setRecords] = useState<ProviderRecord<AssetAttributes>[] | null>(null);
  const [cursors, setCursors] = useState<Record<string, string | null>>({});
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [resolvedAsset, setResolvedAsset] = useState<ProviderRecord<AssetAttributes> | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [visibleCount, setVisibleCount] = useState(15);
  const providerKey = providers?.map((provider) => provider.id).join('|') ?? 'loading';
  const requestKey = `${providerKey}|${query}`;
  const activeKey = useRef(requestKey); activeKey.current = requestKey;
  useEffect(() => { const timer = window.setTimeout(() => setQuery(search.trim()), 250); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => {
    let active = true;
    setRecords(null); setCursors({}); setError(''); setLoadingMore(false); setVisibleCount(15); setSelectedAssetId(''); setResolvedAsset(null); setLookupError('');
    if (!providers) return () => { active = false; };
    Promise.all(providers.map(async (provider) => ({ providerId: provider.id, page: await customerData.assets(provider.id, { limit: 15 }, { query }) })))
      .then((pages) => {
        if (!active) return;
        const assets = pages.flatMap(({ providerId, page }) => page.data.map((resource) => ({ providerId, resource })))
          .sort((left, right) => right.resource.attributes.created_at.localeCompare(left.resource.attributes.created_at) || left.resource.id.localeCompare(right.resource.id));
        setRecords(assets);
        setCursors(Object.fromEntries(pages.map(({ providerId, page }) => [providerId, page.page?.next ?? null])));
      })
      .catch((cause) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [providerKey, query]);
  const hasMore = Object.values(cursors).some(Boolean);
  async function loadMore() {
    if (!providers || !records || loadingMore || !hasMore) return;
    const currentKey = requestKey;
    setLoadingMore(true); setError('');
    try {
      const pages = await Promise.all(providers.filter(({ id }) => cursors[id]).map(async ({ id }) => ({ providerId: id, page: await customerData.assets(id, { limit: 15, after: cursors[id]! }, { query }) })));
      if (activeKey.current !== currentKey) return;
      setCursors((current) => ({ ...current, ...Object.fromEntries(pages.map(({ providerId, page }) => [providerId, page.page?.next ?? null])) }));
      setRecords((current) => {
        if (!current) return current;
        const seen = new Set(current.map(({ providerId, resource }) => `${providerId}:${resource.id}`));
        const added = pages.flatMap(({ providerId, page }) => page.data.map((resource) => ({ providerId, resource }))).filter(({ providerId, resource }) => !seen.has(`${providerId}:${resource.id}`));
        return [...current, ...added];
      });
    } catch (cause) { if (activeKey.current === currentKey) setError(errorText(cause)); }
    finally { if (activeKey.current === currentKey) setLoadingMore(false); }
  }
  if (error && !records) return <DataState message={error} t={t} />;
  if (!records) return <DataState message={t('loading')} t={t} />;
  const providerNames = new Map(disambiguateProviderNames((providers || []).map((provider) => ({ providerId: provider.id, providerName: provider.attributes.display_name || 'Service provider' }))).map(({ providerId, providerName }) => [providerId, providerName]));
  const needle = search.trim().toLocaleLowerCase();
  const requestable = records.filter(({ resource }) => Boolean(resource.relationships.customer_relationship));
  const visible = requestable.filter(({ resource, providerId }) => {
    if (!needle) return true;
    const identifier = resource.attributes.identifiers?.map((item) => item.value || '').join(' ') || '';
    return [resource.attributes.name, resource.attributes.service_location_name, identifier, providerNames.get(providerId)].filter(Boolean).join(' ').toLocaleLowerCase().includes(needle);
  });
  const visibleAssets = visible.slice(0, visibleCount);
  const selected = resolvedAsset || visible.find(({ resource }) => resource.id === selectedAssetId) || null;
  async function showMoreAssets() {
    if (visible.length <= visibleCount && hasMore) await loadMore();
    setVisibleCount((current) => current + 15);
  }
  return <section className="content customer-request-start">
    <button className="text-button" type="button" onClick={() => go('/bookings')}>← Service &amp; bookings</button>
    <header className="customer-request-start-heading"><Status>Request service</Status><h1>Let’s get it sorted.</h1><p>Request a service in a few simple steps.</p></header>
    <div className="customer-request-start-columns">
      <section className="detail-card customer-request-start-card">
        <ol className="customer-request-progress" aria-label="Request service steps"><li aria-current="step"><span>1</span>Asset</li><li><span>2</span>Issue</li><li><span>3</span>Time</li><li><span>4</span>Review</li></ol>
        <h2>Which equipment needs service?</h2><p>Choose a linked asset, or use its E-Code to find it directly. Its registered place and service provider will be filled from the asset record.</p>
        <div className="customer-request-ecode-lookup"><ScanAsset providers={providers || []} onSelectProvider={onSelectProvider} t={t} buttonLabel="Scan or enter E-Code" onAssetFound={(providerId, asset) => {
          if (!asset.relationships.customer_relationship) { setLookupError('This asset is not linked to your customer account. Ask the service provider to link it before requesting service.'); return; }
          setLookupError(''); setResolvedAsset({ providerId, resource: asset }); setSelectedAssetId(asset.id);
        }} /></div>
        {lookupError && <p className="error" role="alert">{lookupError}</p>}
        <label className="customer-request-asset-search">Or search linked assets<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setResolvedAsset(null); setSelectedAssetId(''); setLookupError(''); }} placeholder="Search by asset, E-Code or place" /></label>
        {error && <p className="error" role="alert">Some assets could not be loaded: {error}</p>}
        {visible.length ? <div className="customer-request-asset-options">{visibleAssets.map(({ resource, providerId }) => {
          const assetIdentifier = resource.attributes.identifiers?.find((item) => item.value);
          const identifier = assetIdentifier?.value || null;
          const providerAccount = /·\s*Account\s+\d+$/.exec(providerNames.get(providerId) || '')?.[0].replace(/^·\s*/, '') || null;
          return <label className={`customer-request-asset-option${selectedAssetId === resource.id ? ' selected' : ''}`} key={`${providerId}:${resource.id}`}>
            <input type="radio" name="request-asset" value={resource.id} checked={!resolvedAsset && selectedAssetId === resource.id} onChange={() => { setResolvedAsset(null); setLookupError(''); setSelectedAssetId(resource.id); }} />
            <span className="customer-request-asset-copy"><strong>{customerReadableName(resource.attributes.name)}</strong><small>{customerRequestAssetContext(resource.attributes.service_location_name ? customerReadableName(resource.attributes.service_location_name) : null, identifier, providerAccount, resource.attributes.service_location_code)}</small></span>
          </label>;
        })}</div> : <div className="detail-card customer-request-asset-empty"><h3>{search.trim() ? 'No assets match that search.' : 'No requestable assets found.'}</h3><p>{search.trim() ? 'Try another asset name, place or asset code.' : 'A service provider must link an active customer relationship before you can request service for an asset.'}</p>{search && <Button onClick={() => setSearch('')}>Clear search</Button>}</div>}
        {(visible.length > visibleCount || hasMore) && <div className="customer-request-load-more"><Button disabled={loadingMore} onClick={() => void showMoreAssets()}>{loadingMore ? t('loading') : 'Load more assets'}</Button></div>}
        <div className="inline-actions customer-request-start-actions"><Button onClick={() => go('/bookings')}>Cancel</Button><Button disabled={!selected} onClick={() => { if (!selected) return; onSelectProvider(selected.providerId); go(`/asset/${selected.resource.id}/request`); }}>Continue</Button></div>
      </section>
      <aside className="detail-card customer-request-start-context customer-request-context"><CustomerRequestContext providerName={selected ? providerNames.get(selected.providerId) || 'Service provider' : 'Choose an asset to see its provider'} customerName={customerName} /></aside>
    </div>
  </section>;
}

function CustomerRequestsAcrossProviders({ providers, onSelectProvider, t }: { providers: Resource<ProviderAttributes>[] | null; onSelectProvider: (id: string) => void; t: T }) {
  const { records, hasMore, error, loadingMore, loadMore } = useProviderRecords(providers, (providerId, page) => customerData.requests(providerId, page));
  if (error && !records) return <DataState message={error} t={t} />;
  if (!records) return <DataState message={t('loading')} t={t} />;
  const providerNames = new Map((providers || []).map((provider) => [provider.id, provider.attributes.display_name || 'Service provider']));
  const rows = [...records].sort((left, right) => right.resource.attributes.created_at.localeCompare(left.resource.attributes.created_at));
  return <section className="content"><div className="section-heading"><div><Status>Customer activity</Status><div className="trise-info-heading-row"><h2>{t('serviceRequests')}</h2><InfoNotice>Requests from all service relationships linked to your customer account.</InfoNotice></div></div><span>{rows.length} requests{hasMore ? '+' : ''}</span></div>{error && <p className="error" role="alert">{error}</p>}{rows.length === 0 ? <DataState message={t('empty')} t={t} /> : <div className="record-grid">{rows.map(({ resource: request, providerId }) => <button className="record-card customer-aggregate-asset" type="button" key={`${providerId}:${request.id}`} onClick={() => { onSelectProvider(providerId); go(`/request/${request.id}`); }}><Status>{request.attributes.status}</Status><strong>{request.attributes.summary}</strong><span>{request.attributes.description || t('noDescription')}</span><small>{providerNames.get(providerId)} · {formatIndiaDateTime(request.attributes.created_at)}</small></button>)}</div>}{hasMore && <MoreRecords loading={loadingMore} onClick={() => void loadMore()} />}</section>;
}

function CustomerDocumentsAcrossProviders({ providers, sourceId, onSelectProvider, t }: { providers: Resource<ProviderAttributes>[] | null; sourceId?: string; onSelectProvider: (id: string) => void; t: T }) {
  const { records, hasMore, error, loadingMore, loadMore } = useProviderRecords(providers, (providerId, page) => customerData.documents(providerId, page, sourceId));
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadProviderId, setUploadProviderId] = useState('');
  const [uploadCustomerId, setUploadCustomerId] = useState('');
  const [relatedRecord, setRelatedRecord] = useState('');
  const [relatedRecords, setRelatedRecords] = useState<{ key: string; label: string; source: CustomerDocumentSource }[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadAttemptKey, setUploadAttemptKey] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadNotice, setUploadNotice] = useState('');
  const [uploadedRecords, setUploadedRecords] = useState<ProviderRecord<DocumentAttributes>[]>([]);
  const uploadDialog = useRef<HTMLDialogElement>(null);
  const uploadProviderOptions = providers || [];
  useEffect(() => {
    if (uploadOpen && !uploadDialog.current?.open) uploadDialog.current?.showModal();
    if (!uploadOpen && uploadDialog.current?.open) uploadDialog.current.close();
  }, [uploadOpen]);
  useEffect(() => {
    let active = true;
    if (!uploadOpen || !uploadProviderId) return () => { active = false; };
    setRelatedLoading(true); setRelatedError(''); setRelatedRecords([]); setRelatedRecord(''); setUploadCustomerId('');
    Promise.all([customerData.customers(uploadProviderId), customerData.assets(uploadProviderId, { limit: 100 }), customerData.requests(uploadProviderId, { limit: 100 })])
      .then(([customers, assets, requests]) => {
        if (!active) return;
        const customer = customers.data[0];
        setUploadCustomerId(customer?.id || '');
        const choices: { key: string; label: string; source: CustomerDocumentSource }[] = [];
        if (customer) choices.push({ key: `CUSTOMER:${customer.id}`, label: `My customer account · ${customer.attributes.display_name}`, source: { type: 'CUSTOMER', id: customer.id } });
        assets.data.forEach((asset) => {
          const assetCode = asset.attributes.identifiers?.find((item) => item.value)?.value;
          const locationName = asset.attributes.service_location_name ? customerReadableName(asset.attributes.service_location_name) : '';
          choices.push({ key: `ASSET:${asset.id}`, label: customerDocumentAssetChoiceLabel({ name: customerReadableName(asset.attributes.name), id: asset.id, assetCode, siteName: locationName, siteCode: asset.attributes.service_location_code }), source: { type: 'ASSET', id: asset.id } });
        });
        requests.data.forEach((request) => choices.push({ key: `SERVICE_REQUEST:${request.id}`, label: customerDocumentRequestChoiceLabel(request.attributes.summary, request.attributes.reference_code), source: { type: 'SERVICE_REQUEST', id: request.id } }));
        setRelatedRecords(choices);
        setRelatedRecord(choices[0]?.key || '');
      })
      .catch((cause) => { if (active) setRelatedError(errorText(cause)); })
      .finally(() => { if (active) setRelatedLoading(false); });
    return () => { active = false; };
  }, [uploadOpen, uploadProviderId]);
  if (error && !records) return <DataState message={error} t={t} />;
  if (!records) return <DataState message={t('loading')} t={t} />;
  const providerNames = new Map((providers || []).map((provider) => [provider.id, provider.attributes.display_name || 'Service provider']));
  const allRecords = [...uploadedRecords, ...records.filter(({ providerId, resource }) => !uploadedRecords.some((uploaded) => uploaded.providerId === providerId && uploaded.resource.id === resource.id))];
  const visible = filterCustomerDocuments(allRecords, search);
  const searchingWithoutMatches = search.trim().length > 0 && visible.length === 0;
  const selectedSource = relatedRecords.find(({ key }) => key === relatedRecord)?.source;
  const canSubmitUpload = customerDocumentUploadReady({ providerId: uploadProviderId, customerId: uploadCustomerId, source: selectedSource, title: uploadTitle, file: uploadFile, relatedLoading });
  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(''); setUploadNotice('');
    const validation = customerUploadValidation(uploadFile);
    if (validation) { setUploadError(validation); return; }
    if (!uploadProviderId || !uploadCustomerId || !selectedSource) { setUploadError('Choose a service provider and related record.'); return; }
    setUploadBusy(true);
    try {
      const resource = await uploadCustomerDocument({ api: customerData, providerId: uploadProviderId, customerId: uploadCustomerId, source: selectedSource, title: uploadTitle, file: uploadFile!, attemptKey: uploadAttemptKey });
      setUploadedRecords((current) => [{ resource: resource as Resource<DocumentAttributes>, providerId: uploadProviderId }, ...current]);
      onSelectProvider(uploadProviderId);
      setUploadNotice('Document uploaded to your customer account. Current platform policy marks it as not scanned.');
      setUploadOpen(false); setUploadFile(null); setUploadTitle(''); setUploadAttemptKey('');
    } catch (cause) { setUploadError(errorText(cause)); }
    finally { setUploadBusy(false); }
  }
  const duplicateProviderNames = new Set(uploadProviderOptions.filter((provider, index) => uploadProviderOptions.some((other, otherIndex) => otherIndex !== index && other.attributes.display_name === provider.attributes.display_name)).map((provider) => provider.id));
  return <section className="content customer-documents"><div className="section-heading customer-documents-heading"><div><h2>{sourceId ? 'Documents shared for this service report.' : 'All the details, kept together.'}</h2><p className="muted">Your permitted reports, agreements and service evidence.</p></div>{!sourceId && <Button variant="secondary" onClick={() => { setUploadError(''); setUploadNotice(''); setUploadFile(null); setUploadTitle(''); setUploadAttemptKey(newCustomerDocumentUploadKey()); setUploadProviderId(uploadProviderId || uploadProviderOptions[0]?.id || ''); setUploadOpen(true); }}>Upload document</Button>}</div>
    {uploadNotice && <p className="notice" role="status">{uploadNotice}</p>}
    <div className="customer-document-filters"><input aria-label="Search documents" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search documents" /></div>
    {error && <p className="error" role="alert">Some linked service documents could not be loaded. {error}</p>}
    {visible.length === 0 ? <div className="detail-card customer-documents-empty"><h3>{searchingWithoutMatches ? 'No documents match your search.' : sourceId ? 'No files have been shared for this report.' : 'Your shared documents will appear here.'}</h3><p>{searchingWithoutMatches ? 'Try another document name or type.' : sourceId ? 'The report is linked in your service history, but there are no customer-visible files attached to it.' : 'Reports and agreements shared with your customer account will be listed here.'}</p>{sourceId && <Button onClick={() => go('/timeline')}>Back to service history</Button>}{search && <Button onClick={() => setSearch('')}>Clear search</Button>}</div> : <div className="customer-document-list">{visible.map(({ resource: item, providerId }) => <button className="customer-document-row" type="button" key={`${providerId}:${item.id}`} onClick={() => { onSelectProvider(providerId); go(`/documents/${item.id}`); }}><span className="customer-document-icon" aria-hidden="true">▤</span><span className="customer-document-copy"><strong>{customerDocumentDisplayName(item.attributes.filename)}</strong><small>{customerDocumentClassificationLabel(item.attributes.classification)} · {providerNames.get(providerId)}{item.attributes.created_at ? ` · ${formatIndiaDate(item.attributes.created_at)}` : ''}</small></span><span className="customer-document-open">→&nbsp; Preview</span></button>)}</div>}
    {hasMore && <MoreRecords loading={loadingMore} onClick={() => void loadMore()} />}
    <dialog ref={uploadDialog} className="customer-confirm-dialog customer-document-upload-dialog" aria-labelledby="customer-document-upload-title" onCancel={(event) => { event.preventDefault(); if (!uploadBusy) setUploadOpen(false); }} onClose={() => setUploadOpen(false)}>
      <div className="customer-document-upload-heading"><Status>Private customer upload</Status><h2 id="customer-document-upload-title">Add a document</h2><p>Choose an account record so your provider can review the file in context.</p></div>
      <form onSubmit={(event) => void submitUpload(event)}>
        <label className="field"><span>Service provider *</span><select value={uploadProviderId} onChange={(event) => { setUploadAttemptKey(newCustomerDocumentUploadKey()); setUploadProviderId(event.target.value); }} required disabled={uploadBusy || !uploadProviderOptions.length}><option value="">Select provider</option>{uploadProviderOptions.map((provider) => <option key={provider.id} value={provider.id}>{provider.attributes.display_name || 'Service provider'}{duplicateProviderNames.has(provider.id) ? ` · account ${provider.id.slice(-6)}` : ''}</option>)}</select></label>
        <label className="field"><span>Document title *</span><input value={uploadTitle} onChange={(event) => { setUploadAttemptKey(newCustomerDocumentUploadKey()); setUploadTitle(event.target.value); }} maxLength={200} placeholder="For example, inspection report" required disabled={uploadBusy} /></label>
        <label className="field"><span>Related record *</span><select value={relatedRecord} onChange={(event) => { setUploadAttemptKey(newCustomerDocumentUploadKey()); setRelatedRecord(event.target.value); }} required disabled={uploadBusy || relatedLoading || relatedRecords.length === 0}><option value="">Select account, asset or service request</option>{relatedRecords.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}</select></label>
        {relatedLoading && <p className="muted" role="status">Loading your authorized records…</p>}
        {relatedError && <p className="error" role="alert">{relatedError}</p>}
        {!relatedLoading && !relatedError && uploadProviderId && relatedRecords.length === 0 && <p className="notice">No active customer account records are available for upload.</p>}
        <label className="field"><span>File *</span><input key={uploadOpen ? 'upload-open' : 'upload-closed'} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain" required disabled={uploadBusy} onChange={(event) => { const file = event.target.files?.[0] || null; setUploadAttemptKey(newCustomerDocumentUploadKey()); setUploadFile(file); setUploadTitle((current) => current || file?.name || ''); setUploadError(customerUploadValidation(file)); }} /></label>
        <p className="customer-document-upload-note">PDF or TXT up to 2 MB; PNG or JPG up to 25 MB. Files use private storage. Current platform policy records uploads as not scanned; share files only when you are comfortable sending them to this service provider.</p>
        {uploadError && <p className="error" role="alert">{uploadError}</p>}
        <div className="inline-actions"><Button disabled={uploadBusy} onClick={() => { setUploadOpen(false); setUploadFile(null); setUploadTitle(''); setUploadAttemptKey(''); }}>Cancel</Button><Button type="submit" disabled={uploadBusy || !canSubmitUpload}>{uploadBusy ? 'Uploading…' : 'Upload document'}</Button></div>
      </form>
    </dialog>
  </section>;
}

function CustomerCoverageAcrossProviders({ providers, onSelectProvider, t }: { providers: Resource<ProviderAttributes>[] | null; onSelectProvider: (id: string) => void; t: T }) {
  const warranties = useProviderRecords(providers, (providerId, page) => customerData.warranties(providerId, page));
  const contracts = useProviderRecords(providers, (providerId, page) => customerData.contracts(providerId, page));
  const [warrantyAssetNames, setWarrantyAssetNames] = useState<Record<string, string>>({});
  const warrantyAssetLookups = useRef(new Set<string>());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [visibleCount, setVisibleCount] = useState(15);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    if (!warranties.records) return;
    let active = true;
    const pending = warranties.records.flatMap(({ providerId, resource }) => {
      const assetId = relatedResourceId(resource.relationships, 'asset');
      const key = assetId ? `${providerId}:${assetId}` : '';
      if (!assetId || !key || warrantyAssetLookups.current.has(key)) return [];
      warrantyAssetLookups.current.add(key);
      return [{ providerId, assetId, key }];
    });
    if (!pending.length) return () => { active = false; };
    Promise.allSettled(pending.map(async ({ providerId, assetId, key }) => ({
      key, asset: await customerData.asset(providerId, assetId),
    }))).then((results) => {
      if (!active) return;
      setWarrantyAssetNames((current) => {
        const next = { ...current };
        results.forEach((result) => {
          if (result.status === 'fulfilled') next[result.value.key] = customerReadableName(result.value.asset.attributes.name);
        });
        return next;
      });
    });
    return () => { active = false; };
  }, [warranties.records]);
  if ((warranties.error && !warranties.records) || (contracts.error && !contracts.records)) return <DataState message={warranties.error || contracts.error} t={t} />;
  if (!warranties.records || !contracts.records) return <DataState message={t('loading')} t={t} />;
  const providerNames = new Map((providers || []).map((provider) => [provider.id, provider.attributes.display_name || 'Service provider']));
  const records = coverageListRecords(
    warranties.records.map(({ providerId, resource }) => ({ providerId, providerName: providerNames.get(providerId) || 'Service provider', resource })),
    contracts.records.map(({ providerId, resource }) => ({ providerId, providerName: providerNames.get(providerId) || 'Service provider', resource })),
  );
  const filtered = filterCoverageRecords(records, search, status, warrantyAssetNames);
  const visible = visibleCoverageRecords(filtered, visibleCount);
  const hasMore = filtered.length > visibleCount || warranties.hasMore || contracts.hasMore;
  async function loadMoreCoverage() {
    if (loadingMore) return;
    if (filtered.length > visibleCount) { setVisibleCount((count) => count + 15); return; }
    setLoadingMore(true);
    try {
      await Promise.all([
        warranties.hasMore ? warranties.loadMore() : Promise.resolve(),
        contracts.hasMore ? contracts.loadMore() : Promise.resolve(),
      ]);
      setVisibleCount((count) => count + 15);
    } finally { setLoadingMore(false); }
  }
  const coverageCards = visible.map(({ providerId, providerName, resource: item, kind }) => {
    const contract = kind === 'contract' ? item as Resource<ContractAttributes> : undefined;
    const summary = contract?.attributes.customer_safe_summary;
    const label = contract ? customerPlanDisplayName(summary?.plan_name, contract.attributes.name) : warrantyDisplayName(item.attributes.name);
    const reference = coverageReferenceCode(kind, item.attributes.name, summary?.plan_code);
    const coveredAssets = summary?.covered_assets?.map((asset) => customerReadableName(asset.display_name)).filter(Boolean) || [];
    const warrantyAssetId = contract ? null : relatedResourceId(item.relationships, 'asset');
    const coveredAsset = contract ? coveredAssets.join(', ') : warrantyAssetId ? warrantyAssetNames[`${providerId}:${warrantyAssetId}`] || '' : '';
    const coveredAssetCount = contract ? summary?.covered_elevator_count ?? coveredAssets.length : Number(Boolean(coveredAsset));
    const coveredAssetHeading = coveredAssetCount > 1 ? `${coveredAssetCount} covered lifts` : coveredAsset;
    const coveredAssetFallback = contract ? coverageLiftDetailsFallback(summary?.covered_elevator_count, Boolean(summary)) : 'Details not shared';
    const displayedCoveredAssets = contract ? coveredAssets : coveredAsset ? [coveredAsset] : [];
    const starts = item.attributes.effective_from ? formatIndiaDate(item.attributes.effective_from) : 'Start date not supplied';
    const ends = item.attributes.effective_to ? formatIndiaDate(item.attributes.effective_to) : 'End date not supplied';
    return <button type="button" className="coverage-card" key={`${kind}:${providerId}:${item.id}`} onClick={() => { onSelectProvider(providerId); go(`/coverage/${kind}/${item.id}`); }}><span className="coverage-card-top"><span className="coverage-card-title">{label}</span><Status>{customerCoverageStatus(item.attributes.status, item.attributes.effective_from, item.attributes.effective_to).replace(/\b\w/g, (letter) => letter.toUpperCase())}</Status></span><span className="coverage-icon-tile" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 19 6v5c0 4.5-2.8 8-7 10-4.2-2-7-5.5-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg></span>{coveredAssetHeading && <strong className="coverage-asset-name">{coveredAssetHeading}</strong>}<span className="coverage-reference">{reference ? `${reference} · ` : ''}{starts} – {ends}</span><dl><div><dt>Coverage source</dt><dd>{label}</dd></div><div><dt>Service provider</dt><dd>{providerName}</dd></div><div className={displayedCoveredAssets.length > 1 ? 'coverage-card-assets-row' : ''}><dt>{contract ? 'Covered lifts' : 'Covered asset'}</dt><dd>{displayedCoveredAssets.length > 1 ? <span className="coverage-card-asset-list">{displayedCoveredAssets.map((assetName) => <span className="coverage-card-asset-chip" key={assetName}>{assetName}</span>)}</span> : displayedCoveredAssets[0] || coveredAssetFallback}</dd></div></dl><span className="customer-record-action">View coverage <span aria-hidden="true">→</span></span></button>;
  });
  return <section className="content coverage-page"><div className="section-heading"><div><h1>Care that goes further.</h1><p>Your AMC agreements and warranties, in one place.</p></div><span className="coverage-count" aria-live="polite">{coverageCountLabel(visible.length, filtered.length, hasMore)}</span></div><details className="coverage-search"><summary>Search or filter coverage</summary><div className="customer-coverage-filters"><label><span>Search coverage</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(15); }} placeholder="Plan, provider or agreement" aria-label="Search coverage" /></label><label><span>Status</span><select aria-label="Filter coverage status" value={status} onChange={(event) => { setStatus(event.target.value); setVisibleCount(15); }}><option value="">All statuses</option>{coverageStatuses(records).map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}</option>)}</select></label></div></details>{warranties.error && <p className="error" role="alert">{warranties.error}</p>}{contracts.error && <p className="error" role="alert">{contracts.error}</p>}{!filtered.length ? <DataState message={coverageEmptyMessage(search, status, hasMore)} t={t} /> : <div className="coverage-grid">{coverageCards}</div>}{hasMore && <MoreRecords loading={loadingMore || warranties.loadingMore || contracts.loadingMore} label={!filtered.length && (search || status) ? 'Load older coverage' : 'Load more'} onClick={() => void loadMoreCoverage()} />}</section>;
}

function CustomerNotificationsAcrossProviders({ providers, t }: { providers: Resource<ProviderAttributes>[] | null; t: T }) {
  const { records, hasMore, error, loadingMore, loadMore, retry, updateRecord } = useProviderRecords(providers, (providerId, page) => customerData.notifications(providerId, false, page), 15, true);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  if (error && !records) return <DataState message={error} retry={classifyCustomerState(error) === 'denied' ? undefined : retry} t={t} />;
  if (!records) return <DataState message={t('loading')} t={t} />;
  const providerNames = new Map((providers || []).map((provider) => [provider.id, provider.attributes.display_name || 'Service provider']));
  const sorted = [...records].sort((a, b) => (b.resource.attributes.created_at || '').localeCompare(a.resource.attributes.created_at || ''));
  const unreadCount = sorted.filter((record) => !record.resource.attributes.read_at).length;
  const bulkAction = notificationBulkActionState(unreadCount, hasMore, markingAll || loadingMore);
  const countLabel = error ? `${sorted.length} update${sorted.length === 1 ? '' : 's'} loaded` : notificationCountLabel(sorted.length, hasMore);
  async function markRead(record: ProviderRecord<NotificationAttributes>) {
    setActionError(''); setActionMessage('');
    try {
      await customerData.markNotificationRead(record.providerId, record.resource.id, crypto.randomUUID());
      updateRecord(record.providerId, record.resource.id, (current) => ({ ...current, attributes: { ...current.attributes, read_at: new Date().toISOString() } }));
      window.dispatchEvent(new Event('trise:customer-notifications-read'));
    } catch (cause) { setActionError(errorText(cause)); }
  }
  async function markAllRead() {
    if (!providers?.length || markingAll) return;
    setMarkingAll(true); setActionError(''); setActionMessage('');
    try {
      const result = await markAllUnreadNotifications(
        providers,
        (providerId, page) => customerData.notifications(providerId, true, page, true),
        (providerId, notificationId) => customerData.markNotificationRead(providerId, notificationId, crypto.randomUUID()),
      );
      result.succeeded.forEach(({ providerId, resource }) => updateRecord(providerId, resource.id, (current) => ({ ...current, attributes: { ...current.attributes, read_at: current.attributes.read_at || new Date().toISOString() } })));
      if (result.succeeded.length) window.dispatchEvent(new Event('trise:customer-notifications-read'));
      if (result.failed.length) setActionError(notificationReadResultMessage(result.succeeded.length, result.failed.length));
      else setActionMessage(notificationReadResultMessage(result.succeeded.length, 0));
    } catch (cause) { setActionError(errorText(cause)); }
    finally { setMarkingAll(false); }
  }
  return <section className="content"><div className="section-heading"><div><Status>{t('alerts')}</Status><h2>Updates across your account</h2></div><div className="customer-feature-toolbar"><span>{countLabel}</span>{providers && providers.length > 0 && !error ? <Button disabled={bulkAction.disabled} onClick={() => void markAllRead()}>{bulkAction.label}</Button> : null}<Button onClick={() => go('/notification-preferences')}>Notification preferences</Button></div></div>{error && <div className="customer-feature-error customer-alert-feed-error" role="alert"><span>{error}</span><Button disabled={loadingMore} onClick={retry}>Retry alerts</Button></div>}{actionError && <p className="error" role="alert">{actionError}</p>}{actionMessage && <p role="status">{actionMessage}</p>}{sorted.length === 0 ? error ? null : <DataState message={t('noAlerts')} t={t} /> : <div className="record-grid">{sorted.map((record) => { const item = record.resource; return <article className={`record-card ${item.attributes.read_at ? '' : 'unread'}`} key={`${record.providerId}:${item.id}`}><Status>{item.attributes.read_at ? 'Read' : 'New'}</Status><strong>{item.attributes.title}</strong><span>{item.attributes.body}</span><small>{providerNames.get(record.providerId)} · {item.attributes.category}{item.attributes.created_at ? ` · ${formatIndiaDateTime(item.attributes.created_at)}` : ''}</small>{!item.attributes.read_at && <Button disabled={markingAll} onClick={() => void markRead(record)}>Mark read</Button>}</article>; })}</div>}{hasMore && !error && <MoreRecords loading={loadingMore} onClick={() => void loadMore()} />}</section>;
}

function CustomerProjectsAcrossProviders({ providers, onSelectProvider, t }: { providers: Resource<ProviderAttributes>[] | null; onSelectProvider: (id: string) => void; t: T }) {
  const { records, hasMore, error, loadingMore, loadMore } = useProviderRecords(providers, (providerId, page) => customerData.installationProjects(providerId, page));
  if (error && !records) return <DataState message={error} t={t} />;
  if (!records) return <DataState message={t('loading')} t={t} />;
  const projects = visibleInstallationProjects(records);
  const providerNames = new Map((providers || []).map((provider) => [provider.id, provider.attributes.display_name || 'Service provider']));
  return <section className="content"><header className="customer-feature-heading"><div><h1>Installation projects</h1><p>From an accepted plan to a confident handover.</p></div></header>{error && <p className="error" role="alert">{error}</p>}{projects.length === 0 ? <DataState message={customerProjectsEmptyMessage(hasMore)} t={t} /> : <div className="customer-installation-project-list">{projects.map(({ resource: project, providerId }) => { const assets = project.attributes.project_assets || []; const site = project.attributes.service_location_name ? `${customerReadableName(project.attributes.service_location_name)} · ` : ''; const progress = Math.max(0, Math.min(100, project.attributes.progress_percent)); return <article className="customer-installation-project-card" key={`${providerId}:${project.id}`}><span className="customer-installation-project-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16M6 20V4h12v16M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2" /></svg></span><div className="customer-installation-project-summary"><Status>{customerProjectListStatusLabel(project.attributes)}</Status><h2>{site}{customerProjectDisplayName(project.attributes.title, project.attributes.service_location_name)}</h2><p>{assets.length} {assets.length === 1 ? 'lift' : 'lifts'} · {providerNames.get(providerId)}</p><div className="customer-installation-project-progress" role="progressbar" aria-label="Installation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div><small>{progress}% complete</small></div><Button onClick={() => { onSelectProvider(providerId); go(`/projects/${project.id}`); }}>View project</Button></article>; })}</div>}{hasMore && <MoreRecords loading={loadingMore} onClick={() => void loadMore()} />}</section>;
}

function ScanAsset({ providers, onSelectProvider, t, buttonLabel, onAssetFound }: { providers: Resource<ProviderAttributes>[]; onSelectProvider: (id: string) => void; t: T; buttonLabel?: string; onAssetFound?: (providerId: string, asset: Resource<AssetAttributes>) => void }) {
  const [open, setOpen] = useState(false); const [code, setCode] = useState(''); const [message, setMessage] = useState(''); const [matches, setMatches] = useState<Array<{ providerId: string; asset: Resource<AssetAttributes> }>>([]); const [busy, setBusy] = useState(false);
  async function resolve() {
    setBusy(true); setMessage(''); setMatches([]);
    const found: Array<{ providerId: string; asset: Resource<AssetAttributes> }> = [];
    let failures = 0;
    for (const provider of providers) {
      try { const result = await customerData.resolveIdentifier(provider.id, code.trim(), crypto.randomUUID()); if (result.resource) found.push({ providerId: provider.id, asset: result.resource }); }
      catch (cause) { const failure = cause as { status?: number; code?: string }; if (failure.status !== 404 && failure.code !== 'not_found') failures += 1; }
    }
    if (found.length === 1 && failures === 0) {
      if (onAssetFound) { onAssetFound(found[0].providerId, found[0].asset); setOpen(false); }
      else { onSelectProvider(found[0].providerId); go(`/asset/${found[0].asset.id}`); }
    }
    else if (found.length > 0) { setMatches(found); if (failures) setMessage('Some linked service accounts could not be searched. Confirm the provider before opening this asset.'); }
    else setMessage(failures === providers.length ? 'We could not search your linked service accounts. Please try again.' : 'No matching asset was found in your linked service accounts. Check the code and try again.');
    setBusy(false);
  }
  const providerNames = new Map(providers.map((provider) => [provider.id, provider.attributes.display_name || 'Service provider']));
  return <div className="scan-action"><Button type="button" onClick={() => setOpen((value) => !value)}>{buttonLabel || t('scanAsset')}</Button>{open && <form className="scan-panel" onSubmit={(event) => { event.preventDefault(); void resolve(); }}><label><span>E-Code or scanned QR text *</span><input value={code} onChange={(event) => setCode(event.target.value)} maxLength={200} required autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="0703-7Q9M2X" /></label><small>Enter the printed E-Code or paste text read by a QR scanner. TRISE finds only assets your customer account can access; the asset record supplies its place and provider.</small><Button disabled={busy || providers.length === 0}>{busy ? t('loading') : 'Find asset'}</Button>{message && <p className="error" role="alert">{message}</p>}{matches.length > 0 && <div className="scan-matches" role="group" aria-label="Matching authorized assets">{matches.map(({ providerId, asset }) => {
    const ecode = asset.attributes.identifiers?.find((item) => item.kind?.toUpperCase() === 'EQUIPMENT_CODE')?.value || asset.attributes.identifiers?.[0]?.value;
    const place = [asset.attributes.service_location_name ? customerReadableName(asset.attributes.service_location_name) : '', asset.attributes.service_location_address ? customerVisibleAddressText(asset.attributes.service_location_address) : ''].filter(Boolean).join(' · ');
    return <button type="button" key={`${providerId}:${asset.id}`} onClick={() => { if (onAssetFound) { onAssetFound(providerId, asset); setOpen(false); } else { onSelectProvider(providerId); go(`/asset/${asset.id}`); } }}><strong>{customerReadableName(asset.attributes.name)}</strong><small>{ecode ? `E-Code ${ecode} · ` : ''}{place || providerNames.get(providerId)}</small></button>;
  })}</div>}</form>}</div>;
}

function DocumentDetail({ providerId, id, t }: { providerId: string; id: string; t: T }) {
  const [document, setDocument] = useState<Resource<DocumentAttributes> | null>(null);
  const [versions, setVersions] = useState<Collection<DocumentVersionAttributes> | null>(null);
  const [reportPreview, setReportPreview] = useState<Resource<CustomerServiceReportPreviewAttributes> | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [downloadedVersion, setDownloadedVersion] = useState('');
  useEffect(() => {
    let active = true;
    setDocument(null); setVersions(null); setReportPreview(null); setPreviewLoading(false); setPreviewError(''); setError(''); setActionError(''); setDownloadedVersion('');
    Promise.all([customerData.document(providerId, id), customerData.documentVersions(providerId, id)]).then(([doc, versionResult]) => {
      if (!active) return;
      setDocument(doc); setVersions(versionResult);
      const source = doc.relationships.source as Link | null | undefined;
      if (source?.type === 'service-reports') {
        setPreviewLoading(true);
        customerData.customerDocumentPreview(providerId, id)
          .then(({ data }) => { if (active) setReportPreview(data); })
          .catch((cause) => { if (active) setPreviewError(errorText(cause)); })
          .finally(() => { if (active) setPreviewLoading(false); });
      }
    }).catch((cause) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [providerId, id, previewAttempt]);
  async function authorize(versionId: string) {
    setActionError('');
    try {
      const transfer = await customerData.authorizeDownload(providerId, id, { version_id: versionId, disposition: 'attachment' });
      const link = window.document.createElement('a');
      link.href = transfer.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = '';
      link.click();
      setDownloadedVersion(versionId);
    } catch (cause) { setActionError(errorText(cause)); }
  }
  if (error) return <DataState message={error} t={t} />;
  if (!document || !versions) return <DataState message={t('loading')} t={t} />;
  const current = document.relationships.current_version as Link | null | undefined;
  const documentSource = document.relationships.source as Link | null | undefined;
  const isServiceReport = documentSource?.type === 'service-reports';
  const attributes = document.attributes;
  const currentVersion = versions.data.find((version) => version.id === current?.id) || versions.data[0];
  const previousVersions = customerDocumentPreviousVersions(versions.data, currentVersion?.id);
  const currentDownloadable = customerCanDownloadDocument(attributes) && currentVersion && ['clean', 'exempt', 'not_scanned'].includes(currentVersion.attributes.scan_state);
  const report = reportPreview?.attributes;
  return <section className="content customer-document-detail">
    <button className="text-button" onClick={() => go('/documents')}>← {t('back')}</button>
    <div className="section-heading"><div>{isServiceReport ? <h2>Service report</h2> : <><Status>Document preview</Status><h2>{customerDocumentDisplayName(attributes.filename)}</h2></>}<p className="muted">{report ? [report.asset_name ? customerReadableName(report.asset_name) : '', report.service_date ? formatIndiaDate(report.service_date) : null].filter(Boolean).join(' · ') : `${customerDocumentClassificationLabel(attributes.classification)} · ${attributes.status.replaceAll('_', ' ')}`}</p></div>{currentDownloadable && <Button onClick={() => void authorize(currentVersion.id)}>{isServiceReport ? 'Download report' : 'Download document'}</Button>}</div>
    {actionError && <p className="error" role="alert">The download was not authorized. {actionError}</p>}
    {downloadedVersion && <p className="notice" role="status">Download authorized for version {versions.data.find((item) => item.id === downloadedVersion)?.attributes.version}. The secure transfer expires shortly.</p>}
    {attributes.scan_state === 'not_scanned' && <p className="notice">This private file was accepted without malware scanning under platform policy and is delivered only as an attachment.</p>}
    {previewError && <div className="error customer-document-preview-error" role="alert"><span>Submitted service report details could not be loaded. {previewError}</span><Button variant="secondary" onClick={() => setPreviewAttempt((attempt) => attempt + 1)}>Retry report details</Button></div>}
    <div className="customer-document-preview-grid"><article className="detail-card">{previewLoading ? <div className="customer-document-preview-placeholder"><strong>Loading service report…</strong></div> : report ? <CustomerServiceReportPreview report={report} formatDate={formatIndiaDate} /> : <div className="customer-document-preview-placeholder"><span aria-hidden="true">▤</span><strong>Secure document</strong><p>{previewError ? 'The report text is unavailable. You can still request the authorized private document transfer.' : 'For privacy and file safety, document contents are provided through an authorized private download.'}</p></div>}</article>
      <aside className="detail-card"><h3>Document details</h3>{report ? <dl className="customer-document-metadata"><dt>Version</dt><dd>{report.version} · Submitted report</dd><dt>Visibility</dt><dd>Customer &amp; service provider</dd><dt>Classification</dt><dd>{customerDocumentClassificationLabel(attributes.classification)}</dd><dt>Storage access</dt><dd>Authorised document transfer</dd></dl> : <dl className="customer-document-metadata"><dt>Type</dt><dd>{customerDocumentClassificationLabel(attributes.classification)}</dd><dt>File name</dt><dd>{attributes.filename}</dd><dt>Format &amp; size</dt><dd>{attributes.media_type} · {formatBytes(attributes.size_bytes)}</dd><dt>Version</dt><dd>{currentVersion ? `Version ${currentVersion.attributes.version}` : 'Not supplied'}</dd><dt>Visibility</dt><dd>{attributes.visibility === 'customer' ? 'Shared with your account' : 'Not shared with customer'}</dd><dt>Security status</dt><dd>{attributes.scan_state.replaceAll('_', ' ')}</dd><dt>Added</dt><dd>{attributes.created_at ? formatIndiaDate(attributes.created_at) : 'Date not provided'}</dd><dt>File checksum</dt><dd className="customer-document-checksum">{attributes.checksum}</dd></dl>}
        {previousVersions.length > 0 && <><h4>Previous versions</h4><div className="customer-document-versions">{previousVersions.map((version) => { const allowed = customerCanDownloadDocument(attributes) && ['clean', 'exempt', 'not_scanned'].includes(version.attributes.scan_state); return <div className="customer-document-version" key={version.id}><span><strong>Version {version.attributes.version}</strong><small>{version.attributes.scan_state.replaceAll('_', ' ')} · {formatBytes(version.attributes.size_bytes)}</small></span>{allowed && <button type="button" onClick={() => void authorize(version.id)}>Download</button>}</div>; })}</div></>}
      </aside></div>
  </section>;
}

function formatBytes(bytes: number) { if (!Number.isFinite(bytes) || bytes < 0) return 'Size unavailable'; if (bytes < 1024) return `${bytes} bytes`; const units = ['KB', 'MB', 'GB']; let value = bytes / 1024; let unit = 0; while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; } return `${value.toLocaleString('en-IN', { maximumFractionDigits: 1 })} ${units[unit]}`; }

function ProfilePage({ session, refreshCurrentUser, signOut, locale, setLocale, t }: { session: { userId: string; displayName: string; locale: string | null; revision: number }; refreshCurrentUser: () => Promise<void>; signOut: () => Promise<void>; locale: Locale; setLocale: (value: Locale) => void; t: T }) {
  const [name, setName] = useState(session.displayName);
  const [draftLocale, setDraftLocale] = useState<Locale>(locale);
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState<Resource<UserAttributes> | null>(null);
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileLoadAttempt, setProfileLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const profileDenied = profileError.length > 0 && classifyCustomerState(profileError) === 'denied';
  const successMessage = message === 'Profile saved.' || message === 'Other sign-in sessions were revoked. This device remains signed in.';
  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [message, successMessage]);
  useEffect(() => {
    let active = true;
    setProfileLoading(true);
    setProfileError('');
    customerData.me().then((result) => { if (active) { setProfile(result); setProfileError(''); setName(result.attributes.display_name || session.displayName); } })
      .catch((cause) => { if (active) setProfileError(errorText(cause)); })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [session.userId, session.displayName, profileLoadAttempt]);
  useEffect(() => { setDraftLocale(locale); }, [locale]);
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('');
    if (!profile) { setMessage('Profile details are still loading. Try again in a moment.'); setSaving(false); return; }
    try { const updated = await customerData.updateMe({ display_name: name, locale: draftLocale, expected_revision: profile.attributes.revision }); setProfile(updated); setLocale(draftLocale); await refreshCurrentUser(); setMessage('Profile saved.'); }
    catch (cause) { setMessage(errorText(cause)); }
    finally { setSaving(false); }
  }
  async function revokeOtherDevices() {
    setRevoking(true); setMessage('');
    try { await customerData.revokeOtherSessions(); setMessage('Other sign-in sessions were revoked. This device remains signed in.'); setConfirmRevoke(false); }
    catch (cause) { setMessage(`Other sessions were not revoked. ${errorText(cause)}`); }
    finally { setRevoking(false); }
  }
  return <section className="content customer-profile"><div className="section-heading"><div><h2>Your profile</h2><p className="muted">The details that keep your service connected.</p></div></div>
    {message && <p className={`notice${successMessage ? ' customer-profile-toast' : ''}`} role="status">{message}</p>}{profileLoading && <p className="customer-profile-loading" role="status">Loading profile details…</p>}{profileError && !profileDenied && <div className="customer-profile-load-error"><p className="error" role="alert">Profile details could not be loaded. {profileError}</p><Button disabled={profileLoading} onClick={() => setProfileLoadAttempt((attempt) => attempt + 1)}>Retry profile details</Button></div>}
    <div className="customer-profile-columns"><div className="customer-profile-main">
      {profileDenied ? <CustomerStatePanel kind="denied" message="Your profile details aren’t available in this session." onAction={() => go('/')} /> : <form className="detail-card customer-profile-form" onSubmit={save}><div className="customer-profile-identity"><span className="customer-profile-avatar" aria-hidden="true">{name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U'}</span><div><h3>{name || 'Your account'}</h3><p>Personal TRISE account · Signed in</p></div></div><div className="customer-profile-fields"><label>Display name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required autoComplete="name" /></label><label>Language<select value={draftLocale} onChange={(event) => setDraftLocale(event.target.value as Locale)}><option value="en">English</option><option value="kn">Kannada · translation review pending</option><option value="hi">Hindi · translation review pending</option></select></label></div><dl className="customer-profile-facts"><div><dt>{profile?.attributes.email_verified ? 'Verified email' : 'Email on account'}</dt><dd>{profileLoading ? 'Loading…' : !profile ? 'Unavailable' : profile.attributes.email || 'Not provided'}</dd></div><div><dt>Phone</dt><dd>{profileLoading ? 'Loading…' : !profile ? 'Unavailable' : profile.attributes.phone || 'Not provided · shared only where permitted'}</dd></div><div><dt>Time zone</dt><dd>Asia/Kolkata</dd></div></dl><div className="customer-profile-form-actions"><Button disabled={saving || profileLoading || !profile || !name.trim()}>{saving ? t('loading') : 'Save profile'}</Button></div></form>}
    </div><aside className="customer-profile-aside">
      <section className="detail-card customer-profile-security"><h3>Sign-in & security</h3><div className="customer-profile-device"><span className="customer-profile-device-icon" aria-hidden="true"><CustomerNavIcon name="profile" /></span><span><strong>Current device</strong><small>This browser · Your current session</small></span></div><Button disabled={revoking} onClick={() => setConfirmRevoke(true)}>Sign out other devices</Button><button className="customer-profile-signout" type="button" onClick={() => void signOut()}><CustomerNavIcon name="logout" />Sign out</button></section>
      <section className="detail-card customer-profile-access"><h3>Your access</h3><button type="button" onClick={() => go('/members')}><span className="customer-profile-access-icon" aria-hidden="true"><CustomerNavIcon name="members" /></span><span><strong>Family & sharing</strong><small>Place membership and direct asset access.</small></span><span aria-hidden="true">›</span></button><button type="button" onClick={() => go('/notification-preferences')}><span className="customer-profile-access-icon" aria-hidden="true"><CustomerNavIcon name="alerts" /></span><span><strong>Update preferences</strong><small>Service and account notifications.</small></span><span aria-hidden="true">›</span></button></section>
    </aside></div>
    {confirmRevoke && <div className="customer-confirm-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !revoking) setConfirmRevoke(false); }}><section className="customer-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="revoke-sessions-title"><Status>Account security</Status><h3 id="revoke-sessions-title">Sign out other devices?</h3><p>Other sign-in sessions will be revoked. This device will remain signed in.</p><div className="inline-actions"><Button disabled={revoking} onClick={() => setConfirmRevoke(false)}>Cancel</Button><Button disabled={revoking} onClick={() => void revokeOtherDevices()}>{revoking ? 'Signing out…' : 'Sign out other devices'}</Button></div></section></div>}
  </section>;
}

function CustomerAssetsAcrossProviders({ providers, initialLocationId, initialLocationName, onSelectProvider, t }: { providers: Resource<ProviderAttributes>[] | null; initialLocationId?: string; initialLocationName?: string; onSelectProvider: (id: string) => void; t: T }) {
  const [result, setResult] = useState<Collection<AssetAttributes> | null>(null);
  const warranties = useProviderRecords(providers, (providerId, page) => customerData.warranties(providerId, page), 100, true);
  const contracts = useProviderRecords(providers, (providerId, page) => customerData.contracts(providerId, page), 100, true);
  const [visitSummary, setVisitSummary] = useState<{ byAsset: Map<string, ConfirmedAssetVisit>; failedProviders: Set<string> } | null>(null);
  const [cursors, setCursors] = useState<Record<string, string | null>>({});
  const [visibleCount, setVisibleCount] = useState(15);
  const [search, setSearch] = useState(consumeGlobalSearchQuery);
  const [query, setQuery] = useState(search);
  const [locationId, setLocationId] = useState(initialLocationId || '');
  const [locations, setLocations] = useState<Array<{ id: string; name: string; label: string }>>([]);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    const applyGlobalSearch = (event: Event) => {
      const detail = (event as CustomEvent<{ kind: GlobalSearchKind; query: string }>).detail;
      if (detail?.kind !== 'asset') return;
      sessionStorage.removeItem('trise-customer-global-search-query');
      setSearch(detail.query); setQuery(detail.query); setLocationId(''); setVisibleCount(15);
    };
    window.addEventListener('trise:customer-global-search', applyGlobalSearch);
    return () => window.removeEventListener('trise:customer-global-search', applyGlobalSearch);
  }, []);
  const providerKey = providers?.map((provider) => provider.id).join('|') ?? 'loading';
  const requestKey = `${providerKey}|${query}|${locationId}`;
  const activeKey = useRef(requestKey); activeKey.current = requestKey;
  useEffect(() => { const timer = window.setTimeout(() => setQuery(search.trim()), 250); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => { setLocations([]); }, [providerKey]);
  useEffect(() => {
    let active = true;
    setVisitSummary(null);
    if (!providers) return () => { active = false; };
    const { startsAtGte, startsAtLt } = customerUpcomingBookingWindow();
    Promise.allSettled(providers.map(async (provider) => {
      const bookings: Resource<BookingAttributes>[] = [];
      const seenCursors = new Set<string>();
      let after: string | undefined;
      let hasMore = true;
      while (hasMore) {
        const page = await customerData.upcomingBookings(provider.id, { limit: 100, after }, startsAtGte, startsAtLt);
        bookings.push(...page.data);
        const next = page.page?.next;
        if (!next || seenCursors.has(next)) { hasMore = false; continue; }
        seenCursors.add(next); after = next;
      }
      return { providerId: provider.id, bookings };
    }))
      .then((results) => {
        if (!active) return;
        const candidates: ConfirmedAssetVisit[] = [];
        const failedProviders = new Set<string>();
        for (const result of results) {
          if (result.status === 'rejected') continue;
          for (const booking of result.value.bookings) {
            const relation = booking.relationships.asset;
            const asset = Array.isArray(relation) ? relation[0] : relation;
            if (!asset?.id) continue;
            candidates.push({ providerId: result.value.providerId, assetId: asset.id, summary: booking.attributes.summary, startsAt: booking.attributes.requested_window.starts_at, status: booking.attributes.status });
          }
        }
        results.forEach((result, index) => { if (result.status === 'rejected') failedProviders.add(providers[index].id); });
        setVisitSummary({ byAsset: nextConfirmedAssetVisits(candidates), failedProviders });
      });
    return () => { active = false; };
  }, [providerKey, providers]);
  useEffect(() => {
    if (!providers || !result || query || locationId) return;
    setLocations(assetLocationOptions(result.data, providers));
  }, [providerKey, providers, result, query, locationId]);
  useEffect(() => {
    let active = true;
    setResult(null); setCursors({}); setVisibleCount(15); setError(''); setLoadingMore(false);
    if (providers) Promise.all(providers.map(async (provider) => ({ providerId: provider.id, page: await customerData.assets(provider.id, { limit: 15 }, { query, locationId: locationId || undefined }) })))
      .then((pages) => {
        if (!active) return;
        const assets = pages.flatMap(({ page }) => page.data).sort((left, right) => right.attributes.created_at.localeCompare(left.attributes.created_at) || left.id.localeCompare(right.id));
        setResult({ data: assets, page: { next: pages.some(({ page }) => page.page?.next) ? 'more-authorized-assets' : null } });
        setCursors(Object.fromEntries(pages.map(({ providerId, page }) => [providerId, page.page?.next ?? null])));
      })
      .catch((cause) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [providerKey, query, locationId]);
  async function loadMore() {
    if (!providers || !result || loadingMore) return;
    if (result.data.length > visibleCount) { setVisibleCount((count) => count + 15); return; }
    const pagingKey = requestKey; setLoadingMore(true); setError('');
    try {
      const pages = await Promise.all(providers.filter((provider) => cursors[provider.id]).map(async (provider) => ({ providerId: provider.id, page: await customerData.assets(provider.id, { limit: 15, after: cursors[provider.id]! }, { query, locationId: locationId || undefined }) })));
      if (activeKey.current !== pagingKey) return;
      const nextCursors = { ...cursors };
      for (const { providerId, page } of pages) nextCursors[providerId] = page.page?.next ?? null;
      setCursors(nextCursors);
      setResult((current) => {
        if (!current) return current;
        const seen = new Set(current.data.map((asset) => `${asset.attributes.provider_id}:${asset.id}`));
        const added = pages.flatMap(({ page }) => page.data).filter((asset) => !seen.has(`${asset.attributes.provider_id}:${asset.id}`));
        return { data: [...current.data, ...added].sort((left, right) => right.attributes.created_at.localeCompare(left.attributes.created_at) || left.id.localeCompare(right.id)), page: { next: Object.values(nextCursors).some(Boolean) ? 'more-authorized-assets' : null } };
      });
      setVisibleCount((count) => count + 15);
    } catch (cause) { if (activeKey.current === pagingKey) setError(errorText(cause)); }
    finally { if (activeKey.current === pagingKey) setLoadingMore(false); }
  }
  if (error && !result) return <DataState message={error} t={t} />;
  if (!providers || !result) return <DataState message={t('loading')} t={t} />;
  const displayedCount = Math.min(visibleCount, result.data.length);
  const totalCount = result.page?.next ? `${result.data.length}+` : String(result.data.length);
  const locationOptions = initialLocationId && !locations.some((location) => location.id === initialLocationId)
    ? [{ id: initialLocationId, name: initialLocationName || 'Selected place', label: initialLocationName || 'Selected place' }, ...locations]
    : locations;
  return <section className="content"><div className="section-heading customer-assets-heading"><div><h1>My assets</h1><p>Every asset, its care and its complete service story.</p></div><div className="customer-assets-heading-actions"><ScanAsset providers={providers || []} onSelectProvider={onSelectProvider} t={t} buttonLabel="Find by E-Code" /></div></div><div className="customer-asset-filters"><label><span>Search assets</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, place or asset code" aria-label="Search assets" /></label><label><span>Place</span><select aria-label="Filter assets by place" value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">All places</option>{locationOptions.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}</select></label></div>{error && <p className="error" role="alert">{error}</p>}{result.data.length === 0 ? <DataState message={query || locationId ? 'No assets match these filters.' : t('empty')} t={t} /> : <div className="customer-asset-card-grid">{result.data.slice(0, visibleCount).map((asset) => { const address = customerVisibleAddressText(asset.attributes.service_location_address); const place = [asset.attributes.service_location_name ? customerReadableName(asset.attributes.service_location_name) : '', asset.attributes.service_location_code ? `Site code ${asset.attributes.service_location_code}` : '', address].filter(Boolean).join(' · '); const assetName = customerReadableName(asset.attributes.name); const visitKey = customerAssetKey(asset.attributes.provider_id, asset.id); const visit = visitSummary?.byAsset.get(visitKey); const visitLabel = !visitSummary ? 'Loading visit details…' : visitSummary.failedProviders.has(asset.attributes.provider_id) ? 'Visit details unavailable' : visit ? formatIndiaDateTime(visit.startsAt) : 'No confirmed visit in the next 31 days'; const coverageLabel = customerAssetCoverageStatus(asset.id, warranties.records?.map(({ resource }) => resource) ?? null, contracts.records?.map(({ resource }) => resource) ?? null, { loading: (!warranties.records && !warranties.error) || (!contracts.records && !contracts.error), failed: Boolean(warranties.error || contracts.error), hasMore: warranties.hasMore || contracts.hasMore }); const coverageActive = coverageLabel === 'AMC active' || coverageLabel === 'Warranty active'; return <button className="customer-asset-card" type="button" key={visitKey} onClick={() => { onSelectProvider(asset.attributes.provider_id); go(`/asset/${asset.id}`); }}><span className="customer-asset-card-top"><CustomerAssetIcon /><span className={`status${coverageActive ? ' customer-asset-coverage-active' : ''}`}>{coverageLabel}</span></span><strong>{assetName}</strong><span className="customer-asset-card-place">{place || 'Place details not supplied'}</span><span className="customer-asset-next-service"><span>Next service · {visitLabel}</span><span aria-hidden="true">→</span></span></button>; })}</div>}{result.data.length > 0 && <p className="customer-assets-count">Showing {displayedCount} of {totalCount} assets across your connected providers.</p>}{(result.data.length > visibleCount || result.page?.next) && <MoreRecords loading={loadingMore} onClick={() => void loadMore()} />}</section>;
}

function CustomerBookingsAcrossProviders({ providers, onSelectProvider, t }: { providers: Resource<ProviderAttributes>[] | null; onSelectProvider: (id: string) => void; t: T }) {
  const requests = useProviderRecords(providers, (providerId, page) => customerData.requests(providerId, page), 15);
  const jobs = useProviderRecords(providers, (providerId, page) => customerData.jobs(providerId, page), 15);
  const [bookings, setBookings] = useState<ProviderBooking[] | null>(null);
  const [bookingCursors, setBookingCursors] = useState<Record<string, string | null>>({});
  const [assetIndex, setAssetIndex] = useState<Record<string, Map<string, AssetAttributes>>>({});
  const [bookingError, setBookingError] = useState('');
  const [visibleCount, setVisibleCount] = useState(15);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState(consumeGlobalSearchQuery);
  const [statusFilter, setStatusFilter] = useState('All statuses');
  useEffect(() => {
    const applyGlobalSearch = (event: Event) => {
      const detail = (event as CustomEvent<{ kind: GlobalSearchKind; query: string }>).detail;
      if (detail?.kind !== 'service') return;
      sessionStorage.removeItem('trise-customer-global-search-query');
      setSearch(detail.query); setStatusFilter('All statuses'); setVisibleCount(15);
    };
    window.addEventListener('trise:customer-global-search', applyGlobalSearch);
    return () => window.removeEventListener('trise:customer-global-search', applyGlobalSearch);
  }, []);
  const providerKey = providers?.map((provider) => provider.id).join('|') ?? 'loading';
  const activeKey = useRef(providerKey); activeKey.current = providerKey;
  useEffect(() => {
    let active = true;
    setBookings(null); setBookingCursors({}); setBookingError(''); setVisibleCount(15);
    if (providers) Promise.all(providers.map(async (provider) => ({ providerId: provider.id, page: await customerData.bookings(provider.id, { limit: 15 }) })))
      .then((pages) => {
        if (!active) return;
        setBookings(pages.flatMap(({ providerId, page }) => page.data.map((booking) => ({ booking, providerId }))));
        setBookingCursors(Object.fromEntries(pages.map(({ providerId, page }) => [providerId, page.page?.next ?? null])));
      }).catch((cause) => { if (active) setBookingError(errorText(cause)); });
    return () => { active = false; };
  }, [providerKey]);
  useEffect(() => {
    let active = true;
    setAssetIndex({});
    if (!providers) return () => { active = false; };
    Promise.allSettled(providers.map(async (provider) => ({ providerId: provider.id, page: await customerData.assets(provider.id, { limit: 100 }) }))).then((results) => {
      if (!active) return;
      const next: Record<string, Map<string, AssetAttributes>> = {};
      for (const result of results) if (result.status === 'fulfilled') next[result.value.providerId] = new Map(result.value.page.data.map((asset) => [asset.id, asset.attributes]));
      setAssetIndex(next);
    });
    return () => { active = false; };
  }, [providerKey]);
  const providerNames = new Map((providers || []).map((provider) => [provider.id, provider.attributes.display_name || 'Service provider']));
  type Activity = { kind: 'request'; providerId: string; record: Resource<RequestAttributes>; booking?: Resource<BookingAttributes>; date: string; status: string; reference?: string; searchable: string }
    | { kind: 'booking'; providerId: string; record: Resource<BookingAttributes>; date: string; status: string; reference?: string; searchable: string }
    | { kind: 'job'; providerId: string; record: Resource<ServiceJobAttributes>; booking?: Resource<BookingAttributes>; date: string; status: string; reference?: string; searchable: string };
  const activityRequests = (requests.records || []).map(({ providerId, resource }) => ({ providerId, id: resource.id }));
  const requestActivities: Activity[] = (requests.records || []).map(({ providerId, resource }): Activity => {
    const linkedBooking = (bookings || []).find(({ providerId: bookingProviderId, booking }) => isRequestedBookingRepresentedByRequest(bookingProviderId, booking, [{ providerId, id: resource.id }]))?.booking;
    return {
      kind: 'request', providerId, record: resource, booking: linkedBooking, date: resource.attributes.created_at,
      status: linkedBooking ? serviceStatusLabel(linkedBooking.attributes.status) : serviceStatusLabel(resource.attributes.status),
      reference: resource.attributes.reference_code,
      searchable: `${resource.attributes.reference_code || ''} ${resource.attributes.summary} ${resource.attributes.description || ''} ${resource.attributes.status} ${linkedBooking?.attributes.status || ''} ${providerNames.get(providerId) || ''}`,
    };
  });
  const jobBookingLinks = (jobs.records || []).map(({ providerId, resource }) => ({
    providerId,
    relationships: resource.relationships as Record<string, Link | Link[] | null | undefined>,
  }));
  const distinctBookingActivities: Activity[] = (bookings || []).filter(({ providerId, booking }) =>
    !isRequestedBookingRepresentedByRequest(providerId, booking, activityRequests) &&
    !isBookingRepresentedByJob(providerId, booking.id, jobBookingLinks))
    .map(({ providerId, booking }): Activity => ({ kind: 'booking', providerId, record: booking, date: booking.attributes.created_at || booking.attributes.requested_window.starts_at, status: serviceStatusLabel(booking.attributes.status), reference: booking.attributes.service_request_reference_code, searchable: `${booking.attributes.service_request_reference_code || ''} ${booking.attributes.summary} ${booking.attributes.status} ${providerNames.get(providerId) || ''}` }));
  const entries: Activity[] = [
    ...requestActivities,
    ...distinctBookingActivities,
    ...(jobs.records || []).map(({ providerId, resource }): Activity => {
      const bookingId = relatedResourceId(resource.relationships, 'booking');
      const linkedBooking = bookingId ? (bookings || []).find((item) => item.providerId === providerId && item.booking.id === bookingId)?.booking : undefined;
      const status = linkedBooking?.attributes.status || resource.attributes.customer_status || resource.attributes.status;
      return {
        kind: 'job', providerId, record: resource, booking: linkedBooking, date: resource.attributes.created_at || resource.attributes.scheduled_window?.starts_at || '',
        status: serviceStatusLabel(status),
        searchable: `${resource.attributes.summary || 'Service visit'} ${status} ${providerNames.get(providerId) || ''}`,
      };
    })
  ].sort((left, right) => right.date.localeCompare(left.date));
  function activityContext(entry: Activity) {
    const relation = entry.record.relationships.asset;
    const assetLink = Array.isArray(relation) ? relation[0] : relation;
    const asset = assetLink?.id ? assetIndex[entry.providerId]?.get(assetLink.id) : undefined;
    const location = entry.kind === 'job' ? entry.record.attributes.historical_location : undefined;
    const locationName = location?.service_location_name || location?.name || asset?.service_location_name;
  const address = customerVisibleAddressText(location?.address) || customerVisibleAddressText(location?.address_lines) || customerVisibleAddressText(asset?.service_location_address);
    return [asset?.name ? customerReadableName(asset.name) : (assetLink ? 'Linked asset' : ''), locationName ? customerReadableName(locationName) : '', address].filter(Boolean).join(' · ');
  }
  const visibleEntries = entries.filter((entry) => (statusFilter === 'All statuses' || entry.status.toLowerCase() === statusFilter.toLowerCase()) && (!search.trim() || `${entry.searchable} ${activityContext(entry)}`.toLowerCase().includes(search.trim().toLowerCase())));
  const statusOptions = [...new Set(entries.map((entry) => entry.status))].sort((left, right) => left.localeCompare(right));
  const hasMore = requests.hasMore || jobs.hasMore || Object.values(bookingCursors).some(Boolean);
  const initialLoading = !providers || (bookings === null && !bookingError) || (!requests.records && !requests.error) || (!jobs.records && !jobs.error);
  async function loadMore() {
    if (!providers || loadingMore) return;
    if (entries.length > visibleCount) { setVisibleCount((count) => count + 15); return; }
    setLoadingMore(true);
    const requestKey = providerKey;
    try {
      const bookingPages = await Promise.all(providers.filter((provider) => bookingCursors[provider.id]).map(async (provider) => ({ providerId: provider.id, page: await customerData.bookings(provider.id, { limit: 15, after: bookingCursors[provider.id]! }) })));
      if (activeKey.current !== requestKey) return;
      if (bookingPages.length) {
        setBookingCursors((current) => ({ ...current, ...Object.fromEntries(bookingPages.map(({ providerId, page }) => [providerId, page.page?.next ?? null])) }));
        setBookings((current) => [...(current || []), ...bookingPages.flatMap(({ providerId, page }) => page.data.map((booking) => ({ providerId, booking })))]);
      }
      await Promise.all([requests.hasMore ? requests.loadMore() : Promise.resolve(), jobs.hasMore ? jobs.loadMore() : Promise.resolve()]);
      if (activeKey.current === requestKey) setVisibleCount((count) => count + 15);
    } catch (cause) { if (activeKey.current === requestKey) setBookingError(errorText(cause)); }
    finally { if (activeKey.current === requestKey) setLoadingMore(false); }
  }
  if (initialLoading) return <DataState message={t('loading')} t={t} />;
  if (!entries.length && bookingError && requests.error && jobs.error) return <DataState message={bookingError || requests.error || jobs.error} t={t} />;
  const clearFilters = Boolean(search || statusFilter !== 'All statuses');
  return <section className="content customer-bookings-page">
    <div className="section-heading customer-service-heading"><div><h1>Service &amp; bookings</h1><p>Know what’s happening and what comes next.</p></div><div><Button onClick={() => go('/request')}><span aria-hidden="true">＋</span> Request service</Button></div></div>
    <div className={`service-activity-filters${clearFilters ? ' has-clear' : ''}`}><label><span>Search</span><input type="search" aria-label="Find a service" placeholder="Find a service" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label><span>Status</span><SortedSelect aria-label="Filter service status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</SortedSelect></label>{clearFilters && <Button type="button" onClick={() => { setSearch(''); setStatusFilter('All statuses'); }}>Clear filters</Button>}</div>
    {(bookingError || requests.error || jobs.error) && <p className="error" role="alert">Some service activity could not be loaded: {bookingError || requests.error || jobs.error}</p>}
    {visibleEntries.length === 0 ? <p className="notice">{entries.length ? 'No service activities match these filters.' : t('empty')}</p> : <div className="customer-service-activity-list">{visibleEntries.slice(0, visibleCount).map((entry) => {
      const title = customerReadableName(entry.kind === 'request' ? entry.record.attributes.summary : entry.kind === 'booking' ? entry.record.attributes.summary : entry.record.attributes.summary || 'Service visit');
      const time = entry.kind === 'request' ? entry.booking ? serviceBookingWindowLabel(entry.booking, formatIndiaDateTime) : `Requested ${formatIndiaDateTime(entry.date)}` : entry.kind === 'booking' ? serviceBookingWindowLabel(entry.record, formatIndiaDateTime) : entry.booking ? serviceBookingWindowLabel(entry.booking, formatIndiaDateTime) : serviceScheduleLabel(entry.record.attributes.status, entry.record.attributes.scheduled_window?.starts_at ? formatIndiaDateTime(entry.record.attributes.scheduled_window.starts_at) : undefined);
      const context = activityContext(entry) || 'Asset and location details are not shared';
      const kind = entry.kind === 'request' ? 'Service request' : entry.kind === 'booking' ? 'Appointment' : 'Service work';
      return <article className="customer-service-activity" key={`${entry.kind}:${entry.providerId}:${entry.record.id}`}>
        <div className="customer-service-activity-top"><span className="customer-service-activity-icon" aria-hidden="true"><CustomerNavIcon name="bookings" /></span><div><small>{serviceActivityReference(entry.reference, kind)}</small><strong>{title}</strong><p>{[context, time, providerNames.get(entry.providerId) || 'Authorized service provider'].filter(Boolean).join(' · ')}</p></div></div>
        <div className="customer-service-activity-actions"><Status>{entry.status}</Status><div className="inline-actions">{entry.kind === 'request' ? <Button onClick={() => { onSelectProvider(entry.providerId); go(entry.booking ? `/booking/${entry.booking.id}` : `/request/${entry.record.id}`); }}>View details</Button> : entry.kind === 'booking' ? <Button onClick={() => { onSelectProvider(entry.providerId); go(`/booking/${entry.record.id}`); }}>View details</Button> : <><Button onClick={() => { onSelectProvider(entry.providerId); go(`/service/${entry.record.id}`); }}>View details</Button>{serviceFeedbackEligible(entry.record.attributes.status) && <Button onClick={() => go(`/feedback/${entry.record.id}`)}>Share service feedback</Button>}</>}</div></div>
      </article>;
    })}</div>}
    {(visibleEntries.length > visibleCount || hasMore) && <MoreRecords loading={loadingMore || requests.loadingMore || jobs.loadingMore} onClick={() => void loadMore()} />}
  </section>;
}

function AssetDetail({ providerId, providerName, id, t }: { providerId: string; providerName: string; id: string; t: T }) {
  const [asset, setAsset] = useState<Resource<AssetAttributes> | null>(null);
  const [location, setLocation] = useState<Resource<LocationAttributes> | null>(null);
  const [coverage, setCoverage] = useState<{ label: string; failed: boolean } | null>(null);
  const [coverageRetry, setCoverageRetry] = useState(0);
  const [history, setHistory] = useState<Collection<TimelineEntryAttributes> | null>(null);
  const [documents, setDocuments] = useState<Collection<DocumentAttributes> | null>(null);
  const [serviceSummary, setServiceSummary] = useState<{ upcoming: Resource<BookingAttributes> | null; latest: Resource<ServiceJobAttributes> | null } | null>(null);
  const [tab, setTab] = useState<'Overview' | 'Service history' | 'Documents'>('Overview');
  const [error, setError] = useState('');
  const [tabError, setTabError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  useEffect(() => { customerData.asset(providerId, id).then((value) => { setAsset(value); const link = value.relationships.location as Link | null | undefined; if (link) return customerData.location(providerId, link.id).then(setLocation); return undefined; }).catch((cause) => setError(errorText(cause))); }, [providerId, id]);
  useEffect(() => {
    let cancelled = false;
    setCoverage(null);
    Promise.all([customerData.warranties(providerId, { limit: 100 }), customerData.contracts(providerId, { limit: 100 })])
      .then(([warranties, contracts]) => {
        if (cancelled) return;
        setCoverage({
          label: customerAssetCoverageStatus(id, warranties.data, contracts.data, { hasMore: Boolean(warranties.page?.next || contracts.page?.next) }),
          failed: false,
        });
      })
      .catch(() => { if (!cancelled) setCoverage({ label: 'Coverage unavailable', failed: true }); });
    return () => { cancelled = true; };
  }, [providerId, id, coverageRetry]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([customerData.bookings(providerId, { limit: 100 }), customerData.jobs(providerId, { limit: 100 })]).then(([bookingPage, jobPage]) => {
      if (cancelled) return;
      const belongsToAsset = (record: Resource<BookingAttributes | ServiceJobAttributes>) => (record.relationships.asset as Link | null | undefined)?.id === id;
      const upcoming = bookingPage.data.filter((booking) => belongsToAsset(booking) && ['CONFIRMED', 'SCHEDULED', 'RESCHEDULED'].includes(booking.attributes.status.toUpperCase()) && Date.parse(booking.attributes.requested_window.starts_at) > Date.now()).sort((a, b) => Date.parse(a.attributes.requested_window.starts_at) - Date.parse(b.attributes.requested_window.starts_at))[0] || null;
      const latest = jobPage.data.filter((job) => belongsToAsset(job) && serviceFeedbackEligible(job.attributes.status)).sort((a, b) => (b.attributes.created_at || '').localeCompare(a.attributes.created_at || ''))[0] || null;
      setServiceSummary({ upcoming, latest });
    }).catch((cause) => { if (!cancelled) setTabError(errorText(cause)); });
    return () => { cancelled = true; };
  }, [providerId, id]);
  useEffect(() => {
    setTabError('');
    if (tab === 'Service history' && !history) customerData.timelineForSource(providerId, id).then(setHistory).catch((cause) => setTabError(errorText(cause)));
    if (tab === 'Documents' && !documents) customerData.documents(providerId, { limit: 15 }, id).then(setDocuments).catch((cause) => setTabError(errorText(cause)));
  }, [providerId, id, tab, history, documents]);
  async function saveDisplayName(event: FormEvent) {
    event.preventDefault();
    if (!asset || !nameDraft.trim()) { setNameError('Enter a display name.'); return; }
    setSavingName(true); setNameError('');
    try {
      const updated = await customerData.updateAsset(providerId, id, { name: nameDraft.trim(), expected_revision: asset.attributes.revision }, crypto.randomUUID());
      setAsset(updated); setEditingName(false);
    } catch (cause) { setNameError(errorText(cause)); }
    finally { setSavingName(false); }
  }
  if (error) return <DataState message={error} t={t} />; if (!asset) return <DataState message={t('loading')} t={t} />;
  const locationLink = asset.relationships.location as Link | null | undefined;
  const canRequestService = Boolean(asset.relationships.customer_relationship);
  const identifier = asset.attributes.identifiers?.find((item) => item.kind?.toUpperCase() === 'EQUIPMENT_CODE')?.value || asset.attributes.identifiers?.[0]?.value;
  const coverageLabel = coverage?.label || 'Checking coverage…';
  const hasActiveCoverage = coverageLabel === 'AMC active' || coverageLabel === 'Warranty active';
  const coverageDescription = coverage?.failed
    ? 'Coverage information could not be loaded. Try again or open AMC & warranty.'
    : hasActiveCoverage
      ? 'Coverage, inclusions and agreement.'
      : coverageLabel === 'Checking coverage…'
        ? 'Checking agreements shared with your account.'
        : 'No active agreement is currently listed for this asset.';
  const placeName = location?.attributes.name ? customerReadableName(location.attributes.name) : asset.attributes.service_location_name ? customerReadableName(asset.attributes.service_location_name) : locationLink ? 'Service location' : null;
  const place = customerAssetPlaceLabel(placeName, location?.attributes.service_location_code || asset.attributes.service_location_code);
  const address = customerVisibleAddressText(location?.attributes.address_lines) || customerVisibleAddressText(asset.attributes.service_location_address) || 'Address not supplied';
  const detailRows: Array<[string, ReactNode]> = [
    ['Asset code', identifier || 'Not supplied'],
    ['Place', place],
    ['Installed at', address],
    ['Service provider', providerName],
    ['Next planned service', serviceSummary?.upcoming ? `${serviceTrackingTitle(serviceSummary.upcoming.attributes.summary, asset.attributes.name)} · ${formatIndiaDateTime(serviceSummary.upcoming.attributes.requested_window.starts_at)}` : serviceSummary ? 'No confirmed visit scheduled' : t('loading')],
    ['Last service', serviceSummary?.latest ? `${serviceTrackingTitle(serviceSummary.latest.attributes.summary, asset.attributes.name)} · ${formatIndiaDate(serviceSummary.latest.attributes.created_at || '')}` : serviceSummary ? 'No completed service recorded' : t('loading')],
  ];
  return <section className="content customer-asset-detail">
    <button className="text-button customer-asset-detail-back" type="button" onClick={() => go('/assets')}>← My assets</button>
    <div className="asset-detail-heading"><div className="asset-detail-title"><h1>{customerReadableName(asset.attributes.name)}</h1><p>{identifier || assetDisplaySubtitle(identifier)}</p></div>{canRequestService && <Button onClick={() => go(`/asset/${asset.id}/request`)}>{t('requestService')}</Button>}</div>
    <div className="customer-record-tabs" role="tablist" aria-label="Asset sections">{(['Overview', 'Service history', 'Documents'] as const).map((value) => <button type="button" key={value} role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{value}</button>)}</div>
    {tab === 'Overview' ? <div className="asset-detail-columns">
      <section className="detail-card"><div className="customer-asset-overview-heading"><h3>Asset overview</h3><Status>{coverageLabel}</Status></div><p>Your asset’s essential details.</p><dl>{detailRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {nameError && <p className="error" role="alert">{nameError}</p>}
        {editingName ? <form className="customer-asset-name-form" onSubmit={(event) => void saveDisplayName(event)}><label>Asset display name<input autoFocus maxLength={200} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} /></label><div className="inline-actions"><Button type="button" disabled={savingName} onClick={() => { setEditingName(false); setNameError(''); }}>Cancel</Button><Button disabled={savingName || !nameDraft.trim()}>{savingName ? 'Saving…' : 'Save name'}</Button></div></form> : canRequestService && <button className="text-button customer-asset-edit-name" type="button" onClick={() => { setNameDraft(asset.attributes.name); setNameError(''); setEditingName(true); }}>Edit display name</button>}
        {!canRequestService && <p className="notice">Service requests and display-name changes need an active customer relationship. Contact the provider to link this asset to your account.</p>}
      </section>
      <div className="asset-detail-side"><section className="detail-card"><h3>{hasActiveCoverage ? 'Covered, with clarity' : 'Coverage details'}</h3><p>{hasActiveCoverage ? 'View the active agreement and exact service scope.' : 'Review any warranty or maintenance agreement shared with your account.'}</p><button type="button" className="customer-asset-coverage-link" onClick={() => go('/coverage')}><span className="customer-asset-coverage-icon" aria-hidden="true">✓</span><span><strong>{coverageLabel}</strong><small>{coverageDescription}</small></span><span className="customer-asset-coverage-chevron" aria-hidden="true">›</span></button>{coverage?.failed && <button type="button" className="text-button customer-asset-coverage-retry" onClick={() => setCoverageRetry((value) => value + 1)}>Retry coverage</button>}</section><section className="detail-card"><h3>Your service team</h3><strong>{providerName}</strong><p>Your selected service provider</p><Button onClick={() => go('/help')}>Contact support</Button></section></div>
    </div> : tabError ? <DataState message={tabError} t={t} /> : tab === 'Service history' ? !history ? <DataState message={t('loading')} t={t} /> : history.data.length === 0 ? <p className="notice">No service history is available for this asset yet.</p> : <div className="record-grid">{history.data.map((entry) => <article className="record-card" key={entry.id}><Status>{entry.attributes.event_name.replaceAll('_', ' ')}</Status><strong>{entry.attributes.summary || 'Service update'}</strong><span>{formatIndiaDateTime(entry.attributes.occurred_at)}</span></article>)}</div> : !documents ? <DataState message={t('loading')} t={t} /> : documents.data.length === 0 ? <p className="notice">No customer-visible documents are available for this asset.</p> : <div className="record-grid">{documents.data.map((document) => <article className="record-card" key={document.id}><Status>{document.attributes.status}</Status><strong>{customerDocumentDisplayName(document.attributes.filename)}</strong><span>{customerDocumentClassificationLabel(document.attributes.classification)}</span><Button onClick={() => go(`/documents/${document.id}`)}>View document</Button></article>)}</div>}
  </section>;
}

function CustomerRequestReceipt({ providerId, providerName, id, t }: { providerId: string; providerName: string; id: string; t: T }) {
  const [request, setRequest] = useState<Resource<RequestAttributes> | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setRequest(null); setError('');
    if (!isCustomerRequestId(id)) { setError('This request receipt is unavailable. Review your service requests to find a submitted request.'); return () => { active = false; }; }
    customerData.request(providerId, id)
      .then((value) => { if (active) setRequest(value); })
      .catch(() => { if (active) setError('We could not load this request receipt. Try again or open Service requests.'); });
    return () => { active = false; };
  }, [providerId, id, retry]);
  if (error) return <section className="content"><div className="customer-feature-error" role="alert"><p>{error}</p>{isCustomerRequestId(id) && <Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>Retry receipt</Button>}<Button variant="secondary" onClick={() => go('/requests')}>View service requests</Button></div></section>;
  if (!request) return <DataState message={t('loading')} t={t} />;
  const bookingLinks = request.relationships.service_bookings;
  const bookingCount = Array.isArray(bookingLinks) ? bookingLinks.length : bookingLinks ? 1 : 0;
  return <CustomerRequestConfirmation reference={request.attributes.reference_code || request.id} providerName={providerName} summary={request.attributes.summary} bookingStatus={requestConfirmationBookingStatus(bookingCount)} onViewServices={() => go('/bookings')} onHome={() => go('/')} />;
}

function RequestForm({ providerId, providerName, customerName, assetId, t }: { providerId: string; providerName: string; customerName: string; assetId: string; t: T }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE }).format(new Date());
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE }).format(new Date(Date.parse(`${today}T00:00:00+05:30`) + 86_400_000));
  const [asset, setAsset] = useState<Resource<AssetAttributes> | null>(null); const [services, setServices] = useState<Collection<ServiceTypeAttributes> | null>(null); const [form, setForm] = useState({ summary: '', description: '', serviceTypeId: '', requestType: 'REPAIR', customerEmergencySignal: false, preferredDate: tomorrow, preferredSlot: '09:00-12:00' as PreferredWindowSlot }); const [step, setStep] = useState(1); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setAsset(null); setServices(null); setError('');
    Promise.all([customerData.asset(providerId, assetId), customerData.serviceTypes(providerId)])
      .then(([nextAsset, nextServices]) => { if (active) { setAsset(nextAsset); setServices(nextServices); } })
      .catch((cause) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [providerId, assetId]);
  const relationship = asset?.relationships.customer_relationship as Link | undefined; const location = asset?.relationships.location as Link | null | undefined;
  const requestAssetCode = asset?.attributes.identifiers?.find((item) => item.kind?.toUpperCase() === 'EQUIPMENT_CODE')?.value || asset?.attributes.identifiers?.[0]?.value || '';
  const requestAssetPlace = [asset?.attributes.service_location_name ? customerReadableName(asset.attributes.service_location_name) : '', asset?.attributes.service_location_address ? customerVisibleAddressText(asset.attributes.service_location_address) : ''].filter(Boolean).join(' · ');
  const update = (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const steps = ['Asset', 'Issue', 'Time', 'Review'];
  function advance() {
    if (step === 1 && !form.serviceTypeId) { setError('Choose a service before continuing.'); return; }
    if (step === 1 && !form.summary.trim()) { setError('Add a short description before continuing.'); return; }
    if (step === 2 && form.preferredSlot !== 'ASAP') {
      if (!form.preferredDate) { setError('Choose a preferred date or select As soon as possible.'); return; }
      const window = buildPreferredWindow(form.preferredDate, form.preferredSlot);
      if (!window || Date.parse(window.starts_at) <= Date.now()) { setError('Choose a future visit window or select As soon as possible.'); return; }
    }
    setError(''); setStep((current) => Math.min(current + 1, steps.length - 1));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmitCustomerRequest(step, steps.length - 1)) return;
    if (!relationship) { setError('This asset is not linked to an active customer service relationship. Contact your provider to link it before requesting service.'); return; }
    if (!asset || !location) { setError(t('locationRequired')); return; }
    setSaving(true); setError('');
    try {
      const payload: Record<string, unknown> = {
        summary: form.summary.trim(), description: form.description.trim(), customer_relationship_id: relationship.id,
        asset_id: asset.id, location_id: location.id, service_type_id: form.serviceTypeId, request_type_id: form.requestType,
        customer_emergency_signal: form.customerEmergencySignal
      };
      const requestedWindow = buildPreferredWindow(form.preferredDate, form.preferredSlot);
      if (requestedWindow) payload.requested_window = requestedWindow;
      const request = await customerData.createRequest(providerId, payload, crypto.randomUUID());
      go(requestConfirmationRoute(request.id));
    } catch (cause) { setError(errorText(cause)); }
    finally { setSaving(false); }
  }
  if (!asset || !services) return <DataState message={error || t('loading')} t={t} />;
  return <section className="content"><button className="text-button" onClick={() => go(`/asset/${assetId}`)}>← {t('back')}</button><div className="customer-request-layout"><form className="form-card customer-request-form" onSubmit={submit}><Status>{t('requestService')}</Status><div className="trise-info-heading-row customer-request-title"><h2>Let’s get it sorted.</h2><InfoNotice>Request service for {customerReadableName(asset.attributes.name)}. Your service provider is determined by this asset.</InfoNotice></div><ol className="customer-request-steps" aria-label="Request steps">{steps.map((label, index) => <li className={index === step ? 'active' : index < step ? 'complete' : ''} key={label} aria-current={index === step ? 'step' : undefined}><span>{index < step ? '✓' : index + 1}</span>{label}</li>)}</ol>
    {step === 0 && <div className="customer-request-step"><div className="trise-info-heading-row"><h3>Confirm the asset</h3><InfoNotice>The registered asset supplies its service location and provider. You do not need to select a site separately.</InfoNotice></div><dl><dt>Asset</dt><dd>{customerReadableName(asset.attributes.name)}</dd><dt>E-Code</dt><dd>{requestAssetCode || 'Not supplied'}</dd><dt>Registered place</dt><dd>{requestAssetPlace || (location ? 'Location linked; details not shared' : 'Not available')}</dd><dt>Provider</dt><dd>{providerName}</dd></dl></div>}
    {step === 1 && <div className="customer-request-step"><h3>Tell us what’s happening.</h3><p className="muted small">A few details help your service team prepare.</p><label>Service type<SortedSelect required value={form.serviceTypeId} onChange={update('serviceTypeId')}><option value="">Choose a service</option>{services.data.map((service) => <option value={service.id} key={service.id}>{service.attributes.name || service.attributes.code || 'Service'}</option>)}</SortedSelect></label><label>Issue type<SortedSelect value={form.requestType} onChange={update('requestType')}><option value="REPAIR">Repair or not working</option><option value="PREVENTIVE">Preventive service</option><option value="UNUSUAL_NOISE">Unusual noise</option><option value="INSPECTION">Inspection</option><option value="CALLBACK">Callback</option><option value="OTHER">Other</option></SortedSelect></label><label>Short description<input required maxLength={200} value={form.summary} onChange={update('summary')} placeholder="For example, lift door is making a noise" /></label><label>More details<textarea maxLength={4000} value={form.description} onChange={update('description')} placeholder="Add details that will help the service team prepare." /></label><label className="customer-request-safety"><input type="checkbox" checked={form.customerEmergencySignal} onChange={(event) => setForm((current) => ({ ...current, customerEmergencySignal: event.target.checked }))} /><span><strong>There may be a safety concern</strong><small>Your provider will assess the issue and priority.</small></span></label><p className="notice">If anyone is in immediate danger, move to safety and contact local emergency services.</p></div>}
    {step === 2 && <div className="customer-request-step"><div className="trise-info-heading-row"><h3>When works for you?</h3><InfoNotice>You’ll receive a separate booking confirmation after the provider accepts a time.</InfoNotice></div><p className="notice">This is your preferred window. Your provider confirms availability; this does not reserve a technician.</p><label>Preferred date<input type="date" min={today} disabled={form.preferredSlot === 'ASAP'} value={form.preferredDate} onChange={update('preferredDate')} /></label><label>Preferred time<SortedSelect value={form.preferredSlot} onChange={update('preferredSlot')}><option value="09:00-12:00">09:00–12:00</option><option value="12:00-15:00">12:00–15:00</option><option value="15:00-18:00">15:00–18:00</option><option value="ASAP">As soon as possible</option></SortedSelect></label></div>}
    {step === 3 && <CustomerRequestReview assetName={customerReadableName(asset.attributes.name)} assetCode={requestAssetCode} assetLocation={requestAssetPlace} serviceType={services.data.find((service) => service.id === form.serviceTypeId)?.attributes.name || services.data.find((service) => service.id === form.serviceTypeId)?.attributes.code || 'Service type'} issue={customerRequestTypeLabel(form.requestType)} description={form.summary} details={form.description} preferredDate={form.preferredSlot === 'ASAP' ? '' : form.preferredDate} preferredWindow={form.preferredSlot === 'ASAP' ? 'As soon as possible' : form.preferredSlot.replace('-', '–')} safetyConcern={form.customerEmergencySignal} providerName={providerName} formatDate={(date) => formatIndiaDate(`${date}T12:00:00+05:30`)} />}
    {!location && <p className="error" role="alert">{t('locationRequired')}</p>}{!relationship && <p className="notice">This asset does not have an active customer service relationship yet. The request cannot be sent until the provider links it.</p>}{error && <p className="error" role="alert">{error}</p>}<div className="inline-actions customer-request-actions">{step > 0 ? <Button type="button" onClick={() => { setError(''); setStep((current) => current - 1); }}>Back</Button> : <Button type="button" onClick={() => go(`/asset/${assetId}`)}>Cancel</Button>}{step < steps.length - 1 ? <Button type="button" onClick={(event) => { event.preventDefault(); advance(); }}>Continue</Button> : <Button type="submit" disabled={saving || !location || !relationship}>{saving ? t('loading') : 'Send service request'}</Button>}</div></form><aside className="detail-card customer-request-context"><CustomerRequestContext providerName={providerName} customerName={customerName} /></aside></div></section>;
}

function MoreRecords({ loading, onClick, label = 'Load more' }: { loading: boolean; onClick: () => void; label?: string }) { return <div className="customer-load-more"><Button disabled={loading} onClick={onClick}>{loading ? 'Loading…' : label}</Button></div>; }

function RequestDetail({ providerId, id, t }: { providerId: string; id: string; t: T }) {
  const [request, setRequest] = useState<Resource<RequestAttributes> | null>(null);
  const [asset, setAsset] = useState<Resource<AssetAttributes> | null>(null);
  const [location, setLocation] = useState<Resource<LocationAttributes> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setRequest(null); setAsset(null); setLocation(null); setError('');
    customerData.request(providerId, id).then(async (value) => {
      if (!active) return;
      setRequest(value);
      const assetRelation = value.relationships.asset;
      const assetLink = Array.isArray(assetRelation) ? assetRelation[0] : assetRelation;
      const locationRelation = value.relationships.service_location || value.relationships.location;
      const locationLink = Array.isArray(locationRelation) ? locationRelation[0] : locationRelation;
      const assetPromise = assetLink?.id ? customerData.asset(providerId, assetLink.id).catch(() => null) : Promise.resolve(null);
      const locationPromise = locationLink?.id
        ? locationLink.type === 'service-locations'
          ? customerData.serviceLocation(providerId, locationLink.id).then((result) => ({ id: result.id, type: result.type, attributes: { name: result.attributes.display_name || result.attributes.location_type, service_location_status: result.attributes.status }, relationships: {} } as Resource<LocationAttributes>)).catch(() => null)
          : customerData.location(providerId, locationLink.id).catch(() => null)
        : Promise.resolve(null);
      const [assetResult, locationResult] = await Promise.all([assetPromise, locationPromise]);
      if (active) { setAsset(assetResult); setLocation(locationResult); }
    }).catch((cause) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [providerId, id]);
  if (error) return <DataState message={error} t={t} />;
  if (!request) return <DataState message={t('loading')} t={t} />;
  const locationRelation = request.relationships.service_location || request.relationships.location;
  const hasLocation = Array.isArray(locationRelation) ? locationRelation.length > 0 : Boolean(locationRelation);
  const locationName = location?.attributes.name || asset?.attributes.service_location_name;
  const address = customerVisibleAddressText(location?.attributes.address_lines) || customerVisibleAddressText(asset?.attributes.service_location_address);
  return <section className="content"><button className="text-button" type="button" onClick={() => go('/requests')}>← {t('back')}</button><div className="detail-card"><Status>{serviceStatusLabel(request.attributes.status)}</Status><h2>{request.attributes.summary}</h2><p>{request.attributes.reference_code ? `Request ${request.attributes.reference_code}` : `Request ${request.id}`}</p><p>{request.attributes.description || t('noDescription')}</p><dl><dt>Created</dt><dd>{formatIndiaDateTime(request.attributes.created_at)}</dd><dt>Asset</dt><dd>{asset?.attributes.name ? customerReadableName(asset.attributes.name) : request.relationships.asset ? 'Authorized asset details are unavailable.' : 'No asset linked'}</dd><dt>Location</dt><dd>{[locationName ? customerReadableName(locationName) : hasLocation ? 'Authorized location' : '', address].filter(Boolean).join(' · ') || 'No service location supplied'}</dd><dt>Safety concern</dt><dd>{request.attributes.customer_emergency_signal ? 'Reported for provider assessment' : 'Not reported'}</dd></dl><p className="notice">Progress is shown only from authorized server relationships. A reported safety concern does not confirm an emergency or dispatch.</p><Button onClick={() => go('/bookings')}>{t('serviceBookings')}</Button></div></section>;
}
function CustomerBookingDetail({ providerId, providerName, id, t }: { providerId: string; providerName: string; id: string; t: T }) {
  const [booking, setBooking] = useState<Resource<BookingAttributes> | null>(null);
  const [asset, setAsset] = useState<Resource<AssetAttributes> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    customerData.booking(providerId, id).then(async (value) => {
      if (!active) return;
      setBooking(value);
      const assetLink = value.relationships.asset as Link | null | undefined;
      if (assetLink) {
        const authorizedAsset = await customerData.asset(providerId, assetLink.id);
        if (active) setAsset(authorizedAsset);
      }
    }).catch((cause) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [providerId, id]);
  if (error) return <DataState message={error} t={t} />;
  if (!booking) return <DataState message={t('loading')} t={t} />;
  const requested = booking.attributes.status.toUpperCase() === 'REQUESTED';
  const visitWindow = requested ? booking.attributes.requested_window : booking.attributes.scheduled_window;
  const request = booking.relationships.service_request as Link | null | undefined;
  return <section className="content"><button className="text-button" onClick={() => go('/bookings')}>← {t('back')}</button><div className="detail-card customer-booking-detail"><Status>{booking.attributes.status}</Status><h2>{booking.attributes.summary}</h2><p>{requested ? 'Your preferred time is awaiting provider confirmation. This is not a confirmed appointment.' : 'Appointment details from your service provider.'}</p><dl><dt>{requested ? 'Preferred window' : 'Appointment time'}</dt><dd>{visitWindow ? `${formatIndiaDateTime(visitWindow.starts_at)}–${formatIndiaDateTime(visitWindow.ends_at)}` : 'Visit time not provided'}</dd><dt>Asset</dt><dd>{asset?.attributes.name ? customerReadableName(asset.attributes.name) : 'No asset linked'}</dd><dt>Service provider</dt><dd>{providerName}</dd><dt>Request date</dt><dd>{booking.attributes.created_at ? formatIndiaDateTime(booking.attributes.created_at) : 'Not supplied'}</dd></dl><div className="inline-actions">{request && <Button onClick={() => go(`/request/${request.id}`)}>View service request</Button>}<Button onClick={() => go('/bookings')}>Back to service & bookings</Button></div></div></section>;
}
function DataState({ message, retry, t }: { message: string; retry?: () => void; t: T }) {
  const kind = classifyCustomerState(message, t('loading'));
  const onAction = retry || (kind === 'denied' ? () => go('/') : ['loading', 'error', 'conflict', 'offline'].includes(kind) ? () => window.location.reload() : undefined);
  return <CustomerStatePanel kind={kind} message={message} onAction={onAction} actionLabel={retry ? t('retry') : undefined} />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><Shell /></AuthProvider></StrictMode>);
