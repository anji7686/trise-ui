import type { customerData } from './data';

export type CustomerDocumentSource = { type: 'CUSTOMER' | 'ASSET' | 'SERVICE_REQUEST'; id: string };
export type CustomerDocumentUploadFile = Pick<File, 'name' | 'size' | 'type' | 'arrayBuffer'>;
export type CustomerDocumentUploadApi = Pick<typeof customerData, 'createDocument' | 'finalizeDocument'>;

export function customerDocumentAssetChoiceLabel(input: { name: string; id: string; assetCode?: string | null; siteName?: string | null; siteCode?: string | null }) {
  const identity = input.assetCode?.trim() ? `Asset code ${input.assetCode.trim()}` : `Reference ${input.id.slice(-6)}`;
  const site = input.siteName?.trim() ? `Site ${input.siteName.trim()}` : input.siteCode?.trim() ? `Site code ${input.siteCode.trim()}` : '';
  return `Asset · ${input.name.trim()} · ${identity}${site ? ` · ${site}` : ''}`;
}

export function customerDocumentRequestChoiceLabel(summary: string, referenceCode?: string | null) {
  return `Service request · ${summary.trim()}${referenceCode?.trim() ? ` · ${referenceCode.trim()}` : ''}`;
}

const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const ACCEPTED_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg,.jpeg',
  'text/plain': '.txt',
};

export function customerUploadMediaType(file: Pick<File, 'name' | 'type'>) {
  if (Object.hasOwn(ACCEPTED_TYPES, file.type)) return file.type;
  const extension = file.name.toLocaleLowerCase().split('.').pop();
  return extension === 'pdf' ? 'application/pdf'
    : extension === 'png' ? 'image/png'
      : ['jpg', 'jpeg'].includes(extension || '') ? 'image/jpeg'
        : extension === 'txt' ? 'text/plain' : '';
}

export function customerUploadValidation(file: Pick<File, 'name' | 'size' | 'type'> | null) {
  if (!file) return 'Choose a file to upload.';
  const mediaType = customerUploadMediaType(file);
  if (!mediaType) return 'Choose a PDF, PNG, JPG, JPEG or TXT file.';
  const maxBytes = mediaType.startsWith('image/') ? MAX_PHOTO_BYTES : MAX_DOCUMENT_BYTES;
  if (file.size < 1 || file.size > maxBytes) return `This file is too large. The maximum is ${mediaType.startsWith('image/') ? '25 MB' : '2 MB'}.`;
  return '';
}

export function customerDocumentUploadReady(input: {
  providerId: string;
  customerId: string;
  source?: CustomerDocumentSource;
  title: string;
  file: Pick<File, 'name' | 'size' | 'type'> | null;
  relatedLoading: boolean;
}) {
  return !input.relatedLoading && Boolean(
    input.providerId.trim()
    && input.customerId.trim()
    && input.source?.id.trim()
    && input.title.trim()
    && input.file
    && !customerUploadValidation(input.file),
  );
}

function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `customer-document-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
export function newCustomerDocumentUploadKey() { return idempotencyKey(); }

export async function uploadCustomerDocument(input: {
  api: CustomerDocumentUploadApi;
  providerId: string;
  customerId: string;
  source: CustomerDocumentSource;
  title: string;
  file: CustomerDocumentUploadFile;
  attemptKey?: string;
  transfer?: typeof fetch;
}) {
  const validation = customerUploadValidation(input.file);
  if (validation) throw new Error(validation);
  const mediaType = customerUploadMediaType(input.file)!;
  const checksum = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await input.file.arrayBuffer()))]
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const key = input.attemptKey || idempotencyKey();
  const created = await input.api.createDocument(input.providerId, {
    filename: input.title.trim() || input.file.name,
    media_type: mediaType,
    size_bytes: input.file.size,
    checksum,
    classification: 'CUSTOMER_SUBMISSION',
    owner: { type: 'CUSTOMER', id: input.customerId },
    source: input.source,
    visibility: 'customer',
  }, `${key}-create`);
  const transfer = input.transfer || fetch;
  const uploaded = await transfer(created.transfer.url, {
    method: created.transfer.method,
    headers: created.transfer.headers,
    body: await input.file.arrayBuffer(),
  });
  if (!uploaded.ok) throw new Error(`File transfer failed (${uploaded.status}). No file was made available. You can retry this upload safely.`);
  return input.api.finalizeDocument(input.providerId, created.document.id, {
    version_id: created.version.id,
    checksum,
    size_bytes: input.file.size,
  }, `${key}-finalize`);
}
