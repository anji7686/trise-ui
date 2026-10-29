import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CustomerServiceReportPreview } from './customer-report-preview';
import type { CustomerServiceReportPreviewAttributes } from './data';

const report: CustomerServiceReportPreviewAttributes = {
  provider_name: 'Aster Services', title: 'Preventive maintenance report', summary: 'Preventive maintenance report',
  work_performed: 'Inspected door operation and safety devices.', observations: 'Door sensor wear observed.',
  asset_name: 'Passenger lift · A', site_name: 'Maple Heights · Tower A', technician_name: 'Kiran Nair',
  service_date: '2026-09-30T08:00:00Z', submitted_at: '2026-09-30T09:00:00Z', version: 1,
};

describe('customer service report preview', () => {
  it('renders customer-safe service, site and report details in labeled sections', () => {
    const markup = renderToStaticMarkup(<CustomerServiceReportPreview report={report} formatDate={() => '30 Sep 2026'} />);
    for (const label of ['Preventive maintenance report', 'Provider', 'Aster Services', 'Asset', 'Passenger lift · A', 'Site', 'Maple Heights · Tower A', 'Technician', 'Kiran Nair', 'Service date', 'Work completed', 'Inspected door operation and safety devices.', 'Observations', 'Door sensor wear observed.', 'Version 1']) {
      expect(markup).toContain(label);
    }
  });

  it('omits technician and observations when the customer-safe projection has none', () => {
    const markup = renderToStaticMarkup(<CustomerServiceReportPreview report={{ ...report, technician_name: null, observations: null }} formatDate={() => '30 Sep 2026'} />);
    expect(markup).not.toContain('<dt>Technician</dt>');
    expect(markup).not.toContain('<h4>Observations</h4>');
  });

  it('hides generated numeric suffixes from report, asset and site labels', () => {
    const markup = renderToStaticMarkup(<CustomerServiceReportPreview report={{ ...report, title: 'Preventive maintenance report 1793121538363', asset_name: 'Continuous Elevator A 1792745454677', site_name: 'Continuous elevator site 1793118999664' }} formatDate={() => '30 Sep 2026'} />);
    expect(markup).toContain('Preventive maintenance report</h3>');
    expect(markup).toContain('Continuous Elevator A</dd>');
    expect(markup).toContain('Continuous elevator site</dd>');
    expect(markup).not.toContain('1793121538363');
    expect(markup).not.toContain('1792745454677');
    expect(markup).not.toContain('1793118999664');
  });
});
