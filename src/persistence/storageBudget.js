import { StorageFault } from "./storageSafety.js";

export const WORKSPACE_LIMITS = Object.freeze({ sourceBytes: 8 * 1024 * 1024, graphBytes: 8 * 1024 * 1024,
  derivedBytes: 256 * 1024, manifestBytes: 128 * 1024, projectBytes: 32 * 1024 * 1024,
  applicationBytes: 128 * 1024 * 1024, sources: 24, checkpoints: 5, graphNodes: 400000, graphArray: 100000 });
export function requireBudget(bytes, limit, label) {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > limit) throw new StorageFault("LIMIT", `${label} exceeds the configured durable storage budget. Previous committed data is preserved.`, true);
}
export async function checkStorageEstimate(bytes, storage = globalThis.navigator?.storage) {
  if (!storage?.estimate) return { supported: false, requestedBytes: bytes };
  try {
    const { usage, quota } = await storage.estimate();
    if (Number.isFinite(usage) && Number.isFinite(quota) && bytes > Math.max(0, quota - usage)) throw new StorageFault("QUOTA", "Browser estimated free storage is insufficient. Previous committed workspace is preserved.");
    return { supported: true, usage: Number.isFinite(usage) ? usage : null, quota: Number.isFinite(quota) ? quota : null, requestedBytes: bytes };
  } catch (error) { if (error instanceof StorageFault) throw error; return { supported: false, requestedBytes: bytes, estimateFailed: true }; }
}
