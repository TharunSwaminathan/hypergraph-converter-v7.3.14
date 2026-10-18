# Scope 6C implementation and qualification report

PASS WITH EXPLICIT DEFERRED ITEMS

Branch: candy-integration-scope6c-runtime-reuse-recovery. Committed HEAD / starting baseline: 61e3dda985b74be35e98f1e6b3886d33b58a4bfd. The Scope 6C implementation and evidence remain uncommitted for human review.

## Outcome and changes

Runtime jobs now use a bounded FIFO lane with reserved admission, queue/end-to-end deadlines, deterministic terminal count/byte retention, artifact pinning and pressure eviction. Expiration removes lookup authority before releasing files. Cleanup errors remain truthful and block unsafe continuation. The owned root reconciles recognized orphan files and uses a kernel lease before stale PID handling; production cleanup never recursively deletes a tree.

Immutable qualification JSON parsing and exact browser upload text can be reused under explicit bounds. Each qualification still rereads/checks current source, binary, evidence, tags and environment; every browser reuse requires authenticated metadata. No cache grants qualification, session, graph, pending-update, result or mutation authority. Browser idle checks revoke readiness/capabilities/results on loss; reconnect requires fresh authentication/discovery.

Native executables remain one-shot. CUDA source, algorithm, protocol and work limits were not changed. STATIC stays CUDA_STATIC; pending delta stays CUDA_INCREMENTAL, with no fallback, implicit projection or Analyze→Apply coupling. See [Runtime contract](../docs/CANDY_SCOPE6C_RUNTIME_CONTRACT.md).

## Automated gates

All five Scope 6C focused files pass. Full suite: 284/284 files in 158.6s. Lint, build, build:github pass; production audit: 0 vulnerabilities. Both builds used VITE_CANDY_RUNTIME_ENABLED=true. The completed npm ci result was retained because manifests are unchanged. All 629 production/test hashes still match the final gate snapshot. Commands, elapsed time, exit codes and logs: [gates](candy-scope6c-test-results.json), [binding](candy-scope6c-final-gate-binding.json).

## Genuine Runtime and retention qualification

The isolated final soak passed 1,000 alternating genuine S2 CUDA jobs (500 STATIC / 500 INCREMENTAL), each with accepted zero-bin fixture truth and CUDA kernel/synchronization flags. Cancellation and a 1 ms timeout were followed by valid work; fresh restart/reconnect and stale credential/handle rejection also passed. The small maxJobs=4 probe accepted all 8 jobs by expiring terminal history; the baseline accepted 4 and rejected the fifth. A separate 2,000-byte production-store regression proves pressure expiry, old job/result 404, protected active pins and subsequent success.

Across 40 soak checkpoints, retained jobs stayed at 32. Artifacts reached 511 and root entries 514 at cycles 975 and 1,000; workspaces and queue depth were zero at drained checkpoints. Peak concurrent supervisor handles was one. All observed owned groups had zero live or zombie processes at drained checkpoints. RSS ranged 144191488–229883904 bytes for the combined observer/service, not isolated Runtime heap. Source/serialized budgets are deterministic bounds, not direct heap telemetry. Full [retention evidence](candy-scope6c-retention.json) retains the exact checkpoints.

## Post-machine-restart browser and recovery closure

A fresh uninstrumented build:github was served with npm.cmd run preview -- --host 127.0.0.1 --port 5173 --strictPort --base=/hypergraph-converter/. HTTP 200 was proven before automation. A first preview without the matching base path rendered an empty root; its configuration was corrected before qualification without product changes. The fresh tab retained only inert historical chat; no old graph/job/result/approval was restored.

Production Runtime instances were launched through scripts/serve-scope6c-runtime.mjs (production startCandyRuntime, no mock backend), with private fresh pairing files and local stop-file control for clean Windows shutdown. Receipts record exact command, PID, port 8791, URL, HTTP 200 and recovered file counts. The first browser Runtime PID 18080 reconciled 3 stale files; second PID 12584 reconciled 4. Both closed cleanly. Credentials are excluded from evidence.

The browser converted a 3-edge / 4-vertex fixture, staged and inspected ADD_VERTEX h1: c, and accepted a genuine STATIC total of 1 and INCREMENTAL signed delta class 14 −1 / class 19 +1, total 0. Committed graph version remained 2. On clean loss while Studio stayed open, readiness/backends/current result were revoked; the pending proposal remained. Stale pairing was rejected, fresh pairing restored readiness without restoring old result authority, and a new confirmed incremental job completed with a new job/session/request identity. Separate Apply confirmation committed version 3 and invalidated the prior delta. Edit/restage and Discard preserved that committed version. Narrow selectors and keyboard activation completed without a broad-selector timeout or browser crash.

A final-code abrupt restart check killed owned Runtime PID 11784 after a genuine qualified job reached running status, then restarted PID 19328. Kernel start at that instant is not asserted. The marked root reconciled 2 orphan entries; old credential returned 401 and old active job/result returned 404. A subsequent genuine STATIC job completed correctly, and PID 19328 stopped cleanly. An initial temporary observer copy exited on a relative import error before taking action; the corrected additive observer passed. Earlier controlled production-supervisor parent-death evidence remains valid because supervisor bytes did not change, and is explicitly a non-CUDA fixture proof.

All qualification services are stopped, temporary browser tab is closed, pairing files are removed, and owned measurement/browser roots are disposed through scoped production cleanup. Final project-native process checks found zero. See [browser](candy-scope6c-browser-qualification.json), [clean restart](candy-scope6c-restart-recovery-post-restart.json), [final abrupt restart](candy-scope6c-abrupt-recovery-final.json), [post-abrupt job](candy-scope6c-post-abrupt-valid-job.json), [service cleanup](candy-scope6c-final-service-cleanup.json), [final cleanup](candy-scope6c-final-abrupt-cleanup.json).

## Before / after Runtime measurements

Descriptive medians in milliseconds; all raw precision and sample/process/read counts are preserved in [comparison JSON](candy-scope6c-performance-comparison.json). Separate pre/post sessions and small n do not support a statistical causal estimate. Cold-start uses fresh Runtime objects within the observer process, not cold OS boots.

| Boundary | Before ms | After ms | Difference ms | Difference % | n before/after |
|---|---:|---:|---:|---:|---:|
| cold-start | 427.24 | 158.76 | -268.48 | -62.84% | 3/3 |
| first-discovery | 355.07 | 155.92 | -199.16 | -56.09% | 1/1 |
| repeated-discovery | 361.35 | 157.38 | -203.97 | -56.45% | 5/5 |
| first-static | 1029.00 | 705.44 | -323.56 | -31.44% | 1/1 |
| repeated-static | 841.23 | 662.68 | -178.54 | -21.22% | 5/5 |
| first-incremental | 806.07 | 685.70 | -120.36 | -14.93% | 1/1 |
| repeated-incremental | 815.38 | 713.08 | -102.30 | -12.55% | 5/5 |
| shutdown | 7.69 | 220.66 | 212.98 | 2770.37% | 1/1 |
| restart-reconnect-discovery | 360.67 | 147.72 | -212.96 | -59.04% | 1/1 |

Repeated discovery used 5 child processes rather than 8 (−37.5%), with 19 fresh qualification reads retained. Per-job process/read counts remained 9/18: native process reuse was not introduced. The final parsing cache recorded 12 parses, 12,402 hits, 12 entries and 1,163,684 source bytes within the 16-entry / 4 MiB budget.

Shutdown increased from 7.69 ms to 220.66 ms (+212.98 ms). This regression is retained explicitly. The before shutdown followed the short initial scenario, while the after shutdown followed 1,000 additional jobs and a 511-artifact store; cleanup now selectively unlinks owned files. This is not a matched-store shutdown comparison. No Scope 6C threshold is substituted or waived. Correct cleanup and recovery passed.

## Preserved evidence and review

Original historical evidence and earlier Scope 6C observations remain byte-identical: 420 protected historical/native/manifest files and 23 saved pre-restart Scope 6C files matched hashes. The original before benchmark was reused. Earlier cleanup-failure, invalid observer, unavailable-under-concurrent-tests, and interrupted soaks remain preserved, not relabeled PASS or mixed into the final 1,000-cycle run. The resumed 350-cycle intermediate run was intentionally stopped for corrective review; its 220 recognized leftover entries were safely reconciled and disposed.

The managed Codex Security scan covered the pre-correction snapshot and is preserved. Three dynamically confirmed functional defects were corrected: stale-owner race, terminal-pin storage exhaustion, and cleanup-time deadline publication. Final independent corrective reviews and regressions closed them, including unrelated manager cleanup-error interaction. No unresolved Critical/High issue remains. All 34 implementation-related files are accounted for; [security/reliability report](candy-scope6c-security-review.md) distinguishes canonical scan scope, final follow-up, policy disposition and measured rollout usage.

## Exact implementation inventory

18 tracked files modified; 16 new implementation/test/script/contract files. Evidence files and ignored logs are separately hashed in [final inventory](candy-scope6c-final-inventory.json). No staged changes. Tracked Git diff: 18 files changed, 337 insertions(+), 90 deletions(-).

- modified tracked: `candy-runtime/src/artifacts/artifactStore.js`
- modified tracked: `candy-runtime/src/backends/nativeProcessRunner.js`
- modified tracked: `candy-runtime/src/backends/nativeSupervisor.sh`
- modified tracked: `candy-runtime/src/capabilities/capabilityRegistry.js`
- modified tracked: `candy-runtime/src/capabilities/cudaQualification.js`
- modified tracked: `candy-runtime/src/capabilities/motifQualification.js`
- modified tracked: `candy-runtime/src/cli.js`
- modified tracked: `candy-runtime/src/config.js`
- modified tracked: `candy-runtime/src/http/httpUtils.js`
- modified tracked: `candy-runtime/src/jobs/jobManager.js`
- modified tracked: `candy-runtime/src/server.js`
- modified tracked: `src/candy/client.js`
- modified tracked: `src/candy/motifAnalysisController.js`
- modified tracked: `src/candy/motifWorkflow.js`
- modified tracked: `src/candy/useCandyRuntime.js`
- modified tracked: `tests/candy-scope5-runtime-integration.test.mjs`
- modified tracked: `tests/candy-scope6a-hook.test.mjs`
- modified tracked: `tests/fixtures/candy-scope5-runtime.mjs`
- new untracked: `candy-runtime/src/artifacts/ownedRoot.js`
- new untracked: `candy-runtime/src/capabilities/qualificationJson.js`
- new untracked: `docs/CANDY_SCOPE6C_RUNTIME_CONTRACT.md`
- new untracked: `scripts/capture-scope6c-prechange.mjs`
- new untracked: `scripts/measure-scope6c-runtime.mjs`
- new untracked: `scripts/qualify-scope6c-gates.mjs`
- new untracked: `scripts/qualify-scope6c-parent-death.mjs`
- new untracked: `scripts/qualify-scope6c-restart.mjs`
- new untracked: `scripts/serve-scope6c-runtime.mjs`
- new untracked: `src/candy/artifactPresence.js`
- new untracked: `tests/candy-scope6c-browser-reconnect.test.mjs`
- new untracked: `tests/candy-scope6c-corrective-lifecycle.test.mjs`
- new untracked: `tests/candy-scope6c-qualification-reuse.test.mjs`
- new untracked: `tests/candy-scope6c-recovery.test.mjs`
- new untracked: `tests/candy-scope6c-retention.test.mjs`
- new untracked: `tests/fixtures/candy-scope6c-runtime.mjs`

## Deferred item and hard stop

Persistent native-worker reuse is deferred: the qualified executable protocol is one-shot, so safe reuse requires separate native protocol qualification. No native optimization or Scope 6D work was started. Structural accounting and process RSS do not claim direct JavaScript heap measurement.

No commit, push, tag, merge, main modification or qualification-anchor movement occurred. Stop here for human review.
