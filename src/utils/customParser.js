// AI-prompt helper and the trusted-code Custom Parser disposable Web Worker runner.
import { parse as parseJavaScript } from "acorn";
import { buildExternalAiPrompt } from "../agent/prompts/externalAiPromptPrompt.js";
import { normalizeHyperedges } from "./parsers.js";
export { parseDelimited, parseCSV, splitLines } from "./delimitedText.js";


export function buildAiPrompt(text, options = {}) {
  return buildExternalAiPrompt(text, options);
}

// ── Custom parser (Web Worker) ────────────────────────────────────────────────
export const DEFAULT_CUSTOM_PARSER = `// Define: async function parseHypergraph(files, helpers)
// files: [{name, text, size, type}]
// helpers: { splitLines, unique, parseDelimited, parseCSV, groupBy, indexBy, splitList }
// Return: array of {id, vertices, time?, weight?}

async function parseHypergraph(files, helpers) {
  const hyperedges = [];
  for (const file of files) {
    const lines = helpers.splitLines(file.text, { comments: true });
    for (const line of lines) {
      const ci = line.indexOf(":");
      if (ci === -1) continue;
      const id = line.slice(0, ci).trim();
      const vertices = line.slice(ci + 1).trim().split(/[\\s,]+/).filter(Boolean);
      hyperedges.push({ id, vertices, time: null, weight: 1 });
    }
  }
  return hyperedges;
}`;

export function buildBatchCustomParserTemplate(batch) {
  const roleByName = Object.fromEntries((batch?.fileSummaries ?? []).map(summary => [summary.name, summary.role]));
  if (batch?.parseMode === "separate") {
    return `// Separate-file starter.
// The dashboard displays one active graph at a time. Select one file per run.
async function parseHypergraph(files, helpers) {
  const file = files[0];
  if (!file) return [];
  const hyperedges = [];
  for (const [index, line] of helpers.splitLines(file.text, { comments: true }).entries()) {
    const colon = line.indexOf(":");
    if (colon >= 0) {
      hyperedges.push({
        id: line.slice(0, colon).trim() || \`h\${index + 1}\`,
        vertices: helpers.unique(line.slice(colon + 1).split(/[\\s,]+/)),
      });
    }
  }
  return hyperedges;
}`;
  }

  return `// Combined-dataset starter generated from deterministic file-role checks.
// Reads every active file together and returns one canonical hypergraph.
async function parseHypergraph(files, helpers) {
  const roleByName = ${JSON.stringify(roleByName, null, 2)};
  const groups = new Map();
  const weights = new Map();
  const timestamps = new Map();

  const add = (edge, vertex) => {
    edge = String(edge ?? "").trim();
    vertex = String(vertex ?? "").trim();
    if (!edge || !vertex) return;
    if (!groups.has(edge)) groups.set(edge, new Set());
    groups.get(edge).add(vertex);
  };

  for (const file of files) {
    const role = roleByName[file.name] ?? "unknown";
    const rows = helpers.parseCSV(file.text);

    if (role === "weights" || role === "timestamps") {
      for (const row of rows) {
        const idKey = Object.keys(row).find(key => /^(hyper)?edge(_?id)?$|^id$/i.test(key));
        const valueKey = Object.keys(row).find(key => role === "weights" ? /weight/i.test(key) : /time|timestamp|date/i.test(key));
        if (idKey && valueKey) (role === "weights" ? weights : timestamps).set(String(row[idKey]), row[valueKey]);
      }
      continue;
    }
    if (["nodes", "metadata", "labels"].includes(role)) continue;

    if (rows.length) {
      for (const [index, row] of rows.entries()) {
        const keys = Object.keys(row);
        const edgeKey = keys.find(key => /hyperedge|edge(_?id)?/i.test(key));
        const vertexKey = keys.find(key => /vertex|node|member/i.test(key));
        const sourceKey = keys.find(key => /^source$/i.test(key));
        const targetKey = keys.find(key => /^target$/i.test(key));
        if (edgeKey && vertexKey) add(row[edgeKey], row[vertexKey]);
        else if (sourceKey && targetKey) {
          const edgeId = row.id || \`\${file.name}-\${index + 1}\`;
          add(edgeId, row[sourceKey]);
          add(edgeId, row[targetKey]);
        }
      }
      continue;
    }

    for (const [index, line] of helpers.splitLines(file.text, { comments: true }).entries()) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const edgeId = line.slice(0, colon).trim() || \`\${file.name}-\${index + 1}\`;
      for (const vertex of line.slice(colon + 1).split(/[\\s,]+/)) add(edgeId, vertex);
    }
  }

  return [...groups.entries()].map(([id, vertices]) => ({
    id,
    vertices: [...vertices],
    weight: Number(weights.get(id) ?? 1),
    time: timestamps.get(id) ?? null,
    attributes: {},
  }));
}`;
}

// Normalize any of the 4 return formats from custom parser into canonical hyperedges
export function normalizeCustomParserOutput(result) {
  if (!result || typeof result !== "object") throw new Error("Parser must return an object or array.");

  // Plain array
  if (Array.isArray(result)) {
    const { hyperedges, warnings } = normalizeHyperedges(result);
    return { hyperedges, warnings, source: "custom parser (array)" };
  }
  // canonicalHyperedges / hyperedges key
  if (Array.isArray(result.canonicalHyperedges) || Array.isArray(result.hyperedges)) {
    const arr = result.canonicalHyperedges ?? result.hyperedges;
    const { hyperedges, warnings } = normalizeHyperedges(arr);
    return { hyperedges, warnings, source: result.metadata?.source ?? "custom parser (canonical)" };
  }
  // h2v object
  if (result.h2v && typeof result.h2v === "object" && !Array.isArray(result.h2v)) {
    const raw = Object.entries(result.h2v).map(([id, vertices]) => ({ id, vertices, time: null, weight: 1, attributes: {} }));
    const { hyperedges, warnings } = normalizeHyperedges(raw);
    return { hyperedges, warnings, source: result.metadata?.source ?? "custom parser (h2v)" };
  }
  // incidences list
  if (Array.isArray(result.incidences)) {
    const groups = new Map();
    for (const row of result.incidences) {
      const edgeId = String(row.edge ?? row.hyperedge ?? row.hyperedge_id ?? "");
      const vertexId = String(row.node ?? row.vertex ?? row.vertex_id ?? "");
      if (!edgeId || !vertexId) continue;
      if (!groups.has(edgeId)) groups.set(edgeId, []);
      groups.get(edgeId).push(vertexId);
    }
    const raw = [...groups.entries()].map(([id, vertices]) => ({ id, vertices, time: null, weight: 1, attributes: {} }));
    const { hyperedges, warnings } = normalizeHyperedges(raw);
    return { hyperedges, warnings, source: result.metadata?.source ?? "custom parser (incidences)" };
  }
  throw new Error("Parser result must contain canonicalHyperedges, hyperedges, h2v, incidences, or be an array.");
}

export const CUSTOM_PARSER_LIMITS = Object.freeze({
  timeoutMs: 5000,
  maxFiles: 50,
  maxTotalChars: 2_000_000,
  maxFileChars: 1_000_000,
  maxLogEntries: 80,
  maxLogChars: 16_000,
  maxHyperedges: 100_000,
  maxIncidences: 2_000_000,
  maxOutputNodes: 2_250_000,
  maxOutputDepth: 32,
  maxOutputStringChars: 1_000_000,
  maxTotalOutputChars: 16_000_000,
});

const BLOCKED_PARSER_PATTERNS = Object.freeze([
  { id: "eval", pattern: /\beval\s*\(/i },
  { id: "function_constructor", pattern: /\bnew\s+Function\b|\bFunction\s*\(|\.\s*constructor\b|\[\s*["']constructor["']\s*\]/i },
  { id: "prototype_escape", pattern: /(?<![\w$])(?:__proto__|prototype|Reflect|Proxy|getPrototypeOf|setPrototypeOf|getOwnPropertyNames|getOwnPropertyDescriptor|getOwnPropertyDescriptors|defineProperty|defineProperties|__defineGetter__|__defineSetter__|__lookupGetter__|__lookupSetter__)\b/i },
  { id: "dynamic_import", pattern: /\bimport\s*\(/i },
  { id: "network", pattern: /(?<![.\w$])(?:fetch|XMLHttpRequest|WebSocket|EventSource|BroadcastChannel|WebTransport|sendBeacon)\b/i },
  { id: "worker_spawn", pattern: /(?<![.\w$])(?:Worker|SharedWorker|ServiceWorker|importScripts)\b/i },
  { id: "global_access", pattern: /(?<![.\w$])(?:globalThis|self|window|document|navigator|location|parent|top|opener|frames)\b/i },
  { id: "storage", pattern: /(?<![.\w$])(?:localStorage|sessionStorage|indexedDB|caches|cookieStore)\b/i },
  { id: "host_runtime", pattern: /(?<![.\w$])(?:process|require|module|exports|Deno|Bun)\b/i },
  { id: "active_content", pattern: /(?<![.\w$])(?:WebAssembly|Blob|FileReader|FileReaderSync|Notification|crypto|WeakRef|FinalizationRegistry)\b/i },
  { id: "global_mutation", pattern: /\bdelete\b|\bpostMessage\b|\bclose\s*\(/i },
]);

const FORBIDDEN_FREE_GLOBALS = Object.freeze(new Set([
  "eval", "Function", "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "BroadcastChannel", "WebTransport",
  "sendBeacon", "Worker", "SharedWorker", "ServiceWorker", "importScripts", "globalThis", "self", "window",
  "document", "navigator", "location", "parent", "top", "opener", "frames", "localStorage", "sessionStorage",
  "indexedDB", "caches", "cookieStore", "process", "require", "module", "exports", "Deno", "Bun", "WebAssembly",
  "Blob", "FileReader", "FileReaderSync", "Notification", "crypto", "WeakRef", "FinalizationRegistry", "Proxy",
  "Reflect", "postMessage", "close",
]));

const FORBIDDEN_MEMBER_PROPERTIES = Object.freeze(new Set([
  "constructor", "prototype", "__proto__", "getPrototypeOf", "setPrototypeOf", "getOwnPropertyNames",
  "getOwnPropertyDescriptor", "getOwnPropertyDescriptors", "defineProperty", "defineProperties",
  "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__",
]));

const DEFAULT_ALLOWED_GLOBALS = Object.freeze(new Set([
  "Array", "ArrayBuffer", "BigInt", "Boolean", "Date", "Error", "Infinity", "Intl", "JSON", "Map", "Math",
  "NaN", "Number", "Object", "Promise", "RangeError", "ReferenceError", "RegExp", "Set", "String", "SyntaxError",
  "TypeError", "URIError", "URL", "URLSearchParams", "console", "decodeURI", "decodeURIComponent", "encodeURI",
  "encodeURIComponent", "helpers", "isFinite", "isNaN", "parseFloat", "parseInt", "files", "undefined",
]));

const STATIC_STRING_CONCAT_RE = /((?:["'][^"'\\]*(?:\\.[^"'\\]*)*["']\s*\+\s*)+["'][^"'\\]*(?:\\.[^"'\\]*)*["'])/g;
const SENSITIVE_COMPUTED_NAMES = Object.freeze(new Set([
  "constructor", "prototype", "__proto__", "fetch", "eval", "function", "globalthis", "self", "window",
  "document", "navigator", "xmlhttprequest", "websocket", "eventsource", "broadcastchannel", "webtransport",
  "sendbeacon", "worker", "sharedworker", "importscripts", "postmessage", "location", "process", "require",
]));

export function validateParserCodeSafety(code) {
  const source = String(code ?? "");
  const astAnalysis = analyzeParserCodeAst(source);
  const violations = astAnalysis.parsed
    ? astAnalysis.violations
    : BLOCKED_PARSER_PATTERNS
      .filter(item => item.pattern.test(stripCommentsAndStrings(source)))
      .map(item => item.id);
  for (const expression of source.match(STATIC_STRING_CONCAT_RE) ?? []) {
    const resolved = resolveStaticStringConcat(expression)?.toLowerCase();
    if (resolved && SENSITIVE_COMPUTED_NAMES.has(resolved)) violations.push(`computed_${resolved}`);
  }
  const uniqueViolations = [...new Set(violations)];
  return {
    ok: uniqueViolations.length === 0,
    violations: uniqueViolations,
    error: uniqueViolations.length
      ? `Blocked API inside custom parser trusted-code guard: ${uniqueViolations.join(", ")}. The disposable worker accepts only reviewed, trusted, deterministic, offline, data-only parser code.`
      : "",
  };
}

function analyzeParserCodeAst(source) {
  let ast;
  try {
    ast = parseJavaScript(source, {
      ecmaVersion: "latest",
      sourceType: "script",
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
    });
  } catch {
    return { parsed: false, violations: [] };
  }
  const violations = [];
  const rootScope = new Scope(null);
  DEFAULT_ALLOWED_GLOBALS.forEach(name => rootScope.declare(name));
  walkAst(ast, rootScope, violations);
  return { parsed: true, violations };
}

class Scope {
  constructor(parent) {
    this.parent = parent;
    this.names = new Set();
  }

  declare(name) {
    if (name) this.names.add(name);
  }

  has(name) {
    return this.names.has(name) || Boolean(this.parent?.has(name));
  }
}

function walkAst(node, scope, violations) {
  if (!node || typeof node.type !== "string") return;
  switch (node.type) {
    case "Program":
      node.body.forEach(child => walkAst(child, scope, violations));
      return;
    case "ImportDeclaration":
      violations.push("static_import");
      return;
    case "VariableDeclaration":
      node.declarations.forEach(declaration => {
        declarePattern(declaration.id, scope);
        walkAst(declaration.init, scope, violations);
      });
      return;
    case "FunctionDeclaration":
      scope.declare(node.id?.name);
      walkFunction(node, scope, violations);
      return;
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      walkFunction(node, scope, violations);
      return;
    case "ClassDeclaration":
      scope.declare(node.id?.name);
      violations.push("class_definition");
      return;
    case "ClassExpression":
      violations.push("class_definition");
      return;
    case "BlockStatement": {
      const childScope = new Scope(scope);
      node.body.forEach(child => walkAst(child, childScope, violations));
      return;
    }
    case "CatchClause": {
      const childScope = new Scope(scope);
      declarePattern(node.param, childScope);
      walkAst(node.body, childScope, violations);
      return;
    }
    case "Identifier":
      checkIdentifierReference(node.name, scope, violations);
      return;
    case "MemberExpression":
    case "OptionalMemberExpression":
      walkAst(node.object, scope, violations);
      if (node.computed) {
        const staticName = staticPropertyName(node.property);
        if (staticName && SENSITIVE_COMPUTED_NAMES.has(staticName.toLowerCase())) violations.push(`computed_${staticName.toLowerCase()}`);
        else walkAst(node.property, scope, violations);
      } else if (node.property?.name && FORBIDDEN_MEMBER_PROPERTIES.has(node.property.name)) {
        violations.push("prototype_escape");
      }
      return;
    case "CallExpression":
    case "OptionalCallExpression":
    case "NewExpression":
      if (node.callee?.type === "Import") violations.push("dynamic_import");
      if (node.callee?.type === "Identifier" && node.callee.name === "Function" && !scope.has("Function")) violations.push("function_constructor");
      walkAst(node.callee, scope, violations);
      node.arguments?.forEach(argument => walkAst(argument, scope, violations));
      return;
    case "UnaryExpression":
      if (node.operator === "delete") violations.push("global_mutation");
      walkAst(node.argument, scope, violations);
      return;
    case "Property":
      if (node.computed) walkAst(node.key, scope, violations);
      walkAst(node.value, scope, violations);
      return;
    case "PropertyDefinition":
    case "MethodDefinition":
      if (node.computed) walkAst(node.key, scope, violations);
      walkAst(node.value, scope, violations);
      return;
    case "LabeledStatement":
      walkAst(node.body, scope, violations);
      return;
    case "BreakStatement":
    case "ContinueStatement":
    case "Literal":
    case "TemplateElement":
    case "ThisExpression":
    case "Super":
    case "MetaProperty":
    case "Import":
      return;
    default:
      for (const [key, value] of Object.entries(node)) {
        if (key === "type" || key === "start" || key === "end" || key === "loc" || key === "range") continue;
        if (Array.isArray(value)) value.forEach(child => walkAst(child, scope, violations));
        else if (value && typeof value.type === "string") walkAst(value, scope, violations);
      }
  }
}

function walkFunction(node, scope, violations) {
  const childScope = new Scope(scope);
  childScope.declare(node.id?.name);
  node.params?.forEach(param => declarePattern(param, childScope));
  walkAst(node.body, childScope, violations);
}

function declarePattern(pattern, scope) {
  if (!pattern) return;
  if (pattern.type === "Identifier") {
    scope.declare(pattern.name);
    return;
  }
  if (pattern.type === "RestElement") {
    declarePattern(pattern.argument, scope);
    return;
  }
  if (pattern.type === "AssignmentPattern") {
    declarePattern(pattern.left, scope);
    return;
  }
  if (pattern.type === "ArrayPattern") {
    pattern.elements.forEach(element => declarePattern(element, scope));
    return;
  }
  if (pattern.type === "ObjectPattern") {
    pattern.properties.forEach(property => {
      if (property.type === "RestElement") declarePattern(property.argument, scope);
      else declarePattern(property.value, scope);
    });
  }
}

function checkIdentifierReference(name, scope, violations) {
  if (!name || scope.has(name)) return;
  if (FORBIDDEN_FREE_GLOBALS.has(name)) violations.push(globalViolationId(name));
}

function globalViolationId(name) {
  if (["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "BroadcastChannel", "WebTransport", "sendBeacon"].includes(name)) return "network";
  if (["Worker", "SharedWorker", "ServiceWorker", "importScripts"].includes(name)) return "worker_spawn";
  if (["globalThis", "self", "window", "document", "navigator", "location", "parent", "top", "opener", "frames"].includes(name)) return "global_access";
  if (["localStorage", "sessionStorage", "indexedDB", "caches", "cookieStore"].includes(name)) return "storage";
  if (["process", "require", "module", "exports", "Deno", "Bun"].includes(name)) return "host_runtime";
  if (["WebAssembly", "Blob", "FileReader", "FileReaderSync", "Notification", "crypto", "WeakRef", "FinalizationRegistry"].includes(name)) return "active_content";
  if (["Reflect", "Proxy"].includes(name)) return "prototype_escape";
  if (["postMessage", "close"].includes(name)) return "global_mutation";
  if (name === "eval") return "eval";
  if (name === "Function") return "function_constructor";
  return `global_${name.toLowerCase()}`;
}

function staticPropertyName(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0]?.value?.cooked ?? null;
  if (node.type === "BinaryExpression" && node.operator === "+") {
    const left = staticPropertyName(node.left);
    const right = staticPropertyName(node.right);
    return left != null && right != null ? left + right : null;
  }
  return null;
}

function stripCommentsAndStrings(source) {
  const s = String(source ?? "");
  let out = "";
  let i = 0;
  let mode = "code";
  let quote = "";
  while (i < s.length) {
    const ch = s[i];
    const next = s[i + 1];
    if (mode === "line_comment") {
      if (ch === "\n") { mode = "code"; out += "\n"; } else out += " ";
      i += 1;
      continue;
    }
    if (mode === "block_comment") {
      if (ch === "*" && next === "/") { out += "  "; i += 2; mode = "code"; }
      else { out += ch === "\n" ? "\n" : " "; i += 1; }
      continue;
    }
    if (mode === "string") {
      if (ch === "\\") { out += " "; if (next) out += next === "\n" ? "\n" : " "; i += 2; continue; }
      if (ch === quote) { out += " "; i += 1; mode = "code"; quote = ""; continue; }
      out += ch === "\n" ? "\n" : " ";
      i += 1;
      continue;
    }
    if (ch === "/" && next === "/") { out += "  "; i += 2; mode = "line_comment"; continue; }
    if (ch === "/" && next === "*") { out += "  "; i += 2; mode = "block_comment"; continue; }
    if (ch === "\"" || ch === "'" || ch === "`") { quote = ch; out += " "; i += 1; mode = "string"; continue; }
    out += ch;
    i += 1;
  }
  return out;
}

function resolveStaticStringConcat(expression) {
  try {
    const parts = String(expression).split(/\s*\+\s*/);
    if (!parts.length || parts.some(part => !/^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.test(part))) return null;
    return parts.map(part => {
      if (part.startsWith('"')) return JSON.parse(part);
      const body = part.slice(1, -1)
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, "\\")
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t");
      return body;
    }).join("");
  } catch {
    return null;
  }
}

export function sanitizeParserFiles(files, limits = CUSTOM_PARSER_LIMITS) {
  if ((files ?? []).length > limits.maxFiles) throw new Error(`Parser input limit exceeded: at most ${limits.maxFiles} files are allowed.`);
  const safeFiles = (files ?? []).slice(0, limits.maxFiles).map((file, index) => {
    const originalText = String(file?.text ?? "");
    if (originalText.length > limits.maxFileChars) {
      throw new Error(`Parser input limit exceeded: ${file?.name ?? `file-${index + 1}`} is larger than ${limits.maxFileChars.toLocaleString()} characters.`);
    }
    const text = originalText;
    return {
      id: String(file?.id ?? `file-${index + 1}`),
      name: String(file?.name ?? `file-${index + 1}`).slice(0, 240),
      text,
      size: Number.isFinite(Number(file?.size)) ? Number(file.size) : text.length,
      type: String(file?.type ?? "").slice(0, 120),
    };
  });
  const totalChars = safeFiles.reduce((sum, file) => sum + file.text.length, 0);
  if (totalChars > limits.maxTotalChars) throw new Error(`Parser input limit exceeded: at most ${limits.maxTotalChars.toLocaleString()} total characters are allowed.`);
  return safeFiles;
}

export function enforceParserOutputLimits(result, limits = CUSTOM_PARSER_LIMITS) {
  const effectiveLimits = { ...CUSTOM_PARSER_LIMITS, ...(limits ?? {}) };
  assertPlainSerializable(result, new WeakSet(), "result", effectiveLimits);
  limits = effectiveLimits;
  const hyperedges = Array.isArray(result)
    ? result
    : Array.isArray(result?.canonicalHyperedges)
      ? result.canonicalHyperedges
      : Array.isArray(result?.hyperedges)
        ? result.hyperedges
        : null;
  if (hyperedges && hyperedges.length > limits.maxHyperedges) {
    throw new Error(`Parser output limit exceeded: at most ${limits.maxHyperedges.toLocaleString()} hyperedges are allowed.`);
  }
  const incidenceCount = hyperedges
    ? hyperedges.reduce((sum, hyperedge) => sum + (Array.isArray(hyperedge?.vertices) ? hyperedge.vertices.length : 0), 0)
    : Array.isArray(result?.incidences)
      ? result.incidences.length
      : result?.h2v && typeof result.h2v === "object"
        ? Object.values(result.h2v).reduce((sum, vertices) => sum + (Array.isArray(vertices) ? vertices.length : 0), 0)
        : 0;
  if (incidenceCount > limits.maxIncidences) {
    throw new Error(`Parser output limit exceeded: at most ${limits.maxIncidences.toLocaleString()} incidences are allowed.`);
  }
  return result;
}

export function assertPlainSerializable(value, active = new WeakSet(), path = "result", options = {}) {
  const limits = { ...CUSTOM_PARSER_LIMITS, ...(options?.limits ?? options ?? {}) };
  const state = options?.state ?? { nodes: 0, totalStringChars: 0 };
  const visited = options?.visited ?? new WeakSet();
  const depth = options?.depth ?? 0;
  if (depth > limits.maxOutputDepth) throw new Error(`Parser output exceeds maximum nesting depth at ${path}.`);
  if (value === null) return;
  const t = typeof value;
  if (t === "string") {
    if (value.length > limits.maxOutputStringChars) throw new Error(`Parser output string is too large at ${path}.`);
    state.totalStringChars += value.length;
    if (state.totalStringChars > limits.maxTotalOutputChars) throw new Error("Parser output contains too much text.");
    return;
  }
  if (["number", "boolean"].includes(t)) return;
  if (["undefined", "function", "symbol", "bigint"].includes(t)) throw new Error(`Parser output contains a non-serializable value at ${path}.`);
  if (t !== "object") return;
  if (active.has(value)) throw new Error(`Parser output contains a cyclic reference at ${path}.`);
  if (visited.has(value)) return;
  state.nodes += 1;
  if (state.nodes > limits.maxOutputNodes) throw new Error(`Parser output exceeds the ${limits.maxOutputNodes.toLocaleString()} node limit.`);
  active.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPlainSerializable(item, active, `${path}[${index}]`, { limits, state, visited, depth: depth + 1 }));
    active.delete(value);
    visited.add(value);
    return;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new Error(`Parser output must use plain objects at ${path}.`);
  }
  for (const [key, child] of Object.entries(value)) {
    if (key.length > 240) throw new Error(`Parser output contains an oversized property name at ${path}.`);
    assertPlainSerializable(child, active, `${path}.${key}`, { limits, state, visited, depth: depth + 1 });
  }
  active.delete(value);
  visited.add(value);
}

export function runCustomParser(code, files, options = {}) {
  const effectiveLimits = { ...CUSTOM_PARSER_LIMITS, ...(options.limits ?? {}) };
  const safety = validateParserCodeSafety(code);
  if (!safety.ok) return Promise.reject(new Error(safety.error));
  let safeFiles;
  try {
    safeFiles = sanitizeParserFiles(files, effectiveLimits);
  } catch (error) {
    return Promise.reject(error);
  }
  const workerSrc = `
    const splitLines=(text,opts={})=>{const{trim=true,skipEmpty=true,comments=false}=opts;return String(text??"").split(/\\r?\\n/).map(l=>{const u=comments?l.replace(/#.*$/,""):l;return trim?u.trim():u;}).filter(l=>!skipEmpty||l.length>0);};
    const unique=arr=>[...new Set((arr??[]).map(s=>String(s).trim()).filter(Boolean))];
    const splitDelimitedRows=(text,delimiter=",")=>{const rows=[];let row=[],cell="",quoted=false;const source=String(text??"");for(let i=0;i<source.length;i++){const ch=source[i],next=source[i+1];if(quoted){if(ch==="\\""&&next==="\\""){cell+="\\"";i++;}else if(ch==="\\""){quoted=false;}else cell+=ch;continue;}if(ch==="\\"")quoted=true;else if(ch===delimiter){row.push(cell);cell="";}else if(ch==="\\n"||ch==="\\r"){if(ch==="\\r"&&next==="\\n")i++;row.push(cell);if(row.some(v=>v!==""))rows.push(row);row=[];cell="";}else cell+=ch;}row.push(cell);if(row.some(v=>v!==""))rows.push(row);return rows;};
    const detectDelimiterHelper=text=>[",","\\t",";","|"].map(d=>{const rows=splitDelimitedRows(text,d).slice(0,12);const widths=rows.map(r=>r.length);const expected=[...new Set(widths)].sort((a,b)=>widths.filter(x=>x===b).length-widths.filter(x=>x===a).length)[0]??0;return{d,score:expected>1?expected*4+widths.filter(w=>w===expected).length:0};}).sort((a,b)=>b.score-a.score)[0]?.d??",";
    const parseDelimitedHelper=(text,opts={})=>{const delimiter=opts.delimiter??detectDelimiterHelper(text);const rows=splitDelimitedRows(text,delimiter);if(!rows.length)return{delimiter,headers:[],rows:[],records:[]};const first=rows[0],second=rows[1]??[];const autoHeader=new Set(first.map(v=>String(v).trim().toLowerCase())).size===first.length&&first.some(v=>/id|name|source|target|vertex|edge|year|time|weight/i.test(String(v)))&&second.length>0;const hasHeader=opts.hasHeader==="auto"||opts.hasHeader===undefined?autoHeader:Boolean(opts.hasHeader);const headers=hasHeader?first.map((v,i)=>String(v||\`column_\${i+1}\`).trim()):first.map((_,i)=>\`column_\${i+1}\`);const data=hasHeader?rows.slice(1):rows;const records=data.map(r=>Object.fromEntries(headers.map((h,i)=>[h,String(r[i]??"").trim()])));return{delimiter,headers,rows:data,records};};
    const parseCSVHelper=text=>parseDelimitedHelper(text,{delimiter:","}).records;
    const indexBy=(items,key)=>{const map=new Map();for(const item of items??[]){const value=typeof key==="function"?key(item):item?.[key];map.set(String(value??""),item);}return map;};
    const splitList=(value,delimiter=/[;|,]/)=>String(value??"").split(delimiter).map(v=>v.trim()).filter(Boolean);
    const groupBy=(items,keyFn)=>{const m=new Map();for(const item of items??[]){const k=typeof keyFn==="function"?keyFn(item):item?.[keyFn];const key=String(k??"");if(!m.has(key))m.set(key,[]);m.get(key).push(item);}return m;};
    const buildFromIncidence=(rows,edgeKey="hyperedge",vertexKey="vertex")=>{const groups=new Map();for(const row of rows??[]){const edge=String(row?.[edgeKey]??row?.edge??row?.hyperedge??row?.hyperedge_id??"").trim();const vertex=String(row?.[vertexKey]??row?.vertex??row?.node??row?.vertex_id??"").trim();if(!edge||!vertex)continue;if(!groups.has(edge))groups.set(edge,new Set());groups.get(edge).add(vertex);}return [...groups.entries()].map(([id,vertices])=>({id,vertices:[...vertices],time:null,weight:1,attributes:{}}));};
    const toCanonical=value=>Array.isArray(value)?value.map((item,index)=>({id:String(item?.id??item?.hyperedge??item?.edge??\`h\${index+1}\`),vertices:unique(item?.vertices??item?.nodes??item?.members??[]),time:item?.time??item?.timestamp??null,weight:Number(item?.weight??1),attributes:item?.attributes??{}})):value;
    const IntrinsicObject=Object;
    const IntrinsicFunction=Function;
    const blocked=()=>{throw new Error("Blocked API inside custom parser worker.");};
    const safeObject=IntrinsicObject.freeze({
      keys:IntrinsicObject.keys.bind(IntrinsicObject),
      values:IntrinsicObject.values.bind(IntrinsicObject),
      entries:IntrinsicObject.entries.bind(IntrinsicObject),
      fromEntries:IntrinsicObject.fromEntries.bind(IntrinsicObject),
      assign:IntrinsicObject.assign.bind(IntrinsicObject),
      hasOwn:IntrinsicObject.hasOwn.bind(IntrinsicObject),
      freeze:IntrinsicObject.freeze.bind(IntrinsicObject),
      isFrozen:IntrinsicObject.isFrozen.bind(IntrinsicObject),
    });
    const hardenIntrinsicConstructors=()=>{
      const prototypes=[
        IntrinsicObject.prototype,Array.prototype,IntrinsicFunction.prototype,
        IntrinsicObject.getPrototypeOf(async function(){}),
        IntrinsicObject.getPrototypeOf(function*(){}),
        IntrinsicObject.getPrototypeOf(async function*(){}),
        String.prototype,Number.prototype,Boolean.prototype,RegExp.prototype,Date.prototype,
        Map.prototype,Set.prototype,WeakMap.prototype,WeakSet.prototype,Promise.prototype,
        Error.prototype,TypeError.prototype,RangeError.prototype,ReferenceError.prototype,SyntaxError.prototype,
      ];
      for(const proto of prototypes){
        if(!proto)continue;
        try{IntrinsicObject.defineProperty(proto,"constructor",{value:undefined,writable:false,configurable:false});}catch{}
      }
      try{IntrinsicObject.defineProperty(IntrinsicObject.prototype,"__proto__",{value:undefined,writable:false,configurable:false});}catch{}
    };
    for(const name of ["fetch","XMLHttpRequest","WebSocket","EventSource","BroadcastChannel","WebTransport","Worker","SharedWorker","ServiceWorker","importScripts","localStorage","sessionStorage","indexedDB","caches","cookieStore","navigator","location"]){
      try{self[name]=name==="fetch"||name==="importScripts"?blocked:undefined;}catch{}
    }
    const pushLog=(logs,value)=>{if(logs.length<${CUSTOM_PARSER_LIMITS.maxLogEntries})logs.push(String(value).slice(0,500));};
    const deepFreeze=value=>{if(!value||typeof value!=="object"||Object.isFrozen(value))return value;Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);return value;};
    const boundedClone=(value,limits,state={nodes:0,chars:0},active=new WeakSet(),visited=new WeakMap(),depth=0,path="result")=>{if(depth>limits.maxOutputDepth)throw new Error("Parser output exceeds maximum nesting depth at "+path+".");if(value===null)return null;const t=typeof value;if(t==="string"){if(value.length>limits.maxOutputStringChars)throw new Error("Parser output string is too large at "+path+".");state.chars+=value.length;if(state.chars>limits.maxTotalOutputChars)throw new Error("Parser output contains too much text.");return value;}if(t==="number"||t==="boolean")return value;if(t==="undefined"||t==="function"||t==="symbol"||t==="bigint")throw new Error("Parser output contains a non-serializable value at "+path+".");if(t!=="object")return value;if(active.has(value))throw new Error("Parser output contains a cyclic reference at "+path+".");if(visited.has(value))return visited.get(value);state.nodes++;if(state.nodes>limits.maxOutputNodes)throw new Error("Parser output exceeds the node limit.");active.add(value);if(Array.isArray(value)){const arr=[];visited.set(value,arr);for(let index=0;index<value.length;index++)arr[index]=boundedClone(value[index],limits,state,active,visited,depth+1,path+"["+index+"]");active.delete(value);return arr;}const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)throw new Error("Parser output must use plain objects at "+path+".");const out={};visited.set(value,out);for(const [key,child] of Object.entries(value)){if(key.length>240)throw new Error("Parser output contains an oversized property name at "+path+".");out[key]=boundedClone(child,limits,state,active,visited,depth+1,path+"."+key);}active.delete(value);return out;};
    const enforceShapeLimits=(result,limits)=>{const hyperedges=Array.isArray(result)?result:Array.isArray(result?.canonicalHyperedges)?result.canonicalHyperedges:Array.isArray(result?.hyperedges)?result.hyperedges:null;if(hyperedges&&hyperedges.length>limits.maxHyperedges)throw new Error("Parser output exceeds the hyperedge limit.");const incidences=hyperedges?hyperedges.reduce((sum,edge)=>sum+(Array.isArray(edge?.vertices)?edge.vertices.length:0),0):Array.isArray(result?.incidences)?result.incidences.length:result?.h2v&&typeof result.h2v==="object"?Object.values(result.h2v).reduce((sum,vertices)=>sum+(Array.isArray(vertices)?vertices.length:0),0):0;if(incidences>limits.maxIncidences)throw new Error("Parser output exceeds the incidence limit.");};
    self.onmessage=async(e)=>{
      const{code,files,limits}=e.data;const logs=[];
      const origLog=console.log,origWarn=console.warn;
      console.log=(...a)=>{pushLog(logs,a.map(String).join(" "));};
      console.warn=(...a)=>{pushLog(logs,"WARN: "+a.map(String).join(" "));};
      try{
        const helpers=deepFreeze({splitLines,unique,parseDelimited:parseDelimitedHelper,parseCSV:parseCSVHelper,groupBy,indexBy,splitList,toCanonical,buildFromIncidence});
        deepFreeze(files);
        // Serialize the nested function body; eval cannot be a strict-mode formal parameter.
        const fn=new IntrinsicFunction("files","helpers","fetch","XMLHttpRequest","WebSocket","EventSource","BroadcastChannel","WebTransport","Worker","SharedWorker","ServiceWorker","importScripts","globalThis","self","window","document","navigator","location","process","require","module","exports","Function","Reflect","Proxy","Object","WebAssembly","Blob","FileReader","FileReaderSync","crypto","postMessage","setTimeout","setInterval","queueMicrotask","WeakRef","FinalizationRegistry",${JSON.stringify('"use strict";\n')}+code+${JSON.stringify('\nreturn parseHypergraph(files,helpers);')});
        hardenIntrinsicConstructors();
        const result=await fn(files,helpers,blocked,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,blocked,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,safeObject,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined);
        const bounded=boundedClone(result,limits);
        enforceShapeLimits(bounded,limits);
        self.postMessage({ok:true,result:bounded,logs});
      }catch(err){self.postMessage({ok:false,error:err?.message||String(err),logs});}
      finally{console.log=origLog;console.warn=origWarn;}
    };`;
  return new Promise((resolve, reject) => {
    const blob = new Blob([workerSrc], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener?.("abort", abort);
      worker.terminate();
      URL.revokeObjectURL(url);
    };
    const fail = error => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const abort = () => fail(Object.assign(new Error("Parser run cancelled."), { name: "AbortError" }));
    const timer = setTimeout(() => fail(new Error(`Parser timed out (${Math.round(effectiveLimits.timeoutMs / 1000)}s)`)), effectiveLimits.timeoutMs);
    options.signal?.addEventListener?.("abort", abort, { once: true });
    worker.onmessage = e => {
      if (settled) return;
      if (!e.data.ok) return fail(Object.assign(new Error(e.data.error), { logs: e.data.logs }));
      try {
        const result = enforceParserOutputLimits(e.data.result, effectiveLimits);
        settled = true;
        cleanup();
        resolve({ ...e.data, result, logs: (e.data.logs ?? []).join("\n").slice(0, CUSTOM_PARSER_LIMITS.maxLogChars).split("\n").filter(Boolean) });
      } catch (error) {
        fail(Object.assign(error, { logs: e.data.logs }));
      }
    };
    worker.onerror = e => fail(new Error(e.message));
    worker.postMessage({ code, files: safeFiles, limits: effectiveLimits });
  });
}
