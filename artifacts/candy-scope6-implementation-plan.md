# CANDY Scope 6 phased implementation plan

Baseline b24c4e32100d2e7c05b13df3c8f6f9e279fd8828; qualified anchor54dd4d3edb73681f51bf8bb69b9708778a46a502; blocked checkpointbf0240a54fb6ac8284bd9ac371306511158a1a2e stays historical. **This is a future plan, not permission or implementation.** Hard stop after the seven-file audit.

Verdict READY FOR PHASED IMPLEMENTATION. [24 gaps](candy-scope6-gap-register.json):0 Critical,7 High,15 Medium,2 Low. The phase order follows current lifetime quotas, duplicate data work, native combinatorial bounds and packaging evidence. It deliberately starts with release hardening/measurement instead of assuming a CUDA-first feature expansion.

## Dependency order and checkpoints

6A → 6B → 6C → 6D → 6E; optional6F only after6E and a separate user request. 6C research can begin after6A baseline while6B remains under review, but combine changes only through qualified checkpoints. No concurrent edits to shared graph/controller/cache/Runtime paths without an explicit ownership plan.

Stable v7.3.14 candidate follows6A, before major6B–6D changes. If6A measured baseline is captured without production changes, release from qualified baseline plus corrected release engineering; if lifecycle fixes change source, qualify exact new candidate using unchanged native anchor. Never tag an old ZIP as current qualification.

Each future task starts by verifying branch/HEAD/clean state/qualified ancestry and preservation of source/binary/evidence hashes. Use an isolated branch/worktree only when the future task authorizes implementation. Record a fresh immutable checkpoint after completed gates, with user authorization for commit/tag/push. No commit/tag/push in this audit.

Rollback: browser/data changes revert as a phase together; cache/retention protocol changes retain compatibility or fail closed; native backends stay individually discoverable by their exact qualified build records. A previous qualified binary may be selected only as an explicitly discovered compatible backend, never an implicit incremental→STATIC/CPU fallback. Do not move existing tags or rewrite evidence.

## Invariants mandatory in every phase

- One committed graph authority with explicit Hypergraph/DynamicHypergraph type, ID/version/content and collision-safe no-op/replacement semantics.
- One authoritative pending revision. Typed GraphMutationPlan is sole Apply authority; deterministic motif transport is derived data.
- Material edits get fresh update ID/revision/digest; superseded/stale/replayed approvals reject.
- Separate analysis and Apply confirmations; consume before awaits; recheck exact currentness after async boundaries; Apply once independently of analysis and with zero Runtime jobs.
- STATIC→CUDA_STATIC; INCREMENTAL→CUDA_INCREMENTAL; exact graph/update/session/job/request/artifact/backend/device/taxonomy/native/result binding.
-30 S3 classes:24 CLOSED_TRIANGLE +6 OPEN_WEDGE; DELETE_THEN_INSERT; REJECT_EXCEPT_EXACT_DELETE_REINSERT; DELTA_ONLY_NO_PRIOR_COUNTS. No prior-count reconstruction, fallback or implicit projection.
- Model gets bounded selectors/summaries only and cannot create trusted transport/native/result bodies; rendering/navigation never auto Stage/Analyze/Apply.
- Persist descriptions only; reload fresh owners; tabs independent; reconnect/restart invalidates session-bound authority. Cached bytes never authorize actions.
- Limits/admission applied before expensive allocations, with independent Runtime/native revalidation; cleanup and failure cannot create accepted results.

## 6A — Release hardening, baseline and concrete lifecycle fixes

Objective: make the qualified product reproducibly releasable and establish trustworthy measurements before optimization. Resolve S6-01,13,14,15,20,21,22.

Allowed future components: `scripts/package-portable-source.py`, `scripts/verify-portable-archive.py`, existing release/docs/launchers; `src/App.jsx` download helper; `src/components/AgentChatPanel.jsx` append helper; `src/candy/client.js`, `src/candy/useCandyRuntime.js`, `src/candy/motifAnalysisController.js` request cleanup. If a CUDA-enabled portable product is selected, `candy-runtime/src/capabilities/motifQualification.js` release verification migration requires an explicit independently reviewed subgate. Future CI/test/benchmark tooling and new additive release manifests are permitted only within the later implementation prompt.

Forbidden: native/CUDA algorithms or limits, persistent worker, graph/pending/result schema changes, batching, fallback/projection, package dependency upgrades hidden inside hardening, rewriting Scope 5 records. Manifests/lockfile remain unchanged unless a separate justified tooling/dependency task is authorized.

Architecture:
1. Package policy explicitly selects source-only or separately qualified binary product. Source distribution excludes machine-local qualification/build assets; preserve production-imported contract modules under Runtime test directory. Current verifier reads excluded historical artifacts and Git tags, so rebuilding a clean source ZIP does not activate CUDA. Either document source/browser-only behavior and repository/evidence prerequisites, or design a versioned verified release bundle/identity contract with equivalent source/binary/environment/evidence checks. Never simply bypass Git/evidence qualification to make packaging pass.
2. Additive release manifest binds exact archive/source byte policy/qualification ancestry to b24c4e3 and54dd4d3, distinguishes blockedbf0240a and precommit evidence, records extracted checks. No claim a local unsigned qualification record is publisher attestation.
3. Central bounded append for every chat status/batch/continuation path; safe Object URL revoke after download and teardown.
4. Per-request operation deadline/AbortSignal owned by controller generation; reconnect/unmount cancels obsolete transport. Logical stale checks remain even after abort.
5. CPU CI for current lockfile full tests/lint/both builds/package; explicit unavailable GPU lane.
6. Seeded benchmark capture with spans or external observer; instrumentation must not generate graph authority or expose tokens.

Tests: C1–C8 relevant regressions, held late results/abort races,10000 status transitions≤500, repeated downloads/URL lifecycle, clean and populated package archive, path/modes/content/clean extraction, source newline/hash reproducibility.

Benchmark gates: B1–B7 baseline where feasible; do not run unqualified large native inputs. Native/transfer costs not yet observable get honest unavailable spans. Freeze noise floor and proposed relative gates/SLOs on named hardware.

Security review: changed cleanup/currentness and packaging/CI trust boundary. Verify allowed-origin/bearer/private file policy unchanged; no telemetry secrets; Windows effective ACL uncertainty documented.

Exit: exact candidate payload reproducible, current docs/limits truthful, critical lifecycle count checks pass, immutable benchmark/raw metadata and CPU gates available, real-browser baseline smoke and unchanged native qualification evidence bound to deployed bytes. Stable v7.3.14 release can follow after exact extracted release qualification and explicit publish authorization.

## 6B — Browser data-path and visual scale

Objective: reduce whole-state/retained work without changing graph authority or native envelope. Resolve S6-03,04,05,06,16,17.

Allowed future components: `src/graph/graphIdentity.js`, `src/graph/graphFingerprint.js`, `src/graph/graphHistory.js`, `src/graph/graphMutationEngine.js`, `src/graph/graphMutationPreview.js`, `src/graph/pendingHypergraphUpdate.js`; import normalization/batch paths in `src/utils/parsers.js`, `src/utils/batchUpdates.js` and shared App commit/summary/export call sites; incidence/projection adapters; Viz/visualization/derived modules; Assistant entity index/context and bounded model response reader; relevant tests.

Forbidden: qualified native limits/algorithm changes, new Runtime result schemas, implicit analysis projection, full large graphs in prompts, executable persistence, automatic batching. Larger editing/unavailable transport state is a separate design subgate; do not sneak it into a performance refactor.

Architecture:
- Cheap base/plan/fan-out admission before full mutation preview for known out-of-envelope pending inputs; document current editing vs analysis limits.
- Audit row mutability, then share immutable snapshots/checkpoints or use bounded byte-aware history. GraphState is only shallow frozen today, so reusing arrays requires owned immutability, not just caching object identity.
- Cache bounded exact canonical/serialized/index products per graph authority and pending revision. Avoid redundant canonicalization/fingerprinting only after collision-safe no-op behavior is preserved. Reuse immutable data, never old Apply confirmation.
- Bound selected visual vertices/incidences before topology/overlay allocation, virtualize edge/vertex lists, hoist membership highlights out of draw and replace map+indexOf. Sampling is labelled and never modifies exact analytics.
- Reuse graph index/counts for bounded Assistant samples, slice iterators before all-key arrays; response bytes capped independently of prompt/time. Keep bounded observation/type schema.
- Instrument current derived product and persistence bytes; add caps where measured, not speculative unlimited-option cache rewrites.

Tests: C1–C3/C5/C7/C8, same-marker collisions, exact undo/type/replacement, unsupported-size rejection before work, adversarial IDs/global operations, topology/sample bounds, index invalidation, oversized model response, inert storage quota failure.

Benchmark gates: B1/B2/B7 compare Stage/Apply/render/p95, transient/retained heap and history memory; no supported-input p95 regression beyond agreed noise. B1–B5 browser-only scale fixtures explicitly demonstrate bounded display/admission, not native support.

Security review: immutable aliasing/TOCTOU, short fingerprint confusion, cache generation/currentness, user-supplied plan/preview work, model sampling completeness and stale selection.

Exit: byte/count budgets measurable; browser data reuse cannot cross graph/revision; displayed sampled data truthful; no graph authority or native semantics changes; full regressions/manual browser and measured improvements pass. If larger Dynamic editing is desired, require explicit validated contract for analysis-unavailable state before advertising it.

## 6C — Runtime sustainability, exact artifacts and recovery

Objective: sustain repeated analyzed updates with bounded storage/host/GPU admission. Resolve S6-07,08,09,10,11,12,18,23; depends on6A measurement/cleanup and compatible6B byte ownership.

Allowed future components: `src/candy/client.js`, `src/candy/motifWorkflow.js`, existing analysis owner; `candy-runtime/src/server.js`, HTTP utilities/config, artifact store, job manager, motif adapter, backend qualification/runner and related integration tests.

Forbidden: CPU/STATIC fallback, result-authorized Apply, native algorithm/limits change, persistent native worker or parallel streams in this phase, indefinite result cache, unauthenticated/nonloopback service, broadened origins without separate deployment authorization.

Architecture:
1. Upload the same exact bytes that were hashed. Add compatible artifact metadata/presence lookup and bounded tab-local byte cache; cache handle is Runtime-session-scoped and recoverable on missing artifact.
2. Separate active/backlog admission from terminal diagnostic retention. Pin artifacts/jobs during active/current processing; explicit job expiry/eviction response fails closed. Define terminal count/byte/TTL policy and retained result scope.
3. Artifact pin-aware LRU/TTL and accurate override-root restart accounting; unknown persisted files remain untrusted until validated/registered. Bound bytes before owned Buffer creation and queueing.
4. Reserve aggregate in-flight HTTP/decode/verification/preparation work with admission slots/byte accounting; release exactly once on every error/abort. Add bounded backlog/queue wait/end-to-end deadline; keep native execution timeout distinct.
5. Coordinate device ownership across motif/SSSP before any concurrency increase; initial policy can remain one execution per device. External GPU activity documented and failures handled.
6. Reuse prepared immutable host data only when B4 proves material benefit: exact artifact/schema/mapping/build/qualification key, bounded bytes, changed file invalidation. Do not cache qualification solely by pathname/time.
7. Owned crash/restart cleanup and sanitized failure telemetry; no broad temp or arbitrary process deletion. New service session never adopts old approval/result.
8. Versioned raw-byte upload optional after B3 justifies it; preserve old JSON/base64 route and exact digest/media/length checks. Compression deferred.

Tests: C4–C9, session/revision/byte/media substitutions, restart/eviction/corruption/cache miss, terminal/active pins, concurrent admission/reservation cleanup, partial uploads, cancellation before spawn, deadlines, owned crash cleanup/Windows deployment.

Benchmark gates: B3/B4/B6; repeat same-base analysis avoids verified-present upload;1000 sequential real analyzed jobs in one Runtime session under fixed bounded terminal/artifact budgets; byte/RSS plateau and no queue SLA ambiguity. Cold/uncached measurements retained.

Security review: cache/data versus action distinction; filesystem/pinning/accounting; aggregate authenticated DoS; queue/device arbitration; executable verification invalidation and cleanup ownership. Independent recheck before every accepted result.

Exit: sustainable session without endless quota raises, deterministic expired-ID behavior, bounded requests/caches/diagnostics, safe recovery; integrated browser/Runtime regression and real qualified unchanged native tests pass.

## Safe reuse contract (6B/6C)

| Data product | Cache identity | Authority that must still be fresh |
| --- | --- | --- |
| Canonical graph/index/byte sequence | exact owned content/schema/serializer + graph ID/version/type/fingerprint context; byte SHA/media/length for artifact | live graph epoch/current ownership and confirmation |
| Pending preview/update bytes | exact base + pending ID/revision/updateDigest/planHash/proposed content and schema | current single pending owner and fresh independent Apply/analysis token |
| Runtime artifact presence | exact SHA/media/length + Runtime endpoint/session/generation; pin state | authenticated current session; new request/job/result binding |
| Prepared host representation | graph/update artifact SHA, mapping/packer schema, native source/binary/qualification/device/mode | job request/native digest, current qualified backend and native execution |
| Historical result payload | exact old request/session/artifact/taxonomy/build record, bounded descriptive storage only | none granted; cannot become current registry evidence automatically |

Graph artifact bytes can be reused across selector-only changes if exact same committed graph/body/media. Exact pending update artifact can be reused for repeated analysis of the same revision; material edits must change revision/digest and require fresh approval. Runtime dedup already saves retained identical file bytes, but not transfer. Cross-restart data may be rehashed as input, while old handles/session authority never survive.

Do not relabel old result with a new request/job/session to simulate execution. Result caching as current analysis would need a separately versioned protocol and explicit provenance/currentness/confirmation design; defer it.

## 6D — Measured CUDA/native efficiency and scale research

Objective: optimize measured native work and assess attainable next envelope. Resolve S6-02/19 only after6A–6C isolate overhead.

Allowed future components: both motif native source/Makefiles and frozen transport/validation modules, qualification discovery/limits, dedicated native/fixture tests and benchmark tooling, with explicit new native change authorization.

Forbidden: changing taxonomy/order/collision/delta contract, prior counts/fallback/projection, raising limits without bounded algorithm/memory proofs, persistent worker/pools/streams in one bundled rewrite, manufacturing qualification records.

Order:
1. B5 crossover on unchanged binaries across affected count/shape; host enumeration/process/transfer/device timing.
2. Direct affected candidate generation or tighter OLD/NEW host lifetime if measured; validate cardinality no duplicates/omissions and checked arithmetic.
3. Per-process reusable allocation/transfer workspace and optional pinned memory only if allocation/transfer profile warrants; explicit failure cleanup.
4. Scalable algorithm design for large E/I separate from current-envelope optimization. Set next realistic support target after feasibility, not10k/100k by decree.
5. Persistent native worker/device-prepared graph only if process/context dominates after host reuse; separate protocol/security/termination/requalification subphase.
6. Pools/multistream/GPU concurrency only if device utilization and safe scheduler/memory measurements justify; initially defer.

Tests: independent live30-bin parity for all feasible fixture/update families, overflow/allocation/candidate count/native digest negatives, active cancel/timeout/crash/OOM, build source/binary/device exact qualification.

Benchmark gates: paired kernel/process/user-latency results, held-out crossover surface, peak host/device memory; ≥10% median end-to-end gain with CI excluding no gain and no agreed p95/resource regression. Any new limits have independent browser/Runtime/native admission and resource proofs plus newly qualified live workloads. Current bound rejection remains until that gate.

Security review: native parse/array size/count overflow, prepared state lifetime, host/GPU memory ownership, process-group termination and exact fixed binary verification. Changed native build is unqualified until successful new evidence.

Exit: measured improvement and safe failure behavior, preserved semantics; honest capacity/recommendation docs. If scale research finds no feasible new large envelope, keep limits and report that result rather than hiding it behind larger config.

## 6E — Integrated qualification and performance release

Objective: validate exact final source/binary/archive/environment after all accepted changes, with rollback evidence.

Allowed future components: release/qualification/benchmark scripts, documentation and additive evidence. Production corrections require reopening their owning phase; no new features in final qualification.

Forbidden: moving historical tags, rewriting Scope 5 evidence, passing unavailable GPUs with fixtures, publishing before exact final-byte checks or claiming benchmark support from kernel-only samples.

Tests: full current CPU suite/lint/both builds/package integrity/audits; real supported browser/Assistant/reload/two-tab; matching genuine GPU/class parity/lifecycle;1000 analyzed-update soak and selected10000/overnight stress under explicit budget; relevant security diff review.

Benchmark gates: B1–B7 raw samples/hardware/software/hash manifests, baseline/treatment comparison, noise/confidence/failure reporting, all revised support limits demonstrated; exact clean extracted product validates packaging and deployment.

Security review: integrated optimized cache/controller/store/native boundary, no cross-session/revision/tab authority, credential/privacy/CI artifact provenance. Unresolved correctness/authority High/Critical blocks release; unavailable hardware gates explicitly block that hardware support claim.

Exit: source/binary/archive/fixture/environment digests and truth/perf/soak/browser evidence all bind final candidate; release notes truthful, known limitations explicit, rollback checkpoint retained. Publish only after later explicit release authorization.

## 6F optional — Explicit draft composition

Objective: amortize update bursts only if B4/B5 and user workflows demonstrate worthwhile benefit. S6-24 is Low; automatic batching is not recommended now.

Allowed future components: typed plan composition, pending owner/controls, deterministic update projection, bounded UI and exact composition tests. New user instruction required.

Forbidden: multiple simultaneous authoritative pending updates, auto apply/analyze, replayed approval, summing deltas across already committed bases, hidden coalescing of separately confirmed Apply actions.

Design: revisions normally represent alternatives/edits against one base, not a historical sequence to execute. An explicit compose command must select intended operations, validate their pure sequential effects against one unchanged base, build a new typed plan with fresh identity, derive final net DELETE_THEN_INSERT diff and emit a fresh single pending revision/digest. Earlier revisions/confirmations/results become stale. Final no-op has no pending action. Metadata-only remains unanalyzable; Apply separate and once.

Already applied revisions changed the base; they cannot be folded into this pending batch by reusing old authorizations. Intermediate-result visibility/undo/user intent differ from one final transition and must be explicit.

Tests: C10, order/collision/no-op/global vertex effects/final graph exactness, stale base during compose, material metadata/content edit, fresh digest/replay rejection, bounded composition work.

Benchmark gates: same final service contract, measured burst savings without unacceptable affected-work growth; do not compare one final batch result to every intermediate result as equivalent output.

Security review: composition intent/base/version/confirmation/currentness and rollback/undo semantics before coding.

Exit: explicit UX/authority contract qualified with net graph/native parity and real measured benefit. Otherwise omit6F.

## Practical future prompt boundary

Each phase prompt should state exact baseline and allowed files, list relevant gap IDs, copy mandatory invariants, set resource/workload budgets, name CPU/browser/GPU gates, forbid other phase work and require a final exact diff/evidence report. Ask for publish/commit/tag separately where not already authorized.

High-risk files: pending owner/identity/fingerprint (collision/replay), shared App commit/history, analysis owner/registry (late async/confirmation), job manager/artifact store (pins/eviction/admission), qualified backend verifier/runner (fixed execution/cleanup), native main.cu (truth/overflow/device lifecycle). Favor small independently reviewable changes and checkpoint before combining them.

Implementation scope is entirely future. This audit authorizes no edits beyond its seven documents and concludes with an integrity-checked hard stop.
