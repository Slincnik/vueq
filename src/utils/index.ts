import { type MaybeRefOrGetter, toValue } from 'vue';

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
