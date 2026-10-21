export type DashboardAction = {
  capability: string;
  label: string;
  description: string;
  route: string;
};

export type DashboardRole = {
  key: string;
  label: string;
  summary: string;
  scope: string;
};

export const dashboardActions: DashboardAction[] = [
  { capability: 'work_intake', label: 'Work intake', description: 'Coordinate new requests and incoming work.', route: 'work-intake' },
  { capability: 'sales_marketing', label: 'Leads & surveys', description: 'Qualify prospects and site survey opportunities.', route: 'leads' },
  { capability: 'quotations', label: 'Sales & quotations', description: 'Prepare, review and issue commercial revisions.', route: 'quotations' },
  { capability: 'requests', label: 'Service requests', description: 'Triage customer requests and escalations.', route: 'requests' },
  { capability: 'bookings', label: 'Appointments & dispatch', description: 'Schedule and coordinate field visits.', route: 'bookings' },
  { capability: 'jobs', label: 'Jobs & execution', description: 'Track assigned service work and completion.', route: 'jobs' },
  { capability: 'my_work', label: 'My work', description: 'Work assigned to the current actor.', route: 'jobs/my-work' },
  { capability: 'projects', label: 'Projects & delivery', description: 'Manage installation stages, billing and handover.', route: 'projects' },
  { capability: 'customers', label: 'Customers & assets', description: 'Maintain customer, site and elevator records.', route: 'customers' },
  { capability: 'amc', label: 'AMC & service programs', description: 'Manage coverage and renewal obligations.', route: 'amc' },
  { capability: 'workforce', label: 'Workforce', description: 'Review technician capacity and assignments.', route: 'workforce' },
  { capability: 'reports', label: 'Reports & analytics', description: 'Review authorized operational reporting.', route: 'reports' },
];

export function dashboardRoleFor(capabilities: string[]): DashboardRole {
  const available = new Set(capabilities);
  if (['team_access', 'business_profile', 'configuration', 'compliance'].some((capability) => available.has(capability))) {
    return { key: 'provider-administrator', label: 'Provider administrator', summary: 'Manage provider access, configuration and business operations.', scope: 'Provider-wide administration with operational oversight.' };
  }
  if (available.has('projects')) {
    return { key: 'project-delivery', label: 'Project delivery', summary: 'Coordinate installation progress, commercial stages and handover.', scope: 'Projects, stages, payments and linked delivery work.' };
  }
  if (available.has('sales_marketing') || available.has('quotations')) {
    return { key: 'sales-commercial', label: 'Sales & commercial', summary: 'Move prospects from intake through quotation and approval.', scope: 'Leads, surveys, customers and quotation revisions.' };
  }
  if (available.has('my_work') && !available.has('projects') && !available.has('sales_marketing') && !available.has('quotations') && !available.has('workforce')) {
    return { key: 'field-technician', label: 'Field technician', summary: 'Complete assigned work with service evidence and updates.', scope: 'Only work assigned to the current authorized actor.' };
  }
  if (available.has('bookings') || available.has('workforce')) {
    return { key: 'dispatch-coordination', label: 'Dispatch coordination', summary: 'Balance appointments, technician capacity and field execution.', scope: 'Appointments, dispatch, jobs and workforce availability.' };
  }
  if (available.has('amc')) {
    return { key: 'service-programs', label: 'Service programs', summary: 'Protect covered assets and keep maintenance renewals on track.', scope: 'AMC coverage, due work and renewal pipeline.' };
  }
  if (available.has('requests') || available.has('work_intake')) {
    return { key: 'service-operations', label: 'Service operations', summary: 'Triage incoming customer work and move it into execution.', scope: 'Requests, intake, jobs and service follow-up.' };
  }
  return { key: 'provider-operations', label: 'Provider operations', summary: 'Monitor the authorized provider workspace.', scope: 'Only capabilities granted for this provider are shown.' };
}

export function dashboardActionsFor(capabilities: string[]): DashboardAction[] {
  const available = new Set(capabilities);
  return dashboardActions.filter((action) => available.has(action.capability));
}
