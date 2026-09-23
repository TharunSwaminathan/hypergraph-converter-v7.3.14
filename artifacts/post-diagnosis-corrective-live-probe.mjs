// Corrective qualification probe. It asks the production planner for drafts and validates them.
// It never resolves, stages, applies, commits, or otherwise executes a graph mutation.
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { buildGraphMutationPlannerPrompt } from "../src/agent/prompts/graphMutationPlannerPrompt.js";
import { planGraphMutationWithModel } from "../src/agent/graphMutationModelPlanner.js";
import {
  classifyLocalModelError,
  generateWithLocalModel,
  runOllamaStructuredHealthCheck,
} from "../src/agent/localModelClient.js";

const model = "qwen3:8b";
const directBaseUrl = "http://127.0.0.1:11434";
const bridgeBaseUrl = "http://127.0.0.1:8787/ollama";
const bridgeHealthUrl = "http://127.0.0.1:8787/health";
const bridgeOrigin = "http://127.0.0.1:5178";
const graph = [
  { id: "h0", vertices: ["Alice", "Bob"], weight: 1, time: 1, attributes: { color: "red" } },
  { id: "h1", vertices: ["Bob", "Carol"], weight: 2, time: 2, attributes: { color: "blue" } },
];
const graphIdentity = {
  graphId: "post-diagnosis-corrective-qualification-only",
  graphVersion: 1,
  graphFingerprint: "post-diagnosis-corrective-qualification-only",
};
const matrixCases = [
  ["ADD_HYPEREDGE", "Create a new hyperedge h2 with Alice and Carol."],
  ["REMOVE_HYPEREDGE", "Remove hyperedge h1."],
  ["ADD_INCIDENCE", "Add Alice to hyperedge h1."],
  ["REMOVE_INCIDENCE", "Remove Alice from hyperedge h0 and keep h0 if it becomes empty."],
  ["RENAME_HYPEREDGE", "Rename hyperedge h1 to hNew."],
  ["RENAME_VERTEX", "Rename vertex Alice to Alicia everywhere."],
  ["REMOVE_VERTEX_GLOBAL", "Remove vertex Bob everywhere and keep empty hyperedges."],
  ["SET_HYPEREDGE_WEIGHT", "Set the weight of hyperedge h0 to 3.5."],
  ["SET_HYPEREDGE_TIME", "Set the time of hyperedge h0 to 2026."],
  ["SET_HYPEREDGE_ATTRIBUTE", "Set the color attribute of hyperedge h0 to green."],
  ["REMOVE_HYPEREDGE_ATTRIBUTE", "Remove the color attribute from hyperedge h0."],
  ["CLEAR_GRAPH", "Clear the graph."],
  ["UNDO_LAST_MUTATION", "Undo the last graph mutation."],
];
const evidence = {
  generatedAt: null,
  node: process.execPath,
  model,
  noMutationExecution: true,
  graph: "qualification-only in-memory graph; drafts are validated but never resolved or executed",
  environment: {},
  matrixRuns: [],
  supplemental: [],
  summary: null,
};
const outputUrl = new URL("./post-diagnosis-corrective-live-ollama.json", import.meta.url);
const config = baseUrl => ({
  enabled: true,
  activeBaseUrl: baseUrl,
  model,
  timeoutMs: 90_000,
  temperature: 0.1,
});

async function save() {
  evidence.generatedAt = new Date().toISOString();
  await writeFile(outputUrl, `${JSON.stringify(evidence, null, 2)}\n`);
}

function compactAttempts(attempts = []) {
  return attempts.map(attempt => ({
    attempt: attempt.attempt,
    status: attempt.status,
    classification: attempt.classification ?? null,
    validatorErrors: attempt.validationErrors ?? [],
    rawResponsePreview: attempt.rawResponsePreview?.slice(0, 800) ?? null,
  }));
}

function planEvidence(result, expectedOperation = null) {
  const operationTypes = result.draft?.operations?.map(operation => operation.type) ?? [];
  const operationMatched = expectedOperation == null || operationTypes.includes(expectedOperation);
  const finalValid = Boolean(result.ok && operationMatched);
  return {
    ok: finalValid,
    classification: result.classification ?? result.draft?.classification ?? null,
    expectedOperation,
    operationTypes,
    operationMatched,
    firstAttemptValid: result.attempts?.[0]?.status === "valid",
    repairUsed: (result.attempts?.length ?? 0) > 1,
    finalValid,
    attempts: compactAttempts(result.attempts),
    validatorErrors: (result.attempts ?? []).flatMap(attempt => attempt.validationErrors ?? []),
    elapsedMs: result.elapsedMs,
    promptChars: result.request?.promptChars ?? null,
    schemaChars: result.request?.schemaChars ?? null,
    metrics: result.metrics ?? [],
    previewOnly: result.draft?.previewOnly ?? null,
    correction: result.draft?.correction ?? null,
    fallbackReason: result.fallbackReason ?? null,
  };
}

async function runPlan(userQuery, options = {}) {
  return planGraphMutationWithModel({
    config: config(options.baseUrl ?? directBaseUrl),
    userQuery,
    hyperedges: graph,
    graphIdentity,
    graphHistory: [{ id: "qualification-history-entry" }],
    pendingAction: options.pendingAction ?? null,
    timeoutMs: options.timeoutMs ?? 90_000,
    signal: options.signal ?? null,
    generate: options.generate ?? generateWithLocalModel,
  });
}

async function recordSupplemental(name, fn) {
  const started = performance.now();
  let row;
  try {
    row = { name, ...(await fn()), wallElapsedMs: Math.round(performance.now() - started) };
  } catch (error) {
    row = {
      name,
      ok: false,
      classification: classifyLocalModelError(error),
      error: error instanceof Error ? error.message : String(error),
      wallElapsedMs: Math.round(performance.now() - started),
    };
  }
  evidence.supplemental.push(row);
  await save();
  process.stdout.write(`${JSON.stringify(row)}\n`);
  return row;
}

await recordSupplemental("ollama_environment", async () => {
  const [versionResponse, tagsResponse] = await Promise.all([
    fetch(`${directBaseUrl}/api/version`, { redirect: "error" }),
    fetch(`${directBaseUrl}/api/tags`, { redirect: "error" }),
  ]);
  const version = await versionResponse.json();
  const tags = await tagsResponse.json();
  const selected = tags.models?.find(item => item.name === model) ?? null;
  evidence.environment = {
    ollamaVersion: version.version ?? null,
    model: selected,
  };
  return {
    ok: versionResponse.ok && tagsResponse.ok && version.version === "0.34.2" && Boolean(selected),
    ollamaVersion: version.version ?? null,
    selectedModel: selected,
  };
});

await recordSupplemental("bridge_identity", async () => {
  const response = await fetch(bridgeHealthUrl, {
    redirect: "error",
    headers: { Origin: bridgeOrigin },
  });
  const data = await response.json();
  return {
    ok: response.ok && data.service === "hypergraph-ollama-bridge",
    httpStatus: response.status,
    service: data.service ?? null,
    allowedOrigins: data.allowedOrigins ?? [],
  };
});

await recordSupplemental("direct_tiny_structured_generation", async () => {
  const result = await runOllamaStructuredHealthCheck(directBaseUrl, model, { timeoutMs: 60_000 });
  return { ok: result.ok, result };
});
await recordSupplemental("bridge_tiny_structured_generation", async () => {
  const result = await runOllamaStructuredHealthCheck(bridgeBaseUrl, model, { timeoutMs: 60_000 });
  return { ok: result.ok, result };
});

for (let run = 1; run <= 2; run += 1) {
  const runEvidence = { run, startedAt: new Date().toISOString(), cases: [], passed: 0, total: matrixCases.length, ok: false };
  evidence.matrixRuns.push(runEvidence);
  for (const [expectedOperation, userQuery] of matrixCases) {
    const started = performance.now();
    let row;
    try {
      const result = await runPlan(userQuery);
      row = {
        expectedOperation,
        userQuery,
        ...planEvidence(result, expectedOperation),
        wallElapsedMs: Math.round(performance.now() - started),
      };
    } catch (error) {
      row = {
        expectedOperation,
        userQuery,
        ok: false,
        finalValid: false,
        classification: classifyLocalModelError(error),
        error: error instanceof Error ? error.message : String(error),
        wallElapsedMs: Math.round(performance.now() - started),
      };
    }
    runEvidence.cases.push(row);
    runEvidence.passed = runEvidence.cases.filter(item => item.finalValid).length;
    runEvidence.ok = runEvidence.passed === runEvidence.total;
    await save();
    process.stdout.write(`${JSON.stringify({ matrixRun: run, ...row })}\n`);
  }
  runEvidence.completedAt = new Date().toISOString();
  await save();
}

await recordSupplemental("clarification", async () => {
  const result = await runPlan("Remove that vertex from the graph.");
  const row = planEvidence(result);
  return { ...row, ok: row.finalValid && row.classification === "clarification" };
});
await recordSupplemental("not_mutation", async () => {
  const result = await runPlan("What is a hyperedge?");
  const row = planEvidence(result);
  return { ...row, ok: row.finalValid && row.classification === "not_mutation" };
});
await recordSupplemental("preview_only", async () => {
  const result = await runPlan("Preview adding Alice to h1 without changing the graph.");
  const row = planEvidence(result, "ADD_INCIDENCE");
  return { ...row, ok: row.finalValid && row.previewOnly === true };
});
await recordSupplemental("pending_correction", async () => {
  const pendingAction = {
    actionType: "apply_graph_mutation",
    plan: { operations: [{ type: "ADD_INCIDENCE", vertexId: "Alice", hyperedgeId: "h0" }] },
  };
  const result = await runPlan("Actually, add Carol to h0 instead.", { pendingAction });
  const row = planEvidence(result, "ADD_INCIDENCE");
  return {
    ...row,
    ok: row.finalValid && row.correction?.isCorrection === true && row.correction?.replacePendingPlan === true,
  };
});

await recordSupplemental("live_invalid_first_then_repair", async () => {
  let calls = 0;
  const result = await runPlan("Add Alice to h1.", {
    generate: async (...args) => {
      calls += 1;
      if (calls === 1) return '{"task":"plan_graph_mutation","classification":"mutation","operations":[]}';
      return generateWithLocalModel(...args);
    },
  });
  const row = planEvidence(result, "ADD_INCIDENCE");
  return {
    ...row,
    calls,
    ok: row.finalValid && row.repairUsed && row.attempts?.[0]?.status === "invalid" && row.attempts?.[1]?.status === "repaired",
  };
});

await recordSupplemental("invalid_first_then_repair_timeout_provenance", async () => {
  let calls = 0;
  const result = await runPlan("Add Alice to h1.", {
    generate: async () => {
      calls += 1;
      if (calls === 1) return '{"task":"plan_graph_mutation","classification":"mutation","operations":[]}';
      throw Object.assign(new Error("Ollama request timed out."), { classification: "model_generation_timeout" });
    },
  });
  const firstErrors = result.attempts?.[0]?.validationErrors ?? [];
  return {
    ok: !result.ok
      && result.classification === "model_generation_timeout"
      && result.attempts?.[0]?.status === "invalid"
      && firstErrors.length > 0
      && /Attempt 1 structured validation failed/.test(result.fallbackReason ?? ""),
    calls,
    classification: result.classification,
    fallbackReason: result.fallbackReason,
    firstAttemptValid: false,
    repairUsed: true,
    finalValid: false,
    attempts: compactAttempts(result.attempts),
    validatorErrors: firstErrors,
  };
});

await recordSupplemental("live_timeout", async () => {
  const request = buildGraphMutationPlannerPrompt({ userQuery: "Add Alice to h1.", hyperedges: graph, graphIdentity });
  try {
    await generateWithLocalModel(config(directBaseUrl), request, { timeoutMs: 1 });
    return { ok: false, classification: "unexpected_completion" };
  } catch (error) {
    const classification = classifyLocalModelError(error);
    return { ok: classification === "model_generation_timeout", classification, error: error.message };
  }
});

await recordSupplemental("live_explicit_cancel", async () => {
  const request = buildGraphMutationPlannerPrompt({ userQuery: "Add Alice to h1.", hyperedges: graph, graphIdentity });
  const controller = new AbortController();
  setTimeout(() => controller.abort("user_cancelled"), 20);
  try {
    await generateWithLocalModel(config(directBaseUrl), request, { timeoutMs: 60_000, signal: controller.signal });
    return { ok: false, classification: "unexpected_completion" };
  } catch (error) {
    const classification = classifyLocalModelError(error);
    return { ok: classification === "request_aborted", classification, error: error.message };
  }
});

await recordSupplemental("direct_bridge_parity", async () => {
  const userQuery = "Add Alice to h1.";
  const [direct, bridge] = await Promise.all([
    runPlan(userQuery, { baseUrl: directBaseUrl }),
    runPlan(userQuery, { baseUrl: bridgeBaseUrl }),
  ]);
  const directEvidence = planEvidence(direct, "ADD_INCIDENCE");
  const bridgeEvidence = planEvidence(bridge, "ADD_INCIDENCE");
  return {
    ok: directEvidence.finalValid
      && bridgeEvidence.finalValid
      && directEvidence.classification === bridgeEvidence.classification,
    direct: directEvidence,
    bridge: bridgeEvidence,
  };
});

const matrixPass = evidence.matrixRuns.length === 2
  && evidence.matrixRuns.every(run => run.passed === 13 && run.total === 13 && run.ok);
const requiredSupplemental = new Set([
  "ollama_environment",
  "bridge_identity",
  "direct_tiny_structured_generation",
  "bridge_tiny_structured_generation",
  "clarification",
  "not_mutation",
  "preview_only",
  "pending_correction",
  "live_invalid_first_then_repair",
  "invalid_first_then_repair_timeout_provenance",
  "live_timeout",
  "live_explicit_cancel",
  "direct_bridge_parity",
]);
const supplementalFailures = evidence.supplemental
  .filter(row => requiredSupplemental.has(row.name) && !row.ok)
  .map(row => row.name);
evidence.summary = {
  matrixPass,
  matrixRuns: evidence.matrixRuns.map(run => ({ run: run.run, passed: run.passed, total: run.total, ok: run.ok })),
  supplementalFailures,
  allRequiredPassed: matrixPass && supplementalFailures.length === 0,
};
await save();
process.stdout.write(`${JSON.stringify(evidence.summary)}\n`);
if (!evidence.summary.allRequiredPassed) process.exitCode = 1;
