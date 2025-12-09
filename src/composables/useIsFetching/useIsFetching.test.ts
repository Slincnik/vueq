import { describe, expect, it } from 'vitest';
import { useIsFetching } from '.';
import { useQueryClient } from '../QueryClient';
import { nextTick, ref } from 'vue';
import { serializeKey } from '@/utils';

describe('useIsFetching', () => {
  it('should return 0, if cache is empty', () => {
    const isFetching = useIsFetching();
    expect(isFetching.value).toBe(0);
  });

  it('should calculate ALL fetching queries, if filters not provided', () => {
    const query = useQueryClient();
    Object.assign(query.entries, {
      users: { fetchStatus: 'fetching' },
      posts: { fetchStatus: 'fetching' },
      comments: { fetchStatus: 'idle' },
    });

    const isFetching = useIsFetching();
    expect(isFetching.value).toBe(2);
  });

  it('should filters by query key', () => {
    const query = useQueryClient();
    Object.assign(query.entries, {
      users: { fetchStatus: 'fetching' },
      posts: { fetchStatus: 'fetching' },
      comments: { fetchStatus: 'idle' },
    });

    const isFetchingUsers = useIsFetching({ queryKey: 'users' });
    const isFetchingPosts = useIsFetching({ queryKey: 'posts' });
    const isFetchingComments = useIsFetching({ queryKey: 'comments' });

    expect(isFetchingUsers.value).toBe(1);
    expect(isFetchingPosts.value).toBe(1);
    expect(isFetchingComments.value).toBe(0);
  });

  it('should return 0, if no queries are fetching', () => {
    const query = useQueryClient();
    Object.assign(query.entries, {
      users: { fetchStatus: 'idle' },
      posts: { fetchStatus: 'idle' },
      comments: { fetchStatus: 'idle' },
    });

    const isFetching = useIsFetching();
    expect(isFetching.value).toBe(0);
  });

  it('should returns 0 if query key doesnt not exists', () => {
    const query = useQueryClient();
    Object.assign(query.entries, {
      users: { fetchStatus: 'idle' },
    });

    const isFetching = useIsFetching({ queryKey: 'posts' });
    expect(isFetching.value).toBe(0);
  });

  it('should consider hierarchical keys (arrays) and prefixes', () => {
    const query = useQueryClient();
    Object.assign(query.entries, {
      todos: { fetchStatus: 'fetching' },
      'todos,1': { fetchStatus: 'fetching' },
      'todos,list': { fetchStatus: 'fetching' },
      users: { fetchStatus: 'fetching' },
    });

    const isFetchingTodos = useIsFetching({ queryKey: 'todos' });

    expect(isFetchingTodos.value).toBe(3);
  });

  it('should not count keys that are similar but not a subset', () => {
    const query = useQueryClient();
    Object.assign(query.entries, {
      [serializeKey(['post'])]: { fetchStatus: 'fetching' },
      [serializeKey(['posts'])]: { fetchStatus: 'fetching' },
    });

    const isFetchingPost = useIsFetching({ queryKey: ['post'] });

    expect(isFetchingPost.value).toBe(1);
  });

  it('should be reactive when status changed', async () => {
    const query = useQueryClient();
    Object.assign(query.entries, {
      data: { fetchStatus: 'idle' },
    });

    const isFetching = useIsFetching();

    expect(isFetching.value).toBe(0);

    Object.assign(query.entries, {
      data: { fetchStatus: 'fetching' },
    });

    await nextTick();

    expect(isFetching.value).toBe(1);
  });

  it('should respond to queryKey changes', async () => {
    const query = useQueryClient();
    Object.assign(query.entries, {
      a: { fetchStatus: 'fetching' },
      b: { fetchStatus: 'fetching' },
    });

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
