import { inject, reactive, type InjectionKey, type Plugin } from 'vue';
import type {
  CacheEntry,
  QueryListener,
  QueryEventType,
  QueryClientConfig,
} from '@/types';
import { serializeKey } from '@/utils';

const QUERY_CLIENT_KEY: InjectionKey<QueryClient> = Symbol('QueryClient');

export class QueryClient {
  public entries = reactive<Record<string, CacheEntry>>({});

  private gcTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  private listeners = new Set<QueryListener>();

  public config: QueryClientConfig;

  constructor(config: QueryClientConfig = {}) {
    this.config = config;
  }

  /**
   * Subscribe to cache changes.
   * Useful for DevTools or custom loggers.
   */
  subscribe(listener: QueryListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(type: QueryEventType, key: string, entry?: CacheEntry) {
    this.listeners.forEach((listener) => listener({ type, key, entry }));
  }

  getEntry<T>(key: string | readonly any[]): CacheEntry<T> | undefined {
    return this.entries[serializeKey(key)] as CacheEntry<T> | undefined;
  }

  setEntry<T>(key: string | readonly any[], data: CacheEntry<T>) {
    const sKey = serializeKey(key);
    const isNew = !this.entries[sKey];
    this.entries[sKey] = data;

    // Уведомляем
    this.notify(isNew ? 'added' : 'updated', sKey, data);
  }

  removeEntry(key: string | readonly any[]) {
    const sKey = serializeKey(key);
    this.clearGcTimeout(sKey);
    delete this.entries[sKey];
    this.notify('removed', sKey);
  }

  updateSubscribers(
    key: string | readonly any[],
    count: number,
    cacheTime: number
  ) {
    const sKey = serializeKey(key);
    const entry = this.entries[sKey];
    if (!entry) return;

    entry.subscribers = count;

    this.notify('updated', sKey, entry);

    if (entry.subscribers <= 0) {
      this.scheduleGc(sKey, cacheTime);
    } else {
      this.clearGcTimeout(sKey);
    }
  }

  private scheduleGc(key: string, time: number) {
    this.clearGcTimeout(key);

    console.debug(`[QueryClient] GC scheduled for "${key}" in ${time}ms`);

    const timeout = setTimeout(() => {
      console.debug(`[QueryClient] GC deleting "${key}"`);
      this.removeEntry(key);
    }, time);

    this.gcTimeouts.set(key, timeout);
  }

  // Очистка таймера
  private clearGcTimeout(key: string) {
    const timeout = this.gcTimeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.gcTimeouts.delete(key);
    }
  }

  updateEntry<T>(
    key: string | readonly any[],
    updater: (old: T | undefined) => T | undefined
  ) {
    const sKey = serializeKey(key);
    const entry = this.entries[sKey];
    if (!entry) return;

    const prevData = entry.data as T | undefined;
    const newData = updater(prevData);

    this.setEntry(sKey, {
      ...entry,
      data: newData,
      status: newData !== undefined ? 'success' : 'pending',
      updatedAt: Date.now(),
    });
  }

  invalidateQuery(key: string | readonly any[]) {
    const sKey = serializeKey(key);
    const entry = this.entries[sKey];
    if (!entry) return;

    entry.updatedAt = 0;
  }

  clear() {
    this.gcTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.gcTimeouts.clear();

    for (const key in this.entries) {
      delete this.entries[key];
    }
  }
}

export const VueQQueryPlugin: Plugin = {
  install(app, options: QueryClientConfig = {}) {
    const client = new QueryClient(options);
    app.provide(QUERY_CLIENT_KEY, client);
  },
};

export function useQueryClient(): QueryClient {
  const client = inject(QUERY_CLIENT_KEY);
  if (!client) {
    throw new Error('useQueryClient must be used within a VueQQueryPlugin');
  }
  return client;
}
