import { DERIVED_STATUS } from "../utils/derivedResults.js";

export const MAPPING_DISPLAY_LIMITS = Object.freeze({ rows: 500, previewCharacters: 300 });

export function buildMappingPresentation(type, data, {
  status = DERIVED_STATUS.COMPUTED,
  reason = null,
  rowLimit = MAPPING_DISPLAY_LIMITS.rows,
  previewCharacters = MAPPING_DISPLAY_LIMITS.previewCharacters,
} = {}) {
  if (status !== DERIVED_STATUS.COMPUTED) {
    const label = status === DERIVED_STATUS.COMPUTING ? "computing exact result" : (reason ?? "not requested");
    return { rows: [], totalRows: 0, text: `# ${type.toUpperCase()} ${label}.`, complete: false };
  }
  const source = data ?? [];
  const rows = [];
  let text = "";
  for (let index = 0; index < source.length; index += 1) {
    const item = source[index];
    if (index < rowLimit) rows.push(displayRow(type, item));
    if (text.length <= previewCharacters) {
      const line = previewLine(type, item);
      text += (text ? "\n" : "") + line;
    }
    if (index >= rowLimit && text.length > previewCharacters) break;
  }
  return {
    rows,
    totalRows: source.length,
    text,
    complete: rows.length === source.length,
  };
}

function displayRow(type, row) {
  switch (type) {
    case "h2v":
      return [row.hid, row.time ?? "—", row.vertices.join(", "), row.weight != null && row.weight !== 1 ? row.weight : "1", String(row.vertices.length)];
    case "v2h":
      return [String(row.vid), row.hyperedges.join(", "), String(row.hyperedges.length)];
    case "h2h":
      return [row.hid, row.neighbors.length ? row.neighbors.map((neighbor, index) => `${neighbor}[${row.sharedVertices[index].join(",")}]`).join("  ") : "—", String(row.neighbors.length)];
    case "v2v":
      return [String(row.src), String(row.dst), row.hyperedges.join(", "), String(row.weight)];
    default:
      throw new Error(`Unknown mapping presentation: ${type}`);
  }
}

function previewLine(type, row) {
  switch (type) {
    case "h2v":
      return row.hid + (row.time != null ? ` [t=${row.time}]` : "")
        + (row.weight != null && row.weight !== 1 ? ` @weight=${row.weight}` : "")
        + `: ${row.vertices.join(", ")}`;
    case "v2h":
      return `${String(row.vid)}: ${row.hyperedges.join(", ")}`;
    case "h2h":
      return `${row.hid}: ${row.neighbors.length ? row.neighbors.map((neighbor, index) => `${neighbor}[shared: ${row.sharedVertices[index].join(",")}]`).join(", ") : "(none)"}`;
    case "v2v":
      return `${row.src} -- ${row.dst} [shared: ${row.hyperedges.join(",")}, weight=${row.weight}]`;
    default:
      return "";
  }
}
