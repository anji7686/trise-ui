import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, GoogleSignInButton, googleAuthStatus, useAuth } from '@trise/auth';
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
  return <main className="workspace"><header className="topbar"><div className="wordmark">TRISE <small>INDIA · temporary wordmark</small></div><div className="controls"><label>Language <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}><option value="en">English</option><option value="kn">ಕನ್ನಡ (draft)</option></select></label><label>Theme <select value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}><option>system</option><option>light</option><option>dark</option></select></label>{session && <Button onClick={() => void signOut()}>Sign out</Button>}</div></header><div className="heading"><div><Status>{translate(locale, 'preview')}</Status><h1>Operations overview</h1><p>Provider administration, dispatch, agents, configuration, and shared-asset work—synthetic preview only.</p></div><div className="context"><span>Provider context</span><strong>Choose after sign-in</strong><small>Customer data is never loaded in this preview.</small></div></div><section className="grid">{[['⌁','Dispatch','8 open requests'],['◌','Agents','12 available'],['◈','Configuration','20 managed roots'],['✓','Approvals','3 awaiting review']].map(([glyph,title,detail]) => <article className="tile" key={title}><Icon label={title} glyph={glyph}/><strong>{title}</strong><span>{detail}</span></article>)}</section><section className="notice"><strong>{loading ? 'Checking session…' : session ? `Signed in as ${session.displayName}` : 'Protected operations workspace'}</strong><p>{error || `${googleAuthStatus}. Provider authority, role permissions, and RLS are established only by the real authentication flow.`}</p>{!session && !loading && <GoogleSignInButton />}</section></main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><Shell /></AuthProvider></StrictMode>);
