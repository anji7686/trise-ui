import { describe, expect, it } from 'vitest';
import { customerCanDownloadDocument, customerDocumentClassificationLabel, customerDocumentDisplayName, customerDocumentPreviousVersions, documentClassifications, filterCustomerDocuments } from './document-list';
import type { DocumentAttributes, DocumentVersionAttributes, Resource } from './data';

function record(id: string, filename: string, classification: string, overrides: Partial<DocumentAttributes> = {}) {
  const resource: Resource<DocumentAttributes> = {
    id, type: 'documents', attributes: {
      filename, media_type: 'application/pdf', size_bytes: 1200, checksum: 'abc', classification,
      status: 'available', scan_state: 'clean', revision: 1, visibility: 'customer', ...overrides,
    }, relationships: {},
  };
  return { resource, providerId: 'provider-1' };
}

describe('customer document list', () => {
  const records = [record('1', 'Service report.pdf', 'Service report'), record('2', 'AMC agreement.pdf', 'Agreement')];
  it('searches filename and classification without changing the source records', () => {
    expect(filterCustomerDocuments(records, 'REPORT').map(({ resource }) => resource.id)).toEqual(['1']);
    expect(filterCustomerDocuments(records, '', 'Agreement').map(({ resource }) => resource.id)).toEqual(['2']);
  });
  it('offers only classifications present in customer-visible results', () => {
    expect(documentClassifications(records)).toEqual(['Agreement', 'Service report']);
  });
  it('requires an available customer-visible document before offering download', () => {
    expect(customerCanDownloadDocument(records[0].resource.attributes)).toBe(true);
    expect(customerCanDownloadDocument({ ...records[0].resource.attributes, visibility: 'internal' })).toBe(false);
    expect(customerCanDownloadDocument({ ...records[0].resource.attributes, status: 'archived' })).toBe(false);
  });

  it('shows readable customer document types instead of backend enum codes', () => {
    expect(customerDocumentClassificationLabel('SERVICE_CASE_HANDOVER_REPORT')).toBe('Service case handover report');
    expect(customerDocumentClassificationLabel('AMC_AGREEMENT')).toBe('AMC agreement');
    expect(customerDocumentClassificationLabel('inspection_record')).toBe('Inspection Record');
    expect(customerDocumentClassificationLabel('')).toBe('Document');
  });

  it('removes internal development-sample prefixes only from display names', () => {
    expect(customerDocumentDisplayName('development-sample-commissioning-report.pdf')).toBe('Commissioning Report');
    expect(customerDocumentDisplayName('dev_sample_safety-check.pdf')).toBe('Safety Check');
    expect(customerDocumentDisplayName('Lift_Agreement_v2.pdf')).toBe('Lift_Agreement_v2.pdf');
    expect(customerDocumentDisplayName('')).toBe('Shared document');
  });

  it('shows only older versions in the previous versions section', () => {
    const versions: Resource<DocumentVersionAttributes>[] = [1, 2, 3].map((version) => ({
      id: `version-${version}`, type: 'document-versions',
      attributes: { version, filename: `report-${version}.pdf`, media_type: 'application/pdf', size_bytes: 1000, checksum: `sum-${version}`, scan_state: 'clean' },
      relationships: {},
    }));
    expect(customerDocumentPreviousVersions(versions, 'version-2').map((item) => item.id)).toEqual(['version-1', 'version-3']);
    expect(customerDocumentPreviousVersions(versions).map((item) => item.id)).toEqual(['version-2', 'version-3']);
  });
});
