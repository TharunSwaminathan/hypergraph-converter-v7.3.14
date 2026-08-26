// Format parsers: turn raw pasted/uploaded text into a normalized hyperedge list.

export function tok(s) { const n = Number(s); return (String(s).trim() !== "" && !isNaN(n)) ? n : String(s).trim(); }
export function vcmp(a, b) { if (typeof a === typeof b) return a < b ? -1 : a > b ? 1 : 0; return typeof a === "number" ? -1 : 1; }
export function cleanToken(s) { return String(s ?? "").trim().replace(/^["']|["']$/g, ""); }
export function uniquePreserve(arr) { const seen = new Set(), out = []; for (const v of arr ?? []) { const c = cleanToken(v); if (c && !seen.has(c)) { seen.add(c); out.push(c); } } return out; }

function failAt(path, message) {
  throw new Error(`${path} ${message}`);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function parseFiniteWeight(value, path, { defaultValue = 1, allowMissing = true } = {}) {
  if (value == null || value === "") {
    if (allowMissing) return defaultValue;
    failAt(path, `must be supplied; received ${JSON.stringify(value)}`);
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) failAt(path, `must be a finite number; received ${JSON.stringify(value)}`);
  return n;
}

function normalizeIdentifierValue(value, path) {
  if (typeof value === "string") {
    const cleaned = cleanToken(value);
    if (!cleaned) failAt(path, "must be a non-empty string or finite number identifier; received blank string");
    return cleaned;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) failAt(path, `must be a finite number identifier; received ${String(value)}`);
    return String(value);
  }
  failAt(path, `must be a string or finite number identifier; received ${Array.isArray(value) ? "array" : value === null ? "null" : typeof value}`);
}

function normalizeTimeValue(value, path) {
  if (value == null || value === "") return null;
  if (typeof value === "string") return cleanToken(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) failAt(path, `must be string, number, or null; received ${String(value)}`);
    return value;
  }
  failAt(path, `must be string, number, or null; received ${Array.isArray(value) ? "array" : typeof value}`);
}

function membershipArrayFrom(rawEdge, path) {
  const supplied = [
    ["vertices", rawEdge?.vertices],
    ["nodes", rawEdge?.nodes],
    ["members", rawEdge?.members],
  ].find(([, value]) => value !== undefined);
  if (!supplied) failAt(`${path}.vertices`, "must be an array; received missing");
  const [field, value] = supplied;
  if (!Array.isArray(value)) failAt(`${path}.${field}`, `must be an array; received ${Array.isArray(value) ? "array" : typeof value}`);
  return { field, value };
}

export function extractMeta(line) {
  const meta = {};
  // bracket syntax: [t=20] [time=20] [weight=2]
  const bracketMatches = [...line.matchAll(/\[(?:time|t|weight|label)\s*=\s*([^\]]+)\]/gi)];
  for (const m of bracketMatches) {
    const fullKey = m[0].match(/\[(time|t|weight|label)/i)?.[1].toLowerCase() ?? "";
    const key = fullKey === "t" ? "time" : fullKey;
    if (key) meta[key] = cleanToken(m[1]);
  }
  // @-prefix syntax: @time=X @weight=X
  const atMatches = [...line.matchAll(/@(time|t|weight|label)\s*=\s*([^\s\]:,]+)/gi)];
  for (const m of atMatches) {
    const key = m[1].toLowerCase() === "t" ? "time" : m[1].toLowerCase();
    meta[key] = cleanToken(m[2]);
  }
  // Strip both syntaxes from line
  const cleaned = line
    .replace(/\[(?:time|t|weight|label)\s*=\s*[^\]]+\]/gi, "")
    .replace(/@(?:time|t|weight|label)\s*=\s*[^\s\]:,]+/gi, "")
    .trim();
  return { line: cleaned, meta };
}

export function normalizeHyperedges(raw, { pathPrefix = "hyperedges" } = {}) {
  const warnings = []; const usedIds = new Map(); const out = [];
  for (const [i, h] of (raw ?? []).entries()) {
    const path = `${pathPrefix}[${i}]`;
    if (!isPlainObject(h)) failAt(path, `must be an object; received ${Array.isArray(h) ? "array" : typeof h}`);
    let id = h.id ?? h.hid;
    id = id == null || id === "" ? `h${i + 1}` : normalizeIdentifierValue(id, `${path}.id`);
    if (usedIds.has(id)) failAt(`${path}.id`, `duplicates ${usedIds.get(id)}.id: "${id}"`);
    usedIds.set(id, path);
    const membership = membershipArrayFrom(h, path);
    const verts = uniquePreserve(membership.value.map((value, j) => normalizeIdentifierValue(value, `${path}.${membership.field}[${j}]`)));
    if (verts.length === 0) warnings.push(`Hyperedge "${id}" has no vertices.`);
    const w = parseFiniteWeight(h.weight, `${path}.weight`, { defaultValue: 1 });
    const rawAttributes = h.attributes;
    if (rawAttributes != null && !isPlainObject(rawAttributes)) failAt(`${path}.attributes`, `must be a plain object; received ${Array.isArray(rawAttributes) ? "array" : typeof rawAttributes}`);
    const attributes = rawAttributes != null ? { ...rawAttributes } : {};
    out.push({ id, vertices: verts, time: normalizeTimeValue(h.time ?? h.timestamp ?? null, `${path}.time`), weight: w, attributes });
  }
  return { hyperedges: out, warnings };
}

// Parsers

/**
 * Parses one whitespace-separated Cornell/SNAP "nverts" token into a
 * non-negative integer, or returns a diagnostic string describing exactly
 * what was wrong (blank / NaN / fractional / negative / non-finite) and
 * where (1-based token position). Overflow-safe: Number.MAX_SAFE_INTEGER is
 * the ceiling, since anything larger cannot be a real simplex-vertex count.
 */
function parseNonNegativeIntToken(raw, index) {
  const trimmed = String(raw ?? "").trim();
  const position = `token ${index + 1}`;
  if (trimmed === "") return { ok: false, error: `${position} is blank.` };
  const n = Number(trimmed);
  if (Number.isNaN(n)) return { ok: false, error: `${position} ("${trimmed}") is not a number.` };
  if (!Number.isFinite(n)) return { ok: false, error: `${position} ("${trimmed}") is not finite.` };
  if (!Number.isInteger(n)) return { ok: false, error: `${position} ("${trimmed}") is not an integer (fractional sizes are not allowed).` };
  if (n < 0) return { ok: false, error: `${position} ("${trimmed}") is negative; hyperedge sizes cannot be negative.` };
  if (n > Number.MAX_SAFE_INTEGER) return { ok: false, error: `${position} ("${trimmed}") is too large to represent safely.` };
  return { ok: true, value: n };
}

/**
 * Cornell/SNAP simplex-format parser (nverts.txt + simplices.txt +
 * optional times.txt). Validates every invariant *before* constructing a
 * single hyperedge, so a malformed file never partially replaces the
 * previously loaded graph (V7310-D05).
 */
export function parseCornell(nv, sv, tv) {
  const nvTokens = String(nv ?? "").trim().split(/\s+/).filter(t => t !== "");
  if (!nvTokens.length) throw new Error("Cornell/SNAP format: nverts is empty — provide at least one hyperedge size.");

  const sizes = [];
  for (let i = 0; i < nvTokens.length; i++) {
    const parsed = parseNonNegativeIntToken(nvTokens[i], i);
    if (!parsed.ok) throw new Error(`Cornell/SNAP format: invalid nverts ${parsed.error} Expected a non-negative integer.`);
    sizes.push(parsed.value);
  }

  // Overflow-safe running sum: bail out the moment the running total would
  // exceed a value JS can represent exactly, rather than silently producing
  // an imprecise sum that could mask a real mismatch.
  let total = 0;
  for (let i = 0; i < sizes.length; i++) {
    total += sizes[i];
    if (!Number.isSafeInteger(total)) {
      throw new Error(`Cornell/SNAP format: the running total of nverts overflowed past hyperedge ${i + 1} (values are too large to sum safely). Expected sum(nverts) to stay within Number.MAX_SAFE_INTEGER.`);
    }
  }

  const svTokens = String(sv ?? "").trim().split(/\s+/).filter(t => t !== "");
  if (total !== svTokens.length) {
    throw new Error(
      `Cornell/SNAP format: sum(nverts) = ${total} does not match simplices.length = ${svTokens.length}. `
      + (total > svTokens.length
        ? `nverts declares ${total - svTokens.length} more simplex vertex${total - svTokens.length === 1 ? "" : "es"} than simplices provides (insufficient simplex vertices).`
        : `simplices provides ${svTokens.length - total} more token${svTokens.length - total === 1 ? "" : "s"} than nverts accounts for (extra simplex vertices).`)
      + " Check that every hyperedge's declared size matches the vertices actually listed for it.",
    );
  }
  const svA = svTokens.map(tok);

  let tvA = null;
  if (tv != null && String(tv).trim() !== "") {
    const tvTokens = String(tv).trim().split(/\s+/).filter(t => t !== "");
    if (tvTokens.length !== 0 && tvTokens.length !== sizes.length) {
      throw new Error(
        `Cornell/SNAP format: times.length = ${tvTokens.length} but nverts.length = ${sizes.length}. `
        + `times must be either empty (no time vector) or exactly one value per hyperedge.`,
      );
    }
    tvA = tvTokens.length ? tvTokens.map(Number) : null;
    if (tvA) {
      for (let i = 0; i < tvA.length; i++) {
        if (!Number.isFinite(tvA[i])) {
          throw new Error(`Cornell/SNAP format: times token ${i + 1} ("${tvTokens[i]}") is not a finite number.`);
        }
      }
    }
  }

  let off = 0;
  return sizes.map((size, i) => {
    const he = { id: "h" + i, vertices: svA.slice(off, off + size), time: tvA ? tvA[i] : null, weight: 1 };
    off += size;
    return he;
  });
}
export function parseSimple(t) {
  return t.trim().split("\n").filter(l => l.trim() && !l.startsWith("#")).map((l, i) => {
    const { line: cl, meta } = extractMeta(l);
    const ci = cl.indexOf(":");
    if (ci === -1) throw new Error("Line " + (i + 1) + ": missing colon");
    const id = cleanToken(cl.slice(0, ci)) || "h" + i;
    const vertices = cl.slice(ci + 1).trim().split(/[\s,]+/).map(tok).filter(v => v !== "");
    return { id, vertices, time: meta.time != null ? meta.time : null, weight: parseFiniteWeight(meta.weight, `Line ${i + 1} weight`, { defaultValue: 1 }) };
  });
}
export function parseCSVFmt(t) {
  return parseCsvDocument(t)
    .filter(cells => cells.some(cell => cell.trim() !== "") && !(cells[0] ?? "").startsWith("#"))
    .map((cells, i) => {
      const vertices = cells.map(tok).filter(v => v !== "");
      if (!vertices.length) throw new Error(`CSV row ${i + 1}: expected at least one vertex.`);
      return { id: "h" + i, vertices, time: null, weight: 1 };
    });
}
export function parseEdgeList(t) {
  return t.trim().split("\n").filter(l => l.trim() && !l.startsWith("#"))
    .map((l, i) => {
      const p = l.trim().split(/\s+/).filter(Boolean).map(tok);
      if (p.length !== 2) throw new Error(`Edge List line ${i + 1}: expected exactly 2 vertex columns, received ${p.length}.`);
      return { id: "h" + i, vertices: p, time: null, weight: 1 };
    });
}
export function parseJSON(t) {
  const d = JSON.parse(t);
  const containerPath = Array.isArray(d) ? "hyperedges" : (d?.canonicalHyperedges ? "canonicalHyperedges" : "hyperedges");
  const arr = Array.isArray(d) ? d : (d?.canonicalHyperedges ?? d?.hyperedges ?? null);
  if (!Array.isArray(arr)) throw new Error("JSON must be an array or object with canonicalHyperedges/hyperedges arrays.");
  return normalizeHyperedges(arr, { pathPrefix: containerPath }).hyperedges;
}
/**
 * RFC 4180-aware CSV parser, matching the grammar produced by csvDocument()
 * in mappings.js (V7310-D08). Operates on the whole text via a small state
 * machine rather than pre-splitting by line, so a quoted field containing
 * an embedded newline is parsed correctly instead of being torn in half.
 * Accepts LF, CRLF, or bare CR row separators.
 *
 * @param {string} text
 * @returns {string[][]} array of rows, each an array of unescaped cell strings
 */
export function parseCsvDocument(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let cellWasQuoted = false;
  let inQuotes = false;
  let afterClosingQuote = false;
  const s = String(text ?? "");
  let i = 0;
  const endCell = () => { row.push(cellWasQuoted ? cell : cell.trim()); cell = ""; cellWasQuoted = false; afterClosingQuote = false; };
  const endRow = () => { endCell(); rows.push(row); row = []; };
  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === "\"") {
        if (s[i + 1] === "\"") { cell += "\""; i += 2; continue; }
        inQuotes = false; afterClosingQuote = true; i += 1; continue;
      }
      cell += ch; i += 1; continue;
    }
    if (afterClosingQuote) {
      if (ch === " " || ch === "\t") { i += 1; continue; }
      if (ch !== "," && ch !== "\r" && ch !== "\n") {
        throw new Error(`CSV parse error at character ${i + 1}: unexpected ${JSON.stringify(ch)} after closing quote.`);
      }
    }
    if (ch === "\"") {
      if (cell.trim() !== "") throw new Error(`CSV parse error at character ${i + 1}: quote appears inside an unquoted field.`);
      inQuotes = true; cellWasQuoted = true; cell = ""; i += 1; continue;
    }
    if (ch === ",") { endCell(); i += 1; continue; }
    if (ch === "\r") { if (s[i + 1] === "\n") i += 1; endRow(); i += 1; continue; }
    if (ch === "\n") { endRow(); i += 1; continue; }
    cell += ch; i += 1;
  }
  if (inQuotes) throw new Error("CSV parse error: unterminated quoted field.");
  // Final cell/row, unless the text ended cleanly on a row boundary.
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

export function parseIncidence(t) {
  const rows = parseCsvDocument(t).filter(cells => cells.some(cell => cell.trim() !== "") && !(cells[0] ?? "").startsWith("#"));
  const map = new Map();
  rows.forEach((cells, index) => {
    if (index === 0) {
      const header = cells.map(cell => cell.toLowerCase().trim().replace(/[\s-]+/g, "_"));
      const hasHyperedgeHeader = /^(hyperedge_id|hyperedge|hid|edge_id|edge)$/.test(header[0] ?? "");
      const hasVertexHeader = /^(vertex_id|vertex|vid|node_id|node)$/.test(header[1] ?? "");
      if (hasHyperedgeHeader && hasVertexHeader) return;
    }
    const hid = (cells[0] ?? "").trim(), vid = cells[1] ?? "";
    if (!hid) throw new Error(`Incidence row ${index + 1}: missing hyperedge_id.`);
    if (vid == null || String(vid).trim() === "") throw new Error(`Incidence row ${index + 1}: missing vertex_id.`);
    const rowWeight = parseFiniteWeight(cells[3], `Incidence row ${index + 1} weight`, { defaultValue: 1 });
    if (!map.has(hid)) map.set(hid, { id: hid, vertices: [], time: cells[2] || null, weight: rowWeight });
    else {
      const edge = map.get(hid);
      if (edge.time == null && cells[2]) edge.time = cells[2];
      if ((edge.weight == null || edge.weight === 1) && cells[3] !== undefined && cells[3] !== "") edge.weight = rowWeight;
    }
    map.get(hid).vertices.push(tok(vid));
  });
  return [...map.values()];
}
export function parseV2HText(t) {
  const m = new Map();
  t.trim().split("\n").filter(l => l.trim() && !l.startsWith("#")).forEach(l => {
    const ci = l.indexOf(":"); if (ci === -1) throw new Error(`V2H line is missing a colon: ${l}`);
    const vid = cleanToken(l.slice(0, ci).trim());
    if (!vid) throw new Error(`V2H line has a blank vertex id: ${l}`);
    const hyperedgeIds = l.slice(ci + 1).trim().split(/[\s,]+/).map(s => cleanToken(s)).filter(n => n !== "");
    if (!hyperedgeIds.length) throw new Error(`V2H line has no hyperedge ids for vertex "${vid}".`);
    hyperedgeIds.forEach(hid => { if (!m.has(hid)) m.set(hid, new Set()); m.get(hid).add(vid); });
  });
  return [...m.entries()].sort((a, b) => { const an = Number(a[0]), bn = Number(b[0]); return isNaN(an) || isNaN(bn) ? a[0] < b[0] ? -1 : 1 : an - bn; })
    .map(([hid, vs]) => ({ id: hid, vertices: [...vs].sort(vcmp), time: null, weight: 1 }));
}
export function parseH2HText(t) {
  const hv = new Map();
  t.trim().split("\n").filter(l => l.trim() && !l.startsWith("#")).forEach(l => {
    const ci = l.indexOf(":"); if (ci === -1) throw new Error(`H2H line is missing a colon: ${l}`);
    const hid = cleanToken(l.slice(0, ci).trim().replace(/^h/, ""));
    if (!hv.has(hid)) hv.set(hid, new Set());
    [...l.matchAll(/h?(\S+?)\[shared:\s*([^\]]+)\]/g)].forEach(m => {
      const nid = cleanToken(m[1].replace(/^h/, ""));
      m[2].split(/[\s,]+/).map(s => tok(cleanToken(s))).filter(v => v !== "").forEach(v => {
        hv.get(hid).add(v); if (!hv.has(nid)) hv.set(nid, new Set()); hv.get(nid).add(v);
      });
    });
  });
  if (hv.size === 0) throw new Error("Cannot parse h2h format.");
  return [...hv.entries()].sort((a, b) => { const an = Number(a[0]), bn = Number(b[0]); return isNaN(an) || isNaN(bn) ? a[0] < b[0] ? -1 : 1 : an - bn; })
    .map(([hid, vs]) => ({ id: "h" + hid, vertices: [...vs].sort(vcmp), time: null, weight: 1 }));
}
export function parseCSRJson(t) {
  let data; try { data = JSON.parse(t); } catch (e) { throw new Error("CSR JSON parse failed: " + e.message, { cause: e }); }
  const csr = data.h2vCSR ?? data.csr ?? data;
  const vertexIds = data.vertexIds ?? csr.vertexIds;
  const hyperedgeIds = data.hyperedgeIds ?? csr.hyperedgeIds;
  const hyperedgeTimes = validateOptionalMetadataVector(data.hyperedgeTimes, hyperedgeIds?.length ?? 0, "CSR/CSC JSON hyperedgeTimes");
  const hyperedgeWeights = validateOptionalMetadataVector(data.hyperedgeWeights, hyperedgeIds?.length ?? 0, "CSR/CSC JSON hyperedgeWeights", { weights: true });
  const csc = data.h2vCSC ?? data.csc ?? ((data.columnPointers || csr.columnPointers) ? csr : null);
  if (csc && (csc.columnPointers || data.columnPointers) && (csc.rowIndices || data.rowIndices)) {
    if (!vertexIds || !hyperedgeIds) throw new Error("CSC JSON missing vertexIds or hyperedgeIds.");
    const { pointers: columnPointers, indices: rowIndices } = validateSparseMatrixStructure({
      format: "CSC JSON",
      pointers: csc.columnPointers ?? data.columnPointers,
      indices: csc.rowIndices ?? data.rowIndices,
      primaryIds: vertexIds,
      foreignIds: hyperedgeIds,
    });
    const hes = hyperedgeIds.map((hid, row) => ({
      id: String(hid),
      vertices: [],
      time: hyperedgeTimes?.[row] ?? null,
      weight: hyperedgeWeights?.[row] ?? 1,
    }));
    vertexIds.forEach((vertexId, col) => {
      for (let ptr = columnPointers[col]; ptr < columnPointers[col + 1]; ptr += 1) {
        hes[rowIndices[ptr]].vertices.push(String(vertexId));
      }
    });
    return hes;
  }
  if (!vertexIds || !hyperedgeIds) throw new Error("CSR JSON missing vertexIds or hyperedgeIds.");
  const { pointers: offsets, indices } = validateSparseMatrixStructure({
    format: "CSR JSON",
    pointers: csr.offsets ?? csr.rowOffsets ?? data.rowOffsets,
    indices: csr.indices ?? csr.columnIndices ?? data.columnIndices,
    primaryIds: hyperedgeIds,
    foreignIds: vertexIds,
  });
  return hyperedgeIds.map((hid, row) => ({
    id: String(hid), vertices: indices.slice(offsets[row], offsets[row + 1]).map(idx => String(vertexIds[idx])),
    time: hyperedgeTimes?.[row] ?? null, weight: hyperedgeWeights?.[row] ?? 1
  }));
}
export function parseCSRCsv(t) {
  const data = new Map();
  parseCsvDocument(t).filter(cells => cells.some(cell => cell.trim() !== "") && !(cells[0] ?? "").startsWith("#")).forEach(cells => {
    data.set(cells[0].trim(), cells.slice(1));
  });
  const vIds = data.get("vertexIds"); const hIds = data.get("hyperedgeIds");
  if (!vIds || !hIds) throw new Error("CSR/CSC CSV missing vertexIds or hyperedgeIds.");
  const times = validateOptionalMetadataVector(data.get("hyperedgeTimes"), hIds.length, "CSR/CSC CSV hyperedgeTimes");
  const weights = validateOptionalMetadataVector(data.get("hyperedgeWeights"), hIds.length, "CSR/CSC CSV hyperedgeWeights", { weights: true });
  const timeAt = i => {
    const value = times?.[i];
    return value == null || value === "" ? null : value;
  };
  const weightAt = i => {
    return weights?.[i] ?? 1;
  };
  if (data.get("columnPointers") && data.get("rowIndices")) {
    const { pointers, indices: rowIndices } = validateSparseMatrixStructure({
      format: "CSC CSV",
      pointers: data.get("columnPointers"),
      indices: data.get("rowIndices"),
      primaryIds: vIds,
      foreignIds: hIds,
    });
    const hes = hIds.map((hid, i) => ({ id: String(hid), vertices: [], time: timeAt(i), weight: weightAt(i) }));
    vIds.forEach((vertexId, col) => {
      for (let ptr = pointers[col]; ptr < pointers[col + 1]; ptr += 1) {
        hes[rowIndices[ptr]].vertices.push(String(vertexId));
      }
    });
    return hes;
  }
  const { pointers: offs, indices: idxs } = validateSparseMatrixStructure({
    format: "CSR CSV",
    pointers: data.get("rowOffsets") ?? data.get("offsets"),
    indices: data.get("columnIndices") ?? data.get("indices"),
    primaryIds: hIds,
    foreignIds: vIds,
  });
  return hIds.map((hid, i) => ({ id: String(hid), vertices: idxs.slice(offs[i], offs[i + 1]).map(idx => String(vIds[idx])), time: timeAt(i), weight: weightAt(i) }));
}

function validateOptionalMetadataVector(vector, expectedLength, label, { weights = false } = {}) {
  if (vector == null) return null;
  if (!Array.isArray(vector)) throw new Error(`${label}: metadata vector must be an array.`);
  if (expectedLength == null || expectedLength < 0) return vector;
  if (vector.length !== expectedLength) {
    throw new Error(`${label}: metadata vector has length ${vector.length}, expected ${expectedLength}.`);
  }
  if (!weights) return vector;
  return vector.map((value, index) => parseFiniteWeight(value, `${label}[${index}]`, { defaultValue: 1 }));
}

/**
 * Shared structural validator for CSR/CSC sparse-matrix hypergraph inputs,
 * used by both the JSON and CSV entry points so the two formats enforce
 * identical invariants (V7310-D06). Throws with a structured, descriptive
 * message on the first violation found; returns coerced numeric pointer/
 * index arrays on success.
 *
 * CSR: pointers = rowPtr, indices = colIdx, primaryIds = hyperedgeIds
 *      (rows), foreignIds = vertexIds (columns).
 * CSC: pointers = colPtr, indices = rowIdx, primaryIds = vertexIds
 *      (columns), foreignIds = hyperedgeIds (rows).
 *
 * Policy for the two "must be defined and tested" cases the spec calls
 * out: duplicate *IDs* (in primaryIds/foreignIds) are rejected outright,
 * because two vertices or hyperedges sharing one ID string makes the
 * representation genuinely ambiguous (which one does a given index refer
 * to?). Duplicate *indices* within one row/column are allowed — that just
 * means the same vertex is listed twice for one hyperedge, which
 * normalizeHyperedges() already resolves losslessly via uniquePreserve().
 */
export function validateSparseMatrixStructure({ format, pointers, indices, primaryIds, foreignIds }) {
  const fail = message => { throw new Error(`${format}: ${message}`); };

  if (!Array.isArray(primaryIds) || !primaryIds.length) fail("missing or empty ID list for the pointer dimension.");
  if (!Array.isArray(foreignIds) || !foreignIds.length) fail("missing or empty ID list for the index dimension.");
  primaryIds.forEach((id, i) => { if (id == null || String(id).trim() === "") fail(`ID list entry ${i + 1} (pointer dimension) is missing/blank.`); });
  foreignIds.forEach((id, i) => { if (id == null || String(id).trim() === "") fail(`ID list entry ${i + 1} (index dimension) is missing/blank.`); });
  const primarySeen = new Set();
  primaryIds.forEach(id => {
    const key = String(id);
    if (primarySeen.has(key)) fail(`duplicate ID "${key}" in the pointer-dimension ID list makes the representation ambiguous.`);
    primarySeen.add(key);
  });
  const foreignSeen = new Set();
  foreignIds.forEach(id => {
    const key = String(id);
    if (foreignSeen.has(key)) fail(`duplicate ID "${key}" in the index-dimension ID list makes the representation ambiguous.`);
    foreignSeen.add(key);
  });

  if (!Array.isArray(pointers)) fail("pointer array is missing.");
  if (!Array.isArray(indices)) fail("index array is missing.");

  const expectedPointerLength = primaryIds.length + 1;
  if (pointers.length !== expectedPointerLength) {
    fail(`pointer array has length ${pointers.length}, expected ${expectedPointerLength} (ID list length + 1).`);
  }

  const numericPointers = pointers.map((raw, i) => {
    const n = Number(raw);
    if (raw == null || String(raw).trim() === "" || Number.isNaN(n)) fail(`pointer[${i}] ("${raw}") is not a number.`);
    if (!Number.isFinite(n)) fail(`pointer[${i}] ("${raw}") is not finite.`);
    if (!Number.isInteger(n)) fail(`pointer[${i}] ("${raw}") is not an integer.`);
    if (n < 0) fail(`pointer[${i}] ("${raw}") is negative.`);
    return n;
  });
  if (numericPointers[0] !== 0) fail(`the first pointer must be 0, got ${numericPointers[0]}.`);
  for (let i = 1; i < numericPointers.length; i++) {
    if (numericPointers[i] < numericPointers[i - 1]) {
      fail(`pointers are not monotonically non-decreasing: pointer[${i}] = ${numericPointers[i]} is less than pointer[${i - 1}] = ${numericPointers[i - 1]}.`);
    }
  }
  const terminal = numericPointers[numericPointers.length - 1];
  if (terminal !== indices.length) {
    fail(`the terminal pointer (${terminal}) does not match the index array length (${indices.length}).`);
  }

  const numericIndices = indices.map((raw, i) => {
    const n = Number(raw);
    if (raw == null || String(raw).trim() === "" || Number.isNaN(n)) fail(`index[${i}] ("${raw}") is not a number.`);
    if (!Number.isFinite(n)) fail(`index[${i}] ("${raw}") is not finite.`);
    if (!Number.isInteger(n)) fail(`index[${i}] ("${raw}") is not an integer.`);
    if (n < 0 || n >= foreignIds.length) fail(`index[${i}] (${n}) is out of range; expected [0, ${foreignIds.length}).`);
    return n;
  });

  return { pointers: numericPointers, indices: numericIndices };
}

export function parseAdjList(t) {
  const hes = [];
  const seenPairs = new Set();
  t.trim().split("\n").filter(l => l.trim() && !l.startsWith("#")).forEach(l => {
    const p = l.replace(":", "").trim().split(/[\s,]+/).map(tok).filter(v => v !== "");
    const src = p[0];
    p.slice(1).forEach(dst => {
      const key = [String(src), String(dst)].sort().join("\u0000");
      if (seenPairs.has(key)) return;
      seenPairs.add(key);
      hes.push({ id: "h" + hes.length, vertices: [src, dst], time: null, weight: 1 });
    });
  });
  return hes;
}
export function parseFreeform(t) {
  const sentences = t.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  return sentences.map((s, i) => {
    const verts = [...new Set(s.match(/\b[A-Z][a-zA-Z]*\b|\b\d+\b/g) ?? [])].filter(v => v.length > 1);
    return { id: "h" + i, vertices: verts.length ? verts : s.split(/\s+/).slice(0, 3), time: null, weight: 1 };
  }).filter(h => h.vertices.length > 0);
}

// Dispatcher used by the agent layer to run the right parser for a given
// format id without duplicating the format→parser mapping.
export function parseInputFormat(format, { text = "", nverts = "", simplices = "", times = "" } = {}) {
  if (format === "cornell") {
    if (!nverts || !simplices) throw new Error("nverts and simplices required.");
    return parseCornell(nverts, simplices, times || null);
  }
  if (format === "simple") return parseSimple(text);
  if (format === "incidence") return parseIncidence(text);
  if (format === "csv") return parseCSVFmt(text);
  if (format === "edgelist") return parseEdgeList(text);
  if (format === "json") return parseJSON(text);
  if (format === "v2h") return parseV2HText(text);
  if (format === "h2h") return parseH2HText(text);
  if (format === "csr_json") return parseCSRJson(text);
  if (format === "csr_csv") return parseCSRCsv(text);
  if (format === "adjlist") return parseAdjList(text);
  if (format === "freeform") return parseFreeform(text);
  if (format === "batch") return [];
  throw new Error(`The ${format} route cannot be parsed directly.`);
}

// Auto-detect
export function autoDetect(text) {
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const data = JSON.parse(t);
      const csr = data?.h2vCSR ?? data?.csr ?? data;
      const hasCsrShape = Boolean((csr?.offsets || csr?.rowOffsets || data?.rowOffsets)
        && (csr?.indices || csr?.columnIndices || data?.columnIndices));
      const hasCscShape = Boolean((data?.h2vCSC?.columnPointers || data?.csc?.columnPointers || data?.columnPointers)
        && (data?.h2vCSC?.rowIndices || data?.csc?.rowIndices || data?.rowIndices));
      if (hasCsrShape || hasCscShape) return "csr_json";
    } catch {
      // Generic JSON parser will report syntax details.
    }
    return "json";
  }
  const lines = t.split("\n").filter(l => l.trim() && !l.startsWith("#"));
  if (!lines.length) return "simple";
  const l0 = lines[0];
  const lower0 = l0.toLowerCase();
  const looksHyperedgeId = value => /^(?:h|he|e|edge|hyperedge)[\w.-]*\d*$/i.test(cleanToken(value));
  const looksVertexId = value => /^(?:v|vertex)[\w.-]*\d*$/i.test(cleanToken(value));
  const splitMembership = line => line.split(/[,\s]+/).map(cleanToken).filter(Boolean);
  if (l0.includes(",") && (lower0.startsWith("vertexids") || lower0.startsWith("hyperedgeids"))) return "csr_csv";
  const cells = l0.split(",").map(cleanToken);
  if (cells.length >= 2 && !l0.includes(":")) {
    const header = cells.map(cell => cell.toLowerCase());
    const incidenceHeader = header.some(cell => /^(h|hid|hyperedge|hyperedge_id|edge|edge_id)$/.test(cell))
      && header.some(cell => /^(v|vid|vertex|vertex_id|node|node_id)$/.test(cell));
    const rowWidths = lines.slice(0, 8).map(line => line.split(",").map(cleanToken).filter(Boolean).length);
    const fixedWideRows = rowWidths.length > 0 && rowWidths.every(width => width >= 3);
    const firstColumnLooksHyperedge = lines.slice(0, 8)
      .map(line => line.split(",").map(cleanToken).filter(Boolean)[0])
      .filter(Boolean)
      .some(looksHyperedgeId);
    if (incidenceHeader || (!fixedWideRows && firstColumnLooksHyperedge)) return "incidence";
    return "csv";
  }
  if (l0.includes(":") && l0.match(/h\d+\[shared:/i)) return "h2h";
  if (l0.includes(":")) {
    const lhs = cleanToken(l0.slice(0, l0.indexOf(":")).trim());
    const rhs = splitMembership(l0.slice(l0.indexOf(":") + 1));
    const rhsLooksHyperedges = rhs.length > 0 && rhs.every(looksHyperedgeId);
    if (rhsLooksHyperedges && !looksHyperedgeId(lhs)) return "v2h";
    if (looksHyperedgeId(lhs)) return "simple";
    if (looksVertexId(lhs) && rhsLooksHyperedges) return "v2h";
    return "adjlist";
  }
  if (l0.split(/\s+/).length === 2) return "edgelist";
  return "csv";
}

