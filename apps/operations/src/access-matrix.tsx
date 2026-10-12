import type { AccessPermission } from './access-data';

export function AccessMatrix({ permissions, grants, onChange, custom = false, readOnly = false }: {
  permissions: AccessPermission[]; grants: Record<string, boolean>; onChange?: (value: Record<string, boolean>) => void; custom?: boolean; readOnly?: boolean;
}) {
  const modules = [...new Set(permissions.map(item => item.attributes.module))];
  const actions = [...new Set(permissions.map(item => item.attributes.action))];
  return <div className="platform-provider-table-wrap"><table className="platform-provider-table"><caption>Permission matrix</caption><thead><tr><th scope="col">Module</th>{actions.map(action => <th scope="col" key={action}>{action}</th>)}</tr></thead><tbody>{modules.map(module => <tr key={module}><th scope="row">{module}</th>{actions.map(action => {
    const permission = permissions.find(item => item.attributes.module === module && item.attributes.action === action);
    if (!permission) return <td key={action}>—</td>;
    const code = permission.attributes.code;
    const locked = permission.attributes.protected || (custom && !permission.attributes.delegable);
    return <td key={action}><label><input type="checkbox" aria-label={`${module}: ${action}`} checked={grants[code] === true} disabled={readOnly || locked} onChange={event => onChange?.({ ...grants, [code]: event.target.checked })} />{locked && <span aria-label="Platform protected" title="Platform controlled permission"> 🔒</span>}</label></td>;
  })}</tr>)}</tbody></table></div>;
}
