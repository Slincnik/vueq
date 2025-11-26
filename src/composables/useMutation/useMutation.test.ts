import { describe, expect, it, vi } from 'vitest';

import { useMutation } from '.';

describe('useMutation', () => {
  it('should be defined with initial status "idle"', () => {
    const { status, data, error, isIdle } = useMutation({
      mutationFn: async () => 'result',
    });
    expect(status.value).toBe('idle');
    expect(isIdle.value).toBe(true);
    expect(data.value).toBeUndefined();
    expect(error.value).toBeNull();
  });

  it('hould mutate successfully and update state', async () => {
    const mutationFn = vi.fn().mockResolvedValue('success data');
    const onSuccess = vi.fn();

    const { mutateAsync, status, data, isSuccess, isPending } = useMutation({
      mutationFn,
      onSuccess,
    });

    const promise = mutateAsync({ id: 1 });

    expect(status.value).toBe('pending');
    expect(isPending.value).toBe(true);

    await promise;

    expect(status.value).toBe('success');
    expect(isSuccess.value).toBe(true);
    expect(data.value).toBe('success data');
    expect(onSuccess).toHaveBeenCalledWith('success data', { id: 1 });
  });

  it('must handle errors correctly', async () => {
    const errorObj = new Error('Network fail');
    const mutationFn = vi.fn().mockRejectedValue(errorObj);
    const onError = vi.fn();

    const { mutateAsync, status, error, isError, failureCount } = useMutation({
      mutationFn,
      onError,
    });

    await expect(mutateAsync('test')).rejects.toThrow('Network fail');

    expect(status.value).toBe('error');
    expect(isError.value).toBe(true);
    expect(error.value).toBe(errorObj);
    expect(failureCount.value).toBe(1);
    expect(onError).toHaveBeenCalledWith(errorObj, 'test');
  });

  it('should store variables and allow state reset', async () => {
    const { mutateAsync, variables, reset, data, status, error } = useMutation({
      mutationFn: async (val: string) => val,
    });

    await mutateAsync('hello world');

    expect(variables.value).toBe('hello world');
    expect(data.value).toBe('hello world');
    expect(status.value).toBe('success');

    reset();

    expect(status.value).toBe('idle');
    expect(data.value).toBeUndefined();
    expect(variables.value).toBeUndefined();
    expect(error.value).toBeNull();
  });

  it('should execute local callbacks (onSuccess, onSettled, onError)', async () => {
    const mutationFn = async () => 'ok';

    const localOnSuccess = vi.fn();
    const settledCallback = vi.fn();
    const localOnError = vi.fn();

    const { mutateAsync } = useMutation({ mutationFn });

    await mutateAsync(undefined, {
      onSuccess: localOnSuccess,
      onSettled: settledCallback,
      onError: localOnError,
    });

    expect(localOnSuccess).toHaveBeenCalled();
    expect(settledCallback).toHaveBeenCalled();
    expect(localOnError).not.toHaveBeenCalled();

    vi.clearAllMocks();

    const errorFn = async () => {
      throw new Error('Network fail');
    };

    const { mutateAsync: mutateError } = useMutation({
      mutationFn: errorFn,
    });

    try {
      await mutateError(undefined, {
        onSuccess: localOnSuccess,
        onSettled: settledCallback,
        onError: localOnError,
      });
    } catch {
      // ignore error
    }

    expect(localOnSuccess).not.toHaveBeenCalled();
    expect(localOnError).toHaveBeenCalled();
    expect(settledCallback).toHaveBeenCalled();
  });
});
