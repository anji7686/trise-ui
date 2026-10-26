import { describe, expect, it } from 'vitest';
import { humanFileSize, PROVIDER_DOCUMENT_MAX_BYTES, PROVIDER_PHOTO_MAX_BYTES, providerDocumentFileError, workIntakeDocumentFileError, workIntakePhotoFileError } from './provider-document-upload';

describe('provider document upload validation', () => {
  it.each(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/png', 'image/jpeg', 'image/webp'])('accepts %s within the private upload limit', (type) => {
    expect(providerDocumentFileError({ name: 'evidence.pdf', size: 1024, type })).toBe('');
  });

  it('rejects active and inline-renderable untrusted formats', () => {
    expect(providerDocumentFileError({ name: 'evidence.svg', size: 100, type: 'image/svg+xml' })).toContain('not accepted');
    expect(providerDocumentFileError({ name: 'evidence.html', size: 100, type: 'text/html' })).toContain('not accepted');
    expect(providerDocumentFileError({ name: 'archive.zip', size: 100, type: 'application/zip' })).toContain('not accepted');
  });

  it('keeps Work Intake Images and Documents tabs separate', () => {
    expect(workIntakeDocumentFileError({ name: 'site-photo.jpg', size: 100, type: 'image/jpeg' })).toContain('Images tab');
    expect(workIntakeDocumentFileError({ name: 'scope.xlsx', size: 100, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })).toBe('');
  });

  it('uses the document extension when the browser reports a generic MIME type', () => {
    expect(workIntakeDocumentFileError({ name: 'scope.docx', size: 100, type: 'application/octet-stream' })).toBe('');
    expect(workIntakeDocumentFileError({ name: 'scope.xlsx', size: 100, type: '' })).toBe('');
    expect(workIntakePhotoFileError({ name: 'site-photo.jpg', size: 100, type: '' })).toBe('');
  });

  it('enforces non-empty files and the 2 MiB document limit', () => {
    expect(providerDocumentFileError({ name: 'empty.pdf', size: 0, type: 'application/pdf' })).toContain('non-empty');
    expect(providerDocumentFileError({ name: 'large.pdf', size: PROVIDER_DOCUMENT_MAX_BYTES + 1, type: 'application/pdf' })).toContain('2 MiB');
    expect(workIntakePhotoFileError({ name: 'large-photo.jpg', size: PROVIDER_PHOTO_MAX_BYTES + 1, type: 'image/jpeg' })).toContain('25 MiB');
  });

  it('formats bounded file sizes for the document table', () => {
    expect(humanFileSize(512)).toBe('512 B');
    expect(humanFileSize(1536)).toBe('2 KB');
    expect(humanFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});
