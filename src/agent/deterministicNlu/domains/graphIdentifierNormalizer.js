const ENTITY_WRAPPERS = {
  vertex: ["vertex", "vertices", "node", "nodes"],
  hyperedge: ["hyperedge", "hyperedges", "edge", "edges"],
  entity: ["vertex", "vertices", "node", "nodes", "hyperedge", "hyperedges", "edge", "edges"],
};

const LEADING_ARTICLES = /^(?:the|a|an|new)\s+/i;
const NAMING_PREFIX = /^(?:called|named)\s+/i;
const LIST_INTRODUCER = /^(?:(?:with|containing|that\s+contains|contains|including)\s+)?(?:vertices|vertex|nodes|node)\s*[:=]?\s+/i;
const TRAILING_PUNCTUATION = /[.?!,;:]+$/g;

export function isQuotedGraphIdentifier(value = "") {
  const trimmed = stripTrailingPunctuation(String(value ?? "").trim());
  if (trimmed.length < 2) return false;
  const first = trimmed[0];
  const last = trimmed.at(-1);
  return (first === `"` && last === `"`) || (first === "'" && last === "'") || (first === "`" && last === "`");
}

export function normalizeGraphEntityReferenceInfo(value = "", {
  kind = "entity",
  stripListIntroducer = false,
} = {}) {
  const raw = String(value ?? "");
  const trimmed = stripTrailingPunctuation(raw.trim());
  if (!trimmed) return { value: "", raw, quoted: false, changed: raw !== "" };

  if (isQuotedGraphIdentifier(trimmed)) {
    const literal = trimmed.slice(1, -1).trim();
    return { value: literal, raw, quoted: true, changed: literal !== raw };
  }

  let cleaned = trimmed.replace(/^["'`]+|["'`]+$/g, "").replace(NAMING_PREFIX, "").trim();
  if (stripListIntroducer) cleaned = cleaned.replace(LIST_INTRODUCER, "").trim();
  cleaned = collapseLeadingEntityWrappers(cleaned, kind);
  cleaned = normalizeSelectedAlias(cleaned);
  return {
    value: cleaned,
    raw,
    quoted: false,
    changed: cleaned !== trimmed,
  };
}

export function normalizeGraphEntityReference(value = "", options = {}) {
  return normalizeGraphEntityReferenceInfo(value, options).value;
}

export function splitGraphEntityList(value = "", {
  kind = "vertex",
} = {}) {
  const source = String(value ?? "").trim();
  if (!source) return [];
  const listSource = stripLeadingListIntroducer(source);
  const pieces = splitUnquotedList(listSource);
  return pieces
    .map(piece => normalizeGraphEntityReference(piece, { kind, stripListIntroducer: false }))
    .filter(Boolean);
}

export function validateGraphOperationIdentifiers(operations = []) {
  const errors = [];
  for (const [index, operation] of (operations ?? []).entries()) {
    inspectOperationIdentifiers(operation, `operations[${index}]`, errors);
  }
  return { ok: errors.length === 0, errors };
}

function inspectOperationIdentifiers(operation, path, errors) {
  if (!operation || typeof operation !== "object") return;
  const fields = [
    ["hyperedgeId", "hyperedge"],
    ["newHyperedgeId", "hyperedge"],
    ["vertexId", "vertex"],
    ["newVertexId", "vertex"],
  ];
  for (const [field, kind] of fields) {
    if (operation[field] == null) continue;
    const issue = suspiciousIdentifier(operation[field], kind);
    if (issue) errors.push(`${path}.${field} looks like conversational wording was captured as an ID ("${operation[field]}"). ${issue}`);
  }
  if (Array.isArray(operation.vertices)) {
    operation.vertices.forEach((vertex, childIndex) => {
      const issue = suspiciousIdentifier(vertex, "vertex");
      if (issue) errors.push(`${path}.vertices[${childIndex}] looks like conversational wording was captured as an ID ("${vertex}"). ${issue}`);
    });
  }
  if (Array.isArray(operation.operations)) {
    operation.operations.forEach((child, childIndex) => inspectOperationIdentifiers(child, `${path}.operations[${childIndex}]`, errors));
  }
}

function suspiciousIdentifier(value, kind) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const wrappers = ENTITY_WRAPPERS[kind] ?? ENTITY_WRAPPERS.entity;
  const wrapperPattern = wrappers.map(escapeRegExp).join("|");
  if (new RegExp(`^(?:the|new)\\s+(?:${wrapperPattern})\\s+\\S`, "i").test(text)) return "Use the bare graph ID unless the literal wording was intentionally quoted.";
  return null;
}

function collapseLeadingEntityWrappers(value, kind) {
  let cleaned = String(value ?? "").trim();
  const wrappers = ENTITY_WRAPPERS[kind] ?? ENTITY_WRAPPERS.entity;
  const wrapperPattern = new RegExp(`^(?:${wrappers.map(escapeRegExp).join("|")})\\s+`, "i");
  let changed = true;
  while (changed && cleaned) {
    const before = cleaned;
    cleaned = cleaned.replace(LEADING_ARTICLES, "").trim();
    cleaned = cleaned.replace(wrapperPattern, "").trim();
    changed = cleaned !== before;
  }
  return cleaned;
}

function normalizeSelectedAlias(value) {
  const selected = String(value ?? "").trim().match(/^(that|this|selected)\s+(?:hyperedge|edge|vertex|node)$/i);
  return selected ? selected[1] : String(value ?? "").trim();
}

function splitUnquotedList(value) {
  const pieces = [];
  let current = "";
  let quote = null;
  const push = () => {
    const piece = current.trim();
    if (piece) pieces.push(piece);
    current = "";
  };
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === `"` || ch === "'" || ch === "`") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "," || ch === "\n" || ch === ";") {
      push();
      continue;
    }
    const remaining = value.slice(i);
    const andMatch = remaining.match(/^\s+and\s+/i);
    if (andMatch) {
      push();
      i += andMatch[0].length - 1;
      continue;
    }
    current += ch;
  }
  push();
  return pieces;
}

function stripLeadingListIntroducer(value) {
  if (isQuotedGraphIdentifier(value)) return value;
  return String(value ?? "").trim().replace(LIST_INTRODUCER, "").trim();
}

function stripTrailingPunctuation(value) {
  return String(value ?? "").replace(TRAILING_PUNCTUATION, "").trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
