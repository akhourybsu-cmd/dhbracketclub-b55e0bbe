/** JSONB transport may reorder object keys. Action sequence order still matters. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export const sameJSONState = (first: unknown, second: unknown) => JSON.stringify(canonical(first)) === JSON.stringify(canonical(second));
