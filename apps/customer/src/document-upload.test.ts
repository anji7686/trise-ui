import { describe, expect, it, vi } from 'vitest';
import { customerDocumentAssetChoiceLabel, customerDocumentRequestChoiceLabel, customerDocumentUploadReady, customerUploadMediaType, customerUploadValidation, uploadCustomerDocument } from './document-upload';

describe('customer document upload', () => {
  it('labels upload targets with customer-readable names, real codes and a short fallback reference', () => {
    expect(customerDocumentAssetChoiceLabel({ name: 'Passenger lift A', id: 'asset-123456', assetCode: 'ELP-004', siteName: 'Maple Heights' })).toBe('Asset · Passenger lift A · Asset code ELP-004 · Site Maple Heights');
    expect(customerDocumentAssetChoiceLabel({ name: 'Passenger lift A', id: '01a17e3a-0d7a-7499-9aa6-746a188cc38c', siteName: 'Maple Heights' })).toBe('Asset · Passenger lift A · Reference 8cc38c · Site Maple Heights');
    expect(customerDocumentAssetChoiceLabel({ name: 'Passenger lift A', id: 'asset-123456', siteCode: 'SITE-08' })).toBe('Asset · Passenger lift A · Reference 123456 · Site code SITE-08');
    expect(customerDocumentRequestChoiceLabel('Routine maintenance', 'SR-261029-ABC123')).toBe('Service request · Routine maintenance · SR-261029-ABC123');
  });

  it('accepts the mock file types and enforces server size limits', () => {
    expect(customerUploadMediaType({ name: 'scan.JPG', type: '' })).toBe('image/jpeg');
    expect(customerUploadValidation({ name: 'report.pdf', type: 'application/pdf', size: 2 * 1024 * 1024 })).toBe('');
    expect(customerUploadValidation({ name: 'report.pdf', type: 'application/pdf', size: 2 * 1024 * 1024 + 1 })).toContain('maximum is 2 MB');
    expect(customerUploadValidation({ name: 'photo.png', type: 'image/png', size: 25 * 1024 * 1024 })).toBe('');
    expect(customerUploadValidation({ name: 'script.exe', type: 'application/octet-stream', size: 10 })).toContain('Choose a PDF');
    expect(customerUploadValidation(null)).toContain('Choose a file');
  });

  it('enables upload only when every required field is valid and authorized records have loaded', () => {
    const ready = {
      providerId: 'provider-1',
      customerId: 'party-1',
      source: { type: 'ASSET' as const, id: 'asset-1' },
      title: 'Inspection report',
      file: { name: 'report.pdf', type: 'application/pdf', size: 100 },
      relatedLoading: false,
    };
    expect(customerDocumentUploadReady(ready)).toBe(true);
    expect(customerDocumentUploadReady({ ...ready, file: null })).toBe(false);
    expect(customerDocumentUploadReady({ ...ready, title: ' ' })).toBe(false);
    expect(customerDocumentUploadReady({ ...ready, source: undefined })).toBe(false);
    expect(customerDocumentUploadReady({ ...ready, relatedLoading: true })).toBe(false);
    expect(customerDocumentUploadReady({ ...ready, file: { name: 'bad.exe', type: '', size: 100 } })).toBe(false);
  });

  it('creates a customer-private submission, transfers bytes and finalizes with a checksum', async () => {
    const bytes = new TextEncoder().encode('hello').buffer;
    const api = {
      createDocument: vi.fn().mockResolvedValue({
        document: { id: 'doc-1' }, version: { id: 'version-1' },
        transfer: { url: 'https://private-upload.test/signed', method: 'PUT', headers: { 'Content-Type': 'application/pdf' } },
      }),
      finalizeDocument: vi.fn().mockResolvedValue({ id: 'doc-1' }),
    };
    const transfer = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const result = await uploadCustomerDocument({
      api: api as never, providerId: 'provider-1', customerId: 'party-1',
      source: { type: 'ASSET', id: 'asset-1' }, title: 'Inspection report',
      file: { name: 'report.pdf', type: 'application/pdf', size: bytes.byteLength, arrayBuffer: async () => bytes },
      transfer: transfer as never,
    });
    expect(result).toEqual({ id: 'doc-1' });
    expect(api.createDocument).toHaveBeenCalledWith('provider-1', expect.objectContaining({
      filename: 'Inspection report', media_type: 'application/pdf', classification: 'CUSTOMER_SUBMISSION',
      owner: { type: 'CUSTOMER', id: 'party-1' }, source: { type: 'ASSET', id: 'asset-1' }, visibility: 'customer',
    }), expect.any(String));
    expect(transfer).toHaveBeenCalledWith('https://private-upload.test/signed', expect.objectContaining({ method: 'PUT', body: bytes }));
    expect(api.finalizeDocument).toHaveBeenCalledWith('provider-1', 'doc-1', expect.objectContaining({ version_id: 'version-1', size_bytes: 5 }), expect.any(String));
  });

  it('does not finalize when the private byte transfer fails', async () => {
    const bytes = new TextEncoder().encode('hello').buffer;
    const api = {
      createDocument: vi.fn().mockResolvedValue({ document: { id: 'doc-1' }, version: { id: 'version-1' }, transfer: { url: 'signed', method: 'PUT', headers: {} } }),
      finalizeDocument: vi.fn(),
    };
    await expect(uploadCustomerDocument({
      api: api as never, providerId: 'provider-1', customerId: 'party-1', source: { type: 'CUSTOMER', id: 'party-1' }, title: '',
      file: { name: 'report.txt', type: 'text/plain', size: 5, arrayBuffer: async () => bytes },
      transfer: vi.fn().mockResolvedValue({ ok: false, status: 500 }) as never,
    })).rejects.toThrow('File transfer failed');
    expect(api.finalizeDocument).not.toHaveBeenCalled();
  });
});
