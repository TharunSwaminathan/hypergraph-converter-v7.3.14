# CANDY Scope 4A-R contract decision

## Selected first product

- Product name: `HYPERGRAPH_3EDGE_MOTIF_COUNT`
- Taxonomy: `candy.hypergraph-3edge-motif-taxonomy/1`
- Semantic modes: `STATIC`, `INCREMENTAL`
- Qualification backend: `CPU_REFERENCE_ORACLE`
- Production native execution: explicitly deferred

The product name describes the mathematical operation. ESCHER is research provenance only.

## Mathematical definition

Enumerate every unordered triple of distinct hyperedges. Count the triple iff its three-node intersection graph is connected, including both three-edge closed triangles and two-edge open wedges. Derive the seven exclusive Venn-region presence bits, canonicalize under all six permutations of the hyperedges, and increment exactly one of 30 stable product classes.

## Type boundary

Accepted: `Hypergraph`, `DynamicHypergraph`.

Rejected with `INVALID_GRAPH_TYPE`: `OrdinaryGraph`, `DynamicOrdinaryGraph`, `ProjectedOrdinaryGraph`.

No clique expansion, star expansion, pairwise projection, graph-to-hypergraph conversion, or hypergraph-to-graph conversion is permitted. SSSP retains the inverse boundary unchanged.

## Canonical incidence contract

Schema: `candy.hypergraph-incidence/1`.

Required semantic fields are graph ID/version/type, an explicit vertex-ID list, and hyperedges containing an ID plus a membership list. String and safe-integer IDs are preserved as distinct semantic IDs. Canonical dense ordering uses a type-tagged deterministic key and is never caller/model authority.

- Duplicate vertex IDs: rejected.
- Duplicate hyperedge IDs: rejected.
- Duplicate membership within a hyperedge: rejected.
- Undeclared membership vertex: rejected.
- Empty hyperedge: rejected in v1.
- Singleton hyperedge: allowed.
- Isolated declared vertex: allowed and recorded.
- Structurally identical hyperedges with distinct IDs: allowed.
- H2H/V2H input: not accepted.
- General incidence limits: 1,000,000 vertices, 1,000,000 hyperedges, 1,000,000 members per hyperedge, 10,000,000 total incidences.
- CPU oracle limits: 256 hyperedges, 100,000 incidences, and at most 5,000,000 aggregate region-membership visits. The work bound is `incidences * C(hyperedges - 1, 2)` (zero for fewer than three hyperedges), checked before enumeration. Optional qualification limits may only tighten known ceilings.
- Identifier and graph/request/state/update ID strings: at most 512 characters.
- Provenance: acyclic inert JSON, cloned and recursively frozen; depth at most 8, at most 1,024 nodes/entries per checked container, and at most 16,384 aggregate key/value text characters. This is descriptive metadata, not conversion or execution authority.
- Canonical snapshots: private adapter-owned WeakSet branding; mapping-shaped caller objects do not become trusted canonical input. Updated semantic incidence arrays and memberships are immutable too.

## Request contract

Schema: `candy.hypergraph-3edge-motif-request/1`. It binds request ID, algorithm, taxonomy, mode, and graph ID/version. `INCREMENTAL` additionally binds a positive motif-state version and an update reference. Stale graph and property state fail closed.

STATIC accepts both Hypergraph-family types. INCREMENTAL requires `DynamicHypergraph`. Its execution runner additionally requires a separately supplied authoritative current motif-state reference and checks state identity/version against the request. The standalone schema validator can perform structural checking without current-state authority; that is not execution authorization. No state store or persistence layer is implemented here, and the caller must not obtain its supposed current-state authority from the request itself.

## Update contract

Schema: `candy.hypergraph-3edge-motif-update/1`.

- Input graph must be `DynamicHypergraph`.
- Ordering is exactly `DELETE_THEN_INSERT`.
- Version advances by exactly one.
- Missing deletion is rejected.
- Existing-ID insertion is rejected unless that exact ID is deleted in the same update.
- Exact delete/reinsert is allowed and may change membership.
- Duplicate deletion, insertion, or inserted membership is rejected.
- New inserted vertex IDs extend the declared vertex set; existing vertices remain declared even if isolated.

## Result contract

Schema: `candy.hypergraph-3edge-motif-result/1`.

The result binds request, algorithm, taxonomy, backend, mode, graph reference, exactly 30 safe-integer counts, total connected triples, exact-validation status, and bounded warnings. Incremental results additionally bind the output graph reference and exactly 30 signed safe-integer delta counts. Count totals are checked without permitting unsafe integer accumulation.

The output identifies the same graph at exactly the next version. Delta entries cannot imply negative or unsafe previous counts. Warnings are limited to 20 strings of at most 512 characters each. Standalone result validation is structural/arithmetic; an arbitrary caller's `validation.status` is not proof of mathematical correctness. Exact counts/deltas come from the CPU oracle.

## Static and incremental semantics

`STATIC` is exact set-based enumeration. `INCREMENTAL` validates and applies the typed update, fully recomputes old and new exact counts, and defines each delta as `new - old`. Optimized incremental execution is not claimed.

## Deferred functionality

Production CUDA, Runtime Companion dispatch, capability discovery, ReAct/model actions, browser execution controls, adaptive selection, and the separate Type1/Type2/Type3/coarse operations are outside Scope 4A-R.

## Qualification disposition

Functional qualification is green. Overall Scope 4A-R remains `NON-PASS / FINAL_SECURITY_REVIEW_TOOLING_BLOCKED`: the fresh security tool generated and sealed its own manifest, but retained a pending item and `partial` coverage from the earlier checkpoint. See the permanent audit report and unchanged tool-generated report. Neither the sealed manifest nor coverage was manually repaired.
