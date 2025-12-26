import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQueryClient } from '../QueryClient';
import { serializeKey } from '@/utils';

export interface UseIsFetchingFilters {
  queryKey?:
    | string
    | readonly unknown[]
    | MaybeRefOrGetter<string | readonly unknown[]>;
}

export function useIsFetching(filters: UseIsFetchingFilters = {}) {
  const cache = useQueryClient();

  return computed(() => {
    const queryKey = toValue(filters.queryKey);

    if (cache.entries.size === 0) return 0;

    if (queryKey === undefined) {
      let count = 0;
      for (const entry of cache.entries.values()) {
        if (entry.fetchStatus === 'fetching') count++;
      }
      return count;
    }

    const targetKey = serializeKey(queryKey);

    const arrayPrefix =
      targetKey.startsWith('[') && targetKey.endsWith(']')
        ? targetKey.slice(0, -1) + ','
        : null;

    let count = 0;

    for (const [key, entry] of cache.entries) {
      if (entry.fetchStatus !== 'fetching') continue;

      if (key === targetKey) {
        count++;
        continue;
      }

      if (arrayPrefix && key.startsWith(arrayPrefix)) {
        count++;
      }
    }

    return count;
  });
}
