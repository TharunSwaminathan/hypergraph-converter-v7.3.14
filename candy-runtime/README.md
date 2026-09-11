# CANDY Runtime Companion — Scope 2 Phase C

This dependency-free Node package exposes the qualified Scope 1 OpenMP SSSP binary through an authenticated loopback-only REST API.

Scope 3 also contains an isolated CUDA incremental-SSSP candidate under `native/sssp-cuda`. It is deliberately absent from this companion's backend enum and capability response because the current qualification environment has no CUDA toolkit, `nvcc`, or Compute Sanitizer. There is no automatic OpenMP fallback for an explicit CUDA request. Runtime integration is permitted only after the candidate passes the documented CUDA build, device, parity, failure, cancellation, stress, and sanitizer gates on compatible hardware.

## Trust boundary

- Default and only permitted bind host: `127.0.0.1`; default port: `8791`.
- `GET /v1/health` is non-sensitive and unauthenticated.
- All capability, artifact, job, cancellation, and result routes require `Authorization: Bearer <session token>`.
- Browser origins are matched exactly against the allowlist in `src/config.js`.
- Artifacts are content-addressed (`sha256:<lowercase digest>`) and stored under a companion-owned temporary root.
- The only executable is the fixed `native/sssp-openmp/build/candy-sssp-openmp` path. Windows execution crosses the explicit WSL2 boundary.
- Native stdout/stderr, request bodies, artifacts, results, timeouts, graph sizes, updates, and retained jobs are bounded.

## API

`GET /v1/health`, `GET /v1/capabilities`, `POST /v1/artifacts`, `GET /v1/artifacts/:id/metadata`, `POST /v1/jobs`, `GET /v1/jobs/:id`, `POST /v1/jobs/:id/cancel`, and `GET /v1/jobs/:id/result`.

Unknown routes, schemas, algorithms, backends, graph types, and IDs fail closed. There is no shell, exec, filesystem-path, arbitrary proxy, or environment endpoint.

Run from the repository root with `npm run candy:runtime`. Stop with Ctrl+C so the temporary credential and companion-owned artifact directory are removed.
