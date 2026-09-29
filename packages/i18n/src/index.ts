export type Locale = 'en' | 'kn';
export const supportedLocales: Locale[] = ['en', 'kn'];
export const messages: Record<Locale, Record<string, string>> = {
  en: { home: 'Home', assets: 'Assets', bookings: 'Bookings', profile: 'Profile', signIn: 'Sign in', preview: 'Synthetic preview' },
  kn: { home: 'ಮುಖಪುಟ', assets: 'ಸ್ವತ್ತುಗಳು', bookings: 'ಬುಕಿಂಗ್‌ಗಳು', profile: 'ಪ್ರೊಫೈಲ್', signIn: 'ಸೈನ್ ಇನ್', preview: 'ಕೃತಕ ಪೂರ್ವವೀಕ್ಷಣೆ' }
};
export function translate(locale: Locale, key: string) { return messages[locale][key] ?? messages.en[key] ?? key; }
