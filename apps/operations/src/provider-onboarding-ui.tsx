import { useEffect } from 'react';
import { Button } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { onboardingStateLabel, type OnboardingState } from './provider-detail-model';
import { providerOnboardingRoute } from './platform-provider-routing';

let unsavedOnboardingChanges = false;
export function confirmOnboardingNavigation() { return !unsavedOnboardingChanges || window.confirm('You have unsaved onboarding changes. Leave this step and discard them?'); }

export const onboardingStepLabels = ['Provider Identity', 'Business Profile', 'Contacts & Locations', 'Documents', 'Plan & Approval', 'Review & Activate'];

const stepCapability: Array<(capabilities: string[]) => boolean> = [
  (items) => items.includes('PLATFORM_PROVIDER_REGISTER'),
  (items) => items.includes('PLATFORM_PROVIDER_PROFILE_WRITE') || items.includes('PLATFORM_PROVIDER_BUSINESS_WRITE'),
  (items) => items.includes('PLATFORM_PROVIDER_REGISTER') || items.includes('PLATFORM_PROVIDER_PROFILE_WRITE') || items.includes('PLATFORM_PROVIDER_BUSINESS_WRITE') || items.includes('PLATFORM_PROVIDER_ONBOARD'),
  (items) => items.includes('PLATFORM_PROVIDER_DOCUMENTS'),
  (items) => items.includes('PLATFORM_PLAN_READ') && items.includes('PLATFORM_SUBSCRIPTION_READ'),
  (items) => items.includes('PLATFORM_PROVIDER_READ'),
];

export function ProviderOnboardingStepper({ current, providerId, states, capabilities }: { current: number; providerId: string; states?: OnboardingState[]; capabilities: string[] }) {
  return <nav className="provider-onboarding-stepper" aria-label="Provider onboarding progress"><ol>{onboardingStepLabels.map((label, index) => {
    const route = providerOnboardingRoute(providerId, index);
    const state = states?.[index] || (index === current ? 'in_progress' : 'not_available');
    const canNavigate = Boolean(route) && stepCapability[index](capabilities);
    const isCurrent = index === current;
    return <li key={label} className={`provider-step-item${isCurrent ? ' is-current' : ''}${state === 'complete' ? ' is-complete' : ''}`}>
      <Button type="button" variant="quiet" className="provider-step-link" aria-current={isCurrent ? 'step' : undefined} aria-disabled={!canNavigate || isCurrent} disabled={!canNavigate || isCurrent} onClick={() => { if (route && canNavigate && confirmOnboardingNavigation()) window.location.hash = route; }}>
        <span className="provider-step-number" aria-hidden="true">{state === 'complete' ? '✓' : index + 1}</span>
        <span className="provider-step-copy"><strong>{label}</strong><small>{isCurrent ? 'Current step' : onboardingStateLabel(state)}</small></span>
      </Button>
    </li>;
  })}</ol></nav>;
}

export function OnboardingSectionHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return <header className="onboarding-section-header"><div>{eyebrow && <p className="platform-eyebrow">{eyebrow}</p>}<h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div className="onboarding-context-actions">{actions}</div>}</header>;
}

export function OnboardingFormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="onboarding-form-section"><header><h2>{title}</h2>{description && <p>{description}</p>}</header><div className="onboarding-form-section-body">{children}</div></section>;
}

export function OnboardingEmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <section className="onboarding-empty-state"><span className="onboarding-empty-icon" aria-hidden="true">＋</span><div><h3>{title}</h3><p>{description}</p>{action && <div className="onboarding-empty-actions">{action}</div>}</div></section>;
}

export function OnboardingErrorSummary({ title = 'Review the highlighted information', errors }: { title?: string; errors: string[] }) {
  const unique = [...new Set(errors.filter(Boolean))];
  if (!unique.length) return null;
  return <section className="onboarding-error-summary" role="alert" aria-live="assertive"><strong>{title}</strong><ul>{unique.map((message) => <li key={message}>{message}</li>)}</ul></section>;
}

export function OnboardingReviewSection({ id, title, status, summary, href, canOpen = true, children }: { id: string; title: string; status: string; summary: string; href: string; canOpen?: boolean; children: React.ReactNode }) {
  return <details className="onboarding-review-section" id={id}><summary><span><strong>{title}</strong><small>{summary}</small></span><Status>{status}</Status><span className="onboarding-review-chevron" aria-hidden="true">⌄</span></summary><div className="onboarding-review-content">{children}{canOpen && <Button variant="quiet" onClick={() => { window.location.hash = href; }}>Open this section</Button>}</div></details>;
}

export function useOnboardingUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    unsavedOnboardingChanges = isDirty;
    if (!isDirty) return () => { unsavedOnboardingChanges = false; };
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { unsavedOnboardingChanges = false; window.removeEventListener('beforeunload', beforeUnload); };
  }, [isDirty]);
}
