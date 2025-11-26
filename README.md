# @slincnik/vueq

A lightweight, zero-dependency (other than Vue) data fetching library for Vue 3.
Inspired by TanStack Query, built for simplicity and performance.

🚀 **Features:**

- **Caching & Garbage Collection:** Automatic cache management with configurable `staleTime` and `cacheTime`.
- **Request Deduplication:** Prevents multiple identical requests from firing simultaneously.
- **Auto Refetching:** automatically refetches data when keys change or cache becomes stale.
- **TypeScript Support:** Written in TS with full type inference.
- **Framework Agnostic:** Works with standard Vue 3 (without SSR).

## Installation

```bash
npm install @slincnik/vueq
# or
pnpm add @slincnik/vueq
# or
yarn add @slincnik/vueq
```

## Quick Start

```vue
<script setup lang="ts">
import { useFetch } from '@slincnik/vueq';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

// 1. Define a unique key (can be a string or an array)
// 2. Provide a fetcher function
const { data, isLoading, isError, error, refetch } = useFetch<Todo>(
  ['todo', 1],
  async (signal) => {
    const res = await fetch('https://jsonplaceholder.typicode.com/todos/1', {
      signal,
    });
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  },
  {
    staleTime: 5000, // Data is fresh for 5 seconds
    cacheTime: 1000 * 60 * 5, // Keep unused data in cache for 5 minutes
  }
);
</script>

<template>
  <div>
    <div v-if="isLoading">Loading...</div>
    <div v-else-if="isError">Error: {{ error }}</div>
    <div v-else-if="data">
      <h1>{{ data.title }}</h1>
      <button @click="refetch(true)">Force Update</button>
    </div>
  </div>
</template>
```

## DevTools Support 🛠

Inspect your cache, queries, and errors directly in Vue DevTools.

```typescript
// main.ts
import { createApp } from 'vue';
import { VueQDevtools } from '@slincnik/vueq';
import App from './App.vue';

const app = createApp(App);

// Enable DevTools
app.use(VueQDevtools);

app.mount('#app');
```

## API Reference

### `useFetch(key, fetcher, options?)`

- **key:** `string | any[] | MaybeRefOrGetter<string | any[]>` A unique identifier for the request. Can be a string or an array.
- **fetcher:** `(signal?: AbortSignal) => Promise<TData>` . The function that fetches data. Receives an AbortSignal for cancellation.
- **options:** Object (optional).

| Option              | Type                                      | Default     | Description                                          |
| ------------------- | ----------------------------------------- | ----------- | ---------------------------------------------------- |
| enabled             | boolean                                   | true        | Set to false to disable automatic fetching.          |
| initialData         | TData                                     | undefined   | Initial data to use until the first fetch completes. |
| staleTime           | number                                    | 0           | Time in ms before data is considered stale.          |
| cacheTime           | number                                    | 300000 (5m) | Time in ms unused data remains in memory.            |
| retry               | number                                    | 3           | Number of retry attempts on error.                   |
| retryDelay          | number                                    | 1000        | Delay in ms between retry attempts.                  |
| onSuccess           | (data: TSelected) => void                 | -           | Callback on successful fetch.                        |
| onError             | (error: unknown) => void                  | -           | Callback on error.                                   |
| onSettled           | (data: TSelected, error: unknown) => void | -           | Callback on successful fetch.                        |
| refetchOnKeyChange  | boolean                                   | true        | Whether to refetch immediately when the key changes. |
| enableAutoSyncCache | boolean                                   | true        | Whether to automatically sync cache with server.     |

## Returns

The hook returns an object with reactive refs and methods:

`data`: `Ref<TData | undefined>` - The resolved data.

`error`: `Ref<TError | undefined>` - The error object if the request failed.

`status`: `readonly<QueryStatus>` - The status of the query.

`fetchStatus`: `readonly<FetchStatus>` - The status of the fetch.

`isLoading`: `readonly<boolean>` - Whether the query is currently loading.

`isFetching`: `readonly<boolean>` - Whether the query is currently fetching.

`isError`: `readonly<boolean>` - Whether the query has failed.

`isSuccess`: `readonly<boolean>` - Whether the query has succeeded.

`isStale`: `readonly<boolean>` - Whether the query is stale.

`refetch(force?: boolean)` - Refetch the query.

`invalidate()` - Invalidate the query.

`setData(data: TData | undefined)` - Set the data of the query.

`onSuccess(callback: (data: TSelected) => void)` - Callback on successful fetch.

`onError(callback: (error: unknown) => void)` - Callback on error.

`onSettled(callback: (data: TSelected | undefined, error: unknown | undefined) => void)` - Callback on successful fetch or error.
