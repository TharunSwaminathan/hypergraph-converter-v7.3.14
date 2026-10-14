const MAX_ID_TEXT = 160;
const MAX_VERTEX_PREVIEW = 12;

function cleanId(value) {
  return String(value ?? "").trim().slice(0, MAX_ID_TEXT);
}

function plural(count, singular, pluralForm = `${singular}s`) {
  return Number(count) === 1 ? singular : pluralForm;
}

function selectedComputedAlgorithm(algorithmSummary, expectedId, expectedKind = expectedId) {
  return Boolean(
    algorithmSummary
    && algorithmSummary.selectedId === expectedId
    && algorithmSummary.hasResult === true
    && algorithmSummary.status === "computed"
    && !algorithmSummary.error
    && (!algorithmSummary.result?.status || algorithmSummary.result.status === "computed")
    && algorithmSummary.result?.kind === expectedKind,
  );
}

/**
 * Return an authoritative answer for questions that ask for a result produced
 * by the Algorithms panel.  A mathematically inferable answer is deliberately
 * not substituted for a result that the application has not computed.
 */
export function composeAuthoritativeAlgorithmAnswer(query = "", algorithmSummary = null) {
  const value = String(query ?? "");

  if (/\b(?:how many|number of|count of|what(?:'s| is) the (?:current )?(?:number|count) of)\s+connected components?\b|\bconnected components?\s+(?:count|result)\b/i.test(value)) {
    if (!selectedComputedAlgorithm(algorithmSummary, "connected_components")) {
      return "Connected Components has not been computed for the current graph yet. Run Connected Components in the Algorithms panel first; I will not infer a result and present it as a computed application result.";
    }
    const count = Number(algorithmSummary.result.count) || 0;
    return `The current Connected Components result has ${count} ${plural(count, "connected component")}.`;
  }

  if (/\b(?:bfs|breadth[- ]first search)\b[\s\S]{0,40}\b(?:result|reached|visit(?:ed)?|order)\b|\b(?:how many|which)\b[\s\S]{0,30}\b(?:bfs|breadth[- ]first)\b/i.test(value)) {
    if (!selectedComputedAlgorithm(algorithmSummary, "bfs")) {
      return "BFS has not been computed for the current graph yet. Run BFS in the Algorithms panel first; I will not invent a traversal result.";
    }
    const reached = Number(algorithmSummary.result.reached) || 0;
    const total = Number(algorithmSummary.result.total) || 0;
    return `The current BFS result reached ${reached}${total ? ` of ${total}` : ""} ${plural(reached, "vertex", "vertices")}.`;
  }

  if (/\b(?:dfs|depth[- ]first search)\b[\s\S]{0,40}\b(?:result|reached|visit(?:ed)?|order)\b|\b(?:how many|which)\b[\s\S]{0,30}\b(?:dfs|depth[- ]first)\b/i.test(value)) {
    if (!selectedComputedAlgorithm(algorithmSummary, "dfs")) {
      return "DFS has not been computed for the current graph yet. Run DFS in the Algorithms panel first; I will not invent a traversal result.";
    }
    const reached = Number(algorithmSummary.result.reached) || 0;
    const total = Number(algorithmSummary.result.total) || 0;
    return `The current DFS result reached ${reached}${total ? ` of ${total}` : ""} ${plural(reached, "vertex", "vertices")}.`;
  }

  if (/\bshortest path\b[\s\S]{0,45}\b(?:distance|result|path|reachable|reachability)\b|\b(?:what|how long|how many hops?)\b[\s\S]{0,35}\bshortest path\b/i.test(value)) {
    if (!selectedComputedAlgorithm(algorithmSummary, "shortest_path")) {
      return "Shortest Path has not been computed for the current graph yet. Run Shortest Path in the Algorithms panel first; I will not infer a path and present it as an application result.";
    }
    const result = algorithmSummary.result;
    if (result.reachable === false) return "The current Shortest Path result reports that the selected target is unreachable.";
    const distance = result.distance == null ? "unknown" : result.distance;
    const hops = result.hopCount == null ? "unknown" : result.hopCount;
    return `The current Shortest Path result is reachable with distance ${distance} and ${hops} ${plural(hops, "hop")}.`;
  }

  if (/\b(?:k[- ]?core|degeneracy)\b[\s\S]{0,40}\b(?:result|value|core|shell|degeneracy)\b|\bwhat(?:'s| is)\b[\s\S]{0,20}\bdegeneracy\b/i.test(value)) {
    if (!selectedComputedAlgorithm(algorithmSummary, "k_core")) {
      if (algorithmSummary?.selectedId === "k_core" && algorithmSummary.status === "over_budget") return "K-core did not compute a result: its resource limit was exceeded. Degeneracy is unavailable. Narrow the graph before running it again.";
      if (algorithmSummary?.selectedId === "k_core" && algorithmSummary.status === "error") return "K-core failed to compute a result. Degeneracy is unavailable. Check the Algorithms panel error before retrying.";
      if (algorithmSummary?.selectedId === "k_core" && algorithmSummary.status === "stale") return "The previous K-core result is stale for the current graph. Run K-core again; current degeneracy is unavailable.";
      return "K-core has not been computed for the current graph yet. Run K-core in the Algorithms panel first; I will not infer the degeneracy or shell structure.";
    }
    const degeneracy = algorithmSummary.result.degeneracy;
    return degeneracy == null
      ? "The current K-core result is available, but it does not report a finite degeneracy value."
      : `The current K-core result reports degeneracy ${degeneracy}.`;
  }

  if (/\bdegree distribution\b[\s\S]{0,40}\b(?:result|minimum|maximum|average|degree)\b|\b(?:min|max|average) degree\b/i.test(value)) {
    if (!selectedComputedAlgorithm(algorithmSummary, "degree_distribution")) {
      return "Degree Distribution has not been computed in the Algorithms panel for the current graph yet. I will not present derived statistics as that algorithm's stored result.";
    }
    const result = algorithmSummary.result;
    return `The current Degree Distribution result has minimum degree ${result.minDegree ?? "unknown"}, maximum degree ${result.maxDegree ?? "unknown"}, and average degree ${result.averageDegree ?? "unknown"}.`;
  }

  return null;
}

/**
 * Deterministic explanation for the named Custom Parser execution control.
 * This intentionally does not depend on an active upload batch.
 */
export function composeReadOnlyWorkflowExplanation(query = "") {
  const value = String(query ?? "");
  const mentionsRunCustomParser = /\b(?:run|execute|test)\s+(?:the\s+|my\s+)?custom\s+parser\b/i.test(value)
    || /\bcustom\s+parser\b[\s\S]{0,35}\b(?:run|execute|execution)\b/i.test(value);
  const asksWhatItDoes = /\b(?:explain|what does|what happens|what is|how does|tell me about|describe)\b/i.test(value);
  if (!mentionsRunCustomParser || !asksWhatItDoes) return null;
  return "Run custom parser executes the current Custom Parser code against the active parser input files and produces a validated preview result. Running the parser does not apply that preview to the committed graph. Parser execution keeps its separate confirmation boundary, and applying a validated parser result to the graph is a separate confirmed action. Nothing was run from this explanation.";
}

function parseHypotheticalDeletedHyperedgeId(query = "") {
  const value = String(query ?? "");
  if (!/\b(?:what (?:would|will) happen|what if|suppose|if i|if we|hypothetical(?:ly)?)\b/i.test(value)) return null;
  const match = value.match(/\b(?:delete|remove)\s+(?:the\s+)?(?:hyperedge\s+)?["']?([^\s"'?,.;]+)["']?/i);
  return match ? cleanId(match[1]) : null;
}

/**
 * Give an exact, read-only count preview for an explicitly referenced existing
 * hyperedge without staging a mutation.  Only that one hyperedge's membership
 * is surfaced; the full graph body is never placed in model context.
 */
export function composeHypotheticalHyperedgeDeletion(query = "", graphHyperedges = []) {
  const id = parseHypotheticalDeletedHyperedgeId(query);
  if (!id || !Array.isArray(graphHyperedges) || !graphHyperedges.length) return null;
  const target = graphHyperedges.find(edge => cleanId(edge?.id) === id);
  if (!target) return `Hyperedge "${id}" is not present in the current graph. Nothing has changed.`;

  const targetVertices = Array.isArray(target.vertices) ? target.vertices.map(cleanId).filter(Boolean) : [];
  const remainingVertices = new Set();
  for (const edge of graphHyperedges) {
    if (edge === target) continue;
    for (const vertex of edge?.vertices ?? []) remainingVertices.add(cleanId(vertex));
  }
  const removedVertices = [...new Set(targetVertices)].filter(vertex => !remainingVertices.has(vertex));
  const vertexPreview = targetVertices.slice(0, MAX_VERTEX_PREVIEW);
  const omitted = Math.max(0, targetVertices.length - vertexPreview.length);
  const membership = vertexPreview.length
    ? ` It currently contains ${vertexPreview.join(", ")}${omitted ? `, and ${omitted} more` : ""}.`
    : "";
  return `If hyperedge "${id}" were deleted, the count preview would be 1 operation; -1 hyperedge, -${removedVertices.length} ${plural(removedVertices.length, "vertex", "vertices")}, and -${targetVertices.length} ${plural(targetVertices.length, "incidence")}.${membership} This is hypothetical only: nothing has changed, and an actual deletion would still require the normal confirmation before commit.`;
}
