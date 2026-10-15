# v7_4 Windows CI corrective report

READY FOR REVIEW — TEST-ONLY WINDOWS CI CORRECTION

Baseline: `0fb1e9d0e0f7af2d37d34ca90a65a887693f7f25` on `v7_4-merged-baseline-integration`. The work remains uncommitted. No Runtime/native, CUDA, graph authority, motif taxonomy, schema, qualification record, CI workflow or package-manifest change was made.

## Root cause and Node version comparison

The test used a count of 100 status polls separated by 10 ms sleeps, not a job deadline. Its nominal sleep budget was about one second, while the submitted request already allowed 5000 ms. HTTP latency and timer/scheduler cadence changed the actual amount of time 100 polls allowed. There was also no overall bound on a stalled status fetch.

The original test passed 10/10 naturally on both local Windows Node 22.23.3 and Node 24.20.0, consistent with the user’s 11/11 Node 24 result. This excludes a general Node 22 or Windows production failure from the local evidence.

A controlled asynchronous mapping-artifact write delayed valid preparation by 2500 ms. The production engine then completed normally with runner exit 0 and validated output. A bounded diagnostic shutdown drain prevented the old test’s finally block from cancelling the job before its eventual outcome could be observed. No job status or success was fabricated.

| Original test / same controlled job | Polls observed | Last status at test boundary | Poll span | Actual accepted completion | Outcome |
| --- | ---: | --- | ---: | ---: | --- |
| v24.20.0 / Windows | 85 | completed | 2538.6ms | 2515.2ms | PASS |
| v22.23.3 / Windows | 100 | preparing | 1549.5ms | 2521.8ms | FAIL: job did not finish |

Node 22 exhausted its 100 polls around 1.55 s while status was still preparing; the job completed around 2.52 s. Node 24 polled more slowly on this host and observed completion before exhausting its count. That demonstrates the concrete version/environment-sensitive test assumption. It does not establish the exact remote runner’s I/O or scheduling delay. Remote logs were inaccessible through the connected GitHub tool, and the original remote stack has no last-status/timing diagnostics. [Measured root cause](v7_4-windows-ci-root-cause.json), [timing summary](v7_4-windows-ci-timing-summary.json), [complete controlled evidence](v7_4-windows-ci-controlled-reproduction.json).

The failing job uses an injected in-process fake runner. Native child exit/close events, WSL shells, executable permissions, quoting, process groups and child signals are not on that job’s execution path. Real status transitions were queued→preparing→running→validating→completed, and no completed publication was missed. Production NativeProcessRunner was inspected but left unchanged. Native PID/signal are not applicable; harness PIDs, command, fake stdout/stderr/exit and lifecycle/poll traces are in the repetition evidence.

## Exact correction

Only two source files change:

- `tests/candy-scope2-job-engine.test.mjs`
- `tests/helpers/waitForJobStatus.mjs`

The helper uses a monotonic 5000 ms deadline taken from the existing test request budget, retains 10 ms poll delays, aborts status requests, bounds nonresponsive reads/delays and reports elapsed time, poll count, last status, lifecycle and error on failure. It returns real terminal outcomes; failed/cancelled are never rewritten as success. Waiting for running fails immediately if an unexpected terminal state is reached. This is a measured test-budget correction, not an increase to a production timeout.

The target test retains its original success, result identity, idempotency, type rejection, artifact traversal and cancellation checks. It adds the measured 2.5 s preparation regression; success-shaped output with a nonzero exit; unavailable/spawn-failure and timeout classifications; no accepted result for failed execution; stalled polling diagnostics; a filesystem path containing spaces; explicit running-before-cancel and request/artifact cleanup assertions. No Windows skip, platform-specific branch or shell invocation was added. [Corrective diff](v7_4-windows-ci-corrective.diff).

## Windows validation

| Gate | Result |
| --- | --- |
| Original focused test, measured Windows Node 22 | 10/10 PASS |
| Original focused test, measured Windows Node 24 | 10/10 PASS |
| Final corrected focused test, Windows Node 22.23.3 | 10/10 PASS |
| Final corrected focused test, Windows Node 24.20.0 | 10/10 PASS |
| Supported focused runner, Node 22 | PASS |
| Related Scope 2 tests, Node 22 | 5/5 PASS |
| Fresh npm ci, exact Node 22.23.3 | PASS |
| Official full npm test, Node 22.23.3 | 274/274 PASS |
| Official full npm test, Node 24.20.0 | 274/274 PASS |
| Lint / build / build:github, Node 22 | PASS / PASS / PASS |
| Production dependency audit | PASS; zero vulnerabilities |

Both Node versions were run noninteractively with CI=true. The exact Node 22 Windows archive was downloaded from the official Node distribution and its SHA256 verified. Baseline/final measured runs use an external observation preload; official full-suite commands are plain supported npm invocations without that preload. Initial observer setup failures occurred before test execution and are retained separately, excluded from product pass/fail counts. [Environment/checksum](v7_4-windows-ci-environment.json), [all gates](v7_4-windows-ci-gates.json), [final Node 22 repetitions](v7_4-windows-ci-after-final-node22.json), [final Node 24 repetitions](v7_4-windows-ci-after-final-node24.json).

## Protected delta and reliability review

All 91 protected source files, all 21 qualification/build files and all 425 pre-existing evidence files match their prechange hashes at closure. Required full tests regenerated generic NLU reports; new results were retained additively and original evidence was restored byte-for-byte from the pre-test backup. HEAD, main and all prior tag objects remain unchanged, including v7.3.14, RC2-qualified and v7_4-merged-baseline-evidence. [Protected delta](v7_4-windows-ci-protected-delta.json).

The focused manual review found no unresolved Critical/High issue. The fix starts no native process, introduces no shell path or injection surface, retains error and cancellation truth, gives all test polling a deterministic maximum, aborts outstanding HTTP reads, clears timers and verifies owned temporary-file cleanup. This is a review of the correction and its exercised call path, not a fresh whole-repository security or native implementation audit. [Reliability/security review](v7_4-windows-ci-security-review.json).

## Recommendation and platform impact

Ready for human review and a new corrective commit on the integration branch, followed by PR CI rerun. Ubuntu/macOS should retain their previously reported behavior because production is unchanged and the test helper uses the same supported Node APIs on every platform. They were not freshly executed in this pass, and no new remote CI PASS is claimed. The exact remote delay remains unobserved; the matching-version controlled false-timeout mechanism is demonstrated and covered by regression.

No commit, push, merge, tag or Scope6B work was performed. Hard stop after this report.
