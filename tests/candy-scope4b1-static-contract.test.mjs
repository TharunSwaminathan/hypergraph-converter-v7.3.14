import assert from "node:assert/strict";
import test from "node:test";
import { packCudaMotifRequest, validateCudaMotifResult, CUDA_MOTIF_RESULT_SCHEMA } from "../candy-runtime/test/hypergraph-motif-cuda-contract.mjs";
import { ALL_30_MOTIF_WITNESSES, hypergraphValue } from "./fixtures/candy-scope4-motifs.mjs";
import { countHypergraphThreeEdgeMotifs } from "../src/candy/hypergraphMotifs/referenceOracle.js";

test("static packing preserves typed IDs, independent identical edges, isolates and string identity", () => {
  const graph = hypergraphValue({ graphId: 'spaces \"\n\\ 🍬\ud800', vertices: [0, "0", "isolate"], hyperedges: [{ id: 0, vertices: [0, "0"] }, { id: "0", vertices: ["0", 0] }, { id: "C", vertices: [0] }] });
  const first = packCudaMotifRequest(graph);
  const reordered = structuredClone(graph);
  reordered.vertices.reverse(); reordered.hyperedges.reverse(); reordered.hyperedges.forEach(edge => edge.vertices.reverse());
  assert.equal(packCudaMotifRequest(reordered).text, first.text);
  assert.equal(first.graph.hyperedgeCount, 3);
  assert.equal(first.graph.vertexCount, 3);
  assert.equal(first.graph.isolatedVertexNativeIndices.length, 1);
  assert.notEqual(first.graph.vertexMapping.toNative(0), first.graph.vertexMapping.toNative("0"));
  const encoded = first.text.match(/graph_id_u16 (\S+)/)[1];
  const decoded = encoded.match(/.{4}/g).map(unit => String.fromCharCode(parseInt(unit, 16))).join("");
  assert.equal(decoded, graph.graphId);
});

test("qualified adapter and work bounds fail before packing incompatible or oversized data", () => {
  const valid = ALL_30_MOTIF_WITNESSES[0].graph;
  for (const graphType of ["OrdinaryGraph", "DynamicOrdinaryGraph", "ProjectedOrdinaryGraph"]) assert.throws(() => packCudaMotifRequest({ ...valid, graphType }));
  const duplicate = structuredClone(valid); duplicate.hyperedges[1].id = duplicate.hyperedges[0].id;
  assert.throws(() => packCudaMotifRequest(duplicate));
  for (const device of [-1, 0.1, NaN, 2147483648, "0"]) assert.throws(() => packCudaMotifRequest(valid, device));
  const costly = hypergraphValue({ vertices: Array.from({ length: 200 }, (_, i) => i), hyperedges: Array.from({ length: 256 }, (_, i) => ({ id: i, vertices: Array.from({ length: 200 }, (_, v) => v) })) });
  assert.throws(() => packCudaMotifRequest(costly), /work budget/i);
  assert.throws(() => packCudaMotifRequest({ ...valid, H2H: [] }));
});

test("result consumer rejects stale binding, fallback metadata and corrupted exact counts", () => {
  const packed = packCudaMotifRequest(ALL_30_MOTIF_WITNESSES[0].graph);
  const oracle = countHypergraphThreeEdgeMotifs(packed.graph);
  const valid = {
    ok: true, schemaVersion: CUDA_MOTIF_RESULT_SCHEMA, algorithm: "HYPERGRAPH_3EDGE_MOTIF_COUNT", taxonomyVersion: oracle.taxonomyVersion,
    backend: "CUDA_STATIC", mode: "STATIC", inputGraphRef: oracle.graphRef, counts: [...oracle.counts], totalConnectedTriples: oracle.totalConnectedTriples,
    cuda: { deviceIndex: 0, deviceName: "contract-fixture", computeMajor: 12, computeMinor: 0, compiledArchitecture: "sm_120", compilerVersion: "13.4.59", runtimeVersion: 13040, driverVersion: 13040, kernelLaunchSucceeded: true, synchronizationSucceeded: true, kernelMilliseconds: 0 },
  };
  validateCudaMotifResult(valid, packed);
  for (const mutation of [
    value => { value.backend = "CPU_REFERENCE_ORACLE"; }, value => { value.inputGraphRef = { ...value.inputGraphRef, graphVersion: 42 }; },
    value => { value.counts[0] = Number.MAX_SAFE_INTEGER + 1; }, value => { value.totalConnectedTriples = 0; }, value => { value.cuda.kernelLaunchSucceeded = false; },
    value => { value.cuda.synchronizationSucceeded = false; }, value => { value.extra = true; },
  ]) { const bad = structuredClone(valid); mutation(bad); assert.throws(() => validateCudaMotifResult(bad, packed)); }
});
