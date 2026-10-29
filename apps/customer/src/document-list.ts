import type { DocumentAttributes, DocumentVersionAttributes, Resource } from './data';

export type CustomerDocumentRecord = { resource: Resource<DocumentAttributes>; providerId: string };

const customerDocumentLabels: Record<string, string> = {
  SERVICE_CASE_HANDOVER_REPORT: 'Service case handover report',
  SERVICE_REPORT: 'Service report',
  SERVICE_REPORT_ATTACHMENT: 'Service report attachment',
  MAINTENANCE_AGREEMENT: 'Maintenance agreement',
  AMC_AGREEMENT: 'AMC agreement',
  WARRANTY_CERTIFICATE: 'Warranty certificate',
  QUOTATION: 'Quotation',
};

export function customerDocumentClassificationLabel(classification: string) {
  const value = classification.trim();
  if (customerDocumentLabels[value]) return customerDocumentLabels[value];
  return value.replaceAll('_', ' ').toLocaleLowerCase('en-IN').replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('en-IN')) || 'Document';
}

export function customerDocumentDisplayName(filename: string) {
  const name = filename.trim();
  const sample = name.match(/^(?:development|dev)[-_]sample[-_]+(.+)$/i);
  if (!sample) return name || 'Shared document';
  const title = sample[1].replace(/\.[a-z0-9]{1,8}$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return title ? title.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('en-IN')) : name;
}

export function filterCustomerDocuments(records: CustomerDocumentRecord[], query: string, classification = '') {
  const needle = query.trim().toLocaleLowerCase();
  return records.filter(({ resource }) => {
    const attributes = resource.attributes;
    const searchable = [attributes.filename, attributes.classification, attributes.media_type, attributes.status]
      .filter(Boolean).join(' ').toLocaleLowerCase();
    return (!needle || searchable.includes(needle)) && (!classification || attributes.classification === classification);
  });
}

export function documentClassifications(records: CustomerDocumentRecord[]) {
  return [...new Set(records.map(({ resource }) => resource.attributes.classification).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function customerCanDownloadDocument(attributes: DocumentAttributes) {
  return attributes.status === 'available' && attributes.visibility === 'customer';
}

export function customerDocumentPreviousVersions(versions: Resource<DocumentVersionAttributes>[], currentVersionId?: string | null) {
  const activeVersionId = currentVersionId || versions[0]?.id;
  return versions.filter((version) => version.id !== activeVersionId);
}

