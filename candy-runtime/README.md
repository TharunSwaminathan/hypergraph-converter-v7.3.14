# CANDY Runtime Companion — Scope 4C

This dependency-free Node package exposes qualified OpenMP/CUDA SSSP and CUDA hypergraph 3-edge motif backends through an authenticated loopback-only REST API.

CUDA availability requires an exact ignored local qualification record, matching binary/source/Makefile and actual toolchain/device. Motif records also bind the protected qualification commit, unchanged evidence and installed CUDA runtime. STATIC and INCREMENTAL readiness are checked independently. These unsigned operator records establish local consistency; they are not publisher attestations. Explicit CUDA requests never select a CPU or another CUDA mode as fallback.

## Trust boundary

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

Motif STATIC accepts Hypergraph/DynamicHypergraph. INCREMENTAL requires an immutable OLD DynamicHypergraph and qualified DELETE_THEN_INSERT update artifact; the unchanged trusted transport derives NEW and candidates. Results are read-only; incremental output is delta-only. The current Studio provides a committed Hypergraph and therefore enables STATIC only. Before conversion, Runtime readiness may be ready while active-graph eligibility is unavailable. Browser discovery preserves session pairing and updates graph eligibility after conversion.
