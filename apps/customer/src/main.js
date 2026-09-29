import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, googleAuthStatus, useAuth } from '@trise/auth';
import { supportedLocales, translate } from '@trise/i18n';
import { Button, Icon, Status } from '@trise/ui';
import '@trise/tokens/theme.css';
import './styles.css';
function Shell() {
    const { session, signOut } = useAuth();
    const [theme, setTheme] = useState(localStorage.getItem('trise-theme') || 'system');
    const [locale, setLocale] = useState(localStorage.getItem('trise-locale') || 'en');
    useEffect(() => { document.documentElement.dataset.theme = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme; localStorage.setItem('trise-theme', theme); }, [theme]);
    useEffect(() => { localStorage.setItem('trise-locale', locale); document.documentElement.lang = locale; document.documentElement.dir = 'ltr'; }, [locale]);
    const t = (key) => translate(locale, key);
    return _jsxs("main", { className: "app-shell", children: [_jsxs("header", { className: "topbar", children: [_jsxs("div", { className: "wordmark", children: ["TRISE ", _jsx("small", { children: "INDIA \u00B7 temporary wordmark" })] }), _jsxs("div", { className: "controls", children: [_jsxs("label", { children: ["Language ", _jsx("select", { value: locale, onChange: (e) => setLocale(e.target.value), children: supportedLocales.map((item) => _jsx("option", { children: item }, item)) })] }), _jsxs("label", { children: ["Theme ", _jsxs("select", { value: theme, onChange: (e) => setTheme(e.target.value), children: [_jsx("option", { children: "system" }), _jsx("option", { children: "light" }), _jsx("option", { children: "dark" })] })] }), session && _jsx(Button, { onClick: signOut, children: "Sign out" })] })] }), _jsxs("section", { className: "hero", children: [_jsxs("div", { children: [_jsx(Status, { children: t('preview') }), _jsx("h1", { children: "Service care that follows your asset." }), _jsx("p", { className: "lede", children: "A mobile-first customer space for assets, bookings, approvals, documents, and notifications." })] }), _jsxs("div", { className: "hero-card", children: [_jsx(Icon, { label: "Asset", glyph: "\u25C8" }), _jsx("strong", { children: "Solar water heater" }), _jsx("span", { children: "Next visit \u00B7 18 Oct 2026" })] })] }), _jsx("nav", { className: "card-grid", "aria-label": "Customer preview navigation", children: [['assets', '◈', 'Your assets'], ['bookings', '◷', 'Bookings'], ['profile', '◎', 'Profile'], ['home', '⌂', 'Notifications']].map(([key, glyph, label]) => _jsxs("a", { className: "nav-card", href: `#${key}`, children: [_jsx(Icon, { label: label, glyph: glyph }), _jsx("strong", { children: t(key) }), _jsx("span", { children: label })] }, key)) }), _jsxs("section", { className: "notice", children: [_jsx("strong", { children: "Signed out preview" }), _jsxs("p", { children: [googleAuthStatus, ". No private API request or production identity is used by this screen."] }), _jsx(Button, { onClick: () => alert('Google authentication requires configured local credentials.'), children: t('signIn') })] })] });
}
createRoot(document.getElementById('root')).render(_jsx(StrictMode, { children: _jsx(AuthProvider, { children: _jsx(Shell, {}) }) }));
