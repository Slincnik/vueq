import type { Ref, MaybeRefOrGetter } from 'vue';

export type QueryStatus = 'pending' | 'success' | 'error';
export type FetchStatus = 'fetching' | 'paused' | 'idle';
export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

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

export interface MutateOptions<TData, TError, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables) => void | Promise<void>;
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables
  ) => void | Promise<void>;
}

export type MutationHookOptions<TData, TError, TVariables> = {
  mutationFn: (variables: TVariables) => Promise<TData>;
} & MutateOptions<TData, TError, TVariables>;

export interface UseMutationReturn<TData, TError, TVariables> {
  data: Ref<TData | undefined>;
  error: Ref<TError | null>;
  variables: Ref<TVariables | undefined>;
  isPending: Ref<boolean>;
  isSuccess: Ref<boolean>;
  isError: Ref<boolean>;
  isIdle: Ref<boolean>;
  submittedAt: Readonly<Ref<number>>;
  failureCount: Readonly<Ref<number>>;
  status: Ref<'idle' | 'pending' | 'success' | 'error'>;

  // Сама функция мутации
  mutate: (
    variables: TVariables,
    options?: MutateOptions<TData, TError, TVariables>
  ) => void;

  // Асинхронная версия (если есть)
  mutateAsync: (
    variables: TVariables,
    options?: MutateOptions<TData, TError, TVariables>
  ) => Promise<TData>;

  reset: () => void;
}
