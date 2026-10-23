# Scope 6D tranche 1 exact-SHA native qualification

**READY FOR SCOPE 6D TRANCHE 1 PRODUCTION BINDING**

Candidate: f3fa7dc3d0c1ac3ef927b080da79b004ce93f0f0. Baseline: 46ae55173407bb71683614ef212d9d4d4127ecc3. Branch: candy-integration-scope6d-native-optimization. This report prepares a human-reviewed binding; production activation has not occurred.

## Restart recovery and exact identity

Tracked working tree and index remain clean. Committed delta is only candy-runtime/native/hypergraph-motif-cuda-incremental/src/main.cu: 15 insertions / 6 deletions. STATIC, Makefiles, manifests, schemas/protocol, kernels, parsers, counting helpers, Runtime/browser code and limits remain unchanged.

The pre-reboot isolated build was recovered by raw source/Makefile/binary SHA-256, Git blob and build metadata, so no rebuild was necessary. GPU visibility/model (RTX 5060, 8151 MiB, compute 12.0), driver 617.42, NVCC 13.4.59, runtime package 13.4.49 and host compiler match the original build. Fresh CUDA results also report runtimeVersion 13040 and driverVersion 13040.

- Git source blob: c9101e894b96e1ed9345607c10ea30f051e32dc4
- Exact committed LF source SHA-256: ce425e455649fb1e2fec632cd608834dd6f8d7b31969c81673a8d1304908ee2b
- Windows CRLF checkout SHA-256 (separate representation): 49373f697a3ad28866d1b9a58fb7360e9907e98892ac15cb3604588e5557325b
- Exact LF Makefile SHA-256: 7460a217f6d29f5c4c8eaf9079babfcc8e7ef2f79ba7a2890ca3442f6a24cc8b
- Exact executable SHA-256: 58772e07cc04a5135a4cd21d8f6ba33701801b79d06925cde99284db075d12ff
- New additive record: artifacts/candy-scope6d-tranche1-native-qualification.json
- Record SHA-256: 065ba1a42fcf8b641104f67c26661364ca4aa293d2489cd4a8146a97e03b312f

The compile commands, source snapshots, compiler/CUDA/GPU metadata and executable hashes are in exact-sha-build.json. It was a clean, newly created isolated build directory; the product executable was never overwritten.

## Remote CI

All original five successful jobs were freshly reverified by read-only GitHub API after reboot, bound to this SHA. No CI rerun occurred.

- CPU release / push: run 39171753728, job 117806096421 — PASS (https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/39171753728/job/117806096421)
- CPU release / pull_request: run 39171793915, job 117806209156 — PASS (https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/39171793915/job/117806209156)
- Ubuntu: run 39171793958, job 117806209518 — PASS (https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/39171793958/job/117806209518)
- macOS: run 39171793958, job 117806209274 — PASS (https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/39171793958/job/117806209274)
- Windows: run 39171793958, job 117806209141 — PASS (https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/39171793958/job/117806209141)

## Native semantics and admission

Retained durable pre-reboot results: all 30 readiness matrix fixtures and 240 seeded bounded transitions against this exact executable. The interruption had no complete taxonomy/admission result, so only that unfinished stage was rerun. All 96 connected signatures plus six permutations for each of 30 orbits pass (276 comparisons), preserving 24 closed / 6 open classes.

Post-reboot full native qualification passed **405 positive cases / 104 rejection and validation checks**, including all 30 creation/destruction classes, 180 S3 permutations, 128 additional seeded stress transitions, deterministic fixtures, an anchor-over-subtraction regression, 12-step update chains, graph/update/version/digest binding, replay/forged-context rejection, malformed offsets, count/byte bounds, no-op, insert/delete, unchanged/changed reinsert, zero candidates and near-limit behavior. Independent CPU/set oracles and unchanged STATIC are validation controls only; there is no production fallback. Exact OLD/new histograms, signed deltas, candidate counts, metadata and serialization order match the baseline in the retained and resumed differential evidence.

Admission remains: effective nonempty ceiling 216, nominal edges 256, work 5,000,000 per full snapshot, incidences 100,000, deletion/insertion counts 256 and packed bytes 2 MiB. Both exact digest-bound 2 MiB acceptance and over-limit rejections pass. Full-replace-216 is accepted; E217/I217 and E216/I218 are rejected. Public preflight and raw STATIC controls were also rechecked. No larger graph support is claimed.

## Safety, lifetimes and recovery

Four representative CUDA tools each passed sparse/dense/local/high-impact/high-cardinality/zero-candidate fixtures: **24 checks**, memcheck/racecheck/initcheck/synccheck. The full qualification sanitizer subsets add **24 checks** (6 per tool). All native cases report CUDA execution and synchronization success. All 14 isolated OLD/NEW fault positions and 14 full-leak-check fault memchecks pass. Errors remain private/error-only, and subsequent valid work succeeds.

Fresh diagnostic copies were built from the recovered exact committed source. Live host candidate-element allocation accounting confirms **39,752,640 → 19,876,320 bytes**, with OLD freed before NEW allocation and final live accounting zero. This is a 50% candidate-element lifetime payload reduction, not a 50% RSS/VRAM/process-memory claim. RSS observations are separately labeled proxies; no universal speedup or scale increase is asserted. The earlier interleaved timing evidence is preserved and was not rerun solely for reboot.

Post-reboot OLD/between/NEW cancellation, timeout, parent death, Runtime shutdown, restart/reconciliation, fresh auth and stale-result rejection pass. 7 observed owned groups drain to zero live/zombie processes. **All five Scope6C preservation tests pass**, including bounded job/artifact retention, qualification parse invalidation, clean/abrupt recovery, browser reconnect, authentication/session lifecycle and stale authority/result invalidation. Browser checks here are the existing mounted/HTTP fixture regressions; Studio/model execution is not required by this unchanged browser path and was not started.

Every native-qualification Runtime was explicitly started with a fresh session. 9 start/stop pairs record command, PID, actual port/URL, HTTP 200 health, fresh authenticated session ID, test-only/ordinary discovery distinction and clean shutdown in post-restart-services.jsonl. Scope6C fixture service ports/readiness/auth responses are observed separately. No pre-reboot PID, credential/session or browser automation handle was reused.

## Genuine abrupt Runtime restart

A separate post-reboot Runtime process was freshly started and authenticated, reached HTTP 200, and accepted real supervised CUDA work. It was intentionally terminated at a diagnostic NEW-phase barrier after OLD completion. Owned group 891 drained to zero live/zombie processes. A new Runtime reconciled 3 abandoned files, rejected the old credential and job/result/artifact handles, and completed subsequent valid work with the exact qualified executable. Restart shutdown was clean. This intentional crash is separately documented in exact-sha-abrupt-recovery.json; it is not counted as a graceful stop.

## Qualification and binding boundary

The additive record retains the existing **candy.motif-qualified-build/1** schema and binds this SHA, exact LF source/Makefile, executable, backend, architecture/toolchain/GPU and five fresh qualification evidence digests. The native evidence digest additionally binds semantic/admission contracts, timestamp and supplemental post-reboot/reused evidence. No qualification-record, native-wire, HTTP or result schema extension is needed.

The ordinary verifier is still fail-closed for incremental and STATIC remains available. No historical Scope4B2 file, record, tag or binary was repointed. All 1040 files from the recovery snapshot retain their hashes; Scope6C and all local tags remain unchanged.

**production-binding-plan.json** specifies the later explicit operator steps: stage a NEW versioned native package with these exact LF bytes, copy this record to a NEW local filename, review a narrow identity-selection change in motifQualification.js with fixed paths/SHA/evidence scope/counts, create a distinct approved qualification anchor, retain all freshness/hash/environment/negative checks, and then validate ordinary authenticated production discovery and final-byte long-session/browser recovery. None of those installation/selection/tag steps was applied here. Missing/mismatched pieces must stay fail-closed.

Focused security/resource/identity review found **no unresolved Critical/High issue**. Fifteen negative record/input-byte identity cases reject spoofed or mismatched data without changing preserved files. See security-closure.md and exact-sha-identity-validation.json. This is not a repository-wide security audit.

## Additive evidence and stop

New canonical native/sanitizer files use candy-scope6d-tranche1-cuda-incremental-*.json; the new record is native-qualification.json. Exact-SHA raw results and recovery/build/remote CI/service/run manifests retain their own paths and hashes. All previous engineering/readiness and pre-reboot work is preserved. The post-reboot final inventory binds these artifacts.

No evidence commit/push, tag, merge, main modification, candidate installation/activation, historical qualification rewrite, persistent worker, limit increase or tranche 2 work occurred. Stop after this fresh qualification and production-binding plan for human review.
