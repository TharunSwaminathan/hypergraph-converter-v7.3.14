import { mappingFingerprint } from "./datasetMappingSpecV2.js";
import { validateDatasetMappingSpecV2 } from "./datasetMappingSpecV2Validator.js";

function clone(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function upsertById(list, item) {
  const index = list.findIndex(existing => existing.id === item.id);
  if (index < 0) return [...list, item];
  return list.map(existing => existing.id === item.id ? { ...existing, ...item } : existing);
}

function fileEntry(spec, fileName) {
  return spec.files.find(file => file.fileName === fileName);
}

function mappingContentFingerprint(spec) {
  const copy = clone(spec);
  copy.mappingRevision = 0;
  return mappingFingerprint(copy);
}

function entityEntry(spec, type, sourceFile, groupId) {
  const list = type === "vertex" ? spec.entities.vertices : spec.entities.hyperedges;
  return list.find(entity => entity.sourceFile === sourceFile)
    ?? list.find(entity => entity.groupId === groupId)
    ?? null;
}

export function describeMappingPatchOperation(operation) {
  switch (operation.type) {
    case "SET_PARSE_MODE": return `Parse mode set to ${operation.value}.`;
    case "CREATE_GROUP": return `Created group ${operation.groupId}.`;
    case "RENAME_GROUP": return `Renamed group ${operation.groupId} to ${operation.groupLabel}.`;
    case "MOVE_FILE_TO_GROUP": return `Moved ${operation.fileName} to ${operation.groupId}.`;
    case "SET_FILE_ROLE": return `${operation.fileName} role -> ${operation.role}.`;
    case "SET_FILE_INPUT_USAGE": return `${operation.fileName} parser input -> ${operation.useAsInput}.`;
    case "SET_FILE_KEY_COLUMNS": return `${operation.fileName} key columns -> ${(operation.keyColumns ?? []).join(" + ")}.`;
    case "SET_FILE_LIST_COLUMN": return `Split ${operation.fileName}.${operation.listColumn} on ${operation.listDelimiter}.`;
    case "SET_VERTEX_ENTITY_RULE": return `Vertex entity uses ${operation.sourceFile}.${(operation.keyColumns ?? []).join(" + ")}.`;
    case "SET_HYPEREDGE_ENTITY_RULE": return `Hyperedge entity uses ${operation.sourceFile}.${(operation.keyColumns ?? []).join(" + ")}.`;
    case "ADD_RELATIONSHIP": return `Added relationship ${operation.sourceFile}.${(operation.sourceColumns ?? []).join("+")} -> ${operation.targetFile}.${(operation.targetColumns ?? []).join("+")}.`;
    case "UPDATE_RELATIONSHIP": return `Updated relationship ${operation.relationship?.id ?? operation.value ?? "selected"}.`;
    case "SET_POLICY": return `Policy ${operation.policy} -> ${operation.value}.`;
    case "MARK_VALIDATION_FILE": return `${operation.fileName} marked validation only.`;
    case "MARK_UPDATE_STREAM": return `${operation.fileName} marked update stream and excluded from static parsing.`;
    case "IGNORE_FILE": return `${operation.fileName} ignored.`;
    default: return `${operation.type} applied.`;
  }
}

export function applyDatasetMappingPatch(spec, patchDraft, {
  fileProfiles = [],
  source = "deterministic_nlu",
  history = [],
  limit = 20,
} = {}) {
  const next = clone(spec);
  const operations = patchDraft.operations ?? [];
  for (const operation of operations) {
    if (operation.type === "SET_PARSE_MODE") next.parseMode = operation.value;
    if (operation.type === "CREATE_GROUP") {
      next.groups = upsertById(next.groups, {
        id: operation.groupId,
        label: operation.groupLabel ?? operation.groupId,
        kind: "static_graph",
        fileNames: [],
        confidence: 0.7,
        summary: "Created by mapping patch.",
        status: "draft",
        evidenceIds: [],
        warnings: [],
      });
    }
    if (operation.type === "RENAME_GROUP") next.groups = next.groups.map(group => group.id === operation.groupId ? { ...group, label: operation.groupLabel } : group);
    if (operation.type === "MOVE_FILE_TO_GROUP") {
      const file = fileEntry(next, operation.fileName);
      if (file) file.groupId = operation.groupId;
      next.groups = next.groups.map(group => ({
        ...group,
        fileNames: group.id === operation.groupId
          ? [...new Set([...(group.fileNames ?? []), operation.fileName])]
          : (group.fileNames ?? []).filter(fileName => fileName !== operation.fileName),
      }));
    }
    if (operation.type === "SET_FILE_ROLE") {
      const file = fileEntry(next, operation.fileName);
      if (file) file.role = operation.role;
    }
    if (operation.type === "SET_FILE_INPUT_USAGE") {
      const file = fileEntry(next, operation.fileName);
      if (file) file.useAsInput = Boolean(operation.useAsInput);
    }
    if (operation.type === "SET_FILE_KEY_COLUMNS") {
      const file = fileEntry(next, operation.fileName);
      if (file) file.keyColumns = operation.keyColumns ?? [];
    }
    if (operation.type === "SET_FILE_LIST_COLUMN") {
      const file = fileEntry(next, operation.fileName);
      if (file) file.listColumns = [{ column: operation.listColumn, delimiter: operation.listDelimiter ?? ";", trim: true }];
    }
    if (operation.type === "SET_VERTEX_ENTITY_RULE") {
      const existing = entityEntry(next, "vertex", operation.sourceFile, operation.groupId);
      next.entities.vertices = upsertById(next.entities.vertices ?? [], {
        id: existing?.id ?? `vertex-${operation.groupId ?? "group"}`,
        groupId: operation.groupId,
        entityType: "vertex",
        sourceFile: operation.sourceFile,
        keyColumns: operation.keyColumns ?? [],
        labelColumn: operation.labelColumn ?? null,
        namespace: null,
        attributes: operation.attributes ?? [],
        retainUnmatched: false,
      });
    }
    if (operation.type === "SET_HYPEREDGE_ENTITY_RULE") {
      const existing = entityEntry(next, "hyperedge", operation.sourceFile, operation.groupId);
      next.entities.hyperedges = upsertById(next.entities.hyperedges ?? [], {
        id: existing?.id ?? `hyperedge-${operation.groupId ?? "group"}`,
        groupId: operation.groupId,
        entityType: "hyperedge",
        sourceFile: operation.sourceFile,
        keyColumns: operation.keyColumns ?? [],
        labelColumn: operation.labelColumn ?? null,
        namespace: null,
        timeColumn: operation.timeColumn ?? null,
        weightColumn: operation.weightColumn ?? null,
        attributes: operation.attributes ?? [],
        retainUnmatched: next.policies?.unmatchedHyperedgeRows === "preserve_empty",
      });
    }
    if (operation.type === "ADD_RELATIONSHIP") {
      next.relationships = upsertById(next.relationships ?? [], operation.relationship ?? {
        id: `relationship-${(next.relationships?.length ?? 0) + 1}`,
        groupId: operation.groupId,
        type: "membership",
        sourceFile: operation.sourceFile,
        sourceColumns: operation.sourceColumns ?? [],
        targetFile: operation.targetFile,
        targetColumns: operation.targetColumns ?? [],
        vertexSourceFile: operation.vertexSourceFile ?? operation.sourceFile,
        vertexColumns: operation.vertexColumns ?? [],
        cardinality: "many_to_one",
        joinType: "left",
        confidence: 0.8,
        evidenceIds: [],
      });
    }
    if (operation.type === "UPDATE_RELATIONSHIP" && operation.relationship) next.relationships = upsertById(next.relationships ?? [], operation.relationship);
    if (operation.type === "REMOVE_RELATIONSHIP") next.relationships = (next.relationships ?? []).filter(rel => rel.id !== operation.value);
    if (operation.type === "ADD_FILTER" && operation.filter) next.filters = upsertById(next.filters ?? [], operation.filter);
    if (operation.type === "UPDATE_FILTER" && operation.filter) next.filters = upsertById(next.filters ?? [], operation.filter);
    if (operation.type === "REMOVE_FILTER") next.filters = (next.filters ?? []).filter(filter => filter.id !== operation.value);
    if (operation.type === "SET_POLICY") {
      next.policies = { ...next.policies, [operation.policy]: operation.value };
      if (operation.policy === "unmatchedHyperedgeRows") {
        next.entities.hyperedges = (next.entities.hyperedges ?? []).map(entity => ({
          ...entity,
          retainUnmatched: operation.value === "preserve_empty",
        }));
      }
    }
    if (operation.type === "MARK_VALIDATION_FILE" || operation.type === "MARK_UPDATE_STREAM" || operation.type === "IGNORE_FILE") {
      const file = fileEntry(next, operation.fileName);
      if (file) {
        file.role = operation.type === "MARK_VALIDATION_FILE" ? "validation_expected_output" : operation.type === "MARK_UPDATE_STREAM" ? "update_stream" : "ignored";
        file.useAsInput = false;
      }
    }
    if (operation.type === "ADD_ASSUMPTION") next.assumptions = [...new Set([...(next.assumptions ?? []), operation.assumption])].filter(Boolean);
    if (operation.type === "REMOVE_ASSUMPTION") next.assumptions = (next.assumptions ?? []).filter(item => item !== operation.assumption);
  }
  const previousFingerprint = mappingFingerprint(spec);
  const previousContentFingerprint = mappingContentFingerprint(spec);
  const nextContentFingerprint = mappingContentFingerprint(next);
  if (previousContentFingerprint === nextContentFingerprint) {
    const validation = validateDatasetMappingSpecV2(spec, { fileProfiles });
    if (!validation.ok) return { ok: false, spec, errors: validation.errors, validation };
    return {
      ok: true,
      noChange: true,
      spec: validation.spec,
      validation,
      diff: [],
      history,
      historyEntry: null,
    };
  }
  next.mappingRevision = (Number(spec.mappingRevision) || 0) + 1;
  const nextFingerprint = mappingFingerprint(next);
  const validation = validateDatasetMappingSpecV2(next, { fileProfiles });
  if (!validation.ok) return { ok: false, spec, errors: validation.errors, validation };
  const historyEntry = {
    revision: next.mappingRevision,
    previousFingerprint,
    nextFingerprint,
    patchSummary: patchDraft.summary ?? operations.map(describeMappingPatchOperation).join(" "),
    operations,
    source,
    createdAt: new Date().toISOString(),
  };
  return {
    ok: true,
    spec: validation.spec,
    validation,
    diff: operations.map(describeMappingPatchOperation),
    history: [...history, historyEntry].slice(-limit),
    historyEntry,
  };
}
