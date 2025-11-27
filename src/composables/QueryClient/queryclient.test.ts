import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQueryClient } from '.';
import type { CacheEntry } from '@/types';

// Хелпер для быстрого создания объекта записи
const createMockEntry = (
  data: unknown,
  subscribers = 0,
  cacheTime = 5000
): CacheEntry => ({
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
    const entry = createMockEntry('value');
    const queryClient = useQueryClient();

    queryClient.setEntry(key, entry);

    expect(queryClient.getEntry(key)).toEqual(entry);
    expect(queryClient.entries[key]).toEqual(entry);
  });

  it('should return undefined for non-existent keys', () => {
    const queryClient = useQueryClient();
    expect(queryClient.getEntry('404')).toBeUndefined();
  });

  it('should remove an entry manually', () => {
    const key = 'to-delete';
    const queryClient = useQueryClient();
    queryClient.setEntry(key, createMockEntry('data'));

    queryClient.removeEntry(key);

    expect(queryClient.getEntry(key)).toBeUndefined();
  });

  it('should schedule Garbage Collection when subscribers reach 0', () => {
    const key = 'gc-test';
    const cacheTime = 1000;
    const queryClient = useQueryClient();

    queryClient.setEntry(key, createMockEntry('data', 1, cacheTime));

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
    queryClient.setEntry(key, createMockEntry('data', 0, cacheTime));
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
    queryClient.setEntry(key, createMockEntry('data', 1));

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
    queryClient.setEntry(key1, createMockEntry('d1', 0));
    queryClient.updateSubscribers(key1, 0, 1000);

    queryClient.setEntry(key2, createMockEntry('d2', 1));

    queryClient.clear();

    expect(queryClient.getEntry(key1)).toBeUndefined();
    expect(queryClient.getEntry(key2)).toBeUndefined();
    expect(Object.keys(queryClient.entries).length).toBe(0);

    vi.runAllTimers();
  });

  it('should handle updateSubscribers for non-existent keys gracefully', () => {
    const queryClient = useQueryClient();
    expect(() => {
      queryClient.updateSubscribers('ghost-key', 1, 1000);
    }).not.toThrow();
  });
});
