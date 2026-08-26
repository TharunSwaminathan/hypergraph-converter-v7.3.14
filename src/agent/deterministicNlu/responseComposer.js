import { conciseTraceLines } from "./interpretationTrace.js";

export function composeInterpretationTraceResponse(nlu = {}, diagnostic = null) {
  const trace = diagnostic?.nluTrace ?? nlu.trace ?? {};
  const lines = conciseTraceLines(trace);
  const domain = diagnostic?.nluDomain ?? nlu.primaryDomain ?? "unknown";
  const intent = diagnostic?.nluIntent ?? nlu.primaryIntent ?? "unknown";
  const confidence = diagnostic?.nluConfidence?.level ?? nlu.confidence?.level ?? "unknown";
  if (!lines.length) {
    return `I do not have a stored deterministic interpretation trace for the last action. Current domain: ${domain}; intent: ${intent}; confidence: ${confidence}.`;
  }
  return [
    `I used the deterministic NLU path: domain ${domain}, intent ${intent}, confidence ${confidence}.`,
    "Trace:",
    ...lines.map(line => `- ${line}`),
    "Only verified files, columns, graph IDs, and workflow state are allowed to become actions.",
  ].join("\n");
}

export function composeParserWorkflowStatus(state = {}) {
  const batch = state.activeBatch;
  if (!batch) return "No active upload batch is selected yet. Upload files before generating a mapping, plan, or parser.";
  const mappingReady = ["valid", "valid_with_warnings", "repaired", "repaired_with_warnings"].includes(batch.mappingSpecStatus);
  if (!mappingReady) return "Next safe step: finish and validate the DatasetMappingSpec. I will not generate or run parser code until a mapping is valid.";
  if (!batch.transformationPlan) return "Next safe step: generate the transformation plan. In this app, parser generation can also create that plan from the validated mapping.";
  if (!batch.generatedParserFromMapping) return "Next safe step: create the parser from the validated transformation plan.";
  if (!state.customResultId) return "Next safe step: run the generated parser. Running parser code requires confirmation.";
  return "Next safe step: review the parser preview. Applying parser results to the graph requires confirmation.";
}

export function composeNluHandledResponse({ domain, intent, actionMessage }) {
  return `${actionMessage}\n\nUnderstanding path: Deterministic NLU (${domain}/${intent}).`;
}
