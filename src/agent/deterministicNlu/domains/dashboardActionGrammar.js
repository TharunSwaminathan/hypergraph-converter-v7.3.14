const ROUTE_ALIASES = [
  ["h2v", "H2V"],
  ["v2h", "V2H"],
  ["h2h", "H2H"],
  ["csr", "CSR"],
  ["csc", "CSC"],
  ["json", "JSON"],
  ["cornell", "Cornell/SNAP"],
  ["snap", "Cornell/SNAP"],
  ["custom parser", "Custom Parser"],
  ["ai prompt", "AI Prompt"],
];

export const DASHBOARD_CANONICAL_INTENTS = Object.freeze([
  "NAVIGATE_STATS",
  "NAVIGATE_VISUALIZATION",
  "OPEN_RUNTIME_DIAGNOSTICS",
  "SET_VISUAL_LIMIT",
  "SET_INPUT_ROUTE",
  "SET_EXPORT_FORMAT",
]);

export function compileDashboardActionGrammar(text = "", { nlu = null } = {}) {
  const raw = String(text ?? "").trim();
  if (/\b(?:do\s+not|don't|not)\s+(?:download|export|switch|open|use)\b|\b(?:download|export)\b[\s\S]{0,80}\bnot\b[\s\S]{0,30}\byet\b/i.test(raw)) {
    return { ok: false, noMatch: true };
  }
  if (!/\b(show|open|use|switch|go|take|export|download|stats|statistics|visual|csr|csc|json|h2v|v2h|h2h|diagnostics?|runtime|limit)\b/i.test(raw)) {
    return { ok: false, noMatch: true };
  }
  const lower = raw.toLowerCase();
  const canonical = canonicalControlIntent(lower);
  if (!canonical) return { ok: false, noMatch: true };
  const slots = controlSlots(lower);
  return {
    ok: true,
    domain: "dashboard_control",
    intent: canonical,
    canonicalIntent: canonical,
    typedKind: "DashboardControlIntent",
    slots,
    diagnostics: {
      plannerPath: "deterministic_nlu",
      nluDomain: "dashboard_control",
      nluIntent: canonical,
      nluConfidence: nlu?.confidence,
      nluTrace: nlu?.trace,
      authoritativeCompiler: "dashboard_control_v1",
      legacyParserCalled: false,
      modelCalled: false,
      genericActionPlannerCalled: false,
      semanticConfidence: {
        score: 0.9,
        level: "high",
        reasons: ["canonical dashboard intent resolved"],
      },
      operationTypes: [canonical],
      resolvedEntities: Object.entries(slots).map(([key, value]) => `${key}:${value}`),
    },
  };
}

function canonicalControlIntent(lower) {
  if (/\b(stats|statistics|how many vertices|how many hyperedges|statistics view)\b/.test(lower)) return "NAVIGATE_STATS";
  if (/\b(runtime diagnostics|ollama diagnostics|connection diagnostics|local runtime)\b/.test(lower)) return "OPEN_RUNTIME_DIAGNOSTICS";
  if (/\b(limit|show only|first \d+)\b/.test(lower)) return "SET_VISUAL_LIMIT";
  if (/\bvisual|visualization|show graph|graph preview\b/.test(lower)) return "NAVIGATE_VISUALIZATION";
  if (/\bexport|download|preview export\b/.test(lower)) return "SET_EXPORT_FORMAT";
  if (/\b(route|tab|input|format|use|switch|open)\b/.test(lower) && routeSlot(lower)) return "SET_INPUT_ROUTE";
  return null;
}

function controlSlots(lower) {
  const route = routeSlot(lower);
  const visualLimit = Number(lower.match(/\b(?:limit(?:\s+to)?|show only(?:\s+the\s+first)?|first)\s+(\d+)\b/)?.[1] ?? NaN);
  const exportFormat = /\bcsr\b/.test(lower) && /\bcsv\b/.test(lower) ? "CSR CSV"
    : /\bcsc\b/.test(lower) && /\bcsv\b/.test(lower) ? "CSC CSV"
      : /\bjson\b/.test(lower) ? "JSON"
        : /\bh2v\b/.test(lower) ? "H2V"
          : null;
  return {
    ...(route ? { route } : {}),
    ...(Number.isFinite(visualLimit) ? { visualLimit } : {}),
    ...(exportFormat ? { exportFormat } : {}),
  };
}

function routeSlot(lower) {
  const match = ROUTE_ALIASES.find(([alias]) => lower.includes(alias));
  return match?.[1] ?? null;
}
