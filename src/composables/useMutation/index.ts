import type {
  MutateOptions,
  MutationHookOptions,
  MutationStatus,
  UseMutationReturn,
} from '@/types';
import { computed, readonly, ref, type Ref } from 'vue';
import { useQueryClient } from '../QueryClient';

export function useMutation<TData = unknown, TError = Error, TVariables = void>(
  options: MutationHookOptions<TData, TError, TVariables>
): UseMutationReturn<TData, TError, TVariables> {
  const queryClient = useQueryClient();
  const {
    mutationFn,
    onSuccess: globalOnSuccess,
    onError: globalOnError,
    onSettled: globalOnSettled,
  } = options;

  const status = ref<MutationStatus>('idle');
  const data = ref<TData | undefined>();
  const error = ref<TError | null>(null);

  const variables = ref<TVariables | undefined>();
  const submittedAt = ref<number>(0);
  const failureCount = ref(0);

  const isPending = computed(() => status.value === 'pending');
  const isError = computed(() => status.value === 'error');
  const isSuccess = computed(() => status.value === 'success');
  const isIdle = computed(() => status.value === 'idle');

  function reset() {
    status.value = 'idle';
    data.value = undefined;
    error.value = null;
    variables.value = undefined;
    submittedAt.value = 0;
    failureCount.value = 0;
  }

  async function mutateAsync(
    vars: TVariables,
    mutateOptions?: MutateOptions<TData, TError, TVariables>
  ): Promise<TData> {
    status.value = 'pending';
    error.value = null;
    variables.value = vars;
    submittedAt.value = Date.now();

    try {
      const result = await mutationFn(vars);

      data.value = result;
      status.value = 'success';
      failureCount.value = 0;

      await mutateOptions?.onSuccess?.(result, vars);
      await globalOnSuccess?.(result, vars);

      queryClient.config.mutations?.onSuccess?.(result, vars);
      return result;
    } catch (err) {
      const errorObj = err as TError;
      error.value = errorObj;
      status.value = 'error';
      failureCount.value++;

      await mutateOptions?.onError?.(errorObj, vars);
      await globalOnError?.(errorObj, vars);
      queryClient.config.mutations?.onError?.(errorObj, vars);
      throw err;
    } finally {
      await mutateOptions?.onSettled?.(data.value, error.value, vars);
      await globalOnSettled?.(data.value, error.value, vars);
      queryClient.config.mutations?.onSettled?.(data.value, error.value, vars);
    }
  }

  function mutate(
    vars: TVariables,
    mutateOptions?: MutateOptions<TData, TError, TVariables>
  ) {
    mutateAsync(vars, mutateOptions).catch(() => {});
  }

  return {
    data: readonly(data) as Ref<TData | undefined>,
    error: readonly(error) as Ref<TError | null>,
    status: readonly(status),
    variables: readonly(variables) as Ref<TVariables | undefined>,
    submittedAt: readonly(submittedAt),
    failureCount: readonly(failureCount),

    isPending,
    isError,
    isSuccess,
    isIdle,

    mutate,
    mutateAsync,
    reset,
  };
}
