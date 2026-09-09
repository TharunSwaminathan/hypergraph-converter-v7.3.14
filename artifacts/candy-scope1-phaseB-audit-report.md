# CANDY Scope 1 Phase B Independent Audit

## Scope

Adversarial review of the standalone C++17/OpenMP SSSP POC, deterministic harness, fixtures, upstream provenance, input bounds, CSR/update validation, prior-state checks, shortest-path semantics, OpenMP behavior, structured failures, generated-file handling, and process-facing interface.

## Result

**PASS after corrective work.** No Critical or High finding remains open. Normal and AddressSanitizer/UndefinedBehaviorSanitizer qualification each pass 12 deterministic fixtures, 40 fixed-seed stress cases, malformed input, stale state, native graph-type rejection, and forced comparison-failure propagation.

## Findings

### CANDY-B-001 — High — native request lacked its own graph-type assertion

The first native format trusted that the JavaScript CSR adapter had already enforced ordinary-graph type. Running the POC independently therefore did not reproduce the semantic boundary.

**Closure:** `graph_type` is mandatory. Only `OrdinaryGraph`, `DynamicOrdinaryGraph`, and `ProjectedOrdinaryGraph` are recognized; `Hypergraph` returns non-zero `INVALID_GRAPH_TYPE` with an explicit no-projection message. Projected input also requires a SHA-256 provenance artifact ID.

### CANDY-B-002 — High — equal-distance parent rewriting could create zero-weight cycles

Distance values could remain correct while a smaller-index equal-distance predecessor rewrite produced a parent cycle in a zero-weight strongly connected region. The initial tree validator checked local distance equations but not source-rooted ancestry.

**Closure:** relaxations now change parents only on strict distance improvement. Determinism comes from stable CSR and `(distance, vertex)` queue ordering. Tree validation walks every reachable parent chain to the source and rejects cycles. Added a zero-weight cycle fixture designed to reproduce the previous risk.

### CANDY-B-003 — Medium — request and inline-result bounds needed alignment

The first vertex limit permitted very large inline JSON arrays and did not cap request-file bytes.

**Closure:** the POC is intentionally capped at 10,000 vertices, 10,000,000 edges, and a 64 MiB request. Update totals and updated graph size are checked. Phase C may move full arrays to file-backed artifacts.

### CANDY-B-004 — Medium — stale graph and property classifications were conflated

Graph identity/version mismatch and malformed prior property contents initially shared `STALE_PROPERTY_STATE`.

**Closure:** graph ID/version mismatch now returns `STALE_GRAPH_VERSION`; missing/corrupt state version or arrays return `STALE_PROPERTY_STATE`. Qualification covers both.

### CANDY-B-005 — Medium — projection provenance was not asserted at native boundary

An independently submitted `ProjectedOrdinaryGraph` string did not prove an already materialized projection.

**Closure:** projected requests require a lowercase SHA-256 provenance artifact ID. The POC still performs no projection and cannot accept hypergraph structures.

### CANDY-B-006 — Low — ThreadSanitizer not qualified

AddressSanitizer and UndefinedBehaviorSanitizer passed. ThreadSanitizer was not claimed because GCC `libgomp`/TSan runtime compatibility was not established in this environment.

**Status:** open, non-blocking for this POC; required before a production parallel algorithm claim expands beyond the current race-free, per-target reconnect loop.

### CANDY-B-007 — Low — prior-state validation performs static Dijkstra

The POC recomputes the old static distances to prove supplied state authenticity before incremental work. This cost is recorded in preparation time and means tiny-fixture timings are not crossover evidence.

**Status:** accepted POC limitation. A future session store can authenticate state by immutable backend identity and retain optional reference comparison for qualification.

## Upstream fidelity and safety conclusions

- The implementation is deliberately named SSSP, not general MOSP.
- It retains the affected-parent-subtree invalidation/reconnection concept and explicit prior distances/parents, while providing a new stable contract.
- No upstream source file was copied because the supplied archive contains no license file; provenance and archive SHA-256 are recorded.
- The only CLI form is `--request <controlled-path>`; there is no shell, executable, environment, output-path, or arbitrary-flag interface.
- Delete-then-insert ordering is explicit; duplicates, missing deletions, existing-edge insertions, and same-edge conflicts fail closed.
- `COMPARE` requires exact distance equality and independently valid source-rooted parent trees. A compile-time qualification-only fault binary proves mismatch returns non-zero `RESULT_VALIDATION_FAILURE`.
- The OpenMP region writes one reconnect candidate per target index and reads immutable graph/state, avoiding shared writes.
- Build products are isolated under an ignored `build/` directory; harness request files are created under the OS temporary directory and removed in `finally`.
