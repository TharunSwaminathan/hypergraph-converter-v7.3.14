const owned = new WeakSet();
const sizes = new WeakMap();
export function isOwnedGraph(value) { return Array.isArray(value) && owned.has(value); }
// Only module-owned deeply immutable snapshots qualify for reference reuse.
export function ownGraph(hyperedges = []) {
  if (isOwnedGraph(hyperedges)) return hyperedges;
  const copy = structuredClone(hyperedges);
  deepFreeze(copy);
  // Date/Map/Set and typed arrays can mutate internal slots despite freeze.
  // Such legacy inputs remain detached copies but never enter shared caches.
  if (isPlainData(copy)) owned.add(copy);
  return copy;
}
export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (ArrayBuffer.isView(value) && value.byteLength) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function isPlainData(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  return Object.values(value).every(child => isPlainData(child, seen));
}
// Deterministic UTF-16 JSON accounting; not an engine heap estimate.
export function graphSnapshotBytes(rows) {
  if (isOwnedGraph(rows) && sizes.has(rows)) return sizes.get(rows);
  const bytes = JSON.stringify(rows ?? []).length * 2;
  if (isOwnedGraph(rows)) sizes.set(rows, bytes);
  return bytes;
}
