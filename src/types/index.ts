import { type MaybeRefOrGetter } from "vue";

export type QueryStatus = "pending" | "success" | "error";
export type FetchStatus = "fetching" | "paused" | "idle";

export interface UseQueryOptions<TData, TSelected = TData> {
  enabled?: boolean | MaybeRefOrGetter<boolean>;
  initialData?: TData;
  staleTime?: number;
  cacheTime?: number;
  retry?: number;
  retryDelay?: number;
  select?: (data: TData) => TSelected;
  onSuccess?: (data: TSelected) => void;
  onError?: (error: unknown) => void;
  onSettled?: (data: TSelected | undefined, error: unknown) => void;
  onSynced?: (data: TSelected) => void;
  refetchOnKeyChange?: boolean;
  enableAutoSyncCache?: boolean;
}

export interface CacheEntry<TData = unknown> {
  data: TData | undefined;
  error: unknown | undefined;
  updatedAt: number;
  cacheTime: number;
  subscribers: number;
  status: QueryStatus;
  fetchStatus: FetchStatus;
}
