import assert from "node:assert/strict";
import {
  GRAPH_MUTATION_DRAFT_SCHEMA,
  GRAPH_MUTATION_DRAFT_SUPPORTED_OPS,
  GRAPH_MUTATION_OPERATION_SCHEMAS,
  emptyGraphMutationDraft,
} from "../src/agent/graphMutationDraftSchema.js";
import { validateGraphMutationDraft } from "../src/agent/graphMutationDraftValidator.js";

const vertex = surfaceText => ({ entityType: "vertex", referenceKind: "literal", surfaceText });
const hyperedge = surfaceText => ({ entityType: "hyperedge", referenceKind: "literal", surfaceText });
const operations = {
  ADD_HYPEREDGE: { type: "ADD_HYPEREDGE", newHyperedgeId: "h2", vertexReferences: [vertex("Alice")] },
  REMOVE_HYPEREDGE: { type: "REMOVE_HYPEREDGE", hyperedgeReference: hyperedge("h1") },
  ADD_INCIDENCE: { type: "ADD_INCIDENCE", vertexReference: vertex("Alice"), hyperedgeReference: hyperedge("h1") },
  REMOVE_INCIDENCE: { type: "REMOVE_INCIDENCE", vertexReference: vertex("Alice"), hyperedgeReference: hyperedge("h0"), emptyHyperedgePolicy: "keep_empty" },
  RENAME_HYPEREDGE: { type: "RENAME_HYPEREDGE", hyperedgeReference: hyperedge("h1"), newHyperedgeId: "h2" },
  RENAME_VERTEX: { type: "RENAME_VERTEX", vertexReference: vertex("Alice"), newVertexId: "Alicia" },
  REMOVE_VERTEX_GLOBAL: { type: "REMOVE_VERTEX_GLOBAL", vertexReference: vertex("Bob"), emptyHyperedgePolicy: "keep_empty" },
  SET_HYPEREDGE_WEIGHT: { type: "SET_HYPEREDGE_WEIGHT", hyperedgeReference: hyperedge("h0"), weight: 3.5 },
  SET_HYPEREDGE_TIME: { type: "SET_HYPEREDGE_TIME", hyperedgeReference: hyperedge("h0"), time: 2026 },
  SET_HYPEREDGE_ATTRIBUTE: { type: "SET_HYPEREDGE_ATTRIBUTE", hyperedgeReference: hyperedge("h0"), key: "color", value: "green" },
  REMOVE_HYPEREDGE_ATTRIBUTE: { type: "REMOVE_HYPEREDGE_ATTRIBUTE", hyperedgeReference: hyperedge("h0"), key: "color" },
  CLEAR_GRAPH: { type: "CLEAR_GRAPH" },
  UNDO_LAST_MUTATION: { type: "UNDO_LAST_MUTATION" },
};

assert.equal(GRAPH_MUTATION_OPERATION_SCHEMAS.length, 13);
assert.deepEqual(new Set(GRAPH_MUTATION_DRAFT_SUPPORTED_OPS), new Set(Object.keys(operations)));
assert.equal(GRAPH_MUTATION_DRAFT_SCHEMA.properties.operations.items.oneOf, GRAPH_MUTATION_OPERATION_SCHEMAS);

for (const [type, operation] of Object.entries(operations)) {
  const schema = GRAPH_MUTATION_OPERATION_SCHEMAS.find(candidate => candidate.properties.type.enum[0] === type);
  assert.ok(schema, `${type} must have one schema variant`);
  assert.deepEqual(new Set(schema.required), new Set(Object.keys(operation)), `${type} required fields must match validator fixture`);
  assert.deepEqual(new Set(Object.keys(schema.properties)), new Set(Object.keys(operation)), `${type} allowed fields must be unambiguous`);
  const draft = emptyGraphMutationDraft({
    classification: "mutation",
    intentSummary: type,
    operations: [operation],
    acknowledgement: "Prepared for confirmation.",
    confidence: "high",
  });
  assert.equal(validateGraphMutationDraft(draft).ok, true, `${type} exact variant must validate`);
  const withIrrelevantField = structuredClone(draft);
  withIrrelevantField.operations[0].irrelevant = null;
  assert.equal(validateGraphMutationDraft(withIrrelevantField).ok, false, `${type} irrelevant fields must fail closed`);
}

console.log("all 13 graph mutation schema variants close against the deterministic validator.");
