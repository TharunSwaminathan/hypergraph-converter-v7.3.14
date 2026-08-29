import { buildIncidenceIndex } from "../graph/incidenceIndex.js";
import { normalizeGraphIdentifier } from "../utils/graphIdentifiers.js";

export const FORCE_CONSTANTS = Object.freeze({
  exactRepulsionMaxVertices: 700,
  approximateRepulsionSamplesPerVertex: 24,
  repulsionStrength: 4_000,
  topologyAttractionStrength: 0.032,
  centeringStrength: 0.005,
  velocityDamping: 0.75,
  alphaDecay: 0.985,
  settledAlpha: 0.002,
  nodeMargin: 24,
});

/** Build the Preview topology from the Stage 3 incidence index in O(H + V + I). */
export function buildPreviewTopology(hyperedges = []) {
  const canonical = hyperedges.map((hyperedge, hyperedgeIndex) => ({
    ...hyperedge,
    id: normalizeGraphIdentifier(hyperedge.id, { path: `hyperedges[${hyperedgeIndex}].id` }),
    vertices: (hyperedge.vertices ?? []).map((vertex, vertexIndex) => normalizeGraphIdentifier(vertex, {
      path: `hyperedges[${hyperedgeIndex}].vertices[${vertexIndex}]`,
    })),
  }));
  const index = buildIncidenceIndex(canonical);
  return Object.freeze({
    index,
    vertices: index.vertices,
    hyperedges: Object.freeze(index.hyperedges.map(id => Object.freeze({
      id,
      members: Object.freeze([...index.hyperedgeToVertices.get(id)]),
    }))),
    counts: index.counts,
    attractionRelationships: index.counts.incidences,
  });
}

export function chooseForceStrategy(vertexCount) {
  return Object.freeze({
    forceMode: vertexCount <= FORCE_CONSTANTS.exactRepulsionMaxVertices ? "exact" : "approximate",
    repulsionMode: vertexCount <= FORCE_CONSTANTS.exactRepulsionMaxVertices ? "exact_pairwise" : "deterministic_sampled",
    topologyMode: "incidence_centroid",
    repulsionSamplesPerVertex: vertexCount <= FORCE_CONSTANTS.exactRepulsionMaxVertices
      ? Math.max(0, vertexCount - 1)
      : Math.min(FORCE_CONSTANTS.approximateRepulsionSamplesPerVertex, Math.max(0, vertexCount - 1)),
  });
}

export function createInitialNodePositions(vertexIds, width, height, layout = "force") {
  const nodes = new Map();
  const count = vertexIds.length;
  if (!count) return nodes;
  if (layout === "grid") {
    const columns = Math.max(2, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / columns);
    const cellWidth = Math.max(1, width - 80) / columns;
    const cellHeight = Math.max(1, height - 80) / rows;
    vertexIds.forEach((id, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      nodes.set(id, node(id, 40 + cellWidth * column + cellWidth / 2, 40 + cellHeight * row + cellHeight / 2));
    });
    return nodes;
  }

  vertexIds.forEach((id, index) => {
    const angle = (index / count) * 2 * Math.PI - (layout === "circular" ? Math.PI / 2 : 0);
    const radius = Math.max(1, Math.min(width, height) * (layout === "circular" ? 0.44 : 0.42));
    const jitter = layout === "force" ? deterministicJitter(id) : { x: 0, y: 0 };
    nodes.set(id, node(
      id,
      width / 2 + radius * Math.cos(angle) + jitter.x,
      height / 2 + radius * Math.sin(angle) + jitter.y,
    ));
  });
  return nodes;
}

/** One deterministic force tick. Attraction is O(I); large-graph repulsion is O(V * fixed samples). */
export function stepHypergraphForce({ nodes, topology, width, height, alpha, dragId = null }) {
  const entries = [...nodes.values()];
  const strategy = chooseForceStrategy(entries.length);
  if (!(alpha > FORCE_CONSTANTS.settledAlpha) || !entries.length) {
    return { alpha: 0, active: false, strategy, repulsionWork: 0, attractionWork: 0 };
  }

  const repulsionWork = strategy.forceMode === "exact"
    ? applyExactRepulsion(entries, alpha)
    : applyApproximateRepulsion(entries, alpha, strategy.repulsionSamplesPerVertex);
  let attractionWork = 0;
  for (const hyperedge of topology.hyperedges) {
    if (hyperedge.members.length <= 1) continue;
    const members = hyperedge.members.map(id => nodes.get(id)).filter(Boolean);
    if (members.length <= 1) continue;
    const centroidX = members.reduce((sum, current) => sum + current.x, 0) / members.length;
    const centroidY = members.reduce((sum, current) => sum + current.y, 0) / members.length;
    for (const current of members) {
      current.vx += (centroidX - current.x) * FORCE_CONSTANTS.topologyAttractionStrength * alpha;
      current.vy += (centroidY - current.y) * FORCE_CONSTANTS.topologyAttractionStrength * alpha;
      attractionWork += 1;
    }
  }

  for (const current of entries) {
    if (dragId !== null && current.id === dragId) continue;
    current.vx += (width / 2 - current.x) * FORCE_CONSTANTS.centeringStrength * alpha;
    current.vy += (height / 2 - current.y) * FORCE_CONSTANTS.centeringStrength * alpha;
    current.vx *= FORCE_CONSTANTS.velocityDamping;
    current.vy *= FORCE_CONSTANTS.velocityDamping;
    current.x = clamp(current.x + current.vx, FORCE_CONSTANTS.nodeMargin, Math.max(FORCE_CONSTANTS.nodeMargin, width - FORCE_CONSTANTS.nodeMargin));
    current.y = clamp(current.y + current.vy, FORCE_CONSTANTS.nodeMargin, Math.max(FORCE_CONSTANTS.nodeMargin, height - FORCE_CONSTANTS.nodeMargin));
    if (!Number.isFinite(current.x) || !Number.isFinite(current.y) || !Number.isFinite(current.vx) || !Number.isFinite(current.vy)) {
      throw new Error(`Preview Force produced a non-finite coordinate for ${JSON.stringify(current.id)}.`);
    }
  }
  const nextAlpha = alpha * FORCE_CONSTANTS.alphaDecay;
  return { alpha: nextAlpha, active: nextAlpha > FORCE_CONSTANTS.settledAlpha, strategy, repulsionWork, attractionWork };
}

export function reheatForceState(state) {
  if (!state) return false;
  state.alpha = 1;
  return true;
}

function applyExactRepulsion(nodes, alpha) {
  let work = 0;
  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      applyRepulsion(nodes[left], nodes[right], alpha, left, right, true);
      work += 1;
    }
  }
  return work;
}

function applyApproximateRepulsion(nodes, alpha, sampleCount) {
  if (nodes.length <= 1 || sampleCount <= 0) return 0;
  const stride = Math.max(1, Math.floor((nodes.length - 1) / sampleCount));
  let work = 0;
  for (let left = 0; left < nodes.length; left += 1) {
    const seen = new Set();
    for (let sample = 1; sample <= sampleCount; sample += 1) {
      const right = (left + sample * stride) % nodes.length;
      if (right === left || seen.has(right)) continue;
      seen.add(right);
      applyRepulsion(nodes[left], nodes[right], alpha, left, right, false);
      work += 1;
    }
  }
  return work;
}

function applyRepulsion(left, right, alpha, leftIndex, rightIndex, symmetric) {
  let dx = right.x - left.x;
  let dy = right.y - left.y;
  let distanceSquared = dx * dx + dy * dy;
  if (distanceSquared < 1e-8) {
    const angle = deterministicPairAngle(leftIndex, rightIndex);
    dx = Math.cos(angle);
    dy = Math.sin(angle);
    distanceSquared = 1;
  }
  const distance = Math.sqrt(distanceSquared);
  const force = FORCE_CONSTANTS.repulsionStrength / Math.max(1, distanceSquared) * alpha;
  left.vx -= force * dx / distance;
  left.vy -= force * dy / distance;
  if (symmetric) {
    right.vx += force * dx / distance;
    right.vy += force * dy / distance;
  }
}

function deterministicJitter(identifier) {
  let hash = 2166136261;
  for (const character of String(identifier)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const x = ((hash >>> 0) % 1_001) / 1_000 - 0.5;
  const y = (((hash >>> 10) % 1_001) / 1_000) - 0.5;
  return { x: x * 30, y: y * 30 };
}

function deterministicPairAngle(left, right) {
  return (((left + 1) * 2_654_435_761 + (right + 1) * 2_246_822_519) >>> 0) / 0x1_0000_0000 * 2 * Math.PI;
}

function node(id, x, y) {
  return { id, x, y, vx: 0, vy: 0 };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
