import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packCudaMotifRequest, validateCudaMotifResult } from "./hypergraph-motif-cuda-contract.mjs";
import { countHypergraphThreeEdgeMotifs } from "../../src/candy/hypergraphMotifs/referenceOracle.js";
import { classifyMotifSignature, HYPERGRAPH_3EDGE_MOTIF_TAXONOMY, maskToSignature, S3_HYPEREDGE_PERMUTATIONS } from "../../src/candy/hypergraphMotifs/taxonomy.js";
import { ALL_30_MOTIF_WITNESSES, DISCONNECTED_TRIPLE, hypergraphValue, witnessForTaxonomyEntry } from "../../tests/fixtures/candy-scope4-motifs.mjs";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const build = join(root, "candy-runtime", "native", "hypergraph-motif-cuda", "build");
const binary = join(build, "candy-hypergraph-motif-cuda");
const sanitizer = process.argv.find(arg => arg.startsWith("--sanitizer="))?.slice(12) ?? null;
assert.ok(process.argv.slice(2).length === (sanitizer ? 1 : 0), "Only --sanitizer=<tool> is accepted");
assert.ok(!sanitizer || ["memcheck", "racecheck", "initcheck", "synccheck"].includes(sanitizer));
const wslPath = value => process.platform === "win32" && /^[A-Za-z]:/.test(value) ? `/mnt/${value[0].toLowerCase()}${value.slice(2).replaceAll("\\", "/")}` : value;
const workspace = await mkdtemp(join(build, "qualification-"));
const requestPath = join(workspace, "request.txt");
const report = {
  schemaVersion: "candy.scope4b1-qualification/1",
  status: "RUNNING",
  baseline: "7b4206ba66f38df18b0a0fe33d55800f79ef0000",
  algorithm: "HYPERGRAPH_3EDGE_MOTIF_COUNT", taxonomy: HYPERGRAPH_3EDGE_MOTIF_TAXONOMY.taxonomyVersion,
  backend: "CUDA_STATIC", mode: "STATIC",
  binarySha256: createHash("sha256").update(await readFile(binary)).digest("hex"),
  sanitizer, cases: [], failures: [], signatureCoverage: {}, stress: { seed: "0x4b1c0de", cases: 96, maxVertices: 32, maxHyperedges: 18 },
};
function invoke(executable, path, useSanitizer = false, hideGpu = false) {
  const command = useSanitizer ? "/usr/local/cuda-13.4/bin/compute-sanitizer" : wslPath(executable);
  const args = useSanitizer ? ["--tool", sanitizer, "--error-exitcode", "86", wslPath(executable), "--request", wslPath(path)] : ["--request", wslPath(path)];
  const env = hideGpu ? { ...process.env, CUDA_VISIBLE_DEVICES: "-1", WSLENV: `${process.env.WSLENV ? process.env.WSLENV + ":" : ""}CUDA_VISIBLE_DEVICES` } : process.env;
  const child = process.platform === "win32"
    ? spawnSync("wsl.exe", ["-d", "Ubuntu", "--exec", command, ...args], { encoding: "utf8", timeout: 60_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true, env })
    : spawnSync(command, args, { encoding: "utf8", timeout: 60_000, maxBuffer: 8 * 1024 * 1024, env });
  assert.ifError(child.error);
  assert.equal(child.signal, null);
  const line = child.stdout.split(/\r?\n/).find(s => s.startsWith("{"));
  const payload = JSON.parse(line ?? "");
  const diagnostics = `${child.stdout}\n${child.stderr}`;
  if (useSanitizer) {
    assert.notEqual(child.status, 86, diagnostics);
    const summary = sanitizer === "racecheck" ? /RACECHECK SUMMARY: 0 hazards displayed \(0 errors, 0 warnings\)/ : /ERROR SUMMARY: 0 errors/;
    assert.match(diagnostics, summary);
  }
  return { status: child.status, payload, diagnostics };
}
async function parity(id, graph, useSanitizer = false) {
  const packed = packCudaMotifRequest(graph);
  const oracle = countHypergraphThreeEdgeMotifs(packed.graph);
  await writeFile(requestPath, packed.text);
  const run = invoke(binary, requestPath, useSanitizer);
  assert.equal(run.status, 0, `${id}: ${run.diagnostics}`);
  const result = validateCudaMotifResult(run.payload, packed);
  assert.deepEqual(result.counts, oracle.counts, `${id}: all 30 bins`);
  assert.equal(result.totalConnectedTriples, oracle.totalConnectedTriples, `${id}: connected total`);
  report.device ??= result.cuda;
  report.cases.push({ id, counts: result.counts, totalConnectedTriples: result.totalConnectedTriples, launch: result.cuda.kernelLaunchSucceeded, synchronized: result.cuda.synchronizationSucceeded, ...(useSanitizer ? { diagnostics: run.diagnostics } : {}) });
  if (report.cases.length % 50 === 0) console.log(`Exact CUDA parity: ${report.cases.length} graphs passed`);
  return { packed, result };
}
async function failure(id, text, expected, fault = null, path = requestPath, hideGpu = false) {
  if (text !== null) await writeFile(path, text);
  assert.ok(fault === null || ["UNAVAILABLE", "ALLOCATION", "LAUNCH", "SYNC"].includes(fault));
  const executable = fault ? `${binary}-fault-${fault}` : binary;
  const run = invoke(executable, path, false, hideGpu);
  assert.equal(run.status, 1, `${id}: ${run.diagnostics}`);
  assert.equal(run.payload.ok, false, id);
  assert.equal(run.payload.error.classification, expected, id);
  assert.deepEqual(Object.keys(run.payload).sort(), ["error", "ok"], "No partial counts on failure");
  report.failures.push({ id, expected, payload: run.payload, exit: run.status });
}
function linuxFixtureCommand(command, args) {
  assert.ok(["/usr/bin/mktemp", "/usr/bin/ln", "/usr/bin/mkfifo", "/usr/bin/unlink", "/usr/bin/rmdir"].includes(command));
  const result = process.platform === "win32"
    ? spawnSync("wsl.exe", ["-d", "Ubuntu", "--exec", command, ...args], { encoding: "utf8", timeout: 10_000, windowsHide: true })
    : spawnSync(command, args, { encoding: "utf8", timeout: 10_000 });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
async function specialFileFailures() {
  const directory = linuxFixtureCommand("/usr/bin/mktemp", ["-d", "/tmp/candy-scope4b1-XXXXXX"]);
  assert.match(directory, /^\/tmp\/candy-scope4b1-[A-Za-z0-9]+$/);
  const symlink = `${directory}/link`, fifo = `${directory}/fifo`;
  let linked = false, piped = false;
  try {
    linuxFixtureCommand("/usr/bin/ln", ["-s", wslPath(requestPath), symlink]); linked = true;
    linuxFixtureCommand("/usr/bin/mkfifo", [fifo]); piped = true;
    await failure("final-symlink", null, "INVALID_GRAPH_SCHEMA", null, symlink);
    await failure("fifo-no-hang", null, "INVALID_GRAPH_SCHEMA", null, fifo);
  } finally {
    if (linked) linuxFixtureCommand("/usr/bin/unlink", [symlink]);
    if (piped) linuxFixtureCommand("/usr/bin/unlink", [fifo]);
    linuxFixtureCommand("/usr/bin/rmdir", [directory]);
  }
}
let randomState = 0x4b1c0de;
function random() { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296; }
function randomGraph(index) {
  const vertexCount = 1 + Math.floor(random() * 32), edgeCount = Math.floor(random() * 19);
  const vertices = Array.from({ length: vertexCount }, (_, i) => i % 2 ? `v-${i}` : i * 1009);
  const hyperedges = Array.from({ length: edgeCount }, (_, i) => {
    const selected = vertices.filter(() => random() < [0.04, 0.2, 0.6, 0.9][index % 4]);
    if (!selected.length) selected.push(vertices[Math.floor(random() * vertices.length)]);
    return { id: `h-${i}`, vertices: selected };
  });
  if (index % 5 === 0 && hyperedges.length > 1) hyperedges[1].vertices = [...hyperedges[0].vertices];
  return hypergraphValue({ graphId: `stress-${index}`, graphType: index % 2 ? "DynamicHypergraph" : "Hypergraph", vertices, hyperedges });
}
function combinedWitnessGraph() {
  const vertices = [], hyperedges = [];
  for (const witness of ALL_30_MOTIF_WITNESSES) {
    const prefix = `m${witness.motifId}:`;
    vertices.push(...witness.graph.vertices.map(v => prefix + v));
    hyperedges.push(...witness.graph.hyperedges.map(e => ({ id: prefix + e.id, vertices: e.vertices.map(v => prefix + v) })));
  }
  return hypergraphValue({ graphId: "simultaneous-30-classes", vertices, hyperedges });
}
try {
  if (sanitizer) {
    report.stress.cases = 0;
    await parity("simultaneous-all-30", combinedWitnessGraph(), true);
    await parity("mixed-stress", randomGraph(2), true);
    await parity("parallel-identical-100", hypergraphValue({ vertices: [0], hyperedges: Array.from({ length: 100 }, (_, i) => ({ id: i, vertices: [0] })) }), true);
  } else {
    for (const witness of ALL_30_MOTIF_WITNESSES) {
      const check = await parity(`class-${witness.motifId}-${witness.shape}`, witness.graph);
      assert.equal(check.result.counts[witness.motifId - 1], 1);
      for (const permutation of S3_HYPEREDGE_PERMUTATIONS) {
        // Rename labels so canonical adapter ordering actually changes A/B/C.
        const graph = structuredClone(witness.graph);
        graph.hyperedges.forEach((edge, i) => { edge.id = `edge-${permutation[i]}`; });
        await parity(`class-${witness.motifId}-S3-${permutation.join("")}`, graph);
      }
    }
    let connected = 0, disconnected = 0, invalidEmpty = 0;
    for (let mask = 0; mask < 128; ++mask) {
      const graph = witnessForTaxonomyEntry({ canonicalSignature: maskToSignature(mask), motifId: mask });
      if (graph.hyperedges.some(edge => edge.vertices.length === 0)) {
        assert.throws(() => packCudaMotifRequest(graph));
        const flat = [], offsets = [0];
        for (const edge of graph.hyperedges) {
          flat.push(...edge.vertices.map(v => graph.vertices.indexOf(v)).sort((a, b) => a - b));
          offsets.push(flat.length);
        }
        const raw = packCudaMotifRequest(ALL_30_MOTIF_WITNESSES[0].graph).text
          .replace(/vertex_count \d+/, `vertex_count ${graph.vertices.length}`)
          .replace(/incidence_count \d+/, `incidence_count ${flat.length}`)
          .replace(/offsets 4 [^\n]+/, `offsets 4 ${offsets.join(" ")}`)
          .replace(/memberships [^\n]+/, `memberships ${flat.length} ${flat.join(" ")}`);
        await failure(`signature-${mask}-invalid-empty-edge`, raw, "INVALID_GRAPH_SCHEMA");
        invalidEmpty += 1;
        continue;
      }
      const check = await parity(`signature-${mask}`, graph);
      const expected = classifyMotifSignature(mask);
      if (expected) { connected += 1; assert.equal(check.result.counts[expected.motifId - 1], 1); }
      else { disconnected += 1; assert.equal(check.result.totalConnectedTriples, 0); }
    }
    report.signatureCoverage = { total: 128, connected, disconnectedRealizable: disconnected, invalidEmptyEdge: invalidEmpty };
    assert.equal(connected, 96);
    assert.equal(connected + disconnected + invalidEmpty, 128);
    for (const witness of ALL_30_MOTIF_WITNESSES) {
      const graph = structuredClone(witness.graph);
      graph.vertices = [...graph.vertices].reverse();
      graph.hyperedges.reverse();
      graph.hyperedges.forEach(edge => edge.vertices.reverse());
      await parity(`class-${witness.motifId}-order`, graph);
      const mapping = new Map(graph.vertices.map((id, i) => [id, i * 100003 + 7]));
      graph.vertices = [...mapping.values(), "isolated"];
      graph.hyperedges = graph.hyperedges.map((edge, i) => ({ id: i * 10007, vertices: edge.vertices.map(v => mapping.get(v)) }));
      await parity(`class-${witness.motifId}-sparse-renamed-isolated`, graph);
    }
    await parity("disconnected", DISCONNECTED_TRIPLE);
    for (let n = 0; n < 3; ++n) await parity(`less-than-three-${n}`, hypergraphValue({ vertices: ["v", "isolate"], hyperedges: Array.from({ length: n }, (_, i) => ({ id: i, vertices: ["v"] })) }));
    await parity("typed-ids-identical-incidence", hypergraphValue({ graphId: 'identity \"\\\n\ud800 🍬', graphVersion: Number.MAX_SAFE_INTEGER, vertices: [0, "0", 999999, "isolate"], hyperedges: [{ id: 0, vertices: [0, "0"] }, { id: "0", vertices: ["0", 999999] }, { id: "C", vertices: [0, "0"] }] }));
    await parity("simultaneous-all-30", combinedWitnessGraph());
    await parity("parallel-identical-216", hypergraphValue({ vertices: [0], hyperedges: Array.from({ length: 216 }, (_, i) => ({ id: i, vertices: [0] })) }));
    await parity("singleton-disconnected-mixture", hypergraphValue({ vertices: Array.from({ length: 16 }, (_, i) => i), hyperedges: Array.from({ length: 16 }, (_, i) => ({ id: i, vertices: [i] })) }));
    await parity("open-wedge-rich", hypergraphValue({ vertices: Array.from({ length: 18 }, (_, i) => i), hyperedges: [{ id: "hub", vertices: Array.from({ length: 18 }, (_, i) => i) }, ...Array.from({ length: 18 }, (_, i) => ({ id: `leaf-${i}`, vertices: [i] }))] }));
    await parity("near-work-budget", hypergraphValue({ vertices: Array.from({ length: 641 }, (_, i) => i), hyperedges: Array.from({ length: 26 }, (_, i) => ({ id: i, vertices: Array.from({ length: 641 }, (_, v) => v) })) }));
    await parity("incidence-bound-100000", hypergraphValue({ vertices: Array.from({ length: 50000 }, (_, i) => i), hyperedges: [{ id: "A", vertices: Array.from({ length: 50000 }, (_, i) => i) }, { id: "B", vertices: Array.from({ length: 50000 }, (_, i) => i) }] }));
    for (let index = 0; index < report.stress.cases; ++index) await parity(`stress-${index}`, randomGraph(index));
    const { text } = packCudaMotifRequest(ALL_30_MOTIF_WITNESSES[0].graph);
    const mutations = [
      ["algorithm", text.replace("algorithm HYPERGRAPH_3EDGE_MOTIF_COUNT", "algorithm SSSP"), "ALGORITHM_FAILURE"],
      ["taxonomy", text.replace("taxonomy candy.hypergraph-3edge-motif-taxonomy/1", "taxonomy unknown"), "INVALID_GRAPH_SCHEMA"],
      ["incremental", text.replace("mode STATIC", "mode INCREMENTAL"), "UNSUPPORTED_MODE"],
      ...["OrdinaryGraph", "DynamicOrdinaryGraph", "ProjectedOrdinaryGraph"].map(type => [type, text.replace("graph_type Hypergraph", `graph_type ${type}`), "INVALID_GRAPH_TYPE"]),
      ["schema", text.replace("REQUEST_V1", "REQUEST_V2"), "INVALID_GRAPH_SCHEMA"],
      ["missing-fields", text.split("offsets")[0], "INVALID_GRAPH_SCHEMA"],
      ["extra-H2H", text + "H2H 1 2", "INVALID_GRAPH_SCHEMA"],
      ["invalid-offset-count", text.replace(/offsets 4 /, "offsets 3 "), "INVALID_GRAPH_SCHEMA"],
      ["invalid-offset-start", text.replace(/offsets 4 0 /, "offsets 4 1 "), "INVALID_GRAPH_SCHEMA"],
      ["decreasing-offset", text.replace(/offsets 4 [^\n]+/, "offsets 4 0 2 1 4"), "INVALID_GRAPH_SCHEMA"],
      ["empty-hyperedge", text.replace(/offsets 4 [^\n]+/, "offsets 4 0 0 1 4"), "INVALID_GRAPH_SCHEMA"],
      ["incidence-length", text.replace(/memberships \d+ /, "memberships 0 "), "INVALID_GRAPH_SCHEMA"],
      ["unsafe-version", text.replace("graph_version 1", "graph_version 9007199254740992"), "RESOURCE_LIMIT"],
      ["negative-device", text.replace("cuda_device 0", "cuda_device -1"), "INVALID_GRAPH_SCHEMA"],
      ["invalid-device", text.replace("cuda_device 0", "cuda_device 99"), "BACKEND_UNAVAILABLE"],
      ["numeric-suffix", text.replace("vertex_count 2", "vertex_count 2x"), "INVALID_GRAPH_SCHEMA"],
      ["hyperedge-limit", text.replace("hyperedge_count 3", "hyperedge_count 257"), "RESOURCE_LIMIT"],
      ["incidence-limit", text.replace(/incidence_count \d+/, "incidence_count 100001"), "RESOURCE_LIMIT"],
      ["vertex-limit", text.replace(/vertex_count \d+/, "vertex_count 1000001"), "RESOURCE_LIMIT"],
      ["work-limit", text.replace("hyperedge_count 3", "hyperedge_count 256").replace(/incidence_count \d+/, "incidence_count 100000"), "RESOURCE_LIMIT"],
      ["identity-injection", text.replace(/graph_id_u16 [^\n]+/, "graph_id_u16 zz"), "INVALID_GRAPH_SCHEMA"],
      ["malformed-file", "BROKEN\n", "INVALID_GRAPH_SCHEMA"],
      ["oversized-file", "x".repeat(2 * 1024 * 1024 + 1), "RESOURCE_LIMIT"],
    ];
    const duplicate = packCudaMotifRequest(hypergraphValue({ vertices: [0, 1], hyperedges: [{ id: "A", vertices: [0, 1] }, { id: "B", vertices: [0] }, { id: "C", vertices: [0] }] })).text;
    mutations.push(["duplicate-native-membership", duplicate.replace("memberships 4 0 1 0 0", "memberships 4 0 0 0 0"), "INVALID_GRAPH_SCHEMA"]);
    mutations.push(["out-of-range-membership", duplicate.replace("memberships 4 0 1 0 0", "memberships 4 0 2 0 0"), "INVALID_VERTEX"]);
    mutations.push(["unsorted-membership", duplicate.replace("memberships 4 0 1 0 0", "memberships 4 1 0 0 0"), "INVALID_GRAPH_SCHEMA"]);
    for (const [id, request, expected] of mutations) await failure(id, request, expected);
    await failure("inaccessible-file", null, "INVALID_GRAPH_SCHEMA", null, join(workspace, "missing.txt"));
    await failure("directory-file", null, "INVALID_GRAPH_SCHEMA", null, workspace);
    await failure("actual-no-visible-device", text, "BACKEND_UNAVAILABLE", null, requestPath, true);
    await specialFileFailures();
    for (const fault of ["UNAVAILABLE", "ALLOCATION", "LAUNCH", "SYNC"]) await failure(`forced-${fault}`, text, "BACKEND_UNAVAILABLE", fault);
    const bad = structuredClone(ALL_30_MOTIF_WITNESSES[0].graph);
    bad.hyperedges[1].id = bad.hyperedges[0].id;
    assert.throws(() => packCudaMotifRequest(bad));
    report.failures.push({ id: "duplicate-semantic-id-before-packing", boundary: "qualified adapter", rejected: true });
    const clean = await parity("corrupt-result-control", ALL_30_MOTIF_WITNESSES[0].graph);
    const corruptions = [
      value => { value.counts.pop(); }, value => { value.counts[0] = -1; }, value => { value.totalConnectedTriples += 1; },
      value => { value.inputGraphRef.graphVersion += 1; }, value => { value.inputGraphRef.graphId = "stale"; },
      value => { value.backend = "CPU_REFERENCE_ORACLE"; }, value => { value.cuda.kernelLaunchSucceeded = false; },
      value => { value.cuda.synchronizationSucceeded = false; }, value => { value.cuda.deviceIndex = 99; },
      value => { value.mode = "INCREMENTAL"; }, value => { value.cuda.kernelMilliseconds = NaN; }, value => { value.extra = true; },
    ];
    for (const [index, mutate] of corruptions.entries()) {
      const result = structuredClone(clean.result); mutate(result);
      assert.throws(() => validateCudaMotifResult(result, clean.packed));
      report.failures.push({ id: `corrupt-result-${index}`, rejected: true });
    }
  }
  report.status = "NATIVE_QUALIFICATION_PASS";
  report.passed = report.cases.length;
  report.failed = 0;
  report.witnessClasses = sanitizer ? null : { all: 30, openWedge: 6, closedTriangle: 24 };
} catch (error) {
  report.status = "NATIVE_QUALIFICATION_FAIL";
  report.failed = 1;
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await rm(workspace, { recursive: true, force: true });
  const output = join(root, "artifacts", `candy-scope4b1-cuda-static-${sanitizer ?? "native"}-qualification.json`);
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(`${report.status}: ${report.cases.length} exact parity graphs; ${report.failures.length} failure checks. ${output}`);
  if (report.error) console.error(report.error);
}
