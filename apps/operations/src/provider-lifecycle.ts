export type ProviderLifecycleAction = 'activate' | 'restrict' | 'reactivate' | 'close';

export type LifecycleActionOption = {
  action: ProviderLifecycleAction;
  label: string;
  capability: 'PLATFORM_PROVIDER_ACTIVATE' | 'PLATFORM_PROVIDER_RESTRICT';
  danger?: boolean;
};

export function lifecycleActions(status: string): LifecycleActionOption[] {
  switch (status) {
    case 'PENDING':
    case 'PENDING_ACTIVATION':
      return [{ action: 'activate', label: 'Activate provider', capability: 'PLATFORM_PROVIDER_ACTIVATE' }];
    case 'ACTIVE':
      return [{ action: 'restrict', label: 'Restrict provider', capability: 'PLATFORM_PROVIDER_RESTRICT', danger: true }, { action: 'close', label: 'Close provider', capability: 'PLATFORM_PROVIDER_RESTRICT', danger: true }];
    case 'ON_HOLD':
      return [{ action: 'reactivate', label: 'Reactivate provider', capability: 'PLATFORM_PROVIDER_ACTIVATE' }, { action: 'close', label: 'Close provider', capability: 'PLATFORM_PROVIDER_RESTRICT', danger: true }];
    case 'SUSPENDED':
      return [{ action: 'reactivate', label: 'Reactivate provider', capability: 'PLATFORM_PROVIDER_ACTIVATE' }, { action: 'close', label: 'Close provider', capability: 'PLATFORM_PROVIDER_RESTRICT', danger: true }];
    default:
      return [];
  }
}

export function activationBlocker(verificationStatus?: string): string {
  return verificationStatus === 'VERIFIED' ? '' : 'Verify the current business profile before activation or reactivation.';
}
