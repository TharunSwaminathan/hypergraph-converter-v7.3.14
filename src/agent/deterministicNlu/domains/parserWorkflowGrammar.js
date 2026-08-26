import { hasNegatedRun } from "../negationResolver.js";

export const PARSER_WORKFLOW_OPERATION_TYPES = Object.freeze([
  "SHOW_WORKFLOW_STATUS",
  "GENERATE_TRANSFORMATION_PLAN",
  "GENERATE_PARSER_FROM_MAPPING",
  "RUN_CUSTOM_PARSER_CONFIRMATION",
  "APPLY_CUSTOM_PARSER_RESULT_CONFIRMATION",
]);

export function compileParserWorkflowGrammar(text = "", {
  nlu = null,
  state = {},
} = {}) {
  const raw = String(text ?? "");
  const q = raw.toLowerCase();
  const operations = [];
  const trace = {
    matchedRuleIds: [],
    resolvedEntityIds: [],
    rejectedCandidates: [],
  };
  const negatedRun = hasNegatedRun(nlu?.clauses ?? []) || /\bdo not run\b|\bdon't run\b|\bnot run\b/i.test(raw);
  const mentionsPlan = /\b(transformation\s+)?plan\b/i.test(raw);
  const mentionsParser = /\bparser\b/i.test(raw);
  const mentionsGenerate = /\b(generate|create|make|insert|build)\b/i.test(raw);
  const mentionsRun = /\b(run|execute|test)\s+(?:it|the\s+(?:generated\s+)?parser|generated\s+parser)\b/i.test(raw);
  const asksNext = /\bcontinue\b|\bnext step\b|\bwhat should i do next\b|\bshow the next step\b/i.test(raw);
  const asksStatus = !/\bcan you explain\b/i.test(raw) && (/\bstatus\b/i.test(raw) || /^\s*what is ready\??\s*$/i.test(raw) || /\b(?:show|tell|report)\b[\s\S]{0,60}\bwhere\s+i\s+am\b/i.test(raw));
  const reportedSpeech = /\b(?:previously\s+asked|asked\s+to|documentation\s+says|docs?\s+say|example\s+says|the\s+file\s+says)\b[\s\S]{0,160}\b(?:run|execute|apply|generate)\b/i.test(raw);

  if (reportedSpeech) {
    trace.matchedRuleIds.push("parser.reported_speech_rejected");
    trace.rejectedCandidates.push("reported_parser_command");
  } else if (asksStatus || /\bwhat should i do next\b/i.test(q)) {
    operations.push({ type: "SHOW_WORKFLOW_STATUS" });
    trace.matchedRuleIds.push("parser.status_question");
  }

  if (!reportedSpeech && asksNext && !asksStatus) {
    const batch = state.activeBatch ?? {};
    const mappingReady = ["valid", "valid_with_warnings", "repaired", "repaired_with_warnings"].includes(batch.mappingSpecStatus);
    if (!mappingReady) operations.push({ type: "SHOW_WORKFLOW_STATUS" });
    else if (!batch.transformationPlan) operations.push({ type: "GENERATE_TRANSFORMATION_PLAN" });
    else if (!batch.generatedParserFromMapping) operations.push({ type: "GENERATE_PARSER_FROM_MAPPING" });
    else if (!state.customResultId) operations.push({ type: "RUN_CUSTOM_PARSER_CONFIRMATION" });
    else operations.push({ type: "APPLY_CUSTOM_PARSER_RESULT_CONFIRMATION" });
    trace.matchedRuleIds.push("parser.continue_unique_next");
  }

  if (!reportedSpeech && ((mentionsGenerate && mentionsPlan) || /\bshow\b[\s\S]{0,40}\btransformation plan\b/i.test(raw))) {
    operations.push({ type: "GENERATE_TRANSFORMATION_PLAN" });
    trace.matchedRuleIds.push("parser.generate_plan");
  }
  if (!reportedSpeech && mentionsGenerate && mentionsParser) {
    operations.push({ type: "GENERATE_PARSER_FROM_MAPPING" });
    trace.matchedRuleIds.push("parser.generate_parser");
  }
  if (!reportedSpeech && mentionsRun && !negatedRun) {
    operations.push({ type: "RUN_CUSTOM_PARSER_CONFIRMATION" });
    trace.matchedRuleIds.push("parser.run_confirmation");
  }
  if (!reportedSpeech && /\b(?:apply|load)\b.*\b(parser )?result\b/i.test(raw)) {
    operations.push({ type: "APPLY_CUSTOM_PARSER_RESULT_CONFIRMATION" });
    trace.matchedRuleIds.push("parser.apply_result_confirmation");
  }
  if (negatedRun) {
    trace.matchedRuleIds.push("parser.negated_run");
    trace.rejectedCandidates.push("parser_run");
  }
  const deduped = [...new Map(operations.map(operation => [operation.type, operation])).values()];
  if (!deduped.length) return { ok: false, noMatch: true };
  return {
    ok: true,
    domain: "parser_workflow",
    intent: asksNext ? "next_step" : "parser_workflow",
    operations: deduped,
    negatedRun,
    diagnostics: {
      plannerPath: "deterministic_nlu",
      nluDomain: "parser_workflow",
      nluIntent: asksNext ? "next_step" : "parser_workflow",
      nluConfidence: nlu?.confidence,
      nluTrace: trace,
    },
  };
}
