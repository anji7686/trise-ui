import { apiClient } from '@trise/api-client';
import type { components } from '../../../packages/api-client/src/generated';

export type AccessRole = components['schemas']['AccessRole'];
export type AccessPermission = components['schemas']['AccessPermission'];
export type AccessMember = components['schemas']['AccessMember'];
export type EffectivePermissionPreview = components['schemas']['ProviderEffectivePermissionPreview']['data'];
export type RoleTemplateAdoptionPreview = components['schemas']['ProviderRoleTemplateAdoptionPreview']['data'];
export type DefaultRoleInput = components['schemas']['DefaultRoleCreate'];
export type ProviderCustomRolePolicy = components['schemas']['ProviderCustomRolePolicy'];
export type TeamInvitation = components['schemas']['ProviderTeamInvitation'];
export type AccessPageParams = { q?: string; status?: string; businessOperationId?: string; version?: string; sort?: string; limit?: number; after?: string; before?: string };
export type CustomPolicyPageParams = { q?: string; enabled?: string; status?: string; businessOperationId?: string; sort?: string; limit?: number; after?: string; before?: string };

function pageQuery(params: AccessPageParams | CustomPolicyPageParams) {
  const query = new URLSearchParams({ 'page[limit]': String(params.limit || 10) });
  if (params.q) query.set('q', params.q);
  if (params.status) query.set('filter[status]', params.status);
  if ('enabled' in params && params.enabled) query.set('filter[enabled]', params.enabled);
  if (params.businessOperationId) query.set('filter[business_operation_type_id]', params.businessOperationId);
  if ('version' in params && params.version) query.set('filter[version]', params.version);
  if (params.sort) query.set('sort', params.sort);
  if (params.after) query.set('page[after]', params.after);
  if (params.before) query.set('page[before]', params.before);
  return query;
}
export const accessData = {
  teamInvitations: (providerId: string, after?: string | null) => apiClient.request<components['schemas']['ProviderTeamInvitationCollection']>(`/provider/access/team-invitations${after ? `?page[after]=${encodeURIComponent(after)}` : ''}`, {}, { providerId }),
  createTeamInvitation: (providerId: string, input: components['schemas']['ProviderTeamInvitationCreate'], key: string) => command<TeamInvitation>('/provider/access/team-invitations', 'POST', input, key, providerId),
  revokeTeamInvitation: (providerId: string, invitation: TeamInvitation, key: string) => command<TeamInvitation>(`/provider/access/team-invitations/${invitation.id}/revoke`, 'POST', { expected_revision: invitation.attributes.revision }, key, providerId),
  myTeamInvitations: (after?: string | null) => apiClient.request<components['schemas']['ProviderTeamInvitationCollection']>(`/self/team-invitations${after ? `?page[after]=${encodeURIComponent(after)}` : ''}`),
  acceptTeamInvitation: (invitation: TeamInvitation, key: string) => command<TeamInvitation>(`/self/team-invitations/${invitation.id}/accept`, 'POST', { expected_revision: invitation.attributes.revision }, key),
  customRolePolicies: (params: CustomPolicyPageParams = {}) => apiClient.request<components['schemas']['ProviderCustomRolePolicyCollection']>(`/platform/access/custom-role-policies?${pageQuery(params)}`),
  setCustomRolePolicy: (policy: ProviderCustomRolePolicy, key: string) => command<ProviderCustomRolePolicy>(`/platform/access/custom-role-policies/${policy.id}`, 'POST', { expected_revision: policy.attributes.revision, enabled: !policy.attributes.enabled }, key),
  members: (providerId: string, after?: string | null, roleId?: string, filters: { q?: string; status?: string; limit?: number } = {}, before?: string | null) => {
    const query = new URLSearchParams({ 'page[limit]': String(filters.limit || 10) });
    if (after) query.set('page[after]', after);
    if (before) query.set('page[before]', before);
    if (roleId) query.set('roleId', roleId);
    if (filters.q) query.set('q', filters.q);
    if (filters.status) query.set('filter[status]', filters.status);
    return apiClient.request<components['schemas']['AccessMemberCollection']>(`/provider/access/members${query.size ? `?${query}` : ''}`, {}, { providerId });
  },
  effectivePermissions: (providerId: string, memberId: string) => apiClient.request<components['schemas']['ProviderEffectivePermissionPreview']>(`/provider/access/members/${encodeURIComponent(memberId)}/effective-permissions`, {}, { providerId }),
  selfEffectivePermissions: (providerId: string) => apiClient.request<components['schemas']['ProviderEffectivePermissionPreview']>('/provider/access/self/effective-permissions', {}, { providerId }),
  replaceMemberRoles: (providerId: string, member: AccessMember, roleIds: string[], key: string) => command<AccessMember>(`/provider/access/members/${member.id}/roles`, 'PUT', { expected_revision: member.attributes.revision, role_ids: roleIds }, key, providerId),
  transitionMember: (providerId: string, member: AccessMember, action: 'suspend' | 'restore', reason: string, key: string) => command<AccessMember>(`/provider/access/members/${member.id}/${action}`, 'POST', { expected_revision: member.attributes.revision, reason }, key, providerId),
  invitations: (providerId: string, after?: string | null) => apiClient.request<components['schemas']['ProviderAdminInvitationCollection']>(`/provider/access/invitations${after ? `?page[after]=${encodeURIComponent(after)}` : ''}`, {}, { providerId }),
  providerRoles: (providerId: string, after?: string | null, filters: { q?: string; enabled?: string; limit?: number } = {}, before?: string | null) => {
    const query = new URLSearchParams({ 'page[limit]': String(filters.limit || 10), sort: 'name,id' });
    if (after) query.set('page[after]', after);
    if (before) query.set('page[before]', before);
    if (filters.q) query.set('q', filters.q);
    if (filters.enabled) query.set('filter[enabled]', filters.enabled);
    return apiClient.request<components['schemas']['AccessRoleCollection']>(`/provider/access/roles?${query}`, {}, { providerId });
  },
  providerPermissions: (providerId: string) => apiClient.request<components['schemas']['AccessPermissionCollection']>('/provider/access/permissions', {}, { providerId }),
  previewRoleTemplateAdoption: (providerId: string, input: { template_role_id: string; provider_role_id?: string; expected_revision?: number }) => apiClient.request<components['schemas']['ProviderRoleTemplateAdoptionPreview']>('/provider/access/roles/templates/adoption-preview', { method: 'POST', body: JSON.stringify(input) }, { providerId }),
  adoptRoleTemplate: (providerId: string, input: { template_role_id: string; expected_template_version: number; provider_role_id?: string; expected_revision?: number }, key: string) => command<AccessRole>('/provider/access/roles/templates/adopt', 'POST', input, key, providerId),
  createCustom: (providerId: string, input: components['schemas']['CustomRoleCreate'], key: string) => command<AccessRole>('/provider/access/roles', 'POST', input, key, providerId),
  updateCustom: (providerId: string, role: AccessRole, input: components['schemas']['CustomRoleCreate'], key: string) => command<AccessRole>(`/provider/access/roles/${role.id}`, 'PATCH', { ...input, expected_revision: role.attributes.revision }, key, providerId),
  setCustomEnabled: (providerId: string, role: AccessRole, key: string) => command<AccessRole>(`/provider/access/roles/${role.id}/enabled`, 'POST', { expected_revision: role.attributes.revision, enabled: !role.attributes.enabled }, key, providerId),
  platformRoles: (params: AccessPageParams = {}) => apiClient.request<components['schemas']['AccessRoleCollection']>(`/platform/access/roles?${pageQuery(params)}`),
  platformPermissions: () => apiClient.request<components['schemas']['AccessPermissionCollection']>('/platform/access/permissions'),
  operations: () => apiClient.request<{ data: Array<{ id: string; attributes: { name: string } }> }>('/business-operations'),
  createDefault: (input: DefaultRoleInput, key: string) => command<AccessRole>('/platform/access/roles', 'POST', input, key),
  updateDefault: (role: AccessRole, input: DefaultRoleInput, key: string) => command<AccessRole>(`/platform/access/roles/${role.id}`, 'PATCH', { ...input, expected_revision: role.attributes.revision }, key),
  submitReview: (role: AccessRole, key: string) => command(`/platform/access/roles/${role.id}/reviews`, 'POST', { expected_revision: role.attributes.revision }, key),
  approveReview: (role: AccessRole, reviewId: string, key: string) => command(`/platform/access/roles/${role.id}/reviews/${reviewId}/approve`, 'POST', {}, key),
  publish: (role: AccessRole, reviewId: string, key: string) => command(`/platform/access/roles/${role.id}/publish`, 'POST', { expected_revision: role.attributes.revision, review_id: reviewId }, key),
  setDefaultEnabled: (role: AccessRole, key: string) => command<AccessRole>(`/platform/access/roles/${role.id}/enabled`, 'POST', { expected_revision: role.attributes.revision, enabled: !role.attributes.enabled }, key),
  delegate: (permission: AccessPermission, key: string) => command(`/platform/access/permissions/${permission.id}`, 'PATCH', { expected_revision: permission.attributes.revision, delegable: !permission.attributes.delegable }, key),
};

function command<T>(path: string, method: string, input: unknown, key: string, providerId?: string) {
  return apiClient.request<T>(path, { method, body: JSON.stringify(input), headers: { 'Idempotency-Key': key } }, { providerId });
}
