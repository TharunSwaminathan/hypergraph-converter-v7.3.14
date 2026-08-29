export function computeHyperedgeBounds(memberNodes, padding = 28) {
  if (!memberNodes.length) return null;
  const cx = memberNodes.reduce((sum, point) => sum + point.x, 0) / memberNodes.length;
  const cy = memberNodes.reduce((sum, point) => sum + point.y, 0) / memberNodes.length;
  const rx = Math.max(padding, max(memberNodes.map(point => Math.abs(point.x - cx))) + padding);
  const ry = Math.max(padding, max(memberNodes.map(point => Math.abs(point.y - cy))) + padding);
  return { cx, cy, rx, ry };
}

export function hitNode(nodes, x, y, { zoom = 1, radius = 18 } = {}) {
  let best = null;
  let bestDistance = Infinity;
  for (const current of nodes.values()) {
    const distance = Math.hypot(current.x - x, current.y - y);
    if (distance <= radius / Math.max(zoom, 0.0001) && distance < bestDistance) {
      best = current;
      bestDistance = distance;
    }
  }
  return best;
}

/** Nearest perimeter wins; equal distances prefer the smaller ring, then canonical display order. */
export function hitHyperedgeRing(hyperedges, nodes, x, y, { zoom = 1, tolerance = 8 } = {}) {
  const worldTolerance = tolerance / Math.max(zoom, 0.0001);
  const candidates = [];
  hyperedges.forEach((hyperedge, index) => {
    const points = hyperedge.vertices.map(vertex => nodes.get(String(vertex))).filter(Boolean);
    const bounds = computeHyperedgeBounds(points);
    if (!bounds) return;
    const normalizedRadius = Math.hypot((x - bounds.cx) / bounds.rx, (y - bounds.cy) / bounds.ry);
    const perimeterDistance = Math.abs(normalizedRadius - 1) * Math.min(bounds.rx, bounds.ry);
    if (perimeterDistance <= worldTolerance) {
      candidates.push({ hyperedge, bounds, perimeterDistance, size: bounds.rx + bounds.ry, index });
    }
  });
  candidates.sort((left, right) => left.perimeterDistance - right.perimeterDistance
    || left.size - right.size
    || left.index - right.index);
  return candidates[0] ?? null;
}

function max(values) {
  let result = -Infinity;
  for (const value of values) if (value > result) result = value;
  return result;
}
