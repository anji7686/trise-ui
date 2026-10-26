import { test, expect } from './fixtures';
import { approvedLocalAccounts, paceLocalSignIn, localSignIn, localSignOut, configuredAccount } from './local-auth';
import { e2eApiV1Base } from './e2e-config';
import type { Page, TestInfo, APIResponse } from 'playwright/test';
import type { components } from '../../packages/api-client/src/generated';

async function screenshot(page: Page, info: TestInfo, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

async function command(page: Page, path: string, method: string, click: () => Promise<unknown>) {
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1${path}` && response.request().method() === method, { timeout: 10_000 });
  const [response] = await Promise.all([pending, click()]);
  expect(response.status()).toBeLessThan(300);
  return response.json();
}

async function selectProvider(page: Page, providerId: string) {
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const select = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true }).getByRole('combobox', { name: 'Provider', exact: true });
  await expect(select.locator(`option[value="${providerId}"]`)).toHaveCount(1);
  if (await select.inputValue() !== providerId) {
    const reloaded = page.waitForEvent('domcontentloaded');
    await select.selectOption(providerId);
    await reloaded;
  } else {
    await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  }
  await expect(page.getByRole('button', { name: 'Open account menu', exact: true })).toBeVisible();
  await page.getByRole('complementary', { name: 'Operations navigation', exact: true }).getByRole('button', { name: 'Teams & Roles', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Team & Access', exact: true })).toBeVisible();
  await expect(page.getByText('Loading members…', { exact: true })).toHaveCount(0);
}

// Never capture authentication bodies, traces, videos or secret-bearing failures.
test.use({ trace: 'off', video: 'off', screenshot: 'off', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('approved accounts expose only their existing access workspaces', async ({ page, evidence }, testInfo) => {
  test.skip(testInfo.project.name !== 'operations-desktop', 'Authority inventory is recorded once in Operations.');
  // Ten approved personas are intentionally paced below the development
  // sign-in limit; keep the authority inventory timeout above that bound.
  test.setTimeout(240_000);
  const accounts = approvedLocalAccounts();
  const observed: unknown[] = [];
  for (const [index, account] of accounts.entries()) {
    const { email, secret } = account;
    await page.goto('/');
    const emailControl = page.getByRole('combobox', { name: 'Test email', exact: true });
    const quickMode = await emailControl.evaluate((element) => element.tagName === 'SELECT');
    if (quickMode) {
      await emailControl.selectOption(email);
    } else {
      await emailControl.fill(email);
    }
    await paceLocalSignIn();
    if (!quickMode) await page.getByLabel('Local secret', { exact: true }).fill(secret);
    const signedIn = page.waitForResponse(response => {
      const pathname = new URL(response.url()).pathname;
      return ['/api/v1/session/development', '/api/v1/session/development/quick'].includes(pathname) && response.request().method() === 'POST';
    });
    await page.getByRole('button', { name: quickMode ? 'Sign in as selected account' : 'Sign in locally', exact: true }).click();
    const response = await signedIn;
    expect(response.status()).toBe(200);
    const { user } = await response.json();
    observed.push({ account: index + 1, displayName: user.attributes.display_name, platformCapabilities: user.attributes.platform_capabilities || [], providers: user.attributes.provider_capabilities || [] });
    const accountMenu = page.getByRole('button', { name: 'Open account menu', exact: true });
    if (!(await accountMenu.isVisible().catch(() => false))) {
      await expect(page.getByRole('heading', { name: 'This workspace is for authorized provider teams.', exact: true })).toBeVisible();
      await expect(page.getByRole('alert')).toContainText('Customer activity must use the customer portal');
      await page.getByRole('button', { name: 'Return to sign in', exact: true }).click();
      await expect(page.getByRole('combobox', { name: 'Test email', exact: true })).toBeVisible();
      continue;
    }
    await page.goto('/#/platform/roles');
    if (!(user.attributes.platform_capabilities || []).includes('PLATFORM_ACCESS_READ')) {
      await expect(page.getByRole('button', { name: 'New Default Role', exact: true })).toHaveCount(0);
    }
    await testInfo.attach(`account-${index + 1}-access-boundary`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Test email', exact: true })).toBeVisible();
  }
  await testInfo.attach('existing-access-authority', { body: JSON.stringify(observed, null, 2), contentType: 'application/json' });
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('restore the approved session delegation baseline after interrupted acceptance', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'operations-desktop' || process.env.TRISE_E2E_RESTORE_ACCESS_BASELINE !== 'true', 'Explicit cleanup for the approved 2026-10-12 session only.');
  const session = await localSignIn(page, configuredAccount('OPERATOR'));
  await page.goto('/#/platform/roles');
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Audit', exact: true }) });
  const disable = row.getByRole('button', { name: 'Delegated — disable', exact: true });
  await expect(row).toBeVisible();
  if (await disable.isVisible()) {
    const pending = page.waitForResponse(response => /\/platform\/access\/permissions\/[^/]+$/.test(new URL(response.url()).pathname) && response.request().method() === 'PATCH');
    await disable.click();
    expect((await pending).status()).toBe(200);
  }
  await expect(row.getByRole('button', { name: 'Not delegated — enable', exact: true })).toBeVisible();
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const cleanup: unknown[] = [];
  let cursor: string | null = null;
  do {
    const response: APIResponse = await page.request.get(`${e2eApiV1Base()}/platform/access/roles${cursor ? `?page[after]=${encodeURIComponent(cursor)}` : ''}`, { headers });
    expect(response.status()).toBe(200);
    const collection: components['schemas']['AccessRoleCollection'] = await response.json();
    for (const role of collection.data) {
      if (!/^Browser verification (?:default|other operation) operations-(?:desktop|tablet|mobile)-[0-9]{13}$/.test(role.attributes.name) || role.attributes.status !== 'active' || !role.attributes.enabled) continue;
      const disabled = await page.request.post(`${e2eApiV1Base()}/platform/access/roles/${role.id}/enabled`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { expected_revision: role.attributes.revision, enabled: false } });
      expect(disabled.status()).toBe(200);
      cleanup.push({ action: 'disable-session-verification-default', roleId: role.id, status: disabled.status() });
    }
    cursor = collection.page?.next || null;
  } while (cursor);
  await testInfo.attach('interrupted-run-cleanup', { body: JSON.stringify(cleanup, null, 2), contentType: 'application/json' });
  await page.reload();
  await expect(page.getByText('Loading roles…', { exact: true })).toHaveCount(0);
  await screenshot(page, testInfo, 'restored-delegation-baseline');
  await localSignOut(page);
});

test('platform publication and provider multiple-role workflows persist with audited cleanup', async ({ page, evidence }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('operations') || process.env.TRISE_E2E_ACCESS_WORKFLOWS !== 'true', 'Requires separately approved temporary local authority.');
  test.setTimeout(180_000);
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const defaultName = `Browser verification default ${suffix}`;
  const excludedName = `Browser verification other operation ${suffix}`;
  const customNames = [`Browser verification audit ${suffix}`, `Browser verification support ${suffix}`];
  const api = e2eApiV1Base();
  const providerSession = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const provider = providerSession.user.attributes.provider_capabilities.find((entry: { display_name: string; capabilities: string[] }) => entry.display_name.startsWith('Lift Rise Elevators') && entry.capabilities.includes('team_access'));
  expect(provider).toBeTruthy();
  const providerId: string = provider.provider_id;
  const providerHeaders = { Authorization: `Bearer ${providerSession.accessToken}`, 'X-TRISE-Provider-Id': providerId };
  const operationsResponse = await page.request.get(`${api}/providers/operations`, { headers: providerHeaders });
  expect(operationsResponse.status()).toBe(200);
  const operationRows = (await operationsResponse.json()).data;
  const operationId = operationRows.find((entry: { attributes: { status: string } }) => entry.attributes.status === 'ACTIVE')?.attributes.business_operation.id;
  await testInfo.attach('provider-operation-state', { body: JSON.stringify({ hasActiveOperation: Boolean(operationId) }), contentType: 'application/json' });
  await selectProvider(page, providerId);
  await screenshot(page, testInfo, 'provider-members-before');
  await localSignOut(page);

  const authorSession = await localSignIn(page, configuredAccount('OPERATOR'));
  expect(authorSession.user.attributes.platform_capabilities).toContain('PLATFORM_ACCESS_WRITE');
  const authorHeaders = { Authorization: `Bearer ${authorSession.accessToken}` };
  let originalDelegable: boolean | undefined;
  let permissionId = '';
  let memberId = '';
  let originalRoleIds: string[] | undefined;
  const customIds: string[] = [];
  const defaultIds: string[] = [];
  const cleanup: unknown[] = [];
  try {
    await page.goto('/#/platform/roles');
    await expect(page.getByRole('heading', { name: 'Roles & Permissions', exact: true })).toBeVisible();
    await expect(page.getByText('Loading roles…', { exact: true })).toHaveCount(0);
    await screenshot(page, testInfo, 'platform-role-table');
    const permissionResponse = await page.request.get(`${api}/platform/access/permissions`, { headers: authorHeaders });
    expect(permissionResponse.status()).toBe(200);
    const permission = (await permissionResponse.json()).data.find((entry: { attributes: { code: string } }) => entry.attributes.code === 'AUDIT_READ');
    permissionId = permission.id; originalDelegable = permission.attributes.delegable;
    if (!originalDelegable) {
      const auditRow = page.getByRole('row').filter({ hasText: 'Audit' });
      await command(page, `/platform/access/permissions/${permissionId}`, 'PATCH', () => auditRow.getByRole('button', { name: 'Not delegated — enable', exact: true }).click());
      await expect(auditRow.getByRole('button', { name: 'Delegated — disable', exact: true })).toBeVisible();
    }

    for (const [index, name] of [defaultName, excludedName].entries()) {
      const cataloguePending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/business-operations');
      await page.getByRole('button', { name: 'New Default Role', exact: true }).click();
      const catalogue = (await (await cataloguePending).json()).data;
      const dialog = page.getByRole('dialog', { name: 'Default Role Draft', exact: true });
      await dialog.getByRole('button', { name: 'Save Draft', exact: true }).click();
      expect(await dialog.getByRole('textbox', { name: 'Role Name', exact: true }).evaluate((node: HTMLInputElement) => node.validity.valueMissing)).toBe(true);
      await dialog.getByRole('textbox', { name: 'Role Name', exact: true }).fill(name);
      await dialog.getByRole('textbox', { name: 'Responsibilities', exact: true }).fill('Local browser acceptance evidence; no production use.');
      await dialog.getByRole('checkbox', { name: 'Audit: View', exact: true }).check();
      await expect(dialog.getByRole('checkbox', { name: 'Customers: Manage', exact: true })).toBeDisabled();
      if (index === 1) {
        await dialog.getByRole('checkbox', { name: 'All Business Operations', exact: true }).uncheck();
        const other = catalogue.find((entry: { id: string }) => entry.id !== operationId);
        expect(other).toBeTruthy();
        await dialog.getByRole('checkbox', { name: other.attributes.name, exact: true }).check();
      }
      await screenshot(page, testInfo, `default-editor-${index}`);
      const created = await command(page, '/platform/access/roles', 'POST', () => dialog.getByRole('button', { name: 'Save Draft', exact: true }).click());
      defaultIds.push(created.id);
      const row = page.getByRole('row').filter({ hasText: name });
      await command(page, `/platform/access/roles/${created.id}/reviews`, 'POST', () => row.getByRole('button', { name: 'Submit for review', exact: true }).click());
      await expect(row.getByRole('button', { name: 'Submit for review', exact: true })).toHaveCount(0);
    }
    await localSignOut(page);
    await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
    await page.goto('/#/platform/roles');
    for (const name of [defaultName, excludedName]) {
      const row = page.getByRole('row').filter({ hasText: name });
      const pending = page.waitForResponse(response => /\/reviews\/[^/]+\/approve$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST');
      await row.getByRole('button', { name: 'Approve review', exact: true }).click();
      expect((await pending).status()).toBe(200);
      await expect(row.getByRole('button', { name: 'Approve review', exact: true })).toHaveCount(0);
      await expect(row.getByRole('button', { name: 'Publish Changes', exact: true })).toHaveCount(0);
    }
    await screenshot(page, testInfo, 'independent-review');
    await localSignOut(page);
    await localSignIn(page, configuredAccount('OPERATOR'));
    await page.goto('/#/platform/roles');
    for (const [index, name] of [defaultName, excludedName].entries()) {
      const row = page.getByRole('row').filter({ hasText: name });
      await command(page, `/platform/access/roles/${defaultIds[index]}/publish`, 'POST', () => row.getByRole('button', { name: 'Publish Changes', exact: true }).click());
      await expect(row.getByRole('button', { name: 'New Version Draft', exact: true })).toBeVisible();
      await expect(row.getByRole('button', { name: 'Edit Role Draft', exact: true })).toHaveCount(0);
      await command(page, `/platform/access/roles/${defaultIds[index]}/enabled`, 'POST', () => row.getByRole('button', { name: 'Disable Role', exact: true }).click());
      await expect(row.getByRole('button', { name: 'Enable Role', exact: true })).toBeVisible();
      await command(page, `/platform/access/roles/${defaultIds[index]}/enabled`, 'POST', () => row.getByRole('button', { name: 'Enable Role', exact: true }).click());
      await expect(row.getByRole('button', { name: 'Disable Role', exact: true })).toBeVisible();
    }
    await screenshot(page, testInfo, 'published-defaults');
    await localSignOut(page);
    await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
    await selectProvider(page, providerId);
    const membersResponse = await page.request.get(`${api}/provider/access/members`, { headers: providerHeaders });
    expect(membersResponse.status()).toBe(200);
    const member = (await membersResponse.json()).data.find((entry: { attributes: { email: string } }) => entry.attributes.email === configuredAccount('OPERATOR'));
    expect(member).toBeTruthy(); memberId = member.id; originalRoleIds = member.attributes.roles.map((role: { id: string }) => role.id);
    await page.getByRole('navigation', { name: 'Team & Access tabs', exact: true }).getByRole('button', { name: 'Roles & Permissions', exact: true }).click();
    await expect(page.getByText('Loading roles…', { exact: true })).toHaveCount(0);
    const defaultRow = page.getByRole('row').filter({ hasText: defaultName });
    await expect(defaultRow).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: excludedName })).toHaveCount(0);
    await expect(defaultRow.getByRole('button', { name: 'Edit Role', exact: true })).toHaveCount(0);
    await defaultRow.getByRole('button', { name: 'View permissions', exact: true }).click();
    const readOnly = page.getByRole('dialog', { name: 'Role permissions', exact: true });
    await expect(readOnly.getByRole('textbox', { name: 'Role Name', exact: true })).toBeDisabled();
    await expect(readOnly.getByRole('checkbox', { name: 'Audit: View', exact: true })).toBeChecked();
    await expect(readOnly.getByRole('checkbox', { name: 'Audit: View', exact: true })).toBeDisabled();
    await screenshot(page, testInfo, 'default-read-only');
    await readOnly.getByRole('button', { name: 'Close', exact: true }).click();
    for (const name of customNames) {
      await page.getByRole('button', { name: 'New Custom Role', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'New Custom Role', exact: true });
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      expect(await dialog.getByRole('textbox', { name: 'Role Name', exact: true }).evaluate((node: HTMLInputElement) => node.validity.valueMissing)).toBe(true);
      await dialog.getByRole('textbox', { name: 'Role Name', exact: true }).fill(name);
      await dialog.getByRole('textbox', { name: 'Responsibilities', exact: true }).fill('Local acceptance verification; restore assignments and disable after testing.');
      await expect(dialog.getByRole('checkbox', { name: 'Customers: Manage', exact: true })).toBeDisabled();
      await dialog.getByRole('checkbox', { name: 'Audit: View', exact: true }).check();
      await screenshot(page, testInfo, 'custom-editor');
      const created = await command(page, '/provider/access/roles', 'POST', () => dialog.getByRole('button', { name: 'Save', exact: true }).click());
      customIds.push(created.id);
      await expect(page.getByRole('row').filter({ hasText: name })).toBeVisible();
    }
    const customRow = page.getByRole('row').filter({ hasText: customNames[0] });
    await customRow.getByRole('button', { name: 'Edit Role', exact: true }).click();
    await testInfo.attach('custom-editor-accessible-name', { body: JSON.stringify(await page.locator('dialog').evaluateAll(elements => elements.map(element => ({ labelledBy: element.getAttribute('aria-labelledby'), title: element.querySelector('h2')?.textContent, labelledText: document.getElementById(element.getAttribute('aria-labelledby') || '')?.textContent, open: element.hasAttribute('open') }))), null, 2), contentType: 'application/json' });
    const edit = page.getByRole('dialog', { name: 'Edit Custom Role', exact: true });
    await edit.getByRole('textbox', { name: 'Responsibilities', exact: true }).fill('Edited through the real provider UI for local acceptance.');
    await edit.getByRole('checkbox', { name: 'Audit: View', exact: true }).uncheck();
    await command(page, `/provider/access/roles/${customIds[0]}`, 'PATCH', () => edit.getByRole('button', { name: 'Save', exact: true }).click());
    await customRow.getByRole('button', { name: 'Edit Role', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('checkbox', { name: 'Audit: View', exact: true })).not.toBeChecked();
    await page.getByRole('dialog').getByRole('checkbox', { name: 'Audit: View', exact: true }).check();
    await command(page, `/provider/access/roles/${customIds[0]}`, 'PATCH', () => page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click());
    await page.getByRole('navigation', { name: 'Team & Access tabs', exact: true }).getByRole('button', { name: 'Members', exact: true }).click();
    const memberRow = page.getByRole('row').filter({ hasText: configuredAccount('OPERATOR') });
    await memberRow.getByRole('button', { name: 'Manage Roles', exact: true }).click();
    const picker = page.getByRole('region', { name: 'Assign roles', exact: true });
    for (const name of customNames) await picker.getByRole('checkbox', { name, exact: true }).check();
    await picker.getByRole('checkbox', { name: `${defaultName} · Platform default`, exact: true }).check();
    await screenshot(page, testInfo, 'multiple-role-picker');
    await command(page, `/provider/access/members/${memberId}/roles`, 'PUT', () => picker.getByRole('button', { name: 'Save assignments', exact: true }).click());
    for (const name of [...customNames, defaultName]) await expect(memberRow.getByText(name, { exact: true })).toBeVisible();
    await page.reload();
    for (const name of [...customNames, defaultName]) await expect(page.getByRole('row').filter({ hasText: configuredAccount('OPERATOR') }).getByText(name, { exact: true })).toBeVisible();
    await screenshot(page, testInfo, 'persisted-member-role-badges');
    await page.getByRole('navigation', { name: 'Team & Access tabs', exact: true }).getByRole('button', { name: 'Roles & Permissions', exact: true }).click();
    for (const [index, name] of customNames.entries()) {
      const row = page.getByRole('row').filter({ hasText: name });
      await command(page, `/provider/access/roles/${customIds[index]}/enabled`, 'POST', () => row.getByRole('button', { name: 'Disable', exact: true }).click());
      await expect(row.getByRole('button', { name: 'Enable', exact: true })).toBeVisible();
      await command(page, `/provider/access/roles/${customIds[index]}/enabled`, 'POST', () => row.getByRole('button', { name: 'Enable', exact: true }).click());
      await expect(row.getByRole('button', { name: 'Disable', exact: true })).toBeVisible();
    }
    await customRow.getByRole('button', { name: 'View assigned members', exact: true }).click();
    await expect(page.getByRole('dialog').getByText(configuredAccount('OPERATOR'), { exact: true })).toBeVisible();
    await screenshot(page, testInfo, 'assigned-member-read-only');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('navigation', { name: 'Team & Access tabs', exact: true }).getByRole('button', { name: 'Invitations', exact: true }).click();
    await expect(page.getByText('Loading invitations…', { exact: true })).toHaveCount(0);
    await screenshot(page, testInfo, 'existing-invitations');
    expect(evidence.exceptions).toEqual([]);
    expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
    expect(evidence.responses.filter(response => response.status >= 400 && response.path.startsWith('/api/v1/') && !(response.status === 401 && ['/api/v1/me', '/api/v1/session/refresh'].includes(response.path)))).toEqual([]);
    expect(evidence.failures.filter(failure => (failure as { path: string }).path.startsWith('/api/v1/'))).toEqual([]);
  } catch (cause) {
    await testInfo.attach('workflow-error', { body: cause instanceof Error ? cause.message : 'Workflow failed', contentType: 'text/plain' });
    throw cause;
  } finally {
    // Real authenticated API cleanup works even if a UI assertion interrupted the flow.
    if (memberId && originalRoleIds) {
      const current = await page.request.get(`${api}/provider/access/members/${memberId}`, { headers: providerHeaders });
      expect(current.status()).toBe(200);
      const member = await current.json();
      const restored = await page.request.put(`${api}/provider/access/members/${memberId}/roles`, { headers: { ...providerHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { expected_revision: member.attributes.revision, role_ids: originalRoleIds } });
      cleanup.push({ action: 'restore-original-member-roles', status: restored.status() });
      expect(restored.status()).toBe(200);
    }
    for (const id of customIds) {
      const current = await page.request.get(`${api}/provider/access/roles/${id}`, { headers: providerHeaders });
      const role = await current.json();
      const disabled = await page.request.post(`${api}/provider/access/roles/${id}/enabled`, { headers: { ...providerHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { expected_revision: role.attributes.revision, enabled: false } });
      cleanup.push({ action: 'disable-verification-custom-role', status: disabled.status() });
      expect(disabled.status()).toBe(200);
    }
    if (originalDelegable !== undefined) {
      const current = await page.request.get(`${api}/platform/access/permissions`, { headers: authorHeaders });
      const permission = (await current.json()).data.find((entry: { id: string }) => entry.id === permissionId);
      if (permission.attributes.delegable !== originalDelegable) {
        const restored = await page.request.patch(`${api}/platform/access/permissions/${permissionId}`, { headers: { ...authorHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { expected_revision: permission.attributes.revision, delegable: originalDelegable } });
        cleanup.push({ action: 'restore-original-delegation', status: restored.status() });
        expect(restored.status()).toBe(200);
      }
    }
    for (const id of defaultIds) {
      const current = await page.request.get(`${api}/platform/access/roles/${id}`, { headers: authorHeaders });
      const role = await current.json();
      if (role.attributes.status !== 'active') continue;
      const disabled = await page.request.post(`${api}/platform/access/roles/${id}/enabled`, { headers: { ...authorHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { expected_revision: role.attributes.revision, enabled: false } });
      cleanup.push({ action: 'disable-verification-default-role', status: disabled.status() });
      expect(disabled.status()).toBe(200);
    }
    await testInfo.attach('authorized-cleanup', { body: JSON.stringify(cleanup, null, 2), contentType: 'application/json' });
    if (await page.locator('dialog[open]').count()) await page.keyboard.press('Escape');
    if (await page.getByRole('button', { name: 'Open account menu', exact: true }).isVisible()) await localSignOut(page);
  }
});
