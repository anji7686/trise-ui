import { useState } from 'react';
import type { RequirementCatalogueOption } from './data';

type Props = {
  name: string;
  title: string;
  help: string;
  options: RequirementCatalogueOption[];
  defaultValue?: string[];
  value?: string[];
  onChange?: (value: string[]) => void;
};

export function RequirementMultiChoice({ name, title, help, options, defaultValue = [], value, onChange }: Props) {
  const controlled = Array.isArray(value) && Boolean(onChange);
  const [uncontrolledValue, setUncontrolledValue] = useState<string[]>(defaultValue);
  const selected = controlled ? value : uncontrolledValue;
  const updateSelection = (next: string[]) => {
    if (controlled) onChange?.(next);
    else setUncontrolledValue(next);
  };

  return <fieldset className="requirement-choice-fieldset">
    <legend>{title}</legend>
    <div className="requirement-choice-meta">
      <p className="requirement-choice-help">{help}</p>
      <span className="requirement-choice-count" aria-live="polite">{selected.length} selected</span>
      <button type="button" className="requirement-choice-clear" disabled={!selected.length} onClick={() => updateSelection([])}>Clear</button>
    </div>
    <div className="requirement-choice-grid">
      {options.map((option) => {
        const checked = selected.includes(option.code);
        return <label className="requirement-choice-card" key={option.code} data-option-code={option.code}>
          <input type="checkbox" name={name} value={option.code} checked={checked} onChange={(event) => updateSelection(event.target.checked ? [...selected, option.code] : selected.filter((item) => item !== option.code))} />
          <span className="requirement-choice-mark" aria-hidden="true">✓</span>
          <span className="requirement-choice-copy"><strong>{option.label}</strong></span>
        </label>;
      })}
    </div>
    {!options.length && <span className="requirement-choice-empty">No active options are configured.</span>}
  </fieldset>;
}
