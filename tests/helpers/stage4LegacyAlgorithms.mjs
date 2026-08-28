import { PALETTE } from "../../src/theme.js";

export function legacyRunBFS(hyperedges, startVertex) {
  const adjacency = legacyBuildAdjacencyList(hyperedges);
  const result = legacyTraverse(adjacency, startVertex, "bfs");
  return {
    algorithm: "bfs",
    startVertex: String(startVertex),
    visitOrder: result.visitOrder,
    edgesUsed: result.edgesUsed,
    distances: result.distances,
    steps: result.steps,
    reached: result.visitOrder.length,
    total: adjacency.size,
  };
}

export function legacyRunDFS(hyperedges, startVertex) {
  const adjacency = legacyBuildAdjacencyList(hyperedges);
  const result = legacyTraverse(adjacency, startVertex, "dfs");
  return {
    algorithm: "dfs",
    startVertex: String(startVertex),
    visitOrder: result.visitOrder,
    edgesUsed: result.edgesUsed,
    distances: result.distances,
    steps: result.steps,
    reached: result.visitOrder.length,
    total: adjacency.size,
  };
}

export function legacyRunConnectedComponents(hyperedges) {
  const adjacency = legacyBuildAdjacencyList(hyperedges);
  const allVertices = legacyGetAllVertices(hyperedges);
  const visited = new Set();
  const components = [];
  const vertexToComponent = new Map();

  for (const vertex of allVertices) {
    if (visited.has(vertex)) continue;
    const { visitOrder } = legacyTraverse(adjacency, vertex, "bfs");
    visitOrder.forEach(value => visited.add(value));
    const id = components.length;
    visitOrder.forEach(value => vertexToComponent.set(value, id));
    components.push({
      id,
      vertices: visitOrder,
      size: visitOrder.length,
      color: PALETTE[id % PALETTE.length],
    });
  }

  components.sort((left, right) => right.size - left.size);
  components.forEach((component, id) => {
    component.id = id;
    component.vertices.forEach(vertex => vertexToComponent.set(vertex, id));
    component.color = PALETTE[id % PALETTE.length];
  });

  return {
    algorithm: "connected_components",
    components,
    vertexToComponent,
    count: components.length,
  };
}

export function legacyBuildAdjacencyList(hyperedges) {
  const adjacency = new Map();
  const ensure = value => {
    const key = String(value);
    if (!adjacency.has(key)) adjacency.set(key, new Set());
    return adjacency.get(key);
  };
  for (const hyperedge of hyperedges ?? []) {
    const vertices = [...new Set((hyperedge?.vertices ?? []).map(String))];
    vertices.forEach(ensure);
    for (let left = 0; left < vertices.length; left += 1) {
      for (let right = left + 1; right < vertices.length; right += 1) {
        ensure(vertices[left]).add(vertices[right]);
        ensure(vertices[right]).add(vertices[left]);
      }
    }
  }
  return adjacency;
}

export function serializeAlgorithmResult(result) {
  return {
    ...result,
    distances: result.distances instanceof Map ? [...result.distances] : result.distances,
    vertexToComponent: result.vertexToComponent instanceof Map ? [...result.vertexToComponent] : result.vertexToComponent,
  };
}

function legacyGetAllVertices(hyperedges) {
  const seen = new Set();
  const vertices = [];
  for (const hyperedge of hyperedges ?? []) {
    for (const value of hyperedge?.vertices ?? []) {
      const vertex = String(value);
      if (seen.has(vertex)) continue;
      seen.add(vertex);
      vertices.push(vertex);
    }
  }
  return vertices;
}

function legacyTraverse(adjacency, startVertex, mode) {
  const start = String(startVertex);
  if (!adjacency.has(start)) return { visitOrder: [], edgesUsed: [], distances: new Map(), steps: [] };
  return mode === "dfs" ? legacyDfs(adjacency, start) : legacyBfs(adjacency, start);
}

function legacyBfs(adjacency, start) {
  const visitOrder = [];
  const edgesUsed = [];
  const distances = new Map([[start, 0]]);
  const steps = [];
  const visited = new Set([start]);
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift();
    visitOrder.push(current);
    const newlyDiscovered = [];
    for (const neighbor of [...(adjacency.get(current) ?? [])].sort()) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      distances.set(neighbor, distances.get(current) + 1);
      edgesUsed.push({ from: current, to: neighbor });
      queue.push(neighbor);
      newlyDiscovered.push(neighbor);
    }
    steps.push({ visited: [...visitOrder], frontier: [...queue], current, newlyDiscovered });
  }

  return { visitOrder, edgesUsed, distances, steps };
}

function legacyDfs(adjacency, start) {
  const visitOrder = [];
  const edgesUsed = [];
  const distances = new Map();
  const steps = [];
  const visited = new Set();
  const stack = [{ vertex: start, parent: null }];

  while (stack.length > 0) {
    const { vertex: current, parent } = stack.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    visitOrder.push(current);
    if (parent !== null) {
      edgesUsed.push({ from: parent, to: current });
      distances.set(current, distances.get(parent) + 1);
    } else {
      distances.set(current, 0);
    }

    const neighbors = [...(adjacency.get(current) ?? [])].sort();
    const newlyDiscovered = [];
    for (let index = neighbors.length - 1; index >= 0; index -= 1) {
      const neighbor = neighbors[index];
      if (visited.has(neighbor)) continue;
      stack.push({ vertex: neighbor, parent: current });
      newlyDiscovered.unshift(neighbor);
    }
    steps.push({ visited: [...visitOrder], frontier: stack.map(entry => entry.vertex), current, newlyDiscovered });
  }

  return { visitOrder, edgesUsed, distances, steps };
}
