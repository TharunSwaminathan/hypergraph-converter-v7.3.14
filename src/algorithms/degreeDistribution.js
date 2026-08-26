import { getAllVertices } from "./graphModel.js";
import { arrayMin, arrayMax } from "../utils/numeric.js";

/**
 * Vertex degree here means "how many hyperedges contain this vertex" (the
 * incidence degree) — the same definition already used for the "Degree"
 * column in the v2h mapping and the existing Statistics tab, kept
 * consistent rather than switching to 2-section neighbor-count, which
 * would silently mean something different under the same name.
 *
 * @param {Array<{id: string, vertices: Array<string|number>}>} hyperedges
 */
export function runDegreeDistribution(hyperedges) {
  const vertices = getAllVertices(hyperedges ?? []);
  const degreeByVertex = new Map(vertices.map(v => [v, 0]));

  for (const h of hyperedges ?? []) {
    for (const v of h.vertices ?? []) {
      const key = String(v);
      degreeByVertex.set(key, (degreeByVertex.get(key) ?? 0) + 1);
    }
  }

  const entries = [...degreeByVertex.entries()]
    .map(([vertex, degree]) => ({ vertex, degree }))
    .sort((a, b) => b.degree - a.degree || (a.vertex < b.vertex ? -1 : a.vertex > b.vertex ? 1 : 0));

  const degrees = entries.map(e => e.degree);
  const total = degrees.reduce((sum, d) => sum + d, 0);

  const histogramMap = new Map();
  degrees.forEach(d => histogramMap.set(d, (histogramMap.get(d) ?? 0) + 1));
  const histogram = [...histogramMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([degree, count]) => ({ degree, count }));

  return {
    algorithm: "degree_distribution",
    entries, // per-vertex degree, highest first
    degrees, // raw degree values, for a histogram chart
    histogram, // { degree, count } buckets, ascending by degree
    min: degrees.length ? arrayMin(degrees) : 0,
    max: degrees.length ? arrayMax(degrees) : 0,
    avg: degrees.length ? +(total / degrees.length).toFixed(2) : 0,
    totalVertices: degrees.length,
  };
}
