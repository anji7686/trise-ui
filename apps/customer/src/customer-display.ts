const syntheticAddressLine = /^synthetic\b|\bcontinuous browser test address\b|^\d+\s+demo lane(?:\b|,)/i;

export function customerVisibleAddressLines(lines: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  return (lines || []).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || syntheticAddressLine.test(trimmed)) return [];
    const components = trimmed.split(',').map((component) => component.trim()).filter(Boolean);
    const unique = components.filter((component) => {
      const normalized = component.toLocaleLowerCase().replace(/[.]/g, '').trim();
      const key = ['bangalore', 'bengaluru'].includes(normalized) ? 'bengaluru' : normalized;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return unique.length ? [unique.join(', ')] : [];
  });
}

export function customerVisibleAddressText(value: readonly string[] | string | null | undefined): string {
  return customerVisibleAddressLines(typeof value === 'string' ? [value] : value).join(', ');
}
