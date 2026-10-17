# Scope 6B corrective qualification closure

**PASS WITH EXPLICIT DEFERRED ITEMS** — completed 2026-10-17 after machine restart.

The original [NON-PASS implementation report](candy-scope6b-implementation-report.md) and [original qualification](candy-scope6b-qualification.json) remain unchanged. This is additive corrective evidence. Branch: `candy-integration-scope6b-browser-scalability-v7_4`; HEAD remains `da4629b1f4204fbfc8f8e6d14941d29319d79e90`. Nothing committed, pushed, tagged or merged; Scope 6C/6D not started.

## Cold blocker: RESOLVED

The threshold remains candidate B1 p95 no more than 10% above the exact qualified baseline. The completed uninstrumented randomized/interleaved study has four independent Node processes, 12 discarded warmup pairs plus 100 measured fresh-state AB/BA pairs per fixture/process. Each measurement creates graph state, an empty-before/committed-after history event and fresh history append; input copying is outside timing. All 1200 measured pairs have identical baseline/candidate short fingerprints. Full correctness also uses exact canonical serialization, not marker equality alone. Raw samples, per-session distributions, hardware and source hashes are in [cold AB/BA evidence](candy-scope6b-corrective-cold-abba.json). Both 266-file baseline manifests were additionally checked against exact qualified git blobs; all differences are only LF/CRLF checkout representation, with zero content mismatches ([consistency check](candy-scope6b-corrective-baseline-consistency.json)). The initial raw-byte comparison and its line-ending false positives are retained separately.

| Fixture | Baseline median / p95 ms | Candidate median / p95 ms | p95 delta ms | p95 delta % |
|---|---:|---:|---:|---:|
| S1 | 0.0667 / 0.1697 | 0.0483 / 0.0942 | -0.0755 | -44.49% |
| S2 | 0.2815 / 0.5056 | 0.1692 / 0.4138 | -0.0918 | -18.16% |
| B1 | 41.9605 / 47.8148 | 21.9403 / 28.3962 | -19.4186 | -40.61% |

B1 p95 is **28.3962 ms versus 47.8148 ms**, a 40.61% reduction. All four B1 session p95 values pass. The earlier order-confounded comparison and the initial corrective pre-optimization regression are retained, not substituted for this result. Recovery verified all measured production source hashes still match; no costly measurements were repeated after restart.

## Profile and production correction

Temporary exact source copies were instrumented before the production edit. The [pre-correction profile](candy-scope6b-corrective-profile.json) and [post-correction profile](candy-scope6b-corrective-profile-after.json) retain per-component inclusive/exclusive samples. Five warmups and 30 fresh-state samples per fixture; instrumentation overhead included, so gate decisions use the separate uninstrumented study. B1 medians/p95:

| Component (inclusive; nested) | Before median / p95 ms | After median / p95 ms |
|---|---:|---:|
| source_detachment | 7.6205 / 14.2879 | 7.7834 / 10.3573 |
| deep_freeze | 1.6693 / 2.0168 | 1.4143 / 2.7711 |
| plain_data_audit | 2.2130 / 3.0242 | 2.1658 / 9.2664 |
| canonical_creation | 30.4378 / 36.1568 | 1.6278 / 2.4640 |
| canonical_serialization | 5.1336 / 12.1556 | 4.6690 / 8.1577 |
| fingerprinting_total | 36.9404 / 44.5842 | 7.4691 / 11.0904 |
| identity_id_creation | 0.0082 / 0.0099 | 0.0084 / 0.0094 |
| identity_version_total | 36.9529 / 44.5970 | 7.4799 / 11.1029 |
| history_snapshot_retention | 0.0258 / 0.0288 | 0.0253 / 0.0299 |
| snapshot_byte_accounting | 1.8597 / 2.0851 | 1.8690 / 2.1028 |
| derived_invalidation | 0.0024 / 0.0028 | 0.0024 / 0.0038 |
| graph_state_total | 53.0997 / 62.9116 | 19.8971 / 26.5008 |

Canonicalization dominated the avoidable work. The only corrective production change reuses one private `Intl.Collator(undefined, {numeric:true, sensitivity:"base"}).compare` in `src/graph/graphFingerprint.js`, instead of passing those locale options to `localeCompare` for every sort comparison. Canonical creation median fell from 30.4378 to 1.6278 ms. Ownership/detachment, deep freeze, plain-data audit, exact snapshot JSON accounting and undo retention were preserved. Counts/planner indexes are not created by this cold path (zero); derived activation is measured separately inside the profiled operation. Identity/version envelope and other work appear as exclusive function timings. Inclusive nested rows must not be added together.

The corrective regression test covers 100 seeded permutations, numeric IDs, large numerals, Unicode/case/accent/decomposition ties, two graph types, exact legacy serialization and legacy fingerprints. Stable sort ties remain stable. Determinism matches the existing default-locale/ICU semantics; there is no new promise of identical collation across arbitrary locales or ICU versions. The collator retains no graph content or mutable user state. Collision safety still requires full authority serialization comparison when short markers match. The test was also rerun successfully after restart.

## Matched browser timing

The exact archived baseline and candidate were served at separate fresh origins, ports 5180/5181, with HTTP 200 before automation. Observation probes existed only in temporary copies. Three ordinary reload sessions per phase for S2/B1 and three matched Dynamic sessions per phase were interleaved. Full function/automation/render data and setup provenance are in [browser evidence](candy-scope6b-corrective-browser.json) and [raw samples](candy-scope6b-corrective-browser-raw.json).

Application conversion body and the interval from its completion to the observed paint opportunity are distinct:

| Fixture | Baseline conversion-body median ms | Candidate body median ms | Baseline body-end to paint median ms | Candidate body-end to paint median ms |
|---|---:|---:|---:|---:|
| S2 | 2.90 | 2.20 | 174.60 | 144.50 |
| B1 | 140.80 | 105.20 | 307.20 | 284.30 |
| B5 | not run | 2072.00 | not run | 1746.10 |

Input-to-settle/paint-opportunity timings below are descriptive. They use two animation frames after the latest root DOM mutation, with generation guards cancelling earlier callbacks. They are not compositor/GPU completion measurements. Development StrictMode and probe overhead apply; n=3 p95 is the observed maximum, not a statistically established browser SLO. Export activation has an extra activation for exact download in session 0.

| Fixture / suite / action | Baseline median / p95 ms | Candidate median / p95 ms | Median delta ms |
|---|---:|---:|---:|
| S2 ordinary conversion | 194.30 / 202.20 | 164.00 / 188.50 | -30.30 |
| S2 ordinary statistics | 27.90 / 32.30 | 36.10 / 42.50 | 8.20 |
| S2 ordinary mapping_activation | 54.70 / 59.60 | 28.30 / 39.40 | -26.40 |
| S2 ordinary export_activation | 49.70 / 179.30 | 19.90 / 43.00 | -29.80 |
| S2 ordinary circular | 60.10 / 68.10 | 47.70 / 306.50 | -12.40 |
| S2 ordinary grid | 59.50 / 60.90 | 47.30 / 47.40 | -12.20 |
| S2 ordinary force | 26.70 / 60.10 | 48.60 / 52.30 | 21.90 |
| S2 ordinary preview_size | 84.00 / 84.70 | 77.80 / 80.20 | -6.20 |
| S2 ordinary vertex_search | 63.10 / 65.50 | 55.40 / 62.10 | -7.70 |
| S2 ordinary hyperedge_search | 44.50 / 45.80 | 41.90 / 44.60 | -2.60 |
| S2 ordinary exact_export_initiation | 27.40 / 27.40 | 25.20 / 25.20 | -2.20 |
| S2 dynamic conversion | 235.90 / 245.80 | 181.50 / 477.10 | -54.40 |
| S2 dynamic dynamic_stage | 338.50 / 431.80 | 40.70 / 105.40 | -297.80 |
| S2 dynamic dynamic_inspect | 98.60 / 104.90 | 41.30 / 45.90 | -57.30 |
| S2 dynamic dynamic_apply_commit | 113.60 / 179.60 | 163.30 / 167.30 | 49.70 |
| S2 dynamic assistant_activation | 32.90 / 35.00 | 28.90 / 30.80 | -4.00 |
| S2 dynamic undo_prepare | 69.90 / 80.10 | 60.20 / 160.10 | -9.70 |
| S2 dynamic undo_commit | 141.80 / 165.10 | 71.50 / 72.60 | -70.30 |
| B1 ordinary conversion | 472.50 / 1965.80 | 415.10 / 503.60 | -57.40 |
| B1 ordinary statistics | 131.20 / 133.80 | 63.90 / 67.70 | -67.30 |
| B1 ordinary mapping_activation | 163.30 / 167.90 | 131.80 / 139.40 | -31.50 |
| B1 ordinary export_activation | 63.70 / 65.50 | 51.40 / 88.90 | -12.30 |
| B1 ordinary circular | 60.50 / 62.20 | 39.30 / 61.20 | -21.20 |
| B1 ordinary grid | 64.00 / 65.60 | 103.20 / 173.10 | 39.20 |
| B1 ordinary force | 64.00 / 66.80 | 36.60 / 37.40 | -27.40 |
| B1 ordinary preview_size | 126.90 / 194.50 | 87.10 / 141.00 | -39.80 |
| B1 ordinary vertex_search | 154.50 / 158.40 | 110.80 / 128.60 | -43.70 |
| B1 ordinary hyperedge_search | 55.50 / 82.30 | 84.80 / 90.00 | 29.30 |
| B1 ordinary exact_export_initiation | 23.10 / 23.10 | 41.30 / 41.30 | 18.20 |

Regressions and scheduling outliers remain visible in this table and raw samples, including some small-fixture Statistics/Force and B1 Grid/hyperedge-search paint opportunities and Dynamic Apply. The B1 cold threshold is not redefined to hide them. No separate numerical browser p95 acceptance threshold was specified; all required operations completed with correct state. Full AppCore/Viz render-function timings, each named operation and automation durations are separate JSON fields. Nested function timings must not be summed. Capture-listener microtask `handlerTaskMs` is not treated as complete application handler time. Prior warm mapping/statistics micro-regressions remain in the original performance evidence; no extra optimization was added for them.

## Final uninstrumented production closure

After restart, only `npm.cmd run preview -- --host 127.0.0.1 --port 5183 --strictPort` was started from the repository. PID 46132, URL `http://127.0.0.1:5183/`, HTTP 200. The existing standard production build is uninstrumented and was produced after the final production correction. The measured source hashes and retained automated gates were verified before reuse. The service and task-created tab were stopped after checks. Runtime and Ollama were not started; old credentials were not reused. See [readiness](candy-scope6b-corrective-recovery-http.json) and [production checks](candy-scope6b-corrective-recovery-browser.json).

Small example: 3 hyperedges / 5 vertices; S2: 64 / 512; B1: 10,000 / 40,000. Conversion, normal tabs/mappings, layouts, vertex/hyperedge searches and byte-exact exports passed. Dynamic Stage/Inspect left version 2 unchanged; explicit Apply committed version 3 once; explicit Undo restored byte-identical H2V content under version 4. Replacing a staged graph marked the old proposal STALE, disabled Apply/Analyze and reported no current pending delta result. B5 -> S2 replacement produced exact S2 export, version 8, and Assistant context 64 H / 512 V. No stale graph or cached export became authority. Existing genuine Runtime evidence remains hash-identical; the corrective collator introduced no Runtime-specific execution path.

B5 accepted **1 hyperedge, 1,000,000 vertices and memberships**. Before layout, the displayed subset was 1 hyperedge / 1,000 vertices / 1,000 memberships, with truthful source-order subset labels and complete-graph export/statistics scope. Eight post-restart Circular/Grid/Force/search cycles alternated found and absent-in-subset cases; DOM counts remained **795–798** with the task's retained chat/history UI. The earlier clean production session stayed **520–523**; these are separate observed UI states, not replaced measurements. The exact B5 download was **10,000,002 bytes**, SHA-256 `64f702ecd3b984c18f8e48078a5b8cc4cbf9f95fc4ed0f0f969d2d87bbd70113`. No application timeout, browser crash, console warning/error or growing DOM was observed in final checks.

The document-wide text query was reproduced timing out in **1,010 ms of automation time** while narrow selectors and actual search worked on the same B5 graph. Exploratory coordinate hit-testing also failed on baseline and candidate Dynamic controls. Stable keyboard activation passed matched and final production flows. Upload automation now waits for the Loaded notice and exact input length; chooser completion alone precedes asynchronous file reading. All failed harness/selector attempts are retained. They are not counted as application search latency.

## Explicit deferred items and capacity boundaries

- **HEAP TELEMETRY: DEFERRED.** Precise trustworthy retained-heap / controlled-GC interfaces were unavailable. `measureUserAgentSpecificMemory` and `gc` were undefined; the page was not cross-origin isolated. Legacy `performance.memory` exists but no precise per-page retained-heap accounting was established. No heap estimates or plateau claim are supplied. [Memory evidence](candy-scope6b-corrective-memory.json) distinguishes guarantees/proxies from direct measurement.
- **B4 >10 MiB: OUTSIDE CURRENT ADMISSION CONTRACT / DEFERRED.** The unchanged 10,485,760-byte admission limit correctly rejected 20,688,889 bytes. The stored uninstrumented rejection completed in 42 ms automation roundtrip, showed the exact byte reason, preserved graph identity/input, and left search usable. No repeat of this intact evidence was necessary after restart. No qualification at B4 size is claimed.
- Automation-only broad selector / pointer hit-testing limitations remain explicit. They do not indicate a failed application search or authority transition.

Retention guarantees are 25 history events / 32 MiB unique snapshot UTF-16 JSON accounting, 32 derived-cache entries / 16 MiB top-level string accounting, pre-layout preview budgets, bounded mapping cells/rows and compact Assistant snapshots. These are **not engine heap caps**. Nested object cache values remain count-bounded rather than fully byte-accounted; weak-key caches do not prove prompt collection. Full input, active exact exports, canonical serialization and a first on-demand planner index can still cost time/memory proportional to admitted data. B5 cold conversion remains seconds in the instrumented browser (one sample); it is not claimed instantaneous.

## Automated and security closure

**279/279 test files PASS in 158 s; lint PASS; build PASS; build:github PASS; fresh production audit 0 vulnerabilities.** The final timestamp audit found that the browser-preparation evidence script had changed after the earlier 279-file run. All automated gates were therefore rerun after restart. Production/source/test implementation remained unchanged; the completed performance measurements were retained by exact source hashes. Corrective script syntax checks and the collation test passed after restart. All 33 original evidence hashes match. No Runtime/native/package-manifest edits, staged changes or moved HEAD/tags were found. [Security/reliability recheck](candy-scope6b-corrective-security-recheck.json) identifies no unresolved Critical/High issue. The prior managed scan with zero findings and its original snapshot warning remain intact; this is a narrower corrective review, not a new managed full scan.

The private stateless collator introduces no mutable graph escape, graph-content cache, authorization path or unbounded per-input state. Existing ownership, exact identity, versioned cache invalidation, pending/session/revision confirmation and Runtime-result bindings remain intact.

The normal expired-pairing-file deletion command was rejected by automatic approval review as “blocked by policy” before execution. An independent read-only check found the file already absent; no workaround, leftover credential or credential reuse occurred.

**Hard stop:** report prepared for human review. No commit, push, tag, merge, main modification, qualification-tag move or Scope 6C/6D work.
