import { CANDY_ERROR_CODES, failCandy } from "./errorClasses.js";

export const GRAPH_TYPES = Object.freeze({
  ORDINARY: "OrdinaryGraph",
  DYNAMIC_ORDINARY: "DynamicOrdinaryGraph",
  HYPERGRAPH: "Hypergraph",
  DYNAMIC_HYPERGRAPH: "DynamicHypergraph",
  PROJECTED_ORDINARY: "ProjectedOrdinaryGraph",
});

const GRAPH_TYPE_SET = new Set(Object.values(GRAPH_TYPES));
const ORDINARY_TYPES = new Set([
  GRAPH_TYPES.ORDINARY,
  GRAPH_TYPES.DYNAMIC_ORDINARY,
  GRAPH_TYPES.PROJECTED_ORDINARY,
]);
const HYPERGRAPH_TYPES = new Set([
  GRAPH_TYPES.HYPERGRAPH,
  GRAPH_TYPES.DYNAMIC_HYPERGRAPH,
]);

export const SSSP_ACCEPTED_GRAPH_TYPES = Object.freeze([...ORDINARY_TYPES]);

export function isGraphType(value) {
  return GRAPH_TYPE_SET.has(value);
}

export function isOrdinaryGraphType(value) {
  return ORDINARY_TYPES.has(value);
}

export function isHypergraphType(value) {
  return HYPERGRAPH_TYPES.has(value);
}

export function validateAlgorithmGraphCompatibility(algorithm, graphType, mode = "STATIC") {
  if (!isGraphType(graphType)) {
    failCandy(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Unknown graph type.", { graphType });
  }
  if (algorithm !== "SSSP") {
    failCandy(CANDY_ERROR_CODES.ALGORITHM_FAILURE, "Algorithm is not implemented in CANDY Scope 1.", {
      algorithm,
    });
  }
  if (!ORDINARY_TYPES.has(graphType)) {
    failCandy(
      CANDY_ERROR_CODES.INVALID_GRAPH_TYPE,
      "SSSP accepts ordinary graphs; the active dataset is a hypergraph. An explicit, materialized projection is required before SSSP can run.",
      {
        algorithm,
        mode,
        actualGraphType: graphType,
        acceptedGraphTypes: SSSP_ACCEPTED_GRAPH_TYPES,
        implicitProjectionPerformed: false,
      },
    );
  }
  return Object.freeze({ algorithm, mode, graphType, compatible: true });
}
