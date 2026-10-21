import { test, expect } from './fixtures';
import { localSignIn, localSignOut, configuredAccount } from './local-auth';
import { e2eApiV1Base } from './e2e-config';

test.use({ trace: 'off', video: 'off', screenshot: 'off', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('Provider Team & Access exposes authorized role and invitation controls with scoped choices', async ({ page, evidence }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(60_000);
  async function capture(name: string) {
    const image = await page.screenshot({ fullPage: true, path: info.outputPath(`${name}.png`) });
    await info.attach(name, { body: image, contentType: 'image/png' });
  }
  const session = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const provider = session.user.attributes.provider_capabilities.find((entry: { display_name: string; capabilities: string[] }) =>
    entry.display_name.startsWith('Lift Rise Elevators') && entry.capabilities.includes('team_access'));
  expect(provider).toBeTruthy();
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const select = page.getByRole('dialog', { name: 'Account and workspace menu' }).getByRole('combobox', { name: 'Provider', exact: true });
  if (await select.inputValue() !== provider.provider_id) {
    await select.selectOption(provider.provider_id);
  }
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.goto(`${page.url().split('#')[0]}#team-access`);
  await expect(page.getByRole('heading', { name: 'Team & Access' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Member' })).toBeVisible();
  await expect(page.getByText('Provider Administrator · membership access').first()).toBeVisible();
  await expect(page.getByText('TRISE Platform Reviewer', { exact: true })).toHaveCount(0);
  await expect(page.getByText('TRISE Global Administrator', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Members per page', exact: true })).toHaveValue('10');
  await page.getByRole('textbox', { name: 'Search provider members', exact: true }).fill(configuredAccount('OPERATOR'));
  await page.getByRole('combobox', { name: 'Filter members by status', exact: true }).selectOption('active');
  const filteredMembersResponse = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/v1/provider/access/members' && url.searchParams.get('q') === configuredAccount('OPERATOR') && url.searchParams.get('filter[status]') === 'active';
  });
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  expect((await filteredMembersResponse).status()).toBe(200);
  await expect(page.getByRole('row').filter({ hasText: configuredAccount('OPERATOR') })).toHaveCount(1);
  const resetMembersResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/provider/access/members' && !new URL(response.url()).searchParams.has('q'));
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  expect((await resetMembersResponse).status()).toBe(200);
  const firstMember = page.getByRole('row').nth(1);
  const previewResponse = page.waitForResponse(response => response.url().includes('/provider/access/members/') && response.url().endsWith('/effective-permissions'));
  await firstMember.locator('summary[aria-label^="More actions for"]').click();
  await firstMember.getByRole('menuitem', { name: 'Preview effective access', exact: true }).click();
  const effectiveResponse = await previewResponse;
  const effectivePreview = page.getByRole('region', { name: 'Effective Access & Provider Isolation', exact: true });
  if (effectiveResponse.status() === 200) {
    await expect(effectivePreview.getByRole('table')).toBeVisible();
    await expect(effectivePreview.getByText(/not a final authorization decision/i)).toBeVisible();
    await expect(effectivePreview.getByRole('complementary', { name: 'Selected user and context' })).toBeVisible();
    await expect(effectivePreview.getByRole('region', { name: 'Effective permission decisions' })).toBeVisible();
    await expect(effectivePreview.getByRole('columnheader', { name: 'Effective grant', exact: true })).toBeVisible();
    expect(await effectivePreview.locator('tbody tr').count()).toBeGreaterThan(0);
  } else {
    expect(effectiveResponse.status()).toBe(403);
    await expect(effectivePreview.getByRole('alert')).toContainText('requested operation is not permitted');
  }
  await capture('provider-team-access-effective-preview');
  await effectivePreview.getByRole('button', { name: 'Back to members', exact: true }).click();
  await capture('provider-team-access-members');
  await page.getByRole('button', { name: 'Roles & Permissions' }).click();
  await expect(page.getByText('Loading roles…')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Roles & Permissions', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Role directory', exact: true })).toBeVisible();
  await expect(page.getByText(/They are not Platform Administration team members/)).toBeVisible();
  await expect(page.getByText(/Creating and editing Provider roles is currently disabled/)).toBeVisible();
  const roleWorkspace = page.getByRole('region', { name: 'Provider roles', exact: true });
  const roleRows = roleWorkspace.locator('.provider-role-table tbody tr');
  await expect(roleRows.first()).toBeVisible();
  const rolesPerPage = roleWorkspace.getByRole('combobox', { name: 'Provider roles per page', exact: true });
  await expect(rolesPerPage).toHaveValue('10');
  const twentyPerPageResponse = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/v1/provider/access/roles' && url.searchParams.get('page[limit]') === '20';
  });
  await rolesPerPage.selectOption('20');
  expect((await twentyPerPageResponse).status()).toBe(200);
  await expect(rolesPerPage).toHaveValue('20');
  const tenPerPageResponse = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/v1/provider/access/roles' && url.searchParams.get('page[limit]') === '10';
  });
  await rolesPerPage.selectOption('10');
  expect((await tenPerPageResponse).status()).toBe(200);
  const nextRolesResponse = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/v1/provider/access/roles' && url.searchParams.has('page[after]');
  });
  await roleWorkspace.getByRole('button', { name: 'Next', exact: true }).click();
  expect((await nextRolesResponse).status()).toBe(200);
  await expect(roleWorkspace.getByText(/roles on page 2/i)).toBeVisible();
  await roleWorkspace.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(roleWorkspace.getByText(/roles on page 1/i)).toBeVisible();
  const names = await roleRows.locator('td:first-child strong').allTextContents();
  expect(new Set(names.map(name => name.trim())).size).toBe(names.length);
  await roleWorkspace.getByRole('button', { name: /^System templates/ }).click();
  await expect(roleRows.first().locator('td[data-label="Type"]')).toHaveText('System template');
  await roleWorkspace.getByRole('button', { name: /^All roles/ }).click();
  await expect(roleWorkspace.getByRole('button', { name: 'Create Provider role', exact: true })).toHaveCount(0);
  await expect(page.getByText(/Browser verification default operations-/)).toHaveCount(0);
  await expect(page.getByText(/Browser verification support operations-/)).toHaveCount(0);
  await capture('provider-team-access-roles-permissions');
  await roleRows.first().locator('summary[aria-label^="More actions for"]').click();
  await roleWorkspace.getByRole('menuitem', { name: 'View permissions', exact: true }).click();
  const readOnlyRole = page.getByRole('dialog').filter({ has: page.getByRole('region', { name: 'Feature-level permission matrix', exact: true }) });
  await expect(readOnlyRole).toBeVisible();
  await expect(readOnlyRole.getByRole('searchbox', { name: 'Search permissions', exact: true })).toBeVisible();
  await expect(readOnlyRole.getByRole('checkbox').first()).toBeDisabled();
  await capture('provider-role-permissions-read-only');
  await readOnlyRole.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Members', exact: true }).click();
  const operatorRow = page.getByRole('row').filter({ hasText: configuredAccount('OPERATOR') });
  const assignmentRoleResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/provider/access/roles');
  const assignmentPreviewResponse = page.waitForResponse(response => /\/api\/v1\/provider\/access\/members\/[^/]+\/effective-permissions$/.test(new URL(response.url()).pathname));
  await operatorRow.locator('summary[aria-label^="More actions for"]').click();
  await operatorRow.getByRole('menuitem', { name: 'Manage roles', exact: true }).click();
  expect((await assignmentRoleResponse).status()).toBe(200);
  expect((await assignmentPreviewResponse).status()).toBe(200);
  const assignmentDrawer = page.getByRole('region', { name: 'Assign roles', exact: true });
  await expect(assignmentDrawer).toHaveClass(/member-assignment-panel/);
  await expect(assignmentDrawer.getByText(/Current Provider:/)).toBeVisible();
  await expect(assignmentDrawer.getByRole('region', { name: 'Current effective access', exact: true })).toContainText('Saved roles only');
  await expect(assignmentDrawer.getByText('Loading current effective access…', { exact: true })).toHaveCount(0);
  await expect(assignmentDrawer.getByText('Loading available roles…')).toHaveCount(0);
  await expect(assignmentDrawer.locator('.access-role-choice-meta').first()).toContainText(/(?:Platform default|Provider custom) · v\d+ · \d+ permissions?/);
  await expect(assignmentDrawer.getByRole('button', { name: 'Save assignments', exact: true })).toBeVisible();
  await expect(page.locator('.provider-members-table td[data-label="Member Name"]').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const narrowAssignmentView = (info.project.use.viewport?.width ?? 1440) <= 1100;
  let drawerScreenshot: Buffer;
  if (narrowAssignmentView) {
    await assignmentDrawer.evaluate(element => { element.scrollTop = 0; });
    drawerScreenshot = await assignmentDrawer.screenshot({ path: info.outputPath('provider-role-assignment-drawer.png') });
  } else {
    await page.evaluate(() => window.scrollTo(0, 0));
    drawerScreenshot = await page.screenshot({ path: info.outputPath('provider-role-assignment-drawer.png') });
  }
  await info.attach('provider-role-assignment-drawer', { body: drawerScreenshot, contentType: 'image/png' });
  await assignmentDrawer.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Add Member' }).click();
  const inviteDialog = page.getByRole('dialog', { name: 'Add Member' });
  await expect(inviteDialog).toBeVisible();
  await expect(page.getByText('Loading available roles…')).toHaveCount(0);
  await expect(inviteDialog.getByRole('alert')).toHaveCount(0);
  expect(await inviteDialog.getByRole('checkbox').count()).toBeGreaterThan(0);
  await expect(inviteDialog.locator('.access-role-choice-meta').first()).toContainText(/(?:Platform default|Provider custom) · v\d+ · \d+ permissions?/);
  await expect(page.getByRole('button', { name: 'Create Invitation' })).toBeDisabled();
  await capture('provider-team-access-add-member');
  await inviteDialog.getByRole('button', { name: 'Cancel' }).click();
  const roleAccessResponses = evidence.responses.filter(response => response.path === '/api/v1/provider/access/roles');
  expect(roleAccessResponses.some(response => response.status === 200)).toBe(true);
  await page.getByRole('button', { name: 'Invitations', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Team invitations' })).toBeVisible();
  await info.attach('invitations', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  const accessAuditResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/audit-events');
  await page.getByRole('navigation', { name: 'Team access views' }).getByRole('button', { name: 'Audit Logs', exact: true }).click();
  expect((await accessAuditResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Roles & Access audit log', exact: true })).toBeVisible();
  await expect(page.getByText(/limited by the server to role and Provider membership audit records/i)).toBeVisible();
  await capture('provider-roles-access-audit');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await localSignOut(page);
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(row => row.status >= 500)).toEqual([]);
});

test('provider admin suspension removes operational access and restoration returns it', async ({ page, browser, evidence }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);
  const admin = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const api = e2eApiV1Base();
  const operations = admin.user.attributes.provider_capabilities.find((entry: { provider_id: string; display_name: string; capabilities: string[] }) =>
    entry.display_name.startsWith('Lift Rise Elevators') && entry.capabilities.includes('team_access'));
  expect(operations).toBeTruthy();
  const providerId = operations!.provider_id;
  const adminHeaders = { Authorization: `Bearer ${admin.accessToken}`, 'X-TRISE-Provider-Id': providerId };
  const members = await page.request.get(`${api}/provider/access/members`, { headers: adminHeaders });
  expect(members.status()).toBe(200);
  const member = (await members.json()).data.find((row: { attributes: { email?: string; status: string } }) => row.attributes.email === configuredAccount('OPERATOR'));
  expect(member).toBeTruthy();

  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const providerSelect = page.getByRole('dialog', { name: 'Account and workspace menu' }).getByRole('combobox', { name: 'Provider', exact: true });
  if (await providerSelect.inputValue() !== providerId) {
    await providerSelect.selectOption(providerId);
    await page.waitForLoadState('domcontentloaded');
  } else {
    await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  }
  await page.goto(`${page.url().split('#')[0]}#team-access`);
  await expect(page.getByRole('heading', { name: 'Team & Access' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: configuredAccount('OPERATOR') });
  await expect(row).toBeVisible();
  await row.locator('summary[aria-label^="More actions for"]').click();
  await row.getByRole('menuitem', { name: 'Suspend access', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Suspend Provider Access' });
  await dialog.getByRole('textbox', { name: 'Reason', exact: true }).fill('Browser authorization verification');
  const suspended = page.waitForResponse(response => response.url().endsWith(`/provider/access/members/${member.id}/suspend`) && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Confirm Suspension', exact: true }).click();
  expect((await suspended).status()).toBe(200);
  await expect(row.getByText('suspended', { exact: true })).toBeVisible();

  const operatorContext = await browser.newContext({ baseURL: process.env.TRISE_E2E_OPERATIONS_URL || 'http://127.0.0.1:4174' });
  const operatorPage = await operatorContext.newPage();
  try {
    const operator = await localSignIn(operatorPage, configuredAccount('OPERATOR'));
    const denied = await operatorPage.request.get(`${api}/service-jobs`, { headers: { Authorization: `Bearer ${operator.accessToken}`, 'X-TRISE-Provider-Id': providerId } });
    expect(denied.status()).toBe(403);
    const deniedPreview = await operatorPage.request.get(`${api}/provider/access/members/${member.id}/effective-permissions`, { headers: { Authorization: `Bearer ${operator.accessToken}`, 'X-TRISE-Provider-Id': providerId } });
    expect(deniedPreview.status()).toBe(403);
    await operatorPage.goto(`${operatorPage.url().split('#')[0]}#team-access`);
    await expect(operatorPage.getByText(/Choose a provider to load authorized records/i)).toBeVisible();
    const deniedScreenshot = await operatorPage.screenshot({ fullPage: true, path: info.outputPath('provider-effective-access-denied.png') });
    await info.attach('provider-effective-access-denied', { body: deniedScreenshot, contentType: 'image/png' });
  } finally {
    await operatorContext.close();
    const current = await page.request.get(`${api}/provider/access/members/${member.id}`, { headers: adminHeaders });
    expect(current.status()).toBe(200);
    const currentMember = await current.json();
    const restored = await page.request.post(`${api}/provider/access/members/${member.id}/restore`, { headers: { ...adminHeaders, 'Idempotency-Key': `browser-restore-${Date.now()}` }, data: { expected_revision: currentMember.attributes.revision, reason: 'Browser authorization verification cleanup' } });
    expect(restored.status()).toBe(200);
  }

  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: configuredAccount('OPERATOR') }).getByText('active', { exact: true })).toBeVisible();
  await localSignOut(page);
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(row => row.status >= 500)).toEqual([]);
});

test('authorized Provider Administrator can review scoped audit history and filters', async ({ page, evidence }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(60_000);
  const session = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const provider = session.user.attributes.provider_capabilities.find((entry: { provider_id: string; display_name: string; capabilities: string[] }) =>
    entry.display_name.startsWith('Lift Rise Elevators') && entry.capabilities.includes('audit'));
  expect(provider).toBeTruthy();
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const selector = page.getByRole('dialog', { name: 'Account and workspace menu' }).getByRole('combobox', { name: 'Provider', exact: true });
  if (await selector.inputValue() !== provider!.provider_id) await selector.selectOption(provider!.provider_id);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.goto(`${page.url().split('#')[0]}#audit`);
  await expect(page.getByRole('heading', { name: 'Audit Logs', exact: true })).toBeVisible();
  await expect(page.getByText(/Loading audit history…/)).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  const screenshot = await page.screenshot({ fullPage: true, path: info.outputPath('provider-audit-history.png') });
  await info.attach('provider-audit-history', { body: screenshot, contentType: 'image/png' });
  await page.getByRole('textbox', { name: 'Filter audit by action' }).fill('ROLE_UPDATED');
  const filtered = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/audit-events'));
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  expect((await filtered).status()).toBe(200);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await localSignOut(page);
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});
