import { Children, cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';

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

export function PageHeader({ eyebrow, title, description, action, titleInfo }: { eyebrow?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; titleInfo?: ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <div className="page-eyebrow">{eyebrow}</div>}{titleInfo ? <div className="page-header-title-row"><h1>{title}</h1>{titleInfo}</div> : <h1>{title}</h1>}{description && <p>{description}</p>}</div>{action && <div className="page-header-action">{action}</div>}</header>;
}

export function FilterToolbar({ children, resultLabel }: { children?: ReactNode; resultLabel?: ReactNode }) {
  return <div className="filter-toolbar"><div className="filter-toolbar-fields">{children}</div>{resultLabel && <span className="filter-toolbar-result">{resultLabel}</span>}</div>;
}

export function DetailSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return <section className="detail-section"><div className="detail-section-heading"><h2>{title}</h2>{description && <p>{description}</p>}</div>{children}</section>;
}

/** Compact contextual information that can be opened without hiding errors or workflow state. */
export function InfoNotice({ children, title = 'Overview' }: { children: ReactNode; title?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) && !popover.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const panel = popover.current;
      if (!anchor || !panel) return;
      const margin = 12;
      const left = Math.max(margin, Math.min(anchor.left, window.innerWidth - panel.offsetWidth - margin));
      const below = anchor.bottom + 8;
      const top = below + panel.offsetHeight <= window.innerHeight - margin
        ? below
        : Math.max(margin, anchor.top - panel.offsetHeight - 8);
      setPosition({ top, left });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, children]);

  return <span className="trise-info-notice" ref={root}>
    <button ref={trigger} type="button" className="trise-info-notice-trigger" aria-label="Show overview information" title="Show overview information" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}>
      <span aria-hidden="true">i</span>
    </button>
    {open && createPortal(<div ref={popover} className="trise-info-notice-popover" style={position} id={id} role="dialog" aria-label={title}>
      <span className="trise-info-notice-heading"><span className="trise-info-notice-mark" aria-hidden="true">i</span><strong>{title}</strong>
        <button type="button" className="trise-info-notice-close" aria-label="Close overview information" onClick={() => { setOpen(false); trigger.current?.focus(); }}>×</button>
      </span>
      <span className="trise-info-notice-content">{children}</span>
    </div>, document.body)}
  </span>;
}

export { TriseBrandHeader } from './brand-header';
