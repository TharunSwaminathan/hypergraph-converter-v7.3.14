import assert from "node:assert/strict";
import { prepareDeterministicTurn } from "../src/agent/deterministicNlu/prepareDeterministicTurn.js";

let analysis = 0;
let compilation = 0;
prepareDeterministicTurn({
  query: "Make papers.csv the hyperedge table, use paper_id as its key.",
  analyze: () => {
    analysis += 1;
    return { rawText: "", primaryDomain: "dataset_mapping", primaryIntent: "domain_action", mode: "action", confidence: { level: "high", score: 0.9 }, ambiguities: [], unresolvedReferences: [], limits: { truncated: false } };
  },
  compile: () => {
    compilation += 1;
    return { ok: true, handled: true, domain: "dataset_mapping", typedKind: "DatasetMappingPatch", typedValue: { classification: "patch", operations: [] }, semanticConfidence: { level: "high", score: 0.98 }, diagnostics: { authoritativeCompiler: "dataset_mapping_v1" } };
  },
});

assert.equal(analysis, 1);
assert.equal(compilation, 1);

console.log("deterministic NLU single-compilation tests passed.");
