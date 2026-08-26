import assert from "node:assert/strict";
import { createParserProfileFromMapping, exportParserProfiles, importParserProfiles, matchParserProfiles } from "../src/agent/parserProfiles.js";

const activeBatch = {
  label: "Authorship",
  files: [{ name: "papers.csv", size: 20 }, { name: "authorships.csv", size: 30 }],
  datasetProfile: {
    files: [
      { fileName: "papers.csv", headerFingerprint: "abc", columns: [{ name: "paper_id" }, { name: "title" }] },
      { fileName: "authorships.csv", headerFingerprint: "def", columns: [{ name: "paper_id" }, { name: "author_id" }] },
    ],
  },
  relationshipEvidence: [{ leftColumns: ["paper_id"], rightColumns: ["paper_id"], likelyCardinality: "many_to_one" }],
};
const profile = createParserProfileFromMapping({ mappingSpec: { datasetType: "multi_file_hypergraph", files: [] }, parserCode: "async function parseHypergraph(){return []}", activeBatch });
assert.equal(profile.schemaVersion, 3);
assert.ok(profile.fileSignatures.some(sig => sig.headerFingerprint === "abc"));
const matches = matchParserProfiles([{ name: "renamed.csv", extension: ".csv", headers: ["paper_id", "author_id"] }], [profile]);
assert.ok(matches[0].score > 0);
assert.match(matches[0].reason, /structural header/);
const exported = exportParserProfiles([profile]);
assert.match(exported, /hypergraph-parser-profiles-v7\.3/);
const memoryStorage = new Map();
const storage = { getItem: key => memoryStorage.get(key), setItem: (key, value) => memoryStorage.set(key, value) };
const imported = importParserProfiles(exported, [], storage);
assert.equal(imported.length, 1);

console.log("parser profile v3 tests passed.");
