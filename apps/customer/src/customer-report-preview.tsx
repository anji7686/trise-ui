import type { CustomerServiceReportPreviewAttributes } from './data';
import { customerReadableName } from './coverage-list';

export function CustomerServiceReportPreview({ report, formatDate }: { report: CustomerServiceReportPreviewAttributes; formatDate: (value: string) => string }) {
  return <div className="customer-service-report-preview">
    <header><div className="customer-service-report-preview-title"><span className="customer-service-report-icon" aria-hidden="true">▤</span><div><h3>{customerReadableName(report.title)}</h3><p>{report.submitted_at ? `Submitted · ${formatDate(report.submitted_at)}` : 'Submitted service report'} · Version {report.version}</p></div></div></header>
    <dl>
      <div><dt>Provider</dt><dd>{report.provider_name}</dd></div>
      {report.asset_name && <div><dt>Asset</dt><dd>{customerReadableName(report.asset_name)}</dd></div>}
      {report.site_name && <div><dt>Site</dt><dd>{customerReadableName(report.site_name)}</dd></div>}
      {report.technician_name && <div><dt>Technician</dt><dd>{report.technician_name}</dd></div>}
      {report.service_date && <div><dt>Service date</dt><dd>{formatDate(report.service_date)}</dd></div>}
    </dl>
    <section><h4>Work completed</h4><p>{report.work_performed}</p></section>
    {report.observations && <section><h4>Observations</h4><p>{report.observations}</p></section>}
    {report.submitted_at && <span className="customer-service-report-status">Report submitted</span>}
  </div>;
}
