import {
  getCurrentScope,
  type MaybeRefOrGetter,
  onScopeDispose,
  shallowReadonly,
  shallowRef,
  toValue,
} from 'vue';

export function serializeKey(
  raw: string | readonly any[] | MaybeRefOrGetter<string | readonly any[]>
) {
  const resolved = Array.isArray(raw)
    ? raw.map((item) => toValue(item))
    : toValue(raw);

  if (typeof resolved === 'string') return resolved;
  if (Array.isArray(resolved)) return resolved.join(',');

  return JSON.stringify(resolved);
}

export async function catchError<T>(
  promise: Promise<T>
): Promise<[undefined, T] | [unknown, undefined]> {
  try {
    const data = await promise;
    return [undefined, data];
  } catch (error) {
    return [error, undefined];
  }
}

const sharedNow = shallowRef(Date.now());
const subscribers = new Set<symbol>();
let sharedTimer: ReturnType<typeof setInterval> | undefined;

function updateSharedTimer() {
  if (subscribers.size > 0) {
    // If has subscribers and timer is disabled — enable it
    if (!sharedTimer) {
      sharedNow.value = Date.now();
      sharedTimer = setInterval(() => {
        sharedNow.value = Date.now();
      }, 1000);

      // Optimization UX: update time immediately when tab becomes active
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
      }
    }
  } else {
    // If no subscribers — disable timer for resource saving
    if (sharedTimer) {
      clearInterval(sharedTimer);
      sharedTimer = undefined;

      if (typeof document !== 'undefined') {
        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange
        );
      }
    }
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    sharedNow.value = Date.now();
  }
}

export function useTimestamp() {
  const id = Symbol('timestamp-subscriber');

  const resume = () => {
    if (!subscribers.has(id)) {
      subscribers.add(id);
      updateSharedTimer();
    }
  };

  const pause = () => {
    if (subscribers.has(id)) {
      subscribers.delete(id);
      updateSharedTimer();
    }
  };

  if (getCurrentScope()) {
    onScopeDispose(pause);
  }

  // immediately start
  resume();

  return { now: shallowReadonly(sharedNow), pause, resume };
}
