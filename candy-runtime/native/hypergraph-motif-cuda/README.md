# CANDY Scope 4B1: static incidence motif CUDA reference

This standalone executable implements the qualified 30-class CANDY connected three-hyperedge motif product. It is not registered with Runtime Companion, capability discovery, UI or model actions. Incremental CUDA is unsupported. There is no CPU execution or fallback path.

## Build and qualify

Verified local build (WSL2 Ubuntu, RTX 5060, compute capability 12.0):

```sh
make -C candy-runtime/native/hypergraph-motif-cuda NVCC=/usr/local/cuda-13.4/bin/nvcc CUDA_ARCH=sm_120 all qualification-faults
node candy-runtime/test/run-hypergraph-motif-cuda-qualification.mjs
node candy-runtime/test/run-hypergraph-motif-cuda-qualification.mjs --sanitizer=memcheck
node candy-runtime/test/run-hypergraph-motif-cuda-qualification.mjs --sanitizer=racecheck
node candy-runtime/test/run-hypergraph-motif-cuda-qualification.mjs --sanitizer=initcheck
node candy-runtime/test/run-hypergraph-motif-cuda-qualification.mjs --sanitizer=synccheck
```

The harness supports Windows Node with fixed direct WSL argv and Linux Node with direct native argv. CUDA is mandatory; errors fail the suite. Each child has a 60-second timeout. No shell executes request content. The four fault binaries are isolated compile-time tests, never production execution options. Build products and temporary request directories live under ignored `build/`; temporary directories are removed in `finally`. Qualification JSON is permanent evidence, not runtime capability authority.

## Request transport v1

Invocation: `build/candy-hypergraph-motif-cuda --request <regular-file>`. Exactly this argument shape is accepted. The CLI explicitly grants read authority to that local path; it does not constitute a remote file service. Parent-directory symlinks and relative paths remain ordinary local OS path resolution. Final symlinks, directories and nonregular files are rejected; opening and bounded reading use the same descriptor. Neither requests nor results can select another executable, output path or command.

The project-owned qualified adapter validates the external incidence object and creates typed deterministic mappings. The standalone `hypergraph-motif-cuda-contract.mjs` transport packs the canonical H2V. H2H/V2H and projection fields are forbidden. External IDs are not sent as execution authority: distinct typed IDs and separate hyperedges remain distinct dense indices, while declared isolated vertices remain in `vertex_count`.

Fields must occur in the following exact token order. Arrays use a length followed by decimal values; `END` must be final. Numbers use unsigned decimal digits only, at most 16 digits, with field-specific bounds. UTF-16 identity is lowercase hex with exactly four digits per code unit, at most 512 units, preserving JSON string identity including surrogate code units.

```text
CANDY_HYPERGRAPH_MOTIF_CUDA_STATIC_REQUEST_V1
algorithm HYPERGRAPH_3EDGE_MOTIF_COUNT
taxonomy candy.hypergraph-3edge-motif-taxonomy/1
mode STATIC
graph_type Hypergraph
graph_id_u16 00670072006100700068
graph_version 1
cuda_device 0
vertex_count 1
hyperedge_count 3
incidence_count 3
offsets 4 0 1 2 3
memberships 3 0 0 0
END
```

`DynamicHypergraph` is also accepted in STATIC. Ordinary/projected graph types return `INVALID_GRAPH_TYPE`; other modes return `UNSUPPORTED_MODE`. Graph version is a nonnegative JS safe integer. Device index is at most INT32_MAX and must exist. Vertex count is at most 1,000,000; hyperedges at most 256; incidences at most 100,000. For m >= 3, incidences × C(m−1,2) must be at most 5,000,000. This bound plus nonempty edges means the largest realizable accepted edge count is 216, although the separate edge limit remains 256. Request bytes are at most 2 MiB. Offsets start at zero, end at incidence count, have m+1 entries, and strictly increase per nonempty edge. Memberships are strictly increasing per edge and in vertex range. Identical incidence across separate edges is allowed.

## Results and errors

Success is JSON with `ok: true`, schema `candy.hypergraph-motif-cuda-static-result/1`, algorithm/taxonomy, backend `CUDA_STATIC`, mode `STATIC`, `inputGraphRef` (graphId/version), exactly 30 unsigned safe integer `counts`, and their sum `totalConnectedTriples`. CUDA metadata includes device index/name, compute capability, compiled architecture, compiler/runtime/driver versions, successful launch/synchronization flags and informational CUDA-event milliseconds. The consumer checks exact keys, graph binding, device binding, integer bounds, sum, combinatorial bound and execution flags before comparing every bin/total to the external CPU oracle. Metadata is local execution evidence, not cryptographic attestation.

Failure exits 1 and emits only `{ "ok": false, "error": { "classification": "...", "message": "..." } }`; it never emits counts. Errors include `INVALID_GRAPH_SCHEMA`, `INVALID_GRAPH_TYPE`, `INVALID_VERTEX`, `UNSUPPORTED_MODE`, `ALGORITHM_FAILURE`, `RESOURCE_LIMIT`, `BACKEND_UNAVAILABLE`, `RESULT_VALIDATION_FAILURE`. Failure-unwind cleanup is best effort; successful execution checks cleanup before emitting results.

## Independent algorithm and bounds

Host code derives the 128-entry classification array solely from the qualified seven region membership subsets and all six S3 permutations, sorting canonical masks in ascending order. It verifies 96 connected labeled signatures, 30 orbits and 24 closed classes (therefore six open wedges). It performs no motif counting. GPU threads decode dense m³ slots and process exactly `i < j < k`; three sorted H2V rows are merged to derive the exclusive presence mask. Disconnected masks map to −1. Unsigned 64-bit global atomic additions have exact deterministic results. The host checks returned bins and their total against C(m,3). Even fewer-than-three-edge inputs launch and synchronize a real kernel, yielding zero.

Grid/allocation arithmetic is checked before use; m³ is at most 16,777,216 and the bin bound is at most C(256,3). This correctness backend does not claim GPU speedup or portable fixed ELF hashes. It is deliberately bounded, static only and scoped to the qualified CPU envelope. No ESCHER archive code, lookup arrays, CBST, update logic or source layout was read or translated for this implementation.
