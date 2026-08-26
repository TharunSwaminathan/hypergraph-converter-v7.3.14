import { resolveColumnReference, resolveFileReference } from "../datasetMappingReferenceResolver.js";
import { normalizeGraphEntityReference } from "./domains/graphIdentifierNormalizer.js";

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
  ].filter(Boolean))];
}

function hasAlias(text, alias) {
  const escaped = escapeRegExp(alias).replace(/\\ /g, "[\\s_-]+");
  return new RegExp(`(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`, "i").test(text);
}


const RESERVED_COLUMN_WORDS = new Set(["and", "not", "ignore", "run", "group", "edge", "key", "apply", "remove", "set", "use", "show", "open", "export"]);

function reservedColumnIsExplicit(raw, fileName, header) {
  if (!RESERVED_COLUMN_WORDS.has(String(header).toLowerCase())) return true;
  const h = escapeRegExp(header);
  const quoteClass = "[\"'`]";
  const optionalQuoteClass = `${quoteClass}?`;
  const fileAliases = aliasesForFile(fileName)
    .map(alias => escapeRegExp(alias).replace(/ /g, String.raw`[\s_-]+`))
    .join("|");

  return new RegExp(`${quoteClass}${h}${quoteClass}`, "i").test(raw)
    || new RegExp(String.raw`(?:${fileAliases})\.${h}\b`, "i").test(raw)
    || new RegExp(String.raw`\b(?:column|field|header)\s+${optionalQuoteClass}${h}${optionalQuoteClass}\b`, "i").test(raw)
    || new RegExp(String.raw`\b${h}\s+(?:from|in)\s+(?:${fileAliases})\b`, "i").test(raw)
    || new RegExp(String.raw`\b(?:use|set|make)\s+${optionalQuoteClass}${h}${optionalQuoteClass}\s+as\s+(?:the\s+)?(?:vertex|hyperedge|paper|author)?\s*(?:key|id|identifier)\b`, "i").test(raw);
}

export function extractFileMentions(text = "", context = {}) {
  const raw = String(text ?? "");
  const mentions = [];
  for (const fileName of context.fileNames ?? []) {
    for (const alias of aliasesForFile(fileName)) {
      if (!hasAlias(raw, alias)) continue;
      const resolved = resolveFileReference(alias, context, { purpose: "dataset mapping" });
      if (resolved.ok) {
        mentions.push({
          type: "file",
          surface: alias,
          fileName: resolved.fileName,
          method: resolved.method,
          id: `file:${resolved.fileName}`,
        });
      }
    }
  }
  return [...new Map(mentions.map(item => [item.id, item])).values()];
}

export function extractColumnMentions(text = "", context = {}) {
  const raw = String(text ?? "");
  const mentions = [];
  for (const [fileName, headers] of Object.entries(context.headersByFile ?? {})) {
    for (const header of headers ?? []) {
      if (!hasAlias(raw, header)) continue;
      if (!reservedColumnIsExplicit(raw, fileName, header)) continue;
      const resolved = resolveColumnReference(fileName, header, context);
      if (resolved.ok) {
        mentions.push({
          type: "column",
          surface: header,
          fileName,
          column: resolved.column,
          method: resolved.method,
          id: `column:${fileName}.${resolved.column}`,
        });
      }
    }
  }
  return [...new Map(mentions.map(item => [item.id, item])).values()];
}

export function extractGraphEntityMentions(text = "", protectedSpans = []) {
  const raw = String(text ?? "");
  const entities = [];
  for (const span of protectedSpans ?? []) {
    const before = raw.slice(Math.max(0, span.start - 32), span.start).toLowerCase();
    const kind = /\b(?:vertex|vertices|node|nodes)\s*$/.test(before) ? "vertex"
      : /\b(?:hyperedge|hyperedges|edge|edges|group|groups)\s*$/.test(before) ? "hyperedge"
        : null;
    if (!kind) continue;
    const value = String(span.value ?? "").trim();
    if (!value) continue;
    entities.push({
      type: kind,
      id: `${kind}:${value}`,
      value,
      normalizedValue: value,
      surface: span.text,
      quoted: true,
      quote: span.quote,
      start: span.start,
      end: span.end,
    });
  }
  const hyperedgePattern = /\bh\d[A-Za-z0-9_.:-]*\b/g;
  let match = hyperedgePattern.exec(raw);
  while (match) {
    if (isInsideProtectedSpan(match.index, protectedSpans)) {
      match = hyperedgePattern.exec(raw);
      continue;
    }
    entities.push({ type: "hyperedge", id: `hyperedge:${match[0]}`, value: match[0], surface: match[0] });
    match = hyperedgePattern.exec(raw);
  }
  const vertexPattern = /\b((?:a|an|the)?\s*(?:new\s+)?(?:vertex|vertices|node|nodes)\s+([A-Za-z0-9_.:-]+))\b/gi;
  const semanticFollowers = new Set(["key", "id", "identifier", "table", "file", "column", "columns", "field", "fields", "metadata", "time", "weight", "attribute", "attributes"]);
  match = vertexPattern.exec(raw);
  while (match) {
    if (isInsideProtectedSpan(match.index, protectedSpans)) {
      match = vertexPattern.exec(raw);
      continue;
    }
    const value = normalizeGraphEntityReference(match[0], { kind: "vertex" });
    if (value && !semanticFollowers.has(String(match[2]).toLowerCase())) {
      entities.push({ type: "vertex", id: `vertex:${value}`, value, surface: match[1] });
    }
    match = vertexPattern.exec(raw);
  }
  return entities;
}

function isInsideProtectedSpan(index, protectedSpans = []) {
  return (protectedSpans ?? []).some(span => index >= span.start && index < span.end);
}

export function extractValues(tokens = []) {
  return tokens
    .filter(token => token.type === "number")
    .map(token => ({ type: "number", value: Number(token.text), surface: token.text, start: token.start, end: token.end }));
}

export function extractEntities({ text = "", tokens = [], datasetContext = {}, protectedSpans = [] } = {}) {
  const files = extractFileMentions(text, datasetContext);
  const columns = extractColumnMentions(text, datasetContext);
  const graph = extractGraphEntityMentions(text, protectedSpans);
  return {
    entities: [...files, ...columns, ...graph],
    values: extractValues(tokens),
  };
}
