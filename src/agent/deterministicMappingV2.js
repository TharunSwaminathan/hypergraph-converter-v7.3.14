import { roleGuessesForProfile } from "./datasetGrouping.js";
import { createDatasetMappingSpecV2, defaultIdRule } from "./datasetMappingSpecV2.js";

const HYPEREDGE_ID = /(paper|event|project|session|group|hyperedge|edge)_?id$|^id$/i;
const VERTEX_ID = /(author|participant|user|person|vertex|node|member)_?id$|^id$/i;
const LABEL = /^(name|title|label|event_name|paper_title)$/i;
const TIME = /^(time|timestamp|date|year)$/i;
const WEIGHT = /^(weight|score|value|severity)$/i;

function bestColumn(file, matcher, fallback = null) {
  return (file?.columns ?? []).find(column => matcher.test(column.name))?.name
    ?? fallback
    ?? file?.candidateKeys?.[0]?.columns?.[0]
    ?? file?.columns?.find(column => column.idLike)?.name
    ?? file?.columns?.[0]?.name
    ?? null;
}

function columnNames(file) {
  return (file?.columns ?? []).map(column => column.name);
}

function keyColumnsFor(file, role) {
  if (role === "vertex_table") return file.candidateKeys?.[0]?.columns ?? [bestColumn(file, VERTEX_ID)].filter(Boolean);
  if (role === "hyperedge_table") return file.candidateKeys?.[0]?.columns ?? [bestColumn(file, HYPEREDGE_ID)].filter(Boolean);
  return file.candidateKeys?.[0]?.columns ?? [];
}

function columnsFor(file, role) {
  const names = columnNames(file);
  const attributes = names
    .filter(name => ![bestColumn(file, HYPEREDGE_ID), bestColumn(file, VERTEX_ID), bestColumn(file, TIME), bestColumn(file, WEIGHT)].includes(name))
    .slice(0, 8);
  if (role === "edge_list") {
    return {
      source: names.find(name => /^(source|src|from)$/i.test(name)) ?? names[0] ?? null,
      target: names.find(name => /^(target|dst|to)$/i.test(name)) ?? names[1] ?? null,
      time: bestColumn(file, TIME),
      weight: bestColumn(file, WEIGHT),
      attributes,
    };
  }
  return {
    hyperedgeId: bestColumn(file, HYPEREDGE_ID),
    vertexId: bestColumn(file, VERTEX_ID),
    source: null,
    target: null,
    time: bestColumn(file, TIME),
    weight: bestColumn(file, WEIGHT),
    label: (file.columns ?? []).find(column => LABEL.test(column.name))?.name ?? null,
    attributes,
  };
}

function fileMapping(file, role, groupId) {
  return {
    fileName: file.fileName,
    groupId: ["validation_expected_output", "update_stream", "ignored"].includes(role) ? null : groupId,
    role,
    useAsInput: !["validation_expected_output", "update_stream", "ignored", "unknown"].includes(role),
    delimiter: file.delimiter,
    hasHeader: file.hasHeader,
    keyColumns: keyColumnsFor(file, role),
    columns: columnsFor(file, role),
    listColumns: (file.listLikeColumns ?? []).map(column => ({
      column: column.column,
      delimiter: column.delimiter,
      mode: "membership_vertices",
    })),
  };
}

function chooseRelationshipEvidence(relationshipEvidence, sourceFile, targetFile, sourceColumns = null) {
  const sourceSet = new Set(sourceColumns ?? []);
  return relationshipEvidence
    .filter(evidence => {
      const forward = evidence.leftFile === sourceFile && evidence.rightFile === targetFile;
      const reverse = evidence.rightFile === sourceFile && evidence.leftFile === targetFile;
      if (!forward && !reverse) return false;
      if (!sourceSet.size) return true;
      const columns = forward ? evidence.leftColumns : evidence.rightColumns;
      return columns.some(column => sourceSet.has(column));
    })
    .sort((left, right) => right.confidence - left.confidence)[0] ?? null;
}

function makeEntity(id, type, file, role, groupId) {
  const keyColumns = keyColumnsFor(file, role);
  if (!keyColumns.length) return null;
  return {
    id,
    groupId,
    entityType: type,
    sourceFile: file.fileName,
    keyColumns,
    labelColumn: (file.columns ?? []).find(column => LABEL.test(column.name))?.name ?? null,
    namespace: type,
    idRule: defaultIdRule({ includeColumns: keyColumns }),
    timeColumn: bestColumn(file, TIME),
    weightColumn: bestColumn(file, WEIGHT),
    attributes: columnNames(file).filter(name => !keyColumns.includes(name)).slice(0, 8),
    retainUnmatched: false,
  };
}

export function buildDatasetMappingSpecV2FromProfile({
  batchId = "",
  batchVersion = 1,
  mappingRevision = 0,
  datasetProfile,
  relationshipEvidence = [],
  groupingDraft,
  groupingRevision = 0,
} = {}) {
  const files = datasetProfile?.files ?? [];
  const roleGuesses = roleGuessesForProfile(datasetProfile);
  const staticGroup = (groupingDraft?.groups ?? []).find(group => group.kind === "static_graph") ?? {
    id: "group-main",
    label: "Static hypergraph dataset",
    kind: "static_graph",
    fileNames: files.map(file => file.fileName),
    confidence: 0.5,
    summary: "Deterministic mapping draft.",
    status: "draft",
    evidenceIds: [],
    warnings: [],
  };
  const groupId = staticGroup.id;
  const mappedFiles = files.map(file => fileMapping(file, roleGuesses[file.fileName] ?? "unknown", groupId));
  const membershipFile = files.find(file => roleGuesses[file.fileName] === "membership")
    ?? files.find(file => roleGuesses[file.fileName] === "incidence");
  const edgeListFile = files.find(file => roleGuesses[file.fileName] === "edge_list");
  const hyperedgeTable = files.find(file => roleGuesses[file.fileName] === "hyperedge_table");
  const vertexTable = files.find(file => roleGuesses[file.fileName] === "vertex_table");
  const entities = {
    vertices: [],
    hyperedges: [],
  };
  if (vertexTable) entities.vertices.push(makeEntity("vertices-main", "vertex", vertexTable, "vertex_table", groupId));
  if (hyperedgeTable) entities.hyperedges.push(makeEntity("hyperedges-main", "hyperedge", hyperedgeTable, "hyperedge_table", groupId));
  if (membershipFile && !entities.vertices.length) {
    const columns = columnsFor(membershipFile, "membership");
    if (columns.vertexId) entities.vertices.push({
      id: "vertices-from-membership",
      groupId,
      entityType: "vertex",
      sourceFile: membershipFile.fileName,
      keyColumns: [columns.vertexId],
      labelColumn: null,
      namespace: "vertex",
      idRule: defaultIdRule({ includeColumns: [columns.vertexId] }),
      attributes: [],
      retainUnmatched: false,
    });
  }
  if (membershipFile && !entities.hyperedges.length) {
    const columns = columnsFor(membershipFile, "membership");
    if (columns.hyperedgeId) entities.hyperedges.push({
      id: "hyperedges-from-membership",
      groupId,
      entityType: "hyperedge",
      sourceFile: membershipFile.fileName,
      keyColumns: [columns.hyperedgeId],
      labelColumn: null,
      namespace: "hyperedge",
      idRule: defaultIdRule({ includeColumns: [columns.hyperedgeId] }),
      timeColumn: columns.time,
      weightColumn: columns.weight,
      attributes: [],
      retainUnmatched: false,
    });
  }
  const relationships = [];
  if (membershipFile) {
    const membershipMap = mappedFiles.find(file => file.fileName === membershipFile.fileName);
    const hyperedgeColumns = [membershipMap?.columns?.hyperedgeId].filter(Boolean);
    const vertexColumns = [membershipMap?.columns?.vertexId].filter(Boolean);
    const targetEntity = entities.hyperedges[0];
    const evidence = targetEntity
      ? chooseRelationshipEvidence(relationshipEvidence, membershipFile.fileName, targetEntity.sourceFile, hyperedgeColumns)
      : null;
    relationships.push({
      id: "relationship-membership-main",
      groupId,
      type: "membership",
      sourceFile: membershipFile.fileName,
      sourceColumns: hyperedgeColumns,
      targetFile: targetEntity?.sourceFile ?? membershipFile.fileName,
      targetColumns: targetEntity?.keyColumns ?? hyperedgeColumns,
      vertexSourceFile: membershipFile.fileName,
      vertexColumns,
      cardinality: evidence?.likelyCardinality ?? "many_to_one",
      joinType: targetEntity?.sourceFile && targetEntity.sourceFile !== membershipFile.fileName ? "left" : "inner",
      confidence: evidence?.confidence ?? 0.78,
      evidenceIds: evidence?.id ? [evidence.id] : [],
    });
  }
  const datasetType = membershipFile
    ? (files.length > 1 ? "multi_file_hypergraph" : "single_file_hypergraph")
    : edgeListFile ? "single_file_graph_edges" : "unknown";
  const assumptions = ["Generated deterministically from bounded DatasetProfile evidence."];
  const warnings = [
    ...(groupingDraft?.groups ?? []).flatMap(group => group.warnings ?? []),
    ...mappedFiles.filter(file => file.role === "update_stream").map(file => `${file.fileName} is an update stream and is excluded from static parsing in v7.3.0.`),
  ];
  const questions = groupingDraft?.questions?.map(question => question.question) ?? [];
  return createDatasetMappingSpecV2({
    batchId,
    batchVersion,
    groupingRevision,
    mappingRevision,
    datasetType,
    parseMode: groupingDraft?.parseMode ?? (files.length > 1 ? "grouped" : "together"),
    confidence: membershipFile ? 0.86 : edgeListFile ? 0.8 : 0.45,
    summary: membershipFile
      ? "Deterministic v2 mapping groups membership rows into canonical hyperedges."
      : edgeListFile ? "Deterministic v2 mapping converts graph edges to size-2 hyperedges." : "Mapping draft needs clarification before parser generation.",
    activeGroupId: groupId,
    groups: groupingDraft?.groups ?? [staticGroup],
    files: mappedFiles,
    entities: {
      vertices: entities.vertices.filter(Boolean),
      hyperedges: entities.hyperedges.filter(Boolean),
    },
    relationships,
    filters: [],
    evidence: relationshipEvidence.slice(0, 20).map(evidence => ({
      id: evidence.id,
      leftFile: evidence.leftFile,
      leftColumns: evidence.leftColumns,
      rightFile: evidence.rightFile,
      rightColumns: evidence.rightColumns,
      confidence: evidence.confidence,
    })),
    warnings,
    questionsForUser: questions,
    assumptions,
  });
}

export function buildDatasetMappingSpecV2FromBatch(batch, options = {}) {
  return buildDatasetMappingSpecV2FromProfile({
    batchId: batch?.id ?? "",
    batchVersion: batch?.version ?? 1,
    mappingRevision: batch?.mappingRevision ?? 0,
    datasetProfile: batch?.datasetProfile,
    relationshipEvidence: batch?.relationshipEvidence ?? [],
    groupingDraft: {
      groups: batch?.datasetGroups ?? [],
      parseMode: batch?.parseMode,
      questions: batch?.groupingQuestions ?? [],
    },
    groupingRevision: batch?.groupingRevision ?? 0,
    ...options,
  });
}
