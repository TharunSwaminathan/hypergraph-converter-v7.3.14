export function stablePlanFingerprint(value) {
  const text = JSON.stringify(value ?? {});
  let hash = 5381;
  for (const char of text) hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  return `plan-${hash.toString(16).padStart(8, "0")}`;
}
