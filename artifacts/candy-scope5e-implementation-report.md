# CANDY Scope 5E implementation and phase qualification

**Verdict: PASS.** Scope 5E is implemented and qualified by focused tests, full regressions, builds, audit and a completed targeted security review. All changes remain uncommitted on `candy-integration-scope5e-hardening`, based on `18fa9aebd7c91b22c7415519a56ec160a88d2956` and the qualified Scope 5D tag. The initial working tree was clean. No commit, tag, push or merge was performed.

All Scope 5 design artifacts and earlier Scope 5A/5B/5C/5D evidence were read before implementation. Earlier authority boundaries remain the basis of this patch. The supplied Scope 5 threat model is unchanged. This verdict applies to Scope 5E; final real Runtime/CUDA application qualification belongs to Scope 5F.

**Exact delivered inventory:** 11 modified files and 10 added files, 21 total. Twelve are production source; four are test files, one a fixture, and four evidence files. No files are staged.

| Change | Repository-relative path | Purpose |
|---|---|---|
| Modified | `src/App.jsx` | Dispose pending authority on application unmount; wire exact analysis approval cancellation. |
| Modified | `src/candy/motifAnalysisController.js` | Cancel exact owned approval, revoke on polling failure, guard concurrent result reads by epoch. |
| Modified | `src/candy/motifResultRegistry.js` | Guard asynchronous acceptance with registry-local epoch; clear/new accept invalidates old validation. |
| Modified | `src/candy/useCandyRuntime.js` | Tolerate denied pairing storage without granting authority; expose analysis approval cancellation. |
| Modified | `src/components/AgentChatPanel.jsx` | Abort model/unowned late continuations on unmount, cancel owned confirmations, label restored context historical. |
| Modified | `src/components/DynamicHypergraphUpdatePanel.jsx` | Cancel exact owned Apply/analysis approval on unmount or cancellation; show reload/tab policy. |
| Modified | `src/graph/dynamicUpdateControls.js` | Recheck Apply identity/revision/base graph/type/expiry/current session; expose analysis approval revocation. |
| Modified | `src/graph/pendingHypergraphUpdate.js` | Dispose/activate volatile authority, clear ledger and current update, reject staging during Apply, guard late Apply publication. |
| Modified | `src/persistence/threadStateSchema.js` | Add 80-thread retention limit while preserving explicit inert projections. |
| Modified | `src/persistence/threadStore.js` | Enforce deterministic thread quota in the same write transaction; preserve main/current saved record. |
| Modified | `src/persistence/usePersistentThread.js` | Use bounded latest-snapshot queue and revoke callbacks on unmount. |
| Added | `src/persistence/threadSaveQueue.js` | New one-in-flight/one-latest queue with owner epoch and disposal. |
| Added | `tests/candy-scope5-concurrency.test.mjs` | New duplicate/race/cancel/result-read/unmount/identical-content tests. |
| Added | `tests/candy-scope5-multitab.test.mjs` | New isolated-owner replay and inert shared-data tests. |
| Added | `tests/candy-scope5-persistence.test.mjs` | New raw hostile storage, historical-message and quota/queue tests. |
| Added | `tests/candy-scope5-recovery.test.mjs` | New lifecycle reload, graph replacement, failure and actual hook remount tests. |
| Added | `tests/fixtures/candy-scope5e-storage.mjs` | New transactional IndexedDB double and deferred gates. |
| Added | `artifacts/candy-scope5e-implementation-report.md` | New Scope 5E qualification evidence. |
| Added | `artifacts/candy-scope5e-test-results.json` | New Scope 5E qualification evidence. |
| Added | `artifacts/candy-scope5e-security-review.md` | New Scope 5E qualification evidence. |
| Added | `artifacts/candy-scope5e-qualification.json` | New Scope 5E qualification evidence. |

The ignored gate log `artifacts/candy-scope5e-full-test.log` is retained as local execution provenance outside this 21-file nonignored inventory. Build outputs are ignored and are not source delivery changes. Source and test SHA-256 values are recorded in the JSON evidence.

**Persistence and reload policy.** IndexedDB saves bounded conversation and descriptive workspace references only. Message actions are removed, both pendingAction fields become null, graph availability is false, parser/workflow drafts require review and files require reupload. Existing draft text remains inert. Plans, trusted previews, update digests, Apply/analysis tokens, Runtime job/artifact selectors, current result registry and Runtime session authority are never reconstructed from storage. Unknown extra fields are projected away; corrupt schemas and oversized records fail closed. No pending executable object or optional pending summary is persisted, so P06 exercises deliberate omission rather than a summary restoration feature.

Reload/restart creates fresh pending and analysis owners and a fresh result registry. The tested lifecycle states are NONE, DRAFT, VALIDATED, analysis confirmation pending, STAGED, RUNNING, RESULT_READY, FAILED, CANCELLED, STALE and Apply confirmation pending. Every recreated owner has no pending execution authority, approval, current job/result or Runtime session. The committed graph must be explicitly established from current application input; historical references never mark it available. Mount/restoration/pairing does not stage, validate, Analyze or Apply.

The existing sessionStorage pairing bearer is retained as an authentication hint. It is a credential, and remains within the existing same-origin script trust boundary; it is not a restored authorization/session. Each new Runtime hook starts unauthorized, without capabilities/session/result, and requires explicit fresh authenticated discovery. Denied storage no longer crashes live pairing. Injection of a stored credential does not trigger automatic discovery or grant execution. The patch does not introduce token export, model exposure, cross-tab transfer or thread persistence of credentials.

**Multi-tab and session policy.** Each tab owns an independent committed graph and volatile controller/ledger/registry. There is no shared authoritative workspace, mutable pending object, BroadcastChannel receiver or storage-event execution route. Tab B changing its own graph stales B's authority; it does not change A's independently owned graph. A must still pass exact checks against A's current graph. No cross-tab invalidation is claimed or required under this policy. Shared descriptive records cannot grant Analyze or Apply, even when both contexts have identical visible graph contents and graph identity.

Fresh owner objects and nonpersistent WeakMap ledgers prevent an old update/approval from being accepted by a new application owner. Graph ID/version/fingerprint/type, update ID/revision/digest, owner identity, confirmation expiry, analysis epoch and Runtime session remain independent checks. Content coincidence never restores an earlier graph/update lineage. Reconnect/session replacement revokes old analysis approval, binding and result, while a graph-current VALIDATED pending update remains independently eligible for a new explicitly authorized action.

**Cancellation, failures and late work.** UI/Assistant cancellation and component unmount now revoke exact owned approvals. Assistant unmount aborts its current model operation and guards capability execution, confirmation and late prepared mutation continuations. Root pending disposal clears the ledger/current aggregate; reactivation cannot revive old records. Graph transition, edit, discard, supersession and Runtime reconnect revoke local analysis/result authority and attempt remote cancellation. Correctness does not depend on a successful or timely remote response.

Polling network failure now synchronously clears the current binding/result and marks FAILED before best-effort remote cancellation. Fresh retry needs fresh analysis authorization. Timeout/process-terminal failure, validation rejection and artifact mismatch continue through the earlier fail-closed paths covered by full regressions. Committed graph state is unchanged by analysis/failure. A graph-current pending update can still receive a fresh separate Apply confirmation after analysis failure; an older Apply confirmation spanning the failure is rejected.

Concurrent result reads carry a read epoch, so an abandoned read cannot overwrite or clear evidence published by a newer read. The registry independently guards asynchronous validation: clear or a later acceptance prevents older validation from republishing evidence, even without a caller guard. Storage disposal suppresses late callbacks and queued snapshots; an already-started inert storage transaction can finish.

**Apply and analysis concurrency.** Apply retains Scope 5B consume-before-await as the final authority, exact deterministic rederivation, immediate graph binding checks and at-most-one commit. Controls also check the live validated update, revision, graph identity/type, expiry and analysis/session currency. A new draft cannot supersede the aggregate while it is applying. Disposal during the digest/commit path prevents late publication even if the owner activates again. UI and Assistant use the same authoritative boundary and cannot substitute each other's owned approval.

Analysis has one current owner/binding. Competing or duplicate confirmations produce one current submission; a new current revision or analysis supersedes old work. Cancel followed immediately by reanalysis stays correct when old cancellation fails and an old download completes afterward. Runtime discovery/reconnect itself never analyzes.

**Graph and Assistant recovery.** The common App commit boundary invalidates pending/Apply authority and updates analysis currency for normal mutation, type change, parser/custom parser replacement, clear, undo and pending Apply. Exact graph versions/identities remain authoritative. New direct tests exercise replacement/clear/type/mutation; earlier graph-state, pending and UI/Assistant regressions cover the broader paths. No new full mounted App transition matrix is claimed.

Restored Assistant messages, including “I already confirmed” or “apply it now,” remain historical context with no action buttons or approval objects. Fresh observations derive graph/pending/result currency from live state. The recovery copy states that graph, pending updates, confirmations, jobs and current results were not restored. A fresh selector and relevant confirmation are required. No silent rebase or automatic recovery action was added.

**Bounded retention.** Pending session ledger: 256; consumed Assistant confirmation IDs: 256; graph history: 25; result registry: one current entry; analysis: one current job binding and one current/terminal observation, not a job history. Thread persistence: 80 records, 80 messages per record, 6,000 characters per message, 2,000-character summary, 1,000,000-character input-record bound. Existing file/parser/workflow projection bounds remain intact. Quota trimming is deterministic key order within the save transaction, preserving main and the record being saved; it is not an LRU feature. Storage saves retain one in-flight and one latest snapshot. No cross-tab signal history exists. Motif result history is not persisted or promoted into current/prior STATIC authority.

**Tests and gates.** All P01–P07, M01–M06 and C01–C12 are mapped to concrete evidence and policy qualifications in `candy-scope5e-test-results.json`. Scope 5D race/token tests and all earlier phase/Scope 4C/graph mutation/confirmation/deterministic/ReAct/persistence tests ran in the focused or full suite.

| Gate | Result |
|---|---|
| `node scripts/run-node-tests.mjs --match=candy-scope5` | PASS (exit 0), 14/14 files, 8s |
| `npm run test` | PASS (exit 0), 267/267 files, 115.4s |
| `npm run lint` | PASS (exit 0) |
| `npm run build` | PASS (exit 0) |
| `npm run build:github` | PASS (exit 0) |
| `npm audit --omit=dev --json` | PASS (exit 0), zero vulnerabilities |
| `git diff --check` | PASS (exit 0) |

Final test-file count: **267**. The focused Scope 5 run covers 14 files, including the four new Scope 5E files. Node 24.19.0, npm 11.4.2 and Vite 8.0.16 were used. The temporary npm launcher and bundled Python PATH were existing test infrastructure workarounds, with no dependency changes. Audit required approved read-only network access after restricted network failure. Existing Vite chunk-size and Git line-ending advisories did not fail gates.

**Security and protected deltas.** Final targeted scan `13ce71de-772e-46c3-8944-ef2c8bb567c4` is completed and sealed, with complete coverage of all 12 changed production files, no deferred surfaces and zero findings, including zero unresolved High. Independent UI/authority and Runtime reviews supplemented the persistence review; supporting authority consumers and all new tests/fixture were examined. Earlier scan `b4ae9aaa-3ce3-4769-96e8-8d2717c8455d` remains immutable and partial because its sealed coverage retained an interim pending-worker marker. The final follow-up rechecked unchanged hashes and resolved that evidence limitation.

Delta against HEAD is empty for all `candy-runtime/`, both protected native directories, `package.json`, `package-lock.json`, historical qualification evidence and Scope 5 design artifacts. Qualified 5A/5B/5C/5D tag targets remain unchanged; exact targets are in qualification JSON. No CPU fallback, incremental-to-STATIC fallback, implicit projection or alternate backend substitution was introduced.

**Evidence limits and Scope 5F.** IndexedDB and independent tab contexts are exercised using transactional storage/controller test doubles, not two visible real browser windows. Actual React persistence and Runtime hooks mount/remount under happy-dom and Vite; this is not a real browser crash/durability test. New direct transition tests cover replacement/clear/type/normal mutation. Parser/custom parser/undo/pending Apply are supported by the common App commit trace and passing earlier Scope 5A/5B/5D/full regressions; no new mounted App matrix is claimed. No real CUDA job or final live application qualification was performed in Scope 5E.

Scope 5F must qualify the live application against real qualified CUDA_INCREMENTAL, including explicit analysis, exact result binding, cancellation/reconnect and separately confirmed Apply. Visible real-browser reload/restart/two-tab durability checks can complement that live qualification. Scope 5E stops here with all changes uncommitted.
