type TriseBrandHeaderProps = { variant?: 'dark' | 'light'; compact?: boolean };

export function TriseBrandHeader({ variant = 'dark', compact = false }: TriseBrandHeaderProps) {
  return <div className={`trise-brand-header trise-brand-header-${variant}${compact ? ' trise-brand-header-compact' : ''}`}>
    <img src={variant === 'dark' ? '/assets/trise-india-logo-dark-header.svg' : '/assets/trise-india-logo-light-header.svg'} alt="TRISE India" className="trise-brand-logo" />
  </div>;
}
