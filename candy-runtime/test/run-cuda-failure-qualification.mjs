import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("../../", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/, "$1:"));
const toWslPath = value => `/mnt/${value[0].toLowerCase()}${value.slice(2).replaceAll("\\", "/")}`;
const buildDir = `${toWslPath(join(repoRoot, "candy-runtime", "native", "sssp-cuda"))}/build`;
const sanitizer = process.env.CANDY_CUDA_SANITIZER_TOOL ?? "";
const sanitizerBinary = process.env.CANDY_COMPUTE_SANITIZER ?? "/usr/local/cuda-13.4/bin/compute-sanitizer";

const validRequest = `CANDY_SSSP_CUDA_REQUEST_V1
backend LOCAL_CUDA
mode COMPARE
graph_type OrdinaryGraph
projection_provenance_id -
graph_id failure-matrix
graph_version 1
state_graph_id failure-matrix
state_graph_version 1
state_version 1
source 0
cuda_device 0
vertex_count 3
edge_count 2
row_offsets 4 0 1 2 2
column_indices 2 1 2
weights 2 1 2
prior_distances 3 0 1 3
prior_parents 3 -1 0 1
deletion_count 0
insertion_count 0
END
`;

function run(binary, requestPath, useSanitizer = false) {
  const command = useSanitizer
    ? [sanitizerBinary, "--tool", sanitizer, "--error-exitcode", "86", binary, "--request", toWslPath(requestPath)]
    : [binary, "--request", toWslPath(requestPath)];
  const result = spawnSync("wsl.exe", command, { encoding: "utf8", timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
  let payload;
  try {
    const jsonLine = result.stdout.split(/\r?\n/).find(line => line.trim().startsWith("{"));
    payload = JSON.parse(jsonLine ?? result.stdout.trim());
  } catch (error) {
    throw new Error(`Failure-matrix output was not JSON. status=${result.status} stdout=${result.stdout} stderr=${result.stderr}`, { cause: error });
  }
  if (useSanitizer) {
    const diagnostics = `${result.stdout}\n${result.stderr}`;
    assert.notEqual(result.status, 86, `compute-sanitizer ${sanitizer} found an error: ${diagnostics}`);
    const cleanSummary = sanitizer === "racecheck" ? /RACECHECK SUMMARY: 0 hazards displayed \(0 errors, 0 warnings\)/.test(diagnostics) : /ERROR SUMMARY: 0 errors/.test(diagnostics);
    assert.ok(cleanSummary || /terminated before first instrumented API call/.test(diagnostics), `compute-sanitizer ${sanitizer} summary: ${diagnostics}`);
  }
  return { ...result, payload };
}

function expectFailure(result, classification, id) {
  assert.notEqual(result.status, 0, `${id} must return non-zero`);
  assert.equal(result.payload.ok, false, `${id} must not report success`);
  assert.equal(result.payload.error?.classification, classification, `${id} classification`);
}

const workspace = await mkdtemp(join(tmpdir(), "candy-cuda-failures-"));
const results = [];
try {
  const cases = [
    ["invalid-device", validRequest.replace("cuda_device 0", "cuda_device 99"), "BACKEND_UNAVAILABLE"],
    ["malformed-request", "BROKEN\n", "INVALID_GRAPH_SCHEMA"],
    ["malformed-csr", validRequest.replace("row_offsets 4 0 1 2 2", "row_offsets 4 0 2 1 2"), "INVALID_GRAPH_SCHEMA"],
    ["invalid-update-vertex", validRequest.replace("insertion_count 0\nEND", "insertion_count 1\ni 0 99 1\nEND"), "INVALID_UPDATE_BATCH"],
    ["stale-graph", validRequest.replace("state_graph_version 1", "state_graph_version 0"), "STALE_GRAPH_VERSION"],
    ["stale-property", validRequest.replace("state_version 1", "state_version 0"), "STALE_PROPERTY_STATE"],
    ["negative-weight", validRequest.replace("weights 2 1 2", "weights 2 1 -1"), "UNSUPPORTED_WEIGHT_MODEL"],
    ["resource-count-limit", validRequest.replace("vertex_count 3", "vertex_count 10001"), "RESOURCE_LIMIT"],
    ["hypergraph", validRequest.replace("graph_type OrdinaryGraph", "graph_type Hypergraph"), "INVALID_GRAPH_TYPE"],
    ["cuda-static-forbidden", validRequest.replace("mode COMPARE", "mode STATIC"), "ALGORITHM_FAILURE"],
  ];
  for (const [id, request, classification] of cases) {
    const requestPath = join(workspace, `${id}.txt`);
    await writeFile(requestPath, request, "utf8");
    const result = run(`${buildDir}/candy-sssp-cuda`, requestPath, Boolean(sanitizer));
    expectFailure(result, classification, id);
    results.push({ id, classification, result: "PASS" });
  }

  const validPath = join(workspace, "valid.txt");
  await writeFile(validPath, validRequest, "utf8");
  const successful = run(`${buildDir}/candy-sssp-cuda`, validPath, Boolean(sanitizer));
  assert.equal(successful.status, 0, successful.stderr || JSON.stringify(successful.payload));
  assert.equal(successful.payload.ok, true);
  assert.equal(successful.payload.distances.length, 3);
  assert.equal(successful.payload.parents.length, 3);
  assert.ok(successful.stdout.length < 1_000_000, "bounded fixture output");
  results.push({ id: "bounded-success-output", classification: null, result: "PASS" });

  const faults = [
    ["memory-preflight", "candy-sssp-cuda-fault-memory", "RESOURCE_LIMIT"],
    ["allocation", "candy-sssp-cuda-fault-allocation", "RESOURCE_LIMIT"],
    ["kernel-launch", "candy-sssp-cuda-fault-launch", "ALGORITHM_FAILURE"],
    ["synchronization", "candy-sssp-cuda-fault-sync", "ALGORITHM_FAILURE"],
    ["nonconvergence", "candy-sssp-cuda-fault-nonconvergence", "RESULT_VALIDATION_FAILURE"],
    ["compare-mismatch", "candy-sssp-cuda-fault-mismatch", "RESULT_VALIDATION_FAILURE"],
  ];
  for (const [id, binary, classification] of faults) {
    if (sanitizer && id === "kernel-launch") {
      results.push({ id, classification, result: "NOT_APPLICABLE_INTENTIONAL_CUDA_API_ERROR" });
      continue;
    }
    const result = run(`${buildDir}/${binary}`, validPath, Boolean(sanitizer));
    expectFailure(result, classification, id);
    results.push({ id, classification, result: "PASS" });
  }

  const missing = run(`${buildDir}/candy-sssp-cuda`, join(workspace, "missing.txt"), Boolean(sanitizer));
  expectFailure(missing, "INVALID_GRAPH_SCHEMA", "missing-request");
  results.push({ id: "missing-request", classification: "INVALID_GRAPH_SCHEMA", result: "PASS" });

  console.log(JSON.stringify({ result: "PASS", sanitizer: sanitizer || "none", cases: results }, null, 2));
} finally {
  await rm(workspace, { recursive: true, force: true });
}
