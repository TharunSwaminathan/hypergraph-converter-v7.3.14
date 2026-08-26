export const FORMAT_FEW_SHOTS = [
  {
    name: "H2V / Simple",
    inputRoute: "simple",
    userSays: ["h2v", "hyperedge to vertex", "each edge lists vertices"],
    fixture: "h0 [t=10]: 1, 2, 3\nh1 [t=15]: 2, 4 @weight=2\nh2 [t=21]: 1, 3, 4, 5",
    firstActions: ["SELECT_INPUT_ROUTE"],
  },
  {
    name: "Cornell / SNAP",
    inputRoute: "cornell",
    userSays: ["cornell", "snap", "nverts", "simplices"],
    fixture: "nverts.txt: 3\\n2\\n4; simplices.txt: 1\\n2\\n3\\n2\\n4\\n1\\n3\\n4\\n5; times.txt optional",
    firstActions: ["SELECT_INPUT_ROUTE"],
  },
  {
    name: "Incidence edge list",
    inputRoute: "incidence",
    userSays: ["incidence", "membership rows", "hyperedge_id vertex_id"],
    fixture: "h0,1,10,1\nh0,2,10,1\nh0,3,10,1\nh1,2,15,2",
    firstActions: ["SELECT_INPUT_ROUTE"],
  },
  {
    name: "CSV rows as hyperedges",
    inputRoute: "csv",
    userSays: ["csv rows", "each row is a hyperedge"],
    fixture: "1 2 3\n2 4\n1 3 4 5",
    firstActions: ["SELECT_INPUT_ROUTE"],
  },
  {
    name: "Graph edge list",
    inputRoute: "edgelist",
    userSays: ["graph edge list", "pairwise graph", "size-two hyperedges"],
    fixture: "1 2\n2 3\n1 3\n3 4",
    firstActions: ["SELECT_INPUT_ROUTE"],
  },
  {
    name: "JSON",
    inputRoute: "json",
    userSays: ["json", "canonical object", "array of id vertices"],
    fixture: "[{\"id\":\"h0\",\"vertices\":[1,2,3],\"time\":10},{\"id\":\"h1\",\"vertices\":[2,4],\"time\":15,\"weight\":2}]",
    firstActions: ["SELECT_INPUT_ROUTE"],
  },
  {
    name: "V2H",
    inputRoute: "v2h",
    userSays: ["v2h", "vertex to hyperedge"],
    fixture: "1: h0, h2\n2: h0, h1\n3: h0, h2\n4: h1, h2",
    firstActions: ["SELECT_INPUT_ROUTE"],
  },
  {
    name: "H2H projection",
    inputRoute: "h2h",
    userSays: ["h2h", "hyperedge projection", "shared vertices"],
    fixture: "h0: h1[shared: 2], h2[shared: 1,3]\nh1: h0[shared: 2], h2[shared: 4]",
    firstActions: ["SELECT_INPUT_ROUTE"],
  },
  {
    name: "CSR JSON",
    inputRoute: "csr_json",
    userSays: ["csr", "csr json", "compressed sparse row"],
    fixture: "{\"vertexIds\":[\"1\",\"2\",\"3\"],\"hyperedgeIds\":[\"h0\"],\"h2vCSR\":{\"offsets\":[0,3],\"indices\":[0,1,2]}}",
    firstActions: ["SELECT_INPUT_ROUTE"],
  },
  {
    name: "CSR / CSC CSV",
    inputRoute: "csr_csv",
    userSays: ["csr csv", "csc csv", "compressed sparse column"],
    fixture: "vertexIds,1,2,3,4,5\nhyperedgeIds,h0,h1,h2\nrowOffsets,0,3,5,9\ncolumnIndices,0,1,2,1,3,0,2,3,4",
    firstActions: ["SELECT_INPUT_ROUTE"],
  },
  {
    name: "Adjacency List",
    inputRoute: "adjlist",
    userSays: ["adjacency list", "adjlist"],
    fixture: "1: 2 3\n2: 1 4\n3: 1 4\n4: 2 3",
    firstActions: ["SELECT_INPUT_ROUTE"],
  },
  {
    name: "Custom Parser",
    inputRoute: "custom",
    userSays: ["custom parser", "multiple files", "parser code"],
    fixture: "Upload files, generate or edit parseHypergraph(files, helpers), run locally, validate preview, then apply with confirmation.",
    firstActions: ["OPEN_CUSTOM_PARSER"],
  },
];

const normalize = text => String(text ?? "")
  .toLowerCase()
  .replace(/[’]/g, "'")
  .replace(/\s+/g, " ")
  .trim();

function addByRoute(selected, routeId) {
  const example = FORMAT_FEW_SHOTS.find(item => item.inputRoute === routeId);
  if (example && !selected.some(item => item.inputRoute === example.inputRoute)) selected.push(example);
}

function queryMentions(query, words = []) {
  return words.some(word => query.includes(word));
}

export function selectFormatFewShots({
  userQuery = "",
  appContext = null,
  maxExamples = 3,
} = {}) {
  const query = normalize(userQuery);
  const selected = [];

  if (/\b(h2v|hyperedge[- ]to[- ]vertex)\b/.test(query)) {
    addByRoute(selected, "simple");
    addByRoute(selected, "v2h");
  }
  if (/\b(v2h|vertex[- ]to[- ]hyperedge)\b/.test(query)) {
    addByRoute(selected, "v2h");
    addByRoute(selected, "simple");
  }
  if (/\bcsr json|compressed sparse row\b/.test(query) || /\bcsr\b/.test(query)) {
    addByRoute(selected, "csr_json");
    addByRoute(selected, "csr_csv");
  }
  if (/\b(csc|csr csv|csc csv|compressed sparse column)\b/.test(query)) {
    addByRoute(selected, "csr_csv");
    addByRoute(selected, "csr_json");
  }
  if (/\b(cornell|snap|nverts|simplices)\b/.test(query)) {
    addByRoute(selected, "cornell");
  }
  if (/\bincidence(?: edge list)?\b/.test(query)) addByRoute(selected, "incidence");
  if (/\b(graph edge list|pairwise graph|size[- ]?two)\b/.test(query)) addByRoute(selected, "edgelist");
  if (/\b(h2h|hyperedge projection|shared vertices)\b/.test(query)) addByRoute(selected, "h2h");
  if (/\badjacency list|adjlist\b/.test(query)) addByRoute(selected, "adjlist");
  if (/\bjson\b/.test(query) && !queryMentions(query, ["csr json", "canonical json", "full json"])) addByRoute(selected, "json");
  if (/\bcsv\b/.test(query) && !queryMentions(query, ["csr csv", "csc csv", "incidence csv"])) addByRoute(selected, "csv");
  if (/\bcustom parser|multiple files?|parser code\b/.test(query)) addByRoute(selected, "custom");

  const detectedRoute = appContext?.activeBatch?.detectedFormat?.formatId
    ?? appContext?.boundedActiveBatchPreview?.detectedFormat
    ?? null;
  if (detectedRoute && detectedRoute !== "custom") addByRoute(selected, detectedRoute);

  const currentRoute = appContext?.currentRoute?.fmt;
  if (selected.length === 0 && /\b(current route|this route|selected route)\b/.test(query) && currentRoute) {
    addByRoute(selected, currentRoute);
  }

  return selected.slice(0, Math.max(0, Math.min(3, Number(maxExamples) || 0)));
}

export function formatFewShotsForPrompt(examples = FORMAT_FEW_SHOTS) {
  const selected = Array.isArray(examples) ? examples : [];
  if (!selected.length) return "No format few-shots selected for this request.";
  return selected
    .map(example => [
      `Format: ${example.name}`,
      `inputRoute: ${example.inputRoute}`,
      `User language: ${example.userSays.join(", ")}`,
      `Fixture: ${example.fixture}`,
      `Typical first actions: ${example.firstActions.join(" -> ")}`,
    ].join("\n"))
    .join("\n\n");
}

