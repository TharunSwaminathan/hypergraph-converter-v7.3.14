import {
  DEFAULT_LOCAL_MODEL_TEMPERATURE,
  DEFAULT_LOCAL_MODEL_TIMEOUT_MS,
  RECOMMENDED_OLLAMA_MODEL,
} from "./localModelSettings.js";
import {
  fetchJson,
  listOllamaModels,
  MODEL_NOT_FOUND,
  runOllamaStructuredHealthCheck,
  testOllamaConnection,
} from "./localModelClient.js";

export const DIRECT_OLLAMA_BASE_URL = "http://localhost:11434";
export const BRIDGE_HEALTH_URL = "http://127.0.0.1:8787/health";
export const BRIDGE_OLLAMA_BASE_URL = "http://127.0.0.1:8787/ollama";

export const OLLAMA_TRANSPORTS = {
  direct: {
    id: "direct",
    label: "Direct Ollama",
    baseUrl: DIRECT_OLLAMA_BASE_URL,
  },
  bridge: {
    id: "bridge",
    label: "Local Bridge",
    baseUrl: BRIDGE_OLLAMA_BASE_URL,
    healthUrl: BRIDGE_HEALTH_URL,
  },
};

const VALID_TRANSPORTS = new Set(Object.keys(OLLAMA_TRANSPORTS));

export function transportLabel(transport) {
  return OLLAMA_TRANSPORTS[transport]?.label ?? "None";
}

export function transportBaseUrl(transport) {
  return OLLAMA_TRANSPORTS[transport]?.baseUrl ?? "";
}

function normalizeTransport(value) {
  return VALID_TRANSPORTS.has(value) ? value : null;
}

export function getOllamaAttemptOrder(config = {}, preferTransport = null) {
  const order = [];
  const push = transport => {
    const normalized = normalizeTransport(transport);
    if (normalized && !order.includes(normalized)) order.push(normalized);
  };
  push(preferTransport);
  push(config.lastSuccessfulTransport);
  push("direct");
  push("bridge");
  return order;
}

export function classifyOllamaConnectionError(error, { runtimeReachable = false } = {}) {
  const message = String(error?.message ?? "").toLowerCase();
  if (error?.classification) return error.classification;
  if (message.includes(MODEL_NOT_FOUND.toLowerCase()) || message.includes("model") && message.includes("not found")) return "model_missing";
  if (message.includes("timed out") || error?.name === "AbortError") return "runtime_not_running";
  if (message.includes("failed to fetch") || message.includes("networkerror")) return "runtime_not_running";
  if (message.includes("non-json") || message.includes("invalid json")) return "invalid_json_response";
  if (message.includes("structured json") || message.includes("status ok")) return "structured_output_invalid";
  if (runtimeReachable) return "model_generation_failed";
  return "unknown_network_error";
}

export function suggestedFixForOllamaFailure(classification, model = RECOMMENDED_OLLAMA_MODEL) {
  if (classification === "model_missing") return `Install the model with: ollama pull ${model}`;
  if (classification === "structured_output_invalid" || classification === "model_generation_failed") return "Ollama responded, but the tiny structured generation check failed. Restart Ollama, then reconnect.";
  if (classification === "invalid_json_response") return "Ollama returned an unexpected response. Restart Ollama and the local bridge, then reconnect.";
  return "Start the app with run-with-ollama.sh or run-with-ollama.bat, which verifies Ollama and starts the local bridge.";
}

async function testBridgeHealth(timeoutMs) {
  const data = await fetchJson(BRIDGE_HEALTH_URL, { method: "GET" }, timeoutMs);
  return { ok: true, data };
}

async function attemptTransport(transport, config = {}) {
  const endpoint = OLLAMA_TRANSPORTS[transport];
  const model = String(config.model || RECOMMENDED_OLLAMA_MODEL).trim();
  const timeoutMs = Number(config.timeoutMs || DEFAULT_LOCAL_MODEL_TIMEOUT_MS);
  const temperature = Number(config.temperature ?? DEFAULT_LOCAL_MODEL_TEMPERATURE);
  const attempt = {
    transport,
    label: endpoint.label,
    baseUrl: endpoint.baseUrl,
    ok: false,
    modelListed: false,
    generationTested: false,
    generationStructured: false,
    classification: "",
    message: "",
  };

  try {
    if (transport === "bridge") {
      await testBridgeHealth(timeoutMs);
      attempt.bridgeHealth = "ok";
    }
    const result = await testOllamaConnection(endpoint.baseUrl, model, { timeoutMs, temperature });
    return {
      ...attempt,
      ok: true,
      modelListed: result.modelListed,
      generationTested: result.generationTested,
      generationStructured: result.generationStructured,
      models: result.models,
      message: `${endpoint.label} connected to ${model}.`,
    };
  } catch (error) {
    const runtimeReachable = /model|generation|structured|json|chat/i.test(String(error?.message ?? ""));
    const classification = classifyOllamaConnectionError(error, { runtimeReachable });
    return {
      ...attempt,
      ok: false,
      classification,
      message: error?.message || "Connection attempt failed.",
      suggestedFix: suggestedFixForOllamaFailure(classification, model),
    };
  }
}

export async function connectOllamaAutomatically(config = {}, { preferTransport = null } = {}) {
  const model = String(config.model || RECOMMENDED_OLLAMA_MODEL).trim() || RECOMMENDED_OLLAMA_MODEL;
  const attempts = [];
  for (const transport of getOllamaAttemptOrder(config, preferTransport)) {
    const attempt = await attemptTransport(transport, { ...config, model });
    attempts.push(attempt);
    if (attempt.ok) {
      return {
        ok: true,
        runtime: "ollama",
        transport,
        baseUrl: attempt.baseUrl,
        model,
        modelListed: true,
        generationTested: true,
        generationStructured: true,
        models: attempt.models ?? [],
        attempts,
        message: `Connected to ${model} via ${attempt.label}.`,
      };
    }
  }

  const direct = attempts.find(attempt => attempt.transport === "direct");
  const bridge = attempts.find(attempt => attempt.transport === "bridge");
  const classifications = attempts.map(attempt => attempt.classification).filter(Boolean);
  const classification = classifications.includes("model_missing")
    ? "model_missing"
    : classifications.includes("structured_output_invalid")
      ? "structured_output_invalid"
      : "runtime_not_running";
  const attemptLines = [
    direct ? `Direct Ollama: failed — ${direct.classification || direct.message}` : "",
    bridge ? `Local bridge: failed — ${bridge.classification || bridge.message}` : "",
  ].filter(Boolean).join("\n");
  return {
    ok: false,
    runtime: "ollama",
    transport: null,
    baseUrl: "",
    model,
    attempts,
    classification,
    message: `Could not connect to ${model} through direct Ollama or the local bridge.`,
    details: attemptLines,
    suggestedFix: suggestedFixForOllamaFailure(classification, model),
  };
}

export async function probeOllamaTransport(transport, config = {}) {
  const normalized = normalizeTransport(transport) ?? "direct";
  return attemptTransport(normalized, config);
}

export async function listModelsForTransport(transport, config = {}) {
  const normalized = normalizeTransport(transport) ?? "direct";
  const endpoint = OLLAMA_TRANSPORTS[normalized];
  if (normalized === "bridge") await testBridgeHealth(config.timeoutMs ?? DEFAULT_LOCAL_MODEL_TIMEOUT_MS);
  return listOllamaModels(endpoint.baseUrl, config);
}

export async function runGenerationForTransport(transport, config = {}) {
  const normalized = normalizeTransport(transport) ?? "direct";
  const endpoint = OLLAMA_TRANSPORTS[normalized];
  if (normalized === "bridge") await testBridgeHealth(config.timeoutMs ?? DEFAULT_LOCAL_MODEL_TIMEOUT_MS);
  return runOllamaStructuredHealthCheck(endpoint.baseUrl, config.model || RECOMMENDED_OLLAMA_MODEL, config);
}

