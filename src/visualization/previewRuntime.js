export const PREVIEW_LIMIT_MIN = 1;
export const PREVIEW_LIMIT_MAX = 10000;
export const PREVIEW_SEARCH_MAX_LENGTH = 240;

export function parsePreviewLimitInput(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) {
    return { ok: false, value: null, error: `Enter a whole number from ${PREVIEW_LIMIT_MIN.toLocaleString()} to ${PREVIEW_LIMIT_MAX.toLocaleString()}.` };
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < PREVIEW_LIMIT_MIN || parsed > PREVIEW_LIMIT_MAX) {
    return { ok: false, value: null, error: `Preview size must be from ${PREVIEW_LIMIT_MIN.toLocaleString()} to ${PREVIEW_LIMIT_MAX.toLocaleString()} hyperedges.` };
  }
  return { ok: true, value: parsed, error: null };
}

export function resolvePreviewSearch(vertices, query) {
  const normalizedQuery = String(query ?? "").trim().toLowerCase();
  if (!normalizedQuery) return null;
  const exact = vertices.find(vertex => String(vertex).toLowerCase() === normalizedQuery);
  if (exact !== undefined) return exact;
  const partial = vertices.find(vertex => String(vertex).toLowerCase().includes(normalizedQuery));
  return partial === undefined ? null : partial;
}

export function resolvePreviewHyperedgeSearch(hyperedges, query) {
  const normalizedQuery = String(query ?? "").trim().toLowerCase();
  if (!normalizedQuery || normalizedQuery.length > PREVIEW_SEARCH_MAX_LENGTH) return [];
  const matches = (hyperedges ?? []).filter(hyperedge => String(hyperedge?.id ?? "").toLowerCase().includes(normalizedQuery));
  const exact = matches.filter(hyperedge => String(hyperedge.id).toLowerCase() === normalizedQuery);
  return exact.length ? exact : matches;
}


export function shouldDisplayWeight(weight) {
  return weight !== null && weight !== undefined && weight !== 1;
}

export function hyperedgeMetadata(hyperedge) {
  const entries = [
    ["vertices", hyperedge.vertices.join(", ")],
    ["cardinality", String(hyperedge.vertices.length)],
  ];
  if (hyperedge.time !== null && hyperedge.time !== undefined) entries.push(["time", String(hyperedge.time)]);
  if (shouldDisplayWeight(hyperedge.weight)) entries.push(["weight", String(hyperedge.weight)]);
  return entries;
}

export function computeCanvasBackingSize(cssWidth, cssHeight, devicePixelRatio = 1) {
  const width = Math.max(1, Number.isFinite(cssWidth) ? cssWidth : 1);
  const height = Math.max(1, Number.isFinite(cssHeight) ? cssHeight : 1);
  const dpr = Math.min(3, Math.max(1, Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1));
  return Object.freeze({
    cssWidth: width,
    cssHeight: height,
    dpr,
    backingWidth: Math.max(1, Math.round(width * dpr)),
    backingHeight: Math.max(1, Math.round(height * dpr)),
  });
}

export function createPreviewRafScheduler({ requestFrame, cancelFrame, drawFrame }) {
  let frameId = null;
  let disposed = false;
  const request = () => {
    if (disposed || frameId !== null) return false;
    frameId = requestFrame(time => {
      frameId = null;
      if (disposed) return;
      if (drawFrame(time)) request();
    });
    return true;
  };
  const cancel = () => {
    if (frameId === null) return false;
    cancelFrame(frameId);
    frameId = null;
    return true;
  };
  const dispose = () => {
    disposed = true;
    cancel();
  };
  return Object.freeze({
    request,
    cancel,
    dispose,
    get scheduled() { return frameId !== null; },
    get disposed() { return disposed; },
  });
}
