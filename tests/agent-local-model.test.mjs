import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_LOCAL_MODEL_CONFIG,
  DEFAULT_LOCAL_MODEL_TEMPERATURE,
  DEFAULT_LOCAL_MODEL_TIMEOUT_MS,
  LOCAL_MODEL_SETTINGS_VERSION,
  normalizeLocalModelConfig,
  RECOMMENDED_OLLAMA_MODEL,
} from "../src/agent/localModelSettings.js";
import {
  createOllamaChatStreamParser,
  generateConversationWithLocalModel,
  generateWithLocalModel,
  validateLocalModelBaseUrl,
} from "../src/agent/localModelClient.js";
import {
  BRIDGE_HEALTH_URL,
  BRIDGE_OLLAMA_BASE_URL,
  connectOllamaAutomatically,
  DIRECT_OLLAMA_BASE_URL,
  getOllamaAttemptOrder,
  listModelsForTransport,
} from "../src/agent/ollamaConnectionManager.js";
import {
  createRuntimeDiagnosticsSnapshot,
  isIsolatedRuntimeProbeMode,
  runRuntimeDiagnostics,
} from "../src/agent/localRuntimeDiagnostics.js";
import { classifyIntent } from "../src/agent/intentClassifier.js";
import { planAgentAction } from "../src/agent/actionPlanner.js";
import { resolveDeterministicControlPlan } from "../src/agent/deterministicControlPlanner.js";
import { buildDeterministicActionPlan, resolveCanonicalIntent } from "../src/agent/orchestrationPlanner.js";
import { validateOllamaActionPlan } from "../src/agent/ollamaActionPlanValidator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const projectFile = (...parts) => path.join(root, ...parts);

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function ollamaTags(models = [RECOMMENDED_OLLAMA_MODEL]) {
  return { models: models.map(name => ({ name })) };
}

function ollamaOkChat(content = "{\"status\":\"ok\"}") {
  return { message: { content } };
}

function installFetch(handler) {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const response = await handler(String(url), options);
    assert.ok(!String(url).includes("/v1/"), `No active request may use /v1/: ${url}`);
    return response;
  };
  return {
    calls,
    restore() {
      globalThis.fetch = previous;
    },
  };
}

async function withMockFetch(handler, fn) {
  const mock = installFetch(handler);
  try {
    await fn(mock.calls);
  } finally {
    mock.restore();
  }
}

function baseConfig(overrides = {}) {
  return {
    ...DEFAULT_LOCAL_MODEL_CONFIG,
    activeBaseUrl: DIRECT_OLLAMA_BASE_URL,
    model: RECOMMENDED_OLLAMA_MODEL,
    ...overrides,
  };
}

async function fileExists(file) {
  try {
    await stat(projectFile(file));
    return true;
  } catch {
    return false;
  }
}

let settingsMigrationTests = 0;
let automaticConnectionTests = 0;
let clientPayloadTests = 0;
let uiAssertionTests = 0;
let diagnosticsTests = 0;
let bridgeAllowlistTests = 0;
let conversationActionRegressionTests = 0;
let sourceScriptAssertionTests = 0;

// Settings migration matrix.
{
  const cases = [
    ["none", { provider: "none" }, { enabled: false, lastSuccessfulTransport: null }],
    ["ollama", { provider: "ollama", baseUrl: DIRECT_OLLAMA_BASE_URL }, { enabled: true, lastSuccessfulTransport: "direct" }],
    ["ollama-bridge", { provider: "ollama-bridge", baseUrl: BRIDGE_OLLAMA_BASE_URL }, { enabled: true, lastSuccessfulTransport: "bridge" }],
    ["removed-a", { provider: "llama-cpp", model: "old-local" }, { enabled: true, lastSuccessfulTransport: null, notice: true }],
    ["removed-b", { provider: "llama-cpp-bridge" }, { enabled: true, lastSuccessfulTransport: null, notice: true }],
    ["removed-c", { provider: "openai-compatible-local" }, { enabled: true, lastSuccessfulTransport: null, notice: true }],
    ["unknown", { provider: "custom-remote" }, { enabled: true, lastSuccessfulTransport: null, notice: true }],
    ["missing-provider", { enabled: false }, { enabled: false, lastSuccessfulTransport: null }],
  ];
  for (const [label, stored, expected] of cases) {
    const { config, migrated } = normalizeLocalModelConfig(stored);
    assert.equal(config.runtime, "ollama", label);
    assert.equal(config.settingsVersion, LOCAL_MODEL_SETTINGS_VERSION, label);
    assert.equal(config.enabled, expected.enabled, label);
    assert.equal(config.transportPreference, "auto", label);
    assert.equal(config.lastSuccessfulTransport, expected.lastSuccessfulTransport, label);
    assert.equal(config.model || RECOMMENDED_OLLAMA_MODEL, expected.model ?? RECOMMENDED_OLLAMA_MODEL, label);
    if (expected.notice) assert.match(config.migrationNotice, /Ollama only/i, label);
    assert.equal(migrated, true, label);
    settingsMigrationTests += 1;
  }
  const fresh = normalizeLocalModelConfig(null);
  assert.equal(fresh.config.enabled, true);
  assert.equal(fresh.config.model, RECOMMENDED_OLLAMA_MODEL);
  assert.equal(fresh.migrated, false);
  settingsMigrationTests += 1;

  const legacyModel = normalizeLocalModelConfig({ provider: "ollama", model: "qwen2.5-coder:1.5b", timeoutMs: 60000 });
  assert.equal(legacyModel.config.model, RECOMMENDED_OLLAMA_MODEL);
  assert.equal(legacyModel.config.timeoutMs, DEFAULT_LOCAL_MODEL_TIMEOUT_MS);
  settingsMigrationTests += 1;
}

// Automatic transport order.
{
  assert.deepEqual(getOllamaAttemptOrder({}), ["direct", "bridge"]);
  assert.deepEqual(getOllamaAttemptOrder({ lastSuccessfulTransport: "bridge" }), ["bridge", "direct"]);
  assert.deepEqual(getOllamaAttemptOrder({ lastSuccessfulTransport: "direct" }, "bridge"), ["bridge", "direct"]);
  automaticConnectionTests += 3;
}

// Automatic connection: direct succeeds.
await withMockFetch(async url => {
  if (url === `${DIRECT_OLLAMA_BASE_URL}/api/tags`) return jsonResponse(ollamaTags());
  if (url === `${DIRECT_OLLAMA_BASE_URL}/api/chat`) return jsonResponse(ollamaOkChat());
  throw new Error(`unexpected URL ${url}`);
}, async calls => {
  const result = await connectOllamaAutomatically(baseConfig({ activeBaseUrl: "" }));
  assert.equal(result.ok, true);
  assert.equal(result.transport, "direct");
  assert.equal(result.generationStructured, true);
  assert.equal(calls.some(call => call.url.includes("8787")), false);
  automaticConnectionTests += 1;
});

// Automatic connection: direct fails, bridge succeeds.
await withMockFetch(async url => {
  if (url.startsWith(DIRECT_OLLAMA_BASE_URL)) throw new TypeError("Failed to fetch");
  if (url === BRIDGE_HEALTH_URL) return jsonResponse({ ok: true });
  if (url === `${BRIDGE_OLLAMA_BASE_URL}/api/tags`) return jsonResponse(ollamaTags());
  if (url === `${BRIDGE_OLLAMA_BASE_URL}/api/chat`) return jsonResponse(ollamaOkChat());
  throw new Error(`unexpected URL ${url}`);
}, async calls => {
  const result = await connectOllamaAutomatically(baseConfig({ activeBaseUrl: "" }));
  assert.equal(result.ok, true);
  assert.equal(result.transport, "bridge");
  assert.equal(calls[0].url, `${DIRECT_OLLAMA_BASE_URL}/api/tags`);
  assert.equal(calls.some(call => call.url === BRIDGE_HEALTH_URL), true);
  automaticConnectionTests += 1;
});

// Remembered bridge succeeds first; direct is not required.
await withMockFetch(async url => {
  if (url === BRIDGE_HEALTH_URL) return jsonResponse({ ok: true });
  if (url === `${BRIDGE_OLLAMA_BASE_URL}/api/tags`) return jsonResponse(ollamaTags());
  if (url === `${BRIDGE_OLLAMA_BASE_URL}/api/chat`) return jsonResponse(ollamaOkChat());
  throw new Error(`unexpected URL ${url}`);
}, async calls => {
  const result = await connectOllamaAutomatically(baseConfig({ lastSuccessfulTransport: "bridge", activeBaseUrl: "" }));
  assert.equal(result.ok, true);
  assert.equal(result.transport, "bridge");
  assert.equal(calls.some(call => call.url.startsWith(DIRECT_OLLAMA_BASE_URL)), false);
  automaticConnectionTests += 1;
});

// Remembered bridge fails, direct succeeds.
await withMockFetch(async url => {
  if (url === BRIDGE_HEALTH_URL) throw new TypeError("Failed to fetch");
  if (url === `${DIRECT_OLLAMA_BASE_URL}/api/tags`) return jsonResponse(ollamaTags());
  if (url === `${DIRECT_OLLAMA_BASE_URL}/api/chat`) return jsonResponse(ollamaOkChat());
  throw new Error(`unexpected URL ${url}`);
}, async calls => {
  const result = await connectOllamaAutomatically(baseConfig({ lastSuccessfulTransport: "bridge", activeBaseUrl: "" }));
  assert.equal(result.ok, true);
  assert.equal(result.transport, "direct");
  assert.equal(calls[0].url, BRIDGE_HEALTH_URL);
  automaticConnectionTests += 1;
});

// Both transports fail with one consolidated message.
await withMockFetch(async () => {
  throw new TypeError("Failed to fetch");
}, async () => {
  const result = await connectOllamaAutomatically(baseConfig({ activeBaseUrl: "" }));
  assert.equal(result.ok, false);
  assert.match(result.message, /Could not connect to qwen3:8b through direct Ollama or the local bridge/);
  assert.match(result.details, /Direct Ollama: failed/);
  assert.match(result.details, /Local bridge: failed/);
  automaticConnectionTests += 1;
});

// Model missing and generation failure are classified.
await withMockFetch(async url => {
  if (url === `${DIRECT_OLLAMA_BASE_URL}/api/tags`) return jsonResponse(ollamaTags(["other-model"]));
  if (url === BRIDGE_HEALTH_URL) throw new TypeError("Failed to fetch");
  throw new Error(`unexpected URL ${url}`);
}, async () => {
  const result = await connectOllamaAutomatically(baseConfig({ activeBaseUrl: "" }));
  assert.equal(result.ok, false);
  assert.equal(result.classification, "model_missing");
  assert.match(result.suggestedFix, /ollama pull qwen3:8b/);
  automaticConnectionTests += 1;
});

await withMockFetch(async url => {
  if (url === `${DIRECT_OLLAMA_BASE_URL}/api/tags`) return jsonResponse(ollamaTags());
  if (url === `${DIRECT_OLLAMA_BASE_URL}/api/chat`) return jsonResponse(ollamaOkChat("not json"));
  if (url === BRIDGE_HEALTH_URL) throw new TypeError("Failed to fetch");
  throw new Error(`unexpected URL ${url}`);
}, async () => {
  const result = await connectOllamaAutomatically(baseConfig({ activeBaseUrl: "" }));
  assert.equal(result.ok, false);
  assert.equal(result.classification, "structured_output_invalid");
  automaticConnectionTests += 1;
});

// Client payloads.
await withMockFetch(async url => {
  assert.equal(url, `${DIRECT_OLLAMA_BASE_URL}/api/chat`);
  return jsonResponse(ollamaOkChat("{\"ok\":true}"));
}, async calls => {
  const responseSchema = { type: "object", properties: { ok: { type: "boolean" } } };
  const content = await generateWithLocalModel(baseConfig(), {
    taskMode: "PROPOSE_MAPPING",
    messages: [{ role: "user", content: "bounded prompt" }],
    responseSchema,
  });
  assert.equal(content, "{\"ok\":true}");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.model, RECOMMENDED_OLLAMA_MODEL);
  assert.equal(body.stream, false);
  assert.equal(body.think, false);
  assert.deepEqual(body.format, responseSchema);
  assert.equal(body.options.temperature, DEFAULT_LOCAL_MODEL_TEMPERATURE);
  clientPayloadTests += 1;
});

await withMockFetch(async url => {
  assert.equal(url, `${DIRECT_OLLAMA_BASE_URL}/api/chat`);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`${JSON.stringify({ message: { content: "hello " } })}\n`));
      controller.enqueue(encoder.encode(`${JSON.stringify({ message: { content: "world" }, done: true })}\n`));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
}, async calls => {
  let streamed = "";
  const content = await generateConversationWithLocalModel(baseConfig(), {
    messages: [{ role: "user", content: "hi" }],
  }, {
    onToken(token) {
      streamed += token;
    },
  });
  assert.equal(content, "hello world");
  assert.equal(streamed, "hello world");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.stream, true);
  assert.equal(body.think, false);
  assert.equal(Boolean(body.format), false);
  clientPayloadTests += 1;
});

{
  const chunks = [];
  const parser = createOllamaChatStreamParser({
    onContent(content) {
      chunks.push(content);
    },
  });
  parser.feed(`${JSON.stringify({ message: { content: "a" } })}\n`);
  parser.feed(`${JSON.stringify({ message: { content: "b" }, done: true })}\n`);
  assert.deepEqual(chunks, ["a", "b"]);
  clientPayloadTests += 1;
}

assert.equal(validateLocalModelBaseUrl("https://example.com").ok, false);
assert.equal(validateLocalModelBaseUrl("http://192.168.1.20:11434").ok, true);
clientPayloadTests += 2;

// Diagnostics behavior.
{
  const disconnected = createRuntimeDiagnosticsSnapshot(baseConfig({ activeTransport: null, activeBaseUrl: "" }), {
    origin: "https://hypergraphproject.github.io",
    protocol: "https:",
    hostname: "hypergraphproject.github.io",
  });
  assert.equal(disconnected.runtimeLabel, "Ollama");
  assert.equal(disconnected.deploymentInfo.mode, "github_pages");
  assert.equal(disconnected.activeTransportLabel, "None");
  assert.equal(disconnected.commands.browserFetch.includes("/ollama/api/tags"), true);
  assert.equal(isIsolatedRuntimeProbeMode("direct-ollama"), true);
  assert.equal(isIsolatedRuntimeProbeMode("bridge"), true);
  assert.equal(isIsolatedRuntimeProbeMode("current"), false);
  diagnosticsTests += 6;
}

await withMockFetch(async url => {
  if (url === `${DIRECT_OLLAMA_BASE_URL}/api/tags`) throw new TypeError("Failed to fetch");
  throw new Error(`unexpected URL ${url}`);
}, async () => {
  const result = await runRuntimeDiagnostics({
    config: baseConfig({ activeTransport: "bridge", activeBaseUrl: BRIDGE_OLLAMA_BASE_URL }),
    mode: "direct-ollama",
    testGeneration: false,
  });
  assert.equal(result.overallStatus, "failed");
  assert.equal(result.activeTransport, "bridge");
  assert.equal(result.activeEndpoint, BRIDGE_OLLAMA_BASE_URL);
  diagnosticsTests += 1;
});

await withMockFetch(async url => {
  if (url === `${DIRECT_OLLAMA_BASE_URL}/api/tags`) throw new TypeError("Failed to fetch");
  if (url === BRIDGE_HEALTH_URL) return jsonResponse({ ok: true });
  if (url === `${BRIDGE_OLLAMA_BASE_URL}/api/tags`) return jsonResponse(ollamaTags());
  if (url === `${BRIDGE_OLLAMA_BASE_URL}/api/chat`) return jsonResponse(ollamaOkChat());
  throw new Error(`unexpected URL ${url}`);
}, async () => {
  const result = await runRuntimeDiagnostics({
    config: baseConfig({ activeTransport: null, activeBaseUrl: "" }),
    mode: "current",
    testGeneration: true,
  });
  assert.equal(result.overallStatus, "ok");
  assert.equal(result.activeTransport, "bridge");
  diagnosticsTests += 1;
});

await withMockFetch(async url => {
  if (url === BRIDGE_HEALTH_URL) return jsonResponse({ ok: true });
  if (url === `${BRIDGE_OLLAMA_BASE_URL}/api/tags`) return jsonResponse(ollamaTags());
  throw new Error(`unexpected URL ${url}`);
}, async () => {
  const models = await listModelsForTransport("bridge", baseConfig());
  assert.deepEqual(models, [RECOMMENDED_OLLAMA_MODEL]);
  diagnosticsTests += 1;
});

// Intent/action control surface.
{
  assert.equal(classifyIntent("Connect local assistant").intent, "local_model_connect");
  assert.equal(planAgentAction(classifyIntent("Connect local assistant"), { localModel: { config: baseConfig(), status: "disconnected" } }).kind, "test_local_model");
  assert.equal(classifyIntent("Use Ollama bridge").intent, "local_model_reconnect_bridge");
  assert.deepEqual(resolveDeterministicControlPlan("Use Ollama bridge", { localModel: { config: baseConfig(), status: "disconnected" } }).configOverride, { preferTransport: "bridge" });
  assert.equal(planAgentAction(classifyIntent("Use model something-else"), { localModel: { config: baseConfig(), status: "connected" } }).kind, "set_local_model_name");
  conversationActionRegressionTests += 5;
}

// Deterministic planner and ActionPlan validator regressions.
{
  const state = {
    fmt: "simple",
    activeSection: "mappings",
    expId: "h2v_txt",
    vizLimit: 50,
    hasGraph: false,
    agentFileCount: 1,
    activeBatchId: "batch-test",
    activeBatch: { id: "batch-test", label: "Batch", version: 1, parseMode: "together", fileNames: ["input.txt"] },
  };
  const resolved = resolveCanonicalIntent("Import H2V and publish CSR JSON.", state);
  assert.equal(resolved.sourceFormat, "simple");
  assert.equal(resolved.targetExport, "csr_json");
  const plan = buildDeterministicActionPlan("Import H2V and publish CSR JSON.", state);
  assert.deepEqual(plan.actions.map(action => action.type), ["SELECT_INPUT_ROUTE", "PARSE_ACTIVE_BATCH", "SELECT_EXPORT_PREVIEW"]);
  assert.equal(validateOllamaActionPlan(JSON.stringify(plan), { state, userQuery: "Import H2V and publish CSR JSON." }).ok, true);
  const clearPlan = buildDeterministicActionPlan("Clear graph.", { ...state, hasGraph: true });
  assert.equal(clearPlan.actions.some(action => action.type === "CLEAR_GRAPH" && action.requiresConfirmation === true), true);
  conversationActionRegressionTests += 5;
}

// UI/source assertions.
{
  const panelSource = await readFile(projectFile("src/components/AgentChatPanel.jsx"), "utf8");
  assert.doesNotMatch(panelSource, /<select/i);
  assert.doesNotMatch(panelSource, /\bProvider\b/);
  assert.doesNotMatch(panelSource, /Base URL/i);
  assert.doesNotMatch(panelSource, /llama\.cpp|llama-cpp|llamacpp|openai-compatible/i);
  assert.match(panelSource, /qwen3:8b/);
  assert.match(panelSource, /Connect/);
  assert.match(panelSource, /Reconnect/);
  assert.match(panelSource, /connected · deterministic execution/);
  assert.match(panelSource, /Local assistant disconnected · deterministic controls available/);
  assert.doesNotMatch(panelSource, /Ã‚Â·|Â·/);
  const css = await readFile(projectFile("src/components/AgentChatPanel.css"), "utf8");
  assert.doesNotMatch(css, /agent-model__grid/);
  assert.match(css, /agent-model__connection-card/);
  assert.match(css, /flex-wrap:\s*wrap/);
  uiAssertionTests += 13;
}

// Bridge allowlist/source assertions.
{
  const bridgeSource = await readFile(projectFile("local-runtime-bridge.js"), "utf8");
  assert.match(bridgeSource, /hypergraph-ollama-bridge/);
  assert.equal(bridgeSource.includes("GET /ollama/api/tags"), true);
  assert.equal(bridgeSource.includes("POST /ollama/api/chat"), true);
  assert.doesNotMatch(bridgeSource, /llama\.cpp|llama-cpp|llamacpp|openai-compatible|\/v1\//i);
  assert.match(bridgeSource, /path_not_allowed/);
  assert.match(bridgeSource, /Refusing public or invalid Ollama target/);
  bridgeAllowlistTests += 6;
}

// Script/package source assertions.
{
  const obsoleteFiles = [
    "run-dashboard-with-llamacpp.bat",
    "run-dashboard-with-llamacpp.sh",
    "run-llamacpp-server.example.bat",
    "run-llamacpp-server.example.sh",
    "run-with-ollama-bridge.bat",
    "run-with-ollama-bridge.sh",
  ];
  for (const file of obsoleteFiles) {
    assert.equal(await fileExists(file), false, `${file} should not exist`);
    sourceScriptAssertionTests += 1;
  }

  const packageJson = JSON.parse(await readFile(projectFile("package.json"), "utf8"));
  assert.equal(packageJson.name, "hypergraph-converter-studio");
  assert.equal(packageJson.version, "7.3.14");
  sourceScriptAssertionTests += 2;

  const rootScripts = [
    "run-with-ollama.bat",
    "run-with-ollama.sh",
    "run-local-runtime-bridge.bat",
    "run-local-runtime-bridge.sh",
    "setup-ollama-model.bat",
    "setup-ollama-model.sh",
    "check-local-model-runtime.ps1",
    "check-local-model-runtime.sh",
  ];
  for (const file of rootScripts) {
    const source = await readFile(projectFile(file), "utf8");
    assert.doesNotMatch(source, /llama\.cpp|llama-cpp|llamacpp|openai-compatible|\/v1\//i, file);
    assert.doesNotMatch(source, /\bProvider\b/, file);
    sourceScriptAssertionTests += 2;
  }
}

console.log(`settings migration: ${settingsMigrationTests}/10`);
console.log(`automatic connection fallback: ${automaticConnectionTests}/10`);
console.log(`client payloads: ${clientPayloadTests}/5`);
console.log(`UI assertions: ${uiAssertionTests}/13`);
console.log(`diagnostic isolation: ${diagnosticsTests}/9`);
console.log(`bridge allowlist: ${bridgeAllowlistTests}/6`);
console.log(`conversation/action regressions: ${conversationActionRegressionTests}/10`);
console.log(`script/source assertions: ${sourceScriptAssertionTests}/24`);
console.log("Ollama-only local model tests passed.");
