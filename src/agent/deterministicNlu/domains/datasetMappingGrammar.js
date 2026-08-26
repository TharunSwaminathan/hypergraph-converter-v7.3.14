import { DATASET_MAPPING_PATCH_TASK } from "../../datasetMappingPatchSchema.js";
import {
  buildDatasetMappingReferenceContext,
  fileRoleFromDesiredOrSpec,
  resolveColumnReference,
  resolveFileReference,
  resolveRoleFileFromMapping,
} from "../../datasetMappingReferenceResolver.js";
import { DOMAIN_LEXICON, roleFromAlias } from "../domainLexicon.js";
import { hasNegatedTerm } from "../negationResolver.js";

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function basename(fileName = "") {
  return String(fileName).split(/[\\/]/).pop().replace(/\.[^.]+$/, "");
}

function singular(value = "") {
  return value.endsWith("s") && value.length > 2 ? value.slice(0, -1) : value;
}

function aliasesForFile(fileName) {
  const base = basename(fileName);
  return [...new Set([
    fileName,
    String(fileName).split(/[\\/]/).pop(),
    base,
    base.toLowerCase(),
    singular(base.toLowerCase()),
    base.replace(/[_-]+/g, " "),
    singular(base.replace(/[_-]+/g, " ").toLowerCase()),
  ].filter(Boolean))].sort((a, b) => b.length - a.length);
}

function containsAlias(text = "", alias = "") {
  const pattern = escapeRegExp(alias).replace(/\\ /g, "[\\s_-]+");
  return new RegExp(`(^|[^A-Za-z0-9_])${pattern}([^A-Za-z0-9_]|$)`, "i").test(String(text ?? ""));
}

function addOperation(operations, operation) {
  const key = JSON.stringify(operation);
  if (!operations.some(existing => JSON.stringify(existing) === key)) operations.push(operation);
}

function mappingFile(spec = {}, fileName) {
  return (spec.files ?? []).find(file => file.fileName === fileName) ?? null;
}

function entityForFile(spec = {}, type, fileName) {
  const list = type === "vertex" ? spec.entities?.vertices : spec.entities?.hyperedges;
  return (list ?? []).find(entity => entity.sourceFile === fileName) ?? null;
}

function chooseGroupId(mappingSpec = {}, fileName = null) {
  const file = mappingFile(mappingSpec, fileName);
  return file?.groupId
    ?? mappingSpec.activeGroupId
    ?? mappingSpec.groups?.find(group => group.kind === "static_graph")?.id
    ?? mappingSpec.groups?.[0]?.id
    ?? "group-main";
}

function humanRolePurpose(role) {
  if (role === "vertex_table") return "identify vertices";
  if (role === "hyperedge_table") return "identify hyperedges";
  if (role === "membership") return "identify memberships";
  return "identify records";
}

function patchDraft(classification, summary, operations = [], clarificationQuestion = null, confidence = "high") {
  return {
    task: DATASET_MAPPING_PATCH_TASK,
    classification,
    summary,
    operations,
    clarificationQuestion,
    confidence,
  };
}

function resolveFileTerm(term, context, purpose) {
  return resolveFileReference(term, context, { purpose });
}

function resolveColumnTerm(fileName, term, context, purpose) {
  return resolveColumnReference(fileName, term, context, { purpose });
}

function roleFromFileName(fileName = "") {
  const name = basename(fileName).toLowerCase();
  if (/expected|validation|truth|gold|reference/.test(name)) return "validation_expected_output";
  if (/updates?|changes?|deltas?|stream/.test(name)) return "update_stream";
  if (/authorship|membership|incidence|participant|enrollment|link/.test(name)) return "membership";
  if (/authors?|users?|people|vertices|nodes/.test(name)) return "vertex_table";
  if (/papers?|publications?|events?|groups?|hyperedges?|projects?/.test(name)) return "hyperedge_table";
  return null;
}

function roleFromLocalWindow(text, fileName) {
  const lower = String(text ?? "").toLowerCase();
  const roleAliases = DOMAIN_LEXICON.datasetRoles.flatMap(entry => entry.aliases.map(alias => ({
    canonical: entry.canonical,
    alias,
  }))).sort((a, b) => b.alias.length - a.alias.length);
  for (const alias of aliasesForFile(fileName)) {
    const aliasPattern = escapeRegExp(alias.toLowerCase()).replace(/\\ /g, "[\\s_-]+");
    for (const { canonical, alias: roleAlias } of roleAliases) {
      const rolePattern = escapeRegExp(roleAlias.toLowerCase()).replace(/\\ /g, "[\\s_-]+");
      // Require an explicit grammatical connector. This prevents a phrase such as
      // "vertices, papers" from assigning the vertex role to papers merely because
      // the role word appears immediately before a comma-delimited file name.
      const fileThenRole = new RegExp(`(^|[^a-z0-9_])${aliasPattern}\\s+(?:is|are|as|becomes?|defines?|provides?|for|to|=|:)\\s*(?:the\\s+|a\\s+|an\\s+)?${rolePattern}([^a-z0-9_]|$)`, "i");
      const roleThenFile = new RegExp(`(^|[^a-z0-9_])${rolePattern}\\s+(?:is|are|comes?\\s+from|uses?|=|:)\\s*(?:the\\s+|a\\s+|an\\s+)?${aliasPattern}([^a-z0-9_]|$)`, "i");
      const useFileForRole = new RegExp(`\\b(?:use|make|set|treat)\\s+(?:the\\s+)?${aliasPattern}\\s+(?:(?:as|for|to)\\s+)?(?:the\\s+|a\\s+|an\\s+)?${rolePattern}\\b`, "i");
      if (fileThenRole.test(lower) || roleThenFile.test(lower) || useFileForRole.test(lower)) return canonical;
    }
  }
  return null;
}

function mentionedFiles(text, context) {
  return (context.fileNames ?? []).filter(fileName => aliasesForFile(fileName).some(alias => containsAlias(text, alias)));
}

function desiredFileForRole(mappingSpec, desiredRoles, role) {
  for (const [fileName, desiredRole] of desiredRoles) {
    if (desiredRole === role) return fileName;
  }
  return resolveRoleFileFromMapping(mappingSpec, role);
}

function headersFor(context, fileName) {
  return context.headersByFile?.[fileName] ?? [];
}

function inferKeyColumn(fileName, role, context) {
  const headers = headersFor(context, fileName);
  const base = singular(basename(fileName).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+$/g, ""));
  const candidates = [
    `${base}_id`,
    `${base}id`,
    role === "vertex_table" ? "author_id" : null,
    role === "vertex_table" ? "vertex_id" : null,
    role === "vertex_table" ? "node_id" : null,
    role === "hyperedge_table" ? "paper_id" : null,
    role === "hyperedge_table" ? "hyperedge_id" : null,
    role === "hyperedge_table" ? "group_id" : null,
    "id",
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = resolveColumnReference(fileName, candidate, context, { purpose: humanRolePurpose(role) });
    if (resolved.ok) return resolved.column;
  }
  const idLike = headers.find(header => /(^|_)id$/i.test(header));
  return idLike ?? null;
}

function keyColumnsForFile(mappingSpec, desiredKeys, fileName) {
  return desiredKeys.get(fileName)
    ?? mappingFile(mappingSpec, fileName)?.keyColumns
    ?? entityForFile(mappingSpec, "vertex", fileName)?.keyColumns
    ?? entityForFile(mappingSpec, "hyperedge", fileName)?.keyColumns
    ?? [];
}

function addKeyOperations(operations, mappingSpec, fileName, role, keyColumns) {
  if (!fileName || !keyColumns?.length) return;
  addOperation(operations, { type: "SET_FILE_KEY_COLUMNS", fileName, keyColumns });
  if (role === "vertex_table") {
    addOperation(operations, {
      type: "SET_VERTEX_ENTITY_RULE",
      groupId: chooseGroupId(mappingSpec, fileName),
      sourceFile: fileName,
      keyColumns,
      labelColumn: entityForFile(mappingSpec, "vertex", fileName)?.labelColumn ?? null,
      attributes: entityForFile(mappingSpec, "vertex", fileName)?.attributes ?? [],
    });
  }
  if (role === "hyperedge_table") {
    const current = entityForFile(mappingSpec, "hyperedge", fileName);
    addOperation(operations, {
      type: "SET_HYPEREDGE_ENTITY_RULE",
      groupId: chooseGroupId(mappingSpec, fileName),
      sourceFile: fileName,
      keyColumns,
      labelColumn: current?.labelColumn ?? null,
      timeColumn: current?.timeColumn ?? null,
      weightColumn: current?.weightColumn ?? null,
      attributes: current?.attributes ?? [],
    });
  }
}

function relationshipOperation(mappingSpec, membershipFile, vertexFile, hyperedgeFile, vertexColumns, hyperedgeColumns, hyperedgeKeyColumns) {
  const existing = (mappingSpec.relationships ?? []).find(rel => rel.type === "membership" && rel.sourceFile === membershipFile)
    ?? (mappingSpec.relationships ?? []).find(rel => rel.type === "membership");
  return {
    type: "ADD_RELATIONSHIP",
    groupId: chooseGroupId(mappingSpec, membershipFile),
    sourceFile: membershipFile,
    sourceColumns: hyperedgeColumns,
    targetFile: hyperedgeFile,
    targetColumns: hyperedgeKeyColumns,
    vertexSourceFile: membershipFile,
    vertexColumns,
    relationship: {
      id: existing?.id ?? `relationship-${membershipFile.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-membership`,
      groupId: chooseGroupId(mappingSpec, membershipFile),
      type: "membership",
      sourceFile: membershipFile,
      sourceColumns: hyperedgeColumns,
      targetFile: hyperedgeFile,
      targetColumns: hyperedgeKeyColumns,
      vertexSourceFile: membershipFile,
      vertexColumns,
      cardinality: existing?.cardinality ?? "many_to_one",
      joinType: "left",
      confidence: 0.92,
      evidenceIds: existing?.evidenceIds ?? [],
    },
  };
}

function parseQualifiedColumnRef(value = "", context = {}, purpose = "resolve a join column") {
  const raw = String(value ?? "").trim().replace(/^["'`]|["'`]$/g, "");
  const dot = raw.lastIndexOf(".");
  if (dot <= 0 || dot >= raw.length - 1) return { ok: false, error: `Use file.column notation to ${purpose}.` };
  const fileTerm = raw.slice(0, dot);
  const columnTerm = raw.slice(dot + 1);
  const file = resolveFileTerm(fileTerm, context, purpose);
  if (!file.ok) return file;
  const column = resolveColumnTerm(file.fileName, columnTerm, context, purpose);
  if (!column.ok) return column;
  return { ok: true, fileName: file.fileName, column: column.column };
}

function parseExplicitQualifiedJoins({ text, mappingSpec, desiredRoles, desiredKeys, context, operations, trace, errors }) {
  const raw = String(text ?? "");
  const qualified = "[A-Za-z0-9_.-]+\\.(?!(?:csv|tsv|json|txt)\\b)[A-Za-z0-9_:-]+";
  const joinPattern = new RegExp(`\\b(${qualified})\\s+(?:to|with|=|->|→)\\s+(${qualified})\\b`, "gi");
  const pairs = [];
  let match = joinPattern.exec(raw);
  while (match) {
    const left = parseQualifiedColumnRef(match[1], context, "resolve the source side of the join");
    const right = parseQualifiedColumnRef(match[2], context, "resolve the target side of the join");
    if (!left.ok) errors.push(left.error);
    if (!right.ok) errors.push(right.error);
    if (left.ok && right.ok) pairs.push({ left, right });
    match = joinPattern.exec(raw);
  }
  if (!pairs.length) return null;

  const membershipFile = desiredFileForRole(mappingSpec, desiredRoles, "membership")
    ?? pairs.map(pair => pair.left.fileName).find(fileName => roleFromFileName(fileName) === "membership")
    ?? pairs.map(pair => pair.right.fileName).find(fileName => roleFromFileName(fileName) === "membership");
  const vertexFile = desiredFileForRole(mappingSpec, desiredRoles, "vertex_table")
    ?? [...pairs.flatMap(pair => [pair.left.fileName, pair.right.fileName])].find(fileName => roleFromFileName(fileName) === "vertex_table");
  const hyperedgeFile = desiredFileForRole(mappingSpec, desiredRoles, "hyperedge_table")
    ?? [...pairs.flatMap(pair => [pair.left.fileName, pair.right.fileName])].find(fileName => roleFromFileName(fileName) === "hyperedge_table");
  if (!membershipFile || !vertexFile || !hyperedgeFile) {
    errors.push("Which files are the membership, vertex, and hyperedge tables for these joins?");
    return null;
  }

  desiredRoles.set(membershipFile, "membership");
  desiredRoles.set(vertexFile, "vertex_table");
  desiredRoles.set(hyperedgeFile, "hyperedge_table");
  addOperation(operations, { type: "SET_FILE_ROLE", fileName: membershipFile, role: "membership" });
  addOperation(operations, { type: "SET_FILE_ROLE", fileName: vertexFile, role: "vertex_table" });
  addOperation(operations, { type: "SET_FILE_ROLE", fileName: hyperedgeFile, role: "hyperedge_table" });

  const vertexPair = pairs.find(pair => [pair.left.fileName, pair.right.fileName].includes(membershipFile)
    && [pair.left.fileName, pair.right.fileName].includes(vertexFile));
  const hyperedgePair = pairs.find(pair => [pair.left.fileName, pair.right.fileName].includes(membershipFile)
    && [pair.left.fileName, pair.right.fileName].includes(hyperedgeFile));
  if (!vertexPair || !hyperedgePair) {
    errors.push("Provide one membership-to-vertex join and one membership-to-hyperedge join.");
    return null;
  }
  const membershipColumnFor = (pair, targetFile) => pair.left.fileName === membershipFile && pair.right.fileName === targetFile
    ? pair.left.column
    : pair.right.fileName === membershipFile && pair.left.fileName === targetFile
      ? pair.right.column
      : null;
  const targetColumnFor = (pair, targetFile) => pair.left.fileName === targetFile
    ? pair.left.column
    : pair.right.fileName === targetFile
      ? pair.right.column
      : null;
  const vertexColumn = membershipColumnFor(vertexPair, vertexFile);
  const hyperedgeColumn = membershipColumnFor(hyperedgePair, hyperedgeFile);
  const vertexKey = targetColumnFor(vertexPair, vertexFile);
  const hyperedgeKey = targetColumnFor(hyperedgePair, hyperedgeFile);
  if (!vertexColumn || !hyperedgeColumn || !vertexKey || !hyperedgeKey) {
    errors.push("The qualified joins do not connect the membership file to both entity tables.");
    return null;
  }

  if (!desiredKeys.has(vertexFile)) desiredKeys.set(vertexFile, [vertexKey]);
  if (!desiredKeys.has(hyperedgeFile)) desiredKeys.set(hyperedgeFile, [hyperedgeKey]);
  trace.matchedRuleIds.push("mapping.relationship.qualified_join_pairs");
  for (const pair of pairs) {
    trace.resolvedEntityIds.push(`column:${pair.left.fileName}.${pair.left.column}`);
    trace.resolvedEntityIds.push(`column:${pair.right.fileName}.${pair.right.column}`);
  }
  trace.resolvedEntityIds.push(`relationship:${membershipFile}->${hyperedgeFile};vertices:${vertexFile}`);
  return relationshipOperation(mappingSpec, membershipFile, vertexFile, hyperedgeFile, [vertexColumn], [hyperedgeColumn], [hyperedgeKey]);
}


function parseColumnInFileJoins({ text, mappingSpec, desiredRoles, desiredKeys, context, operations, trace, errors }) {
  const raw = String(text ?? "");
  const pairPattern = /\b([A-Za-z0-9_:-]+)\s+in\s+([A-Za-z0-9_.-]+\.(?:csv|tsv|json|txt))\s+(?:to|with|into)\s+([A-Za-z0-9_.-]+\.(?:csv|tsv|json|txt))\b/gi;
  const pairs = [];
  let match = pairPattern.exec(raw);
  while (match) {
    const sourceFile = resolveFileTerm(match[2].trim(), context, "resolve the join source file");
    const targetFile = resolveFileTerm(match[3].trim(), context, "resolve the join target file");
    if (!sourceFile.ok) errors.push(sourceFile.error);
    if (!targetFile.ok) errors.push(targetFile.error);
    if (sourceFile.ok && targetFile.ok) {
      const sourceColumn = resolveColumnTerm(sourceFile.fileName, match[1], context, "resolve the join source column");
      const targetColumn = resolveColumnTerm(targetFile.fileName, match[1], context, "resolve the matching target key");
      if (!sourceColumn.ok) errors.push(sourceColumn.error);
      if (!targetColumn.ok) errors.push(targetColumn.error);
      if (sourceColumn.ok && targetColumn.ok) pairs.push({
        sourceFile: sourceFile.fileName,
        sourceColumn: sourceColumn.column,
        targetFile: targetFile.fileName,
        targetColumn: targetColumn.column,
      });
    }
    match = pairPattern.exec(raw);
  }
  if (!pairs.length) return null;

  const membershipFile = pairs.map(pair => pair.sourceFile).find(fileName => roleFromFileName(fileName) === "membership")
    ?? pairs[0]?.sourceFile;
  const vertexPair = pairs.find(pair => roleFromFileName(pair.targetFile) === "vertex_table");
  const hyperedgePair = pairs.find(pair => roleFromFileName(pair.targetFile) === "hyperedge_table");
  if (!membershipFile || !vertexPair || !hyperedgePair) {
    errors.push("Provide one membership-column connection to the vertex table and one to the hyperedge table.");
    return null;
  }
  const vertexFile = vertexPair.targetFile;
  const hyperedgeFile = hyperedgePair.targetFile;
  desiredRoles.set(membershipFile, "membership");
  desiredRoles.set(vertexFile, "vertex_table");
  desiredRoles.set(hyperedgeFile, "hyperedge_table");
  desiredKeys.set(vertexFile, desiredKeys.get(vertexFile) ?? [vertexPair.targetColumn]);
  desiredKeys.set(hyperedgeFile, desiredKeys.get(hyperedgeFile) ?? [hyperedgePair.targetColumn]);
  addOperation(operations, { type: "SET_FILE_ROLE", fileName: membershipFile, role: "membership" });
  addOperation(operations, { type: "SET_FILE_ROLE", fileName: vertexFile, role: "vertex_table" });
  addOperation(operations, { type: "SET_FILE_ROLE", fileName: hyperedgeFile, role: "hyperedge_table" });
  trace.matchedRuleIds.push("mapping.relationship.column_in_file_pairs");
  for (const pair of pairs) {
    trace.resolvedEntityIds.push(`column:${pair.sourceFile}.${pair.sourceColumn}`);
    trace.resolvedEntityIds.push(`column:${pair.targetFile}.${pair.targetColumn}`);
  }
  trace.resolvedEntityIds.push(`relationship:${membershipFile}->${hyperedgeFile};vertices:${vertexFile}`);
  return relationshipOperation(
    mappingSpec,
    membershipFile,
    vertexFile,
    hyperedgeFile,
    [vertexPair.sourceColumn],
    [hyperedgePair.sourceColumn],
    [hyperedgePair.targetColumn],
  );
}

function inferRelationship({ text, mappingSpec, desiredRoles, desiredKeys, context, trace, errors }) {
  const lower = String(text ?? "").toLowerCase();
  const membershipFile = desiredFileForRole(mappingSpec, desiredRoles, "membership");
  const vertexFile = desiredFileForRole(mappingSpec, desiredRoles, "vertex_table");
  const hyperedgeFile = desiredFileForRole(mappingSpec, desiredRoles, "hyperedge_table");
  const relationshipMentioned = /\b(authorship|membership|incidence|link|links|connect|connects|belong|belongs|which|through|between|associates|maps)\b/i.test(lower);
  if (!relationshipMentioned || !membershipFile || !vertexFile || !hyperedgeFile) return null;

  const vertexKeys = keyColumnsForFile(mappingSpec, desiredKeys, vertexFile);
  const hyperedgeKeys = keyColumnsForFile(mappingSpec, desiredKeys, hyperedgeFile);
  if (!vertexKeys.length || !hyperedgeKeys.length) return null;
  const vertexColumns = [];
  const hyperedgeColumns = [];
  for (const column of vertexKeys) {
    const resolved = resolveColumnTerm(membershipFile, column, context, `link memberships to ${vertexFile}`);
    if (resolved.ok) vertexColumns.push(resolved.column);
    else errors.push(resolved.error);
  }
  for (const column of hyperedgeKeys) {
    const resolved = resolveColumnTerm(membershipFile, column, context, `link memberships to ${hyperedgeFile}`);
    if (resolved.ok) hyperedgeColumns.push(resolved.column);
    else errors.push(resolved.error);
  }
  if (!vertexColumns.length || !hyperedgeColumns.length) return null;
  trace.resolvedEntityIds.push(`relationship:${membershipFile}->${hyperedgeFile};vertices:${vertexFile}`);
  return relationshipOperation(mappingSpec, membershipFile, vertexFile, hyperedgeFile, vertexColumns, hyperedgeColumns, hyperedgeKeys);
}

function groupIdFromLabel(label = "") {
  const slug = String(label ?? "").trim().replace(/^["'`]|["'`]$/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return slug ? `group-${slug}` : "group-custom";
}

function resolveGroupId(groupPhrase = "", mappingSpec = {}) {
  const normalized = String(groupPhrase ?? "").trim().replace(/^["'`]|["'`]$/g, "");
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  const match = (mappingSpec.groups ?? []).find(group => String(group.id).toLowerCase() === lower || String(group.label).toLowerCase() === lower);
  return match?.id ?? groupIdFromLabel(normalized);
}

function applyGroupingLanguage({ text, context, mappingSpec = {}, operations, trace }) {
  const lower = String(text ?? "").toLowerCase();
  const allMentioned = mentionedFiles(text, context);
  const csvFiles = (context.fileNames ?? []).filter(fileName => /\.csv$/i.test(fileName));
  const validationFiles = allMentioned.filter(fileName => /expected|validation|truth|gold/i.test(fileName));
  const updateFiles = allMentioned.filter(fileName => /updates?|changes?|deltas?|stream/i.test(fileName));
  const preservesEmptyHyperedges = /\b(no authors|do not have any authors|without authors|no memberships|empty hyperedges?|empty papers?|unmatched|papers? without authors)\b/i.test(text);

  const createGroup = String(text ?? "").match(/\bcreate\s+(?:a\s+)?group\s+(?:called|named)\s+["'`]?([^"'`,.;]+)["'`]?/i);
  if (createGroup) {
    const groupLabel = createGroup[1].trim();
    const groupId = groupIdFromLabel(groupLabel);
    addOperation(operations, { type: "CREATE_GROUP", groupId, groupLabel });
    addOperation(operations, { type: "SET_PARSE_MODE", value: "grouped" });
    trace.matchedRuleIds.push("grouping.create_group");
    trace.resolvedEntityIds.push(`group:${groupId}`);
  }

  const moveFile = String(text ?? "").match(/\b(?:move|put|place)\s+([A-Za-z0-9_.-]+\.(?:csv|tsv|json|txt))\s+(?:into|to|in)\s+["'`]?([^"'`,.;]+)["'`]?/i);
  if (moveFile && !/\b(?:own dataset|by itself|separate dataset|independent dataset)\b/i.test(moveFile[2])) {
    const resolvedFile = resolveFileTerm(moveFile[1], context, "move a file into a dataset group");
    if (resolvedFile.ok) {
      const groupId = resolveGroupId(moveFile[2], mappingSpec);
      addOperation(operations, { type: "MOVE_FILE_TO_GROUP", fileName: resolvedFile.fileName, groupId });
      addOperation(operations, { type: "SET_PARSE_MODE", value: "grouped" });
      trace.matchedRuleIds.push("grouping.move_file_to_group");
      trace.resolvedEntityIds.push(`file:${resolvedFile.fileName}`);
      trace.resolvedEntityIds.push(`group:${groupId}`);
    }
  }

  for (const fileName of validationFiles) {
    addOperation(operations, { type: "MARK_VALIDATION_FILE", fileName });
    trace.matchedRuleIds.push("grouping.validation_file");
    trace.resolvedEntityIds.push(`file:${fileName}`);
  }
  if (/\bupdate stream\b|\bcontains? (?:later )?(?:updates|changes|deltas)\b|\bmark\b[\s\S]{0,80}\bupdates?\b/i.test(lower)) {
    for (const fileName of updateFiles) {
      addOperation(operations, { type: "MARK_UPDATE_STREAM", fileName });
      trace.matchedRuleIds.push("grouping.update_stream");
      trace.resolvedEntityIds.push(`file:${fileName}`);
    }
  }
  if (/\b(?:parse|treat|use|read)\b[\s\S]{0,60}\b(?:all|these|the)\b[\s\S]{0,50}\b(?:together|as one dataset|as a single dataset)\b|\bone dataset\b/i.test(lower)) {
    addOperation(operations, { type: "SET_PARSE_MODE", value: "together" });
    trace.matchedRuleIds.push("grouping.all_together");
  }
  if (/\b(?:each|every)\b[\s\S]{0,40}\b(?:file|csv)\b[\s\S]{0,40}\b(?:separate|independent|own dataset)\b|\bparse separately\b/i.test(lower)) {
    addOperation(operations, { type: "SET_PARSE_MODE", value: "separate" });
    trace.matchedRuleIds.push("grouping.all_separate");
  }
  if (/\bfirst\s+(?:two|2)\b/i.test(lower) && /\btogether\b|\bbelong together\b/i.test(lower) && csvFiles.length >= 2) {
    addOperation(operations, { type: "SET_PARSE_MODE", value: "grouped" });
    for (const fileName of csvFiles.slice(0, 2)) {
      addOperation(operations, { type: "MOVE_FILE_TO_GROUP", fileName, groupId: "group-main" });
      trace.resolvedEntityIds.push(`file:${fileName}`);
    }
    trace.matchedRuleIds.push("grouping.first_two_together");
  } else if (allMentioned.length >= 2
      && (!preservesEmptyHyperedges || /^\s*(?:no|actually|instead)\b/i.test(text))
      && /\b(?:group|put|treat|parse|keep)\b[\s\S]{0,100}\b(?:together|with|same dataset|same group)\b|\bbelong together\b/i.test(lower)) {
    addOperation(operations, { type: "SET_PARSE_MODE", value: "grouped" });
    for (const fileName of allMentioned.filter(fileName => !validationFiles.includes(fileName) && !updateFiles.includes(fileName))) {
      addOperation(operations, { type: "MOVE_FILE_TO_GROUP", fileName, groupId: "group-main" });
      trace.resolvedEntityIds.push(`file:${fileName}`);
    }
    trace.matchedRuleIds.push("grouping.named_files_together");
  }
  for (const fileName of allMentioned) {
    if (!/\b(?:separate|own dataset|independent dataset|by itself)\b/i.test(lower) || validationFiles.includes(fileName) || updateFiles.includes(fileName)) continue;
    if (/\b(?:each|every)\b/.test(lower)) continue;
    const groupId = `group-${fileName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}`;
    addOperation(operations, { type: "CREATE_GROUP", groupId, groupLabel: basename(fileName) });
    addOperation(operations, { type: "MOVE_FILE_TO_GROUP", fileName, groupId });
    addOperation(operations, { type: "SET_PARSE_MODE", value: "grouped" });
    trace.matchedRuleIds.push("grouping.file_separate");
    trace.resolvedEntityIds.push(`file:${fileName}`);
  }
}

function parseRoleLanguage({ clauses, context, desiredRoles, operations, trace }) {
  for (const clause of clauses) {
    const clauseText = clause.text;
    for (const fileName of context.fileNames ?? []) {
      if (!aliasesForFile(fileName).some(alias => containsAlias(clauseText, alias))) continue;
      let role = roleFromLocalWindow(clauseText, fileName);
      if (role === "ignored"
        && (/\b(?:do\s+not|don't|not)\s+(?:ignore|skip|exclude)\b/i.test(clauseText)
          || /\bcolumn\s+["'`]ignore["'`]|\b["'`]ignore["'`]\s+(?:from|in)\b/i.test(clauseText))) {
        role = null;
      }
      if (!role && /\b(tells|links?|connects?|belongs?)\b/i.test(clauseText)) role = roleFromFileName(fileName);
      if (!role && /\b(expected|validation|ground truth|gold)\b/i.test(clauseText)) role = "validation_expected_output";
      if (!role
        && /\b(ignore|skip|exclude)\b/i.test(clauseText)
        && !/\bcolumn\s+["'`]ignore["'`]|\b["'`]ignore["'`]\s+(?:from|in)\b/i.test(clauseText)
        && !/\b(?:do\s+not|don't|not)\s+(?:ignore|skip|exclude)\b/i.test(clauseText)) {
        role = "ignored";
      }
      if (!role) continue;
      desiredRoles.set(fileName, role);
      trace.matchedRuleIds.push(`mapping.role.${role}`);
      trace.resolvedEntityIds.push(`file:${fileName}`);
      if (role === "validation_expected_output") addOperation(operations, { type: "MARK_VALIDATION_FILE", fileName });
      else if (role === "update_stream") addOperation(operations, { type: "MARK_UPDATE_STREAM", fileName });
      else if (role === "ignored") addOperation(operations, { type: "IGNORE_FILE", fileName });
      else addOperation(operations, { type: "SET_FILE_ROLE", fileName, role });
    }
  }
}

function targetFileFromPhrase(phrase, mappingSpec, desiredRoles, context) {
  const raw = String(phrase ?? "").trim();
  const directFile = resolveFileTerm(raw, context, "receive this key");
  if (directFile.ok) return directFile.fileName;
  const role = roleFromAlias(raw);
  if (role) return desiredFileForRole(mappingSpec, desiredRoles, role);
  if (/\bpaper|group|hyperedge/.test(raw.toLowerCase())) return desiredFileForRole(mappingSpec, desiredRoles, "hyperedge_table");
  if (/\bauthor|node|vertex/.test(raw.toLowerCase())) return desiredFileForRole(mappingSpec, desiredRoles, "vertex_table");
  return null;
}

function parseKeyLanguage({ text, mappingSpec, desiredRoles, desiredKeys, context, operations, trace, errors }) {
  const raw = String(text ?? "");
  const quotedFromPattern = /\buse\s+(?:the\s+)?(?:column\s+)?["'`]([^"'`]+)["'`]\s+(?:from|in)\s+(.+?)\s+as\s+(?:the\s+)?(?:(vertex|node|author|hyperedge|edge|paper)\s+)?key\b/gi;
  let quotedFrom = quotedFromPattern.exec(raw);
  while (quotedFrom) {
    const columnPhrase = quotedFrom[1];
    const filePhrase = quotedFrom[2].replace(/\b(?:as|for)\b[\s\S]*$/i, "").trim();
    const rolePhrase = quotedFrom[3] ?? "";
    const resolvedFile = resolveFileTerm(filePhrase, context, "receive quoted key column");
    if (!resolvedFile.ok) {
      errors.push(resolvedFile.error);
    } else {
      const resolvedColumn = resolveColumnTerm(resolvedFile.fileName, columnPhrase, context, "serve as a key column");
      if (resolvedColumn.ok) {
        const explicitRole = /vertex|node|author/i.test(rolePhrase) ? "vertex_table"
          : /hyperedge|edge|paper/i.test(rolePhrase) ? "hyperedge_table"
            : fileRoleFromDesiredOrSpec(resolvedFile.fileName, desiredRoles, mappingSpec);
        if (explicitRole && ["vertex_table", "hyperedge_table"].includes(explicitRole)) {
          desiredRoles.set(resolvedFile.fileName, explicitRole);
          addOperation(operations, { type: "SET_FILE_ROLE", fileName: resolvedFile.fileName, role: explicitRole });
        }
        desiredKeys.set(resolvedFile.fileName, [resolvedColumn.column]);
        trace.matchedRuleIds.push("mapping.key.quoted_column_from_file");
        trace.resolvedEntityIds.push(`file:${resolvedFile.fileName}`);
        trace.resolvedEntityIds.push(`column:${resolvedFile.fileName}.${resolvedColumn.column}`);
      } else {
        errors.push(resolvedColumn.error);
      }
    }
    quotedFrom = quotedFromPattern.exec(raw);
  }

  if (/\bid columns?\b/i.test(raw)) {
    for (const role of ["vertex_table", "hyperedge_table"]) {
      const fileName = desiredFileForRole(mappingSpec, desiredRoles, role);
      if (!fileName) continue;
      const key = inferKeyColumn(fileName, role, context);
      if (key) {
        desiredKeys.set(fileName, [key]);
        trace.matchedRuleIds.push(`mapping.key.inferred_id.${role}`);
        trace.resolvedEntityIds.push(`column:${fileName}.${key}`);
      }
    }
  }

  const asKeyPattern = /\b(?:use|set|make)\s+([A-Za-z0-9_.:-]+)\s+as\s+(?:the\s+)?(?:(vertex|node|author|hyperedge|edge|paper)\s+)?(?:id|key|identifier)\b/gi;
  let asKeyMatch = asKeyPattern.exec(raw);
  while (asKeyMatch) {
    const columnPhrase = asKeyMatch[1];
    const rolePhrase = asKeyMatch[2] ?? "";
    const desiredRole = /vertex|node|author/i.test(rolePhrase) ? "vertex_table"
      : /hyperedge|edge|paper/i.test(rolePhrase) ? "hyperedge_table"
        : null;
    let fileName = desiredRole ? desiredFileForRole(mappingSpec, desiredRoles, desiredRole) : null;
    if (!fileName) {
      const candidates = (context.fileNames ?? []).filter(name => headersFor(context, name).some(header => header.toLowerCase() === columnPhrase.toLowerCase()));
      const roleCandidates = candidates.filter(name => ["vertex_table", "hyperedge_table"].includes(fileRoleFromDesiredOrSpec(name, desiredRoles, mappingSpec)));
      fileName = roleCandidates.length === 1 ? roleCandidates[0] : candidates.length === 1 ? candidates[0] : null;
    }
    if (!fileName) {
      errors.push(`Which file should use ${columnPhrase} as its key?`);
    } else {
      const role = desiredRole ?? fileRoleFromDesiredOrSpec(fileName, desiredRoles, mappingSpec);
      const resolved = resolveColumnTerm(fileName, columnPhrase, context, humanRolePurpose(role));
      if (resolved.ok) {
        if (desiredRole) desiredRoles.set(fileName, desiredRole);
        desiredKeys.set(fileName, [resolved.column]);
        trace.matchedRuleIds.push("mapping.key.as_key");
        trace.resolvedEntityIds.push(`file:${fileName}`);
        trace.resolvedEntityIds.push(`column:${fileName}.${resolved.column}`);
      } else errors.push(resolved.error);
    }
    asKeyMatch = asKeyPattern.exec(raw);
  }

  const useForPattern = /\b(?:use\s+|and\s+)([A-Za-z0-9_.:-]+(?:\s+and\s+[A-Za-z0-9_.:-]+)?|the\s+id\s+columns?)\s+for\s+(?:the\s+)?([A-Za-z0-9_. -]+?)(?=,|\.|;|\band\s+[A-Za-z0-9_.:-]+\s+for\b|$)/gi;
  let match = useForPattern.exec(raw);
  while (match) {
    const columnPhrase = match[1].trim();
    const targetPhrase = match[2].trim();
    const fileName = targetFileFromPhrase(targetPhrase, mappingSpec, desiredRoles, context);
    if (!fileName) {
      errors.push(`Which file should use ${columnPhrase} as its key?`);
    } else if (!/id columns?/i.test(columnPhrase)) {
      const columns = columnPhrase.split(/\s+and\s+/i).map(item => item.trim()).filter(Boolean);
      const resolvedColumns = [];
      for (const column of columns) {
        if (hasNegatedTerm(raw, column)) continue;
        const resolved = resolveColumnTerm(fileName, column, context, humanRolePurpose(fileRoleFromDesiredOrSpec(fileName, desiredRoles, mappingSpec)));
        if (resolved.ok) resolvedColumns.push(resolved.column);
        else errors.push(resolved.error);
      }
      if (resolvedColumns.length) {
        desiredKeys.set(fileName, resolvedColumns);
        trace.matchedRuleIds.push("mapping.key.use_for_target");
        resolvedColumns.forEach(column => trace.resolvedEntityIds.push(`column:${fileName}.${column}`));
      }
    }
    match = useForPattern.exec(raw);
  }

  for (const fileName of mentionedFiles(raw, context)) {
    const aliasPattern = aliasesForFile(fileName).map(alias => escapeRegExp(alias).replace(/\\ /g, "[\\s_-]+")).join("|");
    const usingPattern = new RegExp(`(?:${aliasPattern})(?:(?!\\.|;|\\n)[\\s\\S]){0,120}\\b(?:using\\s+|with\\s+(?:key|identifier|column|id\\s+column)\\s+)([A-Za-z0-9_.:-]+(?:\\s+and\\s+[A-Za-z0-9_.:-]+)*)\\b`, "i");
    const usingMatch = raw.match(usingPattern);
    if (!usingMatch) continue;
    const role = fileRoleFromDesiredOrSpec(fileName, desiredRoles, mappingSpec);
    if (!["vertex_table", "hyperedge_table"].includes(role)) continue;
    const resolvedColumns = [];
    for (const column of usingMatch[1].split(/\s+and\s+/i).map(item => item.trim()).filter(Boolean)) {
      if (hasNegatedTerm(raw, column)) continue;
      const resolved = resolveColumnTerm(fileName, column, context, humanRolePurpose(role));
      if (resolved.ok) resolvedColumns.push(resolved.column);
      else errors.push(resolved.error);
    }
    if (resolvedColumns.length) {
      desiredKeys.set(fileName, resolvedColumns);
      trace.matchedRuleIds.push("mapping.key.using_clause");
      resolvedColumns.forEach(column => trace.resolvedEntityIds.push(`column:${fileName}.${column}`));
    }
  }

  const instead = raw.match(/\buse\s+([A-Za-z0-9_.:-]+)\s+(?:instead of|and not)\s+([A-Za-z0-9_.:-]+)\b/i);
  if (instead) {
    const newColumn = instead[1];
    const oldColumn = instead[2];
    const candidates = (context.fileNames ?? []).filter(fileName => {
      const headers = headersFor(context, fileName).map(header => header.toLowerCase());
      const hasNew = headers.includes(newColumn.toLowerCase());
      const hasOld = headers.includes(oldColumn.toLowerCase()) || (mappingFile(mappingSpec, fileName)?.keyColumns ?? []).some(column => column.toLowerCase() === oldColumn.toLowerCase());
      return hasNew && hasOld;
    });
    const fileName = candidates.length === 1 ? candidates[0] : desiredFileForRole(mappingSpec, desiredRoles, "hyperedge_table");
    if (!fileName) errors.push(`Which file should use ${newColumn} instead of ${oldColumn}?`);
    else {
      const resolved = resolveColumnTerm(fileName, newColumn, context, humanRolePurpose(fileRoleFromDesiredOrSpec(fileName, desiredRoles, mappingSpec)));
      if (resolved.ok) {
        desiredKeys.set(fileName, [resolved.column]);
        trace.matchedRuleIds.push("mapping.correction.key_instead_of");
        trace.resolvedEntityIds.push(`column:${fileName}.${resolved.column}`);
      } else errors.push(resolved.error);
    }
  }

  const composite = raw.match(/\buse\s+([A-Za-z0-9_.:-]+)\s+and\s+([A-Za-z0-9_.:-]+)\s+together\b/i);
  if (composite) {
    const fileName = desiredFileForRole(mappingSpec, desiredRoles, "hyperedge_table")
      ?? (context.fileNames ?? []).find(name => [composite[1], composite[2]].every(column => headersFor(context, name).some(header => header.toLowerCase() === column.toLowerCase())));
    if (!fileName) errors.push(`Which file should use ${composite[1]} and ${composite[2]} as a composite key?`);
    else {
      const resolved = [composite[1], composite[2]].map(column => resolveColumnTerm(fileName, column, context, humanRolePurpose(fileRoleFromDesiredOrSpec(fileName, desiredRoles, mappingSpec))));
      const bad = resolved.find(item => !item.ok);
      if (bad) errors.push(bad.error);
      else {
        const columns = resolved.map(item => item.column);
        desiredKeys.set(fileName, columns);
        trace.matchedRuleIds.push("mapping.key.composite");
        columns.forEach(column => trace.resolvedEntityIds.push(`column:${fileName}.${column}`));
      }
    }
  }
}

function parseTimeLanguage({ text, mappingSpec, desiredRoles, desiredKeys, context, operations, trace, errors }) {
  const raw = String(text ?? "");
  const match = raw.match(/\b([A-Za-z0-9_.:-]+)\s+(?:is|as|for)\s+(?:the\s+)?(?:time|timestamp|year)\s+(?:column|field|metadata)?\b/i)
    ?? raw.match(/\buse\s+([A-Za-z0-9_.:-]+)\s+as\s+(?:the\s+)?(?:time|timestamp|year)\b/i);
  const mentionsYear = /\byear\b/i.test(raw) && /\b(time|metadata|column|field)\b/i.test(raw);
  const columnRef = match?.[1] ?? (mentionsYear ? "year" : null);
  if (!columnRef) return;
  const targetFile = desiredFileForRole(mappingSpec, desiredRoles, "hyperedge_table")
    ?? (context.fileNames ?? []).find(fileName => headersFor(context, fileName).some(header => header.toLowerCase() === columnRef.toLowerCase()));
  if (!targetFile) {
    errors.push(`Which hyperedge table should provide the ${columnRef} time column?`);
    return;
  }
  const resolved = resolveColumnTerm(targetFile, columnRef, context, "store hyperedge time");
  if (!resolved.ok) {
    errors.push(resolved.error);
    return;
  }
  const keyColumns = keyColumnsForFile(mappingSpec, desiredKeys, targetFile);
  if (!keyColumns.length) return;
  const current = entityForFile(mappingSpec, "hyperedge", targetFile);
  addOperation(operations, {
    type: "SET_HYPEREDGE_ENTITY_RULE",
    groupId: chooseGroupId(mappingSpec, targetFile),
    sourceFile: targetFile,
    keyColumns,
    labelColumn: current?.labelColumn ?? null,
    timeColumn: resolved.column,
    weightColumn: current?.weightColumn ?? null,
    attributes: current?.attributes ?? [],
  });
  trace.matchedRuleIds.push("mapping.metadata.time_column");
  trace.resolvedEntityIds.push(`column:${targetFile}.${resolved.column}`);
}

function parsePolicies({ text, operations, trace }) {
  const raw = String(text ?? "");
  if (/\b(?:keep(?:ing)?|preserv(?:e|ing))\b[\s\S]{0,140}\b(no authors|do not have any authors|without authors|no memberships|empty hyperedges?|empty papers?|unmatched|papers? without authors)\b/i.test(raw)) {
    addOperation(operations, { type: "SET_POLICY", policy: "unmatchedHyperedgeRows", value: "preserve_empty" });
    addOperation(operations, { type: "SET_POLICY", policy: "emptyHyperedges", value: "keep" });
    trace.matchedRuleIds.push("mapping.policy.preserve_empty_hyperedges");
  }
  if (/\b(deduplicate|de-duplicate|remove duplicate(?:s)?|duplicate authorship memberships?|duplicate memberships?|repeated authorships|repeated memberships?)\b/i.test(raw)) {
    addOperation(operations, { type: "SET_POLICY", policy: "duplicateMembership", value: "deduplicate" });
    trace.matchedRuleIds.push("mapping.policy.deduplicate_memberships");
  }
}

export function compileDatasetMappingGrammar(text = "", {
  nlu = null,
  batch = null,
  mappingSpec = null,
  datasetProfile = null,
} = {}) {
  const raw = String(text ?? "").trim();
  if (!raw || !mappingSpec || mappingSpec.version !== 2) return { ok: false, noMatch: true };
  const context = buildDatasetMappingReferenceContext({ batch, datasetProfile, mappingSpec });
  if (/\b(?:the\s+)?other\s+paper\s+file\b/i.test(raw)) {
    const candidates = (context.fileNames ?? []).filter(fileName => /paper/i.test(fileName));
    if (candidates.length > 1) {
      const question = `Several active files could match “the other paper file”: ${candidates.join(", ")}. Which one should I use?`;
      return {
        ok: true,
        draft: patchDraft("clarification", "An ambiguous file reference must be resolved before applying a mapping patch.", [], question, "medium"),
        clarification: question,
        diagnostics: {
          plannerPath: "deterministic_nlu",
          nluDomain: nlu?.primaryDomain ?? "dataset_mapping",
          nluIntent: nlu?.primaryIntent ?? "mapping_patch",
          nluConfidence: nlu?.confidence,
          nluTrace: { matchedRuleIds: ["mapping.reference.ambiguous_other_paper_file"], resolvedEntityIds: [], rejectedCandidates: candidates },
          filesResolved: [],
          columnsResolved: [],
          errors: [question],
        },
      };
    }
  }
  const operations = [];
  const desiredRoles = new Map();
  const desiredKeys = new Map();
  const errors = [];
  const trace = {
    matchedRuleIds: [],
    resolvedEntityIds: [],
    rejectedCandidates: [],
  };

  applyGroupingLanguage({ text: raw, context, mappingSpec, operations, trace });
  const roleClauses = [
    { id: "raw-message", text: raw },
    ...(nlu?.clauses?.length ? nlu.clauses : []),
  ];
  parseRoleLanguage({ text: raw, clauses: roleClauses, context, desiredRoles, operations, trace });
  parseKeyLanguage({ text: raw, mappingSpec, desiredRoles, desiredKeys, context, operations, trace, errors });

  for (const [fileName, role] of desiredRoles) {
    if ((role === "vertex_table" || role === "hyperedge_table") && !desiredKeys.has(fileName)) {
      const inferred = inferKeyColumn(fileName, role, context);
      if (inferred && /\bid columns?\b|authors? are|papers? are|nodes?|groups?/i.test(raw)) {
        desiredKeys.set(fileName, [inferred]);
        trace.matchedRuleIds.push(`mapping.key.contextual_id.${role}`);
        trace.resolvedEntityIds.push(`column:${fileName}.${inferred}`);
      }
    }
  }

  for (const [fileName, keyColumns] of desiredKeys) {
    const role = fileRoleFromDesiredOrSpec(fileName, desiredRoles, mappingSpec);
    addKeyOperations(operations, mappingSpec, fileName, role, keyColumns);
  }

  parseTimeLanguage({ text: raw, mappingSpec, desiredRoles, desiredKeys, context, operations, trace, errors });
  const explicitRelationship = parseExplicitQualifiedJoins({ text: raw, mappingSpec, desiredRoles, desiredKeys, context, operations, trace, errors });
  if (explicitRelationship) addOperation(operations, explicitRelationship);
  const columnInFileRelationship = explicitRelationship ? null : parseColumnInFileJoins({ text: raw, mappingSpec, desiredRoles, desiredKeys, context, operations, trace, errors });
  if (columnInFileRelationship) addOperation(operations, columnInFileRelationship);
  const relationship = explicitRelationship || columnInFileRelationship ? null : inferRelationship({ text: raw, mappingSpec, desiredRoles, desiredKeys, context, trace, errors });
  if (relationship) addOperation(operations, relationship);
  parsePolicies({ text: raw, operations, trace });

  if (errors.length) {
    trace.rejectedCandidates.push(...errors);
    return {
      ok: true,
      draft: patchDraft("clarification", "One verified mapping reference is needed before applying a patch.", [], errors[0], "medium"),
      clarification: errors[0],
      diagnostics: {
        plannerPath: "deterministic_nlu",
        nluDomain: "dataset_mapping",
        nluIntent: nlu?.primaryIntent ?? "mapping_patch",
        nluConfidence: nlu?.confidence,
        nluTrace: trace,
        filesResolved: [...new Set(trace.resolvedEntityIds.filter(id => id.startsWith("file:")).map(id => id.slice(5)))],
        columnsResolved: [...new Set(trace.resolvedEntityIds.filter(id => id.startsWith("column:")).map(id => id.slice(7)))],
        errors,
      },
    };
  }

  if (!operations.length) return { ok: false, noMatch: true };
  return {
    ok: true,
    draft: patchDraft("patch", "Deterministic NLU parsed conversational dataset mapping guidance into a typed mapping patch.", operations, null, nlu?.confidence?.level === "low" ? "medium" : "high"),
    diagnostics: {
      plannerPath: "deterministic_nlu",
      nluDomain: nlu?.primaryDomain ?? "dataset_mapping",
      nluIntent: nlu?.primaryIntent ?? "mapping_patch",
      nluConfidence: nlu?.confidence,
      nluTrace: trace,
      filesResolved: [...new Set(trace.resolvedEntityIds.filter(id => id.startsWith("file:")).map(id => id.slice(5)))],
      columnsResolved: [...new Set(trace.resolvedEntityIds.filter(id => id.startsWith("column:")).map(id => id.slice(7)))],
      operationTypes: operations.map(operation => operation.type),
    },
  };
}

export function mappingQuestionFromNlu(text = "") {
  if (/\bwhy did you interpret|how did you understand|what did you understand/i.test(text)) return "interpretation_trace";
  if (/\bkey|id column|identifier/i.test(text)) return "mapping_keys";
  if (/\bjoin|relationship|membership|connect/i.test(text)) return "relationships";
  if (/\bempty|unmatched|no authors/i.test(text)) return "empty_hyperedges";
  return "mapping_status";
}

export function roleAliasesForTests() {
  return DOMAIN_LEXICON.datasetRoles;
}
