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
