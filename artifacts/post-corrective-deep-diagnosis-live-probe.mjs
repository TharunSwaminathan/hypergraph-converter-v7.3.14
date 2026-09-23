// Diagnosis-only probe. Builds drafts and validates responses; it never executes a graph plan.
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { buildGraphMutationPlannerPrompt } from '../src/agent/prompts/graphMutationPlannerPrompt.js';
import { planGraphMutationWithModel } from '../src/agent/graphMutationModelPlanner.js';
import { generateWithLocalModel, runOllamaStructuredHealthCheck, classifyLocalModelError } from '../src/agent/localModelClient.js';
import { validateGraphMutationDraft } from '../src/agent/graphMutationDraftValidator.js';

const node = process.execPath;
const model = 'qwen3:8b';
const graph = [
  { id: 'h0', vertices: ['Alice', 'Bob'], weight: 1, time: 1, attributes: { color: 'red' } },
  { id: 'h1', vertices: ['Bob', 'Carol'], weight: 2, time: 2, attributes: { color: 'blue' } },
];
const graphIdentity = { graphId: 'diagnostic-only', graphVersion: 1, graphFingerprint: 'diagnostic-only' };
const cases = [
  ['ADD_INCIDENCE', 'Add Alice to h1.'],
  ['REMOVE_INCIDENCE', 'Remove Alice from h0 and keep h0 if it becomes empty.'],
  ['ADD_HYPEREDGE', 'Create a new hyperedge h2 with Alice and Carol.'],
  ['REMOVE_HYPEREDGE', 'Remove hyperedge h1.'],
  ['RENAME_VERTEX', 'Rename vertex Alice to Alicia everywhere.'],
  ['RENAME_HYPEREDGE', 'Rename hyperedge h1 to hNew.'],
  ['REMOVE_VERTEX_GLOBAL', 'Remove vertex Bob everywhere and keep empty hyperedges.'],
  ['SET_HYPEREDGE_WEIGHT', 'Set the weight of h0 to 3.5.'],
  ['SET_HYPEREDGE_TIME', 'Set the time of h0 to 2026.'],
  ['SET_HYPEREDGE_ATTRIBUTE', 'Set the color attribute of h0 to green.'],
  ['REMOVE_HYPEREDGE_ATTRIBUTE', 'Remove the color attribute from h0.'],
  ['CLEAR_GRAPH', 'Clear the graph.'],
  ['UNDO_LAST_MUTATION', 'Undo the last graph mutation.'],
  ['CLARIFICATION', 'Remove that vertex from the graph.'],
  ['NOT_MUTATION', 'What is a hyperedge?'],
  ['PREVIEW_ONLY', 'Preview adding Alice to h1 without changing the graph.'],
  ['PENDING_CORRECTION', 'Actually, add Carol to h0 instead.'],
];
const rows = [];
const config = baseUrl => ({ enabled: true, activeBaseUrl: baseUrl, model, timeoutMs: 60000, temperature: 0.1 });
const out = new URL('./post-corrective-deep-diagnosis-live-ollama.json', import.meta.url);
async function save() {
  await writeFile(out, JSON.stringify({
    generatedAt: new Date().toISOString(), node, model,
    graph: 'diagnostic-only in-memory graph; no operations executed', rows,
  }, null, 2) + '\n');
}
async function record(name, fn) {
  const start = performance.now();
  try { rows.push({ name, ...(await fn()), elapsedMs: Math.round(performance.now() - start) }); }
  catch (error) { rows.push({ name, ok: false, classification: classifyLocalModelError(error), error: String(error?.message ?? error), elapsedMs: Math.round(performance.now() - start) }); }
  await save();
  process.stdout.write(JSON.stringify(rows.at(-1)) + '\n');
}
await record('direct_api_tags', async () => {
  const response = await fetch('http://127.0.0.1:11434/api/tags');
  const data = await response.json();
  return { ok: response.ok && data.models?.some(item => item.name === model), httpStatus: response.status, modelNames: data.models?.map(item => item.name) };
});
await record('bridge_health', async () => {
  const response = await fetch('http://127.0.0.1:8787/health', { headers: { Origin: 'http://127.0.0.1:5178' } });
  const data = await response.json();
  return { ok: response.ok && data.service === 'hypergraph-ollama-bridge', httpStatus: response.status, service: data.service, allowedOrigins: data.allowedOrigins };
});
await record('bridge_api_tags', async () => {
  const response = await fetch('http://127.0.0.1:8787/ollama/api/tags', { headers: { Origin: 'http://127.0.0.1:5178' } });
  const data = await response.json();
  return { ok: response.ok && data.models?.some(item => item.name === model), httpStatus: response.status, modelNames: data.models?.map(item => item.name) };
});
await record('direct_tiny_structured_generation', async () => ({ ok: (await runOllamaStructuredHealthCheck('http://127.0.0.1:11434', model, { timeoutMs: 60000 })).ok }));
await record('bridge_tiny_structured_generation', async () => ({ ok: (await runOllamaStructuredHealthCheck('http://127.0.0.1:8787/ollama', model, { timeoutMs: 60000 })).ok }));
for (const [name, userQuery] of cases) {
  await record(name, async () => {
    const result = await planGraphMutationWithModel({
      config: config('http://127.0.0.1:11434'), userQuery, hyperedges: graph, graphIdentity,
      pendingAction: name === 'PENDING_CORRECTION' ? { actionType: 'apply_graph_mutation', plan: { operations: [{ type: 'ADD_INCIDENCE', vertexId: 'Alice', hyperedgeId: 'h0' }] } } : null,
      timeoutMs: 60000,
    });
    return {
      ok: result.ok, classification: result.classification ?? result.draft?.classification ?? null,
      firstAttemptValid: result.attempts?.[0]?.status === 'valid',
      repairRequired: result.attempts?.[0]?.status !== 'valid',
      finalValid: Boolean(result.ok),
      attempts: result.attempts?.map(a => ({ attempt: a.attempt, status: a.status, errors: a.validationErrors, rawPreview: a.rawResponsePreview?.slice(0, 500) })),
      metrics: result.metrics, promptChars: result.request?.promptChars, schemaChars: result.request?.schemaChars,
      fallbackReason: result.fallbackReason,
      draftOperationTypes: result.draft?.operations?.map(op => op.type), previewOnly: result.draft?.previewOnly,
    };
  });
}
await record('bridge_ADD_INCIDENCE_parity', async () => {
  const userQuery = 'Add Alice to h1.';
  const request = buildGraphMutationPlannerPrompt({ userQuery, hyperedges: graph, graphIdentity });
  const metrics = [];
  const raw = await generateWithLocalModel(config('http://127.0.0.1:8787/ollama'), request, { timeoutMs: 60000, onMetrics: m => metrics.push(m) });
  const validation = validateGraphMutationDraft(raw);
  return { ok: validation.ok, firstAttemptValid: validation.ok, finalValid: validation.ok, repairRequired: false, errors: validation.errors, rawPreview: raw.slice(0, 500), metrics, promptChars: request.promptChars, schemaChars: request.schemaChars };
});
await record('invalid_first_then_repair_timeout_controlled', async () => {
  let calls = 0;
  const result = await planGraphMutationWithModel({
    config: config('http://127.0.0.1:11434'), userQuery: 'Add Alice to h1.',
    hyperedges: graph, graphIdentity,
    generate: async () => {
      calls += 1;
      if (calls === 1) return '{"task":"plan_graph_mutation","classification":"mutation","operations":[]}';
      throw Object.assign(new Error('Ollama request timed out.'), { classification: 'model_generation_timeout' });
    },
  });
  return {
    ok: !result.ok && result.classification === 'model_generation_timeout' && result.attempts?.[0]?.status === 'invalid',
    synthetic: true, calls, classification: result.classification, fallbackReason: result.fallbackReason,
    firstAttemptValid: false, repairRequired: true, finalValid: false,
    attempts: result.attempts?.map(a => ({ attempt: a.attempt, status: a.status, errors: a.validationErrors })),
    topLevelValidationPresent: Boolean(result.validation),
  };
});
await record('live_timeout_path', async () => {
  const request = buildGraphMutationPlannerPrompt({ userQuery: 'Add Alice to h1.', hyperedges: graph, graphIdentity });
  await generateWithLocalModel(config('http://127.0.0.1:11434'), request, { timeoutMs: 1 });
  return { ok: true, classification: 'unexpected_completion' };
});
await record('live_cancellation_path', async () => {
  const request = buildGraphMutationPlannerPrompt({ userQuery: 'Add Alice to h1.', hyperedges: graph, graphIdentity });
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 20);
  await generateWithLocalModel(config('http://127.0.0.1:11434'), request, { timeoutMs: 60000, signal: controller.signal });
  return { ok: true, classification: 'unexpected_completion' };
});
