import {
  computed,
  type DeepReadonly,
  getCurrentScope,
  type MaybeRefOrGetter,
  onScopeDispose,
  readonly,
  shallowRef,
  toValue,
  watch,
} from 'vue';
import { catchError, serializeKey, useTimestamp } from '@/utils';
import type {
  FetchStatus,
  QueryStatus,
  UseFetchReturn,
  UseQueryOptions,
} from '@/types';
import { useQueryClient } from '../QueryClient';

function createEventHook<T extends (...args: any[]) => any>() {
  const fns = new Set<T>();

  const on = (fn: T) => {
    fns.add(fn);
    if (getCurrentScope()) {
      onScopeDispose(() => fns.delete(fn));
    }

    return () => fns.delete(fn);
  };

  const trigger = (...args: Parameters<T>) => {
    fns.forEach((fn) => fn(...args));
  };

  return { on, trigger };
}

async function runFetcher<T>(
  fetcher: () => Promise<T>,
  retry: number,
  retryDelay: number
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retry; attempt++) {
    const [err, data] = await catchError(fetcher());
    if (!err) return data as T;
    lastError = err;
    if (attempt < retry) await new Promise((r) => setTimeout(r, retryDelay));
  }
  throw lastError;
}

const requestPromises = new Map<string, Promise<void>>();

// @ts-nocheck
export function useFetch<TData = unknown, TError = unknown, TSelected = TData>(
  queryKey: string | readonly any[] | MaybeRefOrGetter<string | readonly any[]>,
  fetcher: (
    signal?: AbortSignal,
    queryKey: string | readonly any[]
  ) => Promise<TData>,
  options: UseQueryOptions<TData, TSelected> = {}
): UseFetchReturn<TData, TError, TSelected> {
  const queryClient = useQueryClient();
  const rawKey = computed(() => {
    if (Array.isArray(queryKey)) {
      return queryKey.map((item) => toValue(item));
    }
    return toValue(queryKey);
  });
  const key = computed(() => serializeKey(rawKey.value));
  const {
    enabled = true,
    initialData,
    staleTime = 0,
    cacheTime = 5 * 60 * 1000, // 5 min
    retry = 3,
    retryDelay = 1000,
    select,
    onSettled,
    onError,
    onSuccess,
    onSynced,
    refetchOnKeyChange = true,
    keepPreviousData = false,
    enableAutoSyncCache = true,
  } = options;

  const { now, pause } = useTimestamp();

  if (staleTime === 0 || staleTime === Infinity) {
    pause();
  }

  const successEvent = createEventHook<(data: TSelected) => void>();
  const errorEvent = createEventHook<(err: TError) => void>();
  const settledEvent = createEventHook<(d?: TSelected, e?: TError) => void>();

  const getSelectedData = (rawData: TData): TSelected => {
    return select ? select(rawData) : (rawData as unknown as TSelected);
  };

  const getInitialState = () => {
    const entry = queryClient.getEntry(key.value);
    if (entry?.data !== undefined) return getSelectedData(entry.data as TData);
    if (initialData !== undefined) return getSelectedData(initialData);
    return undefined;
  };

  const data = shallowRef<TSelected | undefined>(getInitialState());
  const currentEntry = computed(() => queryClient.getEntry(key.value));

  const status = computed<QueryStatus>(
    () => currentEntry.value?.status ?? 'pending'
  );
  const fetchStatus = computed<FetchStatus>(
    () => currentEntry.value?.fetchStatus ?? 'idle'
  );
  const error = computed<TError | undefined>(
    () => currentEntry.value?.error as TError
  );

  const isLoading = computed(() => {
    if (data.value !== undefined) return false;
    return status.value === 'pending';
  });
  const isError = computed(() => status.value === 'error');
  const isSuccess = computed(() => status.value === 'success');
  const isFetching = computed(() => fetchStatus.value === 'fetching');
  const isEnabled = computed(() => toValue(enabled));

  const isStale = computed(() => {
    const entry = currentEntry.value;

    if (!entry || entry.data === undefined) return true;
    if (staleTime === 0) return true;

    if (staleTime === Infinity) return false;

    return now.value - entry.updatedAt >= staleTime;
  });

  const updateEntry = (
    partial: Partial<typeof currentEntry.value>,
    newKey?: string
  ) => {
    const entry = queryClient.entries[newKey ?? key.value];
    if (entry) {
      queryClient.setEntry(key.value, { ...entry, ...partial });
    }
  };

  let abortController: AbortController | undefined;

  async function internalFetch(force = false) {
    const fetchKey = key.value;
    if (!isEnabled.value && !force) return;

    if (
      requestPromises.has(fetchKey) &&
      currentEntry.value?.fetchStatus === 'fetching'
    ) {
      return requestPromises.get(fetchKey);
    }

    const entry = queryClient.getEntry(fetchKey);

    if (!force && !isStale.value) return;

    abortController?.abort();
    abortController = new AbortController();

    if (!entry) {
      queryClient.setEntry(fetchKey, {
        data: undefined,
        error: null,
        status: 'pending',
        fetchStatus: 'fetching',
        updatedAt: 0,
        cacheTime,
        subscribers: 1,
      });
    } else {
      updateEntry(
        {
          fetchStatus: 'fetching',
          error: 'null',
        },
        fetchKey
      );
    }

    const promise = (async () => {
      try {
        const result = await runFetcher(
          () => fetcher(abortController?.signal, rawKey.value),
          retry,
          retryDelay
        );

        // Успех
        const prevEntry = queryClient.getEntry(fetchKey);
        queryClient.setEntry(fetchKey, {
          ...prevEntry!,
          data: result,
          error: null,
          status: 'success',
          fetchStatus: 'idle',
          updatedAt: Date.now(),
          cacheTime,
        });

        const selected = getSelectedData(result);
        data.value = selected;
        onSuccess?.(selected);
        successEvent.trigger(selected);
        queryClient.config.queries?.onSuccess?.(selected, fetchKey);
      } catch (err) {
        updateEntry(
          {
            status: 'error',
            fetchStatus: 'idle',
            error: err as TError,
          },
          fetchKey
        );
        onError?.(err);
        errorEvent.trigger(err as TError);
        queryClient.config.queries?.onError?.(err, fetchKey);
      } finally {
        requestPromises.delete(fetchKey);
        onSettled?.(data.value, error.value);
        settledEvent.trigger(data.value, error.value);
        queryClient.config.queries?.onSettled?.(
          data.value,
          error.value,
          fetchKey
        );
      }
    })();

    requestPromises.set(fetchKey, promise);
    return promise;
  }

  const refetch = (force = false) => internalFetch(force);
  const invalidate = () => {
    updateEntry({ updatedAt: 0 });
    internalFetch();
  };

  const setData = (
    updater: TData | ((prev?: DeepReadonly<TData>) => TData | undefined)
  ) => {
    const entry = queryClient.getEntry(rawKey.value);
    const prevData = entry?.data as TData | undefined;
    const func =
      typeof updater === 'function'
        ? (updater as (prev?: TData) => TData)
        : () => updater;

    const newData = func(prevData);

    if (newData !== undefined) {
      const selectedNewData = getSelectedData(newData);
      data.value = selectedNewData;
      onSynced?.(data.value);
    } else {
      data.value = undefined;
    }
    queryClient.updateEntry<TData>(rawKey.value, func);
  };

  watch(
    key,
    (newKey, oldKey) => {
      if (oldKey) {
        const oldEntry = queryClient.getEntry(oldKey);
        if (oldEntry)
          queryClient.updateSubscribers(
            oldKey,
            oldEntry.subscribers - 1,
            cacheTime
          );
      }
      if (newKey) {
        const entry = queryClient.getEntry(newKey);
        if (!entry) {
          queryClient.setEntry(newKey, {
            data: initialData,
            error: null,
            status: initialData !== undefined ? 'success' : 'pending',
            fetchStatus: 'idle',
            updatedAt: initialData !== undefined ? Date.now() : 0,
            cacheTime,
            subscribers: 1,
          });
        } else {
          queryClient.updateSubscribers(
            newKey,
            entry.subscribers + 1,
            cacheTime
          );
        }
      }
    },
    { immediate: true }
  );

  watch(
    [key, isEnabled],
    ([newKey, newEnabled], [oldKey]) => {
      if (!newEnabled) return;
      const isKeyChanged = oldKey !== undefined && newKey !== oldKey;

      if (isKeyChanged && !refetchOnKeyChange) {
        return;
      }

      const entry = queryClient.getEntry(newKey);
      const shouldFetch =
        !entry ||
        (entry.updatedAt === 0 && entry.status === 'pending') ||
        isStale.value;

      if (shouldFetch) {
        if (!keepPreviousData && isKeyChanged) {
          data.value = undefined;
        }
        internalFetch();
      } else {
        if (entry?.data !== undefined) {
          data.value = getSelectedData(entry.data as TData);
        }
      }
    },
    { immediate: true }
  );

  watch(
    () => [
      queryClient.entries[key.value]?.data,
      queryClient.entries[key.value]?.updatedAt,
    ],
    ([newData, newUpdated], [oldData, oldUpdated]) => {
      if (!enableAutoSyncCache) return;

      const hasChanged = newData !== oldData || newUpdated !== oldUpdated;

      if (hasChanged) {
        if (newData !== undefined) {
          data.value = getSelectedData(newData as TData);
          onSynced?.(data.value);
        } else {
          if (!keepPreviousData) {
            data.value = undefined;
          }
        }
      }
    }
  );

  onScopeDispose(() => {
    const k = key.value;
    const entry = queryClient.getEntry(k);
    if (entry) {
      queryClient.updateSubscribers(
        k,
        Math.max(0, entry.subscribers - 1),
        cacheTime
      );
    }
    abortController?.abort();
  });

  return {
    data,
    error,
    status: readonly(status),
    fetchStatus: readonly(fetchStatus),
    isLoading: readonly(isLoading),
    isFetching: readonly(isFetching),
    isError: readonly(isError),
    isSuccess: readonly(isSuccess),
    isStale,
    refetch,
    invalidate,
    setData,
    onSuccess: successEvent.on,
    onError: errorEvent.on,
    onSettled: settledEvent.on,
  };
}
