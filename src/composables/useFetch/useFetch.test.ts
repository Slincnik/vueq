import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';

import { useQueryClient } from '@/composables/QueryClient';
import { useFetch } from '@/composables/useFetch';

describe('useFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('it should fetch data and update status', async () => {
    const mockData = { id: 1, name: 'Test' };
    const fetcher = vi.fn().mockResolvedValue(mockData);

    const scope = effectScope();

    await scope.run(async () => {
      const { data, status, isSuccess } = useFetch(['user', 1], fetcher);

      expect(status.value).toBe('pending');

      await vi.waitUntil(() => status.value === 'success');

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(status.value).toBe('success');
      expect(isSuccess.value).toBe(true);
      expect(data.value).toEqual(mockData);
    });

    scope.stop();
  });

  it('it should handle errors', async () => {
    const mockError = new Error('Network error');
    const fetcher = vi.fn().mockRejectedValue(mockError);

    const scope = effectScope();

    await scope.run(async () => {
      const { status, error } = useFetch(['user', 1], fetcher, {
        retry: 0,
      });

      expect(status.value).toBe('pending');
      await vi.waitUntil(() => status.value === 'error');

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(status.value).toBe('error');
      expect(error.value).toBe(mockError);
    });

    scope.stop();
  });

  it('it should take data from the cache and not make a request again if the data is fresh', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const queryClient = useQueryClient();
    queryClient.setEntry(['test'], {
      data: 'cached data',
      error: null,
      status: 'success',
      fetchStatus: 'idle',
      updatedAt: Date.now(),
      cacheTime: 5000,
      subscribers: 0,
    });

    const scope = effectScope();
    await scope.run(async () => {
      const { data, status } = useFetch(['test'], fetcher, {
        staleTime: 10000,
        refetchOnKeyChange: false,
      });

      expect(data.value).toBe('cached data');
      expect(status.value).toBe('success');

      await vi.runAllTimersAsync();

      expect(fetcher).not.toHaveBeenCalled();
      expect(data.value).toBe('cached data');
      expect(status.value).toBe('success');
    });
    scope.stop();
  });

  it('must make a repeat request if the data is outdated (stale)', async () => {
    const fetcher = vi.fn().mockResolvedValue('new data');
    const queryClient = useQueryClient();
    queryClient.setEntry(['old'], {
      data: 'old data',
      error: null,
      status: 'success',
      fetchStatus: 'idle',
      updatedAt: 0,
      cacheTime: 5000,
      subscribers: 0,
    });

    const scope = effectScope();
    await scope.run(async () => {
      const { data } = useFetch(['old'], fetcher, { staleTime: 1000 });

      expect(data.value).toBe('old data');

      await vi.runAllTimersAsync();

      expect(fetcher).toHaveBeenCalled();

      expect(data.value).toBe('new data');
    });
    scope.stop();
  });

  it('must deduplicate queries', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('shared'), 50))
      );

    const scope = effectScope();
    await scope.run(async () => {
      const query1 = useFetch(['shared'], fetcher);
      const query2 = useFetch(['shared'], fetcher);

      await vi.advanceTimersByTimeAsync(50);

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(query1.data.value).toBe('shared');
      expect(query2.data.value).toBe('shared');
    });
    scope.stop();
  });

  it('the invalidate function should call the refetch', async () => {
    const fetcher = vi.fn().mockResolvedValue('updated');

    const scope = effectScope();
    await scope.run(async () => {
      const { invalidate } = useFetch(['inv'], fetcher);

      await vi.runAllTimersAsync();
      expect(fetcher).toHaveBeenCalledTimes(1);

      invalidate();

      await vi.runAllTimersAsync();

      expect(fetcher).toHaveBeenCalledTimes(2);
    });
    scope.stop();
  });

  it('should not fetch when enabled is false, and fetch when it becomes true', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const isEnabled = ref(false);

    const scope = effectScope();
    await scope.run(async () => {
      const { status } = useFetch(['enabled-test'], fetcher, {
        enabled: isEnabled,
      });

      await vi.runAllTimersAsync();

      expect(fetcher).not.toHaveBeenCalled();
      expect(status.value).toBe('pending');

      isEnabled.value = true;

      await vi.waitUntil(() => status.value === 'success');

      expect(fetcher).toHaveBeenCalledTimes(1);
    });
    scope.stop();
  });

  it('should fetch new data when the query key changes', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation((key) => Promise.resolve(`data-${key}`));
    const id = ref(1);

    const scope = effectScope();
    await scope.run(async () => {
      const { data } = useFetch(
        () => ['user', id.value],
        () => fetcher(id.value)
      );

      await vi.runAllTimersAsync();
      expect(data.value).toBe('data-1');
      expect(fetcher).toHaveBeenCalledTimes(1);

      id.value = 2;

      await vi.waitUntil(() => data.value === 'data-2');

      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(data.value).toBe('data-2');
    });
    scope.stop();
  });

  it('should retry the request if it fails', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('Success');

    const scope = effectScope();
    await scope.run(async () => {
      const { data, status, isError } = useFetch(['retry-test'], fetcher, {
        retry: 2,
      });

      await vi.runAllTimersAsync();
      await vi.waitUntil(() => status.value === 'success');

      expect(fetcher).toHaveBeenCalledTimes(3);
      expect(isError.value).toBe(false);
      expect(data.value).toBe('Success');
    });
    scope.stop();
  });

  it('should transform data using the select option', async () => {
    const queryClient = useQueryClient();
    const rawData = { id: 1, largeData: '...' };
    const fetcher = vi.fn().mockResolvedValue(rawData);

    const scope = effectScope();
    await scope.run(async () => {
      const { data } = useFetch(['select-test'], fetcher, {
        select: (d: typeof rawData) => d.id,
      });

      await vi.waitUntil(() => data.value !== undefined);

      expect(data.value).toBe(1);

      const entry = queryClient.getEntry(['select-test']);
      expect(entry?.data).toEqual(rawData);
    });
    scope.stop();
  });

  it('should abort the request when the scope is stopped', async () => {
    let abortSignal: AbortSignal | undefined;

    const fetcher = vi.fn().mockImplementation((signal) => {
      abortSignal = signal;
      return new Promise(() => {});
    });

    const scope = effectScope();

    await scope.run(async () => {
      useFetch(['abort-test'], fetcher);
      await vi.runAllTimersAsync();
    });

    expect(fetcher).toHaveBeenCalled();
    expect(abortSignal).toBeDefined();
    expect(abortSignal?.aborted).toBe(false);

    scope.stop();

    expect(abortSignal?.aborted).toBe(true);
  });

  it('must call an external onSuccess', async () => {
    const mockData = { id: 1 };
    const fetcher = vi.fn().mockResolvedValue(mockData);

    const scope = effectScope();
    await scope.run(async () => {
      const { onSuccess, status } = useFetch(['key'], fetcher);

      const spy = vi.fn();

      onSuccess(spy);

      await vi.waitUntil(() => status.value === 'success');

      expect(spy).toHaveBeenCalledWith(mockData);
    });
    scope.stop();
  });
});
