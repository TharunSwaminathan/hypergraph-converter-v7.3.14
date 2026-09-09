import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalOrdinaryGraphToCsr } from "../../src/candy/adapters/csrAdapter.js";
import { isCandyContractError } from "../../src/candy/contracts/errorClasses.js";
import { SSSP_FIXTURES } from "./fixtures/sssp-fixtures.mjs";

const repoRoot = resolve(new URL("../../", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/, "$1:"));
const nativeDir = join(repoRoot, "candy-runtime", "native", "sssp-openmp");
const toWslPath = value => `/mnt/${value[0].toLowerCase()}${value.slice(2).replaceAll("\\", "/")}`;
const nativeDirWsl = toWslPath(nativeDir);
const sanitize = process.env.CANDY_NATIVE_SANITIZE === "1";
const binaryWsl = `${nativeDirWsl}/build/candy-sssp-openmp${sanitize ? "-sanitize" : ""}`;
const faultBinaryWsl = `${nativeDirWsl}/build/candy-sssp-openmp${sanitize ? "-sanitize-fault" : "-fault"}`;

const buildTargets = sanitize ? ["sanitize", "sanitize-fault"] : ["all", "fault-test"];
const build = spawnSync("wsl.exe", ["make", "-C", nativeDirWsl, ...buildTargets], { encoding: "utf8" });
if (build.status !== 0) {
  console.error(build.stdout);
  console.error(build.stderr);
  process.exit(build.status ?? 1);
}

function dijkstra(graph, source) {
  const distances = Array(graph.length).fill(null);
  const parents = Array(graph.length).fill(-1);
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
      if (distances[target] == null || next < distances[target] || (next === distances[target] && (parents[target] < 0 || vertex < parents[target]))) {
        distances[target] = next;
        parents[target] = vertex;
      }
    }
  }
  parents[source] = -1;
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

function serializeRequest({ fixture, csr, prior, corruptPrior = false }) {
  const updates = fixture.updates ?? { deletions: [], insertions: [] };
  const stateRequired = fixture.mode !== "STATIC";
  const source = csr.mapping.toNative(fixture.source);
  const lines = [
    "CANDY_SSSP_REQUEST_V1",
    `mode ${fixture.mode}`,
    `graph_type ${fixture.graph.graphType}`,
    `projection_provenance_id ${fixture.graph.graphType === "ProjectedOrdinaryGraph" ? `sha256:${"a".repeat(64)}` : "-"}`,
    `graph_id graph-${fixture.id}`,
    "graph_version 1",
    `state_graph_id ${stateRequired ? `graph-${fixture.id}` : "-"}`,
    `state_graph_version ${stateRequired && !fixture.staleGraphVersion ? 1 : 0}`,
    `state_version ${stateRequired ? 1 : 0}`,
    `source ${source}`,
    "threads 2",
    `vertex_count ${csr.vertexCount}`,
    `edge_count ${csr.edgeCount}`,
    `row_offsets ${csr.rowOffsets.length} ${csr.rowOffsets.join(" ")}`,
    `column_indices ${csr.columnIndices.length}${csr.columnIndices.length ? ` ${csr.columnIndices.join(" ")}` : ""}`,
    `weights ${csr.weights.length}${csr.weights.length ? ` ${csr.weights.join(" ")}` : ""}`,
    `prior_distances ${stateRequired ? prior.distances.length : 0}${stateRequired ? ` ${prior.distances.map(value => value == null ? "INF" : value).join(" ")}` : ""}`,
    `prior_parents ${stateRequired ? prior.parents.length : 0}${stateRequired ? ` ${prior.parents.map((value, index) => corruptPrior && index === prior.parents.length - 1 ? 99 : value).join(" ")}` : ""}`,
    `deletion_count ${updates.deletions.length}`,
    ...updates.deletions.map(edge => `d ${csr.mapping.toNative(edge.source)} ${csr.mapping.toNative(edge.target)}`),
    `insertion_count ${updates.insertions.length}`,
    ...updates.insertions.map(edge => `i ${csr.mapping.toNative(edge.source)} ${csr.mapping.toNative(edge.target)} ${edge.weight}`),
    "END",
  ];
  return `${lines.join("\n")}\n`;
}

function runBinary(binary, requestPath) {
  const command = sanitize
    ? ["env", "ASAN_OPTIONS=detect_leaks=1:halt_on_error=1", "UBSAN_OPTIONS=halt_on_error=1:print_stacktrace=1", binary, "--request", toWslPath(requestPath)]
    : [binary, "--request", toWslPath(requestPath)];
  const result = spawnSync("wsl.exe", command, { encoding: "utf8", timeout: 30_000 });
  let payload;
  try {
    payload = JSON.parse(result.stdout.trim());
  } catch (error) {
    throw new Error(`Native output was not JSON. status=${result.status} stdout=${result.stdout} stderr=${result.stderr}`, { cause: error });
  }
  return { ...result, payload };
}

const workspace = await mkdtemp(join(tmpdir(), "candy-sssp-qualification-"));
const metrics = [];
let fixturePasses = 0;
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
    assert.deepEqual(csr.mapping.entries.map(entry => entry.canonicalId), fixture.expectedMapping, `${fixture.id} mapping`);
    assert.deepEqual({ rowOffsets: [...csr.rowOffsets], columnIndices: [...csr.columnIndices], weights: [...csr.weights] }, fixture.expectedCsr, `${fixture.id} CSR`);
    const baseGraph = csrToGraph(csr);
    const prior = dijkstra(baseGraph, csr.mapping.toNative(fixture.source));
    const requestPath = join(workspace, `${fixture.id}.txt`);
    await writeFile(requestPath, serializeRequest({ fixture, csr, prior }), { encoding: "utf8", mode: 0o600 });
    const result = runBinary(binaryWsl, requestPath);
    if (fixture.expectedError) {
      assert.notEqual(result.status, 0, `${fixture.id} must fail`);
      assert.equal(result.payload.error?.classification, fixture.expectedError, `${fixture.id} classification`);
    } else {
      assert.equal(result.status, 0, `${fixture.id}: ${result.stderr || JSON.stringify(result.payload)}`);
      assert.equal(result.payload.ok, true);
      assert.deepEqual(result.payload.distances, fixture.expectedDistances, `${fixture.id} distances`);
      if (fixture.mode === "COMPARE") assert.equal(result.payload.validation.status, "passed");
      metrics.push({ id: fixture.id, ...result.payload.metrics });
    }
    fixturePasses += 1;
  }

  // Malformed CSR fails closed.
  const malformedPath = join(workspace, "malformed.txt");
  await writeFile(malformedPath, "CANDY_SSSP_REQUEST_V1\nmode STATIC\nEND\n", "utf8");
  const malformed = runBinary(binaryWsl, malformedPath);
  assert.notEqual(malformed.status, 0);
  assert.equal(malformed.payload.error.classification, "INVALID_GRAPH_SCHEMA");

  // The native boundary independently rejects hypergraphs; it does not project.
  const typedFixture = SSSP_FIXTURES.find(item => item.id === "simple-chain");
  const typedCsr = canonicalOrdinaryGraphToCsr(typedFixture.graph);
  const typedPrior = dijkstra(csrToGraph(typedCsr), typedCsr.mapping.toNative(typedFixture.source));
  const hypergraphPath = join(workspace, "hypergraph-type.txt");
  const hypergraphRequest = serializeRequest({ fixture: typedFixture, csr: typedCsr, prior: typedPrior }).replace("graph_type OrdinaryGraph", "graph_type Hypergraph");
  await writeFile(hypergraphPath, hypergraphRequest, "utf8");
  const hypergraph = runBinary(binaryWsl, hypergraphPath);
  assert.notEqual(hypergraph.status, 0);
  assert.equal(hypergraph.payload.error.classification, "INVALID_GRAPH_TYPE");

  // Corrupt prior state is not silently recomputed.
  const baseFixture = SSSP_FIXTURES.find(item => item.id === "insertion-decreases-distance");
  const baseCsr = canonicalOrdinaryGraphToCsr(baseFixture.graph);
  const basePrior = dijkstra(csrToGraph(baseCsr), baseCsr.mapping.toNative(baseFixture.source));
  const corruptPath = join(workspace, "corrupt-prior.txt");
  await writeFile(corruptPath, serializeRequest({ fixture: baseFixture, csr: baseCsr, prior: basePrior, corruptPrior: true }), "utf8");
  const corrupt = runBinary(binaryWsl, corruptPath);
  assert.notEqual(corrupt.status, 0);
  assert.equal(corrupt.payload.error.classification, "STALE_PROPERTY_STATE");

  // Compile-time qualification fault proves comparison mismatches fail non-zero.
  const faultPath = join(workspace, "forced-mismatch.txt");
  await writeFile(faultPath, serializeRequest({ fixture: baseFixture, csr: baseCsr, prior: basePrior }), "utf8");
  const forcedMismatch = runBinary(faultBinaryWsl, faultPath);
  assert.notEqual(forcedMismatch.status, 0);
  assert.equal(forcedMismatch.payload.error.classification, "RESULT_VALIDATION_FAILURE");

  // Fixed-seed mixed-update stress. The native COMPARE mode is its own static oracle;
  // the harness also compares the returned distance array with an independent JS oracle.
  let seed = 0x5eed1234;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  const stressCases = 40;
  for (let caseIndex = 0; caseIndex < stressCases; caseIndex += 1) {
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
    const fixture = { id: `stress-${caseIndex}`, mode: "COMPARE", graph: { graphType: "OrdinaryGraph", directed: true, vertices, edges }, source: vertices[0] };
    const csr = canonicalOrdinaryGraphToCsr(fixture.graph);
    const originalGraph = csrToGraph(csr);
    const prior = dijkstra(originalGraph, csr.mapping.toNative(fixture.source));
    const deletable = edges[Math.floor(random() * edges.length)];
    let insertion;
    for (let guard = 0; guard < 1000 && !insertion; guard += 1) {
      const source = Math.floor(random() * vertexCount);
      const target = Math.floor(random() * vertexCount);
      if (source === target || edgeMap.has(`${source}:${target}`)) continue;
      insertion = { source: vertices[source], target: vertices[target], weight: 1 + Math.floor(random() * 20) };
    }
    assert.ok(insertion, "stress generator must find an insertion");
    fixture.updates = { deletions: [{ source: deletable.source, target: deletable.target }], insertions: [insertion] };
    const updatedGraph = applyUpdates(originalGraph, fixture.updates, csr.mapping);
    const expected = dijkstra(updatedGraph, csr.mapping.toNative(fixture.source));
    const requestPath = join(workspace, `stress-${caseIndex}.txt`);
    await writeFile(requestPath, serializeRequest({ fixture, csr, prior }), "utf8");
    const result = runBinary(binaryWsl, requestPath);
    assert.equal(result.status, 0, `stress-${caseIndex}: ${result.stderr || JSON.stringify(result.payload)}`);
    assert.equal(result.payload.validation.status, "passed");
    assert.deepEqual(result.payload.distances, expected.distances, `stress-${caseIndex} JS oracle`);
  }

  // Missing request is a truthful non-zero structured process failure.
  const missing = runBinary(binaryWsl, join(workspace, "does-not-exist.txt"));
  assert.notEqual(missing.status, 0);
  assert.equal(missing.payload.error.classification, "INVALID_GRAPH_SCHEMA");

  console.log(JSON.stringify({
    result: "PASS",
    sanitizer: sanitize ? "address,undefined" : "none",
    fixturePasses,
    stressCases,
    fixedSeed: "0x5eed1234",
    malformedInput: "PASS",
    staleState: "PASS",
    forcedMismatchFailure: "PASS",
    nativeHypergraphRejection: "PASS",
    performanceSamples: metrics,
  }, null, 2));
} finally {
  await rm(workspace, { recursive: true, force: true });
}
