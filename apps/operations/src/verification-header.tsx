import { TriseBrandHeader } from '@trise/ui';

type VerificationHeaderProps = {
  variant?: 'dark' | 'light';
  context?: string;
  showSecurityIndicator?: boolean;
  compact?: boolean;
};

export function VerificationHeader({ variant = 'dark', context = 'Secure Business Access', showSecurityIndicator = true, compact = false }: VerificationHeaderProps) {
  return <header className={`verification-header verification-header-${variant}${compact ? ' verification-header-compact' : ''}`}>
    <div className="verification-brand">
      <TriseBrandHeader variant={variant} compact={compact} />
    </div>
    <div className="verification-security" aria-label={context}>
      {showSecurityIndicator && <svg className="verification-security-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3.5 19 6v5.2c0 4.4-2.9 7.8-7 9.3-4.1-1.5-7-4.9-7-9.3V6l7-2.5Z" />
        <path d="m8.8 12 2.1 2.1 4.4-4.5" />
      </svg>}
      <div>
        <strong>{context}</strong>
        <span>TRISE India Platform</span>
      </div>
    </div>
  </header>;
}
