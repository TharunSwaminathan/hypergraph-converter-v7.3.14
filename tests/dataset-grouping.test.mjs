import assert from "node:assert/strict";
import { profileDatasetFiles } from "../src/agent/datasetProfiler.js";
import { profileDatasetRelationships } from "../src/agent/datasetRelationshipProfiler.js";
import { buildDatasetGroupingDraft, roleGuessesForProfile } from "../src/agent/datasetGrouping.js";

const authorship = profileDatasetFiles([
  { name: "authors.csv", text: "author_id,name\na1,Ada\n" },
  { name: "papers.csv", text: "paper_id,title\np1,One\n" },
  { name: "authorships.csv", text: "paper_id,author_id\np1,a1\n" },
  { name: "expected.json", text: "{\"hyperedges\":[]}" },
  { name: "updates.csv", text: "op,payload\nADD,x\n" },
]);
const roles = roleGuessesForProfile(authorship);
assert.equal(roles["authorships.csv"], "membership");
assert.equal(roles["expected.json"], "validation_expected_output");
assert.equal(roles["updates.csv"], "update_stream");

const grouping = buildDatasetGroupingDraft(authorship, profileDatasetRelationships(authorship));
assert.equal(grouping.parseMode, "grouped");
assert.ok(grouping.groups.some(group => group.kind === "static_graph" && group.fileNames.includes("authorships.csv")));
assert.ok(grouping.groups.some(group => group.kind === "validation_only"));
assert.ok(grouping.groups.some(group => group.kind === "update_stream"));

const events = profileDatasetFiles([
  { name: "events.csv", text: "event_id,event_name,year\nE1,Storm,2024\n" },
  { name: "participants.csv", text: "event_id,participant_id,role\nE1,P1,responder\n" },
]);
assert.equal(roleGuessesForProfile(events)["participants.csv"], "membership");

console.log("dataset grouping tests passed.");
