# CANDY integration Scope 3 implementation report

## Overall result

**PASS.** Scope 3 CUDA incremental SSSP parity and multi-backend runtime integration completed on branch `candy-integration-scope3-cuda` without committing, tagging, pushing, merging, or moving protected references. The protected Scope 2 baseline is `50a9ae227dd965aa6b8de2b352b1d0f91b3dd5c3`; the preserved environment-blocked checkpoint/tag is `81491e4a04b4d33adb3ebd0679cbe196ce109288` / `candy-integration-scope3-cuda-env-blocked`.

## Progression and environment

The historical sequence is preserved: candidate implementation -> environment blocker -> immutable blocked checkpoint -> CUDA toolkit availability -> independent `sm_120` smoke and memcheck PASS -> first candidate build without candidate source correction -> S3B harness/candidate/tool-output corrections -> native parity/sanitizer qualification -> S3C integration -> live-qwen fail-closed schema corrections -> authenticated companion PASS -> browser truthfulness correction -> final qualification.

Qualified environment: Ubuntu 26.04 LTS under WSL2, NVIDIA GeForce RTX 5060, compute capability 12.0, 8151 MiB, driver 616.92, CUDA 13.4, nvcc 13.4.59, Compute Sanitizer 2026.3.0.0, g++ 15.2.0, GNU Make 4.4.1. Independent smoke emitted `CUDA_SMOKE_PASS`; independent memcheck reported zero errors. The first real candidate build compiled for `sm_120` without an implementation fix. Clean NVCC links were observed to have different ELF hashes; no reproducible-binary claim is made.

## Native qualification

- Supported CUDA modes: `INCREMENTAL`, `COMPARE`. CUDA `STATIC` is explicitly not implemented and is rejected.
- 12/12 deterministic fixture families and 40/40 fixed-seed (`0x5eed1234`) stress cases passed.
- CUDA, OpenMP, and independent static-reference distances matched exactly; both native parent trees validated.
- Zero-weight cycles and equal-cost alternatives passed.
- 18/18 failure cases passed, including invalid device, malformed request/CSR/update, stale graph/property state, negative weights, resource limits, Hypergraph, forbidden CUDA STATIC, bounded output, memory preflight, allocation/launch/sync/nonconvergence faults, forced mismatch, and missing request.
- Memcheck found zero real production errors. Racecheck found zero applicable hazards. Initcheck and synccheck passed where applicable. The intentionally invalid-launch fault is classified as qualification-only misuse and is not a production-candidate sanitizer failure.
- Final OpenMP regression remains green: 12 fixtures, 40 stress cases, malformed input, stale state, forced mismatch, and native Hypergraph rejection.

## Runtime, capability, and semantic boundary

`SSSP` remains the product action. `LOCAL_OPENMP` and `LOCAL_CUDA` are explicit backend choices; there is no CUDA model action, generic shell, executable selector, kernel selector, launch-geometry selector, compiler flag, or environment injection. OpenMP uses `threads`; CUDA requires a discovered `deviceId` and forbids `threads`. CUDA submission always requires confirmation, and the confirmation hash binds backend, device, timeout, graph identity/version, property-state version, and update batch. Explicit CUDA never falls back to OpenMP.

Hypergraph input fails `INVALID_GRAPH_TYPE` before native work. There is no implicit projection. The browser model/action set is the strict intersection of the compiled frontend registry, authenticated runtime declaration, exact local qualification, active graph type, mode, and existing confirmation policy.

## Machine-local qualification authority

Binary presence never activates CUDA. The permanent writer `candy-runtime/test/write-cuda-qualified-attestation.mjs` creates ignored machine-local state only after an explicit qualification invocation. `candy-runtime/.local/cuda-qualified-build.json` binds the exact current ELF hash, CUDA source hash, Makefile hash, `sm_120`, nvcc 13.4.59, GPU ID/name/memory/compute capability, and completed fixture/stress/sanitizer summary. Startup recomputes and probes every binding. Missing, malformed, copied, stale, rebuilt, source-mismatched, toolchain-mismatched, or device-mismatched state fails closed. The exact attestation and native binaries are excluded from portable source.

## Authenticated companion and local model

The real authenticated loopback companion reached `queued -> preparing -> running -> validating -> completed` through Windows -> WSL2 -> RTX 5060. Repeated status remained completed; pre-launch cancellation was idempotent; 1 ms timeout returned `PROCESS_TIMEOUT`; cancellation after completion preserved completion; Hypergraph returned `INVALID_GRAPH_TYPE`; no child remained. In-GPU cancellation was not forced because the qualified job completes faster than a reliable external observation window.

The first qwen3:8b CUDA attempt safely failed validation after reusing OpenMP `threads` and omitting `deviceId`. A later requalification attempt also safely failed on invalid `deviceId`/`timeoutMs`. Neither executed an action. After narrow prompt/temperature hardening, the final local run passed four model calls: two typed CUDA submissions, status and cancellation through existing actions, three deterministic bypasses, zero schema failures, zero fallbacks, and no shell/path/kernel fields.

## Browser truthfulness

The browser audit found that graph compatibility filtering hid qualified runtime backends when there was no compatible graph. This was a real Medium presentation/truthfulness finding; execution safety was not bypassed because the model/action intersection was already empty. The panel now separately displays runtime-qualified backends/devices and backends executable for the active graph.

Real browser requalification passed:

- Mode A: companion absent, bounded unavailable message, Studio usable, no console warnings/errors.
- Mode B/no graph: authenticated runtime displayed `LOCAL_OPENMP`, `LOCAL_CUDA`, and the RTX device; executable set remained empty.
- Mode B/Hypergraph: runtime qualification stayed visible; active type was Hypergraph; executable set was empty; no implicit projection.
- Reload: state returned to `not_discovered` and fabricated no authority; explicit rediscovery restored the truthful runtime-only view; console remained clean.

No ordinary-graph browser execution is claimed because the Studio does not expose an authoritative ordinary-graph import/projection UI in this scope.

## Final gates and limits

Full application tests: 240/240 files PASS. Lint PASS. Production and GitHub Pages builds PASS with 241 transformed modules and the pre-existing large-chunk advisory. `npm audit --omit=dev`: zero vulnerabilities. `git diff --check`: PASS. S3B and S3C open Critical: 0; open High: 0.

No npm dependency/version, Python wrapper, PyCUDA, CuPy, gRPC, MCP, Docker, database, cloud SDK, public endpoint, cloud model, API key, bundled weight, adaptive selector, MOSP product, ESCHER integration, or projection workflow was added. CUDA Toolkit 13.4 is an external local prerequisite. Accepted limitations: exact CUDA attestation is intentionally machine-local; in-kernel cancellation was not forced; the production/GitHub bundles retain the existing size advisory; ordinary-graph browser execution was not claimed.
