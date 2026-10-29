import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CustomerHelpPage, CustomerMorePage, customerMoreLinks, customerPlaceDisplayAddress, customerPlaceDisplayName, customerPlaceStatusLabel, customerPlaceTypeLabel, customerSidebarDestinations, disambiguateProviderNames, timelinePresentation, timelineTarget } from './account-experience';

describe('customer place presentation', () => {
  it('formats location types for readable place cards', () => {
    expect(customerPlaceTypeLabel('REGISTERED_OFFICE')).toBe('Registered Office');
    expect(customerPlaceTypeLabel('COMMUNITY')).toBe('Community');
    expect(customerPlaceTypeLabel(null)).toBe('Place');
    expect(customerPlaceStatusLabel('INACTIVE_PENDING')).toBe('Inactive Pending');
    expect(customerPlaceStatusLabel(null)).toBe('Active');
    expect(customerPlaceDisplayName('Synthetic linked execution site 1793121538124')).toBe('Service location');
    expect(customerPlaceDisplayName('Maple Heights 1793121538124')).toBe('Maple Heights');
    expect(customerPlaceDisplayName('Green Meadows Walkthrough · Building test')).toBe('Green Meadows Walkthrough');
  });

  it('hides internal synthetic address text while preserving real address lines', () => {
    expect(customerPlaceDisplayAddress({ address_lines: ['Continuous browser test address'] })).toBe('');
    expect(customerPlaceDisplayAddress({ address_lines: ['Synthetic site address', '12 MG Road, Bengaluru'] })).toBe('12 MG Road, Bengaluru');
    expect(customerPlaceDisplayAddress({ address_lines: ['1 Demo Lane, Block 7', 'Mundur'] })).toBe('Mundur');
    expect(customerPlaceDisplayAddress({ address_lines: ['12 MG Road', 'Indiranagar', 'Bengaluru'] })).toBe('12 MG Road, Indiranagar');
  });
});

describe('customer Help & Support screen', () => {
  it('renders the mock support actions, common questions and safety guidance', () => {
    const html = renderToStaticMarkup(<CustomerHelpPage providers={[]} goTo={() => undefined} />);
    expect(html).toContain('Let’s make it easier.');
    expect(html).toContain('Your service providers');
    expect(html).toContain('Contact details for providers linked to your account.');
    expect(html).toContain('Track an existing service');
    expect(html).toContain('Check your visit or request status.');
    expect(html).toContain('Understand my coverage');
    expect(html).toContain('View the exact agreement.');
    expect(html).toContain('Scope, amount and approval.');
    expect(html).toContain('Can I choose my technician?');
    expect(html).toContain('Is a request a confirmed booking?');
    expect(html).toContain('Does handover activate my AMC?');
    expect(html).toContain('Immediate safety concern?');
  });

  it('distinguishes separate authorized provider accounts with the same display name', () => {
    expect(disambiguateProviderNames([
      { providerId: 'provider-b', providerName: 'Lift Rise' },
      { providerId: 'provider-a', providerName: 'Lift Rise' },
      { providerId: 'provider-c', providerName: 'Another Provider' },
    ])).toEqual([
      { providerId: 'provider-b', providerName: 'Lift Rise · Account\u00a02' },
      { providerId: 'provider-a', providerName: 'Lift Rise · Account\u00a01' },
      { providerId: 'provider-c', providerName: 'Another Provider' },
    ]);
  });
});

describe('customer More screen', () => {
  it('matches the mock navigation rows', () => {
    expect(customerMoreLinks.map(([, , title]) => title)).toEqual([
      'My places', 'Installation projects', 'Approvals', 'AMC & warranty', 'Documents',
      'Family & sharing', 'Service history', 'Notifications', 'Profile & security', 'Help & support',
    ]);
    expect(customerMoreLinks).toHaveLength(10);
  });

  it('renders an icon and a full-width action row for every destination', () => {
    const html = renderToStaticMarkup(<CustomerMorePage goTo={() => undefined} />);
    expect((html.match(/class="customer-more-link"/g) || [])).toHaveLength(10);
    expect((html.match(/class="customer-more-icon-svg"/g) || [])).toHaveLength(10);
    expect(html).toContain('Manage permitted access.');
  });
});

describe('customer desktop sidebar', () => {
  it('matches the prototype workspace destinations and routes', () => {
    expect(customerSidebarDestinations.map(([, route, title]) => [route, title])).toEqual([
      ['/', 'Overview'], ['/assets', 'My assets'], ['/places', 'My places'],
      ['/bookings', 'Service & bookings'], ['/projects', 'Projects'],
      ['/quotations', 'Approvals'], ['/coverage', 'AMC & warranty'],
      ['/documents', 'Documents'], ['/timeline', 'Service history'],
    ]);
  });
});

describe('customer timeline navigation', () => {
  it('opens linked service requests and assets using customer routes', () => {
    expect(timelineTarget({ id: 'request 1', type: 'service-requests' }, null)).toEqual({ path: '/request/request%201', label: 'View request' });
    expect(timelineTarget({ id: 'asset-1', type: 'assets' }, null)).toEqual({ path: '/asset/asset-1', label: 'View asset' });
  });

  it('opens service tracking and falls back to an authorized asset link', () => {
    expect(timelineTarget({ id: 'job-1', type: 'service-jobs' }, { id: 'asset-2', type: 'assets' })).toEqual({ path: '/service/job-1', label: 'View service' });
    expect(timelineTarget({ id: 'booking-1', type: 'service-bookings' }, null)).toEqual({ path: '/booking/booking-1', label: 'View appointment' });
    expect(timelineTarget({ id: 'report 1', type: 'service-reports' }, null)).toEqual({ path: '/documents/source/report%201', label: 'View shared report' });
    expect(timelineTarget({ id: 'visit-1', type: 'service-visits' }, { id: 'asset-2', type: 'assets' })).toEqual({ path: '/asset/asset-2', label: 'View asset' });
    expect(timelineTarget({ id: 'visit-1', type: 'service-visits' }, null)).toBeNull();
  });

  it('opens customer-visible commercial, project and document history sources', () => {
    expect(timelineTarget({ id: 'quote 1', type: 'quotations' }, null)).toEqual({ path: '/quotation/quote%201', label: 'View quotation' });
    expect(timelineTarget({ id: 'project-1', type: 'service-cases' }, null)).toEqual({ path: '/projects/project-1', label: 'View project' });
    expect(timelineTarget({ id: 'contract-1', type: 'maintenance-contracts' }, null)).toEqual({ path: '/coverage/contract/contract-1', label: 'View agreement' });
    expect(timelineTarget({ id: 'warranty-1', type: 'warranties' }, null)).toEqual({ path: '/coverage/warranty/warranty-1', label: 'View warranty' });
    expect(timelineTarget({ id: 'document-1', type: 'documents' }, null)).toEqual({ path: '/documents/document-1', label: 'View shared document' });
  });

  it('uses customer-readable event names and labels the source scope', () => {
    expect(timelinePresentation('SERVICE_REPORT_SUBMITTED', { id: 'report-1', type: 'service-reports' })).toEqual({
      title: 'Service report submitted', scope: 'document', scopeLabel: 'Document',
    });
    expect(timelinePresentation('quotation.accepted', { id: 'quote-1', type: 'quotations' })).toEqual({
      title: 'Quotation accepted', scope: 'quotation', scopeLabel: 'Quotation',
    });
  });
});
