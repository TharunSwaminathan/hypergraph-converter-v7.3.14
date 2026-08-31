import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAlgorithmIncidenceIndex } from "../src/algorithms/algorithmIncidence.js";
import { runKCore } from "../src/algorithms/kCore.js";
import { runShortestPath } from "../src/algorithms/shortestPath.js";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(projectRoot, "artifacts", "v7.3.14-stage6-corrective-prechange.json");
const unsupported = [
  ["object", { x: 1 }],
  ["array", []],
  ["boolean_true", true],
  ["boolean_false", false],
  ["bigint", 1n],
  ["null", null],
  ["undefined", undefined],
  ["nan", Number.NaN],
  ["positive_infinity", Number.POSITIVE_INFINITY],
  ["negative_infinity", Number.NEGATIVE_INFINITY],
];
const baseGraph = [record("base", ["a", "b"])];

const graphMemberIds = Object.fromEntries(unsupported.map(([name, value]) => {
  const graph = [record("member-edge", ["anchor", value])];
  return [name, {
    input: describe(value),
    adapter: capture(() => summarizeIndex(buildAlgorithmIncidenceIndex(graph))),
    shortestPath: capture(() => summarizeShortest(runShortestPath(graph, { startVertex: "anchor" }))),
    kCore: capture(() => summarizeKCore(runKCore(graph))),
  }];
}));

const hyperedgeIds = Object.fromEntries(unsupported.map(([name, value]) => {
  const graph = [record(value, ["anchor", "peer"])];
  return [name, {
    input: describe(value),
    adapter: capture(() => summarizeIndex(buildAlgorithmIncidenceIndex(graph))),
    shortestPath: capture(() => summarizeShortest(runShortestPath(graph, { startVertex: "anchor", targetVertex: "peer" }))),
    kCore: capture(() => summarizeKCore(runKCore(graph))),
  }];
}));

const shortestQueryIds = {
  start_object: query({ startVertex: { x: 1 }, targetVertex: "b" }),
  start_boolean: query({ startVertex: true, targetVertex: "b" }),
  start_null: query({ startVertex: null, targetVertex: "b" }),
  start_nan: query({ startVertex: Number.NaN, targetVertex: "b" }),
  target_object: query({ startVertex: "a", targetVertex: { x: 1 } }),
  target_boolean: query({ startVertex: "a", targetVertex: true }),
  target_nan: query({ startVertex: "a", targetVertex: Number.NaN }),
  target_null_no_target: query({ startVertex: "a", targetVertex: null }),
  target_undefined_no_target: query({ startVertex: "a", targetVertex: undefined }),
};

const artifact = {
  stage: 6,
  kind: "canonical_identifier_boundary_prechange_characterization",
  parentCommit: "1b08b07920523aeebe25c3e4a602137bc699c7fa",
  productionState: "exact_stage6_parent_before_corrective_production_edits",
  issue: "S6-N01",
  graphMemberIds,
  hyperedgeIds,
  shortestQueryIds,
  findings: {
    objectVertexSilentlyCoerced: acceptedAs(graphMemberIds.object.adapter, "[object Object]"),
    booleanVertexSilentlyCoerced: acceptedAs(graphMemberIds.boolean_true.adapter, "true"),
    nullHyperedgeIdSynthesized: acceptedAs(hyperedgeIds.null.adapter, "h0"),
    objectHyperedgeIdSilentlyCoerced: acceptedAs(hyperedgeIds.object.adapter, "[object Object]"),
    invalidStartObjectSilentlyCoerced: shortestQueryIds.start_object.outcome === "returned"
      && shortestQueryIds.start_object.value.startVertex === "[object Object]",
    invalidTargetObjectSilentlyCoerced: shortestQueryIds.target_object.outcome === "returned"
      && shortestQueryIds.target_object.value.targetVertex === "[object Object]",
    unsupportedFamiliesNotUniformlyRejectedBeforeCoercion: true,
  },
};

await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Stage 6 corrective pre-change characterization written: ${outputPath}`);
console.log(JSON.stringify(artifact.findings, null, 2));

function record(id, vertices) {
  return { id, vertices, time: null, weight: 1, attributes: { source: "prechange" } };
}

function query(options) {
  return {
    input: Object.fromEntries(Object.entries(options).map(([key, value]) => [key, describe(value)])),
    ...capture(() => summarizeShortest(runShortestPath(baseGraph, options))),
  };
}

function capture(callback) {
  try {
    return { outcome: "returned", value: callback() };
  } catch (error) {
    return { outcome: "threw", error: { name: error?.name ?? "Error", message: error?.message ?? String(error) } };
  }
}

function summarizeIndex(index) {
  return {
    hyperedges: [...index.hyperedges],
    vertices: [...index.vertices],
    incidences: index.counts.incidences,
  };
}

function summarizeShortest(result) {
  return {
    startVertex: result.startVertex,
    targetVertex: result.targetVertex,
    reachable: result.reachable,
    distances: [...result.distances],
    path: result.path,
  };
}

function summarizeKCore(result) {
  return {
    status: result.status,
    degeneracy: result.degeneracy,
    coreness: result.coreness ? [...result.coreness] : null,
  };
}

function describe(value) {
  if (value === null) return { type: "null", representation: "null" };
  if (value === undefined) return { type: "undefined", representation: "undefined" };
  if (typeof value === "number" && Number.isNaN(value)) return { type: "number", representation: "NaN" };
  if (value === Number.POSITIVE_INFINITY) return { type: "number", representation: "Infinity" };
  if (value === Number.NEGATIVE_INFINITY) return { type: "number", representation: "-Infinity" };
  if (typeof value === "bigint") return { type: "bigint", representation: `${value}n` };
  return { type: Array.isArray(value) ? "array" : typeof value, representation: JSON.stringify(value) };
}

function acceptedAs(observation, identifier) {
  return observation.outcome === "returned"
    && (observation.value.hyperedges.includes(identifier) || observation.value.vertices.includes(identifier));
}
