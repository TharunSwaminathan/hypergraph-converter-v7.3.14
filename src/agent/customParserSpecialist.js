import { parse } from "acorn";
import { validateLocalModelResponse } from "./modelResponseValidator.js";
import { validateParserCodeSafety } from "../utils/customParser.js";
import { buildSpecialistPrompt } from "./prompts/customParserSpecialistPrompt.js";

export const SPECIALIST_MAX_ATTEMPTS = 3;
export function specialistBinding(batch, files) {
  return JSON.stringify({ id: batch?.id, version: batch?.version ?? 1, mode: batch?.parseMode, mappingRevision: batch?.mappingRevision ?? 0, files: files.map(f => [f.id, f.name, f.size]) });
}
export function validateSpecialistDraft(raw, request, files, parseMode) {
  let data;
  try { data = JSON.parse(raw); } catch { return { ok: false, errors: ["Expected exactly one JSON object."] }; }
  if (!data || Array.isArray(data) || typeof data !== "object") return { ok: false, errors: ["Expected a JSON object."] };
  const schema = request.responseSchema;
  if (Object.keys(data).some(k => !Object.hasOwn(schema.properties, k)) || schema.required.some(k => !Object.hasOwn(data, k))) return { ok: false, errors: ["Response has missing or unsupported fields."] };
  if (data.task !== request.task || typeof data.requiresClarification !== "boolean" || !Array.isArray(data.questionsForUser) || data.questionsForUser.some(q => typeof q !== "string")) return { ok: false, errors: ["Invalid task or clarification schema."] };
  if (data.requiresClarification) {
    if (!data.questionsForUser.length || data.parserCode !== "") return { ok: false, errors: ["Clarification requires questions and empty parserCode."] };
    return { ok: true, clarification: true, data };
  }
  if (typeof data.parserCode !== "string" || data.parserCode.length > 60000) return { ok: false, errors: ["Parser source exceeds the draft limit."] };
  const checked = validateLocalModelResponse(raw, { expectedTask: request.task, expectedParseMode: parseMode, activeFileNames: files.map(f => f.name) });
  if (!checked.ok) return checked;
  try {
    const ast = parse(data.parserCode, { ecmaVersion: "latest" });
    if (ast.body.length !== 1 || ast.body[0].type !== "FunctionDeclaration" || ast.body[0].id?.name !== "parseHypergraph" || !ast.body[0].async || ast.body[0].params.map(p => p.name).join(",") !== "files,helpers") throw new Error("Draft must contain only async function parseHypergraph(files, helpers).");
    const names = new Set(files.map(f => f.name));
    const visit = node => {
      if (!node || typeof node !== "object") return;
      if (node.type === "Literal" && typeof node.value === "string" && /^[^\s]+\.(?:csv|txt|json|tsv|mtx|log|blocks|weird|edge|edges)$/i.test(node.value) && !names.has(node.value)) throw new Error(`Parser references an unsupported filename: ${node.value}`);
      for (const child of Object.values(node)) {
        if (Array.isArray(child)) child.forEach(visit);
        else if (child && typeof child === "object") visit(child);
      }
    };
    visit(ast);
  } catch (error) { return { ok: false, errors: [error.message] }; }
  const safety = validateParserCodeSafety(data.parserCode);
  if (!safety.ok) return { ok: false, errors: [safety.error] };
  return { ok: true, data };
}

// No runner or graph commit capability is accepted by this controller.
export async function generateSpecialistDraft({ files, batch, userIntent, previous = null, runtimeError = "", generate, isCurrent = () => true, signal, onState = () => {} }) {
  let attempts = previous?.attempts ?? 0;
  let code = previous?.code ?? "";
  let errors = runtimeError ? [runtimeError] : [];
  const trace = [];
  while (attempts < SPECIALIST_MAX_ATTEMPTS) {
    if (signal?.aborted || !isCurrent()) return { ok: false, status: "stale", attempts, error: "Stopped or dataset changed. Draft was not installed.", trace };
    const request = buildSpecialistPrompt({ files, parseMode: batch.parseMode === "separate" ? "separate" : "together", profiles: batch.datasetProfile, relationships: batch.relationshipEvidence, userIntent, previousCode: code, errors, attempt: attempts + 1 });
    attempts += 1;
    onState({ status: code ? "repairing" : "generating", attempts });
    let raw;
    try { raw = await generate(request, signal); }
    catch (error) { return { ok: false, status: "failed", attempts, error: error.message, trace }; }
    if (signal?.aborted || !isCurrent()) return { ok: false, status: "stale", attempts, error: "Stopped or dataset changed. Draft was not installed.", trace };
    onState({ status: "static_validation", attempts });
    const validation = validateSpecialistDraft(raw, request, files, batch.parseMode);
    trace.push({ attempt: attempts, promptChars: request.promptChars, examples: request.selectedFewShots, ok: validation.ok, errors: validation.errors ?? [] });
    if (validation.ok) return { ok: true, status: validation.clarification ? "awaiting_clarification" : "ready_for_review", attempts, code: validation.data.parserCode, data: validation.data, trace };
    errors = validation.errors ?? ["Validation failed."];
    try { const parsed = JSON.parse(raw); if (typeof parsed.parserCode === "string" && parsed.parserCode.length <= 60000) code = parsed.parserCode; } catch { /* Schema errors remain bounded repair evidence. */ }
  }
  return { ok: false, status: "failed", attempts, error: "Three generation/repair attempts exhausted. Review the evidence and start a new explicit request.", errors, trace };
}
