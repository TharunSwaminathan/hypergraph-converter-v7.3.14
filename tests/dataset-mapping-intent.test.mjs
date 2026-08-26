import assert from "node:assert/strict";
import {
  classifyDatasetMappingIntent,
  isDatasetMappingExplanationQuestion,
  isPlausibleDatasetMappingText,
} from "../src/agent/datasetMappingIntent.js";

const context = {
  hasActiveBatch: true,
  route: "custom",
  parseMode: "together",
  fileNames: ["authors.csv", "papers.csv", "authorships.csv"],
  profiledColumnsByFile: {
    "authors.csv": ["author_id", "name", "institution"],
    "papers.csv": ["paper_id", "title", "year", "venue"],
    "authorships.csv": ["paper_id", "author_id", "position"],
  },
  hasMappingSpec: false,
  mappingRevision: 0,
};

const explicit = classifyDatasetMappingIntent("Set authors.csv as the vertex table using author_id.", context);
assert.equal(explicit.kind, "explicit_patch");
assert.equal(explicit.confidence, "high");
assert.ok(isPlausibleDatasetMappingText("Join authorships.paper_id to papers.paper_id.", context));

const interpretation = classifyDatasetMappingIntent("Authors are vertices, papers are hyperedges, and authorships connects them.", context);
assert.equal(interpretation.kind, "interpretation");

const question = classifyDatasetMappingIntent("Why is paper_id considered a key?", context);
assert.equal(question.kind, "mapping_question");
assert.equal(isDatasetMappingExplanationQuestion("What does preserving empty hyperedges mean?", context), true);

for (const text of [
  "What is a hyperedge?",
  "Show graph stats.",
  "Export as H2V.",
  "Add vertex 4 to h0.",
  "Run the parser.",
  "Generate the transformation plan.",
  "Apply the parser result.",
]) {
  assert.equal(classifyDatasetMappingIntent(text, context).kind, "not_mapping", text);
}

console.log("dataset mapping intent tests passed.");
