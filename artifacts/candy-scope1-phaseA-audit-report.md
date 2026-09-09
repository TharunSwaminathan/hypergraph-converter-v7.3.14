# CANDY Scope 1 Phase A Independent Audit

## Scope

Adversarial source and test review of the new versioned contracts, graph-type boundary, vertex mapping, CSR adapter, weight limits, update identity, provenance, and bounded result contract. Existing browser projection helpers were inspected but were not connected to these modules.

## Result

**PASS after corrective work.** No Critical or High finding remains open. Phase A tests pass 2/2 files.

## Findings

### CANDY-A-001 — High — incremental references were not structurally/version validated

The initial `AlgorithmRequest` gate required the presence of `propertyStateRef` and `updateBatchRef` but did not validate their fields or bind them to `graphRef`. A stale or malformed reference could cross the contract boundary.

**Closure:** added exact-key validation, graph ID/version binding, state-version validation, and deterministic `STALE_PROPERTY_STATE` / `STALE_GRAPH_VERSION` failures. Added regression cases.

### CANDY-A-002 — Medium — graph-type integration test did not reach compatibility gate

The first hypergraph request fixture retained contradictory ordinary-graph metadata, so it failed schema validation before demonstrating the required `INVALID_GRAPH_TYPE` behavior.

**Closure:** replaced it with a valid typed `Hypergraph` snapshot and asserted the exact error code. Direct compatibility tests also assert `implicitProjectionPerformed: false` for `Hypergraph` and `DynamicHypergraph`.

### CANDY-A-003 — Medium — locale collation was unnecessary mapping variability

The initial mapping used `localeCompare`. A named locale reduces variance but is weaker than an exact language-neutral ordering contract.

**Closure:** changed to direct code-unit lexical comparison over explicit type-tagged canonical keys. Numeric-looking strings and numeric IDs remain distinct.

### CANDY-A-004 — Medium — result observations needed stronger bounds and COMPARE semantics

The initial result validator distinguished execution and validation, but allowed `COMPARE` with `not_requested` validation and did not bound summary/warnings.

**Closure:** `COMPARE` now requires passed validation; execution status and zero exit code are checked separately; model summaries are capped at 4096 UTF-8 bytes and warnings at 20 strings of 512 characters.

### CANDY-A-005 — Medium — zero algorithm-state version was accepted

Final contract review found that JavaScript accepted `algorithmStateVersion: 0` although the native boundary correctly uses zero to mean missing state.

**Closure:** property state versions must now be positive; zero returns `STALE_PROPERTY_STATE`. Added a regression assertion.

## Safety conclusions

- Only `OrdinaryGraph`, `DynamicOrdinaryGraph`, and already materialized, provenance-validated `ProjectedOrdinaryGraph` are accepted for SSSP.
- No projection function is imported or called by the CANDY contract/CSR path.
- Graph type comes from canonical state supplied to deterministic validators, never filenames or model text.
- Artifact references accept only lowercase `sha256:` IDs and media types, not paths.
- CSR conversion uses zero-based deterministic mapping, stable edge order, explicit duplicate/self-loop policy, INT32 weight bounds, and configured cardinality limits.
- Phase A adds no dependency and makes no frontend, ReAct, Custom Parser, or visualization change.
