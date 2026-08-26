export function createTrace() {
  return {
    matchedRuleIds: [],
    resolvedEntityIds: [],
    rejectedCandidates: [],
  };
}

export function addTrace(trace, kind, value) {
  if (!trace || !kind || value === undefined || value === null || value === "") return trace;
  const key = kind === "rule" ? "matchedRuleIds" : kind === "resolved" ? "resolvedEntityIds" : "rejectedCandidates";
  trace[key] = [...new Set([...(trace[key] ?? []), String(value)])];
  return trace;
}

export function conciseTraceLines(trace = {}) {
  const lines = [];
  for (const rule of trace.matchedRuleIds ?? []) lines.push(`matched rule: ${rule}`);
  for (const resolved of trace.resolvedEntityIds ?? []) lines.push(`resolved: ${resolved}`);
  for (const rejected of trace.rejectedCandidates ?? []) lines.push(`rejected: ${rejected}`);
  return lines.slice(0, 12);
}
