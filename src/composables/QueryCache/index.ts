import { reactive } from 'vue';
import { CacheEntry } from '../../types';
import { serializeKey } from '../../utils';

class QueryClient {
  public entries = reactive<Record<string, CacheEntry>>({});

  private gcTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  getEntry<T>(key: string | readonly any[]): CacheEntry<T> | undefined {
    return this.entries[serializeKey(key)] as CacheEntry<T> | undefined;
  }

  setEntry<T>(key: string | readonly any[], data: CacheEntry<T>) {
    this.entries[serializeKey(key)] = data;
  }

  removeEntry(key: string | readonly any[]) {
    const sKey = serializeKey(key);
    this.clearGcTimeout(sKey);
    delete this.entries[sKey];
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

export const queryClient = new QueryClient();
