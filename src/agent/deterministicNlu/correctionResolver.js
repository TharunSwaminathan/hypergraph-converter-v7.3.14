export function resolveCorrections(text = "", clauses = []) {
  const raw = String(text ?? "");
  const corrections = [];
  if (/\b(actually|instead|rather than|i meant|no,|no\b)/i.test(raw)) {
    corrections.push({
      type: "conversation_correction",
      marker: raw.match(/\b(actually|instead|rather than|i meant|no,|no\b)/i)?.[1]?.toLowerCase() ?? "correction",
      replacesPrevious: true,
    });
  }
  const instead = raw.match(/\buse\s+([A-Za-z0-9_.:-]+)\s+instead\s+of\s+([A-Za-z0-9_.:-]+)\b/i)
    ?? raw.match(/\buse\s+([A-Za-z0-9_.:-]+)\s+and\s+not\s+([A-Za-z0-9_.:-]+)\b/i);
  if (instead) {
    corrections.push({
      type: "replace_value",
      newValue: instead[1],
      oldValue: instead[2],
    });
  }
  for (const clause of clauses) {
    if (clause.connectorFromPrevious === "instead") {
      corrections.push({ type: "instead_clause", clauseId: clause.id, replacesPrevious: true });
    }
  }
  return corrections;
}
