import { analyzePositiveAuthorization, authorizationAllowsSideEffect } from "./deterministicNlu/positiveAuthorization.js";
import { isExpectedOutputFileName } from "./datasetMappingSpec.js";

export const CUSTOM_PARSER_GROUPING_QUESTION = "Do all of these files belong to one graph dataset, or should they be treated as separate graph datasets?";
// Deliberately narrow adapter: exact affirmative requests only, checked against
// the existing positive-authorization scopes. Returns a request, never a grant.
export function specialistConfirmationRequest(query, state) {
  if (!state?.specialistReviewRequired) return null;
  const run = /^(?:please\s+)?run (?:the |my )?custom parser(?: now)?[.!]?$/i.test(query.trim());
  const apply = /^(?:please\s+)?apply (?:the |my )?(?:custom )?parser result(?: to (?:the )?graph)?[.!]?$/i.test(query.trim());
  const scope = run ? "requires_parser_run_confirmation" : apply ? "requires_graph_apply_confirmation" : null;
  if (!scope || !authorizationAllowsSideEffect(analyzePositiveAuthorization(query), scope).allowed) return null;
  return run
    ? { actionType: "run_custom_parser", ready: Boolean(state.specialistRunReady ?? state.customCodeExists) }
    : { actionType: "apply_custom_parser_result", ready: Boolean(state.specialistApplyReady ?? state.customResultId) };
}
export function parserInputFiles(batch) {
  return (batch?.files ?? []).filter(file => !isExpectedOutputFileName(file.name) && !/^readme(?:\.|$)/i.test(file.name));
}
export function isExplicitParserRequest(query = "") {
  const candidate = /\b(?:generate|create|write|build)\b[\s\S]*\b(?:custom\s+parser|parser\s+(?:code|for))\b/i.test(query);
  // Adapt only this complete, positive request form. Never rewrite a clause
  // inside a longer request: trailing negation/quotation must reach the gate.
  const exactSpecialistRequest = /^(?:please\s+)?(?:generate|create|write|build)\s+(?:a\s+)?custom\s+parser(?:\s+(?:code|for (?:these|the uploaded|my) files))?\s*[.!]?$/i.test(query.trim());
  const authorizedText = exactSpecialistRequest ? "Generate custom parser" : query;
  return candidate && authorizationAllowsSideEffect(analyzePositiveAuthorization(authorizedText), "workflow_preparation").allowed;
}
export function customParserTriggerPolicy({ batch, query = "", pendingAction = null, uploadEvent = false } = {}) {
  if (pendingAction) return { kind: "blocked", reason: "Resolve the pending action first." };
  const explicit = isExplicitParserRequest(query);
  if (query && !explicit) return { kind: "none", reason: "Existing deterministic routing remains authoritative." };
  if (!query && !uploadEvent) return { kind: "none" };
  const files = parserInputFiles(batch);
  if (!files.length) return { kind: explicit ? "needs_files" : "none", reason: "Upload input files before generating a custom parser." };
  const detection = batch.detectedFormat ?? {};
  if (!explicit && detection.confidence === "ambiguous") return { kind: "clarify_format", reason: detection.reason, candidates: detection.candidates ?? [] };
  if (!explicit && detection.formatId && detection.formatId !== "custom") return { kind: "builtin", formatId: detection.formatId };
  if (files.length > 1 && !["together", "separate"].includes(batch.parseMode)) return { kind: "awaiting_grouping", reason: CUSTOM_PARSER_GROUPING_QUESTION };
  const mode = files.length === 1 ? "together" : batch.parseMode;
  return { kind: "specialist", explicit, parseMode: mode, groups: mode === "separate" ? files.map(file => [file.id]) : [files.map(file => file.id)] };
}
