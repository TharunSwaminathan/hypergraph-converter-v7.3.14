const TASKS = new Set([
  "generate_mapping_spec",
  "repair_mapping_spec",
  "analyze_file_roles",
  "generate_custom_parser",
  "repair_custom_parser",
  "explain_parser_strategy",
]);

const PARSE_MODES = new Set(["together", "separate", "unknown"]);
const FILE_ROLES = new Set([
  "nodes",
  "edges",
  "incidence",
  "hyperedges",
  "metadata",
  "weights",
  "timestamps",
  "labels",
  "expected_shape",
  "csr",
  "csc",
  "json",
  "unknown",
]);

const UNSAFE_PATTERNS = [
  ["window", /\bwindow\b/i],
  ["document", /\bdocument\b/i],
  ["globalThis", /\bglobalThis\b/i],
  ["self", /\bself\b/i],
  ["postMessage", /\bpostMessage\b/i],
  ["navigator", /\bnavigator\b/i],
  ["location", /\blocation\b/i],
  ["caches", /\bcaches\b/i],
  ["localStorage", /\blocalStorage\b/i],
  ["sessionStorage", /\bsessionStorage\b/i],
  ["indexedDB", /\bindexedDB\b/i],
  ["fetch(", /\bfetch\s*\(/i],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/i],
  ["WebSocket", /\bWebSocket\b/i],
  ["Worker(", /\bWorker\s*\(/i],
  ["importScripts", /\bimportScripts\b/i],
  ["eval(", /\beval\s*\(/i],
  ["Function(", /\bFunction\s*\(/i],
  ["require(", /\brequire\s*\(/i],
  ["process", /\bprocess\b/i],
  ["Deno", /\bDeno\b/i],
  ["__dirname", /\b__dirname\b/i],
  ["while(true)", /\bwhile\s*\(\s*true\s*\)/i],
  ["for(;;)", /\bfor\s*\(\s*;\s*;\s*\)/i],
];

function stringArray(value) {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}

export function extractFirstJsonObject(rawResponse) {
  const source = String(rawResponse ?? "");
  for (let start = source.indexOf("{"); start >= 0; start = source.indexOf("{", start + 1)) {
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === "\"") quoted = false;
        continue;
      }
      if (char === "\"") quoted = true;
      else if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(source.slice(start, index + 1));
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}

export function scanParserCodeSafety(parserCode) {
  const code = String(parserCode ?? "");
  const blockedPatterns = UNSAFE_PATTERNS.filter(([, pattern]) => pattern.test(code)).map(([label]) => label);
  return {
    ok: blockedPatterns.length === 0,
    blockedPatterns,
    message: blockedPatterns.length
      ? `unsafe API detected: ${blockedPatterns.join(", ")}`
      : "",
  };
}

function syntaxErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  const line = message.match(/(?:line|<anonymous>):?\s*(\d+)/i)?.[1];
  return line
    ? `syntax error near line ${line}: ${message}`
    : `syntax error: ${message}`;
}

export function validateLocalModelResponse(rawResponse, {
  expectedTask,
  expectedParseMode,
  activeFileNames = [],
} = {}) {
  const errors = [];
  let data;
  let extracted = false;
  try {
    if (typeof rawResponse !== "string" || !rawResponse.trim()) throw new Error("empty response");
    data = JSON.parse(rawResponse.trim());
  } catch {
    data = extractFirstJsonObject(rawResponse);
    extracted = Boolean(data);
  }
  if (!data) {
    return {
      ok: false,
      data: null,
      errors: ["Response is not one valid JSON object."],
      extracted: false,
      message: "The local model responded, but it did not return valid structured JSON. I did not insert or run parser code.",
    };
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) errors.push("Response must be a JSON object.");
  if (!TASKS.has(data?.task)) errors.push("Response task is not recognized.");
  if (expectedTask && data?.task !== expectedTask) errors.push(`Expected task ${expectedTask}.`);
  if (typeof data?.summary !== "string" || !data.summary.trim()) errors.push("summary is required.");

  const mode = data?.parseMode ?? data?.parseModeRecommendation;
  if (mode !== undefined && !PARSE_MODES.has(mode)) errors.push("parseMode must be together, separate, or unknown.");
  if (data?.task === "generate_custom_parser" && !["together", "separate"].includes(data?.parseMode)) {
    errors.push("generate_custom_parser requires parseMode together or separate.");
  }
  if (data?.task === "generate_custom_parser"
    && ["together", "separate"].includes(expectedParseMode)
    && data?.parseMode !== expectedParseMode) {
    errors.push(`Generated parseMode must match the confirmed ${expectedParseMode} mode.`);
  }

  const allowedNames = new Set(activeFileNames);
  if (data?.fileRoles !== undefined) {
    if (!Array.isArray(data.fileRoles)) {
      errors.push("fileRoles must be an array.");
    } else {
      for (const role of data.fileRoles) {
        if (!role || typeof role !== "object") {
          errors.push("Every fileRoles entry must be an object.");
          continue;
        }
        if (!allowedNames.has(role.fileName)) errors.push(`fileRoles references a file outside the active batch: ${role.fileName ?? "(missing)"}.`);
        if (!FILE_ROLES.has(role.role)) errors.push(`Unsupported file role: ${role.role ?? "(missing)"}.`);
        if (role.confidence !== undefined && (typeof role.confidence !== "number" || role.confidence < 0 || role.confidence > 1)) {
          errors.push(`Invalid confidence for ${role.fileName ?? "file"}.`);
        }
        if (typeof role.reason !== "string") errors.push(`Missing role reason for ${role.fileName ?? "file"}.`);
      }
    }
  }

  for (const key of ["warnings", "assumptions", "testPlan", "fixes", "questionsForUser"]) {
    if (data?.[key] !== undefined && !stringArray(data[key])) errors.push(`${key} must be an array of strings.`);
  }

  if (data?.task === "analyze_file_roles") {
    if (!PARSE_MODES.has(data.parseModeRecommendation)) errors.push("analyze_file_roles requires parseModeRecommendation.");
    if (!Array.isArray(data.fileRoles)) errors.push("analyze_file_roles requires fileRoles.");
    if (!stringArray(data.questionsForUser)) errors.push("analyze_file_roles requires questionsForUser.");
    if (!stringArray(data.warnings)) errors.push("analyze_file_roles requires warnings.");
    if (!Array.isArray(data.joinKeys)) errors.push("analyze_file_roles requires joinKeys.");
    for (const joinKey of data.joinKeys ?? []) {
      if (!joinKey || typeof joinKey !== "object") {
        errors.push("Every joinKeys entry must be an object.");
        continue;
      }
      if (!allowedNames.has(joinKey.fileName)) errors.push(`joinKeys references a file outside the active batch: ${joinKey.fileName ?? "(missing)"}.`);
      if (typeof joinKey.column !== "string" || !joinKey.column.trim()) errors.push(`joinKeys requires a column for ${joinKey.fileName ?? "file"}.`);
      if (typeof joinKey.reason !== "string") errors.push(`joinKeys requires a reason for ${joinKey.fileName ?? "file"}.`);
    }
    for (const key of ["hyperedgeIdColumns", "vertexIdColumns", "metadataColumns"]) {
      if (data[key] !== undefined && !stringArray(data[key])) errors.push(`${key} must be an array of strings.`);
    }
    for (const role of data.fileRoles ?? []) {
      if (typeof role.confidence !== "number") errors.push(`analyze_file_roles requires confidence for ${role.fileName ?? "file"}.`);
    }
  }
  if (data?.task === "generate_custom_parser") {
    if (!Array.isArray(data.fileRoles)) errors.push("generate_custom_parser requires fileRoles.");
    if (data.expectedOutput !== "canonicalHyperedges") errors.push("generate_custom_parser expectedOutput must be canonicalHyperedges.");
    if (!stringArray(data.warnings)) errors.push("generate_custom_parser requires warnings.");
    if (!stringArray(data.assumptions)) errors.push("generate_custom_parser requires assumptions.");
    if (!stringArray(data.testPlan)) errors.push("generate_custom_parser requires testPlan.");
    for (const role of data.fileRoles ?? []) {
      if (typeof role.confidence !== "number") errors.push(`generate_custom_parser requires confidence for ${role.fileName ?? "file"}.`);
    }
  }
  if (data?.task === "repair_custom_parser") {
    if (!stringArray(data.fixes)) errors.push("repair_custom_parser requires fixes.");
    if (!stringArray(data.warnings)) errors.push("repair_custom_parser requires warnings.");
  }
  if (data?.task === "generate_custom_parser" || data?.task === "repair_custom_parser") {
    if (typeof data.parserCode !== "string" || !data.parserCode.trim()) {
      errors.push("parserCode is empty.");
    } else {
      const trimmedCode = data.parserCode.trim();
      if (trimmedCode.startsWith("{") || trimmedCode.startsWith("[")) {
        try {
          JSON.parse(trimmedCode);
          errors.push("parserCode contains JSON/config text instead of JavaScript.");
        } catch {
          // A JavaScript block may begin with a brace; normal syntax validation handles it.
        }
      }
      if (/```/.test(data.parserCode)) errors.push("parserCode contains markdown fences.");
      if (/<\/?[a-z][^>]*>/i.test(data.parserCode)) errors.push("parserCode contains HTML.");
      if (!/async\s+function\s+parseHypergraph\s*\(\s*files\s*,\s*helpers\s*\)/.test(data.parserCode)) {
        errors.push("parserCode is missing async function parseHypergraph(files, helpers).");
      }
      const safety = scanParserCodeSafety(data.parserCode);
      if (!safety.ok) errors.push(safety.message);
      try {
        Function(`"use strict";\n${data.parserCode}`);
      } catch (error) {
        errors.push(syntaxErrorMessage(error));
      }
    }
  }

  const parserErrors = errors.filter(error => /parserCode|syntax error|unsafe API|markdown|HTML|parseHypergraph/i.test(error));

  return {
    ok: errors.length === 0,
    data,
    errors,
    extracted,
    message: errors.length
      ? (parserErrors.length
        ? `${parserErrors.some(error => /JSON\/config text/i.test(error))
          ? "Direct parser generation failed because parserCode contained JSON/config text. Nothing was inserted. I can try to convert or extract that structure through the DatasetMappingSpec workflow instead."
          : "parserCode failed validation:"}\n- ${parserErrors.join("\n- ")}`
        : "The local model responded, but its JSON did not match the required schema. I did not insert or run parser code.")
      : "",
  };
}

export { FILE_ROLES, PARSE_MODES, TASKS };
