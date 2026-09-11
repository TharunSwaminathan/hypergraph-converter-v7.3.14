import {
  EXPORT_ID_SET,
  GRAPH_LAYOUT_SET,
  GRAPH_VIEW_SET,
  INPUT_ROUTE_SET,
  SECTION_ID_SET,
  isSafeVisualLimit,
} from "./capabilityRegistry.js";
import { isOrdinaryGraphType } from "../candy/contracts/graphTypes.js";

export const START_CUSTOM_PARSER_WORKFLOW = "START_CUSTOM_PARSER_WORKFLOW";

const noArguments = () => [];
const requiredEnum = (argumentsValue, key, values) => values.has(argumentsValue[key]) ? [] : [`arguments.${key} is missing or unsupported.`];
const optionalExport = argumentsValue => argumentsValue.exportId == null || EXPORT_ID_SET.has(argumentsValue.exportId)
  ? []
  : ["arguments.exportId is unsupported."];
const validJobId = value => typeof value.jobId === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.jobId)
  ? [] : ["arguments.jobId must be a runtime-issued UUID."];
const validCandySubmission = value => {
  const errors = [];
  if (value.algorithm !== "SSSP") errors.push("arguments.algorithm must be SSSP.");
  if (value.backend !== "LOCAL_OPENMP") errors.push("arguments.backend must be LOCAL_OPENMP.");
  if (!["STATIC", "INCREMENTAL", "COMPARE"].includes(value.mode)) errors.push("arguments.mode is unsupported.");
  if (!((typeof value.sourceVertexId === "string" && value.sourceVertexId.length > 0 && value.sourceVertexId.length <= 240) || (typeof value.sourceVertexId === "number" && Number.isSafeInteger(value.sourceVertexId)))) errors.push("arguments.sourceVertexId must be a bounded canonical vertex ID.");
  if (!Number.isInteger(value.threads) || value.threads < 1 || value.threads > 256) errors.push("arguments.threads must be an integer from 1 through 256.");
  if (!Number.isInteger(value.timeoutMs) || value.timeoutMs < 1 || value.timeoutMs > 86_400_000) errors.push("arguments.timeoutMs is outside the qualified bound.");
  return errors;
};

export const REACT_CAPABILITY_DEFINITIONS = Object.freeze({
  [START_CUSTOM_PARSER_WORKFLOW]: { keys: [], validate: noArguments, stopAfterResult: true },
  AUTO_DETECT_ACTIVE_BATCH: { keys: ["exportId"], validate: optionalExport },
  SELECT_INPUT_ROUTE: { keys: ["inputRoute"], validate: value => requiredEnum(value, "inputRoute", INPUT_ROUTE_SET) },
  PARSE_ACTIVE_BATCH: {
    keys: ["inputRoute", "exportId"],
    validate: value => [...requiredEnum(value, "inputRoute", INPUT_ROUTE_SET), ...optionalExport(value)],
  },
  SHOW_RESULT_SUMMARY: { keys: [], validate: noArguments },
  OPEN_SECTION: { keys: ["sectionId"], validate: value => requiredEnum(value, "sectionId", SECTION_ID_SET) },
  SELECT_EXPORT_PREVIEW: { keys: ["exportId"], validate: value => requiredEnum(value, "exportId", EXPORT_ID_SET) },
  DOWNLOAD_EXPORT: { keys: ["exportId"], validate: value => requiredEnum(value, "exportId", EXPORT_ID_SET), confirmation: true },
  OPEN_GRAPH_PREVIEW: { keys: [], validate: noArguments },
  SET_GRAPH_VIEW: { keys: ["viewMode"], validate: value => requiredEnum(value, "viewMode", GRAPH_VIEW_SET) },
  SET_GRAPH_LAYOUT: { keys: ["layout"], validate: value => requiredEnum(value, "layout", GRAPH_LAYOUT_SET) },
  SET_VIZ_LIMIT: { keys: ["limit"], validate: value => isSafeVisualLimit(value.limit) ? [] : ["arguments.limit must be an integer from 1 through 10000."] },
  SEARCH_GRAPH_VERTEX: { keys: ["query"], validate: value => typeof value.query === "string" && value.query.trim() && value.query.length <= 240 ? [] : ["arguments.query must be a non-empty string of at most 240 characters."] },
  RESET_GRAPH_VIEW: { keys: [], validate: noArguments },
  REHEAT_GRAPH: { keys: [], validate: noArguments },
  EXPORT_GRAPH_PNG: { keys: [], validate: noArguments, confirmation: true },
  OPEN_CUSTOM_PARSER: { keys: ["exportId"], validate: optionalExport },
  REQUEST_PARSE_MODE: { keys: ["mode"], validate: value => ["together", "separate"].includes(value.mode) ? [] : ["arguments.mode must be together or separate."] },
  GENERATE_MAPPING_SPEC: { keys: [], validate: noArguments },
  VALIDATE_MAPPING_SPEC: { keys: [], validate: noArguments },
  REPAIR_MAPPING_SPEC: { keys: [], validate: noArguments },
  GENERATE_PARSER_FROM_MAPPING: { keys: [], validate: noArguments, stopAfterResult: true },
  RUN_CUSTOM_PARSER: { keys: [], validate: noArguments, confirmation: true },
  APPLY_CUSTOM_RESULT: { keys: [], validate: noArguments, confirmation: true },
  CLEAR_GRAPH: { keys: [], validate: noArguments, confirmation: true },
  DISCOVER_CANDY_CAPABILITIES: { keys: [], validate: noArguments, stopAfterResult: true },
  SUBMIT_CANDY_JOB: {
    keys: ["algorithm", "backend", "mode", "sourceVertexId", "threads", "timeoutMs"],
    validate: validCandySubmission,
    stopAfterResult: true,
    modelArgumentContract: Object.freeze({
      algorithm: "literal SSSP",
      backend: "literal LOCAL_OPENMP",
      mode: "STATIC, INCREMENTAL, or COMPARE; use STATIC when the user did not request an incremental/comparison run",
      sourceVertexId: "the bounded canonical source ID named by the user",
      threads: "integer 1..256; use 2 when the user did not specify a value",
      timeoutMs: "integer 1..86400000; use 5000 when the user did not specify a value",
    }),
  },
  GET_CANDY_JOB_STATUS: { keys: ["jobId"], validate: validJobId, stopAfterResult: true },
  CANCEL_CANDY_JOB: { keys: ["jobId"], validate: validJobId, stopAfterResult: true },
  OPEN_CANDY_RESULT: { keys: ["jobId"], validate: validJobId, stopAfterResult: true },
});

export const REACT_ACTION_TYPES = Object.freeze(Object.keys(REACT_CAPABILITY_DEFINITIONS));

export function validateReactActionArguments(action, argumentsValue) {
  const definition = REACT_CAPABILITY_DEFINITIONS[action];
  if (!definition) return ["The proposed action is not in the current allowlist."];
  if (!argumentsValue || typeof argumentsValue !== "object" || Array.isArray(argumentsValue)) return ["arguments must be an object."];
  const extra = Object.keys(argumentsValue).filter(key => !definition.keys.includes(key));
  return [
    ...extra.map(key => `arguments.${key} is not allowed for ${action}.`),
    ...definition.validate(argumentsValue),
  ];
}

export function reactActionRequiresConfirmation(action, state = {}, argumentsValue = {}) {
  if (["RUN_CUSTOM_PARSER", "APPLY_CUSTOM_RESULT", "CLEAR_GRAPH", "DOWNLOAD_EXPORT", "EXPORT_GRAPH_PNG"].includes(action)) return true;
  if (action === "SUBMIT_CANDY_JOB") {
    return argumentsValue.mode === "COMPARE"
      || Number(argumentsValue.threads) > 8
      || Number(argumentsValue.timeoutMs) > 30_000
      || Number(state.graph?.vertexCount) > 100_000
      || Number(state.graph?.edgeCount) > 500_000;
  }
  return action === "PARSE_ACTIVE_BATCH" && Boolean(state.graph?.available);
}

export function actionStopsAfterResult(action) {
  return Boolean(REACT_CAPABILITY_DEFINITIONS[action]?.stopAfterResult);
}

export function availableReactActions(state = {}) {
  if (state.pendingConfirmation) return [];
  const actions = new Set(REACT_ACTION_TYPES);
  if (!state.upload?.fileCount || state.upload?.requiresReupload) {
    [START_CUSTOM_PARSER_WORKFLOW, "AUTO_DETECT_ACTIVE_BATCH", "PARSE_ACTIVE_BATCH", "REQUEST_PARSE_MODE", "GENERATE_MAPPING_SPEC", "OPEN_CUSTOM_PARSER"].forEach(action => actions.delete(action));
  }
  if (state.customParser?.triggerPolicy !== "specialist") actions.delete(START_CUSTOM_PARSER_WORKFLOW);
  if (state.formatDetection?.status === "unsupported") actions.delete("PARSE_ACTIVE_BATCH");
  if (!state.graph?.available) {
    ["SHOW_RESULT_SUMMARY", "OPEN_GRAPH_PREVIEW", "SEARCH_GRAPH_VERTEX", "RESET_GRAPH_VIEW", "REHEAT_GRAPH", "EXPORT_GRAPH_PNG", "DOWNLOAD_EXPORT", "CLEAR_GRAPH"].forEach(action => actions.delete(action));
  }
  if (!state.customParser?.runReady) actions.delete("RUN_CUSTOM_PARSER");
  if (!state.customParser?.applyReady) actions.delete("APPLY_CUSTOM_RESULT");
  if (!state.dataset?.available) ["VALIDATE_MAPPING_SPEC", "REPAIR_MAPPING_SPEC", "GENERATE_PARSER_FROM_MAPPING"].forEach(action => actions.delete(action));
  if (!state.candy?.featureEnabled) {
    ["DISCOVER_CANDY_CAPABILITIES", "SUBMIT_CANDY_JOB", "GET_CANDY_JOB_STATUS", "CANCEL_CANDY_JOB", "OPEN_CANDY_RESULT"].forEach(action => actions.delete(action));
  } else {
    if (state.candy.status === "disabled") actions.delete("DISCOVER_CANDY_CAPABILITIES");
    if (state.candy.capabilityStatus !== "ready" || !state.graph?.available || !isOrdinaryGraphType(state.graph?.graphType)) actions.delete("SUBMIT_CANDY_JOB");
    const jobs = state.candy.jobs ?? [];
    if (!jobs.length) ["GET_CANDY_JOB_STATUS", "CANCEL_CANDY_JOB", "OPEN_CANDY_RESULT"].forEach(action => actions.delete(action));
    if (!jobs.some(job => ["queued", "preparing", "running", "validating", "cancelling"].includes(job.status))) actions.delete("CANCEL_CANDY_JOB");
    if (!jobs.some(job => job.status === "completed")) actions.delete("OPEN_CANDY_RESULT");
  }
  return [...actions];
}
