import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccessMatrix } from './access-matrix';
import type { AccessPermission } from './access-data';

function permission(code: string, module: string, action: string, protectedPermission = false, delegable = true): AccessPermission {
  return { id: code, type: 'permission-definitions', attributes: { code, category: 'Governance', module, action, description: `${action} ${module}`, protected: protectedPermission, delegable, revision: 1 } };
}
describe('access permission matrix', () => {
  it('shows only applicable module actions and preserves checked grants', () => {
    const html = renderToStaticMarkup(<AccessMatrix permissions={[permission('AUDIT_READ', 'Audit', 'View'), permission('ASSET_SHARE_MANAGE', 'Assets', 'Share')]} grants={{ AUDIT_READ: true }} />);
    expect(html).toContain('aria-label="Audit: View"'); expect(html).toContain('checked=""');
    expect(html).not.toContain('aria-label="Audit: Share"'); expect(html).toContain('Governance');
  });
  it('locks protected and nondelegable actions for provider custom roles', () => {
    const html = renderToStaticMarkup(<AccessMatrix custom permissions={[permission('CUSTOMER_ADMIN', 'Customers', 'Manage', true, false), permission('AUDIT_READ', 'Audit', 'View', false, false)]} grants={{}} />);
    expect(html.match(/class="permission-action locked"/g)).toHaveLength(2); expect(html).toContain('Protected');
  });
  it('renders a read-only access summary', () => {
    const html = renderToStaticMarkup(<AccessMatrix readOnly permissions={[permission('AUDIT_READ', 'Audit', 'View')]} grants={{ AUDIT_READ: true }} />);
    expect(html).toContain('disabled=""'); expect(html).toContain('checked=""');
  });
});
