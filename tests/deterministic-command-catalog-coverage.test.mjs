import assert from "node:assert/strict";
import {
  COMMAND_CATALOG,
  DASHBOARD_CANONICAL_INTENTS,
  DETERMINISTIC_GRAPH_OPERATION_TYPES,
  DETERMINISTIC_MAPPING_OPERATION_TYPES,
  PANEL_ONLY_GRAPH_OPERATION_TYPES,
  PANEL_ONLY_MAPPING_OPERATION_TYPES,
  PARSER_WORKFLOW_OPERATION_TYPES,
} from "../src/agent/deterministicNlu/commandCatalog.js";
import { HELP_QUERY_INTENTS } from "../src/agent/deterministicNlu/commandCatalogSchema.js";
import { PARSER_WORKFLOW_OPERATION_TYPES as SOURCE_PARSER_WORKFLOW_OPERATION_TYPES } from "../src/agent/deterministicNlu/domains/parserWorkflowGrammar.js";
import { DASHBOARD_CANONICAL_INTENTS as SOURCE_DASHBOARD_CANONICAL_INTENTS } from "../src/agent/deterministicNlu/domains/dashboardActionGrammar.js";
import { GRAPH_MUTATION_OPS } from "../src/graph/graphMutationSchema.js";
import { DATASET_MAPPING_PATCH_OPS } from "../src/agent/datasetMappingPatchSchema.js";
import { INTERNAL_ACTION_INTENTS, PUBLIC_ACTION_INTENTS, SPEECH_ACT_ONLY_INTENTS } from "../src/agent/actionIntentRegistry.js";

assert.deepEqual(PARSER_WORKFLOW_OPERATION_TYPES, SOURCE_PARSER_WORKFLOW_OPERATION_TYPES, "parser workflow coverage must come from parser grammar source");
assert.deepEqual(DASHBOARD_CANONICAL_INTENTS, SOURCE_DASHBOARD_CANONICAL_INTENTS, "dashboard coverage must come from dashboard grammar source");

const catalogOps = new Set(COMMAND_CATALOG.flatMap(entry => entry.operationTypes ?? []));
const supportedOps = new Set([
  ...Object.values(GRAPH_MUTATION_OPS),
  ...DATASET_MAPPING_PATCH_OPS,
  ...SOURCE_PARSER_WORKFLOW_OPERATION_TYPES,
  ...SOURCE_DASHBOARD_CANONICAL_INTENTS,
  ...HELP_QUERY_INTENTS,
  ...PUBLIC_ACTION_INTENTS,
  ...SPEECH_ACT_ONLY_INTENTS,
]);

for (const op of DETERMINISTIC_GRAPH_OPERATION_TYPES) {
  assert.ok(catalogOps.has(op), `missing deterministic graph operation ${op}`);
}
for (const op of PANEL_ONLY_GRAPH_OPERATION_TYPES) {
  assert.ok(catalogOps.has(op), `missing panel-only graph operation ${op}`);
}
for (const op of DETERMINISTIC_MAPPING_OPERATION_TYPES) {
  assert.ok(catalogOps.has(op), `missing deterministic mapping operation ${op}`);
}
for (const op of PANEL_ONLY_MAPPING_OPERATION_TYPES) {
  assert.ok(catalogOps.has(op), `missing panel-only mapping operation ${op}`);
}
for (const op of PARSER_WORKFLOW_OPERATION_TYPES) {
  assert.ok(catalogOps.has(op), `missing parser workflow operation ${op}`);
}
for (const intent of DASHBOARD_CANONICAL_INTENTS) {
  assert.ok(catalogOps.has(intent), `missing dashboard intent ${intent}`);
}
for (const intent of HELP_QUERY_INTENTS) {
  assert.ok(catalogOps.has(intent), `missing help-query intent ${intent}`);
}
for (const intent of PUBLIC_ACTION_INTENTS) {
  assert.ok(catalogOps.has(intent), `missing public legacy action intent ${intent}`);
}
for (const intent of INTERNAL_ACTION_INTENTS) {
  assert.ok(!catalogOps.has(intent), `internal-only legacy action intent should not be cataloged as an executable command: ${intent}`);
}
for (const intent of SPEECH_ACT_ONLY_INTENTS) {
  assert.ok(catalogOps.has(intent), `speech-act-only concept should be documented but not direct-action matched: ${intent}`);
}
for (const op of catalogOps) {
  assert.ok(supportedOps.has(op), `catalog advertises unknown operation/intent ${op}`);
}

console.log("deterministic command catalog coverage tests passed.");
