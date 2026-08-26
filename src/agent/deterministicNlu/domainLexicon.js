export const DOMAIN_LEXICON = Object.freeze({
  datasetRoles: [
    { id: "role.vertex_table", canonical: "vertex_table", aliases: ["vertex table", "vertices table", "vertex file", "vertices file", "node table", "nodes file", "node file", "nodes", "vertices"] },
    { id: "role.hyperedge_table", canonical: "hyperedge_table", aliases: ["hyperedge table", "hyperedges table", "hyperedge file", "hyperedges", "hyperedge", "group table", "groups", "groups file", "paper table", "papers table", "edge table"] },
    { id: "role.membership", canonical: "membership", aliases: ["membership table", "membership file", "incidence table", "incidence file", "authorship table", "link table"] },
    { id: "role.edge_list", canonical: "edge_list", aliases: ["edge list", "pairwise edge list", "pairwise graph"] },
    { id: "role.validation_expected_output", canonical: "validation_expected_output", aliases: ["validation", "expected output", "expected", "ground truth", "gold", "reference output"] },
    { id: "role.update_stream", canonical: "update_stream", aliases: ["update stream", "updates file", "deltas", "changes"] },
    { id: "role.ignored", canonical: "ignored", aliases: ["ignore", "ignored", "skip", "exclude"] },
  ],
  keyTerms: [
    { id: "key.primary", canonical: "key", aliases: ["key", "id", "identifier", "primary key", "id column", "id columns"] },
    { id: "key.composite", canonical: "composite_key", aliases: ["composite", "combined key", "repeat every", "together as a key"] },
  ],
  relationshipTerms: [
    { id: "join.membership", canonical: "membership_join", aliases: ["connects", "connect", "links", "link", "belongs to", "belong to", "authorships tells", "membership"] },
    { id: "join.column", canonical: "join", aliases: ["join", "match", "map", "relate"] },
  ],
  policyTerms: [
    { id: "policy.preserve_empty", canonical: "preserve_empty", aliases: ["keep empty", "preserve empty", "papers with no authors", "no authors", "no memberships", "unmatched", "empty hyperedges"] },
    { id: "policy.deduplicate", canonical: "deduplicate", aliases: ["deduplicate", "de-duplicate", "remove duplicates", "repeated authorships"] },
  ],
  groupingTerms: [
    { id: "group.together", canonical: "together", aliases: ["belong together", "together", "same dataset", "one dataset", "one graph"] },
    { id: "group.separate", canonical: "separate", aliases: ["separate", "separate datasets", "own dataset", "different dataset"] },
    { id: "group.first_two", canonical: "first_two", aliases: ["first two", "first 2"] },
  ],
  parserPhases: [
    { id: "parser.plan", canonical: "generate_plan", aliases: ["generate the transformation plan", "create the transformation plan", "make the plan", "show the plan", "generate the plan"] },
    { id: "parser.generate", canonical: "generate_parser", aliases: ["generate the parser", "create the parser", "make the parser", "insert the parser"] },
    { id: "parser.run", canonical: "run_parser", aliases: ["run it", "run the parser", "execute it", "test the parser"] },
    { id: "parser.apply", canonical: "apply_parser_result", aliases: ["apply the result", "apply parser result", "load the parser result"] },
    { id: "parser.next", canonical: "next_step", aliases: ["continue", "next step", "what should i do next", "show the next step"] },
  ],
  graphOperations: [
    { id: "graph.add_incidence", canonical: "add_incidence", aliases: ["include", "needs", "add", "put", "insert"] },
    { id: "graph.remove_incidence", canonical: "remove_incidence", aliases: ["take out", "remove from", "detach from", "leave out"] },
    { id: "graph.rename", canonical: "rename", aliases: ["rename", "call that", "call it"] },
  ],
  dashboardSections: [
    { id: "dashboard.stats", canonical: "stats", aliases: ["stats", "statistics", "how many vertices", "how many hyperedges"] },
    { id: "dashboard.visualization", canonical: "visualization", aliases: ["visualization", "visualize", "graph preview", "show graph"] },
    { id: "dashboard.export", canonical: "export", aliases: ["export", "download", "preview export"] },
    { id: "dashboard.runtime", canonical: "runtime_diagnostics", aliases: ["runtime diagnostics", "ollama diagnostics", "connection diagnostics"] },
  ],
  correctionMarkers: [
    { id: "correction.actual", canonical: "correction", aliases: ["actually", "no,", "no ", "instead", "rather than", "i meant"] },
  ],
  cancellationMarkers: [
    { id: "cancel.stop", canonical: "cancel", aliases: ["stop", "cancel", "do not run", "don't run", "nevermind", "never mind"] },
  ],
  questionMarkers: [
    { id: "question.start", canonical: "question", aliases: ["what", "why", "how", "which", "where", "does", "do", "can", "would"] },
  ],
});

export function normalForm(value = "") {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function containsAlias(text = "", family = []) {
  const comparable = ` ${normalForm(text)} `;
  return family.some(entry => entry.aliases.some(alias => comparable.includes(` ${normalForm(alias)} `)));
}

export function findLexiconMatches(text = "", family = []) {
  const comparable = ` ${normalForm(text)} `;
  const matches = [];
  family.forEach(entry => {
    entry.aliases.forEach(alias => {
      if (comparable.includes(` ${normalForm(alias)} `)) {
        matches.push({ id: entry.id, canonical: entry.canonical, alias });
      }
    });
  });
  return matches;
}

export function roleFromAlias(text = "") {
  const matches = findLexiconMatches(text, DOMAIN_LEXICON.datasetRoles);
  return matches[0]?.canonical ?? null;
}

export function aliasesForCanonicalRole(role) {
  return DOMAIN_LEXICON.datasetRoles.find(entry => entry.canonical === role)?.aliases ?? [];
}
