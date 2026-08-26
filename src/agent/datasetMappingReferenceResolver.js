function normalizeToken(value = "") {
  return String(value)
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.,;:!?]+$/g, "");
}

function normalizedComparable(value = "") {
  return normalizeToken(value).toLowerCase();
}

function normalizedLoose(value = "") {
  return normalizedComparable(value).replace(/[^a-z0-9]+/g, "");
}

function basenameOf(fileName = "") {
  return String(fileName).split(/[\\/]/).pop() ?? String(fileName);
}

function basenameWithoutExtension(fileName = "") {
  return basenameOf(fileName).replace(/\.[^.]+$/, "");
}

function singularAlias(value = "") {
  return value.endsWith("s") && value.length > 1 ? value.slice(0, -1) : value;
}

export function headersByFileFromProfile(datasetProfile = {}) {
  return Object.fromEntries((datasetProfile.files ?? []).map(file => [
    file.fileName,
    (file.columns ?? []).map(column => column.name),
  ]));
}

export function buildDatasetMappingReferenceContext({
  batch = null,
  datasetProfile = null,
  mappingSpec = null,
} = {}) {
  const profile = datasetProfile ?? batch?.datasetProfile ?? null;
  const fileNames = (profile?.files ?? []).map(file => file.fileName)
    .concat((batch?.files ?? []).map(file => file.name))
    .concat((mappingSpec?.files ?? []).map(file => file.fileName))
    .filter(Boolean);
  const uniqueFileNames = [...new Set(fileNames)];
  return {
    batchId: batch?.id ?? mappingSpec?.batchId ?? null,
    batchVersion: batch?.version ?? mappingSpec?.batchVersion ?? null,
    fileNames: uniqueFileNames,
    fileProfiles: profile?.files ?? [],
    headersByFile: headersByFileFromProfile(profile),
    mappingSpec,
  };
}

function aliasesForFileName(fileName) {
  const base = basenameWithoutExtension(fileName);
  const lowerBase = base.toLowerCase();
  const looseBase = normalizedLoose(base);
  return new Set([
    fileName,
    basenameOf(fileName),
    base,
    lowerBase,
    singularAlias(lowerBase),
    looseBase,
    singularAlias(looseBase),
  ].filter(Boolean).map(normalizedComparable));
}

export function resolveFileReference(reference, context = {}, {
  purpose = "file",
} = {}) {
  const raw = normalizeToken(reference);
  const files = context.fileNames ?? [];
  if (!raw) {
    return { ok: false, error: `Which ${purpose} file should I use?`, matches: [] };
  }
  const exact = files.filter(fileName => fileName === raw);
  if (exact.length === 1) return { ok: true, fileName: exact[0], method: "exact" };

  const lower = normalizedComparable(raw);
  const insensitive = files.filter(fileName => normalizedComparable(fileName) === lower);
  if (insensitive.length === 1) return { ok: true, fileName: insensitive[0], method: "case_insensitive" };
  if (insensitive.length > 1) {
    return {
      ok: false,
      ambiguous: true,
      matches: insensitive,
      error: `${insensitive.join(" and ")} could match "${raw}". Which file should ${purpose}?`,
    };
  }

  const basenameMatches = files.filter(fileName => normalizedComparable(basenameWithoutExtension(fileName)) === lower);
  if (basenameMatches.length === 1) return { ok: true, fileName: basenameMatches[0], method: "basename" };
  if (basenameMatches.length > 1) {
    return {
      ok: false,
      ambiguous: true,
      matches: basenameMatches,
      error: `${basenameMatches.join(" and ")} could match "${raw}". Which file should ${purpose}?`,
    };
  }

  const aliasMatches = files.filter(fileName => aliasesForFileName(fileName).has(lower) || aliasesForFileName(fileName).has(normalizedLoose(raw)));
  if (aliasMatches.length === 1) return { ok: true, fileName: aliasMatches[0], method: "alias" };
  if (aliasMatches.length > 1) {
    return {
      ok: false,
      ambiguous: true,
      matches: aliasMatches,
      error: `${aliasMatches.join(" and ")} could match "${raw}". Which file should ${purpose}?`,
    };
  }

  return {
    ok: false,
    missing: true,
    matches: [],
    error: `I could not find a file named "${raw}" in the active batch. Active files: ${files.join(", ") || "none"}.`,
  };
}

export function resolveColumnReference(fileName, reference, context = {}, {
  purpose = "identify records",
} = {}) {
  const raw = normalizeToken(reference);
  const headers = context.headersByFile?.[fileName] ?? [];
  if (!raw) {
    return {
      ok: false,
      error: `Which column in ${fileName} should ${purpose}? Available columns are: ${headers.join(", ") || "none"}.`,
      availableColumns: headers,
    };
  }
  const exact = headers.filter(header => header === raw);
  if (exact.length === 1) return { ok: true, column: exact[0], method: "exact" };

  const lower = normalizedComparable(raw);
  const insensitive = headers.filter(header => normalizedComparable(header) === lower);
  if (insensitive.length === 1) return { ok: true, column: insensitive[0], method: "case_insensitive" };
  if (insensitive.length > 1) {
    return {
      ok: false,
      ambiguous: true,
      availableColumns: headers,
      error: `${fileName} has multiple columns that could match "${raw}": ${insensitive.join(", ")}. Which column should ${purpose}?`,
    };
  }

  const loose = normalizedLoose(raw);
  const normalizedMatches = headers.filter(header => normalizedLoose(header) === loose);
  if (normalizedMatches.length === 1) return { ok: true, column: normalizedMatches[0], method: "normalized" };
  if (normalizedMatches.length > 1) {
    return {
      ok: false,
      ambiguous: true,
      availableColumns: headers,
      error: `${fileName} has multiple normalized matches for "${raw}": ${normalizedMatches.join(", ")}. Which column should ${purpose}?`,
    };
  }

  return {
    ok: false,
    missing: true,
    availableColumns: headers,
    error: `I found ${fileName}, but it does not contain ${raw}. Available columns are: ${headers.join(", ") || "none"}. Which column should ${purpose}?`,
  };
}

export function resolveRoleFileFromMapping(mappingSpec = {}, role) {
  return (mappingSpec.files ?? []).find(file => file.role === role)?.fileName ?? null;
}

export function columnsForFile(context = {}, fileName) {
  return context.headersByFile?.[fileName] ?? [];
}

export function fileRoleFromDesiredOrSpec(fileName, desiredRoles = new Map(), mappingSpec = {}) {
  return desiredRoles.get(fileName)
    ?? (mappingSpec.files ?? []).find(file => file.fileName === fileName)?.role
    ?? "unknown";
}
