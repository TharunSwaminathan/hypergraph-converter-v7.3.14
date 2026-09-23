# CANDY Scope 5 current-state map

Baseline: `57daa23050c89cd0d2c74328766d284311376da4` on `candy-integration-scope5-dynamic-hypergraph`.

## Executive determination

`DynamicHypergraph` is **not** a first-class application state today. It is a qualified lower-level CANDY contract/runtime type plus an Assistant selector condition. Production `App.jsx` owns a committed hyperedge array (`hes`) and always constructs the CANDY graph with literal `graphType: "Hypergraph"`; `useCandyRuntime` is called without `pendingUpdate` (`src/App.jsx:255`, `src/App.jsx:3699-3714`). Consequently, STATIC is reachable and qualified, while INCREMENTAL is deliberately unreachable from the production workspace.

## Graph representations

| Concept | Current representation | Identity/version | Persistence | First-class? |
|---|---|---|---|---|
| Application Hypergraph | React state `hes: Array<{id, vertices, time, weight, attributes}>`; vertices are normally derived from memberships | Separate `graphIdentity` with `graphId`, `graphVersion`, `graphFingerprint` | Graph contents are not restored; inert refs only | Yes |
| Application DynamicHypergraph | None | None | None | No |
| Application OrdinaryGraph | No committed ordinary-graph envelope; projections/CSR are derived products | None as committed graph | None | No |
| Application DynamicOrdinaryGraph | None | None | None | No |
| CANDY Hypergraph | `candy.hypergraph-incidence/1` with explicit vertices and hyperedges | `graphId`, `graphVersion`; artifact SHA-256 at Runtime | Companion-lifetime artifact | Yes at integration boundary |
| CANDY DynamicHypergraph | Same incidence schema with `graphType: DynamicHypergraph` | Same plus qualified update | Companion-lifetime artifact | Contract/runtime only |
| CANDY ordinary family | `OrdinaryGraph`, `DynamicOrdinaryGraph`, `ProjectedOrdinaryGraph` accepted by SSSP contracts | Graph snapshot/ref | Companion-lifetime artifact | Contract/runtime only |

Evidence: `src/candy/contracts/graphTypes.js:3-24`, `src/candy/adapters/hypergraphIncidenceAdapter.js:34-157`, `src/utils/parsers.js:93-115`, `src/App.jsx:320-357`.

### Canonicalization and identity

- Parser normalization creates `{id, vertices, time, weight, attributes}` and rejects duplicate IDs (`src/utils/parsers.js:93-115`).
- UI stale-state serialization stringifies IDs and vertices, sorts object keys, sorts hyperedges by ID, and hashes the serialization with a short FNV-derived marker (`src/graph/graphFingerprint.js:1-39`). Vertex order is retained; `graphType` and explicit isolated vertices are absent from this fingerprint.
- The CANDY incidence adapter preserves typed identifier distinctions, explicit isolated vertices, deterministic native mappings, nonempty edges, unique membership, declared-vertex references, and hard limits (`src/candy/adapters/hypergraphIncidenceAdapter.js:18-23`, `:34-157`).
- Runtime artifact identity is SHA-256 over exact bytes and is rechecked on read (`candy-runtime/src/artifacts/artifactStore.js:40-92`). This is stronger and serves a different purpose than the UI fingerprint.

### Current graph-version transitions

| Event | `graphId` | `graphVersion` | Notes |
|---|---|---:|---|
| Initial empty workspace | generated empty ID | 0 | `createGraphIdentity([])` |
| First nonempty commit | existing/generated ID | previous + 1 | App uses `nextCommittedGraphIdentity` |
| Content-changing ordinary mutation | same ID | previous + 1 | Fingerprint change required |
| Same-content/no-op | unchanged | unchanged | No history event |
| Parser/custom-parser replacement | new ID | previous + 1 | `replacement: true`; version does not reset |
| Clear | new empty ID | previous + 1 | Clear is a committed transition |
| Undo | same current ID | previous + 1 when restored content differs | Undo is a new commit, not time travel |
| Batch preview/UI route/view changes | unchanged | unchanged | Preview is not authoritative |

Evidence: `src/graph/graphIdentity.js:11-42`, `src/App.jsx:321-357`, `src/App.jsx:423-435`, `src/App.jsx:3076-3082`, `src/App.jsx:3103-3119`, `src/graph/graphMutationEngine.js:31-40`.

## Current mutation and update concepts

There are three partially overlapping concepts:

1. **GraphMutationPlan** — the application authoring/apply contract. It binds expected graph ID/version/fingerprint, a plan ID/hash, typed operations, metadata, and a preview (`src/graph/graphMutationValidator.js:4-28`).
2. **Batch Updates preview** — raw command text parsed into operations, with `applyBatch` selecting a temporary `finalHes` overlay. Commit rebuilds a graph-bound mutation plan (`src/App.jsx:3140-3226`, `src/utils/batchUpdates.js`).
3. **HypergraphMotifUpdate** — the qualified CANDY transport contract with `updateId`, `baseGraphRef`, `nextGraphVersion`, fixed ordering/collision policy, deletions, and insertions (`src/candy/contracts/hypergraphMotifSchemas.js:139-211`).

No application object unifies them. Scope 5 should not introduce a second mutation engine. The recommended authority chain is:

```text
typed GraphMutationPlan
  -> deterministic preview against committed graph
  -> one PendingDynamicHypergraphUpdate aggregate
       - retains plan/preview for application
       - derives immutable incidence diff for CANDY transport
  -> optional analysis and separately confirmed application
```

Derive the motif update from the validated committed-versus-proposed incidence diff, not directly from model text or raw operation order. A membership change becomes exact delete/reinsert of the same hyperedge ID. Weight/time/attribute-only changes are topology-neutral for this motif product.

## DELETE_THEN_INSERT behavior today

The fixed semantics are `DELETE_THEN_INSERT` and `REJECT_EXCEPT_EXACT_DELETE_REINSERT` (`src/candy/contracts/hypergraphMotifSchemas.js:18-23`, `:153-200`).

| Case | Current qualified result | Enforcing layer |
|---|---|---|
| Pure insertion | Accepted when ID is absent | Update schema + adapter |
| Pure deletion | Accepted when ID exists | Update schema + adapter |
| Replacement with new ID | Delete old + insert new accepted | Update schema + adapter |
| Delete/reinsert same ID | Accepted; delete occurs first | Update schema + adapter/native transport |
| Insert existing ID without deletion | Rejected | `validateHypergraphMotifUpdate` |
| Delete nonexistent ID | Rejected | `validateHypergraphMotifUpdate` with base graph |
| Duplicate deletion | Rejected using typed canonical keys | `requireUniqueIdentifiers` |
| Duplicate insertion ID | Rejected | `requireUniqueIdentifiers` |
| Duplicate vertex within insertion | Rejected | insertion membership validation |
| Empty inserted hyperedge | Rejected | update schema and incidence adapter |
| Invalid vertex reference | Insertions may introduce new vertices; unchanged base memberships must reference declared vertices | update adapter + incidence canonicalizer |
| Multiple affected hyperedges | Accepted within qualified bounds | update schema + incremental packer |
| Empty/no-op update | Lower-level contract accepts empty arrays and native produces zero delta | Contract/native; no application policy exists |

Application GraphMutationPlan adds stricter authoring semantics for missing IDs, duplicate adds, empty-incidence policy, prototype keys, and stale ID/version/fingerprint/plan hash (`src/graph/graphMutationValidator.js`, `src/graph/graphMutationEngine.js`). The Scope-5 adapter must preserve both layers.

## Current CANDY incremental call path

```text
Assistant/UI bounded selector
  -> AgentChatPanel explicit expensive-compute confirmation
  -> useCandyRuntime.submitFromAssistant
  -> submitMotifWorkflow
       canonicalize OLD incidence (<=256 hyperedges, <=100000 incidences)
       validate and locally apply pending update for preflight
       upload graph artifact (SHA-256)
       upload update artifact (SHA-256)
       create exact RuntimeMotifRequest + GraphSnapshot
  -> POST /v1/jobs
  -> JobManager validates request/snapshot/artifact/backend/device
  -> prepareMotifJob rereads artifacts and qualified packer derives NEW
  -> fixed CUDA_INCREMENTAL executable
  -> native signed delta result
  -> Runtime validates native identity/environment and stores result artifact
  -> browser validates session/job/request/graph/update/device/digests
  -> delta-only UI presentation
```

Evidence: `src/components/AgentChatPanel.jsx:1491-1521`, `:2680-2690`; `src/candy/useCandyRuntime.js:111-140`; `src/candy/motifWorkflow.js:16-52`; `candy-runtime/src/jobs/jobManager.js:88-117`, `:151-175`; `candy-runtime/src/backends/motifJobAdapter.js:7-54`.

### Runtime request fields

Required: `schemaVersion`, UUID `requestId`, algorithm, taxonomy, exact backend/mode pair, `graphRef`, `deviceId`, `timeoutMs`; INCREMENTAL also requires `updateRef {updateId, artifactId, nextGraphVersion}`. The job submission adds `graphSnapshot`, `graphArtifactId`, and `updateBatchArtifactId`. `nextGraphVersion` must equal base + 1 (`src/candy/contracts/runtimeMotif.js:9-30`).

### Result bindings already protected

- `runtimeSessionId`, `jobId`, `requestId`
- algorithm and taxonomy
- backend and mode
- input `graphId`/`graphVersion`
- graph artifact ID
- update ID, update artifact ID, and next version
- native request digest
- result artifact digest/ID
- qualified device and execution metadata

Existing browser validation: `src/candy/motifWorkflow.js:35-52`. Existing Runtime wrapper: `candy-runtime/src/backends/motifJobAdapter.js:27-54`.

Missing application bindings: base UI fingerprint/type, pending revision/digest, proposed next-graph fingerprint, consume/supersede state, and durable association between an accepted result and the exact pending aggregate.

## Delta-only semantics

The qualified backend returns `deltaCounts[30]` and `deltaTotalConnectedTriples = sum(deltaCounts)`, where each bin is `newAffectedCounts - oldAffectedCounts`. It does not accept prior full counts and does not claim a new full histogram (`candy-runtime/test/hypergraph-motif-cuda-incremental-contract.mjs:75-98`; `candy-runtime/native/hypergraph-motif-cuda-incremental/README.md:65-67`).

Current UI is truthful: it labels incremental output “Motif change (delta only),” displays signed values, preserves taxonomy groups, and says the update was not applied (`src/components/CandyMotifResult.jsx:4-44`).

Safe Scope-5 presentation rules:

- Always show signed total and per-class change; format positive values with `+`, negatives with `-`, zero as `0`.
- Default to affected/nonzero classes, with an expandable all-30 table and stable taxonomy labels.
- Never label a delta as a current or new full count.
- “Before / delta / after” is allowed only when a validated STATIC result exists for the exact base graph ID/version/canonical artifact/taxonomy and the delta is bound to the exact update/proposed next version.
- Reconstructed after counts are derived (`before + delta`), must remain safe nonnegative integers, and must carry both source result IDs/digests.
- Missing/stale/mismatched prior counts yield delta-only presentation, not an error and not an assumed zero baseline.

## Static versus incremental decision rules

1. Use `CUDA_STATIC` only for an explicit request to count the committed current Hypergraph or DynamicHypergraph.
2. Use `CUDA_INCREMENTAL` only for an explicit request to analyze change, with an authoritative validated pending update bound to the current DynamicHypergraph.
3. `graphType === DynamicHypergraph` alone never selects incremental.
4. Prior static results are optional for incremental execution; they only enable a separately validated derived comparison.
5. Exact capability declaration, paired Runtime, qualified device, and matching mode/backend are mandatory.
6. If any condition fails, stop with a typed explanation. Never choose CPU, projection, STATIC fallback, or another CUDA backend.

The current Assistant already follows rules 1, 2, 3, 5, and 6 (`src/agent/motifQueryPolicy.js:1-15`). Statistics currently exposes STATIC only (`src/components/CandyMotifStatistics.jsx`).

## Assistant state

Reusable:

- eight-step maximum and one action per ReAct iteration (`src/agent/reactOrchestratorConfig.js`, `src/agent/orchestratorLoop.js`);
- strict capability/argument allowlist (`src/agent/orchestratorCapabilities.js`);
- deterministic graph-mutation grammar and typed GraphMutationPlan;
- confirmation registry and stale-state snapshots;
- bounded authoritative observation including pending update selector when supplied;
- exact incremental selector (`updateContextId`) that cannot contain graph/update/native data.

Missing:

- typed capability to stage a graph mutation as a pending DynamicHypergraph update rather than immediate apply;
- edit/discard pending update capabilities;
- separate apply-pending-update capability and confirmation policy;
- bounded observation of pending status/revision/digest/proposed counts;
- authoritative re-observation after every transition.

The model must never construct `HypergraphMotifUpdate`, graph artifacts, NEW graph, affected sets, request paths, or native requests.

## UI and Preview

- **Graph workspace:** shows committed version/fingerprint and mutation history (`src/App.jsx:5158-5173`). It does not show graph type.
- **Batch Updates:** already supports text editing, preview, commit, and discard; preview is a temporary `finalHes` overlay (`src/components/AdvancedOptionsPanel.jsx`; `src/App.jsx:3140-3226`).
- **Preview/Viz:** renders whichever hyperedge array it is given; it has no semantic added/deleted/replaced overlay (`src/App.jsx:5293-5313`).
- **Statistics:** keeps Line-Graph Triangles and CANDY 3-Edge Motifs as separate sections (`src/App.jsx:5237-5265`). This separation is correct and must remain.
- **CANDY Runtime panel:** already contains an unreachable incremental button and truthful no-fallback copy (`src/components/CandyRuntimePanel.jsx:7-57`).
- **Assistant:** stages exact Runtime confirmation but has no update lifecycle controls.

Minimal coherent Scope-5 UI: add a Dynamic Update panel within/replacing the command part of Batch Updates; surface graph type beside committed identity; show base/next refs, update status, operations, validation, and stale reason; reuse Viz for the proposed graph and add bounded deletion/insertion/replacement styling; put “Analyze motif delta” with CANDY controls; put “Apply update” in the update panel, separately confirmed; link to it from Statistics/Assistant/Quick Links.

## Persistence and reload

IndexedDB saves bounded chat/workspace references, explicitly marks graph unavailable, and forces `pendingAction: null`. It does not restore graph contents, Runtime jobs/results/bindings, or approvals (`src/persistence/threadStateSchema.js:5-48`; `src/persistence/usePersistentThread.js:7-36`). The CANDY pairing token is browser-session storage only (`src/candy/useCandyRuntime.js:9-14`, `:45-51`).

Recommended conservative policy:

- A pending update does not survive graph/dataset replacement.
- No confirmation, job binding, result authority, or apply authority survives reload/restart.
- The simplest safe v1 is not to persist the pending update at all.
- If later persisted for recovery, store only inert descriptive draft data; load as `STALE_REVIEW_REQUIRED`, require exact graph reload/rebinding and fresh validation, mint a new revision/digest, and require fresh confirmations.

## Limits

| Layer | Current bound |
|---|---:|
| Generic incidence contract | 1,000,000 vertices; 1,000,000 hyperedges; 1,000,000 cardinality; 10,000,000 incidences |
| Browser motif workflow / static packer | 256 hyperedges; 100,000 incidences |
| Static aggregate work | 5,000,000 membership visits |
| Incremental update | <=256 deletions and <=256 insertions; <=100,000 inserted incidences |
| Packed incremental native request | 2 MiB |
| Motif timeout selector | 1..60,000 ms |
| Runtime request/artifact/result/stdout/stderr | 8 MiB / 6 MiB / 8 MiB / 8 MiB / 64 KiB |
| Runtime retention | 256 jobs; artifact store defaults to 512 artifacts / 64 MiB |
| UI preview count | 1..10,000 hyperedges |
| Visual sampling | 3,000 co-membership edges; 100,000 incidences; 4,000 line-graph edges |

Evidence: `src/candy/adapters/hypergraphIncidenceAdapter.js:18-23`; `src/candy/motifWorkflow.js:19`; `candy-runtime/test/hypergraph-motif-cuda-contract.mjs:12-14`; `candy-runtime/test/hypergraph-motif-cuda-incremental-contract.mjs:44-70`; `candy-runtime/src/config.js:16-27`; `src/visualization/previewRuntime.js:1-2`; `src/visualization/previewRenderBudget.js:1-5`.

No arbitrary new numeric limit is recommended. Scope 5 should expose and consistently preflight the existing qualified minimum envelope.

