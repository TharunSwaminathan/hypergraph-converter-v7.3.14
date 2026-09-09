export const ORCHESTRATOR_STEP_OUTCOMES = Object.freeze([
  "PROPOSE_ACTION",
  "REQUEST_USER_INPUT",
  "FINAL_RESPONSE",
]);

export const ORCHESTRATOR_STEP_KEYS = Object.freeze([
  "outcome",
  "action",
  "arguments",
  "requiresUserInput",
  "userMessage",
  "finish",
]);

export const ORCHESTRATOR_STEP_RESPONSE_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ORCHESTRATOR_STEP_KEYS,
  properties: {
    outcome: { type: "string", enum: ORCHESTRATOR_STEP_OUTCOMES },
    action: { anyOf: [{ type: "string" }, { type: "null" }] },
    arguments: { type: "object" },
    requiresUserInput: { type: "boolean" },
    userMessage: { anyOf: [{ type: "string" }, { type: "null" }] },
    finish: { type: "boolean" },
  },
});
