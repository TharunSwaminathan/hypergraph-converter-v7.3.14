# Scope 7A exact-SHA post-commit qualification

**READY FOR SCOPE 7A QUALIFICATION TAG AND MAIN PROMOTION**

Candidate: `b34e6bbf5359a4855db6c9bbf1395f9b25b6d738`. Branch: `candy-integration-scope7a-persistence-foundation`. Origin branch independently queried before and after qualification: the same SHA. Single parent/baseline: `335c320a052eab48d3f0c2d309805d10a5918189`. Exactly the reviewed 29 product/test/doc paths are committed: 20 source/launcher, 8 tests/fixtures, 1 doc; +1,291 / -96. No qualification evidence was committed. Full path inventory is in the commit-identity JSON and below; raw committed-file hashes are in the committed-source manifest.

## Exact source and repository gates

Existing Windows core.autocrlf/.gitattributes cause CRLF-only checkout differences in 1252 files. All physical checkout bytes still equal the reviewed pre-commit hashes. Qualification used an isolated copy of **all 1,300 raw blobs from this exact commit**, not assumed checkout equivalence or a pre-commit snapshot. The raw source manifest digest is `c4b13eb1aaed47815c5744e2b5e496f42c7d7eaaeddfee5a4d02fb9a75005641` (method recorded in JSON). All raw source bytes remained unchanged through gates. Tests operate on the existing Git-free snapshot contract; commit-bound packaging is verified separately against real Git metadata, without weakening policy.

| Gate | Raw committed-source copy | Git-free extracted archive |
|---|---|---|
| Clean npm ci | PASS | PASS |
| Full npm test | **292/292**, 199.9 s | **292/292**, 191.4 s |
| Lint | PASS | PASS |
| Build / build:github | PASS / PASS | PASS / PASS |
| Production audit | **0 vulnerabilities** | **0 vulnerabilities** |
| Focused committed 7A tests | 4/4 test files PASS | 4/4 test files PASS |
| Mounted Scope 5 authority restoration | PASS | PASS |

Both phases discover 292 test files with none skipped from the required matrix. The focused suite covers CAS/stale writers, tombstones, receipts, migration/quarantine, schemas/bounds, model settings, parser profiles, live origin policy and mounted failures. Required R-case evidence is mapped in qualification-results.json; storage doubles, happy-dom and real browser evidence are separated. Node v24.20.0 / npm 11.19.0 / Python 3.13.15. Full clean installs report two High non-production advisories; production audit remains zero and dependency bytes remain baseline-identical.

## GitHub CI bound to this candidate

All five returned check runs have head_sha `b34e6bbf5359a4855db6c9bbf1395f9b25b6d738` and completed/success. None of the required jobs or their recorded steps are cancelled/skipped; continue-on-error on Windows/macOS is not substituted for inspecting their actual successful steps. All five remote full suites report 292/292 in retained job logs.

| Workflow/run | Actual jobs | Result / checkout |
|---|---|---|
| [CI / 40931158160](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40931158160) | Ubuntu 123649628196; Windows 123649628886; macOS 123649628946 | All PASS; PR synthetic merge |
| [CPU/browser release PR / 40931158112](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40931158112) | cpu 123649628377 | PASS; PR synthetic merge |
| [CPU/browser release push / 40931056144](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40931056144) | cpu 123649274701 | PASS; **direct candidate checkout** |

PR jobs actually checked out `1945fa1effb4c4d3f317ad71b48696a738f7ce8d`. Its parents are baseline then candidate; its tree and the candidate tree are exactly `c88bfc0aeeb15c08c1e860d50fc657cf8c698f00`. The separate push CPU gate actually checked out `b34e6bbf5359a4855db6c9bbf1395f9b25b6d738`. Check binding, tested checkout and byte-identical tree are recorded distinctly; success is not borrowed from another candidate or falsely described as direct candidate checkout for PR jobs. CI API payloads, job steps/logs and independent Git tree/parent responses are retained. GPU live qualification remains explicitly UNAVAILABLE/SKIPPED on CPU runners; its status-echo success is not native qualification.

## Browser closure

**11 PASS** using only new isolated Chrome profiles, including two actual top-level windows, same-origin navigation reload, native request-success/transaction-complete/receipt order, stale conflict, tombstone late writer, native versionchange, native transaction abort/rollback, coordinator flush, site-database deletion and two incognito-session checks. Chrome reports 156.0.8078.48. The null IndexedDB API is an explicitly injected failure, not claimed browser-policy denial. Mounted storage faults use test doubles.

An actual TCP listener on 127.0.0.1:5173 remains alive while the committed preflight returns code 2 with the persistence warning; strict Vite bind rejects and 5174 remains unoccupied. Browser fixture code comes from the committed raw blob copy. No user's profile, real saved Candi data, Runtime or Ollama service was reused/restarted. Owned test browser/server processes are closed. There is no physical reboot/fsync/power-loss guarantee.

## Commit-bound portable-source closure

Archive: `candy-scope7a-exact-sha-work/committed-1.zip`; project root `candy-scope7a-b34e6bbf`.

- SHA256: `d71688d5fd4c8983254e30a097dfa830cd72bbe6912c35205adcd5b1908b4604`
- Bytes: **1,795,151**
- Entries: **955**, comprising **899 files / 56 directories**.
- Two git-mode builds, clean-source and synthetic-populated builds are byte-identical. Every output independently verifies at **commit-bound** level against original Git root + candidate SHA, issueCount 0 / CRC OK; membership and all file bytes match.
- All 29 delta paths, including new persistence/launcher/tests/doc files, are present. Existing producer/verifier source blobs match baseline. No policy exception was introduced.
- A disposable shared-object/no-checkout Git clone under new evidence provides a real source root with an archive destination outside that tree. It reads the candidate's committed blobs. Original repository index/refs are untouched. The output-inside-source rejection remains preserved as a qualification setup note.
- Synthetic private .local builds, versioned qualification installs, credentials/tokens, native binaries/builds, artifacts, uploads, dependencies and dist fixtures are excluded; no private marker leaks. Extracted source is Git-free and initially excludes evidence/local state. Tests may generate their own diagnostics after extraction.
- All applicable extracted gates above pass; both CUDA_STATIC and CUDA_INCREMENTAL remain unavailable/fail closed without qualification state. This is a browser/source distribution and does not qualify a native install.

## Security and protected invariants

**PASS — focused committed persistence security review**, with no validated unresolved finding in scope. Automated Security seal **NOT RUN / NOT CLAIMED**. The separate security-review file reevaluates all requested surfaces and records same-origin, localStorage/CAS, retention and physical-durability limits. Historical readiness priorities are not security vulnerability ratings.

Exact baseline Git blob equality proves Runtime/native implementation/auth/qualification, STATIC-INCREMENTAL separation, graph/algorithm code, deterministic agent/action/context code outside the two adapters, package policy, workflows/manifests and all **401 historical tracked evidence files** unchanged. The App/Assistant diff is restricted to storage receipts/error/retry integration; explicit mutation confirmation, stale-context/graph checks, Analyze/Apply and parser review/Run/Apply remain unchanged and covered by the complete and mounted regressions. No CPU fallback, implicit projection, cloud API requirement, endpoint widening or automatic reconnect was added. No native qualification directory was built/deleted/modified.

Scope 7B and later features remain absent: no persistent dataset/source bytes, graph snapshots/history, workspace export/import, structured semantic long-term memory, automatic Ollama reconnect, motif result archive or Resume Workspace UI. Existing chat summaries and parser-profile export/import are not mislabeled later-phase features.

## Remaining gaps

The status register is carried forward, not rewritten: CLOSED S7-03/07/08; **PARTIALLY_CLOSED S7-01, S7-04, S7-05, S7-06, S7-13, S7-15, S7-20**; **DEFERRED S7-02, S7-09, S7-10, S7-11, S7-12, S7-14, S7-16, S7-17, S7-18**; **UNCHANGED S7-19**. Partial items retain portability/recovery UX/large-object budgets/advanced Runtime coherence/deletion-management/complete restart-matrix work; deferred items retain source/graph bytes, structured memory, cryptographic binding, reconnect, results, workspace portability, preferences and observation-liveness separation. S7-20 remains partial: these 7A browser checks do not complete physical/integrated Scope 7F. Individual reasons are in gap-status.json. No Scope 7B work was started.

## Preservation and boundary

Original branch/HEAD, all local refs including main/tags, index bytes, all 1,300 tracked file bytes/mtimes and 70 pre-commit primary/support evidence files match the initial capture. No tracked/staged qualification modification exists; committed and working diff --check pass. The separate readiness commit remains outside candidate ancestry. New evidence is only under artifacts/candy-scope7a-exact-sha-*. Temporary S: alias is removed; owned browser/server qualification processes are stopped. Pre-commit/historical NON-PASS evidence is preserved. Preparation CRLF normalization and initial producer output-boundary rejection are retained as tooling notes, not hidden product failures.

Exact committed path inventory:

```text
docs/CANDY_SCOPE7A_PERSISTENCE_FOUNDATION.md
run-dev.bat
run-dev.sh
run-preview.bat
run-preview.sh
run-with-ollama.bat
run-with-ollama.sh
scripts/launcher-preflight.mjs
src/App.jsx
src/agent/localModelSettings.js
src/agent/parserProfiles.js
src/components/AgentChatPanel.jsx
src/persistence/localStorageAdapter.js
src/persistence/projectSchema.js
src/persistence/projectStore.js
src/persistence/storageCoordinator.js
src/persistence/storageMigration.js
src/persistence/storageSafety.js
src/persistence/threadStateSchema.js
src/persistence/threadStore.js
src/persistence/usePersistentThread.js
tests/candy-scope5-recovery.test.mjs
tests/candy-scope7a-adapters.test.mjs
tests/candy-scope7a-foundation.test.mjs
tests/candy-scope7a-mounted.test.mjs
tests/candy-scope7a-origin.test.mjs
tests/fixtures/candy-scope7a-browser.html
tests/fixtures/candy-scope7a-browser.mjs
tests/fixtures/candy-scope7a-storage.mjs
```

No staging, commit creation, tag, push, merge, main modification or later-phase implementation was performed. This record makes the candidate ready for a later human-controlled qualification tag/main promotion; neither action was executed.
