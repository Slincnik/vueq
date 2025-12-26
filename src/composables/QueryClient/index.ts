import { inject, shallowReactive, type InjectionKey, type Plugin } from 'vue';
import type {
  CacheEntry,
  QueryListener,
  QueryEventType,
  QueryClientConfig,
} from '@/types';
import { serializeKey } from '@/utils';

const QUERY_CLIENT_KEY: InjectionKey<QueryClient> = Symbol('QueryClient');

export class QueryClient {
  public entries = shallowReactive(new Map<string, CacheEntry>());

  private gcTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  private listeners = new Set<QueryListener>();
  private controllers = new Map<string, AbortController>();
  private promises = new Map<string, Promise<any>>();

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

  getOrCreateController(key: string) {
    if (!this.controllers.has(key)) {
      this.controllers.set(key, new AbortController());
    }
    return this.controllers.get(key)!;
  }

  cancelRequest(key: string) {
    const controller = this.controllers.get(key);
    if (controller) {
      controller.abort();
      this.controllers.delete(key);
      this.promises.delete(key);
    }
  }

  getPromise(key: string) {
    return this.promises.get(key);
  }
  setPromise(key: string, promise: Promise<any>) {
    this.promises.set(key, promise);
  }
  deletePromise(key: string) {
    this.promises.delete(key);
    this.controllers.delete(key);
  }

  private notify(type: QueryEventType, key: string, entry?: CacheEntry) {
    this.listeners.forEach((listener) => listener({ type, key, entry }));
  }

  getEntry<T>(key: string | readonly any[]): CacheEntry<T> | undefined {
    return this.entries.get(serializeKey(key)) as CacheEntry<T> | undefined;
  }

  setEntry<T>(key: string | readonly any[], data: CacheEntry<T>) {
    const sKey = serializeKey(key);
    const isNew = !this.entries.has(sKey);

    this.entries.set(sKey, data);

    this.notify(isNew ? 'added' : 'updated', sKey, data);
  }

  removeEntry(key: string | readonly any[]) {
    this.deleteEntry(serializeKey(key));
  }

  private deleteEntry(sKey: string) {
    this.clearGcTimeout(sKey);
    if (this.entries.has(sKey)) {
      this.entries.delete(sKey);
      this.notify('removed', sKey);
    }
  }

  updateSubscribers(
    key: string | readonly any[],
    count: number,
    cacheTime: number
  ) {
    const sKey = serializeKey(key);
    const entry = this.entries.get(sKey);
    if (!entry) return;

    this.entries.set(sKey, { ...entry, subscribers: count });

    this.notify('updated', sKey, entry);

    if (count <= 0) {
      this.scheduleGc(sKey, cacheTime);
    } else {
      this.clearGcTimeout(sKey);
    }
  }

  private scheduleGc(key: string, time: number) {
    this.clearGcTimeout(key);

    const timeout = setTimeout(() => {
      this.deleteEntry(key);
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
    const entry = this.entries.get(sKey);
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
    const entry = this.entries.get(sKey);
    if (!entry) return;

    this.entries.set(sKey, { ...entry, updatedAt: 0 });
  }

  clear() {
    this.gcTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.gcTimeouts.clear();

    this.entries.clear();
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
