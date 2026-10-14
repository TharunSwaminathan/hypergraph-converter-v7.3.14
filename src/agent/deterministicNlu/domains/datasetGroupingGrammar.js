import { compileDatasetMappingGrammar } from "./datasetMappingGrammar.js";

export function compileDatasetGroupingGrammar(text = "", options = {}) {
  const mode = /^\s*(?:parse|treat|use)\s+(?:(?:all|these|the)\s+files\s+)?together(?:\s+as\s+(?:one|a single)\s+dataset)?[.!]?\s*$/i.test(text) ? "together"
    : /^\s*parse\s+(?:(?:all|these|the)\s+files\s+)?separately[.!]?\s*$/i.test(text) ? "separate" : null;
  // Grouping precedes schema inference. This bounded typed edit needs only an
  // exact batch binding, not a guessed DatasetMappingSpec.
  if (mode && options.batch?.id) return {
    ok: true, domain: "dataset_grouping", intent: "group_files",
    draft: { classification: "patch", summary: `Parse files ${mode}.`, operations: [{ type: "SET_PARSE_MODE", value: mode }] },
    diagnostics: { nluDomain: "dataset_grouping", nluIntent: "group_files", operationTypes: ["SET_PARSE_MODE"] },
  };
  const compiled = compileDatasetMappingGrammar(text, options);
  if (!compiled.ok || compiled.noMatch) return compiled;
  const operationTypes = compiled.draft?.operations?.map(operation => operation.type) ?? [];
  const groupingOps = new Set(["SET_PARSE_MODE", "CREATE_GROUP", "MOVE_FILE_TO_GROUP", "MARK_VALIDATION_FILE", "MARK_UPDATE_STREAM", "IGNORE_FILE"]);
  if (!operationTypes.some(type => groupingOps.has(type))) return { ok: false, noMatch: true };
  return {
    ...compiled,
    diagnostics: {
      ...compiled.diagnostics,
      nluDomain: "dataset_grouping",
      nluIntent: "group_files",
    },
  };
}
