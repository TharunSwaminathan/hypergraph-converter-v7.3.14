import assert from "node:assert/strict";
import { ensureDatasetMappingSpecV2, migrateDatasetMappingSpecV1ToV2 } from "../src/agent/datasetMappingMigration.js";

const v1 = {
  version: 1,
  datasetType: "single_file_hypergraph",
  parseMode: "together",
  confidence: 0.8,
  summary: "Incidence mapping",
  files: [{ fileName: "incidence.csv", role: "membership", useAsInput: true, primaryKey: null, columns: { hyperedgeId: "paper_id", vertexId: "author_id", attributes: [] } }],
  output: { format: "canonicalHyperedges", hyperedgeId: { sourceFile: "incidence.csv", column: "paper_id" }, attributes: [] },
  warnings: [],
  questionsForUser: [],
  assumptions: [],
};
const migrated = migrateDatasetMappingSpecV1ToV2(v1, { batchId: "batch", batchVersion: 2 });
assert.equal(migrated.ok, true);
assert.equal(migrated.spec.version, 2);
assert.equal(migrated.spec.batchId, "batch");
assert.ok(migrated.spec.relationships.some(rel => rel.type === "membership"));
assert.equal(ensureDatasetMappingSpecV2(migrated.spec).spec, migrated.spec);

console.log("dataset mapping migration tests passed.");
