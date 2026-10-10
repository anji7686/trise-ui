import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';
type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-busy'> & {
  children: ReactNode;
  variant?: ButtonVariant;
  busy?: boolean;
};

export function Button({ children, variant = 'primary', busy = false, className = '', disabled, ...props }: ButtonProps) {
  return <button className={`button button-${variant} ${className}`.trim()} aria-busy={busy || undefined} disabled={disabled || busy} {...props}>{children}</button>;
}
export function Icon({ label, glyph = '•' }: { label: string; glyph?: string }) { return <span className="icon" role="img" aria-label={label}>{glyph}</span>; }
export function Status({ children }: { children: ReactNode }) { return <span className="status">{children}</span>; }

export function StatePanel({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <section className="state-panel" role="status"><strong>{title}</strong>{children && <p>{children}</p>}{action}</section>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <div className="page-eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-header-action">{action}</div>}</header>;
}

export function FilterToolbar({ children, resultLabel }: { children?: ReactNode; resultLabel?: ReactNode }) {
  return <div className="filter-toolbar"><div className="filter-toolbar-fields">{children}</div>{resultLabel && <span className="filter-toolbar-result">{resultLabel}</span>}</div>;
}

export function DetailSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return <section className="detail-section"><div className="detail-section-heading"><h2>{title}</h2>{description && <p>{description}</p>}</div>{children}</section>;
}
