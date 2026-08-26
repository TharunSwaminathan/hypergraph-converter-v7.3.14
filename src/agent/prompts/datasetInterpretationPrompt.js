import { DATASET_INTERPRETATION_DRAFT_SCHEMA, DATASET_INTERPRETATION_TASK } from "../datasetInterpretationDraftSchema.js";
import { LOCAL_MODEL_TASK_MODES } from "../modelPromptBuilder.js";

const MAX_PROFILE_FILES = 12;
const MAX_COLUMNS_PER_FILE = 24;
const MAX_EVIDENCE = 24;

function compactProfile(datasetProfile = {}) {
  return {
    profileId: datasetProfile.profileId,
    partial: Boolean(datasetProfile.partial),
    files: (datasetProfile.files ?? []).slice(0, MAX_PROFILE_FILES).map(file => ({
      fileName: file.fileName,
      format: file.format,
      delimiter: file.delimiter,
      hasHeader: file.hasHeader,
      rowCount: file.rowCount,
      rowCountExact: file.rowCountExact,
      headerFingerprint: file.headerFingerprint,
      columns: (file.columns ?? []).slice(0, MAX_COLUMNS_PER_FILE).map(column => ({
        name: column.name,
        inferredType: column.inferredType,
        nonNullCount: column.nonNullCount,
        distinctCount: column.distinctCount,
        uniquenessRatio: Number(column.uniquenessRatio?.toFixed?.(3) ?? column.uniquenessRatio ?? 0),
        idLike: Boolean(column.idLike),
        listLike: Boolean(column.listLike),
        sampleValues: (column.sampleValues ?? []).slice(0, 4),
      })),
      candidateKeys: (file.candidateKeys ?? []).slice(0, 4),
      listLikeColumns: (file.listLikeColumns ?? []).slice(0, 4),
      warnings: file.warnings ?? [],
      partial: Boolean(file.partial),
    })),
  };
}

function compactEvidence(relationshipEvidence = []) {
  return relationshipEvidence.slice(0, MAX_EVIDENCE).map(evidence => ({
    id: evidence.id,
    leftFile: evidence.leftFile,
    leftColumns: evidence.leftColumns,
    rightFile: evidence.rightFile,
    rightColumns: evidence.rightColumns,
    leftCoverage: Number(evidence.leftCoverage?.toFixed?.(3) ?? evidence.leftCoverage ?? 0),
    rightCoverage: Number(evidence.rightCoverage?.toFixed?.(3) ?? evidence.rightCoverage ?? 0),
    likelyCardinality: evidence.likelyCardinality,
    confidence: Number(evidence.confidence?.toFixed?.(3) ?? evidence.confidence ?? 0),
    exact: Boolean(evidence.exact),
    reason: evidence.reason,
  }));
}

export function buildDatasetInterpretationPrompt({
  datasetProfile = {},
  relationshipEvidence = [],
  groupingDraft = null,
  userIntent = "",
} = {}) {
  const request = {
    task: DATASET_INTERPRETATION_TASK,
    instruction: [
      "Interpret the dataset meaning only. Return JSON only.",
      "Use exact supplied file names, column names, and evidence IDs.",
      "Do not invent files or columns. Do not return JavaScript, parser code, SQL, regex transforms, or expressions.",
      "Mark expected-output files as validation_only and update streams as update_stream.",
      "Ask concise clarifying questions when meaning is ambiguous.",
    ],
    userIntent: String(userIntent ?? "").slice(0, 1200),
    datasetProfile: compactProfile(datasetProfile),
    relationshipEvidence: compactEvidence(relationshipEvidence),
    deterministicGroupingDraft: groupingDraft,
    responseSchemaSummary: DATASET_INTERPRETATION_DRAFT_SCHEMA,
  };
  const messages = [
    { role: "system", content: "You are a local-only dataset interpretation helper. You produce non-executable JSON drafts for deterministic validation." },
    { role: "user", content: JSON.stringify(request, null, 2) },
  ];
  return {
    task: DATASET_INTERPRETATION_TASK,
    taskMode: LOCAL_MODEL_TASK_MODES.PLAN_DATASET_INTERPRETATION,
    messages,
    responseSchema: DATASET_INTERPRETATION_DRAFT_SCHEMA,
    promptChars: messages.reduce((sum, message) => sum + message.content.length, 0),
    schemaChars: JSON.stringify(DATASET_INTERPRETATION_DRAFT_SCHEMA).length,
  };
}
