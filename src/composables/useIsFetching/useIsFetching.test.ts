import { describe, expect, it } from 'vitest';
import { useIsFetching } from '.';
import { useQueryClient } from '../QueryClient';
import { nextTick, ref } from 'vue';

describe('useIsFetching', () => {
  const setFetchingEntry = (
    query: any,
    key: any,
    status: 'fetching' | 'idle' = 'fetching'
  ) => {
    query.setEntry(key, {
      fetchStatus: status,
      status: 'success',
      data: {},
      updatedAt: Date.now(),
    } as any);
  };

  it('should return 0, if cache is empty', () => {
    const isFetching = useIsFetching();
    expect(isFetching.value).toBe(0);
  });

  it('should calculate ALL fetching queries, if filters not provided', () => {
    const query = useQueryClient();
    setFetchingEntry(query, 'users', 'fetching');
    setFetchingEntry(query, 'posts', 'fetching');
    setFetchingEntry(query, 'comments', 'idle');

    const isFetching = useIsFetching();
    expect(isFetching.value).toBe(2);
  });

  it('should filters by query key', () => {
    const query = useQueryClient();
    setFetchingEntry(query, 'users', 'fetching');
    setFetchingEntry(query, 'posts', 'fetching');

    const isFetchingUsers = useIsFetching({ queryKey: 'users' });
    const isFetchingPosts = useIsFetching({ queryKey: 'posts' });
    const isFetchingComments = useIsFetching({ queryKey: 'comments' });

    expect(isFetchingUsers.value).toBe(1);
    expect(isFetchingPosts.value).toBe(1);
    expect(isFetchingComments.value).toBe(0);
  });

  it('should return 0, if no queries are fetching', () => {
    const query = useQueryClient();

    setFetchingEntry(query, 'users', 'idle');
    setFetchingEntry(query, 'posts', 'idle');
    setFetchingEntry(query, 'comments', 'idle');

    const isFetching = useIsFetching();
    expect(isFetching.value).toBe(0);
  });

  it('should returns 0 if query key doesnt not exists', () => {
    const query = useQueryClient();
    setFetchingEntry(query, 'users', 'idle');

    const isFetching = useIsFetching({ queryKey: 'posts' });
    expect(isFetching.value).toBe(0);
  });

  it('should consider hierarchical keys (arrays) and prefixes', () => {
    const query = useQueryClient();

    query.setEntry(['todos'], { fetchStatus: 'fetching' } as any);
    query.setEntry(['todos', 1], { fetchStatus: 'fetching' } as any);
    query.setEntry(['todos', 'list'], { fetchStatus: 'fetching' } as any);
    query.setEntry(['users'], { fetchStatus: 'fetching' } as any);

    const isFetchingTodos = useIsFetching({ queryKey: ['todos'] });

    expect(isFetchingTodos.value).toBe(3);
  });

  it('should not count keys that are similar but not a subset', () => {
    const query = useQueryClient();

    query.setEntry(['post'], { fetchStatus: 'fetching' } as any);
    query.setEntry(['posts'], { fetchStatus: 'fetching' } as any);

    const isFetchingPost = useIsFetching({ queryKey: ['post'] });

    expect(isFetchingPost.value).toBe(1);
  });

  it('should be reactive when status changed', async () => {
    const query = useQueryClient();
    setFetchingEntry(query, 'data', 'idle');

    const isFetching = useIsFetching();

    expect(isFetching.value).toBe(0);

    setFetchingEntry(query, 'data', 'fetching');

    await nextTick();

    expect(isFetching.value).toBe(1);
  });

  it('should respond to queryKey changes', async () => {
    const query = useQueryClient();
    setFetchingEntry(query, 'a', 'fetching');
    setFetchingEntry(query, 'b', 'fetching');

    const filterKey = ref('a');
    const isFetching = useIsFetching({ queryKey: filterKey });

    filterKey.value = 'b';
    await nextTick();

    expect(isFetching.value).toBe(1);

    filterKey.value = 'c';
    await nextTick();
    expect(isFetching.value).toBe(0);
  });
});
