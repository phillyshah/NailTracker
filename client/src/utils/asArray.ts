/**
 * Coerce an API payload that is supposed to be a list into a real array.
 *
 * `const { data: xs = [] } = useQuery(...)` only falls back when the value is
 * `undefined`. A `null` or an unexpected object (which an API can return on a
 * partial failure, a proxy error page, or a schema change) slips straight
 * through the default and reaches `xs.map(...)`, which throws and takes the
 * whole page down. Normalising at the API boundary means every list consumer
 * can rely on getting an array.
 */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
