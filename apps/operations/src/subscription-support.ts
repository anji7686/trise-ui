import type { Collection, PlatformPlan, PlatformPlanVersion, ProviderOperation, ProviderSubscriptionSelfService, Resource, SubscriptionHistoryKind } from './data';

export type ApplicablePlanChoice = { plan: Resource<PlatformPlan>; version: Resource<PlatformPlanVersion>; matchingOperations: string[] };

export function applicablePlanChoices(plans: Resource<PlatformPlan>[], operations: ProviderOperation[]): ApplicablePlanChoice[] {
  const operationNames = new Map(operations.map((row) => [row.attributes.business_operation.id, row.attributes.business_operation.name]));
  return plans.flatMap((plan) => (plan.attributes.versions || (plan.attributes.latest_version ? [plan.attributes.latest_version] : []))
    .filter((version) => version.attributes.status === 'PUBLISHED')
    .map((version) => {
      const matchingOperations = version.attributes.business_operation_type_ids
        .filter((id) => operationNames.has(id))
        .map((id) => operationNames.get(id)!);
      return { plan, version, matchingOperations };
    })
    .filter((choice) => choice.matchingOperations.length > 0));
}

export function mergeProviderHistory(current: ProviderSubscriptionSelfService, result: ProviderSubscriptionSelfService, kind: SubscriptionHistoryKind): ProviderSubscriptionSelfService {
  return {
    ...current, subscription: result.subscription, usage: result.usage,
    [kind]: [...new Map([...current[kind], ...result[kind]].map((row) => [row.id, row])).values()],
    history_page: { ...current.history_page!, [kind]: result.history_page?.[kind] || { next: null } }
  };
}

export function localDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Follow opaque cursors only; an incomplete catalogue must never look complete.
export async function collectPages<T>(read: (after?: string) => Promise<Collection<T>>, isCurrent = () => true): Promise<Resource<T>[]> {
  const rows = new Map<string, Resource<T>>();
  const cursors = new Set<string>();
  let after: string | undefined;
  for (let count = 0; count < 200; count += 1) {
    const page = await read(after);
    if (!isCurrent()) return [];
    page.data.forEach((row) => rows.set(row.id, row));
    if (!page.page?.next) return [...rows.values()];
    after = page.page.next;
    if (cursors.has(after)) throw new Error('The catalogue cursor repeated. Refresh and try again.');
    cursors.add(after);
  }
  throw new Error('The catalogue is too large to load completely. Narrow the selection and try again.');
}

export class RequestGeneration {
  private value = 0;
  next() { const value = ++this.value; return () => value === this.value; }
  invalidate() { this.value += 1; }
}

// One command at a time. Keep the same key if the server outcome is uncertain.
export class SubscriptionCommands {
  private pending = false;
  private keys = new Map<string, string>();
  async run(signature: string, command: (key: string) => Promise<unknown>): Promise<boolean> {
    if (this.pending) return false;
    this.pending = true;
    // Keep browser-backed UUID generation, while allowing the command helper to
    // remain usable in SSR and test runtimes that do not expose Web Crypto.
    const key = this.keys.get(signature) || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.keys.set(signature, key);
    try { await command(key); this.keys.delete(signature); return true; }
    catch (cause) {
      const status = (cause as { status?: number })?.status;
      if (status && status >= 400 && status < 500) this.keys.delete(signature);
      throw cause;
    } finally { this.pending = false; }
  }
}
