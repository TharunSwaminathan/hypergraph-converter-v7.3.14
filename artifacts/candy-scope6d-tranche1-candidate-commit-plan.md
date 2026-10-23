# Scope 6D tranche 1 candidate commit preparation

**READY TO CREATE SCOPE 6D TRANCHE 1 CANDIDATE COMMIT**

Baseline: `46ae55173407bb71683614ef212d9d4d4127ecc3`. Branch: `candy-integration-scope6d-native-optimization`. Existing engineering verdict remains PASS — SCOPE 6D TRANCHE 1 QUALIFIED FOR REVIEW.

Proposed staged paths: **1** (the actual index remains empty).

- `candy-runtime/native/hypergraph-motif-cuda-incremental/src/main.cu`

The proposed candidate is source-only. No permanent tooling is selected from the current 22 experiment scripts. Each was inspected separately: the current harness is tied to fixed artifact paths, captured baseline state/local qualified binaries or report-specific inputs; three modules are generated diagnostic outputs. Reusable repository tooling would require separate deliberate preparation. This task does not refactor them or change the qualified implementation.

## Exact native delta

Only `candy-runtime/native/hypergraph-motif-cuda-incremental/src/main.cu`: **15 insertions / 6 deletions**. STATIC source, Makefiles, historical binaries and qualification records remain unchanged. The exact Git diff follows.

```diff
diff --git a/candy-runtime/native/hypergraph-motif-cuda-incremental/src/main.cu b/candy-runtime/native/hypergraph-motif-cuda-incremental/src/main.cu
index 70b99a5..c9101e8 100644
--- a/candy-runtime/native/hypergraph-motif-cuda-incremental/src/main.cu
+++ b/candy-runtime/native/hypergraph-motif-cuda-incremental/src/main.cu
@@ -350,14 +350,23 @@ void execute(const Request &r) {
   cuda_check(cudaSetDevice(static_cast<int>(r.device)));
   cudaDeviceProp prop{};
   cuda_check(cudaGetDeviceProperties(&prop,static_cast<int>(r.device)));
-  auto old_candidates = candidates(r.old_graph), new_candidates = candidates(r.new_graph);
   auto lookup = classifier();
+  float milliseconds = 0;
+  std::array<unsigned long long,30> old_counts{}, new_counts{};
+  std::size_t old_candidate_count = 0, new_candidate_count = 0;
+  {
+    auto old_candidates = candidates(r.old_graph);
+    old_candidate_count = old_candidates.size();
 #ifdef CANDY_TEST_FAULT_ALLOCATION
-  cuda_check(cudaErrorMemoryAllocation);
+    cuda_check(cudaErrorMemoryAllocation);
 #endif
-  float milliseconds = 0;
-  auto old_counts = affected_count(r.old_graph,old_candidates,lookup,prop,milliseconds);
-  auto new_counts = affected_count(r.new_graph,new_candidates,lookup,prop,milliseconds);
+    old_counts = affected_count(r.old_graph,old_candidates,lookup,prop,milliseconds);
+  }
+  {
+    auto new_candidates = candidates(r.new_graph);
+    new_candidate_count = new_candidates.size();
+    new_counts = affected_count(r.new_graph,new_candidates,lookup,prop,milliseconds);
+  }
   std::array<std::int64_t,30> delta{};
   std::int64_t total = 0;
   for (unsigned i = 0; i < 30; ++i) {
@@ -372,7 +381,7 @@ void execute(const Request &r) {
     << "\",\"backend\":\"CUDA_INCREMENTAL\",\"mode\":\"INCREMENTAL\",\"inputGraphRef\":{\"graphId\":" << json_identity(r.graph_hex) << ",\"graphVersion\":" << r.old_version
     << "},\"outputGraphRef\":{\"graphId\":" << json_identity(r.graph_hex) << ",\"graphVersion\":" << r.new_version << "},\"updateId\":" << json_identity(r.update_hex) << ",\"requestDigest\":\"" << r.digest
     << "\",\"oldAffectedEdgeCount\":" << r.old_graph.affected.size() << ",\"newAffectedEdgeCount\":" << r.new_graph.affected.size()
-    << ",\"oldCandidateCount\":" << old_candidates.size() << ",\"newCandidateCount\":" << new_candidates.size() << ",\"oldAffectedCounts\":";
+    << ",\"oldCandidateCount\":" << old_candidate_count << ",\"newCandidateCount\":" << new_candidate_count << ",\"oldAffectedCounts\":";
   json_array(old_counts); std::cout << ",\"newAffectedCounts\":"; json_array(new_counts); std::cout << ",\"deltaCounts\":"; json_array(delta);
   std::cout << ",\"deltaTotalConnectedTriples\":" << total << ",\"cuda\":{\"deviceIndex\":" << r.device << ",\"deviceName\":\"" << escape(prop.name)
     << "\",\"computeMajor\":" << prop.major << ",\"computeMinor\":" << prop.minor << ",\"compiledArchitecture\":\"" << CANDY_QUALIFIED_ARCH
```

## Candidate identity

- Source raw SHA-256: `49373f697a3ad28866d1b9a58fb7360e9907e98892ac15cb3604588e5557325b`
- Proposed filtered Git blob (read-only hash-object; no object written/staging): `c9101e894b96e1ed9345607c10ea30f051e32dc4`
- Isolated candidate binary: `artifacts/candy-scope6d-tranche1-build/candidate`
- Isolated binary SHA-256: `c6f9a434cb79bfab58be439af61afe14060a7556a568b4c6d7d1dc4f9cdb460d`

The binary remains excluded and uninstalled. No package manifest, wire schema/protocol, parser, classifier, GPU kernel, counting helper or admission limit changed. The prefix/suffix outside execute() still match the preserved source exactly. Manifest absence/presence and hashes are recorded individually in the JSON.

## Current fail-closed boundary and preservation

Fresh ordinary verification, without injected discovery, reports CUDA_INCREMENTAL unavailable: `motif_qualification_unavailable_or_stale`. Fresh capability construction omits CUDA_INCREMENTAL and retains CUDA_STATIC. No server was started and no qualification record or installed executable was changed.

All 194 files in the final tranche inventory, 4 readiness tooling entries and 69 readiness evidence entries match recorded hashes. Historical native files/records/evidence and every local tag match the prechange snapshot. Scope 6C qualified tag remains `46ae55173407bb71683614ef212d9d4d4127ecc3`. The only prechange hash differences remain the approved main.cu implementation and the already-documented ignored NLU routing report generated by the prior test run.

## Full worktree classification

Every row has exactly one category. Git status entries are included in full, with ignored Scope6D outputs and the known changed ignored NLU report added explicitly. Unchanged ignored dependency/build trees are outside the current change inventory. Category B has zero entries; no script is presumed permanent merely because it is under scripts/.

| Category | Count | Meaning |
| --- | ---: | --- |
| A | 1 | PRODUCT/NATIVE SOURCE |
| B | 0 | PERMANENT QUALIFICATION/TEST TOOLING |
| C | 94 | ADDITIVE EVIDENCE |
| D | 177 | TEMPORARY/DIAGNOSTIC BUILD OUTPUT |
| E | 1 | UNRELATED GENERATED FILE |

## Individual script decisions

| Path | Category | Reason |
| --- | --- | --- |
| `scripts/analyze-scope6d-profiles.py` | C | One-off readiness SQLite report extraction: fixed native-profile capture/benchmark JSON inputs and exclusive-create analysis output. |
| `scripts/analyze-scope6d-tranche1-profiles.py` | D | Generated diagnostic analysis copy produced by profile-scope6d-tranche1.mjs; fixed captured databases/reference JSON and evidence destination. |
| `scripts/build-scope6d-tranche1-diagnostics.mjs` | C | Experiment evidence generator: transforms the preserved baseline/candidate into versioned diagnostic copies in the temporary build directory; not permanent build tooling. |
| `scripts/build-scope6d-tranche1.mjs` | C | One-off comparison build/evidence capture requiring the prechange baseline-main.cu artifact; also generates fixture-module text from readiness observer source. |
| `scripts/check-scope6d-tranche1-admission.mjs` | C | Experiment admission evidence generator using the fixed offline discovery fixture and mutable request file under the comparison artifact directory. |
| `scripts/check-scope6d-tranche1-fault-memcheck.mjs` | C | One-off evidence checker tied to candidate-diagnostic-v3 and an existing safety request in the isolated build directory. |
| `scripts/check-scope6d-tranche1-rss-controls.mjs` | C | Run-specific GNU-time RSS evidence capture against fixed experiment requests/binaries; output names and repeat inventory are fixed. |
| `scripts/gate-scope6d-tranche1.mjs` | C | Run-specific gate/log evidence recorder, exclusive-create named tranche logs and test-results JSON; existing repository npm/test commands remain permanent tooling. |
| `scripts/measure-scope6d-native.mjs` | C | Readiness-only observer with a fixed baseline matrix, artifact destinations and preserved qualified binary requirement; one-off benchmark capture, not a permanent repository test entry point. |
| `scripts/measure-scope6d-tranche1.mjs` | C | Fixed experiment AB/BA benchmark evidence capture using local preserved binaries and experimental discovery; not a general reusable benchmark interface. |
| `scripts/prepare-scope6d-tranche1.mjs` | C | One-time prechange snapshot: requires the exact pre-implementation baseline and empty tracked diff, saves a baseline source copy and immutable capture. |
| `scripts/profile-scope6d-native.mjs` | C | Readiness Nsight evidence collector with fixed fixture/output paths and dependency on the initial local capture log. |
| `scripts/profile-scope6d-tranche1.mjs` | C | Experiment Nsight evidence generator tied to existing build/fixture artifacts; generates a reference JSON and diagnostic analyzer copy. |
| `scripts/qualify-scope6d-tranche1-lifecycle.mjs` | C | Experiment lifecycle evidence capture requiring candidate-diagnostic-v3, generating fixed barrier wrappers and a machine-specific child helper. |
| `scripts/qualify-scope6d-tranche1-parity.mjs` | C | Experiment parity/random/taxonomy evidence capture requiring preserved local baseline and candidate binaries, fixed generated fixtures and exclusive-create result files. |
| `scripts/qualify-scope6d-tranche1-safety.mjs` | C | Experiment safety/fault/allocation/RSS evidence capture tied to diagnostic-v3 copies and fixed request/result paths. |
| `scripts/report-scope6d-readiness.mjs` | C | One-off readiness report assembler consuming fixed benchmark/profile evidence and writing exclusive-create summary/matrix outputs. |
| `scripts/report-scope6d-tranche1.mjs` | C | One-off final report/inventory assembler asserting this exact baseline, historical captures and 284-file qualification run; not a reusable product test. |
| `scripts/scope6d-tranche1-common.mjs` | C | Experiment helper module: Windows/WSL execution and fixed artifact-directory/binary/result paths; only supports the excluded one-off evidence scripts. |
| `scripts/scope6d-tranche1-fixtures.mjs` | D | Generated diagnostic fixture module extracted from the readiness observer by build-scope6d-tranche1.mjs; current artifact dependency, not independently maintained test tooling. |
| `scripts/scope6d-tranche1-offline-runtime.mjs` | C | Experiment-only discovery/Runtime helper reading local historical qualification files and selecting fixed isolated artifacts; deliberately excluded from product tooling/production binding. |
| `scripts/scope6d-tranche1-parent-fixture.mjs` | D | Generated parent-death diagnostic helper embeds this machine absolute path to the isolated NEW barrier wrapper; temporary output. |

## Complete proposed/excluded path inventory

C includes one-off evidence-generation scripts and captured qualification records/logs. D contains raw diagnostic/build outputs, packed temporary workspaces and generated helper copies. Preserve all locally; none is in the proposed commit. Full path hashes and reasons are in the companion JSON.

| Path | Git status | Category | Proposed |
| --- | --- | --- | --- |
| `artifacts/candy-scope6d-native-benchmark-before.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-benchmark-matrix.md` | `??` | C | NO |
| `artifacts/candy-scope6d-native-benchmark-run.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-native-benchmark-summary.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-bottleneck-map.md` | `??` | C | NO |
| `artifacts/candy-scope6d-native-final-inventory.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-fixtures/B-high-cardinality.request` | `??` | C | NO |
| `artifacts/candy-scope6d-native-fixtures/E-open-wedges.request` | `??` | C | NO |
| `artifacts/candy-scope6d-native-fixtures/F-closed-triangles.request` | `??` | C | NO |
| `artifacts/candy-scope6d-native-fixtures/G-local-near-216.request` | `??` | C | NO |
| `artifacts/candy-scope6d-native-fixtures/H-full-replace-216.request` | `??` | C | NO |
| `artifacts/candy-scope6d-native-fixtures/I-work-64-inc-2560.request` | `??` | C | NO |
| `artifacts/candy-scope6d-native-host-rss.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-implementation-plan.md` | `??` | C | NO |
| `artifacts/candy-scope6d-native-prechange-inventory.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-profile-analysis.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-profile-captures.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-profiles/B-high-cardinality_cuda_api_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/B-high-cardinality_cuda_gpu_kern_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/B-high-cardinality_cuda_gpu_mem_size_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/B-high-cardinality_cuda_gpu_mem_time_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/B-high-cardinality-capture.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-native-profiles/B-high-cardinality-rss-0.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-profiles/B-high-cardinality-rss-1.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-profiles/B-high-cardinality-rss-2.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-profiles/B-high-cardinality-stats.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-native-profiles/B-high-cardinality.nsys-rep` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/B-high-cardinality.sqlite` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/E-open-wedges_cuda_api_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/E-open-wedges_cuda_gpu_kern_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/E-open-wedges_cuda_gpu_mem_size_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/E-open-wedges_cuda_gpu_mem_time_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/E-open-wedges-capture.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-native-profiles/E-open-wedges-stats.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-native-profiles/E-open-wedges.nsys-rep` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/E-open-wedges.sqlite` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/G-local-near-216_cuda_api_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/G-local-near-216_cuda_gpu_kern_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/G-local-near-216_cuda_gpu_mem_size_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/G-local-near-216_cuda_gpu_mem_time_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/G-local-near-216-capture.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-native-profiles/G-local-near-216-rss-0.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-profiles/G-local-near-216-rss-1.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-profiles/G-local-near-216-rss-2.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-profiles/G-local-near-216-stats.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-native-profiles/G-local-near-216.nsys-rep` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/G-local-near-216.sqlite` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/H-full-replace-216_cuda_api_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/H-full-replace-216_cuda_gpu_kern_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/H-full-replace-216_cuda_gpu_mem_size_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/H-full-replace-216_cuda_gpu_mem_time_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/H-full-replace-216-capture.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-native-profiles/H-full-replace-216-rss-0.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-profiles/H-full-replace-216-rss-1.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-profiles/H-full-replace-216-rss-2.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-profiles/H-full-replace-216-stats.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-native-profiles/H-full-replace-216.nsys-rep` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/H-full-replace-216.sqlite` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/I-work-64-inc-2560_cuda_api_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/I-work-64-inc-2560_cuda_gpu_kern_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/I-work-64-inc-2560_cuda_gpu_mem_size_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/I-work-64-inc-2560_cuda_gpu_mem_time_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/I-work-64-inc-2560-capture.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-native-profiles/I-work-64-inc-2560-stats.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-native-profiles/I-work-64-inc-2560.nsys-rep` | `??` | D | NO |
| `artifacts/candy-scope6d-native-profiles/I-work-64-inc-2560.sqlite` | `??` | D | NO |
| `artifacts/candy-scope6d-native-readiness.md` | `??` | C | NO |
| `artifacts/candy-scope6d-native-risk-register.json` | `??` | C | NO |
| `artifacts/candy-scope6d-native-verification.json` | `??` | C | NO |
| `artifacts/candy-scope6d-scope6c-preservation-tests.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-admission-matrix.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-admission-run.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-boundaries.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-build.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-build/A-many-small.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/B-high-cardinality.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/barrier-BETWEEN` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/barrier-NEW` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/barrier-OLD` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/baseline-diagnostic` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/baseline-diagnostic-v2` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/baseline-diagnostic-v2.cu` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/baseline-diagnostic-v3` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/baseline-diagnostic-v3.cu` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/baseline-diagnostic.cu` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/baseline-main.cu` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/boundary.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/C-sparse-overlap.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/candidate` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/candidate-diagnostic` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/candidate-diagnostic-v2` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/candidate-diagnostic-v2.cu` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/candidate-diagnostic-v3` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/candidate-diagnostic-v3.cu` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/candidate-diagnostic.cu` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/D-dense-overlap.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/E-open-wedges.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/F-closed-triangles.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/G-local-128.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/G-local-near-216.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/H-full-replace-216.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/H-high-impact-128.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/I-edge-216-inc-217.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/I-incidence-cardinality-100000.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/I-incremental-inserted-100000.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/I-work-64-inc-2560.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/R0-incremental.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/R0-static.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/R1-incremental.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/R1-static.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/R2-incremental.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/R2-static.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/R3-incremental.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/R3-static.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/R4-incremental.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/R4-static.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/R5-incremental.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/R5-static.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/R6-incremental.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/R6-static.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/R7-incremental.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/R7-static.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/request.txt` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-B-high-cardinality-0-baseline.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-B-high-cardinality-0-candidate.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-B-high-cardinality-1-baseline.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-B-high-cardinality-1-candidate.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-B-high-cardinality-2-baseline.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-B-high-cardinality-2-candidate.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-G-local-near-216-0-baseline.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-G-local-near-216-0-candidate.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-G-local-near-216-1-baseline.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-G-local-near-216-1-candidate.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-G-local-near-216-2-baseline.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-G-local-near-216-2-candidate.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-H-full-replace-216-0-baseline.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-H-full-replace-216-0-candidate.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-H-full-replace-216-1-baseline.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-H-full-replace-216-1-candidate.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-H-full-replace-216-2-baseline.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-H-full-replace-216-2-candidate.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-H-high-impact-128-0-baseline.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-H-high-impact-128-0-candidate.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-H-high-impact-128-1-baseline.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-H-high-impact-128-1-candidate.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-H-high-impact-128-2-baseline.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-H-high-impact-128-2-candidate.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-I-work-64-inc-2560-0-baseline.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-I-work-64-inc-2560-0-candidate.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-I-work-64-inc-2560-1-baseline.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-I-work-64-inc-2560-1-candidate.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-I-work-64-inc-2560-2-baseline.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/rss-I-work-64-inc-2560-2-candidate.json` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/safety-B-high-cardinality.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/safety-C-sparse-overlap.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/safety-D-dense-overlap.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/safety-G-local-near-216.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/safety-H-high-impact-128.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/safety-zero-candidate.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-build/static-boundary.request` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-candidate-commit-plan.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-candidate-commit-plan.md` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-diagnostic-builds-v2.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-diagnostic-builds-v3.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-diagnostic-builds.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-fault-memcheck-run.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-fault-memcheck.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-faults.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-final-inventory.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-gate-audit.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-gate-build-github.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-gate-build.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-gate-lint.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-gate-run.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-gate-scope6c.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-gate-test.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-implementation-report.md` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-lifecycle-run.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-lifecycle.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-memory.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-parity-resume.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-parity-run.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-parity.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-performance-run.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-performance.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-prechange.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-profile-analysis.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-profile-captures.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-profile-reference.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-profile-run.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-profiles/B-high-cardinality_cuda_api_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/B-high-cardinality_cuda_gpu_kern_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/B-high-cardinality_cuda_gpu_mem_size_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/B-high-cardinality_cuda_gpu_mem_time_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/B-high-cardinality-capture.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/B-high-cardinality-stats.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/B-high-cardinality.nsys-rep` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/B-high-cardinality.sqlite` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/G-local-near-216_cuda_api_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/G-local-near-216_cuda_gpu_kern_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/G-local-near-216_cuda_gpu_mem_size_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/G-local-near-216_cuda_gpu_mem_time_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/G-local-near-216-capture.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/G-local-near-216-stats.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/G-local-near-216.nsys-rep` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/G-local-near-216.sqlite` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/H-full-replace-216_cuda_api_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/H-full-replace-216_cuda_gpu_kern_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/H-full-replace-216_cuda_gpu_mem_size_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/H-full-replace-216_cuda_gpu_mem_time_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/H-full-replace-216-capture.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/H-full-replace-216-stats.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/H-full-replace-216.nsys-rep` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/H-full-replace-216.sqlite` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/H-high-impact-128_cuda_api_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/H-high-impact-128_cuda_gpu_kern_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/H-high-impact-128_cuda_gpu_mem_size_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/H-high-impact-128_cuda_gpu_mem_time_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/H-high-impact-128-capture.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/H-high-impact-128-stats.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/H-high-impact-128.nsys-rep` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/H-high-impact-128.sqlite` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/I-work-64-inc-2560_cuda_api_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/I-work-64-inc-2560_cuda_gpu_kern_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/I-work-64-inc-2560_cuda_gpu_mem_size_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/I-work-64-inc-2560_cuda_gpu_mem_time_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/I-work-64-inc-2560-capture.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/I-work-64-inc-2560-stats.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/I-work-64-inc-2560.nsys-rep` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/I-work-64-inc-2560.sqlite` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/zero-candidate_cuda_api_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/zero-candidate_cuda_gpu_kern_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/zero-candidate_cuda_gpu_mem_size_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/zero-candidate_cuda_gpu_mem_time_sum.csv` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/zero-candidate-capture.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/zero-candidate-stats.log` | `!!` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/zero-candidate.nsys-rep` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-profiles/zero-candidate.sqlite` | `??` | D | NO |
| `artifacts/candy-scope6d-tranche1-randomized.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-rss-controls-run.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-rss-controls.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-safety-resume.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-safety-run.log` | `!!` | C | NO |
| `artifacts/candy-scope6d-tranche1-sanitizers.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-scope6c-preservation.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-security-review.md` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-source-diff.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-taxonomy.json` | `??` | C | NO |
| `artifacts/candy-scope6d-tranche1-test-results.json` | `??` | C | NO |
| `artifacts/deterministic-nlu-integrated-routing-report.json` | `!!` | E | NO |
| `candy-runtime/native/hypergraph-motif-cuda-incremental/src/main.cu` | ` M` | A | YES |
| `scripts/analyze-scope6d-profiles.py` | `??` | C | NO |
| `scripts/analyze-scope6d-tranche1-profiles.py` | `??` | D | NO |
| `scripts/build-scope6d-tranche1-diagnostics.mjs` | `??` | C | NO |
| `scripts/build-scope6d-tranche1.mjs` | `??` | C | NO |
| `scripts/check-scope6d-tranche1-admission.mjs` | `??` | C | NO |
| `scripts/check-scope6d-tranche1-fault-memcheck.mjs` | `??` | C | NO |
| `scripts/check-scope6d-tranche1-rss-controls.mjs` | `??` | C | NO |
| `scripts/gate-scope6d-tranche1.mjs` | `??` | C | NO |
| `scripts/measure-scope6d-native.mjs` | `??` | C | NO |
| `scripts/measure-scope6d-tranche1.mjs` | `??` | C | NO |
| `scripts/prepare-scope6d-tranche1.mjs` | `??` | C | NO |
| `scripts/profile-scope6d-native.mjs` | `??` | C | NO |
| `scripts/profile-scope6d-tranche1.mjs` | `??` | C | NO |
| `scripts/qualify-scope6d-tranche1-lifecycle.mjs` | `??` | C | NO |
| `scripts/qualify-scope6d-tranche1-parity.mjs` | `??` | C | NO |
| `scripts/qualify-scope6d-tranche1-safety.mjs` | `??` | C | NO |
| `scripts/report-scope6d-readiness.mjs` | `??` | C | NO |
| `scripts/report-scope6d-tranche1.mjs` | `??` | C | NO |
| `scripts/scope6d-tranche1-common.mjs` | `??` | C | NO |
| `scripts/scope6d-tranche1-fixtures.mjs` | `??` | D | NO |
| `scripts/scope6d-tranche1-offline-runtime.mjs` | `??` | C | NO |
| `scripts/scope6d-tranche1-parent-fixture.mjs` | `??` | D | NO |

## Stop boundary

No git add, commit, push, tag, merge, main modification, installation, production qualification update/binding or tranche 2 work occurred. Source/test bytes have not changed, so prior tests/performance were retained after hash verification. This preparation does not alter the existing engineering verdict.

Only the two additive candidate-commit-plan files were created by this task. Stop here for human review.
