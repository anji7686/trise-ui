import { useEffect, useId, useRef, useState } from 'react';

export type LookupOption = { id: string; label: string; detail?: string };
export function sortedSearchOptions(options: LookupOption[], search: string) {
  const query = search.trim().toLocaleLowerCase();
  return options.filter(option => query.length < 3 || `${option.label} ${option.detail || ''}`.toLocaleLowerCase().includes(query)).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }) || a.id.localeCompare(b.id));
}

export function SearchableSelect({ label, searchLabel, search, onSearch, value, onChange, options, placeholder = 'Select an option', required = true, disabled = false }: { label: string; searchLabel: string; search: string; onSearch: (value: string) => void; value: string; onChange: (value: string) => void; options: LookupOption[]; placeholder?: string; required?: boolean; disabled?: boolean }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [selection, setSelection] = useState<LookupOption | null>(null);
  const selected = options.find(option => option.id === value) || (selection?.id === value ? selection : null);
  const results = sortedSearchOptions(options, search);
  const text = (option: LookupOption) => `${option.label}${option.detail ? ` · ${option.detail}` : ''}`;
  const display = selected ? text(selected) : search;
  useEffect(() => {
    const outside = (event: Event) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); };
  }, []);
  function select(option: LookupOption) { setSelection(option); onChange(option.id); setOpen(false); input.current?.focus(); }
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));
  return <div ref={root} className="subscription-combobox">
    <label htmlFor={id}>{label}</label>
    <div className="search-select-control"><input ref={input} id={id} type="text" disabled={disabled} required={required} value={display} pattern={selected ? undefined : '(?!)'} title={placeholder} placeholder={searchLabel} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && results.length ? `${id}-option-${activeIndex}` : undefined} aria-describedby={`${id}-hint`} onClick={() => setOpen(true)} onFocus={() => setOpen(true)} onChange={event => { onChange(''); onSearch(event.target.value); setActive(0); setOpen(true); }} onKeyDown={event => {
      if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(index => Math.max(0, Math.min(results.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))); }
      if (event.key === 'Enter' && open) { event.preventDefault(); if (results[activeIndex]) select(results[activeIndex]); }
      if (event.key === 'Tab') setOpen(false);
    }} /><button type="button" className="search-select-toggle" disabled={disabled} aria-label={`Search ${label.toLowerCase()}`} onClick={() => { onChange(''); onSearch(''); setOpen(true); input.current?.focus(); }}>⌄</button></div>
    <small id={`${id}-hint`}>{selected ? 'Selected record' : search.trim().length < 3 ? 'Available options · type 3 characters to filter.' : 'Matching options'}</small>
    {open && <div className="search-select-results" id={`${id}-list`} role="listbox" aria-label={`${label} results`}>{results.length ? results.map((option, index) => <button type="button" role="option" aria-selected={option.id === value} id={`${id}-option-${index}`} className={index === activeIndex ? 'highlighted' : ''} key={option.id} onPointerDown={event => event.preventDefault()} onClick={() => select(option)}><strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}</button>) : <p>No matching records in the loaded results.</p>}</div>}
  </div>;
}
