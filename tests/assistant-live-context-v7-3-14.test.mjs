import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildAssistantApplicationSnapshot,
  summarizeAlgorithmState,
} from "../src/agent/assistantContextSnapshot.js";
import {
  composeAuthoritativeAlgorithmAnswer,
  composeHypotheticalHyperedgeDeletion,
  composeReadOnlyWorkflowExplanation,
} from "../src/agent/assistantReadOnlyGrounding.js";
import {
  buildBoundedSessionContext,
  buildConversationPrompt,
  MAX_APPLICATION_SNAPSHOT_CHARS,
} from "../src/agent/modelPromptBuilder.js";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";
import { compileDeterministicAction } from "../src/agent/deterministicNlu/compileDeterministicAction.js";

const algorithmSummary = summarizeAlgorithmState({
  algorithmId: "connected_components",
  algorithm: { label: "Connected Components" },
  result: {
    count: 3,
    components: [{ size: 7 }, { size: 2 }, { size: 1 }],
  },
});

const snapshot = buildAssistantApplicationSnapshot({
  hasGraph: true,
  graphId: "graph-live-1",
  graphVersion: 9,
  graphType: "DynamicHypergraph",
  graphFingerprint: "fp-live-1",
  hyperedgeCount: 12,
  vertexCount: 10,
  incidenceCount: 34,
  committedHyperedgeCount: 11,
  batchPreviewActive: true,
  batchPreviewHyperedgeCount: 12,
  batchParsedCount: 2,
  batchUnknownCount: 0,
  resultSummary: {
    hyperedges: 12,
    vertices: 10,
    incidences: 34,
    validationStatus: "Clean",
  },
  activeSection: "mappings",
  fmt: "simple",
  formatLabel: "H2V / Simple",
  expId: "h2v_txt",
  selectedMappingId: "h2v",
  selectedMappingSummary: {
    id: "h2v",
    title: "h2v",
    status: "computed",
    totalRows: 12,
    visibleRows: 12,
    complete: true,
  },
  graphView: "hypergraph",
  graphLayout: "force",
  graphSearch: "",
  vizLimit: 300,
  selectedGraphEntity: { type: "hyperedge", id: "h7", secret: "must-not-leak" },
  selectionLabel: "hyperedge h7",
  graphHistoryCount: 4,
  lastGraphMutation: { revision: 4, source: "conversation", summary: "Added one vertex", plan: { forbidden: true } },
  activeBatch: null,
  customRunning: false,
  customCodeExists: true,
  customCodeSource: "model",
  customResultId: "result-1",
  customResultCount: 12,
  customErr: "",
  customCode: "do not expose parser source",
  graphHyperedges: [{ id: "h1", vertices: ["private", "body"] }],
  algorithmSummary,
  pendingDynamicUpdate: {
    updateId: "pending-1",
    revision: 2,
    status: "VALIDATED",
    baseGraphVersion: 9,
    nextGraphVersion: 10,
    motifImpact: "CHANGED",
    operationCount: 1,
    resultCurrent: true,
    plan: { forbidden: true },
    updateDigest: "forbidden-digest",
  },
  recentVerifiedReferences: {
    vertices: ["v2", "v9"],
    hyperedges: ["h7"],
  },
  candy: {
    featureEnabled: true,
    status: "ready",
    authorized: true,
    runtimeVersion: "scope5-test",
    runtimeSessionId: "must-not-leak",
    token: "must-not-leak",
    capabilityStatus: "ready",
    runtimeCapabilityStatus: "ready",
    analysisStatus: "COMPLETED",
    capabilities: [{
      capability: "RUN_HYPERGRAPH_3EDGE_MOTIFS",
      algorithm: "HYPERGRAPH_3EDGE_MOTIF_COUNT",
      backend: "CUDA_STATIC",
      modes: ["STATIC"],
      devices: [{ id: 0, name: "GPU", computeCapability: "12.0", qualifiedArchitecture: "sm_120" }],
      executable: "forbidden-path",
    }],
    jobs: [{ jobId: "job-1", status: "completed", algorithm: "HYPERGRAPH_3EDGE_MOTIF_COUNT", backend: "CUDA_STATIC", mode: "STATIC" }],
    selectedMotifResult: {
      algorithm: "HYPERGRAPH_3EDGE_MOTIF_COUNT",
      backend: "CUDA_STATIC",
      mode: "STATIC",
      interpretation: "absolute_counts",
      inputGraphRef: { graphId: "graph-live-1", graphVersion: 9 },
      validation: { status: "passed" },
      native: { counts: Array(30).fill(0).map((_, i) => i), totalConnectedTriples: 435 },
      graphArtifactId: "forbidden-artifact",
    },
  },
});

assert.equal(snapshot.authority, "live_application_state_read_only");
assert.equal(snapshot.graph.version, 9);
assert.equal(snapshot.graph.preview.active, true);
assert.equal(snapshot.mapping.selected.id, "h2v");
assert.equal(snapshot.algorithm.status, "computed");
assert.equal(snapshot.algorithm.result.count, 3);
assert.equal(snapshot.algorithm.result.largestSize, 7);
assert.equal(snapshot.pendingDynamicUpdate.updateId, "pending-1");
assert.equal(snapshot.candy.status, "ready");
assert.equal(snapshot.candy.selectedResult.totalConnectedTriples, 435);

assert.deepEqual(snapshot.recentVerifiedReferences, [
  { kind: "vertex", id: "v2", graphVersion: null },
  { kind: "vertex", id: "v9", graphVersion: null },
  { kind: "hyperedge", id: "h7", graphVersion: null },
]);


const snapshotJson = JSON.stringify(snapshot);
for (const forbiddenKey of ["runtimeSessionId", "token", "parserCode", "graphHyperedges", "updateDigest", "graphArtifactId", "executable"]) {
  assert.equal(snapshotJson.includes(`\"${forbiddenKey}\"`), false, `assistant snapshot must exclude ${forbiddenKey}`);
}
assert.equal(snapshotJson.includes("do not expose parser source"), false);
assert.equal(snapshotJson.includes("private\",\"body"), false, "full graph memberships must not enter ordinary conversation context");

const notComputedAlgorithm = summarizeAlgorithmState({
  algorithmId: "connected_components",
  algorithm: { label: "Connected Components" },
  result: null,
});
assert.equal(notComputedAlgorithm.hasResult, false);
assert.equal(notComputedAlgorithm.status, "not_computed");
assert.match(
  composeAuthoritativeAlgorithmAnswer("How many connected components does the current graph have?", notComputedAlgorithm),
  /has not been computed/i,
);
assert.equal(
  composeAuthoritativeAlgorithmAnswer("How many connected components does the current graph have?", algorithmSummary),
  "The current Connected Components result has 3 connected components.",
);
assert.match(
  composeReadOnlyWorkflowExplanation("Explain what Run custom parser does, but do not run anything."),
  /Nothing was run from this explanation/i,
);
assert.equal(composeReadOnlyWorkflowExplanation("Run custom parser"), null,
  "the read-only explainer must not consume an executable parser request");
assert.match(
  composeHypotheticalHyperedgeDeletion("What would happen if I delete hyperedge h2?", [
    { id: "h0", vertices: ["A", "B"] },
    { id: "h1", vertices: ["B", "C"] },
    { id: "h2", vertices: ["A", "C", "D", "E"] },
  ]),
  /-1 hyperedge, -2 vertices, and -4 incidences/i,
);
assert.equal(composeHypotheticalHyperedgeDeletion("Delete hyperedge h2", [
  { id: "h2", vertices: ["A", "B"] },
]), null, "an executable deletion must stay on the deterministic mutation/confirmation path");

const bounded = buildBoundedSessionContext({
  conversation: [{ role: "user", text: "How many connected components does the current graph have?" }],
  applicationSnapshot: snapshot,
});
assert.equal(bounded.applicationSnapshot.algorithm.result.count, 3);
assert.ok(JSON.stringify(bounded.applicationSnapshot).length <= MAX_APPLICATION_SNAPSHOT_CHARS);

const prompt = buildConversationPrompt({
  userQuery: "How many connected components does the current graph have?",
  sessionContext: { applicationSnapshot: snapshot },
});
assert.match(prompt.messages[0].content, /authoritative read-only snapshot of the live Hypergraph Converter state/i);
assert.match(prompt.messages[0].content, /never authorizes actions/i);
assert.match(prompt.messages[0].content, /hasResult=false or status=not_computed/i);
assert.match(prompt.messages[1].content, /connected_components/);
assert.match(prompt.messages[1].content, /"count"\s*:\s*3/);

for (const query of [
  "How many connected components does the current graph have?",
  "Explain H2V",
  "What graph am I viewing?",
  "What are the current graph statistics?",
  "Explain what Run custom parser does, but do not run anything.",
]) {
  const nlu = analyzeDeterministicNlu(query, { graph: { graphId: "graph-live-1", graphVersion: 9, graphType: "Hypergraph" } });
  const compiled = compileDeterministicAction(nlu, { state: { hasGraph: true, graphId: "graph-live-1", graphVersion: 9, graphType: "Hypergraph" } });
  assert.equal(compiled.domain, "grounded_question", query);
  assert.equal(compiled.sideEffectClass, "read_only", query);
}

const panelSource = await readFile(new URL("../src/components/AgentChatPanel.jsx", import.meta.url), "utf8");
const handlerStart = panelSource.indexOf("async function handleCompiledGroundedQuestion");
const handlerEnd = panelSource.indexOf("async function handleCompiledHelpQuery", handlerStart);
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
const handler = panelSource.slice(handlerStart, handlerEnd);
assert.match(handler, /await runConversationPath\(query \?\? prepared\.nlu\?\.rawText/,
  "ordinary grounded questions must route to read-only conversation instead of parser status");
assert.match(handler, /if \(compiled\.intent === "workflow_status"/,
  "explicit workflow status must retain a deterministic status path");
assert.match(handler, /composeAuthoritativeAlgorithmAnswer/,
  "algorithm-result questions must be answered from authoritative computed state before model chat");
assert.match(handler, /composeReadOnlyWorkflowExplanation/,
  "read-only Custom Parser explanations must not depend on an active upload batch");
assert.match(handler, /composeHypotheticalHyperedgeDeletion/,
  "hypothetical hyperedge deletion questions should use bounded exact graph facts without staging a mutation");
assert.doesNotMatch(handler, /\n\s*append\("agent", composeParserWorkflowStatus\(latestStateRef\.current\), "status"\);\n\s*return \{ handled: true, outcome: "responded" \};\n\s*\}/,
  "generic grounded-question fallback must not be parser-workflow status");

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(appSource, /algorithmSummary: summarizeAlgorithmState\(algo\)/);
assert.match(appSource, /selectedMappingSummary:/);

console.log("v7.3.14 live read-only assistant context qualification passed.");
