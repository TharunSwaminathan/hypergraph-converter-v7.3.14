# CANDY integration Scope 2 Phase C implementation report

## Result and protected boundary

**PASS.** Phase C1–C3 was implemented and independently audited from protected commit `54c134f30d1bbe50019c17437d9ad5ff58d16530` on branch `candy-integration-scope2`. The work remains uncommitted. Tags and protected commits were not changed. CUDA, ESCHER, projection creation, adaptive selection, MOSP product integration, PageRank, SCC, coloring, HPC, Slurm, MCP, Python wrappers, gRPC, Docker, databases, public/remote execution, cloud APIs, and model weights were not started.

## C1 — authenticated loopback runtime and capability discovery

The dependency-free `candy-runtime` package uses Node's built-in HTTP, crypto, filesystem, and child-process APIs. It binds only `127.0.0.1` (default port 8791); `0.0.0.0` is rejected. A cryptographically random per-launch bearer credential protects every route except bounded health. Browser origins are matched exactly and private-network preflight is explicit; CORS is not authentication. The CLI writes the credential to a mode-restricted per-process OS-temporary file and removes it on controlled shutdown without printing the value.

Health and capability contracts are versioned. Unknown schema versions fail closed. The runtime advertises only the fixed qualified `SSSP` + `LOCAL_OPENMP` capability when its binary exists, including accepted graph types/modes, integer weight model, limits, adapter version, WSL/Linux execution boundary, and build SHA-256. The browser intersects this with a compiled frontend registry, pairing state, and active graph type. Runtime declarations cannot invent frontend/model tools.

## C2 — immutable artifacts, jobs, and native process boundary

Artifacts use immutable `sha256:<lowercase digest>` IDs, a companion-owned private root, fixed media types, exact byte limits, regular-file/symlink checks, and no caller paths. Jobs use random UUIDs and authoritative queued/preparing/running/validating/completed or failed/cancelling/cancelled states. Equivalent live submissions return the existing job rather than replaying execution.

The job engine reuses the qualified Scope 1 graph/request/update/result contracts and deterministic CSR mapping. `Hypergraph`/`DynamicHypergraph` fails before artifact preparation or native launch. STATIC forbids prior state; INCREMENTAL/COMPARE require exact prior-property and update artifacts. The native runner selects one fixed repository binary, uses fixed arguments and a server-owned per-job directory, calls `spawn` with `shell:false`, bounds stdout/stderr and time, and terminates only its owned child on cancellation/timeout. HTTP/model arguments cannot select an executable, path, flag, environment, shell, PID, or command. Windows launches the qualified Linux executable through WSL2. Native exit is not success until schema, job/graph/mode/source identity, vector shape, process status, and the Scope 1 result contract pass.

Real authenticated loopback integration completed STATIC SSSP with three reachable vertices and INCREMENTAL SSSP with one affected vertex through WSL2/OpenMP. Stale property state returns `STALE_PROPERTY_STATE`. Malformed output, non-zero exit/crash, output flood, timeout, cancellation, and forced COMPARE mismatch remain truthful structured failures. Completed full vectors exist only in immutable result artifacts; status and model observations are bounded.

## C3 — frontend, ReAct, confirmation, and semantic safety

`VITE_CANDY_RUNTIME_ENABLED=true` enables Mode B; the default build remains Mode A. The additive client centralizes loopback URL validation, session credential, schemas, artifacts, jobs, cancellation, and results. The Advanced panel exposes pairing/discovery and bounded job truth. Five strict product actions exist: `DISCOVER_CANDY_CAPABILITIES`, `SUBMIT_CANDY_JOB`, `GET_CANDY_JOB_STATUS`, `CANCEL_CANDY_JOB`, and `OPEN_CANDY_RESULT`. No shell/process primitive exists. Submission stops the model loop. Later status/result requests re-observe authoritative companion state.

Resource confirmation applies to COMPARE, more than 8 threads, timeout above 30 seconds, more than 100,000 vertices, or more than 500,000 edges. The confirmation binding covers algorithm, backend, mode, source, threads, timeout, graph ID, and graph version; argument or version changes invalidate it. SSSP results are analytic and never mutate the graph.

The Studio's committed graph is explicitly a `Hypergraph`. It is never reinterpreted as an ordinary graph and no projection helper is imported or invoked. SSSP accepts `OrdinaryGraph`, `DynamicOrdinaryGraph`, or a validated `ProjectedOrdinaryGraph`; it rejects `Hypergraph` and `DynamicHypergraph` with `INVALID_GRAPH_TYPE` before artifact/native work. The deterministic CANDY explanation guard derives this type set from the qualified Scope 1 contract. It answers active-graph read-only/hypothetical/quoted SSSP questions before model generation and performs no job, confirmation, mutation, or projection.

## Corrective findings and closure

- **C3-C01 Critical — React hook order:** the initial integration placed `useCandyRuntime` behind an existing AppCore conditional return. Graph availability could therefore change hook order. The hook now runs in AppCore's unconditional hook sequence and handles disabled state internally. A focused source regression, real none-to-loaded graph transition, and reload pass with no React console errors/warnings.
- **C3-H01 High — qwen semantic explanation:** qwen3:8b initially misidentified SSSP and implied Hypergraph traversal. Execution safety remained fail-closed and no action occurred, but the explanation was unsafe. Active-graph SSSP explanation and Hypergraph rejection now use deterministic contract-derived semantics ahead of the model. Live browser retest states the ordinary-graph requirement, active Hypergraph, and no implicit projection.
- **C3-H03 High — qwen typed-submit argument compatibility:** the first focused final qwen run selected the correct submit action but omitted required `threads` and `timeoutMs`; strict validation rejected it and nothing executed. The prompt now includes a compiled bounded argument contract/defaults for `SUBMIT_CANDY_JOB`. The repeated run passed with zero schema failures and no additional authority.
- **C3-H02 High — CANDY action-family authorization:** the initial adapter used one broad verb regex for submit and cancel. A wrong model action could borrow a positive verb from the other family. The final boundary now requires positive authorization, CANDY/job topic context, and the exact submit or cancel verb family. Negated, unrelated, and cross-family tests fail closed.

## Qualification evidence

- C1/C2/C3 focused application tests: 5/5 pass.
- Existing bounded ReAct suites: 3/3 pass.
- Full application suite: **236/236 files passed in 100.2 seconds** on the final source with bundled Python on PATH.
- Live qwen3:8b: model present in the real local Ollama runtime. Three model calls produced validated `SUBMIT_CANDY_JOB`, `GET_CANDY_JOB_STATUS`, and `CANCEL_CANDY_JOB`; two Hypergraph cases bypassed the model deterministically; final schema failures 0; fallback count 0.
- Native normal: 12/12 fixtures, 40/40 fixed-seed stress, malformed input, stale graph/property state, forced mismatch, and native Hypergraph rejection pass.
- Native ASan/UBSan: the same full gate passes. TSan was not run or claimed.
- Authenticated companion/native: real STATIC and INCREMENTAL jobs pass through loopback HTTP and WSL2/OpenMP.
- Browser Mode A: companion absent, Studio usable, bounded unavailable notice, no hook errors.
- Browser Mode B: authenticated pair/discover, graph load, explicit Hypergraph, no SSSP capability, deterministic explanation/rejection, refresh without fabricated authority, zero console warnings/errors.
- Ordinary-graph browser UI execution was not claimed because this Studio exposes no ordinary-graph import/projection workflow. The compatible path is qualified by frontend intersection tests, live qwen typed-action validation, and the real companion/native harness.
- Lint: pass.
- Production build: pass; Vite 8.0.16, 240 modules. Existing large-chunk advisory only.
- GitHub Pages build: pass; 240 modules. Existing large-chunk advisory only.
- `npm audit --omit=dev`: 0 vulnerabilities (sandbox registry failure retried through approved read-only network access).
- `git diff --check`: pass after final cleanup.

## Dependencies and accepted limitations

No dependency or package version changed; only a root npm launcher script was added. `candy-runtime/package.json` declares no dependencies.

Accepted Low limitations: the current Studio intentionally has no ordinary-graph import/projection UI; runtime state is session/in-memory rather than database-backed; an uncontrolled process kill may leave the OS-temporary pairing file until normal temporary cleanup; Windows native execution requires the existing WSL2/toolchain boundary; the pre-existing production bundle remains above Vite's advisory chunk threshold. These do not weaken the fail-closed graph-type, auth, artifact, process, or model/controller boundaries.

## Complete changed/new file manifest

### A. C1 runtime/auth/capability source

- `candy-runtime/package.json`
- `candy-runtime/README.md`
- `candy-runtime/src/config.js`
- `candy-runtime/src/auth/sessionAuth.js`
- `candy-runtime/src/http/httpUtils.js`
- `candy-runtime/src/capabilities/capabilityRegistry.js`
- `candy-runtime/src/server.js`
- `candy-runtime/src/cli.js`
- `run-candy-runtime.bat`
- `run-candy-runtime.sh`

### B. C1 tests/evidence

- `tests/candy-scope2-runtime-foundation.test.mjs`
- `artifacts/candy-scope2-phaseC1-audit-report.md`
- `artifacts/candy-scope2-phaseC1-issue-register.json`

### C. C2 artifact/job/native-adapter source

- `candy-runtime/src/artifacts/artifactStore.js`
- `candy-runtime/src/backends/nativeRequestAdapter.js`
- `candy-runtime/src/backends/nativeProcessRunner.js`
- `candy-runtime/src/jobs/jobManager.js`

### D. C2 tests/evidence

- `candy-runtime/test/run-companion-native-qualification.mjs`
- `tests/candy-scope2-job-engine.test.mjs`
- `tests/candy-scope2-job-failure-matrix.test.mjs`
- `tests/candy-scope2-incremental-job.test.mjs`
- `artifacts/candy-scope2-phaseC2-audit-report.md`
- `artifacts/candy-scope2-phaseC2-issue-register.json`

### E. C3 frontend/controller source

- `src/candy/featureFlag.js`
- `src/candy/client.js`
- `src/candy/capabilityDiscovery.js`
- `src/candy/requestPolicy.js`
- `src/candy/resultObservation.js`
- `src/candy/useCandyRuntime.js`
- `src/candy/deterministicRouting.js`
- `src/components/CandyRuntimePanel.jsx`
- `src/components/AgentChatPanel.jsx`
- `src/components/AgentChatPanel.css`
- `src/App.jsx`
- `src/agent/confirmationPolicy.js`
- `src/agent/candyActionAuthorization.js`
- `src/agent/orchestratorCapabilities.js`
- `src/agent/orchestratorLoop.js`
- `src/agent/orchestratorObservation.js`
- `src/agent/prompts/reactOrchestratorPrompt.js`

### F. C3 tests/evidence

- `tests/candy-scope2-frontend-react.test.mjs`
- `scripts/run-candy-scope2-live-qwen.mjs`
- `artifacts/candy-scope2-live-qwen-qualification.json`
- `artifacts/candy-scope2-browser-qualification.json`
- `artifacts/candy-scope2-phaseC3-audit-report.md`
- `artifacts/candy-scope2-phaseC3-issue-register.json`

### G. Final integration/configuration/evidence

- `README.md`
- `package.json`
- `eslint.config.js`
- `artifacts/candy-scope2-implementation-report.md`

### H. Temporary/debug/generated debris

None retained. Browser pairing state was cleared, the agent-created browser tab and servers were closed, companion/job/artifact temporary directories were removed, and `dist` plus native/sanitizer build outputs were removed after qualification.
