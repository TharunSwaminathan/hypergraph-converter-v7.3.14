import {
  GRAPH_TYPES,
  SSSP_ACCEPTED_GRAPH_TYPES,
  isHypergraphType,
  isOrdinaryGraphType,
} from "./contracts/graphTypes.js";

const CANDY_TOPIC = /\b(candy|sssp|single[- ]source shortest paths?|shortest paths? from)\b/i;
const EXECUTION_VERB = /\b(run|compute|start|submit|execute|find|calculate)\b/i;
const READ_ONLY = /\b(explain|describe|whether|what (?:is|would)|how (?:does|would)|without (?:running|executing)|do not run|don't run|no job|documentation|conceptual|hypothetical(?:ly)?|suppose|pretend|quoted?)\b/i;

function graphTypeFromState(state) {
  return state.candy?.graphType ?? state.graph?.graphType ?? (state.hasGraph ? GRAPH_TYPES.HYPERGRAPH : null);
}

function readOnlyExplanation(graphType) {
  const accepted = SSSP_ACCEPTED_GRAPH_TYPES.join(", ");
  const noAction = "This was a read-only explanation; no artifact, job, process, confirmation, or graph change was created.";
  if (isHypergraphType(graphType)) {
    return `CANDY SSSP means single-source shortest paths and requires an ordinary graph (${accepted}). The active dataset is ${graphType}, which is a hypergraph. No implicit projection will be performed. ${noAction}`;
  }
  if (isOrdinaryGraphType(graphType)) {
    const projectedCondition = graphType === GRAPH_TYPES.PROJECTED_ORDINARY
      ? " A projected ordinary graph is accepted only with validated, materialized projection provenance."
      : "";
    return `CANDY SSSP means single-source shortest paths. The active dataset is ${graphType}, an accepted ordinary-graph type for the qualified LOCAL_OPENMP backend. It computes distances and parents from one source over directed edges with one non-negative integer weight objective.${projectedCondition} ${noAction}`;
  }
  return `CANDY SSSP means single-source shortest paths and accepts ${accepted}. There is no authoritative active graph type to check, so execution compatibility is not established. ${noAction}`;
}

export function routeDeterministicCandyRequest(query, state = {}) {
  const value = String(query ?? "").trim();
  if (!CANDY_TOPIC.test(value)) return null;
  const graphType = graphTypeFromState(state);
  if (READ_ONLY.test(value) || !EXECUTION_VERB.test(value)) {
    return Object.freeze({
      kind: "explain",
      message: readOnlyExplanation(graphType),
    });
  }
  if (!state.hasGraph) return Object.freeze({ kind: "blocked", classification: "INVALID_GRAPH_SCHEMA", message: "No authoritative graph is loaded. No CANDY job was created." });
  if (isHypergraphType(graphType)) {
    return Object.freeze({ kind: "blocked", classification: "INVALID_GRAPH_TYPE", message: `CANDY SSSP accepts ordinary graphs. The active dataset is ${graphType}, a hypergraph. No implicit projection was performed, and zero artifacts, native jobs, or processes were created.` });
  }
  if (!isOrdinaryGraphType(graphType)) return Object.freeze({ kind: "blocked", classification: "INVALID_GRAPH_SCHEMA", message: "The active graph type is unknown or unsupported. No CANDY job was created." });
  if (!state.candy?.featureEnabled || state.candy?.capabilityStatus !== "ready") return Object.freeze({ kind: "blocked", classification: "BACKEND_UNAVAILABLE", message: "The qualified local CANDY SSSP capability is unavailable. Browser-only mode remains active; no job was created." });
  return Object.freeze({ kind: "delegate" });
}
