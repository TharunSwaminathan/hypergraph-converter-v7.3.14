import { StorageFault } from "./storageSafety.js";
import { requireBudget } from "./storageBudget.js";

export const isSha256 = value => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
export async function sourceBytes(input, limit) {
  let bytes;
  if (typeof Blob !== "undefined" && input instanceof Blob) { requireBudget(input.size, limit, "Source object"); bytes = await input.arrayBuffer(); }
  else if (input instanceof ArrayBuffer) { requireBudget(input.byteLength, limit, "Source object"); bytes = input.slice(0); }
  else if (ArrayBuffer.isView(input)) { requireBudget(input.byteLength, limit, "Source object"); bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength).slice().buffer; }
  else throw new StorageFault(input == null ? "MISSING_SOURCE" : "UNSUPPORTED_SOURCE", "Authoritative source bytes are unavailable; exact reattachment is required.", true);
  requireBudget(bytes.byteLength, limit, "Source object"); return bytes;
}
export async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) throw new StorageFault("UNAVAILABLE", "Web Crypto SHA-256 is unavailable. Workspace data was not published.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}
export async function compareSourceIdentity(expected, input, limit) {
  if (!expected || !isSha256(expected.sha256)) return { status: "UNSUPPORTED_SOURCE", available: false };
  if (input == null) return { status: "MISSING_SOURCE", available: false };
  try {
    const bytes = await sourceBytes(input, limit), actual = await sha256(bytes);
    return { status: bytes.byteLength === expected.byteLength && actual === expected.sha256 ? "EXACT_MATCH" : "CHANGED_SOURCE", available: bytes.byteLength === expected.byteLength && actual === expected.sha256, sha256: actual, byteLength: bytes.byteLength };
  } catch (error) { if (error.code === "UNAVAILABLE") throw error; return { status: "UNSUPPORTED_SOURCE", available: false, code: error.code }; }
}
