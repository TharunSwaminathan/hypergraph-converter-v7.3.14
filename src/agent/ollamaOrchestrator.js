import { buildOrchestratorContext } from "./orchestratorContext.js";
import { ACTION_PLAN_RESPONSE_SCHEMA } from "./ollamaActionPlanSchema.js";
import { LOCAL_MODEL_TASK_MODES } from "./modelPromptBuilder.js";
import { buildOllamaOrchestratorMessages } from "./prompts/ollamaOrchestratorPrompt.js";

export const OLLAMA_ORCHESTRATOR_TASK = "ollama_action_plan";
export const OLLAMA_ORCHESTRATOR_TEMPERATURE = 0.1;
export const MAX_ORCHESTRATOR_PROMPT_CHARS = 30000;

export function buildOllamaOrchestratorRequest({
  userQuery,
  state,
  activeBatch = null,
  conversation = [],
  previewLimits = {},
  locationLike = null,
} = {}) {
  const appContext = buildOrchestratorContext({ state, activeBatch, previewLimits, locationLike });
  const messages = buildOllamaOrchestratorMessages({ userQuery, appContext, conversation });
  const promptChars = messages.reduce((sum, message) => sum + message.content.length, 0);
  if (promptChars > MAX_ORCHESTRATOR_PROMPT_CHARS) {
    throw new Error("The local orchestrator prompt exceeds 30,000 characters. Reduce active-batch preview settings before retrying.");
  }
  return {
    task: OLLAMA_ORCHESTRATOR_TASK,
    taskMode: LOCAL_MODEL_TASK_MODES.PLAN_ACTIONS,
    messages,
    appContext,
    promptChars,
    responseSchema: ACTION_PLAN_RESPONSE_SCHEMA,
    temperatureOverride: OLLAMA_ORCHESTRATOR_TEMPERATURE,
  };
}
