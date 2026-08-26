import assert from "node:assert/strict";
import { profileDatasetFiles } from "../src/agent/datasetProfiler.js";
import { profileDatasetRelationships } from "../src/agent/datasetRelationshipProfiler.js";

const datasetProfile = profileDatasetFiles([
  { name: "papers.csv", text: "paper_id,title\np1,One\np2,Two\n" },
  { name: "authorships.csv", text: "paper_id,author_id\np1,a1\np1,a2\np2,a1\n" },
  { name: "authors.csv", text: "author_id,name\na1,Ada\na2,Bob\n" },
]);
const evidence = profileDatasetRelationships(datasetProfile);
const paperJoin = evidence.find(item => item.leftColumns.includes("paper_id") || item.rightColumns.includes("paper_id"));
assert.ok(paperJoin, "paper_id relationship evidence should be found");
assert.ok(paperJoin.confidence > 0.5);
assert.equal(paperJoin.typeCompatibility, true);
assert.ok(["many_to_one", "one_to_many", "many_to_many", "one_to_one"].includes(paperJoin.likelyCardinality));

const compositeProfile = profileDatasetFiles([
  { name: "papers.csv", text: "year,paper_id,title\n2020,p1,One\n2021,p1,Two\n" },
  { name: "authorships.csv", text: "year,paper_id,author_id\n2020,p1,a1\n2021,p1,a2\n" },
]);
const compositeEvidence = profileDatasetRelationships(compositeProfile);
assert.ok(compositeEvidence.some(item => item.leftColumns?.join("+") === "year+paper_id" || item.rightColumns?.join("+") === "year+paper_id"));

console.log("dataset relationship profiler tests passed.");
