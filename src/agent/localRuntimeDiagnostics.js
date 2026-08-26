import { RECOMMENDED_OLLAMA_MODEL } from "./localModelSettings.js";
import {
  BRIDGE_HEALTH_URL,
  BRIDGE_OLLAMA_BASE_URL,
  classifyOllamaConnectionError,
  connectOllamaAutomatically,
  DIRECT_OLLAMA_BASE_URL,
  OLLAMA_TRANSPORTS,
  probeOllamaTransport,
  suggestedFixForOllamaFailure,
  transportLabel,
} from "./ollamaConnectionManager.js";
import { classifyBaseUrl, REMOTE_BLOCK_MESSAGE, runOllamaStructuredHealthCheck } from "./localModelClient.js";

export const DEFAULT_OLLAMA_BASE_URL = DIRECT_OLLAMA_BASE_URL;
export const DEFAULT_BRIDGE_HEALTH_URL = BRIDGE_HEALTH_URL;
export const DEFAULT_BRIDGE_OLLAMA_BASE_URL = BRIDGE_OLLAMA_BASE_URL;
export const DEFAULT_GITHUB_PAGES_ORIGIN = "https://hypergraphproject.github.io";
export const REMOTE_BLOCK_TEXT = REMOTE_BLOCK_MESSAGE;

export const RUNTIME_ERROR_CLASSES = [
  "runtime_not_running",
  "model_missing",
  "model_generation_failed",
  "model_generation_timeout",
  "structured_output_invalid",
  "invalid_json_response",
  "remote_endpoint_blocked",
  "bridge_not_running",
  "bridge_runtime_unreachable",
  "unknown_network_error",
];

export function detectDeploymentMode(locationLike = globalThis.location) {
  const origin = locationLike?.origin ?? "";
  const protocol = locationLike?.protocol ?? "";
  const hostname = locationLike?.hostname ?? "";
  const isLocal = ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(String(hostname).toLowerCase());
  const isGithubPages = String(hostname).toLowerCase().includes("github.io");
  return {
    origin,
    protocol,
    hostname,
    mode: isLocal ? "local_dev" : isGithubPages ? "github_pages" : "other_static_hosting",
    message: isLocal
      ? "Local development mode detected. Direct local model connections are usually easiest here."
      : isGithubPages
        ? "GitHub Pages mode detected. Ollama must be reachable from this browser; the local bridge can help with CORS/private-network restrictions."
        : "Static hosting mode detected. The browser can only reach a local runtime that is already running.",
  };
}

export function runtimeCommandLabel(kind) {
  return {
    browserFetch: "browser fetch test",
    powershellCurl: "PowerShell curl test",
    wslCurl: "WSL curl test",
    ollamaOrigins: "Ollama origins setup command",
    diagnosticReport: "diagnostic report",
  }[kind] ?? "diagnostic text";
}

export function buildRuntimeCommands(config = {}, deployment = detectDeploymentMode()) {
  const model = config.model || RECOMMENDED_OLLAMA_MODEL;
  return {
    browserFetch: [
      `fetch("${DIRECT_OLLAMA_BASE_URL}/api/tags")`,
      "  .then(r => r.json())",
      "  .then(console.log)",
      "  .catch(console.error);",
      "",
      `fetch("${BRIDGE_OLLAMA_BASE_URL}/api/tags")`,
      "  .then(r => r.json())",
      "  .then(console.log)",
      "  .catch(console.error);",
    ].join("\n"),
    powershellCurl: [
      `curl.exe ${DIRECT_OLLAMA_BASE_URL}/api/tags`,
      `curl.exe ${BRIDGE_HEALTH_URL}`,
      `curl.exe ${BRIDGE_OLLAMA_BASE_URL}/api/tags`,
    ].join("\n"),
    wslCurl: [
      `curl ${DIRECT_OLLAMA_BASE_URL}/api/tags`,
      `curl ${BRIDGE_HEALTH_URL}`,
      `curl ${BRIDGE_OLLAMA_BASE_URL}/api/tags`,
    ].join("\n"),
    ollamaOrigins: `OLLAMA_ORIGINS=${deployment.origin || DEFAULT_GITHUB_PAGES_ORIGIN},http://localhost:5173,http://127.0.0.1:5173 ollama serve`,
    diagnosticReport: [
      "Hypergraph Converter Studio local model diagnostics",
      `Runtime: Ollama`,
      `Model: ${model}`,
      `Direct endpoint: ${DIRECT_OLLAMA_BASE_URL}`,
      `Bridge endpoint: ${BRIDGE_OLLAMA_BASE_URL}`,
      `Page origin: ${deployment.origin}`,
      `Deployment mode: ${deployment.mode}`,
    ].join("\n"),
    githubPagesSetupHelp: [
      "GitHub Pages is static hosting and cannot run Ollama.",
      "Start Ollama on the same machine as the browser, pull qwen3:8b, then launch the dashboard with run-with-ollama.sh or run-with-ollama.bat.",
      "The app will automatically try direct Ollama first and the local bridge second; you do not choose a runtime.",
    ].join("\n"),
  };
}

export function formatActionableRuntimeError(error, context = {}) {
  const classification = error?.classification || classifyOllamaConnectionError(error);
  return {
    classification,
    message: error instanceof Error ? error.message : String(error ?? ""),
    suggestedFix: suggestedFixForOllamaFailure(classification, context.model || RECOMMENDED_OLLAMA_MODEL),
  };
}

function statusItem(status, message, extras = {}) {
  return { status, message, ...extras };
}

export function createRuntimeDiagnosticsSnapshot(config = {}, locationLike = globalThis.location) {
  const deploymentInfo = detectDeploymentMode(locationLike);
  const activeTransport = config.activeTransport || config.lastSuccessfulTransport || null;
  const activeBaseUrl = config.activeBaseUrl || (activeTransport ? OLLAMA_TRANSPORTS[activeTransport]?.baseUrl : "");
  return {
    runtime: "ollama",
    runtimeLabel: "Ollama",
    selectedModel: config.model || RECOMMENDED_OLLAMA_MODEL,
    connectionStatus: config.enabled === false ? "disabled" : "disconnected",
    activeTransport,
    activeTransportLabel: activeTransport ? transportLabel(activeTransport) : "None",
    baseUrl: activeBaseUrl,
    activeEndpoint: activeBaseUrl || "None",
    baseUrlInfo: classifyBaseUrl(activeBaseUrl || DIRECT_OLLAMA_BASE_URL),
    deploymentInfo,
    currentPageOrigin: deploymentInfo.origin,
    currentPageProtocol: deploymentInfo.protocol,
    currentHostname: deploymentInfo.hostname,
    directRuntimeReachability: statusItem("not_tested", "Run diagnostics to test direct Ollama."),
    bridgeReachability: statusItem("not_tested", "Run diagnostics to test the local bridge."),
    modelListingStatus: statusItem("not_tested", "Run diagnostics to list Ollama models.", { models: [] }),
    generationStatus: statusItem("not_tested", "Run diagnostics to test tiny structured generation."),
    plannerReadiness: statusItem("not_tested", "Run the graph planner readiness diagnostic for a full structured planner request."),
    lastConnectionErrorClassification: "",
    suggestedFix: config.enabled === false
      ? "Enable the local assistant or use deterministic controls without a model."
      : "Start Ollama and click Connect or Reconnect.",
    warnings: [],
    commands: buildRuntimeCommands(config, deploymentInfo),
    overallStatus: "not_tested",
    summary: "Run diagnostics to check direct Ollama and the local bridge.",
  };
}

export function diagnosticsEstablishConnection(diagnostics) {
  return diagnostics?.overallStatus === "ok" && diagnostics?.generationStatus?.status === "ok";
}

export function isIsolatedRuntimeProbeMode(mode) {
  return mode === "direct-ollama" || mode === "bridge";
}

function applyAttemptToSnapshot(snapshot, attempt) {
  const field = attempt.transport === "bridge" ? "bridgeReachability" : "directRuntimeReachability";
  return {
    ...snapshot,
    [field]: attempt.ok
      ? statusItem("ok", `${attempt.label} responded.`, { classification: "", baseUrl: attempt.baseUrl })
      : statusItem("failed", `${attempt.label} failed: ${attempt.message}`, {
        classification: attempt.classification,
        suggestedFix: attempt.suggestedFix,
        baseUrl: attempt.baseUrl,
      }),
    modelListingStatus: attempt.ok
      ? statusItem("ok", `Model listing returned ${(attempt.models ?? []).length} model${(attempt.models ?? []).length === 1 ? "" : "s"}.`, { models: attempt.models ?? [] })
      : snapshot.modelListingStatus,
    generationStatus: attempt.ok
      ? statusItem("ok", "Tiny structured generation returned JSON status ok.")
      : snapshot.generationStatus,
  };
}

export async function runRuntimeDiagnostics({
  config = {},
  mode = "current",
  testGeneration = true,
  locationLike = globalThis.location,
} = {}) {
  const started = {
    ...createRuntimeDiagnosticsSnapshot(config, locationLike),
    ranAt: new Date().toISOString(),
    mode,
  };
  if (config.enabled === false) {
    return {
      ...started,
      connectionStatus: "disabled",
      overallStatus: "warning",
      summary: "Local assistant is disconnected. Deterministic dashboard controls still work.",
    };
  }

  if (mode === "direct-ollama" || mode === "bridge") {
    const transport = mode === "bridge" ? "bridge" : "direct";
    const attempt = await probeOllamaTransport(transport, config);
    const snapshot = applyAttemptToSnapshot(started, attempt);
    return {
      ...snapshot,
      activeTransport: config.activeTransport || null,
      activeTransportLabel: config.activeTransport ? transportLabel(config.activeTransport) : "None",
      overallStatus: attempt.ok ? "ok" : "failed",
      lastConnectionErrorClassification: attempt.ok ? "" : attempt.classification,
      suggestedFix: attempt.ok ? "Probe succeeded. Click Reconnect if you want to use this connection." : attempt.suggestedFix,
      summary: attempt.ok ? `${attempt.label} probe succeeded.` : `${attempt.label} probe failed.`,
      isolatedProbe: true,
    };
  }

  if (mode === "generation") {
    const transport = config.activeTransport || config.lastSuccessfulTransport || "direct";
    try {
      await runOllamaStructuredHealthCheck(OLLAMA_TRANSPORTS[transport].baseUrl, config.model || RECOMMENDED_OLLAMA_MODEL, config);
      return {
        ...started,
        activeTransport: transport,
        activeTransportLabel: transportLabel(transport),
        baseUrl: OLLAMA_TRANSPORTS[transport].baseUrl,
        generationStatus: statusItem("ok", "Tiny structured generation returned JSON status ok."),
        overallStatus: "ok",
        summary: "Simple generation test passed.",
      };
    } catch (error) {
      const classified = formatActionableRuntimeError(error, config);
      return {
        ...started,
        generationStatus: statusItem("failed", classified.message, {
          classification: classified.classification,
          suggestedFix: classified.suggestedFix,
        }),
        lastConnectionErrorClassification: classified.classification,
        suggestedFix: classified.suggestedFix,
        overallStatus: "failed",
        summary: classified.suggestedFix,
      };
    }
  }

  const result = await connectOllamaAutomatically(config);
  let snapshot = { ...started, attempts: result.attempts };
  for (const attempt of result.attempts ?? []) snapshot = applyAttemptToSnapshot(snapshot, attempt);
  if (result.ok) {
    return {
      ...snapshot,
      activeTransport: result.transport,
      activeTransportLabel: transportLabel(result.transport),
      baseUrl: result.baseUrl,
      activeEndpoint: result.baseUrl,
      connectionStatus: "connected",
      modelListingStatus: statusItem("ok", `Model listing returned ${result.models.length} model${result.models.length === 1 ? "" : "s"}.`, { models: result.models }),
      generationStatus: testGeneration
        ? statusItem("ok", "Tiny structured generation returned JSON status ok.")
        : snapshot.generationStatus,
      overallStatus: "ok",
      summary: result.message,
    };
  }
  return {
    ...snapshot,
    connectionStatus: "error",
    lastConnectionErrorClassification: result.classification,
    suggestedFix: result.suggestedFix,
    overallStatus: "failed",
    summary: `${result.message}\n${result.details || ""}`.trim(),
  };
}
