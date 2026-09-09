import { ORCHESTRATOR_STEP_KEYS, ORCHESTRATOR_STEP_OUTCOMES } from "./orchestratorStepSchema.js";
import { validateReactActionArguments } from "./orchestratorCapabilities.js";

function objectValue(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseStrictOrchestratorStep(raw) {
  if (objectValue(raw)) return { ok: true, data: raw };
  if (typeof raw !== "string") return { ok: false, errors: ["The model response must be a JSON object."] };
  try {
    const data = JSON.parse(raw.trim());
    return objectValue(data) ? { ok: true, data } : { ok: false, errors: ["The model response must be one JSON object."] };
  } catch {
    return { ok: false, errors: ["The model response is not strict JSON."] };
  }
}

export function validateOrchestratorStep(raw, allowedActions = []) {
  const parsed = parseStrictOrchestratorStep(raw);
  if (!parsed.ok) return { ...parsed, data: null };
  const value = parsed.data;
  const errors = [];
  const keys = Object.keys(value);
  ORCHESTRATOR_STEP_KEYS.filter(key => !keys.includes(key)).forEach(key => errors.push(`Missing top-level field: ${key}.`));
  keys.filter(key => !ORCHESTRATOR_STEP_KEYS.includes(key)).forEach(key => errors.push(`Unexpected top-level field: ${key}.`));
  if (!ORCHESTRATOR_STEP_OUTCOMES.includes(value.outcome)) errors.push("Unknown orchestrator outcome.");
  if (!objectValue(value.arguments)) errors.push("arguments must be an object.");
  if (typeof value.requiresUserInput !== "boolean") errors.push("requiresUserInput must be boolean.");
  if (typeof value.finish !== "boolean") errors.push("finish must be boolean.");

  if (value.outcome === "PROPOSE_ACTION") {
    if (typeof value.action !== "string" || !allowedActions.includes(value.action)) errors.push("The proposed action is not in the current allowlist.");
    if (value.requiresUserInput !== false || value.userMessage !== null || value.finish !== false) errors.push("PROPOSE_ACTION must not request input, provide a message, or finish.");
    if (typeof value.action === "string" && objectValue(value.arguments)) errors.push(...validateReactActionArguments(value.action, value.arguments));
  } else if (value.outcome === "REQUEST_USER_INPUT") {
    if (value.action !== null || keys.length && objectValue(value.arguments) && Object.keys(value.arguments).length) errors.push("REQUEST_USER_INPUT cannot include an action or arguments.");
    if (value.requiresUserInput !== true || value.finish !== true) errors.push("REQUEST_USER_INPUT must require input and finish the loop.");
    if (typeof value.userMessage !== "string" || !value.userMessage.trim() || value.userMessage.length > 2000) errors.push("REQUEST_USER_INPUT needs a bounded userMessage.");
  } else if (value.outcome === "FINAL_RESPONSE") {
    if (value.action !== null || objectValue(value.arguments) && Object.keys(value.arguments).length) errors.push("FINAL_RESPONSE cannot include an action or arguments.");
    if (value.requiresUserInput !== false || value.finish !== true) errors.push("FINAL_RESPONSE must finish without requesting input.");
    if (typeof value.userMessage !== "string" || !value.userMessage.trim() || value.userMessage.length > 6000) errors.push("FINAL_RESPONSE needs a bounded userMessage.");
  }
  return { ok: errors.length === 0, data: errors.length ? null : value, rawData: value, errors };
}
