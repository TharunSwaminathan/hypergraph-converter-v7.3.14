export const DELIMITED_DELIMITERS = [",", "\t", ";", "|"];

export function splitDelimitedRows(text = "", delimiter = ",", {
  maxRows = Infinity,
  keepEmptyRows = false,
} = {}) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text ?? "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === "\"") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (keepEmptyRows || row.some(value => value !== "")) rows.push(row);
      if (rows.length >= maxRows) return rows;
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (keepEmptyRows || row.some(value => value !== "")) rows.push(row);
  return rows.slice(0, maxRows);
}

function scoreDelimiter(text, delimiter) {
  const rows = splitDelimitedRows(text, delimiter, { maxRows: 12 });
  if (rows.length < 2) return 0;
  const widths = rows.map(row => row.length);
  const expected = [...widths].sort((a, b) => widths.filter(x => x === b).length - widths.filter(x => x === a).length)[0];
  const consistent = widths.filter(width => width === expected).length;
  return expected > 1 ? expected * 4 + consistent : 0;
}

export function detectDelimiter(text = "") {
  return DELIMITED_DELIMITERS
    .map(delimiter => ({ delimiter, score: scoreDelimiter(text, delimiter) }))
    .sort((left, right) => right.score - left.score)[0]?.delimiter ?? ",";
}

function looksLikeHeader(row = [], nextRow = []) {
  if (!row.length || !nextRow.length) return false;
  const nonNumericHeaders = row.filter(value => !/^-?\d+(?:\.\d+)?$/.test(String(value).trim())).length;
  const numericData = nextRow.filter(value => /^-?\d+(?:\.\d+)?$/.test(String(value).trim())).length;
  const uniqueHeaders = new Set(row.map(value => String(value).trim().toLowerCase())).size === row.length;
  return uniqueHeaders && nonNumericHeaders >= Math.max(1, Math.ceil(row.length * 0.6)) && (numericData > 0 || row.some(value => /id|name|source|target|vertex|edge|year|time|weight/i.test(String(value))));
}

function fallbackHeaders(width) {
  return Array.from({ length: width }, (_, index) => `column_${index + 1}`);
}

export function parseDelimited(text = "", {
  delimiter = null,
  hasHeader = "auto",
  maxRows = Infinity,
  trim = true,
} = {}) {
  const resolvedDelimiter = delimiter ?? detectDelimiter(text);
  const parsedRows = splitDelimitedRows(text, resolvedDelimiter, { maxRows: Number.isFinite(maxRows) ? maxRows + 1 : Infinity });
  const first = parsedRows[0] ?? [];
  const second = parsedRows[1] ?? [];
  const headerDetected = hasHeader === "auto" ? looksLikeHeader(first, second) : Boolean(hasHeader);
  const headers = headerDetected ? first.map((value, index) => String(value || `column_${index + 1}`).trim()) : fallbackHeaders(first.length);
  const dataRows = headerDetected ? parsedRows.slice(1) : parsedRows;
  const limitedRows = Number.isFinite(maxRows) ? dataRows.slice(0, maxRows) : dataRows;
  const rows = limitedRows.map(row => headers.map((_, index) => {
    const value = row[index] ?? "";
    return trim ? String(value).trim() : String(value);
  }));
  const records = rows.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
  const widths = parsedRows.map(row => row.length);
  const expectedWidth = headers.length;
  return {
    delimiter: resolvedDelimiter,
    hasHeader: headerDetected,
    headers,
    rows,
    records,
    rowCount: dataRows.length,
    sampledRowCount: rows.length,
    truncated: Number.isFinite(maxRows) && dataRows.length > maxRows,
    rowWidth: {
      expected: expectedWidth,
      inconsistentRows: widths.filter(width => width !== expectedWidth).length,
    },
  };
}

export function parseCSV(text = "", options = {}) {
  return parseDelimited(text, { delimiter: ",", ...options }).records;
}

export function splitLines(text = "", { trim = true, skipEmpty = true, comments = false } = {}) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map(line => {
      const cleaned = comments ? line.replace(/#.*$/, "") : line;
      return trim ? cleaned.trim() : cleaned;
    })
    .filter(line => !skipEmpty || line.length > 0);
}
