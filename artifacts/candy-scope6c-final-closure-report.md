# Scope 6C exact-SHA remote CI closure

READY FOR SCOPE 6C QUALIFICATION TAG AND MAIN PROMOTION

Candidate: `46ae55173407bb71683614ef212d9d4d4127ecc3`. Scope 6B baseline: `61e3dda985b74be35e98f1e6b3886d33b58a4bfd`. Branch: `candy-integration-scope6c-runtime-reuse-recovery`. HEAD, origin tracking ref and live remote branch all resolve to the exact candidate. No tracked or staged changes; untracked qualification evidence is expected.

## Exact-SHA CI

Observed 2026-10-18T20:27:14.950Z through authenticated read-only GitHub REST. Every workflow run, job and check-run below explicitly reports head SHA `46ae55173407bb71683614ef212d9d4d4127ecc3`, completed/success. No earlier-SHA green result was reused. macOS/Windows labels map to the actual macos-latest/windows-latest matrix job names.

| Required check | Run / attempt | Job / check ID | Result |
|---|---|---|---|
| CPU regression and browser source release / push | [39162477035](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/39162477035) / 1 | [117778484851](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/39162477035/job/117778484851) | PASS |
| CPU regression and browser source release / pull_request | [39162530735](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/39162530735) / 1 | [117778648070](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/39162530735/job/117778648070) | PASS |
| CI / Build, lint and test (Ubuntu) | [39162530741](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/39162530741) / 1 | [117778648037](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/39162530741/job/117778648037) | PASS |
| CI / Build and test (macOS) | [39162530741](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/39162530741) / 1 | [117778648348](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/39162530741/job/117778648348) | PASS |
| CI / Build and test (Windows) | [39162530741](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/39162530741) / 1 | [117778648323](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/39162530741/job/117778648323) | PASS |

The legacy commit-status endpoint contains zero contexts and returns its empty aggregate pending value. This is not a pending required check: the five GitHub Actions check-runs, their jobs, and all three workflow runs are completed/success. Raw responses, step outcomes, IDs, URLs and timestamps are preserved in [CI observation](candy-scope6c-remote-ci-observation.json). Connected GitHub tools returned 404; existing local repository authentication allowed REST verification. No credential was printed or saved.

## Qualified bytes bound to commit

All 34 implementation files match saved qualification hashes: 17 committed blobs match raw hashes exactly; 17 match after Git clean/line-ending normalization (core.autocrlf=true). Across all 629 saved source/test files, 408 match exactly and 221 through Git normalization. For normalization cases the current raw bytes match the saved qualified SHA-256 and git hash-object --path --stdin yields the candidate blob OID. No substantive byte difference was found. The committed changed-path set exactly equals the qualified 34-file implementation inventory. Full per-file raw SHA-256/blob OID proof: [identity binding](candy-scope6c-committed-identity-binding.json).

All 64 prior qualification-evidence files (including the old final inventory) still match recorded hashes. All 420 protected historical/native/manifest files match their prechange hashes. Historical files retain their original baseline/uncommitted metadata; this additive report binds those observations to the later committed candidate without rewriting them. The 1,000-job soak, browser qualification and local gates were not rerun.

## Preserved qualification and authority

The local/Runtime/browser verdict remains **PASS WITH EXPLICIT DEFERRED ITEMS**. Existing evidence confirms 284/284 test files and five focused files pass; lint, build and build:github pass; production audit has 0 vulnerabilities. The isolated soak passed 1,000 genuine CUDA jobs. STATIC remains CUDA_STATIC; INCREMENTAL remains CUDA_INCREMENTAL. No CPU fallback, STATIC fallback for incremental, implicit projection or Analyze→Apply coupling is introduced.

Qualification parsing is bounded and keyed by current exact bytes; every verifier still reads/checks source, executable, evidence, tags and environment. Discovery shares a fresh environment observation only within that call. Browser upload reuse is exact-byte/session-scoped and requires authenticated metadata. No cache grants qualification, session, graph, pending-update, result or mutation authority. New Runtime instances use new credentials/session/job Maps; UUID handles are never rebound. Old active jobs do not resurrect. Browser loss revokes readiness/capabilities/current results, and explicit fresh pairing/discovery plus new confirmation is required. Committed code and linked regression/evidence paths are recorded in the [closure JSON](candy-scope6c-remote-ci-closure.json).

## Retention, cleanup and recovery

Terminal history is bounded at 32 jobs / 16 MiB serialized accounting; active/queued admission is at most 16, with active jobs never evicted. Artifacts are bounded at 512 items / 64 MiB, with a 6 MiB item limit. Unpinned LRU and oldest terminal pressure expiry unpublish handles before releasing files. The genuine soak plateaued at 32 jobs and 511 artifacts (514 root entries, including marker/PID files and the empty workspace directory). Queue depth, workspaces and owned live/zombie process counts were zero at drained checkpoints; peak concurrent native supervisor handles was one. Small-budget tests prove active pin preservation, terminal eviction, old job/result 404, and subsequent valid execution.

Recognized orphan digest files/workspaces are reconciled under exclusive marked-root ownership; unknown files, links and changed roots fail closed. Production cleanup uses scoped regular-file unlink and empty-directory removal. Failed/cancelled outputs/workspaces are removed; cleanup errors remain truthful and block unsafe continuation. Clean and abrupt final-code restart, fresh authentication/reconnect, stale credential 401, old active/terminal job/result 404 and successful subsequent genuine work all passed. Browser reconnect and independently confirmed Apply/Edit/Discard passed. Final owned roots were disposed and project-native process count was zero. See [retention](candy-scope6c-retention.json), [clean recovery](candy-scope6c-restart-recovery-post-restart.json), [abrupt recovery](candy-scope6c-abrupt-recovery-final.json), [browser qualification](candy-scope6c-browser-qualification.json), [final cleanup](candy-scope6c-final-abrupt-cleanup.json).

Observed RSS was 144191488–229883904 bytes for the combined service and measurement harness. Serialized/source-byte bounds and observed process counts are structural evidence, not direct heap measurements. No new memory claim is made.

## Shutdown observation

The stored shutdown sample is 7.6876 ms before and 220.6629 ms after (difference +212.9753 ms). The after run included 1,000 additional jobs, substantially more retained artifacts (511) and actual selective cleanup. Workloads differ; this is not classified as a matched regression. The observation is retained without altering the historical performance report. See [exact measurements](candy-scope6c-performance-comparison.json).

## Protected boundaries and security

There is no committed delta under candy-runtime/native/** or to package.json, package-lock.json, candy-runtime/package.json or candy-runtime/package-lock.json. Local and live remote peeled anchors remain:

- `candy-integration-scope6b-browser-scalability-qualified` → `61e3dda985b74be35e98f1e6b3886d33b58a4bfd`
- `candy-v7_4-merged-baseline-qualified` → `da4629b1f4204fbfc8f8e6d14941d29319d79e90`
- `v7.3.14` → `9d79d9f9027b338096d7cf62d67c2a22e9cab247`

No unresolved Critical/High issue remains in the qualified implementation. This reconfirms the preserved final security/reliability review and corrective follow-up against identical committed code; it does not claim a new scan. The pre-correction canonical scan remains distinguished from the final corrective review. Covered concerns include authentication, stale authority, cross-job/session leakage, ID rebinding, traversal/unsafe deletion, orphan processes/zombie jobs, retention, incremental currentness and secret/token logging. [Review evidence](candy-scope6c-security-review.md).

## Exact committed delta

Git confirms **34 files changed, 1,118 insertions, 90 deletions**. No deleted paths.

| Status | Path | Added | Removed |
|---|---|---:|---:|
| M | `candy-runtime/src/artifacts/artifactStore.js` | 92 | 22 |
| A | `candy-runtime/src/artifacts/ownedRoot.js` | 125 | 0 |
| M | `candy-runtime/src/backends/nativeProcessRunner.js` | 2 | 1 |
| M | `candy-runtime/src/backends/nativeSupervisor.sh` | 12 | 1 |
| M | `candy-runtime/src/capabilities/capabilityRegistry.js` | 9 | 3 |
| M | `candy-runtime/src/capabilities/cudaQualification.js` | 2 | 1 |
| M | `candy-runtime/src/capabilities/motifQualification.js` | 5 | 4 |
| A | `candy-runtime/src/capabilities/qualificationJson.js` | 24 | 0 |
| M | `candy-runtime/src/cli.js` | 14 | 7 |
| M | `candy-runtime/src/config.js` | 9 | 0 |
| M | `candy-runtime/src/http/httpUtils.js` | 1 | 0 |
| M | `candy-runtime/src/jobs/jobManager.js` | 105 | 31 |
| M | `candy-runtime/src/server.js` | 30 | 9 |
| A | `docs/CANDY_SCOPE6C_RUNTIME_CONTRACT.md` | 64 | 0 |
| A | `scripts/capture-scope6c-prechange.mjs` | 43 | 0 |
| A | `scripts/measure-scope6c-runtime.mjs` | 101 | 0 |
| A | `scripts/qualify-scope6c-gates.mjs` | 13 | 0 |
| A | `scripts/qualify-scope6c-parent-death.mjs` | 41 | 0 |
| A | `scripts/qualify-scope6c-restart.mjs` | 34 | 0 |
| A | `scripts/serve-scope6c-runtime.mjs` | 18 | 0 |
| A | `src/candy/artifactPresence.js` | 29 | 0 |
| M | `src/candy/client.js` | 7 | 2 |
| M | `src/candy/motifAnalysisController.js` | 6 | 2 |
| M | `src/candy/motifWorkflow.js` | 4 | 3 |
| M | `src/candy/useCandyRuntime.js` | 33 | 2 |
| M | `tests/candy-scope5-runtime-integration.test.mjs` | 1 | 0 |
| M | `tests/candy-scope6a-hook.test.mjs` | 2 | 0 |
| A | `tests/candy-scope6c-browser-reconnect.test.mjs` | 61 | 0 |
| A | `tests/candy-scope6c-corrective-lifecycle.test.mjs` | 68 | 0 |
| A | `tests/candy-scope6c-qualification-reuse.test.mjs` | 19 | 0 |
| A | `tests/candy-scope6c-recovery.test.mjs` | 54 | 0 |
| A | `tests/candy-scope6c-retention.test.mjs` | 53 | 0 |
| M | `tests/fixtures/candy-scope5-runtime.mjs` | 3 | 2 |
| A | `tests/fixtures/candy-scope6c-runtime.mjs` | 34 | 0 |

## Sole deferred item and recommendation

Persistent native-worker reuse requires a separately qualified native protocol change. The qualified executables remain one-shot. This deferral is not broadened.

Recommend qualification tag and main promotion of exact candidate **46ae55173407bb71683614ef212d9d4d4127ecc3** after human review, retaining the existing local qualification verdict and its sole deferred item.

No evidence commit/push, tag, PR merge, main modification, anchor movement or Scope 6D work was performed. Stop here for human review.
