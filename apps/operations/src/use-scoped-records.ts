import { useEffect, useRef, useState } from 'react';
import type { PageMetadata } from './data';
import { RequestGeneration } from './subscription-support';

export function useScopedRecords<T extends { id: string }>(scope: string, read: (after?: string | null) => Promise<{ data: T[]; page?: PageMetadata }>, enabled = true) {
  const [records, setRecords] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reads = useRef(new RequestGeneration());
  const inFlight = useRef(false);
  const seen = useRef(new Set<string>());
  async function load(after?: string | null) {
    if (after && inFlight.current) return;
    const valid = reads.current.next(); inFlight.current = true; setLoading(true); setError('');
    if (!after) seen.current.clear();
    try {
      if (after && seen.current.has(after)) throw new Error('The history cursor repeated. Refresh this list before continuing.');
      const page = await read(after);
      if (valid()) {
        if (after) seen.current.add(after);
        setRecords(rows => after ? [...new Map([...rows, ...page.data].map(row => [row.id, row])).values()] : page.data);
        setCursor(page.page?.next || null);
      }
    } catch (cause) { if (valid()) setError((cause as { message?: string }).message || 'The list could not be loaded.'); }
    finally { if (valid()) { inFlight.current = false; setLoading(false); } }
  }
  useEffect(() => {
    setRecords([]); setCursor(null); if (enabled) void load(); else setLoading(false); const generation = reads.current;
    return () => generation.invalidate();
  }, [scope, enabled]);
  return { records, cursor, loading, error, load, loadMore: () => load(cursor) };
}
