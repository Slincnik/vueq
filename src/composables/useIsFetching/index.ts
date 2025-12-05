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
    const allEntries = Object.entries(cache.entries);

    if (!allEntries.length) return 0;

    if (queryKey === undefined) {
      return allEntries.reduce((count, [, entry]) => {
        return entry.fetchStatus === 'fetching' ? count + 1 : count;
      }, 0);
    }

    const targetKey = serializeKey(queryKey);

    return allEntries.reduce((count, [key, entry]) => {
      if (entry.fetchStatus !== 'fetching') return count;

      if (key === targetKey) {
        return count + 1;
      }

      if (key.startsWith(targetKey + ',')) {
        return count + 1;
      }

      return count;
    }, 0);
  });
}
