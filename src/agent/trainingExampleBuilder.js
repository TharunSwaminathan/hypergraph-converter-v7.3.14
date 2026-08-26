export function buildParserTrainingExample({
  batch,
  preview,
  userIntent,
  modelOutput,
  validationResult,
  parserRunResult,
  userAccepted = false,
  includeFullFiles = false,
  localRuntime = null,
  modelAttempts = [],
  finalParserInserted = false,
  fallbackUsed = false,
}) {
  const previewByName = new Map((preview?.files ?? []).map(file => [file.fileName, file]));
  const files = (batch?.files ?? []).map(file => {
    const safe = previewByName.get(file.name) ?? {};
    const summary = {
      fileName: file.name,
      extension: file.extension ?? "",
      sizeBytes: file.size ?? 0,
      detectedRole: safe.deterministicRoleGuess ?? "unknown",
      headers: safe.headers ?? [],
      previewRows: safe.previewRows ?? [],
      firstLines: safe.firstLines ?? [],
      previewIsPartial: safe.previewIsPartial ?? true,
    };
    if (includeFullFiles) summary.fullText = String(file.text ?? "");
    return summary;
  });

  return {
    version: 2,
    setupVersion: "v6-premapping-repair",
    task: modelOutput?.task ?? "generate_custom_parser",
    timestamp: new Date().toISOString(),
    includesFullFiles: includeFullFiles,
    batchId: batch?.id ?? null,
    batchVersion: batch?.version ?? 1,
    parseMode: batch?.parseMode ?? "unknown",
    modelAttempts: (modelAttempts ?? []).map(attempt => ({
      task: attempt.task ?? modelOutput?.task ?? "unknown",
      status: attempt.status ?? "unknown",
      validationErrors: attempt.validationErrors ?? [],
      rawResponsePreview: String(attempt.rawResponsePreview ?? "").slice(0, 4000),
    })),
    finalParserInserted: Boolean(finalParserInserted),
    fallbackUsed: Boolean(fallbackUsed),
    activeBatchSummary: {
      files,
      parseMode: batch?.parseMode ?? "unknown",
      detectedFormat: batch?.detectedFormat?.formatId ?? null,
    },
    userIntent: String(userIntent ?? ""),
    modelOutput: modelOutput ?? null,
    validationResult: validationResult ?? { passed: false, warnings: [] },
    parserRunResult: parserRunResult ?? { passed: false, stats: null },
    userAccepted: Boolean(userAccepted),
    localRuntime: {
      runtime: localRuntime?.runtime ?? "ollama",
      activeTransport: localRuntime?.activeTransport ?? null,
      baseUrlType: "local",
      model: localRuntime?.model ?? "",
    },
    modelSetup: {
      bundledModel: false,
      runtimeExternal: true,
    },
    promptSummary: {
      filesIncluded: preview?.files?.length ?? 0,
      previewLinesPerFile: preview?.limits?.maxPreviewLinesPerFile ?? 50,
      fullFilesIncluded: Boolean(includeFullFiles),
    },
  };
}

export function downloadParserTrainingExample(example) {
  const blob = new Blob([JSON.stringify(example, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `hypergraph-parser-training-${Date.now()}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
