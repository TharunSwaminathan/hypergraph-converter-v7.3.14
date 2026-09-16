import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalOrdinaryGraphToCsr } from "../../src/candy/adapters/csrAdapter.js";
import { isCandyContractError } from "../../src/candy/contracts/errorClasses.js";
import { SSSP_FIXTURES } from "./fixtures/sssp-fixtures.mjs";

const repoRoot = resolve(new URL("../../", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/, "$1:"));
const cudaDir = join(repoRoot, "candy-runtime", "native", "sssp-cuda");
const openmpDir = join(repoRoot, "candy-runtime", "native", "sssp-openmp");
const toWslPath = value => `/mnt/${value[0].toLowerCase()}${value.slice(2).replaceAll("\\", "/")}`;
const cudaBinary = `${toWslPath(cudaDir)}/build/candy-sssp-cuda`;
const openmpBinary = `${toWslPath(openmpDir)}/build/candy-sssp-openmp`;
const sanitizer = process.env.CANDY_CUDA_SANITIZER_TOOL ?? "";
const sanitizerBinary = process.env.CANDY_COMPUTE_SANITIZER ?? "/usr/local/cuda-13.4/bin/compute-sanitizer";

function sha(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dijkstra(graph, source) {
  const distances = Array(graph.length).fill(null);
  const visited = Array(graph.length).fill(false);
  distances[source] = 0;
  for (let pass = 0; pass < graph.length; pass += 1) {
    let vertex = -1;
    for (let candidate = 0; candidate < graph.length; candidate += 1) {
      if (!visited[candidate] && distances[candidate] != null && (vertex < 0 || distances[candidate] < distances[vertex] || (distances[candidate] === distances[vertex] && candidate < vertex))) vertex = candidate;
    }
    if (vertex < 0) break;
    visited[vertex] = true;
    for (const [target, weight] of graph[vertex]) {
      const next = distances[vertex] + weight;
      if (distances[target] == null || next < distances[target]) {
        distances[target] = next;
      }
    }
  }
  const parents = Array(graph.length).fill(-1);
  const reached = Array(graph.length).fill(false);
  const queue = [source];
  reached[source] = true;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const vertex = queue[cursor];
    for (const [target, weight] of graph[vertex]) {
      if (!reached[target] && distances[vertex] + weight === distances[target]) {
        reached[target] = true;
        parents[target] = vertex;
        queue.push(target);
      }
    }
  }
  for (let vertex = 0; vertex < graph.length; vertex += 1) assert.ok(distances[vertex] == null || reached[vertex], `oracle must construct a parent path for ${vertex}`);
  return { distances, parents };
}

function csrToGraph(csr) {
  return Array.from({ length: csr.vertexCount }, (_, source) => {
    const edges = [];
    for (let index = csr.rowOffsets[source]; index < csr.rowOffsets[source + 1]; index += 1) edges.push([csr.columnIndices[index], csr.weights[index]]);
    return edges;
  });
}

function applyUpdates(graph, updates, mapping) {
  const updated = graph.map(edges => new Map(edges));
  for (const deletion of updates.deletions) updated[mapping.toNative(deletion.source)].delete(mapping.toNative(deletion.target));
  for (const insertion of updates.insertions) updated[mapping.toNative(insertion.source)].set(mapping.toNative(insertion.target), insertion.weight);
  return updated.map(edges => [...edges.entries()].sort((a, b) => a[0] - b[0]));
}

function validateParents(graph, distances, parents, source) {
  assert.equal(parents.length, graph.length);
  assert.equal(parents[source], -1);
  for (let vertex = 0; vertex < graph.length; vertex += 1) {
    if (vertex === source) continue;
    if (distances[vertex] == null) {
      assert.equal(parents[vertex], -1, `unreachable ${vertex} must not have a parent`);
      continue;
    }
    const parent = parents[vertex];
    assert.ok(Number.isInteger(parent) && parent >= 0 && parent < graph.length, `parent for ${vertex} is in range`);
    const edge = graph[parent].find(([target]) => target === vertex);
    assert.ok(edge, `parent edge ${parent}->${vertex} exists`);
    assert.equal(distances[parent] + edge[1], distances[vertex], `parent edge for ${vertex} is tight`);
    const seen = new Set();
    let cursor = vertex;
    while (cursor !== source) {
      assert.ok(!seen.has(cursor), `parent path for ${vertex} is acyclic`);
      seen.add(cursor);
      cursor = parents[cursor];
      assert.ok(Number.isInteger(cursor) && cursor >= 0 && cursor < graph.length, `parent path for ${vertex} reaches source`);
    }
  }
  return true;
}

function vector(name, values, map = value => String(value)) {
  return `${name} ${values.length}${values.length ? ` ${values.map(map).join(" ")}` : ""}`;
}

function serialize({ csr, graphType = "OrdinaryGraph", graphId, graphVersion = 1, stateGraphVersion = graphVersion, source, prior, updates, cuda = false, device = 0 }) {
  const lines = [
    cuda ? "CANDY_SSSP_CUDA_REQUEST_V1" : "CANDY_SSSP_REQUEST_V1",
    ...(cuda ? ["backend LOCAL_CUDA"] : []),
    "mode COMPARE",
    `graph_type ${graphType}`,
    "projection_provenance_id -",
    `graph_id ${graphId}`,
    `graph_version ${graphVersion}`,
    `state_graph_id ${graphId}`,
    `state_graph_version ${stateGraphVersion}`,
    "state_version 1",
    `source ${source}`,
    cuda ? `cuda_device ${device}` : "threads 2",
    `vertex_count ${csr.vertexCount}`,
    `edge_count ${csr.edgeCount}`,
    vector("row_offsets", [...csr.rowOffsets]),
    vector("column_indices", [...csr.columnIndices]),
    vector("weights", [...csr.weights]),
    vector("prior_distances", prior.distances, value => value == null ? "INF" : String(value)),
    vector("prior_parents", prior.parents),
    `deletion_count ${updates.deletions.length}`,
    ...updates.deletions.map(edge => `d ${csr.mapping.toNative(edge.source)} ${csr.mapping.toNative(edge.target)}`),
    `insertion_count ${updates.insertions.length}`,
    ...updates.insertions.map(edge => `i ${csr.mapping.toNative(edge.source)} ${csr.mapping.toNative(edge.target)} ${edge.weight}`),
    "END",
  ];
  return `${lines.join("\n")}\n`;
}

function runBinary(binary, requestPath, useSanitizer = false) {
  const command = useSanitizer
    ? [sanitizerBinary, "--tool", sanitizer, "--error-exitcode", "86", binary, "--request", toWslPath(requestPath)]
    : [binary, "--request", toWslPath(requestPath)];
  const result = spawnSync("wsl.exe", command, { encoding: "utf8", timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
  let payload;
  try {
    const jsonLine = result.stdout.split(/\r?\n/).find(line => line.trim().startsWith("{"));
    payload = JSON.parse(jsonLine ?? result.stdout.trim());
  } catch (error) {
    throw new Error(`Native output was not JSON. status=${result.status} stdout=${result.stdout} stderr=${result.stderr}`, { cause: error });
  }
  if (useSanitizer) {
    const diagnostics = `${result.stdout}\n${result.stderr}`;
    assert.notEqual(result.status, 86, `compute-sanitizer ${sanitizer} found an error: ${diagnostics}`);
    const cleanSummary = sanitizer === "racecheck" ? /RACECHECK SUMMARY: 0 hazards displayed \(0 errors, 0 warnings\)/.test(diagnostics) : /ERROR SUMMARY: 0 errors/.test(diagnostics);
    assert.ok(cleanSummary || /terminated before first instrumented API call/.test(diagnostics), `compute-sanitizer ${sanitizer} summary: ${diagnostics}`);
  }
  return { ...result, payload };
}

const workspace = await mkdtemp(join(tmpdir(), "candy-cuda-qualification-"));
const parity = [];
let fixturePasses = 0;
let stressPasses = 0;
try {
  for (const fixture of SSSP_FIXTURES) {
    let csr;
    try {
      csr = canonicalOrdinaryGraphToCsr(fixture.graph);
    } catch (error) {
      if (!fixture.expectedError || !isCandyContractError(error, fixture.expectedError)) throw error;
      fixturePasses += 1;
      continue;
    }
    const originalGraph = csrToGraph(csr);
    const prior = dijkstra(originalGraph, csr.mapping.toNative(fixture.source));
    const updates = fixture.updates ?? { deletions: [], insertions: [] };
    const graphId = `cuda-${fixture.id}`;
    const cudaPath = join(workspace, `${fixture.id}-cuda.txt`);
    const openmpPath = join(workspace, `${fixture.id}-openmp.txt`);
    const stateGraphVersion = fixture.staleGraphVersion ? 0 : 1;
    await writeFile(cudaPath, serialize({ csr, graphId, stateGraphVersion, source: csr.mapping.toNative(fixture.source), prior, updates, cuda: true }), "utf8");
    await writeFile(openmpPath, serialize({ csr, graphId, stateGraphVersion, source: csr.mapping.toNative(fixture.source), prior, updates }), "utf8");
    const cuda = runBinary(cudaBinary, cudaPath, Boolean(sanitizer));
    const openmp = runBinary(openmpBinary, openmpPath);
    if (fixture.staleGraphVersion) {
      assert.notEqual(cuda.status, 0);
      assert.equal(cuda.payload.error?.classification, "STALE_GRAPH_VERSION");
      assert.notEqual(openmp.status, 0);
      assert.equal(openmp.payload.error?.classification, "STALE_GRAPH_VERSION");
      fixturePasses += 1;
      continue;
    }
    assert.equal(cuda.status, 0, `${fixture.id} CUDA: ${cuda.stderr || JSON.stringify(cuda.payload)}`);
    assert.equal(openmp.status, 0, `${fixture.id} OpenMP: ${openmp.stderr || JSON.stringify(openmp.payload)}`);
    const updatedGraph = applyUpdates(originalGraph, updates, csr.mapping);
    const reference = dijkstra(updatedGraph, csr.mapping.toNative(fixture.source));
    assert.deepEqual(cuda.payload.distances, reference.distances, `${fixture.id} CUDA/static`);
    assert.deepEqual(openmp.payload.distances, reference.distances, `${fixture.id} OpenMP/static`);
    validateParents(updatedGraph, cuda.payload.distances, cuda.payload.parents, csr.mapping.toNative(fixture.source));
    validateParents(updatedGraph, openmp.payload.distances, openmp.payload.parents, csr.mapping.toNative(fixture.source));
    parity.push({
      fixture: fixture.id,
      graphHash: sha(fixture.graph),
      updateHash: sha(updates),
      source: fixture.source,
      cudaDistanceHash: sha(cuda.payload.distances),
      openmpDistanceHash: sha(openmp.payload.distances),
      referenceDistanceHash: sha(reference.distances),
      cudaParentValid: true,
      openmpParentValid: true,
      cudaMetrics: cuda.payload.metrics,
      result: "PASS",
    });
    fixturePasses += 1;
  }

  let seed = 0x5eed1234;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  for (let caseIndex = 0; caseIndex < 40; caseIndex += 1) {
    const vertexCount = 8 + (caseIndex % 9);
    const vertices = Array.from({ length: vertexCount }, (_, index) => `v${String(index).padStart(2, "0")}`);
    const edgeMap = new Map();
    for (let index = 0; index < vertexCount - 1; index += 1) edgeMap.set(`${index}:${index + 1}`, 1 + Math.floor(random() * 9));
    for (let trial = 0; trial < vertexCount * 3; trial += 1) {
      const source = Math.floor(random() * vertexCount);
      const target = Math.floor(random() * vertexCount);
      if (source !== target) edgeMap.set(`${source}:${target}`, 1 + Math.floor(random() * 20));
    }
    const edges = [...edgeMap].map(([key, weight]) => {
      const [source, target] = key.split(":").map(Number);
      return { source: vertices[source], target: vertices[target], weight };
    });
    const graph = { graphType: "OrdinaryGraph", directed: true, vertices, edges };
    const csr = canonicalOrdinaryGraphToCsr(graph);
    const originalGraph = csrToGraph(csr);
    const prior = dijkstra(originalGraph, csr.mapping.toNative(vertices[0]));
    const deletion = edges[Math.floor(random() * edges.length)];
    let insertion;
    for (let guard = 0; guard < 1000 && !insertion; guard += 1) {
      const source = Math.floor(random() * vertexCount);
      const target = Math.floor(random() * vertexCount);
      if (source !== target && !edgeMap.has(`${source}:${target}`)) insertion = { source: vertices[source], target: vertices[target], weight: 1 + Math.floor(random() * 20) };
    }
    assert.ok(insertion);
    const updates = { deletions: [{ source: deletion.source, target: deletion.target }], insertions: [insertion] };
    const updatedGraph = applyUpdates(originalGraph, updates, csr.mapping);
    const reference = dijkstra(updatedGraph, csr.mapping.toNative(vertices[0]));
    const graphId = `cuda-stress-${caseIndex}`;
    const cudaPath = join(workspace, `stress-${caseIndex}-cuda.txt`);
    const openmpPath = join(workspace, `stress-${caseIndex}-openmp.txt`);
    await writeFile(cudaPath, serialize({ csr, graphId, source: csr.mapping.toNative(vertices[0]), prior, updates, cuda: true }), "utf8");
    await writeFile(openmpPath, serialize({ csr, graphId, source: csr.mapping.toNative(vertices[0]), prior, updates }), "utf8");
    const cuda = runBinary(cudaBinary, cudaPath, Boolean(sanitizer));
    const openmp = runBinary(openmpBinary, openmpPath);
    assert.equal(cuda.status, 0, `stress-${caseIndex} CUDA: ${cuda.stderr || JSON.stringify(cuda.payload)}`);
    assert.equal(openmp.status, 0, `stress-${caseIndex} OpenMP: ${openmp.stderr || JSON.stringify(openmp.payload)}`);
    assert.deepEqual(cuda.payload.distances, reference.distances, `stress-${caseIndex} CUDA/static`);
    assert.deepEqual(openmp.payload.distances, reference.distances, `stress-${caseIndex} OpenMP/static`);
    validateParents(updatedGraph, cuda.payload.distances, cuda.payload.parents, csr.mapping.toNative(vertices[0]));
    validateParents(updatedGraph, openmp.payload.distances, openmp.payload.parents, csr.mapping.toNative(vertices[0]));
    stressPasses += 1;
  }

  console.log(JSON.stringify({
    result: "PASS",
    sanitizer: sanitizer || "none",
    fixturePasses,
    stressPasses,
    fixedSeed: "0x5eed1234",
    parity,
  }, null, 2));
} finally {
  await rm(workspace, { recursive: true, force: true });
}
