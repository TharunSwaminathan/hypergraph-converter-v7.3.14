import { runBFS } from "./bfs.js";
import { runDFS } from "./dfs.js";
import { runConnectedComponents } from "./connectedComponents.js";
import { runShortestPath } from "./shortestPath.js";
import { runDegreeDistribution } from "./degreeDistribution.js";
import { runKCore } from "./kCore.js";

// Each entry is everything the AlgorithmsPanel needs to render a selector
// pill, ask for the right inputs, run the algorithm, and show a result.
// To add a new algorithm later (Centrality, Line Graph Construction,
// Hypergraph Dual, ...), append an entry here — the panel adapts
// automatically.
export const ALGORITHM_REGISTRY = [
  {
    id: "connected_components",
    label: "Connected Components",
    sub: "group vertices reachable from each other",
    needsStartVertex: false,
    supportsAnimation: false,
    run: (hyperedges) => runConnectedComponents(hyperedges),
  },
  {
    id: "bfs",
    label: "Breadth-First Search",
    sub: "explore level by level from a start vertex",
    needsStartVertex: true,
    supportsAnimation: true,
    run: (hyperedges, { startVertex }) => runBFS(hyperedges, startVertex),
  },
  {
    id: "dfs",
    label: "Depth-First Search",
    sub: "explore as deep as possible before backtracking",
    needsStartVertex: true,
    supportsAnimation: true,
    run: (hyperedges, { startVertex }) => runDFS(hyperedges, startVertex),
  },
  {
    id: "shortest_path",
    label: "Shortest Path (Dijkstra)",
    sub: "cheapest route between two vertices, by hyperedge weight",
    needsStartVertex: true,
    needsTargetVertex: true,
    supportsAnimation: true,
    run: (hyperedges, { startVertex, targetVertex }) => runShortestPath(hyperedges, { startVertex, targetVertex }),
  },
  {
    id: "degree_distribution",
    label: "Degree Distribution",
    sub: "how many hyperedges each vertex belongs to",
    needsStartVertex: false,
    supportsAnimation: false,
    run: (hyperedges) => runDegreeDistribution(hyperedges),
  },
  {
    id: "k_core",
    label: "K-Core Decomposition",
    sub: "peel vertices and report exact coreness/k-shell groups",
    needsStartVertex: false,
    supportsAnimation: false,
    run: (hyperedges) => runKCore(hyperedges),
  },
];

export function getAlgorithm(id) {
  return ALGORITHM_REGISTRY.find(a => a.id === id) ?? null;
}
