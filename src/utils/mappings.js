// Mapping builders (h2v/v2h/h2h/v2v/CSR), export-format serializers, and graph statistics.

import { buildTwoSectionProjectionSafely, incidenceDensity, projectionDensity, estimateProjectionPairCount, PROJECTION_BUDGETS } from "../algorithms/projection.js";
import { vcmp } from "./parsers.js";
import { arrayMin, arrayMax } from "./numeric.js";
import { computedDerived, DERIVED_STATUS, resourceLimitedDerived } from "./derivedResults.js";

export { DERIVED_STATUS, notRequestedDerived } from "./derivedResults.js";

/**
 * RFC 4180-compatible CSV cell/row serialization (V7310-D08). A cell is
 * quoted whenever it contains the delimiter, a double quote, a line break,
 * or leading/trailing whitespace (unquoted leading/trailing spaces are
 * ambiguous on re-import — RFC 4180 leaves them untrimmed, but many
 * real-world parsers trim them, so quoting preserves the value exactly
 * either way). Embedded quotes are doubled per the RFC. Rows are joined
 * with CRLF, which is what the RFC specifies and what spreadsheet tools
 * expect; this is used consistently for every CSV export in this file.
 */
export function csvCell(value, delimiter = ",", { protectLeadingComment = false } = {}) {
  const s = value == null ? "" : String(value);
  const needsQuoting = (protectLeadingComment && s.startsWith("#"))
    || s.includes(delimiter) || s.includes("\"") || s.includes("\n") || s.includes("\r") || /^\s|\s$/.test(s);
  if (!needsQuoting) return s;
  return "\"" + s.replace(/"/g, "\"\"") + "\"";
}

export function csvRow(cells, delimiter = ",") {
  return cells.map((cell, index) => csvCell(cell, delimiter, { protectLeadingComment: index === 0 })).join(delimiter);
}

export function csvDocument(rows, delimiter = ",") {
  return rows.map(row => csvRow(row, delimiter)).join("\r\n");
}

export const buildH2V = hes => hes.map(h => ({ hid: h.id, vertices: [...h.vertices], time: h.time, weight: h.weight }));

export const DERIVED_LIMITS = Object.freeze({
  maxH2HNeighborRefs: 200_000,
  maxTriadNeighborRefs: 200_000,
  maxMappingRows: 2_000,
});

export const EXPORT_BUDGETS = Object.freeze({
  matrixMaxCells: 1_000_000,
  matrixMaxEstimatedBytes: 4_000_000,
});

export function buildV2H(hes) {
  const m = new Map();
  hes.forEach(h => h.vertices.forEach(v => {
    const k = String(v);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(h.id);
  }));
  return [...m.entries()]
    .sort((a, b) => {
      const an = Number(a[0]), bn = Number(b[0]);
      return (!isNaN(an) && !isNaN(bn)) ? an - bn : a[0] < b[0] ? -1 : 1;
    })
    .map(([v, hs]) => ({ vid: v, hyperedges: hs }));
}

export function buildH2H(hes) {
  const v2h = new Map();
  hes.forEach(h => h.vertices.forEach(v => {
    const k = String(v);
    if (!v2h.has(k)) v2h.set(k, []);
    v2h.get(k).push(h.id);
  }));
  const adj = new Map();
  hes.forEach(h => { adj.set(h.id, new Set()); });
  hes.forEach(h => h.vertices.forEach(v => (v2h.get(String(v)) || []).forEach(o => {
    if (o !== h.id) adj.get(h.id).add(o);
  })));
  const byId = new Map(hes.map(h => [h.id, h]));
  return hes.map(h => {
    const ns = [...adj.get(h.id)].sort();
    return {
      hid: h.id,
      neighbors: ns,
      sharedVertices: ns.map(nid => {
        const o = byId.get(nid);
        return o ? h.vertices.filter(v => o.vertices.map(String).includes(String(v))) : [];
      }),
    };
  });
}

export function estimateH2HNeighborReferences(hes = [], ceiling = DERIVED_LIMITS.maxH2HNeighborRefs) {
  const v2h = new Map();
  for (const h of hes ?? []) {
    for (const v of h.vertices ?? []) {
      const key = String(v);
      if (!v2h.has(key)) v2h.set(key, 0);
      v2h.set(key, v2h.get(key) + 1);
    }
  }
  let references = 0;
  let largestVertexDegree = 0;
  for (const degree of v2h.values()) {
    if (degree > largestVertexDegree) largestVertexDegree = degree;
    references += degree > 1 ? degree * (degree - 1) : 0;
    if (!Number.isSafeInteger(references) || references > ceiling) {
      return { references: Math.min(references, Number.MAX_SAFE_INTEGER), overBudget: true, largestVertexDegree };
    }
  }
  return { references, overBudget: references > ceiling, largestVertexDegree };
}

export function buildH2HBounded(hes, { maxNeighborRefs = DERIVED_LIMITS.maxH2HNeighborRefs } = {}) {
  const estimate = estimateH2HNeighborReferences(hes, maxNeighborRefs);
  const limits = { maxNeighborRefs };
  if (estimate.overBudget) {
    return {
      type: "h2h",
      status: DERIVED_STATUS.OVER_BUDGET,
      value: null,
      estimate,
      limits,
      reason: `estimated ${estimate.references.toLocaleString()} H2H neighbor references exceeds the ${maxNeighborRefs.toLocaleString()} safety limit`,
    };
  }
  return { type: "h2h", status: DERIVED_STATUS.COMPUTED, value: buildH2H(hes), estimate, limits, reason: null };
}

export function buildV2V(hes) {
  const result = buildTwoSectionProjectionSafely(hes, { weightPolicy: "count_shared_hyperedges" });
  if (!result.ok) return [];
  return result.projection.edges;
}

// Structured version of buildV2V that lets callers tell "no edges" apart
// from "refused — the estimate was over budget" (V7310-D03), instead of
// both cases silently looking like an empty array.
export function buildV2VBounded(hes) {
  const result = buildTwoSectionProjectionSafely(hes, { weightPolicy: "count_shared_hyperedges" });
  if (!result.ok) {
    return {
      ok: false,
      type: "v2v",
      status: DERIVED_STATUS.OVER_BUDGET,
      edges: null,
      value: null,
      overBudget: true,
      exceededResource: result.exceededResource,
      estimatedPairs: result.estimatedPairs,
      largestHyperedgeSize: result.largestHyperedgeSize,
      budget: result.budget,
      usage: result.usage,
      estimate: {
        pairs: result.estimatedPairs,
        candidatePairWork: result.estimatedPairs,
        uniqueProjectedEdges: result.usage?.uniqueProjectedEdges ?? 0,
        projectedEdgeSupportReferences: result.usage?.projectedEdgeSupportReferences ?? 0,
        largestHyperedgeSize: result.largestHyperedgeSize,
      },
      limits: {
        ...result.limits,
        maxPairs: result.limits?.maxCandidatePairWork ?? result.budget,
        effectiveMaxRows: result.limits?.maxExportRows ?? PROJECTION_BUDGETS.maxExportRows,
        maxRows: result.limits?.maxExportRows ?? PROJECTION_BUDGETS.maxExportRows,
      },
      reason: result.reason ?? `projection safety limit exceeded for ${result.exceededResource ?? "an unknown resource"}`,
    };
  }
  return {
    ok: true,
    type: "v2v",
    status: DERIVED_STATUS.COMPUTED,
    edges: result.projection.edges,
    value: result.projection.edges,
    usage: result.usage,
    estimate: {
      ...estimateProjectionPairCount(hes),
      candidatePairWork: result.usage.candidatePairWork,
      uniqueProjectedEdges: result.usage.uniqueProjectedEdges,
      projectedEdgeSupportReferences: result.usage.projectedEdgeSupportReferences,
    },
    limits: {
      ...result.limits,
      maxPairs: result.limits.maxCandidatePairWork,
      maxRows: result.limits.maxExportRows,
    },
    reason: null,
    projection: result.projection,
  };
}

export function buildCSR(hes) {
  const allV = [...new Set(hes.flatMap(h => h.vertices.map(String)))].sort(vcmp);
  const vIdx = new Map(allV.map((v, i) => [v, i]));
  const offsets = [0];
  const indices = [];
  hes.forEach(h => {
    h.vertices.forEach(v => indices.push(vIdx.get(String(v)) ?? 0));
    offsets.push(indices.length);
  });
  return {
    vertexIds: allV,
    hyperedgeIds: hes.map(h => h.id),
    hyperedgeTimes: hes.map(h => h.time),
    hyperedgeWeights: hes.map(h => h.weight),
    h2vCSR: { rowType: "hyperedge", columnType: "vertex", offsets, indices },
  };
}

// Export helpers
export const expH2V = r => r.map(x => x.hid + (x.time != null ? " [t=" + x.time + "]" : "") + (x.weight != null && x.weight !== 1 ? " @weight=" + x.weight : "") + ": " + x.vertices.join(", ")).join("\n");
export const expV2H = r => r.map(x => String(x.vid) + ": " + x.hyperedges.join(", ")).join("\n");

function h2hHyperedgeIdentifierIssue(value) {
  const id = String(value ?? "");
  if (!id) return "is blank";
  if (/^\s|\s$/.test(id)) return "has leading or trailing whitespace";
  if (/[\r\n]/.test(id)) return "contains a line break";
  if (id.startsWith("#")) return "would be parsed as a full-line comment";
  if (id.includes(":")) return "contains the structural colon delimiter";
  if (id.includes("[")) return "contains the neighbor-clause opening delimiter";
  return null;
}

function h2hSharedVertexIdentifierIssue(value) {
  const id = String(value ?? "");
  if (!id) return "is blank";
  if (/\s/.test(id)) return "contains whitespace";
  if (id.includes(",")) return "contains the shared-vertex list delimiter";
  if (id.includes("]")) return "contains the shared-clause closing delimiter";
  const numericValue = Number(id);
  if (!Number.isNaN(numericValue)) {
    if (!Number.isFinite(numericValue)) return "would import as a non-finite numeric token";
    if (String(numericValue) !== id) return "would be normalized to a different numeric token on import";
  }
  return null;
}

/**
 * The legacy H2H text grammar has no escaping mechanism. Characterize its
 * exact lossless subset so export can fail closed instead of emitting a graph
 * that silently imports with different identifiers.
 */
export function assessH2HExportRepresentability(rows = []) {
  for (const [rowIndex, row] of (rows ?? []).entries()) {
    const hyperedgeIds = [row?.hid, ...(row?.neighbors ?? [])];
    for (const value of hyperedgeIds) {
      const reason = h2hHyperedgeIdentifierIssue(value);
      if (reason) {
        return {
          ok: false,
          kind: "hyperedge",
          identifier: String(value ?? ""),
          reason,
          rowIndex,
        };
      }
    }
    for (const vertices of (row?.sharedVertices ?? [])) {
      for (const value of (vertices ?? [])) {
        const reason = h2hSharedVertexIdentifierIssue(value);
        if (reason) {
          return {
            ok: false,
            kind: "shared-vertex",
            identifier: String(value ?? ""),
            reason,
            rowIndex,
          };
        }
      }
    }
  }
  return { ok: true };
}

export function expH2HResult(rows) {
  const assessment = assessH2HExportRepresentability(rows);
  if (!assessment.ok) {
    const reason = "Unrepresentable " + assessment.kind + " identifier "
      + JSON.stringify(assessment.identifier) + " " + assessment.reason + ".";
    const text = [
      "# H2H export not generated.",
      "# " + reason,
      "# Use H2V or Canonical JSON to preserve this graph without identifier loss.",
    ].join("\n");
    return { ok: false, text, reason, assessment };
  }
  const text = rows.map(x => x.hid + ": " + (x.neighbors.length ? x.neighbors.map((n, i) => n + "[shared: " + x.sharedVertices[i].join(",") + "]").join(", ") : "(none)")).join("\n");
  return { ok: true, text, reason: null, assessment };
}

export function expH2HAvailabilityResult(rows, availability = {}) {
  const status = availability.status ?? DERIVED_STATUS.NOT_REQUESTED;
  if (status === DERIVED_STATUS.COMPUTED) {
    return { ...expH2HResult(rows), status };
  }
  const reason = availability.reason ?? "Open the Mappings tab to request it.";
  const text = ["# H2H projection not computed.", "# " + reason].join("\n");
  return { ok: false, text, reason, assessment: null, status };
}

export function expH2H(rows) {
  return expH2HResult(rows).text;
}
export const expV2V = r => r.map(x => x.src + " -- " + x.dst + " [shared: " + x.hyperedges.join(",") + ", weight=" + x.weight + "]").join("\n");

export function expIncidence(hes) {
  const rows = [["hyperedge_id", "vertex_id", "time", "weight"]];
  hes.forEach(h => h.vertices.forEach(v => rows.push([h.id, v, h.time ?? "", h.weight ?? 1])));
  return csvDocument(rows);
}

export function expBipartite(hes) {
  const rows = [["source", "target"]];
  hes.forEach(h => h.vertices.forEach(v => rows.push(["V_" + v, "H_" + h.id])));
  return "# Bipartite edge list\n" + csvDocument(rows);
}

export function expClique(hes, { v2vResult = null } = {}) {
  const result = v2vResult ?? buildV2VBounded(hes);
  if (result.status !== DERIVED_STATUS.COMPUTED) {
    return `# V2V projection not computed.\n# ${result.reason}\n# Export refused to avoid a misleading header-only clique CSV.`;
  }
  const rows = [["source", "target", "weight"]];
  result.edges.forEach(edge => rows.push([edge.src, edge.dst, edge.weight]));
  return csvDocument(rows);
}

export function expMatrix(hes) {
  const budget = estimateMatrixExport(hes);
  if (budget.status === DERIVED_STATUS.OVER_BUDGET) {
    return matrixOverBudgetMessage(budget);
  }
  return expMatrixWithinBudget(hes);
}

export function expMatrixResult(hes) {
  const estimate = estimateMatrixExport(hes);
  if (estimate.status === DERIVED_STATUS.OVER_BUDGET) {
    return {
      status: DERIVED_STATUS.OVER_BUDGET,
      text: matrixOverBudgetMessage(estimate),
      estimate,
      limits: estimate.limits,
      reason: estimate.reason,
    };
  }
  return {
    status: DERIVED_STATUS.COMPUTED,
    text: expMatrixWithinBudget(hes),
    estimate,
    limits: estimate.limits,
    reason: null,
  };
}

export function estimateMatrixExport(hes) {
  const allV = [...new Set(hes.flatMap(h => h.vertices.map(String)))].sort(vcmp);
  const rows = allV.length + 1;
  const columns = (hes?.length ?? 0) + 1;
  const cells = rows * columns;
  const idBytes = allV.reduce((sum, v) => sum + String(v).length, 0)
    + (hes ?? []).reduce((sum, h) => sum + String(h.id).length, 0);
  const estimatedBytes = idBytes + cells * 2 + rows * 2;
  const limits = {
    matrixMaxCells: EXPORT_BUDGETS.matrixMaxCells,
    matrixMaxEstimatedBytes: EXPORT_BUDGETS.matrixMaxEstimatedBytes,
  };
  if (cells > limits.matrixMaxCells) {
    return {
      status: DERIVED_STATUS.OVER_BUDGET,
      rows,
      columns,
      cells,
      estimatedBytes,
      limits,
      reason: `matrix export would require ${cells.toLocaleString()} cells, above the ${limits.matrixMaxCells.toLocaleString()} cell safety limit`,
    };
  }
  if (estimatedBytes > limits.matrixMaxEstimatedBytes) {
    return {
      status: DERIVED_STATUS.OVER_BUDGET,
      rows,
      columns,
      cells,
      estimatedBytes,
      limits,
      reason: `matrix export is estimated at ${estimatedBytes.toLocaleString()} bytes, above the ${limits.matrixMaxEstimatedBytes.toLocaleString()} byte safety limit`,
    };
  }
  return { status: DERIVED_STATUS.COMPUTED, rows, columns, cells, estimatedBytes, limits, reason: null };
}

function expMatrixWithinBudget(hes) {
  const allV = [...new Set(hes.flatMap(h => h.vertices.map(String)))].sort(vcmp);
  const rows = [["vertex", ...hes.map(h => h.id)]];
  allV.forEach(v => rows.push([v, ...hes.map(h => h.vertices.map(String).includes(v) ? "1" : "0")]));
  return csvDocument(rows);
}

function matrixOverBudgetMessage(result) {
  return [
    "# Matrix CSV export not generated.",
    `# ${result.reason}`,
    "# Choose a sparse export such as Incidence CSV or CSR CSV for this graph.",
  ].join("\n");
}

export function expCSRCsv(csr) {
  if (!csr) return "";
  return csvDocument([
    ["vertexIds", ...(csr.vertexIds ?? [])],
    ["hyperedgeIds", ...(csr.hyperedgeIds ?? [])],
    ["rowOffsets", ...(csr.h2vCSR?.offsets ?? [])],
    ["columnIndices", ...(csr.h2vCSR?.indices ?? [])],
    ["hyperedgeTimes", ...(csr.hyperedgeTimes ?? []).map(v => v ?? "")],
    ["hyperedgeWeights", ...(csr.hyperedgeWeights ?? []).map(v => v ?? 1)],
  ]);
}

export function expCanonicalJSON(hes, meta, { v2vResult = null } = {}) {
  const result = v2vResult ?? buildV2VBounded(hes);
  const projection = result.status === DERIVED_STATUS.COMPUTED ? result.projection : { weightPolicy: "count_shared_hyperedges", edges: null };
  return JSON.stringify({
    metadata: {
      source: meta?.source ?? "Hypergraph Converter Studio",
      inputTypeDetected: meta?.fmt ?? "unknown",
      exportedAt: new Date().toISOString(),
      projection: {
        type: "v2v_2_section",
        weightPolicy: projection.weightPolicy,
        status: result.status,
        edgeCount: result.status === DERIVED_STATUS.COMPUTED ? projection.edges.length : null,
        ...(result.status === DERIVED_STATUS.COMPUTED ? {} : { omitted: true, reason: result.reason, estimatedPairs: result.estimate?.pairs, maxPairs: result.limits?.maxPairs }),
      },
    },
    canonicalHyperedges: hes.map(h => ({
      id: h.id,
      vertices: h.vertices,
      time: h.time ?? null,
      weight: h.weight ?? 1,
      attributes: h.attributes ?? {},
    })),
    v2vProjection: result.status === DERIVED_STATUS.COMPUTED ? projection.edges : null,
  }, null, 2);
}

// computeStats() runs on every graph load/change regardless of which tab is
// active (its density figures feed the agent's always-available graph
// summary), so its projection-density check uses a much smaller budget than
// the one used when the user explicitly opens the Mappings tab to view the
// full V2V table. This keeps ordinary loads fast (sub-second) even for a
// single large hyperedge, while an explicit request for the full V2V view
// still gets the larger budget. Either way, the result is a refusal
// (`null`), never a hang or a crash (V7310-D03).
const EAGER_STATS_PROJECTION_BUDGET = 50_000;

export function computeStats(hes) {
  if (!hes.length) return null;
  const V = new Set(hes.flatMap(h => h.vertices.map(String)));
  const c = hes.map(h => h.vertices.length);
  const degMap = new Map();
  hes.forEach(h => h.vertices.forEach(v => {
    const k = String(v);
    degMap.set(k, (degMap.get(k) || 0) + 1);
  }));
  const degs = [...degMap.values()];
  return {
    E: hes.length,
    V: V.size,
    min: arrayMin(c),
    max: arrayMax(c),
    avg: (c.reduce((a, b) => a + b, 0) / c.length).toFixed(1),
    hasT: hes.some(h => h.time != null),
    hasW: hes.some(h => h.weight != null && h.weight !== 1),
    cards: c,
    degs,
    incidenceDensity: incidenceDensity(hes),
    v2vProjectionDensity: projectionDensity(hes, EAGER_STATS_PROJECTION_BUDGET),
  };
}

export function countTriads(hes) {
  if (hes.length > 2000) return null;
  const v2h = new Map();
  hes.forEach(h => h.vertices.forEach(v => {
    const k = String(v);
    if (!v2h.has(k)) v2h.set(k, []);
    v2h.get(k).push(h.id);
  }));
  const adj = new Map();
  hes.forEach(h => { adj.set(h.id, new Set()); });
  hes.forEach(h => h.vertices.forEach(v => (v2h.get(String(v)) || []).forEach(o => {
    if (o !== h.id) adj.get(h.id).add(o);
  })));
  let count = 0;
  hes.forEach(h => {
    const ns = [...adj.get(h.id)];
    for (let a = 0; a < ns.length; a += 1) {
      for (let b = a + 1; b < ns.length; b += 1) {
        if (adj.get(ns[a])?.has(ns[b])) count += 1;
      }
    }
  });
  return Math.floor(count / 3);
}

export function countTriadsBounded(hes, { maxNeighborRefs = DERIVED_LIMITS.maxTriadNeighborRefs } = {}) {
  const estimate = estimateH2HNeighborReferences(hes, maxNeighborRefs);
  const limits = { maxNeighborRefs, maxHyperedges: 2_000 };
  if (estimate.overBudget) {
    return resourceLimitedDerived("triads", {
      estimate,
      limits,
      reason: `projection exceeds configured analysis budget (${estimate.references.toLocaleString()} estimated references > ${maxNeighborRefs.toLocaleString()})`,
    });
  }
  const value = countTriads(hes);
  if (value === null) {
    return resourceLimitedDerived("triads", {
      estimate,
      limits,
      reason: `triad count is limited to 2,000 hyperedges; received ${hes.length.toLocaleString()}`,
    });
  }
  return computedDerived("triads", value, { estimate, limits });
}

export function validateHes(hes) {
  const issues = [];
  const sigMap = new Map();
  hes.forEach(h => {
    const sig = JSON.stringify([...h.vertices].map(String).sort());
    if (!sigMap.has(sig)) sigMap.set(sig, []);
    sigMap.get(sig).push(h.id);
  });
  sigMap.forEach((ids, sig) => {
    if (ids.length > 1) issues.push({ type: "duplicate", msg: "Duplicate hyperedges: " + ids.join(", ") + " share " + sig });
  });
  hes.forEach(h => {
    if (h.vertices.length === 1) issues.push({ type: "singleton", msg: h.id + " has one vertex; this is a singleton hyperedge, not a graph self-loop." });
    if (h.vertices.length === 0) issues.push({ type: "empty", msg: h.id + " is empty" });
  });
  return issues;
}
