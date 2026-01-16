import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQueryClient } from '.';
import type { CacheEntry } from '@/types';

// Хелпер для быстрого создания объекта записи
const createMockEntry = (
  key: any,
  data: unknown = 'test-data',
  subscribers = 0,
  cacheTime = 5000
): CacheEntry => ({
  rawKey: key,
  data,
  error: null,
  status: 'success',
  fetchStatus: 'idle',
  updatedAt: Date.now(),
  cacheTime,
  subscribers,
});

describe('QueryClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should set and get cache entries', () => {
    const key = 'test-key';
    const entry = createMockEntry(key);
    const queryClient = useQueryClient();

    queryClient.setEntry(key, entry);

    expect(queryClient.getEntry(key)).toEqual(entry);
    expect(queryClient.getEntry(key)).toBeDefined();
  });

  it('should return undefined for non-existent keys', () => {
    const queryClient = useQueryClient();
    expect(queryClient.getEntry('404')).toBeUndefined();
  });

  it('should remove an entry manually', () => {
    const key = 'to-delete';
    const queryClient = useQueryClient();
    queryClient.setEntry(key, createMockEntry(key));

    queryClient.removeEntry(key);

    expect(queryClient.getEntry(key)).toBeUndefined();
  });

  it('should schedule Garbage Collection when subscribers reach 0', () => {
    const key = 'gc-test';
    const cacheTime = 1000;
    const queryClient = useQueryClient();

    queryClient.setEntry(key, createMockEntry(key, 'data', 1, cacheTime));

    queryClient.updateSubscribers(key, 0, cacheTime);

    expect(queryClient.getEntry(key)).toBeDefined();

    vi.advanceTimersByTime(500);
    expect(queryClient.getEntry(key)).toBeDefined();

    vi.advanceTimersByTime(501);

    expect(queryClient.getEntry(key)).toBeUndefined();
  });

  it('should cancel Garbage Collection if a subscriber returns', () => {
    const key = 'revive-test';
    const cacheTime = 1000;

    const queryClient = useQueryClient();
    queryClient.setEntry(key, createMockEntry(key, 'data', 0, cacheTime));
    queryClient.updateSubscribers(key, 0, cacheTime);

    vi.advanceTimersByTime(900);
    expect(queryClient.getEntry(key)).toBeDefined();

    queryClient.updateSubscribers(key, 1, cacheTime);

    vi.advanceTimersByTime(200);

    expect(queryClient.getEntry(key)).toBeDefined();
    expect(queryClient.getEntry(key)?.subscribers).toBe(1);
  });

  it('should reset the timer if cacheTime changes or subscribers drop to 0 again', () => {
    const key = 'reset-timer';
    const cacheTime = 1000;
    const queryClient = useQueryClient();
    queryClient.setEntry(key, createMockEntry(key, 'data', 1));

    queryClient.updateSubscribers(key, 0, cacheTime);
    vi.advanceTimersByTime(500);

    queryClient.updateSubscribers(key, 1, cacheTime);

    queryClient.updateSubscribers(key, 0, cacheTime);

    vi.advanceTimersByTime(600);

    expect(queryClient.getEntry(key)).toBeDefined();

    vi.advanceTimersByTime(400);
    expect(queryClient.getEntry(key)).toBeUndefined();
  });

  it('clear() should remove all entries and cancel all timers', () => {
    const key1 = 'k1';
    const key2 = 'k2';
    const queryClient = useQueryClient();
    queryClient.setEntry(key1, createMockEntry(key1, 'd1', 0));
    queryClient.updateSubscribers(key1, 0, 1000);

    queryClient.setEntry(key2, createMockEntry(key2, 'd2', 1));

    queryClient.clear();

    expect(queryClient.getEntry(key1)).toBeUndefined();
    expect(queryClient.getEntry(key2)).toBeUndefined();
    expect(queryClient.entries.size).toBe(0);

    vi.runAllTimers();
  });

  describe('Invalidate split (Single vs Multiple)', () => {
    it('should invalidate an entry by exact string match', () => {
      const queryClient = useQueryClient();
      const key = ['secrets', 'list'];
      const key2 = ['secrets', 'list', 'details']; // Похожий ключ
      queryClient.setEntry(key, createMockEntry(key));
      queryClient.setEntry(key2, createMockEntry(key2));

      expect(queryClient.getEntry(key)?.updatedAt).toBeGreaterThan(0);

      queryClient.invalidateQuery(key);

      expect(queryClient.getEntry(key)?.updatedAt).toBe(0);
      expect(queryClient.getEntry(key2)?.updatedAt).not.toBe(0);
    });

    it('should invalidate an entry by exact array match', () => {
      const queryClient = useQueryClient();
      const key = ['secrets', 'list'];
      queryClient.setEntry(key, createMockEntry(key));

      queryClient.invalidateQuery(key);

      expect(queryClient.getEntry(key)?.updatedAt).toBe(0);
    });

    it('should invalidate using prefix matching (Fuzzy Match)', () => {
      const queryClient = useQueryClient();

      const key1 = ['secrets', 'list', 'all'];
      const key2 = ['secrets', 'detail', 1];
      const key3 = ['users', 'list'];

      queryClient.setEntry(key1, createMockEntry(key1));
      queryClient.setEntry(key2, createMockEntry(key2));
      queryClient.setEntry(key3, createMockEntry(key3));

      queryClient.invalidateQueries(['secrets']);

      expect(queryClient.getEntry(key1)?.updatedAt).toBe(0);
      expect(queryClient.getEntry(key2)?.updatedAt).toBe(0);
      expect(queryClient.getEntry(key3)?.updatedAt).not.toBe(0);
    });

    it('should invalidate with complex object filters', () => {
      const queryClient = useQueryClient();
      const key = ['todos', { status: 'done' }, 'page1'];
      queryClient.setEntry(key, createMockEntry(key));

      queryClient.invalidateQueries(['todos', { status: 'done' }]);

      expect(queryClient.getEntry(key)?.updatedAt).toBe(0);
    });

    it('should NOT invalidate if filter is longer than key', () => {
      const queryClient = useQueryClient();
      const key = ['secrets'];
      queryClient.setEntry(key, createMockEntry(key));

      queryClient.invalidateQuery(['secrets', 'list']);

      expect(queryClient.getEntry(key)?.updatedAt).not.toBe(0);
    });

    it('should NOT invalidate if parts do not match', () => {
      const queryClient = useQueryClient();
      const key = ['secrets', 'A'];
      queryClient.setEntry(key, createMockEntry(key));

      queryClient.invalidateQuery(['secrets', 'B']);

      expect(queryClient.getEntry(key)?.updatedAt).not.toBe(0);
    });

    it('should handle invalidation of non-existent keys gracefully', () => {
      const queryClient = useQueryClient();
      expect(() => {
        queryClient.invalidateQuery(['random-key']);
      }).not.toThrow();
    });
  });

  describe('Update Split (Entry vs Entries)', () => {
    it('updateEntry (singular) should update ONLY exact match', () => {
      const client = useQueryClient();
      const key1 = ['users', 1];
      const key2 = ['users', 1, 'details'];

      client.setEntry(key1, createMockEntry(key1, { name: 'Alex' }));
      client.setEntry(key2, createMockEntry(key2, { description: 'Info' }));

      client.updateEntry(key1, (old: any) => ({ ...old, name: 'Alexander' }));

      expect(client.getEntry(key1)?.data).toEqual({ name: 'Alexander' });
      expect(client.getEntry(key2)?.data).toEqual({ description: 'Info' });
    });

    it('updateEntries (plural) should update all fuzzy matches', () => {
      const client = useQueryClient();

      const keyList = ['posts', 'list'];
      const keyItem1 = ['posts', 1];
      const keyItem2 = ['posts', 2];
      const keyOther = ['comments', 1];

      // Исходные данные - просто объекты для теста
      client.setEntry(keyList, createMockEntry(keyList, { type: 'list' }));
      client.setEntry(
        keyItem1,
        createMockEntry(keyItem1, { type: 'item', id: 1 })
      );
      client.setEntry(
        keyItem2,
        createMockEntry(keyItem2, { type: 'item', id: 2 })
      );
      client.setEntry(keyOther, createMockEntry(keyOther, { type: 'comment' }));

      client.updateEntries(['posts'], (old: any) => {
        return { ...old, seen: true };
      });

      expect(client.getEntry(keyList)?.data).toMatchObject({
        type: 'list',
        seen: true,
      });
      expect(client.getEntry(keyItem1)?.data).toMatchObject({
        type: 'item',
        seen: true,
      });
      expect(client.getEntry(keyItem2)?.data).toMatchObject({
        type: 'item',
        seen: true,
      });
      expect(client.getEntry(keyOther)?.data).not.toHaveProperty('seen');
    });

    it('updateEntries should handle partial updates safely', () => {
      const client = useQueryClient();
      const key = ['data'];
      client.setEntry(key, createMockEntry(key, 10));

      client.updateEntries(['data'], (old: any) => old + 5);

      expect(client.getEntry(key)?.data).toBe(15);
    });
  });
});
