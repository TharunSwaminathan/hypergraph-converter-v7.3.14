# CANDY Runtime Companion — Scope 4C

This dependency-free Node package exposes qualified OpenMP/CUDA SSSP and CUDA hypergraph 3-edge motif backends through an authenticated loopback-only REST API.

CUDA availability requires an exact ignored local qualification record, matching binary/source/Makefile and actual toolchain/device. Motif records also bind the protected qualification commit, unchanged evidence and installed CUDA runtime. STATIC and INCREMENTAL readiness are checked independently. These unsigned operator records establish local consistency; they are not publisher attestations. Explicit CUDA requests never select a CPU or another CUDA mode as fallback.

## Trust boundary

Portable source is browser-only: native `build`, Runtime `.local`, Git and
repository-root qualification evidence are excluded. Production source under
`candy-runtime/src/artifacts` is included. The extracted Runtime can start with
`npm run candy:runtime`; health and authenticated capability discovery work
without granting native qualification. Extracted qualified CUDA must be unavailable;
the qualification verifier remains unchanged. See the additive
[Scope 6A release contract](../docs/CANDY_SCOPE6A_RELEASE_CONTRACT.md) for actual
bounds, provenance, exact-byte policy and future standalone-release work.

- Default and only permitted bind host: `127.0.0.1`; default port: `8791`.
- `GET /v1/health` is non-sensitive and unauthenticated.
- All capability, artifact, job, cancellation, and result routes require `Authorization: Bearer <session token>`.
- Browser origins are matched exactly against the allowlist in `src/config.js`.
- Artifacts are content-addressed (`sha256:<lowercase digest>`) and stored under a companion-owned temporary root.
- Executables use fixed paths under `native/sssp-openmp`, `native/sssp-cuda`, `native/hypergraph-motif-cuda`, and `native/hypergraph-motif-cuda-incremental`. Windows execution uses Ubuntu WSL, a fixed supervisor acknowledgment and a dedicated Linux process group for cancellation/timeout.
- Native stdout/stderr, request bodies, artifacts, results, timeouts, graph sizes, updates, and retained jobs are bounded.

## API

`GET /v1/health`, `GET /v1/capabilities`, `POST /v1/artifacts`, `GET /v1/artifacts/:id/metadata`, `POST /v1/jobs`, `GET /v1/jobs/:id`, `POST /v1/jobs/:id/cancel`, and `GET /v1/jobs/:id/result`.

Unknown routes, schemas, algorithms, backends, graph types, and IDs fail closed. There is no shell, exec, filesystem-path, arbitrary proxy, or environment endpoint.

Run from the repository root with `npm run candy:runtime`. Stop with Ctrl+C so the temporary credential and companion-owned artifact directory are removed.

The current Studio supports committed Hypergraph and DynamicHypergraph graphs.
STATIC current-count analysis uses CUDA_STATIC when qualified. Validated
DynamicHypergraph pending-update delta analysis uses CUDA_INCREMENTAL when
qualified, with an immutable OLD graph and DELETE_THEN_INSERT update; the trusted
transport derives NEW and candidates. Incremental results are read-only and
delta-only. Analyze and Apply require separate actions and confirmations; Apply
never derives authority from an analysis result. There is no CPU fallback,
STATIC fallback for incremental analysis, or implicit projection. Before
conversion, Runtime readiness may be ready while active-graph eligibility is
unavailable. Browser discovery preserves session pairing and updates graph
eligibility after conversion.

Public GitHub Actions exercise CPU release gates and do not establish GPU
qualification. Live GPU qualification requires the matching trusted local
environment. Current motif limits remain those in the Scope 6A release contract;
this source release makes no large native-scale claim.
