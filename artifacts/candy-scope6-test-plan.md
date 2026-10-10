# CANDY Scope 6 test and qualification plan

Baseline b24c4e32100d2e7c05b13df3c8f6f9e279fd8828. Future implementation gates only. This audit did not change tests or rerun large CUDA qualification. Existing Scope 5 final live/browser evidence is the preserved starting qualification.

Related: [gap register](candy-scope6-gap-register.json), [benchmark plan](candy-scope6-benchmark-plan.md), [threat model](candy-scope6-security-threat-model.md), [phases](candy-scope6-implementation-plan.md).

## Test classes and execution lanes

| Class | Purpose | Lane / blocking policy |
| --- | --- | --- |
| Correctness regression | Exact graph/update/result/confirmation semantics, no stale adoption or replay | CPU CI blocking; matching live native truth at release |
| Performance benchmark | Timing distributions, crossover and memory/copy improvements | Dedicated machine, generally informational PR data; stable release-machine comparison gates |
| Stress test | Boundary/burst admission and deterministic retained-resource ceilings | Bounded CPU fixture CI plus isolated Runtime/GPU stress; fail limits/currentness violations |
| Soak test | Hours/thousands of transitions, post-idle retained state and cleanup | Scheduled/trusted test host or manual release; not ordinary unit suite |
| Security/adversarial | Malformed/oversized content, substitution, cache/session/overflow/flood attacks | CPU integration blocking; independently reviewed changed trust boundaries |
| Manual browser | Visible confirmation, rendering, interaction, reload/two tabs and deployment policies | Real supported browser on exact release candidate; mounted DOM tests supplementary |
| Live GPU | Actual qualified binaries/device/toolchain/30-bin parity/failure cleanup | Protected matching GPU CI/manual host; explicitly unavailable on public CPU runners |

Never make noisy wall-clock thresholds blocking unit tests. Unit tests can block deterministic work/copy/DOM-count/retention limits, byte sizes and semantic parity. Never label simulated runner/capability fixtures as real native/GPU evidence.

## Existing gates to preserve

`scripts/run-node-tests.mjs` executes sorted .test.mjs files in separate Node processes. Scope 5 final evidence reports268/268 test files, focused15/15, lint, standard build, GitHub build and production audit clean at that time. Future tasks must use the actual current suite and lockfile; do not hardcode268 as proof of complete coverage after adding tests.

Existing test anchors:
- `tests/candy-scope5-graph-state.test.mjs`: graph authority/type/replacement.
- `tests/candy-scope5-pending-update.test.mjs`, `tests/candy-scope5-update-adapter.test.mjs`: owner/revision/diff/no-op/Apply.
- `tests/candy-scope5-confirmation.test.mjs`, `tests/candy-scope5-result-binding.test.mjs`: separate approvals and exact output binding.
- `tests/candy-scope5-races.test.mjs`, `tests/candy-scope5-concurrency.test.mjs`: late/reentrant work.
- `tests/candy-scope5-persistence.test.mjs`, `tests/candy-scope5-multitab.test.mjs`, `tests/candy-scope5-recovery.test.mjs`: inert restore and independent tabs.
- `tests/candy-scope5d-ui.test.mjs`, `tests/candy-scope5d-assistant.test.mjs`, `tests/candy-scope5d-lifecycle.test.mjs`: shared controls, mounted UI, disposal.
- `tests/candy-scope5f-collision.test.mjs`: real same-marker/different-content graph authority regression.
- `tests/portable-zip-paths.test.mjs`: source archive path/mode/content policy.

Qualification infrastructure: `candy-runtime/test/run-scope5f-live-qualification.mjs`, `candy-runtime/test/run-scope5f-collision-qualification.mjs`, `candy-runtime/test/run-scope5f-assistant-qualification.mjs`; frozen STATIC/incremental contract packers. Preserve production imports from the test directory until a reviewed compatibility migration.

## Correctness and authority regression matrix

| Gate | Required cases / expected result |
| --- | --- |
| C1 graph identity | Hypergraph↔DynamicHypergraph explicit transition; same exact content no-op; ordinary commit; same FNV/different content; identical-content replacement; clear/undo. Type/ID/version/content/currentness correct; no duplicate authority |
| C2 pending revision | One owner; Stage/Edit new ID/revision; no-op leaves no pending; metadata-only motifImpact NONE; structural disconnected zero delta allowed; STALE retains no apply authority; discard releases current pointer |
| C3 Apply | Fresh exact confirmation commits once, next version/type/proposed content match; Apply without analysis works with zero jobs; duplicate/reentrant/stale/superseded Apply rejected; result never permission |
| C4 analysis | STATIC/CUDA_STATIC and INCREMENTAL/CUDA_INCREMENTAL exact selection; owned expiring consumed confirmation before awaits; no CPU/STATIC fallback or implicit projection; render/navigation inert |
| C5 digest/artifact | Byte/schema/media/length exactness; serializer ordering and typed IDs preserved; FNV marker never SHA authority; corrupt graph/update/result file and metadata substitution reject |
| C6 results | Each graph ID/version/type/fingerprint, pending ID/revision/digest, session, job/request, artifact refs, device/backend/mode/taxonomy/native digest substitution rejects; signed30 safe integers and sums match; one current result |
| C7 races | Replace/type-change/Edit/discard/reconnect/restart/cancel/unmount during every await: feasibility hash, graph upload, update upload, submit attachment, status read, result read/validation; held genuine result cannot become current |
| C8 persistence/tabs | Reload VALIDATED, analysis approval pending, RESULT_READY and Apply pending; no executable state restored; two tabs independently stage/apply; same-origin inert storage cannot authorize cross-tab job |
| C9 reuse/eviction | Exact repeat data hit; same content but new lineage/version does not gain old approval; cache miss on session restart/eviction; media mismatch/corruption reject; pin active jobs; expired job/result IDs fail closed |
| C10 composition optional | Same exact unchanged base only; sequential pure plan preview equals composed final state; delete/reinsert collision policy; no-op/metadata; new revision/digest; all earlier approvals/results reject; one separate Apply |

C1–C8 block every phase that touches the corresponding path. C9 becomes blocking before cache/retention release. C10 is required only if optional6F is authorized.

## Deterministic boundary and stress gates

1. Motif E/I/work boundary: E216 singleton passes feasibility, E217/256 rejects W; E64 maxI2560 vs2561, E128 maxI624 vs625; both OLD and NEW checked. Empty rows reject independently; no synthetic empty-row loophole.
2. Generic adapter bounds: E/V/cardinality/I at limit and over; typed strings length512/513, blank, numeric safe/unsafe, mixed numeric1/string"1", long common prefixes, Unicode/surrogates/control text. Native mapping unchanged.
3. Pending admission: oversized base/plan/fan-out rejects before forbidden proposed copies under new budget; metadata-only and no-op remain correct; no new executable unavailable-analysis state unless separately designed.
4. Transport: UTF-8 byte count, base64 arithmetic, envelope at8MiB ±1, decoded6MiB, native2MiB, stdout8MiB/stderr64KiB; malformed base64, unsupported encoding/media, truncated/partial body, incorrect Content-Length, request abort/restart. No compressed data accepted without new protocol.
5. Aggregate resource reservation: many concurrently authenticated legal uploads/submits; max in-flight bytes/request count/work reservations, controlled admission error, no unbounded queued owned Buffers; release every reservation on abort/parse/hash/write/verification failure.
6. Retention: more than256 submissions in one session after6C; terminal eviction, job pinning, active/backlog limit, result/artifact references after expiry;512/64MiB artifact budgets before/after restart of override root. Current implementation expected RESOURCE_LIMIT; future test must prove sustained reuse, not raise cap endlessly.
7. Queue: long-running fixture plus queued requests; queue deadline/cancel before spawn; cancellation idempotent; SSSP/motif device ownership and external load behavior documented.
8. Browser: B1–B5 fixture families from benchmark plan; explicit visual vertex/incidence/DOM budget enforced before membership materialization; search/selection/render/export separate exact data; max edge list avoids quadratic index lookup; sampled UI labelled.
9. Live messages/export:10000 graph commits/status notices keep≤500 live messages after fix; every append path covered; repeated large download URLs revoked without corrupting files.
10. Persistence/cache:80-record/80-message/1M-character limits, quota failure, malformed inert records, save queue two snapshots, graph-scoped derived cache clearing; byte cap where introduced. Larger raw record is projected/rejected safely.
11. Assistant: outgoing observation≤14000 and applicable prompt≤30000, sampled mutation context remains small; cache/index stale selection rejects; oversized configured model response aborted at byte bound, truncated JSON never accepted. No graph body or trusted transport body sent.
12. Native integers: safe offset/index/count multiplication, candidate/grid/allocation near limits, signed deltas, uint32/size_t/u64 products; any new typed/binary array offsets checked before allocate and zero-copy shared bytes not mutated after validation.

Tests should assert observable resource invariants or authority decisions, not mirror individual implementation statements. Use spies only to prove rejection precedes expensive work where that is the promised boundary.

## Performance, soak and memory gates

Use benchmark B1–B7 definitions, seeds, warmups, repetitions, cold resets and raw artifact schema exactly as specified in the [benchmark plan](candy-scope6-benchmark-plan.md). Paired performance improvements need distributions/CI and no supported-fixture p95/memory regression. Do not promote one historical kernelMilliseconds value to a benchmark.

Soak separate lanes:
- Pure graph: L1=100,L2=1000,L3=10000 commits/edits/discards without jobs, plus repeated undo/replacement/type transitions.
- Analyzed: same lengths on fixed bounded S2/D2 topology, fresh revision/approval/request each cycle; current lifetime quota failure is recorded; post6C sustained success gate1000, optional10000 capacity/overnight gate with stop budget.
- Cancellation: queued and confirmed active native execution; repeat cancel/reconnect/dispose/result holds. Immediate cancel is not proof of active-kernel interruption.
- UI/persistence: many messages, bounded save pressure, reload four representative states, alternate tabs, export loop, storage quota failure.
- Runtime failure: native nonzero/invalid output/timeout, corrupted graph/update/result, disk full controlled test root, partial upload, network interruption, restart while uploading/preparing/queued/running.

At every25 transitions record live message count/history count/pending status/ledger diagnostics, current registry/job count, cache bytes/artifact bytes, Node heap/RSS/external memory, browser heap if supported, worker/timer/listener/Object URL counts and process/GPU memory. Use post-idle/GC diagnostic checkpoints separately from timed user runs. Plateau comparison against warmed stable workload is meaningful; exact GC timing is not a user guarantee.

Pass: counts/bytes within declared budgets, no accepted stale output, one commit per valid Apply, no unintended jobs, no owned process/URL/worker retained after cleanup deadline. Fail: sustained positive retained slope unexplained by intentional bounded warm caches; quota exhaustion below promised envelope; hidden errors/retries; dropped samples.

## Real GPU and failure qualification

Existing live Scope 5 seven cases/30-bin parity remain the anchor. Every changed native build runs:
- Independent genuine STATIC OLD, CUDA_INCREMENTAL OLD+update, genuine STATIC NEW for all feasible seeded shape/update families; OLD+delta=NEW in every bin and sum(delta)=delta total.
-30 S3 classes preserved (24 CLOSED_TRIANGLE,6 OPEN_WEDGE), DELETE_THEN_INSERT, REJECT_EXCEPT_EXACT_DELETE_REINSERT, DELTA_ONLY_NO_PRIOR_COUNTS.
- Exact binary/source/Makefile/toolchain/device/evidence qualification; output kernelLaunchSucceeded and synchronizationSucceeded true; no fake positive result.
- Confirmed active cancellation, process crash/output failure/timeout, controlled allocation OOM, cleanup and late-result hold/rejection.
- Driver-reset recovery only on an isolated operator-approved workstation; label omitted tests unavailable. No destructive active-GPU fault injection during this audit or ordinary CI.
- Cross-backend contention and peak memory observation; cache invalidation after binary/record replacement; persistent worker tests only if separately authorized.

Native fault fixture/profiler builds are not the production qualified binary; record their purpose and do not register them as qualified automatically.

## Manual real browser and portability

Exact candidate extracted outside repository; Windows PowerShell and cmd/batch, Unix sh/Linux, supported Ubuntu WSL. Verify lockfile installation, launcher cwd/path with spaces, fixed port collision and alternate frontend port configuration; fail closed when native build/qualification absent.

Visible gates: Stage/preview, separate Analyze confirmation, actual signed delta, separate Apply/no extra job, stale result after Apply/replacement/type transition, metadata/no-op messaging, Assistant shared controls, forged/quoted/negated text inert, reconnect/restart, four reload states and independent two tabs. Verify version-bound panel notice remains correct.

UI scale: large/skewed input, bounded preview list/node count, responsive pan/search/selection, no automatic computation from navigation, accessible virtualized list. Constant30-row motif result and bounded Runtime/current job should stay small.

Deployment: GitHub Pages/browser-only mode without companion; feature-enabled exact-origin pairing; real browser HTTPS→loopback/private-network behavior, localhost versus127.0.0.1, backend unavailable and wrong token/origin errors. Do not assume build success proves browser network policy.

Private Windows temp/qualification ACLs and WSL path/mount behavior need explicit deployment checks. Python required for packaging tests, not Runtime user startup. No Codex installation needed for portable product. Current qualified motif discovery does require Git/fixed historical tags and exact historical artifacts; source ZIP excludes both. Test extracted unavailable mode explicitly. Any CUDA-enabled distribution must independently qualify its release verification bundle/path instead of assuming rebuilding activates it.

## CI and release workflow

Public CPU GitHub Actions: checkout exact source, install supported pinned Node, npm ci, full regressions, lint, build, build:github, current npm audit production and full development report, deterministic fixture/pack/bound tests, portable source ZIP policy/clean extraction/hash checks. Audit network advisories are time-stamped; distinguish production from development and review remediation without uncontrolled lockfile changes.

GPU lane: protected trusted source, matching device/toolchain and no release secrets on untrusted PR runs; run actual qualification and dedicated perf/soak. Public runners explicitly report GPU unavailable; no PASS replacement with mocks.

Manual release lane: visible browser/installed model and extracted deployment, crash recovery and effective ACL checks, security diff review, exact archive/bin/evidence manifest and checksum publication. Release gates apply to exact final bytes after last change.

## Gap-to-gate coverage

| Gaps | Main gates |
| --- | --- |
| S6-01/02 | B1–B7, motif/native boundary, live parity/new envelope |
| S6-03/04/05 | C1–C3/C7, pending early rejection, history/undo and B1/B2 memory |
| S6-06 | visual vertex/incidence/DOM limits, B7 manual UI/accessibility |
| S6-07/08 | C5/C7/C9, exact bytes/envelope and B3 |
| S6-09/10/11/12 | C9, admission/retention/queue stress, B4/B6 |
| S6-13/14/15/16 | C7/C8, abort/messages/URLs/storage stress, B6 |
| S6-17 | bounded observation/index/response tests, C7, B7 |
| S6-18/19 | qualification invalidation, B4/B5/live native parity/failure |
| S6-20/21/22 | clean/populated package, newline/hash provenance, CPU/GPU/manual release lanes |
| S6-23 | crash/restart/owned cleanup/ACL/manual fault evidence |
| S6-24 | C10 plus measured burst/candidate-growth benefit |

## Audit-document validation (performed now)

Parse gap JSON; require every listed field/severity, unique IDs, nonempty acceptance criteria and valid dependency IDs. Check all seven expected files, sibling artifact links and explicit source file/line references. Check new text trailing whitespace/merge markers. Verify branch/HEAD/tags and no tracked protected delta or extra untracked files. git diff --check does not inspect untracked documents, hence separate text checks.

This validates deliverable integrity only; it does not make the future benchmark/implementation gates PASS.
