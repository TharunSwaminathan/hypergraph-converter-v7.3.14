import { createGraphState } from "../../src/graph/graphState.js";
import { historyCompletionRecord } from "../../src/persistence/analysisHistorySchema.js";
import { ALGORITHM_REGISTRY } from "../../src/algorithms/registry.js";
export const historyGraph = () => createGraphState([{ id: "h0", vertices: ["A", "B"] }, { id: "h1", vertices: ["B", "C"] }]);
export async function cpuRecord(projectId, options = {}) {
  const graph = options.graph ?? historyGraph(), algorithm = options.algorithm ?? "bfs", parameters = { startVertex: ["bfs", "dfs", "shortest_path"].includes(algorithm) ? "A" : null, targetVertex: algorithm === "shortest_path" ? "C" : null };
  return historyCompletionRecord({ projectId, operationId: options.operationId ?? crypto.randomUUID(), createdAt: "2026-11-01T00:00:00.000Z", completedAt: options.completedAt ?? "2026-11-01T00:00:01.000Z", graph, hyperedges: graph.hyperedges, workspacePublicationRevision: 2, algorithm, parameters, result: ALGORITHM_REGISTRY.find(x => x.id === algorithm).run(graph.hyperedges, parameters), ...options });
}
