import { Children, cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';
type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-busy'> & {
  children: ReactNode;
  variant?: ButtonVariant;
  busy?: boolean;
};

export function Button({ children, variant = 'primary', busy = false, className = '', disabled, ...props }: ButtonProps) {
  return <button className={`button button-${variant} ${className}`.trim()} aria-busy={busy || undefined} disabled={disabled || busy} {...props}>{children}</button>;
}

type SelectOptionLike = ReactElement<{ children?: ReactNode; disabled?: boolean; label?: string; value?: string }>;
function selectOptionText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(selectOptionText).join(' ');
  if (isValidElement<{ children?: ReactNode; label?: string }>(node)) return node.props.label || selectOptionText(node.props.children);
  return '';
}

function sortedSelectChildren(children: ReactNode): ReactNode[] {
  const nodes = Children.toArray(children).map((node) => {
    if (isValidElement<{ children?: ReactNode }>(node) && node.props.children) {
      const childNodes = sortedSelectChildren(node.props.children);
      return cloneElement(node, undefined, ...childNodes);
    }
    return node;
  });
  const prompt = (node: ReactNode) => {
    if (!isValidElement(node) || node.type !== 'option') return false;
    const option = node as SelectOptionLike;
    return option.props.value === '' || option.props.disabled === true || /^(select|choose|all\b|any\b|please|--|—)/i.test(selectOptionText(option.props.children).trim());
  };
  return nodes.sort((left, right) => {
    const leftPrompt = prompt(left);
    const rightPrompt = prompt(right);
    if (leftPrompt !== rightPrompt) return leftPrompt ? -1 : 1;
    return selectOptionText(left).localeCompare(selectOptionText(right), undefined, { numeric: true, sensitivity: 'base' });
  });
}

/** A native select whose options are consistently ordered while keeping browser keyboard and screen-reader behavior. */
export function SortedSelect({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props}>{sortedSelectChildren(children)}</select>;
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

export { TriseBrandHeader } from './brand-header';
