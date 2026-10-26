export const PROVIDER_DOCUMENT_MAX_BYTES = 2 * 1024 * 1024;
export const PROVIDER_PHOTO_MAX_BYTES = 25 * 1024 * 1024;
export const PROVIDER_DOCUMENT_MEDIA_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const WORK_INTAKE_PHOTO_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
const DOCUMENT_EXTENSION_MEDIA_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function providerDocumentMediaType(
  file: Pick<File, "name" | "type">,
): string {
  const reported = file.type.toLowerCase();
  if (
    PROVIDER_DOCUMENT_MEDIA_TYPES.includes(
      reported as (typeof PROVIDER_DOCUMENT_MEDIA_TYPES)[number],
    )
  )
    return reported;
  const extension = file.name.toLowerCase().split(".").pop() || "";
  return DOCUMENT_EXTENSION_MEDIA_TYPES[extension] || reported;
}

export function providerDocumentFileError(
  file: Pick<File, "name" | "size" | "type">,
): string {
  if (!file.name.trim() || file.name.length > 200)
    return "Choose a file with a name between 1 and 200 characters.";
  if (
    !PROVIDER_DOCUMENT_MEDIA_TYPES.includes(
      providerDocumentMediaType(
        file,
      ) as (typeof PROVIDER_DOCUMENT_MEDIA_TYPES)[number],
    )
  ) {
    return "Choose a PDF, Word, Excel, PNG, JPEG, or WebP file. Executable, script, archive, SVG, HTML, and macro-enabled files are not accepted.";
  }
  if (file.size < 1 || file.size > PROVIDER_DOCUMENT_MAX_BYTES)
    return "Choose a non-empty document no larger than 2 MiB.";
  return "";
}

export function workIntakePhotoFileError(
  file: Pick<File, "name" | "size" | "type">,
): string {
  if (!file.name.trim() || file.name.length > 200)
    return "Choose a photo with a name between 1 and 200 characters.";
  const mediaType = providerDocumentMediaType(file);
  if (
    !WORK_INTAKE_PHOTO_MEDIA_TYPES.includes(
      mediaType as (typeof WORK_INTAKE_PHOTO_MEDIA_TYPES)[number],
    )
  )
    return "Choose a PNG, JPEG, or WebP photo. PDFs, SVGs, scripts, archives, and other files are not accepted for site assets.";
  if (file.size < 1 || file.size > PROVIDER_PHOTO_MAX_BYTES)
    return "Choose a non-empty photo no larger than 25 MiB.";
  return "";
}

export function workIntakeDocumentFileError(
  file: Pick<File, "name" | "size" | "type">,
): string {
  const validation = providerDocumentFileError(file);
  if (validation) return validation;
  if (providerDocumentMediaType(file).startsWith("image/"))
    return "Choose a PDF, Word, or Excel file in the Documents tab. Images belong in the Images tab.";
  return "";
}

export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
