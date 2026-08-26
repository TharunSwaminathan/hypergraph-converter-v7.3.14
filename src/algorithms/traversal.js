// A single generic traversal used by both BFS and DFS. The only difference
// between breadth-first and depth-first search is whether the next vertex
// comes off the front (queue) or the back (stack) of the frontier — so that
// is the one parameter this function exposes. Nothing else should implement
// its own walk of the adjacency map; extend this instead.

/**
 * @param {Map<string, Set<string>>} adjacency
 * @param {string} startVertex
 * @param {"bfs"|"dfs"} mode
 * @returns {{
 *   visitOrder: string[],
 *   edgesUsed: Array<{from: string, to: string}>,
 *   distances: Map<string, number>,
 *   steps: Array<{visited: string[], frontier: string[], current: string}>,
 * }}
 */
export function traverse(adjacency, startVertex, mode = "bfs") {
  const start = String(startVertex);
  if (!adjacency.has(start)) {
    return { visitOrder: [], edgesUsed: [], distances: new Map(), steps: [] };
  }
  return mode === "dfs" ? traverseDfs(adjacency, start) : traverseBfs(adjacency, start);
}

// BFS: mark a vertex visited the moment it is *enqueued*, not when it's
// dequeued. This is the standard, correct way to run BFS — it guarantees
// each vertex is enqueued exactly once and that `distances` holds true
// shortest-path (fewest-edges) distances from `start`.
function traverseBfs(adjacency, start) {
  const visitOrder = [];
  const edgesUsed = [];
  const distances = new Map([[start, 0]]);
  const steps = [];
  const visited = new Set([start]);
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift();
    visitOrder.push(current);

    const neighbors = [...(adjacency.get(current) ?? [])].sort();
    const newlyDiscovered = [];
    for (const neighbor of neighbors) {
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

// DFS: mark a vertex visited only when it's actually *popped* and
// processed, not when it's pushed. Marking on push (the same trick that
// makes BFS correct) is the classic DFS bug — it lets a node's siblings
// block each other from being expanded before either is actually visited,
// so the walk never goes as deep as it should and no longer matches the
// recursive DFS order or produces a real DFS tree.
//
// Because vertices are only marked on pop, the same vertex can legitimately
// sit on the stack more than once (pushed by more than one still-unvisited
// parent); the `visited.has(current)` check below discards the stale
// duplicates once the first one has been processed.
function traverseDfs(adjacency, start) {
  const visitOrder = [];
  const edgesUsed = [];
  const distances = new Map();
  const steps = [];
  const visited = new Set();
  // Each stack entry remembers which vertex discovered it, so the eventual
  // edgesUsed/distances reflect the true DFS tree rather than the first
  // hyperedge co-membership found.
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
    // Push in reverse sorted order so the stack (LIFO) pops neighbors back
    // out in ascending order — matching the usual "visit the first sorted
    // neighbor first" convention used by BFS and by recursive DFS.
    for (let i = neighbors.length - 1; i >= 0; i--) {
      const neighbor = neighbors[i];
      if (visited.has(neighbor)) continue;
      stack.push({ vertex: neighbor, parent: current });
      newlyDiscovered.unshift(neighbor);
    }

    steps.push({ visited: [...visitOrder], frontier: stack.map(entry => entry.vertex), current, newlyDiscovered });
  }

  return { visitOrder, edgesUsed, distances, steps };
}
