import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref, nextTick } from 'vue';

import { useQueryClient } from '@/composables/QueryClient';
import { useFetch } from '@/composables/useFetch';
import { setTestClient } from '@/helpers/test';

describe('useFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
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

  it('isStale property should become true automatically after staleTime', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');

    const scope = effectScope();
    await scope.run(async () => {
      const { status, isStale } = useFetch(['stale-reactivity'], fetcher, {
        staleTime: 2000,
      });

      await vi.waitUntil(() => status.value === 'success');

      expect(isStale.value).toBe(false);

      await vi.advanceTimersByTimeAsync(1000);
      expect(isStale.value).toBe(false);

      // Added 2000 because reactivity updates "by steps": 0, 1000, 2000 ...
      // If staleTime is 2000, by data loading not in 0.0000ms, a little bit later, then in 2000 steps, we are mathematically "no stale"
      await vi.advanceTimersByTimeAsync(2000);

      expect(isStale.value).toBe(true);
    });
    scope.stop();
  });

  it('should NOT refetch on key change if data is fresh and refetchOnKeyChange is false', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const key = ref('key-1');
    const queryClient = useQueryClient();

    const now = Date.now();
    queryClient.setEntry('key-1', {
      data: 'data-1',
      updatedAt: now,
      status: 'success',
      fetchStatus: 'idle',
      error: null,
      subscribers: 0,
      cacheTime: 5000,
    });
    queryClient.setEntry('key-2', {
      data: 'data-2',
      updatedAt: now,
      status: 'success',
      fetchStatus: 'idle',
      error: null,
      subscribers: 0,
      cacheTime: 5000,
    });

    const scope = effectScope();
    await scope.run(async () => {
      const { data } = useFetch(key, fetcher, {
        staleTime: 5000,
        refetchOnKeyChange: false,
      });

      expect(data.value).toBe('data-1');
      expect(fetcher).not.toHaveBeenCalled();

      key.value = 'key-2';
      await nextTick();

      expect(data.value).toBe('data-2');
      expect(fetcher).not.toHaveBeenCalled();
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

      await vi.advanceTimersByTimeAsync(100);

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

      await vi.advanceTimersByTimeAsync(1000);

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
      const { invalidate, status } = useFetch(['inv'], fetcher);

      await vi.waitUntil(() => status.value === 'success');
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

      await vi.waitUntil(() => data.value === 'data-1');
      expect(fetcher).toHaveBeenCalledTimes(1);

      id.value = 2;

      await vi.waitUntil(() => data.value === 'data-2');

      expect(fetcher).toHaveBeenCalledTimes(2);
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
        retryDelay: 100,
      });

      await vi.runAllTimersAsync();

      expect(status.value).toBe('success');
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
      await nextTick();
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
      const { onSuccess, status } = useFetch(['key-events'], fetcher);

      const spy = vi.fn();
      onSuccess(spy);

      await vi.waitUntil(() => status.value === 'success');

      expect(spy).toHaveBeenCalledWith(mockData);
    });
    scope.stop();
  });

  it('must call an global queries callbacks (onSuccess, onSettled, onError)', async () => {
    const onSuccess = vi.fn();
    const onSettled = vi.fn();
    const onError = vi.fn();

    setTestClient({
      queries: { onSuccess, onSettled, onError },
    });

    const mockData = { id: 1 };
    const fetcher = vi.fn().mockResolvedValue(mockData);

    const scope = effectScope();
    await scope.run(async () => {
      const { status } = useFetch('key-global', fetcher);

      await vi.waitUntil(() => status.value === 'success');

      expect(onSuccess).toHaveBeenCalledWith(mockData, 'key-global');
      expect(onSettled).toHaveBeenCalledWith(mockData, null, 'key-global');
    });
    scope.stop();

    vi.clearAllMocks();

    const error = new Error('test');
    const fetcherError = vi.fn().mockRejectedValue(error);

    const scope2 = effectScope();
    await scope2.run(async () => {
      const { status } = useFetch('key-global-err', fetcherError, {
        retry: 0,
      });

      await vi.waitUntil(() => status.value === 'error');

      expect(onError).toHaveBeenCalledWith(error, 'key-global-err');
    });
    scope2.stop();
  });

  it('if refetchOnKeyChange is false, it should not refetch', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 1 });
    const key = ref('key-1');
    const scope = effectScope();

    await scope.run(async () => {
      const { status, data, isLoading } = useFetch(key, fetcher, {
        refetchOnKeyChange: false,
      });

      await vi.waitUntil(() => status.value === 'success');

      key.value = 'key-2';

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(data.value).toStrictEqual({ id: 1 });
      expect(status.value).toBe('pending');
      expect(isLoading.value).toBe(false);
    });
    scope.stop();
  });

  it('should returned static queryKey in fetcher', async () => {
    const fetcherSpy = vi.fn().mockResolvedValue('ok');

    const key = ['users', 'list'];

    const scope = effectScope();
    scope.run(async () => {
      useFetch(key, fetcherSpy);

      await nextTick();

      expect(fetcherSpy).toHaveBeenCalledTimes(1);

      const callArgs = fetcherSpy.mock.calls[0][1];

      expect(callArgs).toEqual(key);
    });
  });

  it('should returned dynamic queryKey in fetcher', async () => {
    const fetcherSpy = vi.fn().mockResolvedValue('ok');
    const id = ref(100);

    const scope = effectScope();
    scope.run(async () => {
      useFetch(['users', id], fetcherSpy);

      await nextTick();

      const callArgs = fetcherSpy.mock.calls[0][1];

      expect(callArgs).toEqual(['users', 100]);

      id.value = 200;

      await vi.waitUntil(() => fetcherSpy.mock.calls.length === 2);

      expect(fetcherSpy).toBeCalledWith(['users', 200]);
    });
  });

  it('should update local data immediately when `setData` is called with a value', () => {
    const fetcherSpy = vi.fn().mockResolvedValue('ok');
    const scope = effectScope();
    scope.run(() => {
      const queryClient = useQueryClient();
      const { data, setData } = useFetch('test-key', fetcherSpy);

      expect(data.value).toBeUndefined();

      setData('new-data');

      expect(data.value).toBe('new-data');
      expect(queryClient.getEntry('test-key')?.data).toBe('new-data');
    });
  });

  it('should update local data useing a fucntional updater', () => {
    const fetcherSpy = vi.fn().mockResolvedValue('ok');
    const scope = effectScope();

    scope.run(() => {
      const queryClient = useQueryClient();
      const initialObj = { name: 'John', age: 25 };

      const { data, setData } = useFetch('test-key', fetcherSpy, {
        initialData: initialObj,
      });

      expect(data.value).toBeDefined();

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          age: 26,
        };
      });

      expect(data.value).toEqual({ name: 'John', age: 26 });
      expect(data.value?.age).toBe(26);
      expect(queryClient.getEntry('test-key')?.data).toEqual({
        name: 'John',
        age: 26,
      });
    });
  });

  it('should sync updates between two instances useing the same key', () => {
    const fetcherSpy = vi.fn().mockResolvedValue('ok');
    const scope = effectScope();

    scope.run(async () => {
      const { data: data1, setData: setData1 } = useFetch(
        'test-key',
        fetcherSpy
      );

      const { data: data2 } = useFetch('test-key', fetcherSpy);

      expect(data1.value).toBeUndefined();
      expect(data2.value).toBeUndefined();

      setData1('shared-value');
      expect(data1.value).toBe('shared-value');
      await nextTick();
      expect(data2.value).toBe('shared-value');
    });
  });
});
