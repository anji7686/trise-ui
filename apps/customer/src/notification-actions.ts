import type { Collection, CollectionPage, NotificationAttributes, Resource } from './data';

export type CustomerNotification = { providerId: string; resource: Resource<NotificationAttributes> };

export function notificationCountLabel(count: number, hasMore: boolean) {
  return `${count} update${count === 1 ? '' : 's'}${hasMore ? '+' : ''}`;
}

export function notificationReadResultMessage(succeededCount: number, failedCount: number) {
  const succeeded = `${succeededCount} update${succeededCount === 1 ? '' : 's'} marked read`;
  if (failedCount > 0) {
    const failed = `${failedCount} update${failedCount === 1 ? '' : 's'} could not be updated`;
    return `${succeeded}. ${failed}; retry to mark the remaining unread updates.`;
  }
  return succeededCount ? `${succeeded} across your account.` : 'You are all caught up.';
}

export function notificationBulkActionState(unreadCount: number, hasMore: boolean, busy: boolean) {
  const actionable = unreadCount > 0 || hasMore;
  return {
    label: busy ? 'Marking read…' : actionable ? 'Mark all read' : 'All read',
    disabled: busy || !actionable,
  };
}

export async function markAllUnreadNotifications(
  providers: Array<{ id: string }>,
  loadPage: (providerId: string, page: CollectionPage) => Promise<Collection<NotificationAttributes>>,
  markRead: (providerId: string, notificationId: string) => Promise<unknown>,
  concurrency = 4,
): Promise<{ succeeded: CustomerNotification[]; failed: CustomerNotification[] }> {
  const unread = (await Promise.all(providers.map(async ({ id: providerId }) => {
    const resources: Resource<NotificationAttributes>[] = [];
    const seenCursors = new Set<string>();
    let after: string | undefined;
    do {
      const page = await loadPage(providerId, { limit: 100, after });
      resources.push(...page.data);
      after = page.page?.next || undefined;
      if (after && seenCursors.has(after)) throw new Error('Notification pagination did not advance. No read updates were submitted.');
      if (after) seenCursors.add(after);
    } while (after);
    return resources.map((resource) => ({ providerId, resource }));
  }))).flat();

  const succeeded: CustomerNotification[] = [];
  const failed: CustomerNotification[] = [];
  let next = 0;
  const worker = async () => {
    while (next < unread.length) {
      const record = unread[next++];
      if (!record) return;
      try {
        await markRead(record.providerId, record.resource.id);
        succeeded.push(record);
      } catch {
        failed.push(record);
      }
    }
  };
  const workerCount = Math.min(unread.length, Math.max(1, Math.floor(concurrency)));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return { succeeded, failed };
}
