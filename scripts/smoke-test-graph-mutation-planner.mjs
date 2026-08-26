#!/usr/bin/env node
import { validateGraphMutationDraft } from "../src/agent/graphMutationDraftValidator.js";
import { generateWithLocalModel, listLocalModels, classifyLocalModelError } from "../src/agent/localModelClient.js";
import { LOCAL_MODEL_TASK_TIMEOUTS, RECOMMENDED_OLLAMA_MODEL } from "../src/agent/localModelSettings.js";
import { buildGraphMutationPlannerPrompt } from "../src/agent/prompts/graphMutationPlannerPrompt.js";

const baseUrl = process.env.HYPERGRAPH_OLLAMA_BASE_URL
  || process.env.OLLAMA_BASE_URL
  || "http://localhost:11434";
const model = process.env.HYPERGRAPH_OLLAMA_MODEL
  || process.env.OLLAMA_MODEL
  || RECOMMENDED_OLLAMA_MODEL;
const timeoutMs = Number(process.env.HYPERGRAPH_PLANNER_TIMEOUT_MS || LOCAL_MODEL_TASK_TIMEOUTS.graph_mutation_planner_total);

const config = {
  enabled: true,
  activeBaseUrl: baseUrl,
  model,
  timeoutMs,
  temperature: 0.1,
};

const graph = [
  { id: "h0", vertices: ["4", "5"] },
  { id: "h1", vertices: ["7", "8"] },
];

const request = buildGraphMutationPlannerPrompt({
  userQuery: "Add vertex 4 to h0 again.",
  hyperedges: graph,
  graphIdentity: { graphId: "smoke", graphVersion: 1, graphFingerprint: "smoke" },
  recentReferences: { vertices: ["4"], hyperedges: ["h0"] },
});

function fail(message, details = {}) {
  console.error(`FAIL: ${message}`);
  if (Object.keys(details).length) console.error(JSON.stringify(details, null, 2));
  process.exitCode = 1;
}

try {
  console.log(`Graph planner smoke: ${model} at ${baseUrl}`);
  const models = await listLocalModels(config);
  if (!models.includes(model)) {
    fail(`model_not_pulled: ${model} was not listed by Ollama.`, { models });
  } else {
    const metrics = [];
    const started = performance.now();
    const raw = await generateWithLocalModel(config, request, {
      timeoutMs,
      onMetrics: metric => metrics.push(metric),
    });
    const validation = validateGraphMutationDraft(raw);
    const elapsedMs = Math.round(performance.now() - started);
    if (!validation.ok) {
      fail("invalid structured GraphMutationDraft returned.", {
        errors: validation.errors,
        rawPreview: String(raw ?? "").slice(0, 500),
        elapsedMs,
      });
    } else {
      const operations = validation.data.operations ?? [];
      const first = operations[0] ?? {};
      if (validation.data.classification !== "mutation" || first.type !== "ADD_INCIDENCE") {
        fail("planner returned a valid draft, but not the expected ADD_INCIDENCE smoke draft.", {
          classification: validation.data.classification,
          firstOperation: first,
          elapsedMs,
        });
      } else {
        console.log("PASS: valid GraphMutationDraft returned.");
        console.log(JSON.stringify({
          elapsedMs,
          promptChars: request.promptChars,
          schemaChars: request.schemaChars,
          numPredict: request.numPredict,
          metrics: metrics.at(-1) ?? null,
        }, null, 2));
      }
    }
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error), {
    classification: classifyLocalModelError(error),
    baseUrl,
    model,
  });
}
