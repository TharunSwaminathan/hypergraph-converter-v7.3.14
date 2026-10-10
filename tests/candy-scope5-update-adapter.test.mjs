import assert from "node:assert/strict";
import { GRAPH_TYPES } from "../src/candy/contracts/graphTypes.js";
import { CANDY_ERROR_CODES } from "../src/candy/contracts/errorClasses.js";
import { CANDY_SCHEMA_VERSIONS } from "../src/candy/contracts/schemaVersions.js";
import {
  HYPERGRAPH_UPDATE_COLLISION_POLICY,
  HYPERGRAPH_UPDATE_ORDERING,
  validateHypergraphMotifUpdate,
} from "../src/candy/contracts/hypergraphMotifSchemas.js";
import { deriveHypergraphMotifUpdate } from "../src/candy/adapters/graphMutationToHypergraphUpdate.js";
import { commitGraphState, createGraphState } from "../src/graph/graphState.js";

const edges = [
  edge("h1", ["a", "b"]),
  edge("h2", ["b", "c"]),
];
const hypergraph = createGraphState(edges);
const base = commitGraphState(hypergraph, hypergraph.hyperedges, { graphType: GRAPH_TYPES.DYNAMIC_HYPERGRAPH });
const nextVersion = base.graphVersion + 1;
const derive = (proposedHyperedges, updateId = "update-1") => deriveHypergraphMotifUpdate({
  baseGraphState: base,
  proposedHyperedges,
  updateId,
  nextGraphVersion: nextVersion,
});

// U01/U02: pure insertion and deletion.
const insertion = derive([...edges, edge("h3", ["d", "a"])]);
assert.deepEqual(insertion.motifUpdate.deletions, []);
assert.deepEqual(insertion.motifUpdate.insertions, [{ id: "h3", vertices: ["a", "d"] }]);
assert.equal(insertion.motifImpact, "CHANGED");

const deletion = derive([edges[1]]);
assert.deepEqual(deletion.motifUpdate.deletions, ["h1"]);
assert.deepEqual(deletion.motifUpdate.insertions, []);

// U03/U05: same-ID membership changes are exact delete/reinsert operations.
const sameId = derive([edge("h1", ["a", "z"]), edges[1]]);
assert.deepEqual(sameId.motifUpdate.deletions, ["h1"]);
assert.deepEqual(sameId.motifUpdate.insertions, [{ id: "h1", vertices: ["a", "z"] }]);
assert.equal(sameId.motifUpdate.ordering, HYPERGRAPH_UPDATE_ORDERING);
assert.equal(sameId.motifUpdate.collisionPolicy, HYPERGRAPH_UPDATE_COLLISION_POLICY);

// U04: replacement with a new ID is a canonical deletion plus insertion.
const replacement = derive([edges[1], edge("h9", ["a", "b"])]);
assert.deepEqual(replacement.motifUpdate.deletions, ["h1"]);
assert.deepEqual(replacement.motifUpdate.insertions, [{ id: "h9", vertices: ["a", "b"] }]);

// U06: result order is canonical and independent of proposed-array ordering.
const proposedA = [edge("z", ["q", "p"]), edge("a0", ["x"]), edge("h2", ["b", "changed"])];
const proposedB = [...proposedA].reverse();
const multiA = derive(proposedA, "canonical-update").motifUpdate;
const multiB = derive(proposedB, "canonical-update").motifUpdate;
assert.deepEqual(multiA, multiB);
assert.deepEqual(multiA.deletions, ["h1", "h2"]);
assert.deepEqual(multiA.insertions.map(item => item.id), ["z", "a0", "h2"]);

// U07: application metadata changes have no motif topology effect.
const metadataOnly = derive([{ ...edges[0], weight: 7, attributes: { label: "new" } }, edges[1]]);
assert.equal(metadataOnly.motifImpact, "NONE");
assert.deepEqual(metadataOnly.motifUpdate.deletions, []);
assert.deepEqual(metadataOnly.motifUpdate.insertions, []);

// U09/U10/U12: empty memberships and duplicate IDs fail, while new vertex references are valid.
assertCandyCode(() => derive([edges[0], edge("empty", [])]), CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA);
assertCandyCode(() => derive([edges[0], edges[0]]), CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA);
assert.doesNotThrow(() => derive([...edges, edge("new-vertex", ["previously-undeclared"])]));

// U13/U14: the existing closed transport contract rejects collisions and missing deletions.
const transport = {
  schemaVersion: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_UPDATE,
  updateId: "malformed",
  baseGraphRef: { graphId: base.graphId, graphVersion: base.graphVersion },
  nextGraphVersion: nextVersion,
  ordering: HYPERGRAPH_UPDATE_ORDERING,
  collisionPolicy: HYPERGRAPH_UPDATE_COLLISION_POLICY,
  deletions: [],
  insertions: [{ id: "h1", vertices: ["x"] }],
};
assertCandyCode(() => validateHypergraphMotifUpdate(transport, insertion.baseCanonical), CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
assertCandyCode(() => validateHypergraphMotifUpdate({ ...transport, deletions: ["missing"], insertions: [] }, insertion.baseCanonical), CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
assertCandyCode(() => validateHypergraphMotifUpdate({ ...transport, deletions: ["h1", "h1"], insertions: [] }, insertion.baseCanonical), CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);

// U15/U16: callers cannot select semantics or manipulate the next version.
assertCandyCode(() => deriveHypergraphMotifUpdate({
  baseGraphState: base,
  proposedHyperedges: edges,
  updateId: "bad-order",
  nextGraphVersion: nextVersion,
  ordering: "INSERT_THEN_DELETE",
}), CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);
assertCandyCode(() => deriveHypergraphMotifUpdate({
  baseGraphState: base,
  proposedHyperedges: edges,
  updateId: "bad-version",
  nextGraphVersion: nextVersion + 1,
}), CANDY_ERROR_CODES.INVALID_UPDATE_BATCH);

// Qualified graph/update bounds fail before transport authority is produced.
assertCandyCode(() => derive(Array.from({ length: 257 }, (_, index) => edge(`limit-${index}`, [`v-${index}`]))), CANDY_ERROR_CODES.RESOURCE_LIMIT);
const obviousOversize = Array.from({ length: 257 }, (_, index) => ({ id: `oversize-${index}` }));
Object.defineProperty(obviousOversize[0], "vertices", { get: () => { throw new Error("vertices should not be read"); } });
assertCandyCode(() => derive(obviousOversize), CANDY_ERROR_CODES.RESOURCE_LIMIT);

function edge(id, vertices, extras = {}) {
  return { id, vertices, time: null, weight: 1, attributes: {}, ...extras };
}

function assertCandyCode(fn, code) {
  assert.throws(fn, error => error?.code === code, `expected ${code}`);
}

console.log("CANDY Scope 5B update-adapter tests passed.");
