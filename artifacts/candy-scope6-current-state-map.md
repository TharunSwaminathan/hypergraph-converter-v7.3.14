# CANDY Scope 6 current-state map

Baseline: b24c4e32100d2e7c05b13df3c8f6f9e279fd8828. This describes current code, including implemented Scope 5, not the old design hypothesis. Source references are repository-relative, one-based lines. See [audit](candy-scope6-readiness-audit.md) and [gaps](candy-scope6-gap-register.json).

Let E be hyperedges, I incidences, V distinct vertices, k_e row sizes, L identifier/content bytes and R plan operations. Complexity estimates describe source work; they are not measured latency.

## A. Import, committed graph and identity

UI/import/batch conversion produces canonical application hyperedge rows and calls the shared commit path. `src/App.jsx:363` invokes `commitGraphState`, synchronously updates the live graph ref, publishes state, records history, clears selection and invalidates pending authority when appropriate. Legacy selectors/finalHes derive from that authority; they are not a second writable graph.

`src/graph/graphState.js:1` owns Hypergraph/DynamicHypergraph, ID, monotonic version, fingerprint, hyperedges and reserved explicitVertices. The envelope is shallow frozen, retaining incoming hyperedges; do not assume deep-freezing only the envelope makes shared row mutation safe.

`src/graph/graphIdentity.js:48` → `src/graph/graphFingerprint.js:27`: copy rows/memberships, stringify vertex IDs, sort hyperedges, recursively sort attribute keys, stringify full canonical authority and compute short FNV marker. Exact OLD/NEW content equality protects same-marker collisions. Replacement gets fresh ID/version even for identical content; graph type participates in authority. Exact comparison is currently computed even where replacement/marker already distinguishes change.

Cost: O(I + E log E + attributes/sorting + serialized characters), multiple arrays/strings. Native canonical mapping is a distinct typed-ID ordering; application identity does not sort membership order here.

Standard parse flow at `src/App.jsx:472` defers with a10ms timer, then synchronously parses/normalizes/commits; the timer does not move parsing off the main thread. `src/utils/parsers.js:93` copies normalized membership arrays, deduplicates via Set/uniquePreserve, clones attribute objects and records all used IDs. V2H/H2H import paths sort full hyperedges and memberships (`src/utils/parsers.js:488`, `src/utils/parsers.js:538`); JSON/CSR import parses full JSON. After commit App additionally flatMaps/maps all memberships to build vertex Set for summary (`src/App.jsx:488`). Raw input texts, parser raw rows and normalized rows can coexist transiently; generic incidence-adapter limits are not a universal pre-parse import admission policy.

## B. Pending owner, Stage and Edit

`src/graph/dynamicUpdateControls.js:1` shares panel/Assistant commands → `src/graph/pendingHypergraphUpdate.js:17`.

One controller owns one current pending update. Session WeakMap contains monotonic revision, current updateId and a Map of at most 256 small lifecycle/digest records. It does not retain 256 full proposed graphs. Each material edit gets a new updateId/revision and supersedes prior authority.

Draft: validate typed GraphMutationPlan/base/hash, clone/freeze. Validation: exact base/type → full preview → proposed fingerprint → deterministic motif projection → stable full content serialization/SHA-256 → frozen validated pending. The pending object retains plan, preview with full proposed rows, next version, motif update/impact and digest. No-op consumes/discards and returns no pending authority.

`src/graph/pendingHypergraphUpdate.js:275` performs preview before motif projection's count preflight. `src/candy/adapters/graphMutationToHypergraphUpdate.js:36` always canonicalizes both states within 256E/100kI; therefore a large generic DynamicHypergraph does not have qualified pending Stage/Apply capacity even for metadata-only edits. Analysis's tighter work budget is checked later.

## C. Preview and derived motif update

`src/graph/graphMutationPreview.js:18` → `src/graph/graphMutationEngine.js:6`: validate plan, clone all hyperedges into working Map and copy memberships, apply operations/global scans, sort final rows, compute OLD/NEW fingerprints, enumerate vertices for before/after counts. Undo uses retained before snapshot as new working rows.

`src/candy/adapters/graphMutationToHypergraphUpdate.js:89`: cheap projection counts, then vertices Map, sorted keys, copied raw incidence graph, generic canonical adapter. Diff maps translate native indices back to semantic IDs and sort membership keys again; union edge keys sorted; deterministic deletes/inserts derived from exact final membership differences. Metadata-only changes yield motifImpact NONE; motif update remains descriptive derived transport, not Apply authority.

`src/candy/adapters/hypergraphIncidenceAdapter.js:38` validates full schema/counts before copying; typed identifier maps sort keys and native membership rows. Trusted canonical objects are tracked in WeakSet, not a strong global cache. `src/candy/adapters/identifierMapping.js:3` enforces safe integer IDs or nonblank ≤512-character strings and preserves numeric/string distinction.

Browser visual preview: `src/visualization/dynamicUpdatePreview.js:1` compares OLD/proposed rows with stable serialization, annotates inserted/deleted/retained/replaced semantics. It returns preview references/semantic Map; exact analytical graph is unchanged.

Cost: full-state O(I + E log E + sum k_e log k_e) preparation plus operation scans; content serialization/freezing adds full proposal copies. Plan-global vertex edits can touch every incidence. Aggregate plan work needs admission before clone, not only after transport derivation.

Legacy Hypergraph Batch Updates parse the whole text into operations (`src/utils/batchUpdates.js:7`); memoized batchApplication invokes the same full-clone mutation engine through applyBatchUpdates (`src/utils/batchUpdates.js:61`, `src/App.jsx:3216`). finalHes can be this displayed derived preview while CANDY still binds committed graphState. Dynamic Batch Updates use the single pending owner and separate Apply; they do not create a second authoritative graph. Selection pruning materializes a flatMap/map/Set of finalHes vertices (`src/App.jsx:3235`).

## D. Apply

`src/graph/pendingHypergraphUpdate.js:139` checks exact owned Apply confirmation/base/revision/digest/plan/proposed state, consumes authority, rederives validated content, compares exact preview and motif transport, rechecks live base after awaits and calls shared commit once. Commit ID/version/type/fingerprint must match the expected transition. Publication clears pending; analysis result/confirmation becomes stale via graph transition.

Panel and Assistant use the same `src/graph/dynamicUpdateControls.js` owner. Apply works without analysis, submits no Runtime job and never consults result as mutation permission. Stale pending retains descriptive preview until discard; discard publishes null. Disposal clears owner/listeners/ledger access.

Necessary cost: fresh authority checks and exact consistency. Optimization may share immutable prepared data only if base/revision currentness is independently rechecked. Historical/no-op/replay behavior is part of the compatibility contract.

## E. STATIC motif

`src/components/CandyMotifStatistics.jsx:1` and panel/Assistant entry points propose bounded selectors → `src/candy/motifAnalysisController.js:53` Stage.

Cheap graph/type/count/work checks in `src/candy/motifPreflight.js:27` precede feasibility preparation and an identity-owned expiring confirmation. STATIC requires CUDA_STATIC; no update selector and no projection/fallback.

After explicit confirmation: consume token before await → recheck availability → construct incidence graph via `motifGraphValue` → `src/candy/motifWorkflow.js:18` prepares exact native digest projection, artifact hashes/uploads and fresh request UUID → job submission. Apply remains separate.

STATIC emits absolute 30-class counts and total, not incremental delta. The application's graph is unchanged.

## F. INCREMENTAL motif

Same analysis owner, with CUDA_INCREMENTAL and exact current pending update selector. Requires DynamicHypergraph, VALIDATED pending, CHANGED motif impact, exact base and both snapshots' count/work feasibility. Metadata-only is not a synthetic zero delta; disconnected structural changes can produce valid measured zero delta.

`src/candy/motifWorkflow.js:89`: canonical OLD; apply deterministic update to reconstruct full NEW; canonicalize NEW again; build common semantic-ID mappings/tags; remap rows into packed digest content; count affected candidates; enforce 2MiB incremental packed size. `src/candy/adapters/hypergraphUpdateAdapter.js:1` already canonicalizes its reconstructed NEW, creating some repeated work.

HTTP carries OLD artifact and update artifact, not a separate full proposed artifact. Native packing carries both full snapshots. Result is signed 30-bin NEW-affected minus OLD-affected counts, DELTA_ONLY_NO_PRIOR_COUNTS. No incremental-to-STATIC or CPU fallback.

## G. Artifact creation, digest and transfer

`src/candy/motifWorkflow.js:30`: JSON.stringify graph/update, TextEncoder size check, SHA-256 exact text; independently SHA packed native content. These identities have different roles:
- graphFingerprint: short noncryptographic change marker;
- pending updateDigest: exact revision/plan/proposed authority digest;
- graph/update artifact IDs: SHA-256 of exact immutable artifact bytes;
- nativeRequestDigest: exact packed transport;
- result artifact digest: exact Runtime result body, checked again in browser.

Current workflow uploads objects after hashing strings. `src/candy/client.js:59` serializes again, encodes UTF-8, builds binary string byte by byte and btoa; wrapper JSON sent with bearer. No compression or streaming. Base64 adds 4×ceil(N/3) characters; request limit includes wrapper.

`candy-runtime/src/server.js:70` decodes bounded body → `candy-runtime/src/artifacts/artifactStore.js:40`: copies owned Buffer before queued write, hashes, validates media, checks quota, exclusive regular digest file write. Existing exact content deduplicates disk retention but not browser transfer. Immutable same bytes under another media type are rejected.

Read revalidates file type/containment/hash/length. Max 512 artifacts/64MiB, each ≤6MiB; no eviction. Auto root disposed on graceful close; operator root persists but old metadata/disk accounting is not reconstructed. Current browser has no presence cache/metadata method.

## H. Runtime admission, jobs and scheduling

`candy-runtime/src/config.js:10`: only127.0.0.1, default8791, exact default frontend origins5173 and deployed GitHub origin; HTTP8MiB, stdout8MiB, stderr64KiB, jobs256. Generic graph limits do not override motif limits.

`candy-runtime/src/server.js:19` applies present-Origin allowlist and bearer auth; originless authenticated CLI supported; public health is limited. `candy-runtime/src/http/httpUtils.js:34` collects request chunks, counts bytes, concatenates and parses. No explicit server-wide in-flight memory/admission quota found.

`candy-runtime/src/jobs/jobManager.js:99`: validate request/snapshot/backend qualification, metadata lookup, lifetime maxJobs check and request-hash dedup. Request UUID contributes to hash; normal fresh analyses become fresh jobs. The Map retains terminal records/results. One motif Promise queue; nonmotif jobs bypass it. Queue residence/preparation are outside native timeout.

`candy-runtime/src/backends/motifJobAdapter.js:2` imports frozen packer/validator code under `candy-runtime/test`. Directory naming does not make these imports optional in production. Artifact reads/JSON parses, OLD/NEW reconstruction and packed request preparation repeat for each execution. Temp request is written; cleanup completes before accepted motif terminal publication. Active executions tracked and drained on close.

## I. Native process and CUDA

`candy-runtime/src/backends/nativeProcessRunner.js:21` verifies qualified executable; fixed shell:false argv. Linux setsid/bash; Windows wsl.exe -d Ubuntu --exec setsid/bash with drive-to-/mnt conversion. Supervisor acknowledges owned process group before execution. Abort/timeout kill group and bounded stdout/stderr reject unsafe output; listeners/timers cleared. Each job spawns a new process, repeating CUDA context/device setup.

STATIC `candy-runtime/native/hypergraph-motif-cuda/src/main.cu:205`: checked parse/work bounds, CUDA device properties, new device buffers, synchronous H2D, E³ launch positions rejecting nonordered triples, merge memberships/lookup class/atomic bin, synchronize, D2H, free. Kernel events start after transfer and exclude context/parse/alloc/free.

INCREMENTAL `candy-runtime/native/hypergraph-motif-cuda-incremental/src/main.cu:215`: enumerate all choose(E,3) triples, retain those touching affected edges. Build OLD and NEW vectors before calling sequential affected_count; five device buffers per snapshot, transfer lookup each time, time kernels only, extract OLD/NEW histograms, subtract signed bins. Both host candidate vectors coexist, device snapshots are sequential. RAII and explicit checked allocation arithmetic already exist.

Qualified environment and binary/source/evidence hashes in `candy-runtime/src/capabilities/motifQualification.js:22` are fixed local consistency controls; unsigned local records are not publisher attestation. Any persistent GPU cache would create a new device lifetime/protocol boundary.

## J. Result registry and UI

`src/candy/motifAnalysisController.js:15`: one volatile approval/job binding/result; epochs reject changed graph/revision/session/unmount, checks after each await. Cancel clears authority synchronously before HTTP cancellation. Held result reads have a separate read generation.

`src/candy/motifResultRegistry.js:4`: one immutable accepted result, structuredClone then exact workflow validation/digest, currentness check and deepFreeze. No unbounded browser result history. Currentness key uses bounded scalar authority; no full graph serialization in React Runtime dependency keys.

`src/components/CandyMotifResult.jsx:1`: constant 30 rows, signed-delta presentation when incremental; `CandyRuntimePanel.jsx` receives at most current job; `DynamicHypergraphUpdatePanel.jsx` uses bounded summary and version-bound notice, not a full operation table. These are not the main large-data DOM risks.

`src/components/Viz.jsx:88` slices displayed hyperedges (default50, configurable≤10000), then builds topology over every selected membership. Overlay has3000 visual relations/per-edge64 but materializes all memberships first. Canvas selection/rings iterate memberships on draw. Hyperedge list uses map+indexOf; vertex list sorts/maps all selected vertices. No vertex/DOM virtualization budget. RAF disposal is implemented.

`src/App.jsx:3774` memoizes stats; derived graph products are demand-driven and cache activation clears on graph change. Heavy worker paths structured-clone full graph and terminate; synchronous fallback is deferred, not preemptible once it runs.

Exports are materialized on demand and retained in current-graph derived cache. CSR JSON stringifies CSR; Full JSON stringifies finalHes plus H2V/V2H/H2H, duplicating incidence data within the export (`src/App.jsx:3961`, `src/App.jsx:3967`). Multiple chosen export formats can coexist as large cached text strings; options are currently a finite set, but byte capacity is not measured. These exports are necessary user-selected exact outputs and are not ordinary motif/Assistant serialization. Their Blob download helper additionally leaks URLs until fixed.

## K. Assistant observations and actions

`src/agent/orchestratorObservation.js:3`: ≤14000-character observation, bounded capabilities/devices/jobs/pending summaries and scalar state version. Motif inputs are selectors only, with explicit authorization/currentness/confirmation in `src/agent/orchestratorLoop.js:137`. The model cannot supply trusted graph/update/native/result bodies.

`src/agent/modelPromptBuilder.js:34`: general preview≤10 files, ≤50 lines/file, per-file8000 chars and total source-preview20000; prompt cap30000, conversation16×1200 and summary2000. Mutation planner `src/agent/prompts/graphMutationPlannerPrompt.js:82` builds full entity index/counts and then samples25 edges/50 vertices; pending summary8 operations, affected20/30, recent4×250. Outgoing bounds do not avoid local O(I) traversal/index allocation.

`src/agent/localModelClient.js:102` uses abort timeout/private endpoint controls but reads full response.text before parsing; timeout does not impose byte ceiling. Model response stays untrusted; excess response is a memory threat, not demonstrated mutation authority.

Live chat normal append caps500 but graph-version effects and some batch notices bypass it (`src/components/AgentChatPanel.jsx:464`). Rendering maps full messages. Persistence bounds80 do not constrain this live array.

## L. Persistence

`src/persistence/threadStateSchema.js:1` projects descriptions only: graph.available=false, no live pending or actions/approvals/results. 80 messages,6000 chars/message,2000 summary,1M record characters; graph snapshots/history are not persisted.

`src/persistence/threadStore.js:54` trims80 threads transactionally; versionchange closes DB. `src/persistence/threadSaveQueue.js:1` retains at most one in-flight and one latest save. `usePersistentThread.js` snapshots bounded workspace references each render, not graph bodies; lifecycle guards prevent late restore/save adoption. Raw normalization may serialize before projection; quota/byte costs remain measurable.

## M. Reload, reconnect and multi-tab

Each mounted app creates fresh volatile graph/pending/analysis ownership. SessionStorage credential is a reconnect hint; mount starts unauthorized and explicit discovery is required. Reload never restores executable graph/update/approval/result authority.

Tabs can share same-origin inert thread data but have independent workspaces/controllers. Runtime session may be shared service-side, so its quotas are shared among authenticated tabs. Reconnect/restart generation invalidates current analysis/results; cached artifact data must not revive old handles/approvals. No BroadcastChannel authority propagation was found.

Browser client has no timeout/AbortSignal: currentness prevents late result acceptance, while request promises/captured data may survive until HTTP settles. This distinction drives S6-13.

## N. History/undo and lifecycle

`src/graph/graphHistory.js:25` JSON clones before+after each material commit, rolling25 events; up to50 graph snapshots plus current/pending/transient data. Undo reads latest before snapshot via mutation engine and commits a new transition; it must not restore old result or confirmation.

Current graph history list is bounded. Session ledger is bounded. Browser result/job owner is bounded. Runtime jobs/artifacts are quota-bounded without reclamation, so they stop service rather than grow indefinitely. Live graph-status chat can grow beyond its intended cap; App export dl creates Object URLs without revocation (`src/App.jsx:3855`). Those are concrete lifecycle gaps.

No endless automatic browser polling was identified. Native timers/process groups, workers and RAF have cleanup paths; abrupt crash cleanup and effective Windows ACLs remain unverified. An old proposed graph can remain in stale pending or an unresolved promise; controller clearing alone does not guarantee immediate GC. Measure retainer paths after discard/Apply/abort instead of asserting memory always returns.

## Release/deployment boundary

`scripts/package-portable-source.py:443` enumerates filesystem files rather than Git tracked files; exclusions omit native build and Runtime .local despite their Git ignores. Clean and populated-workspace packaging need separate tests. Preserve test-directory production imports.

`run-candy-runtime.bat` / `run-candy-runtime.sh` start npm only. Product prerequisites are Node and separately qualified native/GPU/WSL configuration; Python is packaging/development. Codex paths in historical evidence are development provenance. Fixed Ubuntu, origins5173, port8791, sm120/compiler13.4.59 and browser loopback policies limit portability.

Qualification also reads historical artifacts and invokes Git on fixed tags (`candy-runtime/src/capabilities/motifQualification.js:49`, `candy-runtime/src/capabilities/motifQualification.js:61`). The portable source package excludes artifacts and Git metadata, so extracted motif CUDA fails closed even if local binaries/records accidentally accompany it. Qualified Runtime currently requires Git/history/evidence or a future reviewed release verification contract; rebuilding alone is insufficient.

No tracked .github workflow was found. Existing CPU regression/build/package and GPU/model/browser harnesses can support future CI/release gates, with explicitly different hardware lanes.
