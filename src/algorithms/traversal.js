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
  const neighborsFor = vertex => [...(adjacency.get(vertex) ?? [])].sort();
  return mode === "dfs" ? traverseDfs(neighborsFor, start) : traverseBfs(neighborsFor, start);
}

// The pre-Stage-4 DFS could only run while the projection preflight stayed at
// or below this candidate-pair boundary. Above it there is no successful
// legacy trace contract to retain, so the incidence traversal uses an
// equivalent duplicate-free pending stack and keeps one complete step per
// visited vertex instead of amplifying stale stack entries quadratically.
const LEGACY_DFS_TRACE_CANDIDATE_LIMIT = 200_000;

/**
 * Creates a per-run incidence traversal facade. Hyperedge member lists are
 * sorted at most once, the incidence index is never rebuilt here, and no V2V
 * edge collection or projected adjacency is materialized.
 */
export function createIncidenceTraversal(index) {
  const neighborsFor = createIncidenceNeighborProvider(index);
  const useCompactDfsTrace = exceedsCandidatePairs(index, LEGACY_DFS_TRACE_CANDIDATE_LIMIT);
  return Object.freeze({
    traverse(startVertex, mode = "bfs") {
      const start = String(startVertex);
      if (!index.vertexToHyperedges.has(start)) {
        return { visitOrder: [], edgesUsed: [], distances: new Map(), steps: [] };
      }
      if (mode === "dfs") {
        return useCompactDfsTrace
          ? traverseDfsWithUniquePending(neighborsFor, start)
          : traverseDfs(neighborsFor, start);
      }
      return traverseBfs(neighborsFor, start);
    },
    collectComponent(startVertex, visited) {
      const start = String(startVertex);
      if (!index.vertexToHyperedges.has(start) || visited.has(start)) return [];
      const visitOrder = [];
      const queue = [start];
      visited.add(start);
      for (let offset = 0; offset < queue.length; offset += 1) {
        const current = queue[offset];
        visitOrder.push(current);
        for (const neighbor of neighborsFor(current)) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
      return visitOrder;
    },
  });
}

// BFS: mark a vertex visited the moment it is *enqueued*, not when it's
// dequeued. This is the standard, correct way to run BFS — it guarantees
// each vertex is enqueued exactly once and that `distances` holds true
// shortest-path (fewest-edges) distances from `start`.
function traverseBfs(neighborsFor, start) {
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
    for (const neighbor of neighborsFor(current)) {
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
function traverseDfs(neighborsFor, start) {
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

    const neighbors = neighborsFor(current);
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

function createIncidenceNeighborProvider(index) {
  const sortedMembers = new Map();
  const membersFor = hyperedgeId => {
    if (!sortedMembers.has(hyperedgeId)) {
      sortedMembers.set(hyperedgeId, [...(index.hyperedgeToVertices.get(hyperedgeId) ?? [])].sort());
    }
    return sortedMembers.get(hyperedgeId);
  };

  return vertex => {
    const incidentHyperedges = index.vertexToHyperedges.get(vertex);
    if (!incidentHyperedges?.size) return [];
    if (incidentHyperedges.size === 1) {
      const [hyperedgeId] = incidentHyperedges;
      return membersFor(hyperedgeId).filter(member => member !== vertex);
    }
    const neighbors = new Set();
    for (const hyperedgeId of incidentHyperedges) {
      for (const member of membersFor(hyperedgeId)) if (member !== vertex) neighbors.add(member);
    }
    return [...neighbors].sort();
  };
}

function exceedsCandidatePairs(index, limit) {
  let candidatePairs = 0;
  for (const members of index.hyperedgeToVertices.values()) {
    candidatePairs += members.size > 1 ? members.size * (members.size - 1) / 2 : 0;
    if (candidatePairs > limit) return true;
  }
  return false;
}

// Above the legacy success boundary, retain exact recursive-style DFS visit,
// tree-edge, distance, current, and newlyDiscovered semantics while removing
// stale duplicate pending entries. The linked pending set supports O(1)
// reprioritization and keeps the exposed frontier complete and deterministic.
function traverseDfsWithUniquePending(neighborsFor, start) {
  const visitOrder = [];
  const edgesUsed = [];
  const distances = new Map();
  const steps = [];
  const visited = new Set();
  const pending = createLinkedPendingStack();
  pending.push(start, null);

  while (pending.size > 0) {
    const { vertex: current, parent } = pending.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    visitOrder.push(current);
    if (parent !== null) {
      edgesUsed.push({ from: parent, to: current });
      distances.set(current, distances.get(parent) + 1);
    } else {
      distances.set(current, 0);
    }

    const neighbors = neighborsFor(current);
    const newlyDiscovered = neighbors.filter(neighbor => !visited.has(neighbor));
    for (let index = newlyDiscovered.length - 1; index >= 0; index -= 1) {
      pending.push(newlyDiscovered[index], current);
    }
    steps.push({ visited: [...visitOrder], frontier: pending.values(), current, newlyDiscovered });
  }

  return { visitOrder, edgesUsed, distances, steps };
}

function createLinkedPendingStack() {
  const nodes = new Map();
  let first = null;
  let last = null;
  return {
    get size() { return nodes.size; },
    push(vertex, parent) {
      const existing = nodes.get(vertex);
      if (existing) remove(existing);
      const node = { vertex, parent, previous: last, next: null };
      if (last) last.next = node;
      else first = node;
      last = node;
      nodes.set(vertex, node);
    },
    pop() {
      if (!last) return null;
      const node = last;
      remove(node);
      return { vertex: node.vertex, parent: node.parent };
    },
    values() {
      const values = [];
      for (let node = first; node; node = node.next) values.push(node.vertex);
      return values;
    },
  };

  function remove(node) {
    if (node.previous) node.previous.next = node.next;
    else first = node.next;
    if (node.next) node.next.previous = node.previous;
    else last = node.previous;
    nodes.delete(node.vertex);
  }
}
