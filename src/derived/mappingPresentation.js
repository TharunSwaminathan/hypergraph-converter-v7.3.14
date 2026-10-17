import { DERIVED_STATUS } from "../utils/derivedResults.js";

export const MAPPING_DISPLAY_LIMITS = Object.freeze({ rows: 500, previewCharacters: 300, itemsPerCell: 40, cellCharacters: 512 });

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
  let cellsTruncated = false;
  const cell = value => {
    if (typeof value !== 'string' || value.length <= MAPPING_DISPLAY_LIMITS.cellCharacters) return value;
    cellsTruncated = true;
    return value.slice(0, MAPPING_DISPLAY_LIMITS.cellCharacters) + '... [display truncated]';
  };
  const join = (values, separator = ', ', format = String) => {
    const chosen = values.slice(0, MAPPING_DISPLAY_LIMITS.itemsPerCell);
    if (chosen.length < values.length) cellsTruncated = true;
    return cell(chosen.map((value, index) => cell(format(value, index))).join(separator)
      + (chosen.length < values.length ? `... [${values.length - chosen.length} more; export for all]` : ''));
  };
  let text = "";
  for (let index = 0; index < source.length; index += 1) {
    const item = source[index];
    if (index < rowLimit) rows.push(displayRow(type, item, join).map(cell));
    if (text.length <= previewCharacters) {
      const line = previewLine(type, item, join);
      text += (text ? "\n" : "") + line;
    }
    if (index >= rowLimit && text.length > previewCharacters) break;
  }
  return {
    rows,
    totalRows: source.length,
    text,
    complete: rows.length === source.length && !cellsTruncated,
    cellsTruncated,
  };
}

function displayRow(type, row, join) {
  switch (type) {
    case "h2v":
      return [row.hid, row.time ?? "—", join(row.vertices), row.weight != null && row.weight !== 1 ? row.weight : "1", String(row.vertices.length)];
    case "v2h":
      return [String(row.vid), join(row.hyperedges), String(row.hyperedges.length)];
    case "h2h":
      return [row.hid, row.neighbors.length ? join(row.neighbors, '  ', (neighbor,index) => `${neighbor}[${join(row.sharedVertices[index], ',')}]`) : "—", String(row.neighbors.length)];
    case "v2v":
      return [String(row.src), String(row.dst), join(row.hyperedges), String(row.weight)];
    default:
      throw new Error(`Unknown mapping presentation: ${type}`);
  }
}

function previewLine(type, row, join) {
  switch (type) {
    case "h2v":
      return row.hid + (row.time != null ? ` [t=${row.time}]` : "")
        + (row.weight != null && row.weight !== 1 ? ` @weight=${row.weight}` : "")
        + `: ${join(row.vertices)}`;
    case "v2h":
      return `${String(row.vid)}: ${join(row.hyperedges)}`;
    case "h2h":
      return `${row.hid}: ${row.neighbors.length ? join(row.neighbors, ', ', (neighbor,index) => `${neighbor}[shared: ${join(row.sharedVertices[index], ',')}]`) : "(none)"}`;
    case "v2v":
      return `${row.src} -- ${row.dst} [shared: ${join(row.hyperedges, ',')}, weight=${row.weight}]`;
    default:
      return "";
  }
}
