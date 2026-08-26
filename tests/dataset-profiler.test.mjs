import assert from "node:assert/strict";
import { DATASET_PROFILE_LIMITS, profileDatasetFile, profileDatasetFiles } from "../src/agent/datasetProfiler.js";

const papers = {
  id: "papers",
  name: "papers.csv",
  text: "paper_id,title,year,authors\np1,One,2020,Ada;Bob\np2,Two,2021,Cy\n",
};
const profile = profileDatasetFile(papers);
assert.equal(profile.format, "delimited");
assert.equal(profile.rowCountExact, true);
assert.equal(profile.columns.find(column => column.name === "paper_id").uniquenessRatio, 1);
assert.equal(profile.columns.find(column => column.name === "year").inferredType, "integer");
assert.equal(profile.candidateKeys[0].columns[0], "paper_id");
assert.equal(profile.listLikeColumns[0].column, "authors");
assert.equal(profile.sampledRowCount, 2);
assert.ok(profile.headerFingerprint);

const large = profileDatasetFile({ name: "large.csv", text: `id,value\n${Array.from({ length: 40 }, (_, i) => `${i},${i}`).join("\n")}` }, { ...DATASET_PROFILE_LIMITS, maxSampleChars: 80, maxSampleRows: 5 });
assert.equal(large.partial, true);
assert.equal(large.rowCountExact, false);
assert.ok(large.sampledRowCount <= 5);

const batch = profileDatasetFiles([papers, { name: "notes.txt", text: "hello" }]);
assert.equal(batch.fileCount, 2);
assert.equal(batch.partial, false);

console.log("dataset profiler tests passed.");
