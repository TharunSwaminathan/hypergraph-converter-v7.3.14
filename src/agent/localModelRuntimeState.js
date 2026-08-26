export const LOCAL_MODEL_GENERATION_IDLE = Object.freeze({
  status: "idle",
  task: null,
  requestId: null,
  message: "",
  lastOutcome: null,
  lastClassification: null,
  updatedAt: null,
});

export function createLocalModelGenerationState(overrides = {}, now = () => new Date().toISOString()) {
  return {
    ...LOCAL_MODEL_GENERATION_IDLE,
    ...overrides,
    updatedAt: overrides.updatedAt ?? now(),
  };
}

export function taskLabel(task) {
  return {
    health_check: "basic connection test",
    graph_mutation_planner: "graph edit planner",
    graph_mutation_planner_repair: "graph edit planner repair",
    graph_mutation_planner_diagnostic: "graph planner diagnostic",
    action_planner: "dashboard ActionPlan",
    conversation: "conversation",
    mapping: "mapping refinement",
    plan_dataset_interpretation: "dataset interpretation",
    plan_dataset_mapping_patch: "dataset mapping patch",
    custom_parser: "custom parser generation",
    summarization: "conversation summary",
  }[task] ?? String(task ?? "local model");
}

export function generationStateForStart({ task, requestId, message } = {}) {
  return createLocalModelGenerationState({
    status: "generating",
    task,
    requestId,
    message: message || `Running ${taskLabel(task)}…`,
    lastOutcome: null,
    lastClassification: null,
  });
}

export function generationStateForStopping(previous = {}) {
  return createLocalModelGenerationState({
    ...previous,
    status: "stopping",
    message: "Stopping…",
    lastOutcome: "aborting",
    lastClassification: "request_aborted",
  });
}

export function generationStateForOutcome(previous = {}, {
  outcome = "success",
  classification = "",
  fallbackUsed = false,
  message = "",
} = {}) {
  const status = outcome === "timeout"
    ? "timed_out"
    : fallbackUsed || outcome === "fallback" || outcome === "invalid"
      ? "degraded"
      : "idle";
  return createLocalModelGenerationState({
    status,
    task: status === "idle" ? null : previous.task ?? null,
    requestId: status === "idle" ? null : previous.requestId ?? null,
    message,
    lastOutcome: fallbackUsed ? "fallback" : outcome,
    lastClassification: classification || null,
  });
}

export function runtimeBannerText({
  model = "qwen3:8b",
  connectionStatus = "disconnected",
  generation = LOCAL_MODEL_GENERATION_IDLE,
} = {}) {
  const name = String(model || "LOCAL ASSISTANT").toUpperCase();
  if (connectionStatus !== "connected") return "LOCAL ASSISTANT DISCONNECTED · DETERMINISTIC CONTROLS AVAILABLE";
  if (generation?.status === "generating") return `${name} WORKING · ${taskLabel(generation.task).toUpperCase()}`;
  if (generation?.status === "stopping") return `${name} STOPPING · NO GRAPH CHANGE WILL BE PREPARED`;
  if (generation?.status === "timed_out" && generation?.task === "plan_dataset_mapping_patch") return `${name} TIMED OUT · DETERMINISTIC MAPPING FALLBACK AVAILABLE`;
  if (generation?.status === "timed_out") return `${name} TIMED OUT · RETRY OR USE FALLBACK`;
  if (generation?.status === "degraded" && generation?.task === "plan_dataset_mapping_patch") return `${name} DEGRADED · DETERMINISTIC MAPPING FALLBACK AVAILABLE`;
  if (generation?.status === "degraded") return `${name} DEGRADED · DETERMINISTIC FALLBACK AVAILABLE`;
  return `${name} CONNECTED · DETERMINISTIC EXECUTION`;
}
