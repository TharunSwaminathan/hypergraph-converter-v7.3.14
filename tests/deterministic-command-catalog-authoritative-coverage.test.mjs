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
import { DASHBOARD_CANONICAL_INTENTS as SOURCE_DASHBOARD_CANONICAL_INTENTS } from "../src/agent/deterministicNlu/domains/dashboardActionGrammar.js";
import { PARSER_WORKFLOW_OPERATION_TYPES as SOURCE_PARSER_WORKFLOW_OPERATION_TYPES } from "../src/agent/deterministicNlu/domains/parserWorkflowGrammar.js";
import { DATASET_MAPPING_PATCH_OPS } from "../src/agent/datasetMappingPatchSchema.js";
import { PUBLIC_ACTION_INTENTS, SPEECH_ACT_ONLY_INTENTS } from "../src/agent/actionIntentRegistry.js";
import { GRAPH_MUTATION_OPS } from "../src/graph/graphMutationSchema.js";

assert.deepEqual(DASHBOARD_CANONICAL_INTENTS, SOURCE_DASHBOARD_CANONICAL_INTENTS);
assert.deepEqual(PARSER_WORKFLOW_OPERATION_TYPES, SOURCE_PARSER_WORKFLOW_OPERATION_TYPES);

const catalogOps = new Set(COMMAND_CATALOG.flatMap(entry => entry.operationTypes ?? []));
const requiredGroups = [
  Object.values(GRAPH_MUTATION_OPS),
  DATASET_MAPPING_PATCH_OPS,
  DETERMINISTIC_GRAPH_OPERATION_TYPES,
  PANEL_ONLY_GRAPH_OPERATION_TYPES,
  DETERMINISTIC_MAPPING_OPERATION_TYPES,
  PANEL_ONLY_MAPPING_OPERATION_TYPES,
  SOURCE_PARSER_WORKFLOW_OPERATION_TYPES,
  SOURCE_DASHBOARD_CANONICAL_INTENTS,
  HELP_QUERY_INTENTS,
  PUBLIC_ACTION_INTENTS,
  SPEECH_ACT_ONLY_INTENTS,
];

for (const group of requiredGroups) {
  for (const operation of group) {
    assert.ok(catalogOps.has(operation), `missing authoritative operation or intent ${operation}`);
  }
}

console.log("deterministic command catalog authoritative coverage tests passed.");
