import {
  EXPORT_IDS,
  GRAPH_LAYOUT_IDS,
  GRAPH_VIEW_IDS,
  INPUT_ROUTE_IDS,
  ORCHESTRATOR_ACTION_TYPES,
  ORCHESTRATOR_INTENTS,
  PARSE_MODE_IDS,
  SECTION_IDS,
} from "./capabilityRegistry.js";

const STRING_OR_NULL = { anyOf: [{ type: "string" }, { type: "null" }] };
const ROUTE_OR_NULL = { anyOf: [{ type: "string", enum: INPUT_ROUTE_IDS }, { type: "null" }] };
const SECTION_OR_NULL = { anyOf: [{ type: "string", enum: SECTION_IDS }, { type: "null" }] };
const EXPORT_OR_NULL = { anyOf: [{ type: "string", enum: EXPORT_IDS }, { type: "null" }] };
const GRAPH_VIEW_OR_NULL = { anyOf: [{ type: "string", enum: GRAPH_VIEW_IDS }, { type: "null" }] };
const GRAPH_LAYOUT_OR_NULL = { anyOf: [{ type: "string", enum: GRAPH_LAYOUT_IDS }, { type: "null" }] };
const PARSE_MODE_OR_NULL = { anyOf: [{ type: "string", enum: PARSE_MODE_IDS }, { type: "null" }] };

export const ACTION_PLAN_SCHEMA_VERSION = "1.0";

const COMMON_ACTION_PROPERTIES = {
  type: { type: "string", enum: ORCHESTRATOR_ACTION_TYPES },
  requiresConfirmation: { type: "boolean" },
  reason: { type: "string" },
  message: STRING_OR_NULL,
  userIntent: STRING_OR_NULL,
};

function actionSchema(type, required = [], properties = {}) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["type", "requiresConfirmation", "reason", ...required],
    properties: {
      ...COMMON_ACTION_PROPERTIES,
      type: { type: "string", enum: [type] },
      ...properties,
    },
  };
}

const ACTION_SCHEMAS = [
  actionSchema("EXPLAIN_FORMAT", ["inputRoute"], {
    inputRoute: { type: "string", enum: INPUT_ROUTE_IDS },
  }),
  actionSchema("AUTO_DETECT_ACTIVE_BATCH", [], {
    exportId: EXPORT_OR_NULL,
  }),
  actionSchema("SELECT_INPUT_ROUTE", ["inputRoute"], {
    inputRoute: { type: "string", enum: INPUT_ROUTE_IDS },
  }),
  actionSchema("PARSE_ACTIVE_BATCH", ["inputRoute"], {
    inputRoute: { type: "string", enum: INPUT_ROUTE_IDS },
    exportId: EXPORT_OR_NULL,
  }),
  actionSchema("SHOW_RESULT_SUMMARY"),
  actionSchema("OPEN_SECTION", ["sectionId"], {
    sectionId: { type: "string", enum: SECTION_IDS },
  }),
  actionSchema("SELECT_EXPORT_PREVIEW", ["exportId"], {
    exportId: { type: "string", enum: EXPORT_IDS },
  }),
  actionSchema("DOWNLOAD_EXPORT", ["exportId"], {
    exportId: { type: "string", enum: EXPORT_IDS },
  }),
  actionSchema("OPEN_GRAPH_PREVIEW"),
  actionSchema("SET_GRAPH_VIEW", ["viewMode"], {
    viewMode: { type: "string", enum: GRAPH_VIEW_IDS },
  }),
  actionSchema("SET_GRAPH_LAYOUT", ["layout"], {
    layout: { type: "string", enum: GRAPH_LAYOUT_IDS },
  }),
  actionSchema("SET_VIZ_LIMIT", ["limit"], {
    limit: { type: "integer", minimum: 1, maximum: 10000 },
  }),
  actionSchema("SEARCH_GRAPH_VERTEX", ["query"], {
    query: { type: "string" },
    vertexId: STRING_OR_NULL,
  }),
  actionSchema("RESET_GRAPH_VIEW"),
  actionSchema("REHEAT_GRAPH"),
  actionSchema("EXPORT_GRAPH_PNG"),
  actionSchema("OPEN_CUSTOM_PARSER", [], {
    exportId: EXPORT_OR_NULL,
  }),
  actionSchema("REQUEST_PARSE_MODE", [], {
    mode: PARSE_MODE_OR_NULL,
    question: STRING_OR_NULL,
  }),
  actionSchema("GENERATE_MAPPING_SPEC"),
  actionSchema("VALIDATE_MAPPING_SPEC"),
  actionSchema("REPAIR_MAPPING_SPEC"),
  actionSchema("GENERATE_PARSER_FROM_MAPPING"),
  actionSchema("RUN_CUSTOM_PARSER"),
  actionSchema("APPLY_CUSTOM_RESULT"),
  actionSchema("CLEAR_GRAPH"),
  actionSchema("GENERATE_EXTERNAL_LLM_PROMPT", ["exportId"], {
    exportId: { type: "string", enum: EXPORT_IDS },
  }),
  actionSchema("SHOW_PLACEHOLDER", ["placeholder"], {
    placeholder: { type: "string", enum: ["batch", "freeform", "route", "future"] },
  }),
  actionSchema("ASK_CLARIFICATION", ["question"], {
    question: { type: "string" },
    clarifyingQuestion: STRING_OR_NULL,
  }),
  actionSchema("NO_OP"),
];

export const ACTION_PLAN_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "task",
    "intent",
    "target",
    "actions",
    "needsClarification",
    "clarifyingQuestion",
    "reason",
    "userMessage",
  ],
  properties: {
    schemaVersion: { type: "string", enum: [ACTION_PLAN_SCHEMA_VERSION] },
    task: { type: "string", enum: ["route_user_query"] },
    intent: { type: "string", enum: ORCHESTRATOR_INTENTS },
    inputRoute: ROUTE_OR_NULL,
    target: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "routeExplicit", "exportId", "sectionId", "graphView", "graphLayout"],
      properties: {
        kind: {
          type: "string",
          enum: [
            "input_route",
            "export_preview",
            "dashboard_section",
            "graph_preview",
            "custom_parser",
            "mapping_workflow",
            "runtime_diagnostics",
            "placeholder",
            "none",
          ],
        },
        routeExplicit: { type: "boolean" },
        exportId: EXPORT_OR_NULL,
        sectionId: SECTION_OR_NULL,
        graphView: GRAPH_VIEW_OR_NULL,
        graphLayout: GRAPH_LAYOUT_OR_NULL,
      },
    },
    actions: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: { anyOf: ACTION_SCHEMAS },
    },
    needsClarification: { type: "boolean" },
    clarifyingQuestion: STRING_OR_NULL,
    reason: { type: "string" },
    userMessage: { type: "string" },
  },
};

export const ACTION_PLAN_RESPONSE_CONTRACT = `Return exactly one JSON object matching this ActionPlan shape:
{
  "schemaVersion": "${ACTION_PLAN_SCHEMA_VERSION}",
  "task": "route_user_query",
  "intent": "one allowed intent",
  "inputRoute": "simple|cornell|incidence|csv|edgelist|json|v2h|h2h|csr_json|csr_csv|adjlist|freeform|ai_prompt|custom|batch|null",
  "target": {
    "kind": "input_route|export_preview|dashboard_section|graph_preview|custom_parser|mapping_workflow|runtime_diagnostics|placeholder|none",
    "routeExplicit": true,
    "exportId": null,
    "sectionId": null,
    "graphView": null,
    "graphLayout": null
  },
  "actions": [
    { "type": "SELECT_INPUT_ROUTE", "requiresConfirmation": false, "inputRoute": "csr_json", "reason": "User explicitly asked to use CSR." }
  ],
  "needsClarification": false,
  "clarifyingQuestion": null,
  "reason": "Brief planner rationale grounded in the provided app state.",
  "userMessage": "Short response to show after deterministic verification."
}

Action fields are action-specific and required:
- EXPLAIN_FORMAT needs inputRoute.
- SELECT_INPUT_ROUTE and PARSE_ACTIVE_BATCH need inputRoute.
- SELECT_EXPORT_PREVIEW, DOWNLOAD_EXPORT, and GENERATE_EXTERNAL_LLM_PROMPT need exportId.
- OPEN_SECTION needs sectionId.
- SET_GRAPH_VIEW needs viewMode; SET_GRAPH_LAYOUT needs layout; SET_VIZ_LIMIT needs limit; SEARCH_GRAPH_VERTEX needs query.
- ASK_CLARIFICATION needs question.
- CLEAR_GRAPH, RUN_CUSTOM_PARSER, APPLY_CUSTOM_RESULT, DOWNLOAD_EXPORT, EXPORT_GRAPH_PNG, and replacing a loaded graph require requiresConfirmation=true.
- The top-level reason is for debugging. Put the user-facing answer in userMessage or action.message; never expose chain-of-thought.`;
