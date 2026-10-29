export type GlobalSearchKind = 'asset' | 'request' | 'booking' | 'service';

export function matchesGlobalSearch(term: string, fields: Array<string | null | undefined>): boolean {
  const normalizedTerm = term.trim().toLocaleLowerCase();
  return normalizedTerm.length >= 2 && fields.some((field) => field?.toLocaleLowerCase().includes(normalizedTerm));
}

export function globalSearchRoute(kind: GlobalSearchKind, id: string): string {
  switch (kind) {
    case 'asset': return `/asset/${encodeURIComponent(id)}`;
    case 'request': return `/request/${encodeURIComponent(id)}`;
    case 'booking': return `/booking/${encodeURIComponent(id)}`;
    case 'service': return `/service/${encodeURIComponent(id)}`;
  }
}
