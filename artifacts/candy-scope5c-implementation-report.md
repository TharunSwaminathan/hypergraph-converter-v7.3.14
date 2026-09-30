# CANDY Scope 5C implementation and final qualification

Decision: PASS. Finalized 2026-09-30 (America/Chicago).

## Baseline and scope

Repository: C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14.
Branch: candy-integration-scope5c-runtime-binding.
Starting SHA and final HEAD: 3379e0102704521960a5ccc1185a14a2beb2725d.
The initial tree was clean. The continuation found exactly the same 19 uncommitted implementation/test files, no unexpected change, and passing diff check. No implementation restart, undo or history operation occurred.

The Scope 5B qualified tag still peels to the starting SHA. The Scope 5A qualified tag still peels to eb829fb627de349be99d440ebfed11990f76837e. All seven Scope 5 design inputs and both prior phase evidence sets were read before production changes.

Scope 5C connects application authority to the already-qualified CUDA_INCREMENTAL Runtime and accepts exact read-only result evidence. Runtime production, frozen native sources, dependency manifests and earlier evidence are unchanged. No new live CUDA execution or final Scope 5F qualification was performed.

## Exact inventory

12 modified tracked files:

- src/App.jsx
- src/candy/motifStatisticsAvailability.js
- src/candy/motifWorkflow.js
- src/candy/requestPolicy.js
- src/candy/resultObservation.js
- src/candy/useCandyRuntime.js
- src/components/AgentChatPanel.jsx
- src/components/CandyMotifResult.jsx
- src/components/CandyMotifStatistics.jsx
- src/components/CandyRuntimePanel.jsx
- src/graph/pendingHypergraphUpdate.js
- tests/candy-scope5-graph-state.test.mjs

11 added untracked files:

- src/candy/motifAnalysisController.js
- src/candy/motifPreflight.js
- src/candy/motifResultRegistry.js
- tests/candy-scope5-races.test.mjs
- tests/candy-scope5-result-binding.test.mjs
- tests/candy-scope5-runtime-integration.test.mjs
- tests/fixtures/candy-scope5-runtime.mjs
- artifacts/candy-scope5c-implementation-report.md
- artifacts/candy-scope5c-test-results.json
- artifacts/candy-scope5c-security-review.md
- artifacts/candy-scope5c-qualification.json

Total: 23 files = 14 production files, 5 test/fixture files, 4 new Scope 5C evidence files. Nothing is staged. The existing Scope 5A source-wiring assertion now recognizes the required existing Scope 5B pending controller; its graph-state domain tests remain intact.

## Application authority and Runtime path

App retains one committed graph and one Scope 5B pending controller. Observable pending snapshots and a live committed graph getter feed useCandyRuntime. No parallel pending model, raw draft authority or complete Scope 5D lifecycle was introduced. Pending validation checks the active ledger record/current base after its digest await, preventing discarded/superseded revisions from reviving.

The explicit analysis path is:

bounded selector -> separate owned confirmation -> useCandyRuntime -> submitMotifWorkflow -> canonical OLD graph -> existing locally validated/applied pending transport -> immutable graph artifact -> immutable update artifact -> exact RuntimeMotifRequest -> authenticated POST job -> unchanged Runtime validation/packing -> qualified CUDA_INCREMENTAL -> signed native result -> browser validation -> immutable application registry -> presentation only.

The browser derives request ID, graph/update bodies and SHA artifact IDs, immutable references and expected native request digest. Model/UI callers cannot supply artifact IDs, request/native digest, NEW graph, candidates, paths or credentials. The browser packing projection computes transport identity and feasibility only; it does not count motifs or execute a fallback. Its output is tested against the unchanged qualified STATIC packer for all 30 witnesses and INCREMENTAL packer for replacement/deletion/novel-vertex insertion.

Scope 5B plan plus validated preview remain the only Apply authority. Analysis/result acceptance never calls commitGraph or applyPendingHypergraphUpdate, increments graph version, marks pending APPLIED or creates graph history. Independent later Apply revalidates as before and never submits a job.

## Shared preflight and explicit selection

Cheap type/identity/count checks precede membership copying, large serialization, base64 conversion, upload and submission. Preflight enforces exact current graph ID/version/fingerprint/type, pending base, VALIDATED plus CHANGED, update selector identity/next version, OLD/proposed budgets, timeout, authenticated session and exact qualified backend/mode/device capability.

Existing limits are reused: 256 workflow hyperedges, 100000 graph incidences, 256 deletions and 256 insertions, 100000 inserted incidences, 2 MiB packed request, 5000000 membership visits and 6 MiB artifact bound. Timeout is an integer 1..60000 ms. Raw edge-count feasibility does not guarantee the work/packed budget. Exact packing is checked before approval/upload; exact serialized artifact bytes and enforcing Runtime/native layers independently recheck contracts.

Typed reasons include GRAPH_TYPE_UNSUPPORTED, NO_VALIDATED_PENDING_UPDATE, NO_MOTIF_RELEVANT_CHANGE, PENDING_UPDATE_STALE, GRAPH_LIMIT_EXCEEDED, UPDATE_LIMIT_EXCEEDED, BACKEND_UNAVAILABLE, DEVICE_UNAVAILABLE and RUNTIME_UNAVAILABLE, using existing error classifications.

| Explicit request/context | Outcome |
| --- | --- |
| Current-count Hypergraph | STATIC / CUDA_STATIC |
| Current-count DynamicHypergraph, with or without pending | STATIC / CUDA_STATIC |
| Change request + exact current DynamicHypergraph VALIDATED/CHANGED pending | INCREMENTAL / CUDA_INCREMENTAL |
| DynamicHypergraph without pending | Typed unavailable |
| Missing exact incremental backend/device | Typed unavailable |
| Ordinary/projected graph | Rejected, no projection |

NONE remains a valid graph update for independent Apply, but cannot analyze or fabricate a zero delta. No prior STATIC result is required. There is no CPU, STATIC or alternate-backend fallback.

## Confirmation and currentness

The analysis controller issues an immutable currently owned token binding graph ID/version/fingerprint/type; update ID/revision/digest/proposed fingerprint/next version/status/motif impact; backend/mode/device/timeout; Runtime session; creation and expiry. The existing ten-minute TTL is reused. Only the exact token object, selectors and current authority can authorize one submit; approval is consumed before the first await. Copies, replay, expiry, graph/pending edits, supersession, reconnect and Apply confirmations are rejected. Analysis confirmation cannot Apply.

Bounded scalar authority keys replace repeated serialization of full graph/pending bodies. Assistant confirmation compares the exact stable envelope, not the short FNV marker, and passes the original owned token. Existing strict allowlist, MAX_REACT_STEPS=8, one action per iteration, expensive confirmation and re-observation remain intact. Bounded/truncated model observation is not execution authority. No full stage/edit/discard/Apply Assistant flow was added.

Currentness checks surround packing/native digest, graph/update digest, graph serialization/upload, both upload responses, job creation/response, polling, completed-job verification, result download, result hashing and selected-result assignment. They compare live application binding, epoch, authorization, mounted owner and Runtime session. A stale submitted job receives best-effort cancellation; correctness never waits for or depends on cancellation success. An orphan artifact cannot authorize later execution.

## Exact result evidence

The registry stores one deeply frozen evidence object, schemaVersion candy.application-motif-result/1. It binds Runtime session/job/request; algorithm/taxonomy/backend/mode/device; base graph ID/version/fingerprint/type; update ID/revision/digest/proposed fingerprint/next version/status/motif impact; graph/update/result artifacts and exact result SHA; expected nativeRequestDigest; interpretation and validated native result. workspaceMutated=false and applyAuthority=false are explicit.

The fetched result is cloned before asynchronous validation. Browser checks independently verify exact job/request/session, graph input/native output refs, update refs/next version, artifacts, result SHA, browser-derived native/request digest, qualified CUDA metadata, affected-edge/candidate identity, exactly 30 signed safe-integer bins and matching sum/old-new affected counts. Replacing both request digests and rehashing a forged result still fails against the expected browser-derived digest.

CURRENT requires exact current application key and Runtime session. Graph identity/version/fingerprint/type, pending ID/revision/digest/proposed fingerprint/next version/status/motif impact, Apply/discard/supersession or reconnect invalidates old evidence. updateId alone is never sufficient; visibly identical later revisions cannot inherit a result.

## Lifecycle, failure and truthful presentation

Analysis lifecycle is orthogonal to pending status: NONE, CONFIRMATION_REQUIRED, STAGED, RUNNING, RESULT_READY, FAILED, CANCELLED, STALE. RESULT_READY leaves the pending update merely VALIDATED.

Cancel revokes local job/result/approval authority synchronously before await. Failed cancellation, late completion or late cancel response cannot restore authority or overwrite a newer analysis. Timeout/failure revokes job/result authority and requires fresh authorization; a still-current pending aggregate remains VALIDATED. No automatic retry or Apply occurs.

Pairing/new discovery immediately invalidates session authority. Discovery generation checks reject late superseded/unmounted responses. Reconnect preserves pending/independent Apply but requires rediscovery and new analysis approval; old results are not restored. Unmount revokes the owner and all late work.

Presentation remains deltaCounts[30] and deltaTotalConnectedTriples, signed +N / -N / 0, labeled delta-only and not applied. The stable 24 CLOSED_TRIANGLE + 6 OPEN_WEDGE taxonomy and separate Line-Graph Triangles product are preserved. No full/new/post-Apply counts or before/delta/after reconstruction are claimed. Prior-count reconstruction is deliberately deferred.

## Explicit useCandyRuntime regression review

The final hook was compared with the qualified baseline and reviewed with client/discovery, controller/workflow, Assistant confirmation and persistence consumers. No discrepancy requiring source changes was found.

STATIC retains explicit CUDA_STATIC submission on both accepted graph types. Pairing retains sessionStorage credential semantics and authenticated client headers; token material is absent from returned hook/model/evidence state. New session/generation guards revoke old authority sooner without changing the qualified transport. The direct/bridge Ollama transport remains separate and unchanged; AgentChatPanel's delta is confined to analysis staging/exact confirmation. Full automatic-direct/bridge fallback and bridge limits/robustness/streaming regressions pass.

Cancellation, timeout, stale context, result clearing/selection, capability discovery and no-fallback/projection are covered by controller/race tests plus actual mounted React hook integration. Existing Scope 4C Assistant/Runtime contracts remain green. Scope 5C intentionally keeps only one current volatile motif job/result rather than promoting old retained jobs to current authority.

## Tests, proof and full gates

New tests cover the selection matrix, typed refusal/budgets, forbidden caller fields, frozen packing parity, separate single-use confirmation, substitution matrix, signed deltas and races. Actual React useCandyRuntime is mounted with injected authenticated HTTP, discovered qualified capabilities, exact pending analysis, unchanged acceptMotifNative result acceptance, signed rendering, reconnect clearing and late-unmount discovery rejection. This is application integration coverage, not a new live CUDA claim.

Successful analysis asserts the identical committed graph/pending references, VALIDATED status and commit count 0. Later independently confirmed Apply causes one commit, no additional job, and removes old current result currency. Confirmation crossing is rejected. Race coverage includes graph upload, pending edit during update upload/job, job creation with unavailable cancellation, polling/download graph changes, newer revision, expiry, discard, restart, cancel plus late result, timeout plus late completed response, unmount/abandoned upload and late 5B validation.

| Final gate after continuation | Result |
| --- | --- |
| Focused CANDY/confirmation regressions | PASS, 28/28 files |
| Scope 5 subset | PASS, 7/7 files |
| Scope 4C contracts | PASS, 12 subtests |
| npm run test | PASS, 260/260 files, 106.0 seconds |
| npm run lint | PASS, zero warnings |
| npm run build | PASS |
| npm run build:github | PASS |
| npm audit --omit=dev | PASS, 0 vulnerabilities |
| git diff --check | PASS |
| Targeted security scan | Complete, 0 findings, unresolved High=0 |

Both builds retain the existing non-blocking Vite chunk-size advisory. A Git LF-to-CRLF advisory on useCandyRuntime is not a diff-check failure. Bundled Python was explicitly on PATH for portable ZIP tests; the isolated temporary npm 11.4.2 client ran the requested npm commands without changing manifests.

The npm advisory gate was completed outside the Codex sandbox through approved read-only execution, including a fresh continuation audit. The previous sandbox block was environment/network-policy-specific, not a product failure. No dependency manifest changed. No product source changed after the final green run; only the four new evidence files were added afterward.

Existing post-diagnosis-corrective-live-runtime-requalification.json remains unchanged and reports LIVE_RUNTIME_QUALIFICATION_PASS. Injected Runtime tests and frozen qualification fixtures are used in 5C; no expensive Scope 5F live rerun was performed.

## Security and protected deltas

Codex Security skill-driven diff scan 06b37d23-5c5c-4afb-b016-c156a500519d is completed/sealed on the final production delta. Snapshot: codex-security-snapshot/v1:sha256:ab49a2794b716b80e34e5737d1b0150e024a209a670f1e5cf42979980383f515. All 14 changed production files and relevant unchanged authority/Runtime/persistence consumers were covered; canonical coverage has 16 rows (two checkpoint variants) for those 14 unique files. The supplied threat model was preserved exactly. Findings 0, deferred candidates 0, unresolved High 0. See candy-scope5c-security-review.md for controls, canonical report location, limitations and measured usage.

Entire candy-runtime tracked delta: 0 files. Both protected CUDA native directories: 0 files. package.json/package-lock.json: 0 files. Older Scope 4/5/5A/5B evidence: 0 files. Qualified Scope 5A/5B tag targets unchanged. No Runtime integration blocker was found, so no Runtime production modification was needed.

## Deferred phases and repository handoff

Scope 5D: complete Dynamic Update UI and Assistant stage/edit/discard/Apply lifecycle.
Scope 5E: broader multi-tab, persistence and concurrency hardening.
Scope 5F: final application/live CUDA qualification.
Optional exact prior-STATIC reconstruction remains deferred.

All 25 original Scope 5C exit criteria are satisfied. Final inventory is reconciled from baseline tracked diff plus non-ignored untracked files: exactly the 12 modified and 11 added files above, nothing staged. Everything remains UNCOMMITTED. No commit, tag, push, merge, reset, amend or history rewrite was performed. HARD STOP after this Scope 5C final report.
