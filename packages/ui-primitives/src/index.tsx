import type { ButtonHTMLAttributes, ReactNode } from 'react';
export function Button({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) { return <button className="button" {...props}>{children}</button>; }
export function Icon({ label, glyph = '•' }: { label: string; glyph?: string }) { return <span className="icon" role="img" aria-label={label}>{glyph}</span>; }
export function Status({ children }: { children: ReactNode }) { return <span className="status">{children}</span>; }
