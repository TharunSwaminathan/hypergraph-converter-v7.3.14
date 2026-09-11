import { analyzeRequestSemantics } from "./deterministicNlu/requestSemantics.js";
import { CUSTOM_PARSER_GROUPING_QUESTION } from "./customParserTriggerPolicy.js";
import { actionStopsAfterResult, reactActionRequiresConfirmation } from "./orchestratorCapabilities.js";
import { MAX_REACT_STEPS } from "./reactOrchestratorConfig.js";
import { observationStillCurrent } from "./orchestratorObservation.js";
import { validateOrchestratorStep } from "./orchestratorStepValidator.js";

const safeResult = (action, result = {}) => ({
  action,
  ok: Boolean(result.ok),
  outcome: String(result.outcome ?? (result.ok ? "completed" : "failed")),
  error: result.error ? String(result.error).slice(0, 500) : null,
  stateMutationCommitted: Boolean(result.stateMutationCommitted),
  resultId: String(result.resultId ?? result.details?.resultId ?? "").slice(0, 120),
});

const SUCCESS_CLAIM = /\b(?:success(?:ful(?:ly)?)?|completed?|finished|done|ran|executed|applied|committed|replaced|deleted|cleared|updated|generated|created|downloaded)\b/i;

export function finalResponseIsGrounded(message, lastToolResult) {
  if (!SUCCESS_CLAIM.test(String(message ?? ""))) return true;
  return Boolean(lastToolResult?.ok);
}

export function groupingClarificationRequired(userQuery, observation) {
  const text = String(userQuery ?? "").toLowerCase();
  const workflowRequest = /\b(convert|parse|parser|graph|shortest path|analy[sz]e|process)\b/.test(text);
  return workflowRequest
    && observation?.upload?.fileCount > 1
    && observation?.formatDetection?.status === "unsupported"
    && observation?.grouping?.status === "unresolved";
}

export function requestMustRemainReadOnly(userQuery, suppliedSemantics = null) {
  const value = String(userQuery ?? "");
  const semantics = suppliedSemantics ?? analyzeRequestSemantics(value);
  const explicitLiteralOrNoAction = /\b(?:read (?:this|the following) (?:literally|as text)|not asking (?:you )?(?:for|to)|for (?:the )?(?:documentation|manual|reference)(?: only)?|for reference only|write instructions|document the steps)\b/i.test(value)
    || /\b(?:without (?:running|executing|applying|changing|performing)|do not perform)\b/i.test(value)
    || /\b(?:keep|leave) (?:everything|my workspace|the workspace|the graph|the state) (?:exactly )?(?:unchanged|untouched|as it is)\b/i.test(value)
    || (/\b(?:pretend|suppose|what if)\b/i.test(value) && !/\bthen\s+(?:actually\s+)?(?:run|execute|apply|clear|delete|replace|convert|parse|generate|set|open|select|download|change|add|remove|update)\b/i.test(value));
  const authorizedActionText = String(semantics.authorizedActionText ?? "");
  const hasPositiveExecutableClause = Boolean(
    semantics.executionAuthorized
    && /\b(?:run|execute|apply|clear|delete|replace|convert|parse|generate|create|write|build|set|open|select|download|change|add|remove|update)\b/i.test(authorizedActionText)
    && !/^\s*(?:do not|don't|never|without)\b/i.test(authorizedActionText),
  );
  return explicitLiteralOrNoAction
    || semantics.scopes?.preserveState
    || (!hasPositiveExecutableClause && (
      Boolean(semantics.authorization?.deniedClauses?.some(clause => clause.scopes?.denied))
      || semantics.directRuntimeStop
      || semantics.explicitReadOnly
      || semantics.explanatoryAction
      || semantics.instructional
      || semantics.reported
      || semantics.quoted
      || semantics.hypothetical
      || semantics.negatedAction
    ));
}

export async function runBoundedOrchestrator({
  userQuery,
  getObservation,
  callModel,
  executeAction,
  stageConfirmation,
  authorizeAction = () => ({ allowed: true }),
  fallback = null,
  onStep = null,
  maxSteps = MAX_REACT_STEPS,
  preflight = true,
} = {}) {
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > MAX_REACT_STEPS) throw new Error(`maxSteps must be from 1 through ${MAX_REACT_STEPS}.`);
  const metrics = { modelCalls: 0, actionsExecuted: 0, confirmationsStaged: 0, fallbackCount: 0, iterations: 0, observationChars: [], promptChars: [] };
  let lastToolResult = null;
  const seen = new Set();

  const initial = await getObservation(lastToolResult);
  if (initial.pendingConfirmation) return { ok: false, outcome: "confirmation_pending", stopReason: "confirmation", metrics, lastToolResult };
  if (initial.upload?.requiresReupload && /\b(continue|resume|convert|parse|parser|file|dataset)\b/i.test(userQuery)) {
    return { ok: false, outcome: "request_user_input", stopReason: "clarification", userMessage: "The saved thread has file references only. Re-upload the source files before continuing; no prior approval or action was restored.", metrics };
  }
  if (preflight && groupingClarificationRequired(userQuery, initial)) {
    return { ok: true, outcome: "request_user_input", stopReason: "clarification", userMessage: CUSTOM_PARSER_GROUPING_QUESTION, metrics, continuation: { originalQuery: String(userQuery).slice(0, 2000), datasetId: initial.dataset.activeDatasetId, stateVersionToken: initial.stateVersionToken } };
  }
  const semantics = analyzeRequestSemantics(userQuery);
  if (requestMustRemainReadOnly(userQuery, semantics)) {
    return { ok: true, outcome: "fallback", stopReason: "read_only", metrics, fallbackRequired: true };
  }

  for (let index = 0; index < maxSteps; index += 1) {
    const observation = await getObservation(lastToolResult);
    metrics.iterations += 1;
    metrics.observationChars.push(JSON.stringify(observation).length);
    if (observation.pendingConfirmation) return { ok: false, outcome: "confirmation_pending", stopReason: "confirmation", metrics, lastToolResult };
    let modelResult;
    try {
      metrics.modelCalls += 1;
      modelResult = await callModel({ userQuery, observation, stepIndex: index, lastToolResult });
    } catch (error) {
      modelResult = { ok: false, error: error instanceof Error ? error.message : String(error), classification: "model_failure" };
    }
    if (Number.isFinite(modelResult?.promptChars)) metrics.promptChars.push(modelResult.promptChars);
    if (!modelResult?.ok) {
      metrics.fallbackCount += 1;
      if (fallback) return { ...(await fallback({ reason: modelResult?.error ?? "The local model was unavailable.", classification: modelResult?.classification })), metrics, fallbackUsed: true };
      return { ok: false, outcome: "model_unavailable", stopReason: "model_failure", error: modelResult?.error ?? "The local model was unavailable.", metrics };
    }
    const validated = validateOrchestratorStep(modelResult.raw ?? modelResult.step, observation.availableCapabilities);
    if (!validated.ok) {
      metrics.fallbackCount += 1;
      if (fallback) return { ...(await fallback({ reason: "The ReAct step failed strict validation.", validationErrors: validated.errors })), metrics, fallbackUsed: true, validationErrors: validated.errors };
      return { ok: false, outcome: "invalid_step", stopReason: "validation_failure", errors: validated.errors, metrics };
    }
    const step = validated.data;
    onStep?.({ index, step, observation });
    if (step.outcome === "REQUEST_USER_INPUT") return { ok: true, outcome: "request_user_input", stopReason: "clarification", userMessage: step.userMessage, step, metrics };
    if (step.outcome === "FINAL_RESPONSE") {
      if (!finalResponseIsGrounded(step.userMessage, lastToolResult)) {
        metrics.fallbackCount += 1;
        if (fallback) return { ...(await fallback({ reason: "The model response claimed an unobserved successful action." })), metrics, fallbackUsed: true };
        return { ok: false, outcome: "ungrounded_final_response", stopReason: "validation_failure", error: "The model response claimed an unobserved successful action.", metrics };
      }
      return { ok: true, outcome: "final_response", stopReason: "finished", userMessage: step.userMessage, step, metrics };
    }

    const current = await getObservation(lastToolResult);
    if (!observationStillCurrent(observation, current)) {
      lastToolResult = safeResult(step.action, { ok: false, outcome: "stale_observation", error: "Authoritative state changed before execution." });
      continue;
    }
    const signature = `${step.action}:${JSON.stringify(step.arguments)}:${observation.stateVersionToken}`;
    if (seen.has(signature)) return { ok: false, outcome: "repeated_action_blocked", stopReason: "repeat_guard", error: "The same action was proposed twice against unchanged state.", metrics, lastToolResult };
    seen.add(signature);
    let authorization;
    try {
      authorization = authorizeAction({ action: step.action, arguments: step.arguments, userQuery, observation });
    } catch (error) {
      return { ok: false, outcome: "authorization_blocked", stopReason: "authorization", error: error instanceof Error ? error.message : "Authorization validation failed closed.", metrics };
    }
    if (!authorization?.allowed) return { ok: false, outcome: "authorization_blocked", stopReason: "authorization", error: authorization?.reason ?? "The user request did not authorize that action.", metrics };
    if (reactActionRequiresConfirmation(step.action, observation, step.arguments)) {
      let staged;
      try {
        staged = await stageConfirmation({ action: step.action, arguments: step.arguments, observation });
      } catch (error) {
        return { ok: false, outcome: "confirmation_failed", stopReason: "confirmation", error: error instanceof Error ? error.message : "Confirmation staging failed closed.", metrics };
      }
      metrics.confirmationsStaged += staged?.ok === false ? 0 : 1;
      return { ok: staged?.ok !== false, outcome: staged?.outcome ?? "confirmation_staged", stopReason: "confirmation", step, metrics };
    }
    let result;
    try {
      result = await executeAction({ action: step.action, arguments: step.arguments, observation });
    } catch (error) {
      result = { ok: false, outcome: "tool_exception", error: error instanceof Error ? error.message : String(error) };
    }
    metrics.actionsExecuted += 1;
    lastToolResult = safeResult(step.action, result);
    if (actionStopsAfterResult(step.action) || result?.stop === true || result?.confirmationStaged) {
      return { ok: Boolean(result?.ok), outcome: result?.outcome ?? "tool_result", stopReason: result?.confirmationStaged ? "confirmation" : "tool_boundary", lastToolResult, metrics };
    }
  }
  return { ok: false, outcome: "max_steps_reached", stopReason: "max_steps", error: `The assistant reached the ${maxSteps}-step safety limit and stopped without continuing any action.`, lastToolResult, metrics };
}
