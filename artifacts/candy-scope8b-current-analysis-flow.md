# Scope 8B current analysis lifecycle (before implementation)

Baseline: `f1e040e90764eac925d04c78d734a884dc4cd6cc`; branch `candy-integration-scope8b-analysis-history`. Local HEAD, origin/main, origin/Scope8B and the peeled Scope8A qualification tag all match. Tracked tree was clean. The post-promotion main CI, CPU/browser release and Pages deployment runs 41257524933, 41257524952 and 41257524877 all completed successfully on that SHA. No candidate commit is authorized.

## CPU analysis

`AppCore` derives `finalHes` from committed `hes` plus an optional uncommitted batch preview (`src/App.jsx:3234-3248`), then calls `useAlgorithms(finalHes)` (`src/App.jsx:3750`). Thus a committed graph version alone does NOT identify every actual CPU input.

`src/hooks/useAlgorithms.js:49-76` implements explicit Run by increasing runToken, then computes the selected registry algorithm in useMemo. After the first Run, input/algorithm/effective start/target changes can recompute results without another explicit Run. Renders and recomputations are not unique user operations. Algorithm selection resets runToken. Exceptions become local error text; there is no durable completed-request identity.

`src/algorithms/registry.js:13-61` selects six synchronous browser CPU algorithms: connected_components, bfs, dfs, shortest_path (Dijkstra), degree_distribution and k_core. Algorithm modules produce their corresponding counts, ordered traversal/path data, Map-valued distances/coreness/component membership and warnings. Some results contain lazy trace accessors and closure-backed animation metadata (`src/algorithms/compactTrace.js:9-43`). Raw serialization would lose Maps or materialize unsafe/large traces.

`src/components/AlgorithmsPanel.jsx:199-250` renders selected live results; the hook supplies visualization highlight/component colors and animation timers. Clearing/selecting/remounting replaces transient state. Input edits may recompute it. Automatic statistics (`computeStats`, bounded triads, derived mapping cache in App) are reconstructible derived views, not explicit analysis completions.

## Authenticated motif analysis

`src/App.jsx:3803-3810` passes authoritative graphState and the pending-update controller to `useCandyRuntime`, independently of CPU preview inputs. Statistics calls requestStaticMotifFromStatistics, while Assistant/dynamic controls enter the same qualified stage/confirmation flow. `src/candy/useCandyRuntime.js:33-54,98-109,143-174` owns live discovery/session state and client creation. Token hints remain session-only; every owner needs fresh discovery.

`createMotifAnalysisController` in `src/candy/motifAnalysisController.js:62-116` performs bounded preflight, mints an object-identity confirmation and captures exact graph/pending/runtime context. Submit consumes that approval before awaiting, uploads bounded content-addressed artifacts and submits a request through `src/candy/motifWorkflow.js:18-75`. `CUDA_STATIC` counts the current authoritative Hypergraph; `CUDA_INCREMENTAL` computes a signed delta against the exact validated pending transition. Neither applies a mutation or selects CPU fallback.

`candy-runtime/src/server.js` authenticates bearer requests and exact browser origins; jobManager dispatches fixed qualified backends through motifJobAdapter/nativeProcessRunner. Qualification paths are the fixed STATIC directory and the versioned `hypergraph-motif-cuda-incremental-scope6d-tranche1-f3fa7dc3` directory (`candy-runtime/src/capabilities/motifQualification.js:24-71`). Capability and native availability are effective runtime facts, never inferred from a historical label.

Polling observes bounded job state. Only openResult on a completed, still-current job retrieves and validates the actual payload. `src/candy/motifResultRegistry.js:15-31` clones, validates and freezes result evidence including exact request/result digest, graph/update/backend/device identity. The controller publishes RESULT_READY only after acceptance (`src/candy/motifAnalysisController.js:154-184`). Session/graph/update changes, cancellation and unmount revoke volatile evidence and requests. Failures become bounded classifications/messages. Result-ready state is NOT a history receipt.

`CandyMotifResult` renders validated counts/deltas and device provenance; `CandyMotifStatistics` and dynamic/Runtime panels gate visibility by current live evidence. The registry, controller, remote job handles, confirmations, session token and runtime session are transient execution authority and cannot be restored as historical authority.

## Existing durable boundary and classifications

| Current state | Classification | Boundary / consumer |
| --- | --- | --- |
| projects/revisions/tombstones; source/graph/checkpoints | durable | IndexedDB hypergraph-studio-projects v4; projectStore, workspaceObjectSchema, workspaceRestore |
| Assistant memory / chat | durable, separately validated | assistantMemories/threads project stores; memory retrieval never grants action authority |
| Safe model connection intent | durable, global | separately revisioned modelConnections; fresh verification / bounded reconnect |
| CPU outcome / parameters / current selection | transient | useAlgorithms and AlgorithmsPanel; not currently archived |
| CPU animation, lazy trace getters, timers | reconstructible / unsafe to serialize | compactTrace, hook highlight/animation |
| Automatic statistics / derived projections | reconstructible | App derived cache; not explicit execution history |
| Validated motif counts / safe build/device facts | transient evidence; suitable for a detached data projection | result registry and motif renderer |
| Native approvals, request clients, bearer credentials, handles, callbacks | unsafe to restore | volatile controller/registry/client; current authorization mandatory |
| Pending parser result/Apply and graph replacement intent | unsafe to restore | App restore explicitly resets these; persisted workspace graph is distinct |
| Runtime artifact payloads | transient external resources | normal CLI close retains explicit-root payloads until next owned-root initialization; not history |
| Actual live GPU/WSL/model availability | unknown until checked | historical provenance or source directories do not establish capability |

`src/persistence/projectStore.js:14` has no analysis-history store. `root.history` is bounded graph checkpoints, not analysis history. `projectSession` serializes one local writer lineage; `nextProject` enforces exact CAS and tombstones; transaction.oncomplete is the durability receipt. Destructive review tokens are private, one-use, revision-bound objects. BroadcastChannel is a stale hint, not the storage enforcement.

Resume validates categories and current root before mounting a keyed project session (`workspaceResumeCoordinator`, `WorkspaceExperience`). App restores data and clears parser results/bindings, graph UI history, Apply/pending state (`src/App.jsx:378-392`). History must add an independent read-oriented category rather than restore the live algorithm/motif registry.

Scope8A export uses a canonical bounded uncompressed container, manifest v2 (v1 accepted), object digests and private staging. Project/memory/root/objects/selection/eligible model intent publish atomically (`workspacePortability`, `projectStore.importWorkspace`). History must join that transaction with explicit compatible format evolution.

## Independent review and limits

The threat-model skill's fresh-context read-only architecture reviewer independently verified the CPU-preview distinction, lazy trace/Map issue, v4 store inventory, volatile result authority and portable v1/v2 boundary. Parent source inspection confirmed these facts. The requested artifacts directory overrides managed Security cache storage; no Security scan/cache/state is used.

One pre-existing documentation discrepancy is preserved, not repaired: candy-runtime/README.md says Ctrl+C removes the artifact directory, but explicit-root CLI shutdown closes the store and later OwnedRoot startup purges old payloads. Derived temp paths depend on actual os.tmpdir; Windows mode requests do not prove host ACL isolation. Scope8B will not redesign this Runtime lifecycle or claim live CUDA capability from these facts.
