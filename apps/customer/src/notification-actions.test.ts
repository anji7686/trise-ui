import { describe, expect, it, vi } from 'vitest';
import type { Collection, NotificationAttributes, Resource } from './data';
import { markAllUnreadNotifications, notificationBulkActionState, notificationCountLabel, notificationReadResultMessage } from './notification-actions';

const resource = (id: string): Resource<NotificationAttributes> => ({
  id, type: 'notifications', attributes: { category: 'service', title: id, body: id }, relationships: {},
});
const collection = (ids: string[], next?: string): Collection<NotificationAttributes> => ({
  data: ids.map(resource), page: { next },
});

describe('mark all customer notifications read', () => {
  it('uses singular update copy and shows a disabled All read action when nothing remains', () => {
    expect(notificationCountLabel(1, false)).toBe('1 update');
    expect(notificationCountLabel(4, true)).toBe('4 updates+');
    expect(notificationReadResultMessage(1, 0)).toBe('1 update marked read across your account.');
    expect(notificationReadResultMessage(2, 1)).toBe('2 updates marked read. 1 update could not be updated; retry to mark the remaining unread updates.');
    expect(notificationReadResultMessage(0, 0)).toBe('You are all caught up.');
    expect(notificationBulkActionState(0, false, false)).toEqual({ label: 'All read', disabled: true });
  });

  it('keeps Mark all read available while unread records or unseen pages may remain', () => {
    expect(notificationBulkActionState(1, false, false)).toEqual({ label: 'Mark all read', disabled: false });
    expect(notificationBulkActionState(0, true, false)).toEqual({ label: 'Mark all read', disabled: false });
    expect(notificationBulkActionState(1, false, true)).toEqual({ label: 'Marking read…', disabled: true });
  });

  it('walks every provider cursor before marking all unread records read', async () => {
    const loadPage = vi.fn(async (providerId: string, page: { after?: string }) => {
      if (providerId === 'provider-a' && !page.after) return collection(['a1'], 'cursor-a');
      if (providerId === 'provider-a' && page.after === 'cursor-a') return collection(['a2']);
      if (providerId === 'provider-b') return collection(['b1']);
      throw new Error('Unexpected cursor');
    });
    const markRead = vi.fn(async (providerId: string, id: string) => `${providerId}:${id}`);

    const result = await markAllUnreadNotifications([{ id: 'provider-a' }, { id: 'provider-b' }], loadPage, markRead);

    expect(loadPage).toHaveBeenCalledTimes(3);
    expect(markRead.mock.calls.map(([providerId, id]) => `${providerId}:${id}`).sort()).toEqual(['provider-a:a1', 'provider-a:a2', 'provider-b:b1']);
    expect(result.succeeded).toHaveLength(3);
    expect(result.failed).toHaveLength(0);
  });

  it('bounds write concurrency and reports individual failures', async () => {
    const loadPage = vi.fn(async () => collection(['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7']));
    let active = 0; let peak = 0;
    const markRead = vi.fn(async (_providerId: string, id: string) => {
      active += 1; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 0));
      active -= 1;
      if (id === 'n3') throw new Error('temporary failure');
    });

    const result = await markAllUnreadNotifications([{ id: 'provider-a' }], loadPage, markRead, 4);

    expect(peak).toBeLessThanOrEqual(4);
    expect(result.succeeded).toHaveLength(6);
    expect(result.failed.map(item => item.resource.id)).toEqual(['n3']);
  });

  it('stops before writes if pagination repeats a cursor', async () => {
    const loadPage = vi.fn(async (_providerId: string, page: { after?: string }) => collection(page.after ? ['n2'] : ['n1'], 'same-cursor'));
    const markRead = vi.fn(async () => undefined);

    await expect(markAllUnreadNotifications([{ id: 'provider-a' }], loadPage, markRead)).rejects.toThrow('pagination did not advance');
    expect(markRead).not.toHaveBeenCalled();
  });
});
