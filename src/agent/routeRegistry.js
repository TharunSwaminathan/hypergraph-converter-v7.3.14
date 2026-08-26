const normalize = text => String(text ?? "").toLowerCase().replace(/\s+/g, " ").trim();

export const ROUTE_REGISTRY = {
  h2v: {
    id: "h2v",
    label: "H2V / Simple",
    formatId: "simple",
    guidance: "H2V means Hyperedge-to-Vertex. Each line names a hyperedge and lists its vertices, for example: h1: A, B, C.",
  },
  v2h: {
    id: "v2h",
    label: "V2H",
    formatId: "v2h",
    guidance: "V2H means Vertex-to-Hyperedge. Each line names a vertex and lists the hyperedges that contain it, for example: A: h1, h2.",
  },
  incidence: {
    id: "incidence",
    label: "Incidence Edge List",
    formatId: "incidence",
    guidance: "Incidence input uses one membership per row: hyperedge_id, vertex_id, time, weight. Time and weight may be left blank.",
  },
  edge_list: {
    id: "edge_list",
    label: "Graph Edge List",
    formatId: "edgelist",
    guidance: "Graph edge-list input treats each pairwise row as a size-two hyperedge, for example: A B.",
  },
  h2h: {
    id: "h2h",
    label: "H2H Projection",
    formatId: "h2h",
    guidance: "H2H describes hyperedge neighbors and their shared vertices, for example: h0: h1[shared: A,B]. It is a projection, so it can be lossy compared with original H2V memberships.",
  },
  csr: {
    id: "csr",
    label: "CSR JSON",
    formatId: "csr_json",
    guidance: "CSR JSON stores memberships compactly with vertexIds plus h2vCSR.offsets and h2vCSR.indices arrays.",
  },
  csc_csv: {
    id: "csc_csv",
    label: "CSR / CSC CSV",
    formatId: "csr_csv",
    guidance: "CSR / CSC CSV uses labeled rows such as vertexIds, hyperedgeIds, rowOffsets, and columnIndices.",
  },
  csv: {
    id: "csv",
    label: "CSV",
    formatId: "csv",
    guidance: "CSV input treats each delimited row as one hyperedge and the row values as its vertices.",
  },
  adjlist: {
    id: "adjlist",
    label: "Adjacency List",
    formatId: "adjlist",
    guidance: "Adjacency List input uses one node followed by its neighbors, for example: A: B C D. Reverse duplicate pairs such as A: B and B: A are treated as one undirected size-two hyperedge.",
  },
  freeform: {
    id: "freeform",
    label: "Freeform / NLP",
    formatId: "freeform",
    guidance: "Freeform input uses the local deterministic sentence and proper-noun extractor; it does not call an online model.",
  },
  json: {
    id: "json",
    label: "JSON",
    formatId: "json",
    guidance: "JSON accepts an array of {id, vertices} objects or the app's canonical hypergraph object.",
  },
  cornell: {
    id: "cornell",
    label: "Cornell / SNAP",
    formatId: "cornell",
    guidance: "Cornell / SNAP input combines nverts.txt and simplices.txt, with an optional times.txt file.",
  },
  ai_prompt: {
    id: "ai_prompt",
    label: "AI Prompt",
    formatId: "ai_prompt",
    guidance: "The AI Prompt route prepares a prompt for manual use elsewhere. The offline agent itself never calls an LLM or external API.",
  },
  custom_parser: {
    id: "custom_parser",
    label: "Custom Parser",
    formatId: "custom",
    guidance: "Custom Parser handles unusual or multi-file inputs with local JavaScript: upload files, edit parser code, run it, validate the preview, then apply it to the graph.",
  },
  visualization: {
    id: "visualization",
    label: "Visualization",
    virtual: true,
    guidance: "The graph preview supports force, circular, and grid layouts, vertex search, zoom, pan, and a configurable hyperedge limit.",
  },
  mappings: {
    id: "mappings",
    label: "Mappings",
    sectionId: "mappings",
    virtual: true,
    guidance: "Mappings shows the generated H2V, V2H, H2H, and V2V views for the current graph.",
  },
  export: {
    id: "export",
    label: "Export Preview",
    sectionId: "export",
    virtual: true,
    guidance: "Export Preview lets you inspect a generated format before choosing whether to download it.",
  },
  stats: {
    id: "stats",
    label: "Statistics",
    sectionId: "stats",
    virtual: true,
    guidance: "Statistics summarizes the currently parsed graph, including cardinalities, degrees, validation, and projections.",
  },
  diagnostics: {
    id: "diagnostics",
    label: "Diagnostics / Help",
    virtual: true,
    guidance: "Diagnostics checks the selected route, input contents, parse status, current graph counts, and any parser warnings or errors.",
  },
};

const ROUTE_MATCHERS = [
  ["custom_parser", /\b(custom parser|parser code|multiple files?)\b/],
  ["ai_prompt", /\b(ai prompt|llm prompt)\b/],
  ["cornell", /\b(cornell|snap|nverts|simplices)\b/],
  ["csc_csv", /\b(csc|compressed sparse column|csr\s*\/\s*csc|csr csv)\b/],
  ["csr", /\b(csr|compressed sparse row)\b/],
  ["incidence", /\bincidence(?: edge list)?\b/],
  ["csv", /\bcsv\b/],
  ["edge_list", /\b(graph edge list|pairwise graph|edge list)\b/],
  ["h2h", /\b(h2h|hyperedge projection|hyperedge[- ]to[- ]hyperedge)\b/],
  ["h2v", /\b(h2v|hyperedge[- ]to[- ]vertex)\b/],
  ["v2h", /\b(v2h|vertex[- ]to[- ]hyperedge)\b/],
  ["json", /\bjson\b/],
  ["adjlist", /\b(adjacency list|adjlist)\b/],
  ["freeform", /\b(freeform|nlp)\b/],
  ["visualization", /\b(visuali[sz](?:e|ation)|show graph|graph preview|zoom|layout)\b/],
  ["stats", /\b(stats?|statistics|how many vertices|how many hyperedges)\b/],
  ["mappings", /\bmappings?\b/],
  ["export", /\b(export|preview format)\b/],
  ["diagnostics", /\b(diagnos|error|not working|refresh|slow)\w*\b/],
];

export function findRoute(text) {
  const value = normalize(text);
  const match = ROUTE_MATCHERS.find(([, pattern]) => pattern.test(value));
  return match ? ROUTE_REGISTRY[match[0]] : null;
}

export const EXPORT_PREVIEWS = {
  h2v_txt: { id: "h2v_txt", label: "H2V text" },
  v2h_txt: { id: "v2h_txt", label: "V2H text" },
  h2h_txt: { id: "h2h_txt", label: "H2H text" },
  canonical: { id: "canonical", label: "Canonical JSON" },
  incidence: { id: "incidence", label: "Incidence CSV" },
  bipartite: { id: "bipartite", label: "Bipartite CSV" },
  clique: { id: "clique", label: "Clique CSV" },
  matrix: { id: "matrix", label: "Matrix CSV" },
  csr_json: { id: "csr_json", label: "CSR JSON" },
  csr_csv: { id: "csr_csv", label: "CSR CSV" },
  full_json: { id: "full_json", label: "Full JSON" },
  all_txt: { id: "all_txt", label: "All mappings" },
};

const EXPORT_MATCHERS = [
  ["csr_csv", /\bcsr csv\b/],
  ["csr_json", /\b(?:csr json|compressed sparse row(?: json)?|csr format|csr)\b/],
  ["canonical", /\bcanonical(?: json)?\b/],
  ["full_json", /\bfull json\b/],
  ["incidence", /\bincidence(?: csv)?\b/],
  ["bipartite", /\bbipartite(?: csv)?\b/],
  ["clique", /\b(?:clique(?: csv)?|pairwise projection)\b/],
  ["matrix", /\b(?:incidence )?matrix(?: csv)?\b/],
  ["all_txt", /\ball mappings?\b/],
  ["h2h_txt", /\b(?:h2h|hyperedge[- ]to[- ]hyperedge)(?: text| txt)?\b/],
  ["v2h_txt", /\b(?:v2h|vertex[- ]to[- ]hyperedge)(?: text| txt)?\b/],
  ["h2v_txt", /\b(?:h2v|hyperedge[- ]to[- ]vertex)(?: text| txt)?\b/],
];

export function resolveInputRouteAlias(text) {
  const value = normalize(text);
  if (!value) return null;
  const match = ROUTE_MATCHERS.find(([routeId, pattern]) => {
    const route = ROUTE_REGISTRY[routeId];
    return route?.formatId && pattern.test(value);
  });
  return match ? ROUTE_REGISTRY[match[0]].formatId : null;
}

export function resolveExportAlias(text) {
  const value = normalize(text);
  if (!value) return null;
  const match = EXPORT_MATCHERS.find(([, pattern]) => pattern.test(value));
  return match ? EXPORT_PREVIEWS[match[0]] : null;
}

function targetExportSegments(text) {
  const value = normalize(text);
  if (!value) return [];
  const segments = [];
  const patterns = [
    /\b(?:convert|transform|translate)\b[\s\S]*?\bto\b([\s\S]+)$/i,
    /\b(?:export|download|save|output|preview)\b[\s\S]*?\b(?:as|to|in)\b([\s\S]+)$/i,
    /\b(?:give me|show|open|select)\b([\s\S]+)$/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) segments.push(match[1]);
  }
  return segments;
}

export function findTargetExportPreview(text) {
  const targetMatch = targetExportSegments(text)
    .map(segment => resolveExportAlias(segment))
    .find(Boolean);
  return targetMatch ?? resolveExportAlias(text);
}

export function findExportPreview(text) {
  return resolveExportAlias(text);
}

export function getRouteById(routeId) {
  return ROUTE_REGISTRY[routeId] ?? null;
}

export function getRouteByFormat(formatId) {
  return Object.values(ROUTE_REGISTRY).find(route => route.formatId === formatId) ?? null;
}
