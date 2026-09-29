export const tokens = {
  color: {
    light: { background: '#F5F7FA', surface: '#FFFFFF', elevated: '#FFFFFF', text: '#182638', secondary: '#526176', border: '#DCE3EC', primary: '#264673', focus: '#264673' },
    dark: { background: '#0D1520', surface: '#152131', elevated: '#1D2D42', text: '#F1F5F9', secondary: '#A8B6C8', border: '#304158', primary: '#A9C8F3', focus: '#A9C8F3' }
  },
  space: { xs: '0.25rem', sm: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.5rem', xxl: '2rem' },
  radius: { sm: '0.375rem', md: '0.625rem', lg: '1rem' },
  motion: { reduced: '0ms', standard: '160ms' }
} as const;

export type ThemeChoice = 'system' | 'light' | 'dark';
