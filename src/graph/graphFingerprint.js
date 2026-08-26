function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = sortKeys(value[key]);
    return out;
  }, {});
}

export function stableStringify(value) {
  return JSON.stringify(sortKeys(value));
}

export function canonicalizeHyperedge(hyperedge) {
  return {
    id: String(hyperedge?.id ?? ""),
    vertices: [...(hyperedge?.vertices ?? [])].map(vertex => String(vertex)),
    time: hyperedge?.time ?? null,
    weight: Number.isFinite(Number(hyperedge?.weight)) ? Number(hyperedge.weight) : 1,
    attributes: sortKeys(hyperedge?.attributes && typeof hyperedge.attributes === "object" && !Array.isArray(hyperedge.attributes)
      ? hyperedge.attributes
      : {}),
  };
}

export function canonicalizeGraph(hyperedges = []) {
  return [...(hyperedges ?? [])]
    .map(canonicalizeHyperedge)
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" }));
}

export function graphFingerprint(hyperedges = []) {
  const serialized = stableStringify(canonicalizeGraph(hyperedges));
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `gfp-${(hash >>> 0).toString(16).padStart(8, "0")}-${serialized.length}`;
}

