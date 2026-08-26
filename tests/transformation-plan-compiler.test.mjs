import assert from "node:assert/strict";
import { parseDelimited } from "../src/utils/delimitedText.js";
import { profileDatasetFiles } from "../src/agent/datasetProfiler.js";
import { profileDatasetRelationships } from "../src/agent/datasetRelationshipProfiler.js";
import { buildDatasetGroupingDraft } from "../src/agent/datasetGrouping.js";
import { buildDatasetMappingSpecV2FromProfile } from "../src/agent/deterministicMappingV2.js";
import { buildTransformationPlanFromMapping } from "../src/agent/transformationPlan.js";
import { compileTransformationPlanToParser } from "../src/agent/transformationPlanCompiler.js";

const files = [
  { name: "papers.csv", text: "paper_id,title\np1,One\np2,Two\n" },
  { name: "authorships.csv", text: "paper_id,author_id\np1,a1\np1,a2\np2,a2\n" },
];
const datasetProfile = profileDatasetFiles(files);
const evidence = profileDatasetRelationships(datasetProfile);
let spec = buildDatasetMappingSpecV2FromProfile({ batchId: "batch", datasetProfile, relationshipEvidence: evidence, groupingDraft: buildDatasetGroupingDraft(datasetProfile, evidence) });
spec = { ...spec, policies: { ...spec.policies, emptyHyperedges: "keep" } };
const plan = buildTransformationPlanFromMapping(spec).plan;
const compiled = compileTransformationPlanToParser(plan);
assert.equal(compiled.ok, true, compiled.error);
const parseHypergraph = new Function(`${compiled.code}\nreturn parseHypergraph;`)();
const result = await parseHypergraph(files, {
  parseDelimited,
  parseCSV: text => parseDelimited(text, { delimiter: "," }).records,
  unique: values => [...new Set((values ?? []).map(String).filter(Boolean))],
  splitList: value => String(value).split(/[;|,]/).map(v => v.trim()).filter(Boolean),
});
assert.equal(result.canonicalHyperedges.length, 2);
assert.deepEqual(result.canonicalHyperedges.find(edge => edge.id === "p1").vertices.sort(), ["a1", "a2"]);
assert.equal(result.diagnostics.emittedIncidences, 3);
assert.equal(result.diagnostics.planFingerprint, plan.planFingerprint);

console.log("transformation plan compiler tests passed.");
