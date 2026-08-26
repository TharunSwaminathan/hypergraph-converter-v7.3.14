import assert from "node:assert/strict";
import { interpretCustomParserConversation } from "../src/agent/customParserConversation.js";
import {
  createParserProfileFromMapping,
  exportParserProfiles,
  importParserProfiles,
  matchParserProfiles,
  saveParserProfiles,
} from "../src/agent/parserProfiles.js";

const batch = {
  label: "papers batch",
  files: [
    { name: "papers.csv", extension: ".csv", size: 120 },
    { name: "expected.json", extension: ".json", size: 40 },
  ],
};
const spec = {
  version: 1,
  datasetType: "multi_file_hypergraph",
  parseMode: "together",
  confidence: 0.8,
  summary: "Draft mapping.",
  files: [
    { fileName: "papers.csv", role: "membership", useAsInput: true, columns: { hyperedgeId: "id", vertexId: "member", attributes: ["year", "weight"] } },
    { fileName: "expected.json", role: "unknown", useAsInput: false, columns: { attributes: [] } },
  ],
  output: { format: "canonicalHyperedges", attributes: [] },
  warnings: [],
  questionsForUser: [],
  assumptions: [],
};

const refined = interpretCustomParserConversation("authors are vertices, papers are hyperedges, year is time metadata", spec, batch);
assert.equal(refined.ok, false);
assert.equal(refined.needsClarification, true);
assert.equal(refined.diagnostics.authoritativeCompiler, "dataset_mapping_v1");
assert.equal(refined.diagnostics.legacyParserCalled, false);
assert.equal(refined.diagnostics.migrationStatus, "migrated_requires_typed_patch");
assert.equal(refined.migratedSpec.version, 2);

const expected = interpretCustomParserConversation("expected output is validation", spec, batch);
assert.equal(expected.ok, false);
assert.equal(expected.needsClarification, true);
assert.equal(expected.diagnostics.legacyParserCalled, false);
assert.equal(expected.migratedSpec.version, 2);

const memoryStorage = new Map();
const storage = {
  getItem: key => memoryStorage.get(key) ?? null,
  setItem: (key, value) => memoryStorage.set(key, value),
};
const profile = createParserProfileFromMapping({
  name: "paper authors",
  mappingSpec: refined.migratedSpec,
  parserCode: "async function parseHypergraph(){ return []; }",
  activeBatch: batch,
});
const saved = saveParserProfiles([profile], storage);
assert.equal(saved.length, 1);
assert.equal(matchParserProfiles(batch.files, saved)[0].profile.id, profile.id);

const exported = exportParserProfiles(saved);
const imported = importParserProfiles(exported, [], storage);
assert.equal(imported.length, 1);
assert.equal(imported[0].name, "paper authors");

console.log("custom parser conversation tests passed.");
