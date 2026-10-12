import { apiClient } from '@trise/api-client';
import type { components } from '../../../packages/api-client/src/generated';

export type AccessRole = components['schemas']['AccessRole'];
export type AccessPermission = components['schemas']['AccessPermission'];
export type AccessMember = components['schemas']['AccessMember'];
export type DefaultRoleInput = components['schemas']['DefaultRoleCreate'];
export const accessData = {
  members: (providerId: string, after?: string | null, roleId?: string) => {
    const query = new URLSearchParams(); if (after) query.set('page[after]', after); if (roleId) query.set('roleId', roleId);
    return apiClient.request<components['schemas']['AccessMemberCollection']>(`/provider/access/members${query.size ? `?${query}` : ''}`, {}, { providerId });
  },
  replaceMemberRoles: (providerId: string, member: AccessMember, roleIds: string[], key: string) => command<AccessMember>(`/provider/access/members/${member.id}/roles`, 'PUT', { expected_revision: member.attributes.revision, role_ids: roleIds }, key, providerId),
  invitations: (providerId: string, after?: string | null) => apiClient.request<components['schemas']['ProviderAdminInvitationCollection']>(`/provider/access/invitations${after ? `?page[after]=${encodeURIComponent(after)}` : ''}`, {}, { providerId }),
  providerRoles: (providerId: string, after?: string | null) => apiClient.request<components['schemas']['AccessRoleCollection']>(`/provider/access/roles${after ? `?page[after]=${encodeURIComponent(after)}` : ''}`, {}, { providerId }),
  providerPermissions: (providerId: string) => apiClient.request<components['schemas']['AccessPermissionCollection']>('/provider/access/permissions', {}, { providerId }),
  createCustom: (providerId: string, input: components['schemas']['CustomRoleCreate'], key: string) => command<AccessRole>('/provider/access/roles', 'POST', input, key, providerId),
  updateCustom: (providerId: string, role: AccessRole, input: components['schemas']['CustomRoleCreate'], key: string) => command<AccessRole>(`/provider/access/roles/${role.id}`, 'PATCH', { ...input, expected_revision: role.attributes.revision }, key, providerId),
  setCustomEnabled: (providerId: string, role: AccessRole, key: string) => command<AccessRole>(`/provider/access/roles/${role.id}/enabled`, 'POST', { expected_revision: role.attributes.revision, enabled: !role.attributes.enabled }, key, providerId),
  platformRoles: (after?: string | null) => apiClient.request<components['schemas']['AccessRoleCollection']>(`/platform/access/roles${after ? `?page[after]=${encodeURIComponent(after)}` : ''}`),
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
