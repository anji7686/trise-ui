import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, GoogleSignInButton, useAuth } from '@trise/auth';
import { translate, type Locale } from '@trise/i18n';
import { Button, Icon, Status } from '@trise/ui';
import '@trise/tokens/theme.css';
import './styles.css';

function Shell() {
  const { session, loading, error, signOut } = useAuth();
  const [theme, setTheme] = useState<'system'|'light'|'dark'>((localStorage.getItem('trise-theme') as 'system'|'light'|'dark') || 'system');
  const [locale, setLocale] = useState<Locale>((localStorage.getItem('trise-locale') as Locale) || 'en');
  useEffect(() => { const media = matchMedia('(prefers-color-scheme: dark)'); const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme; }; apply(); localStorage.setItem('trise-theme', theme); if (theme === 'system') media.addEventListener('change', apply); return () => media.removeEventListener('change', apply); }, [theme]);
  useEffect(() => { localStorage.setItem('trise-locale', locale); document.documentElement.lang = locale; document.documentElement.dir = 'ltr'; }, [locale]);
  const t = (key: string) => translate(locale, key);
  return <main className="app-shell"><header className="topbar"><div className="wordmark">TRISE <small>INDIA · temporary wordmark</small></div><div className="controls"><label>Language <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}><option value="en">English</option><option value="kn">ಕನ್ನಡ (draft)</option></select></label><label>Theme <select value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}><option>system</option><option>light</option><option>dark</option></select></label>{session && <Button onClick={() => void signOut()}>Sign out</Button>}</div></header><section className="hero"><div><Status>{t('preview')}</Status><h1>Service care that follows your asset.</h1><p className="lede">A mobile-first customer space for assets, bookings, approvals, documents, and notifications.</p></div><div className="hero-card"><Icon label="Asset" glyph="◈"/><strong>Solar water heater</strong><span>Next visit · 18 Oct 2026</span></div></section><nav className="card-grid" aria-label="Customer preview navigation">{[['assets','◈','Your assets'],['bookings','◷','Bookings'],['profile','◎','Profile'],['home','⌂','Notifications']].map(([key,glyph,label]) => <a className="nav-card" href={`#${key}`} key={key}><Icon label={label} glyph={glyph}/><strong>{t(key)}</strong><span>{label}</span></a>)}</nav><section className="notice"><strong>{loading ? 'Checking session…' : session ? `Signed in as ${session.displayName}` : 'Sign-in required for private data'}</strong><p>{error || 'Google Identity Services exchanges a browser credential for a TRISE session. This preview never fabricates a successful sign-in.'}</p>{!session && !loading && <GoogleSignInButton />}</section></main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><Shell /></AuthProvider></StrictMode>);
