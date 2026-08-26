import assert from "node:assert/strict";
import { buildDeterministicActionPlan, resolveCanonicalIntent } from "../src/agent/orchestrationPlanner.js";
import { validateOllamaActionPlan } from "../src/agent/ollamaActionPlanValidator.js";

const state = {
  fmt: "simple",
  activeSection: "mappings",
  expId: "h2v_txt",
  vizLimit: 50,
  hasGraph: false,
  agentFileCount: 1,
  agentDetection: null,
  activeBatchId: "batch-heldout",
  activeBatch: { id: "batch-heldout", label: "Held-out batch", version: 1, parseMode: "together", fileNames: ["input.txt"] },
};

const sourceRouteMatrix = [
  ["H2V", "simple"],
  ["V2H", "v2h"],
  ["Incidence edge list", "incidence"],
  ["Edge List", "edgelist"],
  ["H2H", "h2h"],
  ["CSR JSON", "csr_json"],
  ["CSR/CSC CSV", "csr_csv"],
  ["JSON", "json"],
  ["Cornell SNAP", "cornell"],
  ["Adjacency list", "adjlist"],
  ["CSV", "csv"],
];

const targetExportMatrix = [
  ["H2V text", "h2v_txt"],
  ["V2H text", "v2h_txt"],
  ["H2H text", "h2h_txt"],
  ["Canonical JSON", "canonical"],
  ["Incidence CSV", "incidence"],
  ["Bipartite CSV", "bipartite"],
  ["Clique CSV", "clique"],
  ["Matrix CSV", "matrix"],
  ["CSR JSON", "csr_json"],
  ["CSR CSV", "csr_csv"],
  ["Full JSON", "full_json"],
  ["All mappings", "all_txt"],
];

const heldOutFamilies = [
  ["import_publish", (source, target) => `Import ${source} and publish ${target}.`],
  ["accept_yield", (source, target) => `Accept ${source} and yield ${target}.`],
  ["open_materialize", (source, target) => `Open the data as ${source} and materialize ${target}.`],
  ["read_from_render", (source, target) => `Read from ${source} and render as ${target}.`],
  ["inbound_outbound", (source, target) => `Inbound representation ${source}; outbound representation ${target}.`],
  ["origin_destination", (source, target) => `Origin format ${source}; destination format ${target}.`],
  ["initial_resulting", (source, target) => `Initial representation is ${source}; resulting representation is ${target}.`],
  ["interpret_produce", (source, target) => `Interpret the input as ${source} and produce ${target}.`],
  ["load_save_output", (source, target) => `Load ${source} and save the output as ${target}.`],
  ["map_representation_into", (source, target) => `Map the ${source} representation into ${target}.`],
];

let heldOutPassed = 0;
let heldOutTotal = 0;

for (const [sourceLabel, inputRoute] of sourceRouteMatrix) {
  for (const [targetLabel, exportId] of targetExportMatrix) {
    for (const [familyName, makeQuery] of heldOutFamilies) {
      const query = makeQuery(sourceLabel, targetLabel);
      const resolved = resolveCanonicalIntent(query, state);
      assert.equal(resolved.sourceFormat, inputRoute, `${familyName}: ${query}`);
      assert.equal(resolved.sourceExplicit, true, `${familyName}: ${query}`);
      assert.equal(resolved.targetExport, exportId, `${familyName}: ${query}`);
      assert.equal(resolved.targetExplicit, true, `${familyName}: ${query}`);
      assert.equal(resolved.ambiguity, null, `${familyName}: ${query}`);

      const plan = buildDeterministicActionPlan(query, state);
      assert.deepEqual(plan.actions.map(action => action.type), ["SELECT_INPUT_ROUTE", "PARSE_ACTIVE_BATCH", "SELECT_EXPORT_PREVIEW"], `${familyName}: ${query}`);
      assert.equal(plan.actions[0].inputRoute, inputRoute, `${familyName}: ${query}`);
      assert.equal(plan.actions[1].inputRoute, inputRoute, `${familyName}: ${query}`);
      assert.equal(plan.actions[2].exportId, exportId, `${familyName}: ${query}`);
      assert.equal(validateOllamaActionPlan(JSON.stringify(plan), { state, userQuery: query }).ok, true, `${familyName}: ${query}`);

      heldOutPassed += 1;
      heldOutTotal += 1;
    }
  }
}

const heldOutNegativeQueries = [
  "Compare H2V and CSR JSON.",
  "Is H2V better than CSR JSON?",
  "Explain the difference between H2V and V2H.",
  "H2V and CSR JSON are supported.",
  "Show H2V on the left and CSR JSON on the right.",
];
let heldOutNegativePassed = 0;
for (const query of heldOutNegativeQueries) {
  const resolved = resolveCanonicalIntent(query, { ...state, hasGraph: true });
  assert.equal(resolved.sourceFormat, null, query);
  assert.equal(resolved.targetExport, null, query);
  heldOutNegativePassed += 1;
}

assert.equal(heldOutPassed, 1320);
assert.equal(heldOutTotal, 1320);

console.log(`Held-out matrix: ${heldOutPassed}/${heldOutTotal}`);
console.log(`Combined minimum with held-out: ${7260 + heldOutPassed}/8580`);
console.log(`Held-out negative non-conversion cases: ${heldOutNegativePassed}/${heldOutNegativeQueries.length}`);
console.log("Held-out semantic relation tests passed.");
