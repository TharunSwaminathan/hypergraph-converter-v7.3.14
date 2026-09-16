import { CANDY_SCHEMA_VERSIONS } from "../../src/candy/contracts/schemaVersions.js";
import { GRAPH_TYPES } from "../../src/candy/contracts/graphTypes.js";
import {
  HYPERGRAPH_3EDGE_MOTIF_TAXONOMY,
  MOTIF_REGION_NAMES,
} from "../../src/candy/hypergraphMotifs/taxonomy.js";

const MEMBERS_BY_REGION = Object.freeze([
  Object.freeze([0]),
  Object.freeze([1]),
  Object.freeze([2]),
  Object.freeze([0, 1]),
  Object.freeze([1, 2]),
  Object.freeze([0, 2]),
  Object.freeze([0, 1, 2]),
]);

export function hypergraphValue({
  graphId = "scope4-fixture",
  graphVersion = 1,
  graphType = GRAPH_TYPES.HYPERGRAPH,
  vertices,
  hyperedges,
}) {
  return {
    schemaVersion: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_INCIDENCE,
    graphId,
    graphVersion,
    graphType,
    vertices,
    hyperedges,
  };
}

export function witnessForTaxonomyEntry(entry) {
  const memberships = [[], [], []];
  const vertices = [];
  entry.canonicalSignature.forEach((present, regionIndex) => {
    if (!present) return;
    const vertexId = `v-${MOTIF_REGION_NAMES[regionIndex].toLowerCase()}`;
    vertices.push(vertexId);
    for (const hyperedgeIndex of MEMBERS_BY_REGION[regionIndex]) memberships[hyperedgeIndex].push(vertexId);
  });
  return hypergraphValue({
    graphId: `motif-${entry.motifId}`,
    vertices,
    hyperedges: [
      { id: "A", vertices: memberships[0] },
      { id: "B", vertices: memberships[1] },
      { id: "C", vertices: memberships[2] },
    ],
  });
}

export const ALL_30_MOTIF_WITNESSES = Object.freeze(
  HYPERGRAPH_3EDGE_MOTIF_TAXONOMY.entries.map(entry => Object.freeze({
    motifId: entry.motifId,
    shape: entry.shape,
    graph: witnessForTaxonomyEntry(entry),
  })),
);

export const DISCONNECTED_TRIPLE = hypergraphValue({
  graphId: "disconnected-triple",
  vertices: ["x", "isolated-c"],
  hyperedges: [
    { id: "A", vertices: ["x"] },
    { id: "B", vertices: ["x"] },
    { id: "C", vertices: ["isolated-c"] },
  ],
});

// H2H triangles (h1,h2,h3) and (h1,h4,h5) share minimum-ID h1.
// Deleting h2 destroys only the first triangle. The reference anchor strategy
// would flag h1 and incorrectly subtract both; exact old/new recomputation does not.
export const ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE = hypergraphValue({
  graphId: "anchor-counterexample",
  graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH,
  vertices: ["a", "b", "c", "d", "u", "v"],
  hyperedges: [
    { id: "h1", vertices: ["a", "b", "c", "d"] },
    { id: "h2", vertices: ["a", "u"] },
    { id: "h3", vertices: ["b", "u"] },
    { id: "h4", vertices: ["c", "v"] },
    { id: "h5", vertices: ["d", "v"] },
  ],
});

export const ANCHOR_COUNTEREXAMPLE_DELETE = Object.freeze({
  schemaVersion: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_UPDATE,
  updateId: "delete-h2",
  baseGraphRef: { graphId: "anchor-counterexample", graphVersion: 1 },
  nextGraphVersion: 2,
  ordering: "DELETE_THEN_INSERT",
  collisionPolicy: "REJECT_EXCEPT_EXACT_DELETE_REINSERT",
  deletions: ["h2"],
  insertions: [],
});
