import { isExpectedOutputFileName } from "./datasetMappingSpec.js";
import {
  createDatasetMappingSpecV2,
  defaultIdRule,
} from "./datasetMappingSpecV2.js";

function v1RoleToV2(role) {
  if (role === "vertex_list") return "vertex_table";
  return role ?? "unknown";
}

function columnsArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
}

function groupFromV1(spec) {
  return {
    id: "group-main",
    label: spec.datasetType?.replaceAll("_", " ") || "Imported mapping",
    kind: "static_graph",
    fileNames: (spec.files ?? []).filter(file => file.useAsInput).map(file => file.fileName),
    confidence: spec.confidence ?? 0.5,
    summary: spec.summary ?? "Migrated v1 mapping.",
    status: "draft",
    evidenceIds: [],
    warnings: [],
  };
}

export function migrateDatasetMappingSpecV1ToV2(spec, {
  batchId = "",
  batchVersion = 1,
  groupingRevision = 0,
  mappingRevision = 0,
} = {}) {
  if (!spec || typeof spec !== "object") return { ok: false, spec: null, notes: [], errors: ["Mapping spec must be an object."] };
  if (spec.version === 2) return { ok: true, spec, notes: ["Mapping spec is already version 2."], errors: [] };
  if (spec.version !== 1) return { ok: false, spec: null, notes: [], errors: [`Unsupported mapping spec version: ${spec.version ?? "(missing)"}.`] };
  const group = groupFromV1(spec);
  const files = (spec.files ?? []).map(file => ({
    fileName: file.fileName,
    groupId: file.role === "validation_expected_output" || isExpectedOutputFileName(file.fileName) ? null : group.id,
    role: isExpectedOutputFileName(file.fileName) ? "validation_expected_output" : v1RoleToV2(file.role),
    useAsInput: file.role === "validation_expected_output" || isExpectedOutputFileName(file.fileName) ? false : Boolean(file.useAsInput),
    delimiter: null,
    hasHeader: true,
    keyColumns: columnsArray(file.primaryKey ?? file.columns?.hyperedgeId),
    columns: {
      hyperedgeId: file.columns?.hyperedgeId ?? null,
      vertexId: file.columns?.vertexId ?? null,
      source: file.columns?.source ?? null,
      target: file.columns?.target ?? null,
      time: file.columns?.time ?? null,
      weight: file.columns?.weight ?? null,
      label: null,
      attributes: file.columns?.attributes ?? [],
    },
    listColumns: [],
  }));
  const membership = files.find(file => ["membership", "incidence"].includes(file.role));
  const hyperedgeMeta = files.find(file => file.role === "hyperedge_metadata");
  const relationships = [];
  if (membership) {
    relationships.push({
      id: "relationship-membership",
      groupId: group.id,
      type: "membership",
      sourceFile: membership.fileName,
      sourceColumns: columnsArray(membership.columns.hyperedgeId),
      targetFile: hyperedgeMeta?.fileName ?? membership.fileName,
      targetColumns: columnsArray(hyperedgeMeta?.keyColumns?.[0] ?? membership.columns.hyperedgeId),
      vertexSourceFile: membership.fileName,
      vertexColumns: columnsArray(membership.columns.vertexId),
      cardinality: "many_to_one",
      joinType: hyperedgeMeta ? "left" : "inner",
      confidence: spec.confidence ?? 0.75,
      evidenceIds: [],
    });
  }
  const entities = {
    vertices: membership?.columns.vertexId ? [{
      id: "vertex-members",
      groupId: group.id,
      entityType: "vertex",
      sourceFile: membership.fileName,
      keyColumns: [membership.columns.vertexId],
      labelColumn: null,
      namespace: null,
      idRule: defaultIdRule(),
      attributes: [],
      retainUnmatched: false,
    }] : [],
    hyperedges: (spec.output?.hyperedgeId?.column || membership?.columns.hyperedgeId) ? [{
      id: "hyperedge-groups",
      groupId: group.id,
      entityType: "hyperedge",
      sourceFile: spec.output?.hyperedgeId?.sourceFile ?? hyperedgeMeta?.fileName ?? membership?.fileName ?? files.find(file => file.useAsInput)?.fileName,
      keyColumns: [spec.output?.hyperedgeId?.column ?? hyperedgeMeta?.keyColumns?.[0] ?? membership?.columns.hyperedgeId].filter(Boolean),
      labelColumn: null,
      namespace: null,
      idRule: defaultIdRule(),
      timeColumn: spec.output?.time?.column ?? null,
      weightColumn: spec.output?.weight?.column ?? null,
      attributes: spec.output?.attributes?.flatMap(rule => rule.columns ?? []) ?? [],
      retainUnmatched: false,
    }] : [],
  };
  return {
    ok: true,
    spec: createDatasetMappingSpecV2({
      batchId,
      batchVersion,
      groupingRevision,
      mappingRevision,
      datasetType: spec.datasetType ?? "unknown",
      parseMode: spec.parseMode === "unknown" ? "unknown" : spec.parseMode,
      confidence: spec.confidence ?? 0.5,
      summary: `${spec.summary ?? "Migrated mapping."} (Migrated from DatasetMappingSpec v1.)`,
      activeGroupId: group.id,
      groups: [group],
      files,
      entities,
      relationships,
      warnings: spec.warnings ?? [],
      questionsForUser: spec.questionsForUser ?? [],
      assumptions: [...(spec.assumptions ?? []), "DatasetMappingSpec v1 migrated to v2 in memory."],
    }),
    notes: ["Migrated DatasetMappingSpec v1 to v2.", "Legacy vertex_list roles are mapped to vertex_table."],
    errors: [],
  };
}

export function ensureDatasetMappingSpecV2(spec, context = {}) {
  if (spec?.version === 2) return { ok: true, spec, notes: [], errors: [] };
  return migrateDatasetMappingSpecV1ToV2(spec, context);
}
