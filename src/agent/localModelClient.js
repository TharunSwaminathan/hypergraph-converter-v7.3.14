import { extractFirstJsonObject } from "./modelResponseValidator.js";
import {
  DEFAULT_LOCAL_MODEL_TEMPERATURE,
  DEFAULT_LOCAL_MODEL_TIMEOUT_MS,
  GRAPH_MUTATION_PLANNER_NUM_PREDICT,
  LOCAL_MODEL_KEEP_ALIVE,
  LOCAL_MODEL_DISABLED_MESSAGE,
  RECOMMENDED_OLLAMA_MODEL,
} from "./localModelSettings.js";
import { normalizeOllamaMetrics } from "./ollamaMetrics.js";

export const REMOTE_BLOCK_MESSAGE = "Remote model endpoints are blocked by default to avoid sending uploaded file previews outside your machine/private network.";
export const MODEL_NOT_FOUND = "The server is reachable, but qwen3:8b was not found. Run: ollama pull qwen3:8b";
export const MODEL_NAME_REQUIRED = "The selected Ollama model name is missing.";

export const HEALTH_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["ok"] },
  },
  required: ["status"],
  additionalProperties: false,
};

function isLocalOrPrivateHost(hostname) {
  const host = String(hostname ?? "").toLowerCase();
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  const match = host.match(/^172\.(\d{1,2})\.\d{1,3}\.\d{1,3}$/);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

export function classifyBaseUrl(baseUrl) {
  try {
    const url = new URL(String(baseUrl ?? ""));
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    const isLocalOrPrivate = isLocalOrPrivateHost(url.hostname);
    return {
      ok: isHttp,
      url: url.href.replace(/\/$/, ""),
      protocol: url.protocol,
      hostname: url.hostname,
      isLocalOrPrivate,
      explanation: isHttp
        ? (isLocalOrPrivate ? "Local/private endpoint." : REMOTE_BLOCK_MESSAGE)
        : "Use an http:// or https:// Ollama endpoint.",
    };
  } catch {
    return {
      ok: false,
      url: "",
      protocol: "",
      hostname: "",
      isLocalOrPrivate: false,
      explanation: "Enter a valid local Ollama URL.",
    };
  }
}

export function validateLocalModelBaseUrl(baseUrl) {
  const checked = classifyBaseUrl(baseUrl);
  if (!checked.ok) return { ok: false, error: checked.explanation };
  if (!checked.isLocalOrPrivate) return { ok: false, error: REMOTE_BLOCK_MESSAGE };
  return { ok: true, url: checked.url };
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function resolveEndpointConfig(config = {}) {
  if (config.enabled === false) throw new Error(LOCAL_MODEL_DISABLED_MESSAGE);
  const baseUrl = config.activeBaseUrl || config.baseUrl || "http://localhost:11434";
  const checked = validateLocalModelBaseUrl(baseUrl);
  if (!checked.ok) throw new Error(checked.error);
  return {
    runtime: "ollama",
    baseUrl: checked.url,
    model: String(config.model || RECOMMENDED_OLLAMA_MODEL).trim(),
    temperature: clampNumber(config.temperature, DEFAULT_LOCAL_MODEL_TEMPERATURE, 0, 1),
    timeoutMs: clampNumber(config.timeoutMs, DEFAULT_LOCAL_MODEL_TIMEOUT_MS, 1000, DEFAULT_LOCAL_MODEL_TIMEOUT_MS),
  };
}

export function classifyLocalModelError(error) {
  if (error?.classification) return error.classification;
  if (error?.name === "AbortError") return "request_aborted";
  if (error?.status) return "http_failure";
  const message = String(error?.message ?? "").toLowerCase();
  if (message.includes("timed out")) return "model_generation_timeout";
  if (message.includes("non-json") || message.includes("invalid json")) return "invalid_response";
  if (message.includes("failed to fetch") || message.includes("networkerror")) return "connection_failure";
  return "unknown_network_error";
}

export async function fetchJson(url, options = {}, timeoutMs = DEFAULT_LOCAL_MODEL_TIMEOUT_MS) {
  const { signal, cleanup, timedOut } = timeoutSignal(timeoutMs, options.signal);
  try {
    const response = await fetch(url, { ...options, signal });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      throw Object.assign(
        new Error(`Ollama returned non-JSON HTTP ${response.status}.`, { cause: error }),
        { status: response.status, serverResponded: true, rawText: text },
      );
    }
    if (!response.ok) {
      const detail = data?.error?.message ?? data?.error ?? data?.message ?? `HTTP ${response.status}`;
      throw Object.assign(new Error(`Ollama request failed: ${detail}`), { status: response.status, serverResponded: true, data });
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      const classification = timedOut() ? "model_generation_timeout" : "request_aborted";
      const message = classification === "model_generation_timeout"
        ? `Ollama request timed out after ${timeoutMs} ms.`
        : "Ollama request was stopped before completion.";
      throw Object.assign(new Error(message, { cause: error }), { classification });
    }
    throw error;
  } finally {
    cleanup();
  }
}

function abortError(message = "Conversational generation was stopped.") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function timeoutSignal(timeoutMs, externalSignal = null) {
  const controller = new AbortController();
  let didTimeout = false;
  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort("model_generation_timeout");
  }, timeoutMs);
  const abortFromExternal = () => controller.abort("request_aborted");
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", abortFromExternal, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener("abort", abortFromExternal);
    },
    timedOut() {
      return didTimeout;
    },
  };
}

function requestTemperature(safe, payload = {}) {
  if (payload.temperatureOverride !== undefined) {
    return clampNumber(payload.temperatureOverride, safe.temperature, 0, 1);
  }
  return safe.temperature;
}

function ollamaChatBody(safe, messages, payload = {}, { stream = false } = {}) {
  const body = {
    model: safe.model,
    messages,
    stream,
    think: false,
    keep_alive: payload.keepAlive ?? LOCAL_MODEL_KEEP_ALIVE,
    options: {
      temperature: requestTemperature(safe, payload),
    },
  };
  if (payload.numPredict || payload.taskMode === "PLAN_GRAPH_MUTATION") {
    body.options.num_predict = Number(payload.numPredict || GRAPH_MUTATION_PLANNER_NUM_PREDICT);
  }
  if (!stream && payload.responseSchema) body.format = payload.responseSchema;
  return body;
}

export function createOllamaChatStreamParser({
  onContent = () => {},
  onDone = () => {},
  onError = () => {},
  onMetrics = null,
  clientStartedAt = null,
} = {}) {
  let buffer = "";
  let done = false;
  function consumeLine(rawLine) {
    const line = rawLine.trim();
    if (!line) return;
    let event;
    try {
      event = JSON.parse(line);
    } catch (error) {
      onError(Object.assign(new Error("Ollama stream returned invalid JSON."), { cause: error, line }));
      return;
    }
    const content = event?.message?.content;
    if (typeof content === "string" && content) onContent(content, event);
    if (event?.done) {
      done = true;
      if (onMetrics) onMetrics(normalizeOllamaMetrics(event, {
        clientElapsedMs: clientStartedAt == null ? null : performance.now() - clientStartedAt,
      }));
      onDone(event);
    }
  }
  return {
    feed(chunkText) {
      buffer += String(chunkText ?? "");
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) consumeLine(line);
      return { done };
    },
    flush() {
      if (buffer.trim()) consumeLine(buffer);
      buffer = "";
      return { done };
    },
  };
}

export async function listOllamaModels(baseUrl, { timeoutMs = DEFAULT_LOCAL_MODEL_TIMEOUT_MS } = {}) {
  const checked = validateLocalModelBaseUrl(baseUrl);
  if (!checked.ok) throw new Error(checked.error);
  const data = await fetchJson(`${checked.url}/api/tags`, { method: "GET" }, timeoutMs);
  return (data.models ?? []).map(model => model.name ?? model.model).filter(Boolean);
}

export async function runOllamaStructuredHealthCheck(baseUrl, model = RECOMMENDED_OLLAMA_MODEL, {
  timeoutMs = DEFAULT_LOCAL_MODEL_TIMEOUT_MS,
  temperature = DEFAULT_LOCAL_MODEL_TEMPERATURE,
} = {}) {
  const checked = validateLocalModelBaseUrl(baseUrl);
  if (!checked.ok) throw new Error(checked.error);
  const testModel = String(model || RECOMMENDED_OLLAMA_MODEL).trim();
  if (!testModel) throw new Error(MODEL_NAME_REQUIRED);
  const data = await fetchJson(`${checked.url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: testModel,
      messages: [
        { role: "system", content: "Return only this JSON object with no markdown: {\"status\":\"ok\"}" },
        { role: "user", content: "Return the requested JSON health response." },
      ],
      stream: false,
      think: false,
      format: HEALTH_RESPONSE_SCHEMA,
      options: { temperature },
    }),
  }, timeoutMs);
  const content = data?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Ollama chat generation returned no message content.");
  const parsed = extractFirstJsonObject(content);
  if (parsed?.status !== "ok") throw new Error("Ollama generation did not return valid structured JSON status ok.");
  return { ok: true, content, parsed, data };
}

export async function testOllamaConnection(baseUrl, model = RECOMMENDED_OLLAMA_MODEL, options = {}) {
  const models = await listOllamaModels(baseUrl, options);
  const selectedModel = String(model || RECOMMENDED_OLLAMA_MODEL).trim();
  if (!selectedModel) throw new Error(MODEL_NAME_REQUIRED);
  if (!models.includes(selectedModel)) {
    throw Object.assign(new Error(MODEL_NOT_FOUND), { classification: "model_missing", models });
  }
  const generation = await runOllamaStructuredHealthCheck(baseUrl, selectedModel, options);
  return {
    ok: true,
    runtime: "ollama",
    baseUrl: validateLocalModelBaseUrl(baseUrl).url,
    model: selectedModel,
    models,
    modelListed: true,
    generationTested: true,
    generationStructured: generation.ok,
  };
}

export async function listLocalModels(config, { details = false } = {}) {
  const safe = resolveEndpointConfig(config);
  const models = await listOllamaModels(safe.baseUrl, safe);
  const result = {
    models,
    listingAvailable: true,
    message: "",
  };
  return details ? result : models;
}

export async function testLocalModelConnection(config) {
  const safe = resolveEndpointConfig(config);
  const result = await testOllamaConnection(safe.baseUrl, safe.model, safe);
  return {
    ...result,
    message: `LOCAL MODEL CONNECTED · ${safe.model} · DETERMINISTIC EXECUTION. Ollama responded and structured generation passed.`,
  };
}

export async function generateWithLocalModel(config, payload, {
  signal = null,
  timeoutMs = null,
  onMetrics = null,
} = {}) {
  const safe = resolveEndpointConfig(config);
  if (!safe.model) throw new Error(MODEL_NAME_REQUIRED);
  const messages = payload?.messages;
  if (!Array.isArray(messages) || !messages.length) throw new Error("The local model request is missing its bounded prompt.");
  const taskMode = payload?.taskMode ?? payload?.task ?? "CHAT";
  const structured = Boolean(payload?.responseSchema);
  const started = performance.now();
  const data = await fetchJson(`${safe.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(ollamaChatBody(safe, messages, payload, { stream: false })),
  }, timeoutMs ?? safe.timeoutMs);
  if (onMetrics) onMetrics(normalizeOllamaMetrics(data, { clientElapsedMs: performance.now() - started }));
  const content = data?.message?.content;
  if (typeof content !== "string") throw new Error(`Ollama returned no message content for task mode ${taskMode}.`);
  if (structured && !content.trim()) throw new Error(`Ollama returned empty structured content for task mode ${taskMode}.`);
  return content;
}

export async function generateConversationWithLocalModel(config, payload, {
  onToken = null,
  signal = null,
  timeoutMs = null,
  onMetrics = null,
} = {}) {
  const safe = resolveEndpointConfig(config);
  if (!safe.model) throw new Error(MODEL_NAME_REQUIRED);
  const messages = payload?.messages;
  if (!Array.isArray(messages) || !messages.length) throw new Error("The conversational request is missing its bounded prompt.");

  const { signal: requestSignal, cleanup, timedOut } = timeoutSignal(timeoutMs ?? safe.timeoutMs, signal);
  const started = performance.now();
  try {
    const response = await fetch(`${safe.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: requestSignal,
      body: JSON.stringify(ollamaChatBody(safe, messages, payload, { stream: true })),
    });
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const data = JSON.parse(await response.text());
        detail = data?.error?.message ?? data?.error ?? data?.message ?? detail;
      } catch {
        // Keep the HTTP status detail.
      }
      throw Object.assign(new Error(`Ollama conversational request failed: ${detail}`), { status: response.status, serverResponded: true });
    }
    if (!response.body?.getReader) {
      const text = await response.text();
      const parsed = JSON.parse(text);
      const content = parsed?.message?.content;
      if (typeof content !== "string") throw new Error("Ollama returned no conversational message content.");
      if (onToken && content) onToken(content);
      if (onMetrics) onMetrics(normalizeOllamaMetrics(parsed, { clientElapsedMs: performance.now() - started }));
      return content;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";
    let parserError = null;
    const parser = createOllamaChatStreamParser({
      onContent(content) {
        accumulated += content;
        if (onToken) onToken(content);
      },
      onMetrics,
      clientStartedAt: started,
      onError(error) {
        parserError = error;
      },
    });

    while (true) {
      if (requestSignal.aborted) throw abortError();
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
      if (parserError) throw parserError;
    }
    parser.feed(decoder.decode());
    parser.flush();
    if (parserError) throw parserError;
    return accumulated;
  } catch (error) {
    if (signal?.aborted || error?.name === "AbortError") {
      const classification = timedOut() ? "model_generation_timeout" : "request_aborted";
      throw Object.assign(
        abortError(classification === "model_generation_timeout" ? `Ollama request timed out after ${timeoutMs ?? safe.timeoutMs} ms.` : "Conversational generation was stopped."),
        { classification },
      );
    }
    throw error;
  } finally {
    cleanup();
  }
}

