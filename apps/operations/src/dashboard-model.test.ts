import { describe, expect, it } from 'vitest';
import { dashboardActionsFor, dashboardRoleFor } from './dashboard-model';

describe('provider dashboard role model', () => {
  it('derives an administrator scope from provider settings capabilities', () => {
    expect(dashboardRoleFor(['requests', 'team_access']).key).toBe('provider-administrator');
  });

  it('keeps quick actions limited to granted capabilities', () => {
    expect(dashboardActionsFor(['requests', 'jobs']).map((action) => action.route)).toEqual(['requests', 'jobs']);
  });

  it('identifies the actor-specific field workspace', () => {
    expect(dashboardRoleFor(['my_work']).label).toBe('Field technician');
  });

  it('keeps an Agent in the field workspace when operational capabilities are also granted', () => {
    expect(dashboardRoleFor(['my_work', 'jobs', 'requests', 'bookings']).key).toBe('field-technician');
  });

  it.each([
    [['sales_marketing'], 'Sales & commercial'],
    [['bookings'], 'Dispatch coordination'],
    [['projects'], 'Project delivery'],
    [['amc'], 'Service programs'],
  ])('maps %j to the correct operating focus', (capabilities, label) => {
    expect(dashboardRoleFor(capabilities).label).toBe(label);
  });
});
