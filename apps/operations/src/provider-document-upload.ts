export const PROVIDER_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;
export const PROVIDER_DOCUMENT_MEDIA_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] as const;

export function providerDocumentFileError(file: Pick<File, 'name' | 'size' | 'type'>): string {
  if (!file.name.trim() || file.name.length > 200) return 'Choose a file with a name between 1 and 200 characters.';
  if (!PROVIDER_DOCUMENT_MEDIA_TYPES.includes(file.type.toLowerCase() as (typeof PROVIDER_DOCUMENT_MEDIA_TYPES)[number])) {
    return 'Choose a PDF, PNG, JPEG, or WebP file. Executable, script, archive, SVG, HTML, and macro-enabled files are not accepted.';
  }
  if (file.size < 1 || file.size > PROVIDER_DOCUMENT_MAX_BYTES) return 'Choose a non-empty file no larger than 25 MiB.';
  return '';
}

export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
