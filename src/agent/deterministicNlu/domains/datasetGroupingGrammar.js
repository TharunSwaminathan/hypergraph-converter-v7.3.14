import { compileDatasetMappingGrammar } from "./datasetMappingGrammar.js";

export function compileDatasetGroupingGrammar(text = "", options = {}) {
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
