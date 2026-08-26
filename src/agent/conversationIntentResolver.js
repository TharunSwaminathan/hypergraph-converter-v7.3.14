import { classifyIntent } from "./intentClassifier.js";

import { PUBLIC_ACTION_INTENTS } from "./actionIntentRegistry.js";

const CONVERSATION_EXACT = new Set([
  "hello",
  "hi",
  "hey",
  "howdy",
  "reply hello",
  "say hello",
  "how are you",
  "how are you?",
  "what can you help me with",
  "what can you help me with?",
  "what should i do next",
  "what should i do next?",
]);

const PLACEHOLDER_DATA_ROUTE_INTENTS = new Set([
  "batch_updates_placeholder",
  "freeform_placeholder",
]);

const EXPLICIT_ACTION_INTENTS = new Set([
  ...PUBLIC_ACTION_INTENTS,
  "switch_tab",
  "show_graph_preview",
  "show_mappings",
  "show_exports",
  "show_stats",
  "select_export_preview",
  "clear_graph_request",
  "apply_custom_parser_request",
  "run_custom_parser_request",
  "route_uploaded_files",
  "auto_detect_uploaded_files",
  "parse_uploaded_files",
  "use_uploaded_files_with_custom_parser",
  "local_model_test",
  "local_model_list",
  "local_runtime_diagnostics",
  "local_runtime_test_bridge",
  "local_runtime_test_generation",
  "local_runtime_test_direct_ollama",
  "local_model_reconnect_bridge",
  "local_model_connect",
  "local_model_disable",
  "local_model_enable",
  "local_model_select",
  "local_model_generate_parser",
  "generate_mapping_spec",
  "repair_mapping_spec",
  "generate_parser_from_mapping",
  "generate_deterministic_mapping",
  "auto_repair_mapping",
  "use_deterministic_draft",
  "use_repaired_mapping",
  "validate_mapping",
  "compare_expected_output",
  "export_mapping_finetune",
  "accept_mapping",
  "reject_mapping",
  "use_mapping_workflow",
  "upload_files",
  "clear_uploaded_files",
  "clear_all_batches",
  "clear_previous_batch",
  "view_previous_batch",
  "add_to_previous_batch",
  "use_active_batch",
  "activate_batch_number",
  "generate_parser_for_batch",
  "parse_together",
  "parse_separately",
  "change_visual_limit",
]);

const CONVERSATION_INTENTS = new Set([
  "explain_concept",
  "parse_guidance",
  "custom_parser_guidance",
  "visualization_guidance",
  "export_guidance",
  "diagnose_error",
  "help",
  "explain_mapping",
  "explain_file_roles",
  "explain_uploaded_files",
  "compare_datasets",
  "compare_formats",
  "local_model_status",
  "local_model_explain_strategy",
  "show_repair_notes",
  "unknown",
]);

function normalizeText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[“”]/g, "\"")
    .replace(/[‘’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function hasQuestionShape(normalized) {
  return /\?$/.test(normalized)
    || /^(what|why|how|when|where|which|who|can you|could you|would you|should i|do i|does|is|are)\b/.test(normalized);
}

function asksAboutPendingConfirmation(normalized) {
  return /\b(what will|what does|why|explain|will this|what happens|if i cancel|if i confirm|replace|modify|safe|confirmation|confirm)\b/.test(normalized);
}

function hasExplanationCue(normalized) {
  return /\b(explain|what is|what's|what are|describe|tell me about|why is|how does|what did|what should)\b/.test(normalized);
}

function hasActionConnector(normalized) {
  return /\b(?:and then|then|after that|also|and)\b/.test(normalized);
}

function hasExplicitActionVerb(normalized) {
  return /\b(use|open|switch|select|auto[- ]?detect|parse|convert|export|download|generate|repair|run|apply|clear|test|list|set|show)\b/.test(normalized);
}

function hasCapabilityObject(normalized) {
  return /\b(route|tab|graph preview|statistics|stats|export|csr json|csr csv|h2v|v2h|h2h|json|custom parser|mapping spec|parser result|visual limit|diagnostics|local model|ollama|batch|uploaded file|attached file|active batch|graph)\b/.test(normalized);
}

function isShowConversation(normalized) {
  return /\bshow me (why|how|what|the reason|an example|examples)\b/.test(normalized)
    || /\bshow\b.*\b(useful|means|difference|concept|format|works)\b/.test(normalized);
}

function isMixedRequest(normalized) {
  if (!hasExplanationCue(normalized) || !hasActionConnector(normalized)) return false;
  return /\b(export|convert|parse|open|switch|select|generate|repair|run|apply|clear|set|test)\b/.test(normalized)
    && hasCapabilityObject(normalized);
}

function controlPlanLooksActionable(controlPlan) {
  if (!controlPlan) return false;
  return !["respond", "focus_mapping_editor"].includes(controlPlan.kind);
}

export function resolveConversationIntent(userQuery, state = {}, {
  pendingAction = null,
  controlPlan = null,
} = {}) {
  void state;
  const normalized = normalizeText(userQuery);
  const classified = classifyIntent(userQuery);

  if (!normalized) {
    return { mode: "conversation", confidence: "low", reason: "empty input is non-actionable", classification: classified };
  }

  if (pendingAction) {
    if (asksAboutPendingConfirmation(normalized) || hasQuestionShape(normalized)) {
      return {
        mode: "conversation",
        confidence: "high",
        reason: "question about pending confirmation",
        classification: classified,
      };
    }
    return {
      mode: "action",
      confidence: "high",
      reason: "pending confirmation blocks new actions",
      classification: classified,
    };
  }

  if (CONVERSATION_EXACT.has(normalized.replace(/[.!]+$/, ""))) {
    return { mode: "conversation", confidence: "high", reason: "greeting or ordinary conversation", classification: classified };
  }

  if (isMixedRequest(normalized)) {
    return { mode: "mixed", confidence: "medium", reason: "contains explanation and validated action request", classification: classified };
  }

  if (controlPlanLooksActionable(controlPlan)) {
    return { mode: "action", confidence: "high", reason: `deterministic control plan: ${controlPlan.kind}`, classification: classified };
  }

  if (PLACEHOLDER_DATA_ROUTE_INTENTS.has(classified.intent)) {
    return {
      mode: "action",
      confidence: "medium",
      reason: "manual data-conversion route placeholder, not ordinary conversation",
      classification: classified,
    };
  }

  if (isShowConversation(normalized)) {
    return { mode: "conversation", confidence: "high", reason: "show/explain request is conceptual", classification: classified };
  }

  if (EXPLICIT_ACTION_INTENTS.has(classified.intent)) {
    return { mode: "action", confidence: "high", reason: `explicit capability intent: ${classified.intent}`, classification: classified };
  }

  if (hasExplicitActionVerb(normalized) && hasCapabilityObject(normalized)) {
    return { mode: "action", confidence: "medium", reason: "explicit action verb with known app capability", classification: classified };
  }

  if (CONVERSATION_INTENTS.has(classified.intent)) {
    return { mode: "conversation", confidence: classified.intent === "unknown" ? "low" : "high", reason: `conversational intent: ${classified.intent}`, classification: classified };
  }

  if (hasQuestionShape(normalized) || hasExplanationCue(normalized)) {
    return { mode: "conversation", confidence: "medium", reason: "question or explanation shape", classification: classified };
  }

  return {
    mode: "conversation",
    confidence: "low",
    reason: "ambiguous input defaults to safe conversation or clarification",
    classification: classified,
  };
}

export function intentAllowsPendingConversation(userQuery) {
  return resolveConversationIntent(userQuery, {}, { pendingAction: { actionType: "pending" } }).mode === "conversation";
}

