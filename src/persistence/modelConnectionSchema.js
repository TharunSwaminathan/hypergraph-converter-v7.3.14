import { boundedCopy, StorageFault } from "./storageSafety.js";
import { validateLocalModelName } from "../agent/localModelSettings.js";
import { BRIDGE_OLLAMA_BASE_URL } from "../agent/ollamaConnectionManager.js";

export const CONNECTION_ID = "local-ollama";
export const CONNECTION_POLICY = Object.freeze({ attempts: 4, delays: [1500, 5000, 12000], probeTimeoutMs: 4000, monitorMs: 30000, leaseMs: 6000, models: 128, responseBytes: 65536 });
export const connectionFault = (code, message) => new StorageFault(code, message, true);
export function approvedModelEndpoint(value, transport) {
  if (typeof value !== "string" || value.length > 160) throw connectionFault("INVALID_ENDPOINT", "Only approved local Ollama endpoints may reconnect.");
  let u; try { u = new URL(value); } catch { throw connectionFault("INVALID_ENDPOINT", "Invalid local model endpoint."); }
  const direct = ["http://localhost:11434", "http://127.0.0.1:11434"], endpoint = u.href.replace(/\/$/, "");
  if (u.username || u.password || u.search || u.hash || (transport === "direct" ? !direct.includes(endpoint) : transport !== "bridge" || endpoint !== BRIDGE_OLLAMA_BASE_URL)) throw connectionFault("INVALID_ENDPOINT", "Reconnect endpoint is not an approved credential-free loopback endpoint.");
  return endpoint;
}
export function validateConnectionProfile(input) {
  const v = boundedCopy(input, { bytes: 4096, depth: 2, nodes: 24, string: 160 });
  if (v?.schemaVersion !== 1) throw connectionFault("INCOMPATIBLE", "Connection profile schema is unsupported; data preserved.");
  const names = "schemaVersion provider endpoint transport selectedModel autoReconnectEnabled lastSuccessfulConnectionAt lastKnownModelAvailability timeoutMs policy".split(" ");
  if (typeof v?.selectedModel !== "string" || validateLocalModelName(v.selectedModel).model !== v.selectedModel) throw connectionFault("CORRUPT", "Stored model names must be canonical strings.");
  if (!v || Object.keys(v).sort().join() !== names.sort().join() || v.provider !== "ollama" || !validateLocalModelName(v.selectedModel).ok || typeof v.autoReconnectEnabled !== "boolean" || !["AVAILABLE", "UNKNOWN"].includes(v.lastKnownModelAvailability) || !(v.lastSuccessfulConnectionAt === null || typeof v.lastSuccessfulConnectionAt === "string" && /^\d{4}-\d\d-\d\dT/.test(v.lastSuccessfulConnectionAt) && v.lastSuccessfulConnectionAt.length <= 32 && Number.isFinite(Date.parse(v.lastSuccessfulConnectionAt))) || v.timeoutMs !== CONNECTION_POLICY.probeTimeoutMs || v.policy !== "bounded-v1") throw connectionFault("CORRUPT", "Connection profile fields are invalid.");
  return { ...v, endpoint: approvedModelEndpoint(v.endpoint, v.transport) };
}
export function validateConnectionRecord(input) {
  const v = boundedCopy(input, { bytes: 5120, depth: 4, nodes: 40, string: 160 });
  if (v?.schemaVersion !== 1) throw connectionFault("INCOMPATIBLE", "Connection record schema is unsupported; data preserved.");
  if (Object.keys(v).sort().join() !== "deleted,id,profile,revision,schemaVersion" || v.id !== CONNECTION_ID || !Number.isSafeInteger(v.revision) || v.revision < 1 || typeof v.deleted !== "boolean" || v.deleted && v.profile !== null) throw connectionFault("CORRUPT", "Invalid connection record.");
  return { ...v, profile: v.deleted ? null : validateConnectionProfile(v.profile) };
}
export function initialConnectionProfile(model, endpoint = "http://localhost:11434", transport = "direct") {
  if (typeof model !== "string") throw connectionFault("CORRUPT", "Select a model name explicitly.");
  return validateConnectionProfile({ schemaVersion: 1, provider: "ollama", endpoint, transport, selectedModel: model.trim(), autoReconnectEnabled: false, lastSuccessfulConnectionAt: null, lastKnownModelAvailability: "UNKNOWN", timeoutMs: CONNECTION_POLICY.probeTimeoutMs, policy: "bounded-v1" });
}
