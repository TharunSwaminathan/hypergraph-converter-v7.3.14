export function buildMappingFineTuneExample({
  batch,
  preview,
  userIntent,
  mappingSpec,
  deterministicDraftMapping = null,
  modelRefinedMapping = null,
  repairedMapping = null,
  mappingValidation = null,
  selectedMappingForParser = "repairedMapping",
  parserCode = "",
  parserRunStats = null,
  expectedOutputComparison = null,
  feedback = {},
  includeFullFiles = false,
}) {
  const filesByName = new Map((batch?.files ?? []).map(file => [file.name, file]));
  const filePreviews = (preview?.files ?? []).map(file => ({
    ...file,
    ...(includeFullFiles ? { fullText: String(filesByName.get(file.fileName)?.text ?? "") } : {}),
  }));
  return {
    version: 1,
    task: "file_previews_to_mapping_spec",
    setupVersion: "v6-premapping-repair",
    includesFullFiles: Boolean(includeFullFiles),
    batchId: batch?.id ?? null,
    batchVersion: batch?.version ?? 1,
    input: {
      userIntent: String(userIntent ?? ""),
      parseMode: batch?.parseMode ?? "unknown",
      filePreviews,
      deterministicRoleGuesses: filePreviews.map(file => ({ fileName: file.fileName, role: file.deterministicRoleGuess ?? "unknown" })),
      deterministicDraftMapping,
    },
    target: { datasetMappingSpec: mappingSpec ?? null },
    deterministicDraftMapping,
    modelRefinedMapping,
    repairedMapping: repairedMapping ?? mappingSpec ?? null,
    mappingValidation: mappingValidation ?? {
      fatalErrors: [],
      repairableErrors: [],
      repairNotes: [],
      warnings: [],
      informationalNotes: [],
    },
    selectedMappingForParser,
    derived: {
      parserCode: String(parserCode ?? ""),
      parserRunStats,
      expectedOutputComparison,
    },
    acceptedByUser: Boolean(feedback.accepted),
    rejectedByUser: Boolean(feedback.rejected),
    correctedByUser: Boolean(feedback.corrected),
    parserWorked: feedback.parserWorked ?? null,
    notes: String(feedback.notes ?? ""),
  };
}

export function downloadMappingArtifact(value, fileName, type = "application/json") {
  const blob = new Blob([typeof value === "string" ? value : JSON.stringify(value, null, 2)], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
