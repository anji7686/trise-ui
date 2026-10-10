export const SUPPORTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_LOGO_INPUT_BYTES = 5 * 1024 * 1024;
export const MAX_LOGO_PIXELS = 40_000_000;
export const MAX_LOGO_DIMENSION = 10_000;
export const LOGO_OUTPUT_SIZE = 512;

export function logoFileError(file: { type: string; size: number }, dimensions?: { width: number; height: number }) {
  if (!SUPPORTED_LOGO_TYPES.includes(file.type as (typeof SUPPORTED_LOGO_TYPES)[number])) return 'Choose a PNG, JPEG, or WebP image.';
  if (file.size > MAX_LOGO_INPUT_BYTES) return 'Logo files must be 5 MB or smaller.';
  if (dimensions && (dimensions.width > MAX_LOGO_DIMENSION || dimensions.height > MAX_LOGO_DIMENSION || dimensions.width * dimensions.height > MAX_LOGO_PIXELS)) return 'This image is too large to process safely.';
  return '';
}

export function containFrame(width: number, height: number, box: number, padding = 24) {
  const available = Math.max(1, box - padding * 2);
  const scale = Math.min(available / width, available / height);
  return { width: width * scale, height: height * scale, left: (box - width * scale) / 2, top: (box - height * scale) / 2, scale };
}
