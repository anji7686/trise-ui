import { useEffect, useMemo, useRef, useState } from 'react';
import type { AccessPermission } from './access-data';

type Props = { permissions: AccessPermission[]; grants: Record<string, boolean>; onChange?: (value: Record<string, boolean>) => void; custom?: boolean; readOnly?: boolean; lockProtected?: boolean; title?: string };

function MixedCheckbox({ checked, indeterminate, disabled, label, onChange }: { checked: boolean; indeterminate: boolean; disabled: boolean; label: string; onChange: (checked: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} disabled={disabled} aria-label={label} onChange={(event) => onChange(event.target.checked)} />;
}

export function AccessMatrix({ permissions, grants, onChange, custom = false, readOnly = false, lockProtected = false, title = 'Permission hierarchy' }: Props) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const categories = useMemo(() => {
    const grouped = new Map<string, Map<string, AccessPermission[]>>();
    permissions.forEach((permission) => { const category = permission.attributes.category || 'Permissions'; const modules = grouped.get(category) || new Map<string, AccessPermission[]>(); modules.set(permission.attributes.module, [...(modules.get(permission.attributes.module) || []), permission]); grouped.set(category, modules); });
    return [...grouped.entries()].map(([category, modules]) => ({ category, modules: [...modules.entries()].map(([module, items]) => ({ module, items })) }));
  }, [permissions]);
  const matches = (permission: AccessPermission) => !search.trim() || [permission.attributes.module, permission.attributes.action, permission.attributes.description, permission.attributes.code].some((value) => value.toLowerCase().includes(search.trim().toLowerCase()));
  const locked = (permission: AccessPermission) => readOnly || (custom && !permission.attributes.delegable) || (lockProtected && permission.attributes.protected);
  const setMany = (items: AccessPermission[], checked: boolean) => { const next = { ...grants }; items.filter((permission) => !locked(permission)).forEach((permission) => { next[permission.attributes.code] = checked; }); onChange?.(next); };
  const state = (items: AccessPermission[]) => { const editable = items.filter((permission) => !locked(permission)); const selected = editable.filter((permission) => grants[permission.attributes.code] === true).length; return { checked: editable.length > 0 && selected === editable.length, indeterminate: selected > 0 && selected < editable.length, disabled: editable.length === 0 }; };
  const toggle = (key: string) => setCollapsed((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const allKeys = categories.flatMap(({ category, modules }) => [ `category:${category}`, ...modules.map(({ module }) => `${category}:${module}`) ]);
  const anyMatches = categories.some(({ modules }) => modules.flatMap((module) => module.items).some(matches));

  return <section className="permission-tree" aria-label={title}><header className="permission-tree-header"><div><h3>{title}</h3><p>Group selection applies to every eligible permission in that group, including matches hidden by search.</p></div><div className="permission-tree-tools"><label>Search permissions<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Module, action or description" /></label><button type="button" onClick={() => setCollapsed(new Set())}>Expand all</button><button type="button" onClick={() => setCollapsed(new Set(allKeys))}>Collapse all</button></div></header>
    {categories.map(({ category, modules }) => { const allItems = modules.flatMap((module) => module.items); if (!allItems.some(matches)) return null; const categoryState = state(allItems); const categoryKey = `category:${category}`; const categoryCollapsed = collapsed.has(categoryKey); return <section className="permission-category" key={category}><div className="permission-group-heading"><button type="button" className="permission-expand" aria-expanded={!categoryCollapsed} onClick={() => toggle(categoryKey)}>{categoryCollapsed ? '▸' : '▾'}</button><MixedCheckbox {...categoryState} label={`Select all eligible permissions in ${category}`} onChange={(checked) => setMany(allItems, checked)} /><strong>{category}</strong><span>{allItems.filter((item) => grants[item.attributes.code]).length} / {allItems.length}</span></div>
      {!categoryCollapsed && modules.map(({ module, items }) => { if (!items.some(matches)) return null; const moduleState = state(items); const moduleKey = `${category}:${module}`; const moduleCollapsed = collapsed.has(moduleKey); return <div className="permission-module" key={moduleKey}><div className="permission-module-heading"><button type="button" className="permission-expand" aria-expanded={!moduleCollapsed} onClick={() => toggle(moduleKey)}>{moduleCollapsed ? '▸' : '▾'}</button><MixedCheckbox {...moduleState} label={`Select all eligible ${module} permissions`} onChange={(checked) => setMany(items, checked)} /><strong>{module}</strong><span>{items.filter((item) => grants[item.attributes.code]).length} / {items.length}</span></div>
        {!moduleCollapsed && <div className="permission-actions">{items.filter(matches).map((permission) => { const code = permission.attributes.code; const isLocked = locked(permission); return <label key={code} className={`permission-action${isLocked ? ' locked' : ''}`}><input type="checkbox" aria-label={`${module}: ${permission.attributes.action}`} checked={grants[code] === true} disabled={isLocked} onChange={(event) => onChange?.({ ...grants, [code]: event.target.checked })} /><span><strong>{permission.attributes.action}</strong><small>{permission.attributes.description}</small><code>{code}</code></span>{permission.attributes.protected && <span className="permission-lock" title="Platform protected permission">Protected</span>}</label>; })}</div>}</div>; })}
    </section>; })}
    {!anyMatches && <p className="permission-empty">No permissions match this search.</p>}
  </section>;
}
