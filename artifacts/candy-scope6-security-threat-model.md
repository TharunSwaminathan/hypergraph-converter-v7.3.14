# CANDY Scope 6 scale security and authority threat model

Origin: generated from current source and supplied Scope 5 evidence, with independent fresh-context architecture review. Baseline b24c4e32100d2e7c05b13df3c8f6f9e279fd8828. No source changes, attack execution or new vulnerability certification. The explicitly requested artifact path takes precedence over managed scan storage; no additional model/scan files were created.

Related: [audit](candy-scope6-readiness-audit.md), [gap register](candy-scope6-gap-register.json), [tests](candy-scope6-test-plan.md). Previous Scope 5 security evidence remains immutable and has scoped/partial repository coverage. PASS is not a guarantee about every unrelated parser/export module or every deployment.

## System, assets and attacker capabilities

The browser owns committed graph and pending/confirmation authority. The model proposes bounded actions. An authenticated loopback Node companion accepts immutable artifacts, queues jobs and invokes fixed qualified native CUDA processes. Results describe counts/deltas and never authorize graph mutation.

Protect: exact graph lineage/type/content; one pending revision/plan/digest/proposed state; separate consumed analysis/Apply approvals; current graph/update/session/job/result binding; pairing credential; artifact content integrity/confidentiality; fixed qualified executable; browser/host/GPU availability; inert stored thread descriptions.

Attacker can supply imported graph/update-like data or untrusted model text and trigger parsing/proposal paths. A paired local client with bearer can flood protected endpoints; browser caller additionally needs allowed Origin and token. Originless authenticated CLI is intentional. Unauthenticated remote access to protected companion routes is not established. Same-origin XSS/host administrator/qualification-record operator control are powerful prerequisites, not privileges demonstrated by this audit.

Faulty configured local/private model endpoint can return excessive response data. Other legitimate GPU workloads can consume memory. Multi-tab clients share Runtime resource quotas even though browser authority is tab-local.

## Trust boundaries and existing controls

| Boundary | Controls / concrete evidence | Residual question |
| --- | --- | --- |
| Import/model → graph action | Typed plan validation, expected graph identity, deterministic preview, separate Apply; model selector schema closed | Generic import/plan resource bounds before full allocations need review |
| Browser → Runtime | HTTP loopback URL restriction; service binds127.0.0.1; bearer; exact present-Origin allowlist, health public | No explicit total in-flight request/admission budget; browser HTTPS loopback behavior platform-dependent |
| Pending → Apply | One session ledger/current update; revision/base/type/digest/plan/proposed validation; consume exactly once and recheck after await | Immutable optimization must not skip fresh currentness or collision-safe comparison |
| Analysis → accepted result | Owned expiring consumed token, exact scalar context/session, checks after every async boundary, synchronous local cancel, one registry | Abort/timeout transport cleanup missing; data cache must not revive approval |
| Runtime → artifact filesystem | SHA filenames, exact media, exclusive creation, regular-file/symlink/realpath containment checks, digest/length recheck | Aggregate queued copies, reclamation, persistent-root accounting and Windows effective ACLs |
| Runtime → native | Fixed qualified hashes and executable, fixed argv shell:false, supervisor acknowledgment, owned process group cancellation, output/time/cleanup bounds | Abrupt crash ownership recovery; persistent worker would widen lifetime boundary |
| Native → GPU | Independent request/work/array limits; checked arithmetic and allocation errors, RAII, verified device/toolchain | Active reset/OOM and external contention not live-qualified here |
| Stored thread → reload/tab | Inert projection graph.available=false, actions/pending removed; fresh volatile owners; explicit Runtime discovery | Same-origin descriptive data privacy/byte quotas; never restore executable handles |

Evidence: `src/graph/pendingHypergraphUpdate.js:139`; `src/candy/motifAnalysisController.js:74`; `src/candy/motifResultRegistry.js:12`; `src/candy/client.js:15`; `candy-runtime/src/server.js:19`; `candy-runtime/src/artifacts/artifactStore.js:27`; `candy-runtime/src/backends/nativeProcessRunner.js:21`; `src/persistence/threadStateSchema.js:7`.

## Effective resource and recipient map

| Consumer/deployment | Configuration chain / effective resource | Recipient and enforcement |
| --- | --- | --- |
| Companion default CLI | createRuntimeConfig →127.0.0.1:8791; origins localhost/127.0.0.1:5173 and https://hypergraphproject.github.io | Local clients; protected exact-Origin when present and bearer |
| Pairing | Random32-byte token → OS temp candy-runtime-pairing-PID.txt requested0600; browser sessionStorage hint | Operator/current browser session; mount still unauthorized; graceful deletion |
| Artifact storage | override artifactRoot or auto OS temp candy-runtime-artifacts-*; digest-only child filenames | Runtime handlers/jobs; ≤6MiB/item,512 items,64MiB; auto close disposes; override persists |
| Native request | independent OS temp candy-job-* /request.txt, requested0600 | Fixed executable; on Windows drive path mapped to /mnt/drive through Ubuntu WSL; native≤2MiB |
| Backend qualification | fixed .local qualified-build record → native/<backend>/build executable; source/Makefile/binary/evidence/tag/device/toolchain digests | Device0 sm120/compiler13.4.59/runtime13040 qualified path; consistency, not publisher authenticity |
| Job/result state | jobs Map256 lifetime records; motif Promisequeue; result object plus immutable artifact | Paired service clients; current browser exposes only one result; no terminal reclamation |
| Browser persistence | IndexedDB hypergraph-chat-threads →80 threads;80 messages;6000/message;2000 summary;1M record chars | Same-origin code; projection/transaction trimming; no executable authority |
| Model | configured activeBaseUrl/baseUrl or localhost11434; private endpoint permitted; bounded timeout | Configured model service; response body lacks independent byte cap |
| Browser cache proposed | bounded tab-local bytes + Runtime-session presence handles | Same tab/session; no cross-tab executable authority, no persisted handles |

Effective Windows ACL protection and Windows/WSL mount equivalence are unverified. POSIX mode arguments are not evidence of Windows cross-user privacy. Do not print tokens or raw private artifact data during benchmark/recovery diagnostics.

## Scale threats, controls and validation needs

| Scenario | Existing control / product limit | Remaining risk and later test |
| --- | --- | --- |
| Oversized encoded artifact | HTTP8MiB and decoded6MiB cap; base64/UTF-8 only | Effective decoded capacity lower due wrapper. Aggregate concurrent copies not bounded; test preallocation admission and malformed/partial body cleanup |
| Decompression bomb | No compressed upload route accepted today | Not a present decompression exploit. If compression added, cap encoded+decoded bytes, ratio, CPU/time, streaming hash before publish; reject unnegotiated encodings |
| Huge graph/browser DoS | Generic adapter E/V/cardinality/I counts before copies; motif count/work limits | Import/mutation preview and application history can do full work before motif rejection; ensure UI admission before clone/parse where feasible |
| Pathological single edge | Qualified I count; display edge limit and sampled relations | All selected memberships/vertices still processed/rendered; new vertex/incidence/DOM budgets must precede copies |
| Pathological update fan-out |256 deletes/inserts and100k inserted incidences in projection; full snapshot native W | Global operations/large plans can expand work before projection; independently bound plan work and proposed graph creation |
| Job flooding | Bearer/origin;256 lifetime jobs; serialized motif execution | Authentication is authorization, not aggregate resource safety; qualification before quota and parallel submissions need reserved work/admission caps |
| Cancel flooding | Owned job lookup, synchronous browser revocation, runner abort/group ownership | Terminal cancels retain quota; avoid repeated cleanup processes/work and release reservations once; test idempotent repeated cancel |
| Artifact cache exhaustion |512/64MiB retained admission, exact-byte dedup | No eviction and copies queued before cap; future pins+LRU/TTL must bound bytes and protect active reads |
| Result history exhaustion | Browser registry1; Runtime job quota256/results retained | Runtime stops sustained service; new bounded diagnostics cannot retain full results indefinitely or evict active authority |
| Browser memory exhaustion | History25, ledger256, save queue2, persisted record bounds | Fifty graph snapshots, STALE proposal, full-copy transit, graph-status message bypass, unreleased Blob URLs |
| GPU OOM | Checked CUDA allocation/error handling, current work/count bounds | Context/external allocations not represented by payload formula; controlled OOM fails without accepted result or graph mutation |
| Process exhaustion | Motif executes serially; fixed supervisor/cleanup/timeout | Other algorithm queue bypass and qualification/cleanup process work; global/device admission needs bounded policy |
| Expensive preview | Visual relations3000, per-edge64, selected edges≤10000 | Vertex topology/DOM unbounded by that budget; sampling must be computationally bounded and labelled |
| Deterministic model context work | Observation14000, prompt30000 and sampled entities | Full local entity index/counts/key arrays remain O(I); configured response body unbounded; cap bytes and reuse exact current index |
| Integer/typed-array overflow | safe JS integer checks, parser counts, checked native multiplication, Triple12-byte assertion and bounded grid/candidate count | Limit increases/binary encoding need fresh uint32 offsets/index and u64 count overflow proofs; never truncate/wrap |
| Malicious IDs/sort/hash | ≤512 chars and typed nonblank safe identifiers in incidence mapping | Many long common-prefix/Unicode/control IDs amplify key/locale/string allocation; graph mutation/import bounds need review; do not change semantic ID equality casually |
| Crash/orphans | graceful process-group/temp cleanup before acceptance | Abrupt Runtime/browser death can leave work/temp/token files; cleanup must be scoped to verifiable owned resources, not broad temp deletion |
| Release-local assets | package path/mode/CRC validation, ignored native/local files in Git | Packager enumerates files ignoring Gitignore; local build/qualification may be included. It excludes Git/artifacts still required by qualification; extracted CUDA fails closed. A release verifier migration must preserve exact provenance |

These are hypotheses and source-backed readiness gaps with explicit prerequisites. No new exploit, unauthorized code execution or accepted stale result was demonstrated. Product support ceilings (e.g. E216 effective motif capacity) are distinct from adversarial aggregate admission controls (e.g. many individually legal uploads).

## Optimization security review matrix

Every proposal below is future work; cached data never creates executable authority.

| Optimization | Attack/currentness risk | Required rule / gate |
| --- | --- | --- |
| Immutable graph/preview sharing | Mutation after validation, reused wrong lineage, FNV collision | Owned immutability with typed/schema exact content; base ID/version/type/content/current epoch independent; collision tests |
| Early preflight / byte-aware history | Wrong rejection or undo restoring old approval | Count/byte work checked without semantics change; undo new commit; no prior result restoration |
| Exact hashed JSON bytes reuse | Different serializer/order/media under same logical graph; stale revision | Cache exact bytes+SHA+schema/media/length and graph authority; no fingerprint-only key |
| Artifact presence/Runtime-local cache | Stale handle after restart/eviction/corruption, cross-tab presence becomes authority | Runtime-session and generation key, bounded pins, recheck bytes/hash as required; cache miss safe reupload; no shared approvals |
| Prepared host/native data | Reused OLD under new version/type; backend changed after cache entry | Exact artifact digest/schema, build/qualification/device/mode invalidation; independent live job/result binding |
| Result payload caching | Old job/request/session result replay accepted as current | Initially permit descriptive historical data only; fresh compute or explicit new protocol binds fresh execution. No fabricated execution or transparent registry replay |
| Terminal eviction and queue deadlines | Evict active result/allow queued cancelled job launch | Pin active/current; expired/unknown IDs fail closed; queued deadline/cancel checked immediately before spawn |
| Binary/streaming transport | Offset/length overflow, partial publication, mutable buffer TOCTOU | Versioned closed schema; bound size before alloc; exact hash before publish; safe arithmetic; snapshot immutable buffers |
| Compression/shared buffers | Bombs, mutable cross-origin/tab data, new privacy access | Defer until measured; decoded ratio/CPU caps and strict ownership/isolation headers required |
| Persistent native worker/pool/streams | Cross-job memory, leaked contexts, stale prepared bytes, incomplete kill | New reviewed protocol and cancellation/resource reset; bound contexts/workspaces; exact request identity; fixed executable and no fallback |
| Explicit update composition | Cross-base mixing, reused approvals, collision/order confusion | Same unchanged base; sequential pure plan validation → final diff; fresh single update ID/revision/digest; revoke all superseded approvals/results |
| Assistant index/response cap | Stale selection/index, truncated schema misread as valid | Graph-authority cache key; complete index truth locally; strict failure on oversized/truncated response; model remains bounded proposal source |
| Release packaging / CI | Local hashes treated as published authenticity, untrusted PR GPU execution | Exact archive/source/binary manifest; no secrets/local records in source ZIP; trusted GPU release lane separate from public PR jobs |

STATIC=CUDA_STATIC; INCREMENTAL=CUDA_INCREMENTAL; 30 S3 classes (24 CLOSED_TRIANGLE,6 OPEN_WEDGE), DELETE_THEN_INSERT, REJECT_EXCEPT_EXACT_DELETE_REINSERT and DELTA_ONLY_NO_PRIOR_COUNTS are fixed. No optimization may add CPU fallback, STATIC fallback for incremental, implicit projection, result-authorized Apply, automatic Stage/Analyze/Apply, cross-tab action ownership or authority restoration from persistence.

## Review/qualification checkpoints

6A: client abort and UI retention must preserve epoch/currentness; package/privacy/provenance and clean extraction reviewed.
6B: immutability/index/history/early admission and visualization sampling reviewed with stale/collision/undo adversarial cases.
6C: cache pins/eviction/session identity, aggregate admission, queue/device ownership and orphan cleanup reviewed together; flood tests use an authenticated isolated test service.
6D: new native bounds/array products/worker lifetime/cleanup require independent native security and real-device qualification.
6E: integrated diff review, exact deployed bytes, browser/reload/two-tab/model/live GPU/soak evidence.
6F: separate composition authority design review before code.

Existing Scope 5 evidence supports the preserved correctness boundary. It does not establish adversarial aggregate throughput, active-kernel reset/cancel, unqualified hardware portability or Windows ACL privacy. Those uncertainties must stay explicit in release evidence.
