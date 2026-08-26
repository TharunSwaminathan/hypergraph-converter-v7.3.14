import { mappingFingerprint } from "./datasetMappingSpecV2.js";
import { ensureDatasetMappingSpecV2 } from "./datasetMappingMigration.js";
import { stablePlanFingerprint } from "./transformationPlanFingerprint.js";

export const TRANSFORMATION_STEP_TYPES = Object.freeze([
  "READ_FILE",
  "PARSE_DELIMITED",
  "PARSE_MATRIX_MARKET",
  "FILTER_ROWS",
  "NORMALIZE_ID",
  "BUILD_LOOKUP",
  "JOIN_ROWS",
  "SPLIT_LIST",
  "GROUP_MEMBERSHIP",
  "BUILD_EDGE_HYPEREDGES",
  "ATTACH_HYPEREDGE_METADATA",
  "DEDUPLICATE_MEMBERSHIP",
  "PRESERVE_EMPTY_HYPEREDGES",
  "EMIT_CANONICAL",
  "COMPARE_EXPECTED_OUTPUT",
]);

function idColumns(columns) {
  return (columns ?? []).filter(Boolean);
}

export function buildTransformationPlanFromMapping(mappingSpec, {
  groupId = null,
  expectedOutputFile = null,
} = {}) {
  const migrated = ensureDatasetMappingSpecV2(mappingSpec);
  if (!migrated.ok) return { ok: false, error: migrated.errors.join(" "), migration: migrated };
  const spec = migrated.spec;
  const activeGroupId = groupId ?? spec.activeGroupId ?? spec.groups?.find(group => group.kind === "static_graph")?.id;
  const files = (spec.files ?? []).filter(file => file.useAsInput && (!activeGroupId || file.groupId === activeGroupId || ["lookup", "validation_expected_output"].includes(file.role)));
  const relationships = (spec.relationships ?? []).filter(rel => !activeGroupId || rel.groupId === activeGroupId);
  const membership = relationships.find(rel => rel.type === "membership");
  const edgeList = files.find(file => file.role === "edge_list");
  const h2v = files.find(file => file.role === "hyperedge_list");
  const matrix = files.find(file => file.role === "matrix_coordinate_list");
  const filters = (spec.filters ?? []).filter(filter => !activeGroupId || filter.groupId === activeGroupId);
  const steps = [];
  for (const file of files) {
    steps.push({ id: `read-${file.fileName}`, type: "READ_FILE", fileName: file.fileName });
    steps.push({
      id: `parse-${file.fileName}`,
      type: file.role === "matrix_coordinate_list" ? "PARSE_MATRIX_MARKET" : "PARSE_DELIMITED",
      fileName: file.fileName,
      delimiter: file.delimiter,
      hasHeader: file.hasHeader,
    });
  }
  for (const filter of filters) steps.push({ id: `filter-${filter.id}`, type: "FILTER_ROWS", ...filter });
  if (membership) {
    const hyperedgeEntity = spec.entities?.hyperedges?.find(entity => entity.groupId === activeGroupId);
    const vertexEntity = spec.entities?.vertices?.find(entity => entity.groupId === activeGroupId);
    if (hyperedgeEntity && hyperedgeEntity.sourceFile !== membership.sourceFile) {
      steps.push({
        id: `lookup-${hyperedgeEntity.sourceFile}`,
        type: "BUILD_LOOKUP",
        fileName: hyperedgeEntity.sourceFile,
        keyColumns: hyperedgeEntity.keyColumns,
      });
      steps.push({
        id: `join-${membership.id}`,
        type: "JOIN_ROWS",
        sourceFile: membership.sourceFile,
        sourceColumns: membership.sourceColumns,
        targetFile: membership.targetFile,
        targetColumns: membership.targetColumns,
        joinType: membership.joinType,
      });
    }
    const membershipFile = files.find(file => file.fileName === membership.sourceFile);
    for (const listRule of membershipFile?.listColumns ?? []) {
      steps.push({ id: `split-${membership.sourceFile}-${listRule.column}`, type: "SPLIT_LIST", fileName: membership.sourceFile, column: listRule.column, delimiter: listRule.delimiter ?? ";" });
    }
    steps.push({
      id: `group-${membership.id}`,
      type: "GROUP_MEMBERSHIP",
      sourceFile: membership.sourceFile,
      hyperedgeColumns: idColumns(membership.sourceColumns),
      vertexColumns: idColumns(membership.vertexColumns),
      hyperedgeEntity,
      vertexEntity,
      missingReferencePolicy: spec.policies?.missingVertexReference ?? "warn_use_raw_id",
    });
    steps.push({ id: "deduplicate-membership", type: "DEDUPLICATE_MEMBERSHIP" });
    if (spec.policies?.unmatchedHyperedgeRows === "preserve_empty" || spec.policies?.emptyHyperedges === "keep" || hyperedgeEntity?.retainUnmatched) {
      steps.push({ id: "preserve-empty-hyperedges", type: "PRESERVE_EMPTY_HYPEREDGES", sourceFile: hyperedgeEntity?.sourceFile, keyColumns: hyperedgeEntity?.keyColumns ?? membership.sourceColumns });
    }
  } else if (edgeList) {
    steps.push({ id: "build-edge-hyperedges", type: "BUILD_EDGE_HYPEREDGES", fileName: edgeList.fileName, sourceColumn: edgeList.columns?.source, targetColumn: edgeList.columns?.target });
  } else if (h2v) {
    steps.push({ id: "group-h2v", type: "GROUP_MEMBERSHIP", sourceFile: h2v.fileName, hyperedgeColumns: [h2v.columns?.hyperedgeId ?? "id"], vertexColumns: [h2v.columns?.vertexId ?? "vertices"], h2v: true });
  } else if (matrix) {
    steps.push({ id: "matrix-membership", type: "GROUP_MEMBERSHIP", sourceFile: matrix.fileName, hyperedgeColumns: ["rowIndex", "columnIndex"], vertexColumns: ["rowIndex", "columnIndex"], matrix: true });
  }
  steps.push({ id: "emit-canonical", type: "EMIT_CANONICAL" });
  if (expectedOutputFile) steps.push({ id: "compare-expected-output", type: "COMPARE_EXPECTED_OUTPUT", fileName: expectedOutputFile });
  const base = {
    version: 1,
    batchId: spec.batchId,
    batchVersion: spec.batchVersion,
    groupId: activeGroupId,
    groupingRevision: spec.groupingRevision,
    mappingRevision: spec.mappingRevision,
    mappingFingerprint: mappingFingerprint(spec),
    steps,
    expectedInputs: files.map(file => ({ fileName: file.fileName, role: file.role })),
    expectedOutput: "canonicalHyperedges",
    warnings: migrated.notes ?? [],
    assumptions: spec.assumptions ?? [],
  };
  return { ok: true, plan: { ...base, planFingerprint: stablePlanFingerprint(base) } };
}

export function describeTransformationPlan(plan) {
  return (plan?.steps ?? []).map((step, index) => {
    const prefix = `${index + 1}.`;
    if (step.type === "READ_FILE") return `${prefix} Read ${step.fileName}.`;
    if (step.type === "PARSE_DELIMITED") return `${prefix} Parse ${step.fileName} as delimited text.`;
    if (step.type === "BUILD_LOOKUP") return `${prefix} Build lookup for ${step.fileName} using ${(step.keyColumns ?? []).join(" + ")}.`;
    if (step.type === "JOIN_ROWS") return `${prefix} Join ${step.sourceFile}.${(step.sourceColumns ?? []).join("+")} to ${step.targetFile}.${(step.targetColumns ?? []).join("+")}.`;
    if (step.type === "SPLIT_LIST") return `${prefix} Split ${step.fileName}.${step.column} on ${step.delimiter}.`;
    if (step.type === "GROUP_MEMBERSHIP") return `${prefix} Group ${(step.vertexColumns ?? []).join(" + ")} memberships by ${(step.hyperedgeColumns ?? []).join(" + ")}.`;
    if (step.type === "PRESERVE_EMPTY_HYPEREDGES") return `${prefix} Preserve unmatched hyperedge rows as empty hyperedges.`;
    if (step.type === "BUILD_EDGE_HYPEREDGES") return `${prefix} Convert edge-list rows into size-2 hyperedges.`;
    if (step.type === "EMIT_CANONICAL") return `${prefix} Emit canonical hyperedges.`;
    return `${prefix} ${step.type.replaceAll("_", " ").toLowerCase()}.`;
  });
}
