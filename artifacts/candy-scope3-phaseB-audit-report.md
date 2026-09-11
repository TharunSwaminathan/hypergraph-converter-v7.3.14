# CANDY Scope 3 Phase S3B audit

## Result

**CUDA SOURCE PREPARATION COMPLETE / RUNTIME QUALIFICATION BLOCKED BY ENVIRONMENT.** This is not a Phase S3B PASS. Open code Critical: 0. Open code High: 0. One environment blocker remains.

## Provenance and clean-room boundary

The supplied `MOSP-CUDA-main.zip` has SHA-256 `290c2670b5c037bbcf595e5058250a6097d99dbcc8df714e9ce932e62c26edcf` and contains no LICENSE, COPYING, NOTICE, or equivalent file. It was inspected as research/reference input only. No upstream source was copied wholesale. The independently authored candidate and inspected-file/conceptual correspondence are recorded in `candy-runtime/native/upstream/MOSP-CUDA-PROVENANCE.md`.

## Static source review

- Strict invocation: exactly `--request <server-owned-request-path>`; no caller output path, environment, compiler flags, shell, or generic executable.
- Strict contract: `CANDY_SSSP_CUDA_REQUEST_V1`, `LOCAL_CUDA`, and `INCREMENTAL`/`COMPARE` only. `STATIC` is explicitly rejected.
- Type safety: only ordinary graph families are accepted; projected input requires a deterministic SHA-256 provenance ID; Hypergraph is rejected without projection.
- Semantics: deterministic CSR, non-negative INT32 weights, exact graph/state versions, prior distance/parent validation, delete-then-insert ordering, and reject-on-duplicate/conflict behavior.
- Memory: bounded vertices/edges/request bytes, checked multiplication and addition, device-memory query, conservative 75% free-memory ceiling, and cleanup ownership.
- CUDA calls: device discovery/selection/properties, memory discovery/allocation/transfers/reset, launch error, synchronization, result transfer, and success-path frees are checked. Failures return structured non-zero results.
- Kernel: edge index is bounds-checked; distances use atomic load/min and a bounded convergence loop. There is no caller frontier or counter capacity. Parent trees are reconstructed deterministically on the host from tight edges and validated as source-rooted.
- Correctness oracle: every candidate success requires exact distance equality with an independent host Dijkstra pass. That host pass is not called CUDA STATIC.
- Fault gates: compile-time-only memory-refusal and launch-failure paths exist; runtime callers cannot enable them.
- Build: `CUDA_ARCH` is mandatory trusted configuration; no `sm_70` or other architecture default exists.
- Scope: no MOSP product, Pareto logic, combined graph, generators, ESCHER, projection workflow, or other algorithm was added.

The candidate source SHA-256 is `18c71bb883c58e7771ed2ee467aaa9419c3b6c75dbd01a59d56c19a1d4cf6630`; Makefile SHA-256 is `0f3358490e59685b8e2bcf17951a8a3a3b82914d01ee87603dfcec8d6a59185a`.

## Unexecuted qualification matrix

CUDA build, deterministic fixtures, fixed-seed stress, zero-weight/equal-cost execution, OpenMP/CUDA/reference equality, parent-tree runtime validation, forced CUDA failures, invalid device execution, memory refusal, cancellation/timeout, and Compute Sanitizer are all **NOT RUN** because `nvcc` and the toolkit are unavailable. No result hashes or runtime claims were fabricated.

The existing OpenMP qualification was independently rerun and passed 12 fixtures, 40 fixed-seed stress cases, stale-state rejection, forced comparison mismatch, malformed input, and native Hypergraph rejection.
