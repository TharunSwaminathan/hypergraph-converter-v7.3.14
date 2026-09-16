import { LOCAL_MODEL_TASK_MODES } from "./modelPromptBuilder.js";
import { ORCHESTRATOR_STEP_RESPONSE_SCHEMA } from "./orchestratorStepSchema.js";
import { buildReactOrchestratorMessages } from "./prompts/reactOrchestratorPrompt.js";

export const REACT_ORCHESTRATOR_TASK = "react_orchestrator_step";
export const REACT_ORCHESTRATOR_TEMPERATURE = 0;
export const MAX_REACT_PROMPT_CHARS = 30000;

export function buildReactOrchestratorRequest({ userQuery, observation, threadContext } = {}) {
  const messages = buildReactOrchestratorMessages({ userQuery, observation, threadContext });
  const promptChars = messages.reduce((sum, message) => sum + message.content.length, 0);
  if (promptChars > MAX_REACT_PROMPT_CHARS) throw new Error("The bounded ReAct prompt exceeds 30,000 characters.");
  return {
    task: REACT_ORCHESTRATOR_TASK,
    taskMode: LOCAL_MODEL_TASK_MODES.PLAN_ACTIONS,
    messages,
    promptChars,
    responseSchema: ORCHESTRATOR_STEP_RESPONSE_SCHEMA,
    temperatureOverride: REACT_ORCHESTRATOR_TEMPERATURE,
  };
}
