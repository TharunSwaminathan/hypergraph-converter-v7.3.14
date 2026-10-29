# Scope 7 — Persistent Workspace & Assistant Continuity readiness audit

Audit date: 2026-10-29. Repository: `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.15-scope7-readiness`. Branch: `candy-integration-scope7-persistence-readiness`.

The current persistence architecture, gaps, trust boundaries and implementation sequence are understood well enough to begin **controlled phased implementation after human review**. Persistence is not complete, and this audit does not qualify Scope 7 or authorize starting 7A.

## Frozen release identity and audit boundary

The required precondition passed before source investigation or artifact creation. HEAD, peeled `v7.3.15`, local `origin/main` and directly queried remote main all resolve to **335c320a052eab48d3f0c2d309805d10a5918189**. Its tree is `2a9b123565fc49ec3aa344fd3edb45392c175243`.

The annotated v7.3.15 tag object is `fdbacde9361fbbb4f6bfc456d088fc068609b1aa`. Historical v7.3.14 remains annotated object `af3911c505a510ae7b0a90bcfcbd5db47d0921a4`, peeled commit `9d79d9f9027b338096d7cf62d67c2a22e9cab247`. Remote identities were rechecked at closure. All local refs, including historical qualification tags, remain unchanged.

No production/test/package/Runtime/native/workflow files or historical evidence were edited. No staging, commit, push, tag, merge, main change, release creation or Scope 7 implementation occurred. All audit files, dependency/build output and test fixture output are physically under `artifacts/candy-scope7-*`. No application/Runtime/Ollama service was restarted for this audit; existing baseline tests launched their own isolated fixture processes. No automated Codex Security scan/seal was invoked or represented as complete. No `.codex` state was modified.

## What actually survives today

Current browser persistence is a bounded historical Assistant record, reusable local-model settings, reusable parser profiles, and a page-session Runtime credential hint. It is **not an authoritative resumable workspace**.

The thread save/load chain projects both directions and restores only messages, summary and separate safe references. It deliberately strips message actions, pending actions, approvals, graph contents, native job/result authority and credentials as structured fields. Uploaded filenames without bytes remain missing-file references; saved graph fingerprints do not make a graph available; parser/workflow code is displayed historically rather than automatically executed. These are controls to retain, not defects to “fix.” `src/persistence/threadStateSchema.js:7`, `src/persistence/threadStateSchema.js:23`, `src/persistence/usePersistentThread.js:18`, `src/components/AgentChatPanel.jsx:3047`.

Live graph/history, batches/source bytes, current mapping/parser results, DynamicHypergraph pending ownership, Analyze/Apply state, native results/jobs, derived caches, selections and export handles are owned separately in memory. A normal rerender preserves an existing owner, while frontend destruction/remount creates new owners. Browser persistence may survive same-origin/profile restart, subject to committed writes, storage retention and browser policy. Runtime/Ollama restart while the browser remains mounted does not itself erase the browser graph; it invalidates or requires re-establishing service liveness/authority. The current map distinguishes all requested events and state categories.

**Origin scoping is a confirmed functional architecture gap.** The combined launcher can choose :5174 after :5173, while IndexedDB/localStorage remain scoped to the actual origin. localhost, 127.0.0.1, different ports and Pages select separate namespaces. Old memory is inaccessible from the new origin, not proven deleted. Conversely, Pages repository paths on one owner origin share a principal and fixed keys. This requires architecture and UX work, not just a note in documentation. `run-with-ollama.bat:32`, `src/persistence/threadStore.js:16`; probe P11; [browser storage semantics](https://html.spec.whatwg.org/multipage/webstorage.html#the-localstorage-attribute), [IndexedDB isolation](https://w3c.github.io/IndexedDB/#database-construct).

Model configuration is reusable; a connection is not. App starts disconnected even when activeTransport/activeBaseUrl were stored. Explicit Connect tests the configured transports/model; no startup/idle reconnect loop was found. Bridge port configuration is build/launcher-dependent. The standard CANDY CLI has a separate exact-origin allowlist that does not automatically follow a fallback :5174 frontend. `src/App.jsx:231`, `src/App.jsx:2072`, `src/agent/ollamaConnectionManager.js:16`, `candy-runtime/src/config.js:10`.

Runtime artifacts are purgeable session resources with RAM metadata/jobs. They are not a durable project database. Native `.local` records/binaries/evidence are independently validated installation provenance and must never be supplied by a workspace import. `candy-runtime/src/artifacts/ownedRoot.js:46`, `candy-runtime/src/capabilities/motifQualification.js:37`.

## Gap counts and highest-priority findings

**20 gaps: 0 Critical, 3 High, 14 Medium, 3 Low.** Severity expresses functional continuity, integrity, privacy and planning priority; it is not a count of validated security vulnerabilities or CVSS ratings. The gap register records all required fields and test/dependency links.

| Priority | Gap | Consequence and first corrective direction |
|---|---|---|
| 1 | **S7-01 — High: origin-dependent continuity** | Port/host/deployment changes strand existing browser memory. Set a stable-origin conflict policy plus explicit verified export/import. |
| 2 | **S7-02 — High: no authoritative durable workspace** | Chat survives without dataset/graph/mapping/history bytes. Add bounded verified project manifests and separate content objects, preserving unavailable-data semantics. |
| 3 | **S7-03 — High: shared main / stale writers** | Whole-record snapshots can overwrite another tab's edits and mix intended projects. Introduce project identity, revision CAS/conflict handling and deletion tombstones. |
| 4 | **S7-04 — Medium: save status and closing loss** | Latest queued write can be dropped on dispose; a general saved label lacks a revision receipt. Add dirty/committed state and stale-owner checks; never promise unconditional unload durability. |
| 5 | **S7-14 — Medium: no durable validated historical result contract** | Current analysis evidence is live-session-bound and temporary artifacts are purged. Archive immutable outputs with exact provenance in a separate historical read-only type; never resurrect approvals/jobs/Apply. |

Other concrete gaps cover corruption/quarantine, byte quotas/serialization, profile/settings validation/error receipts, structured memory and provenance, exact reattachment, model reconnect/freshness, companion configuration, privacy deletion/retention, backup/eviction, UI preferences, configuration naming, profile export labeling and physical failure qualification.

## Recommended architecture and sequence

Use **7A → 7B → 7C → 7D → 7E → 7F**. First implement **7A**, after review: storage/identity contracts, typed bounds, revisions/CAS, dirty/error/commit receipts, copy/validate/publish migration and the stable-origin/portability decision. Keep earlier schemas/evidence intact. The plan specifies objective, likely modules, dependencies, invariants, failures, tests, exact-SHA gate and non-goals for every phase.

Prefer a browser-first project database with separate manifest, messages, structured memory and content-addressed sources/graphs/results, plus explicit export/import. Preserve browser/Pages use without requiring Runtime or a GPU. Optional File System Access/OPFS or a separately designed authenticated Runtime durable-store adapter can follow measurement; the existing temporary artifact root is unsuitable. Entire large graphs/datasets/binaries must not be appended to one JSON thread record.

Resume validates a committed project revision, restores available verified **data**, exposes missing files and interrupted work, and creates fresh live execution owners. It then separately reconnects current services. Pending mutations, approvals, jobs and live result authority are discarded; historical output is viewable only under validated provenance and cannot authorize Apply.

Structured Assistant memory should hold project identity/objective, reviewed decisions, dataset/graph identities, verified completed transformations/analysis refs, unresolved tasks, assumptions, provenance and timestamps. Deterministic code owns truth, revisions, source identities and action authority. The LLM reads bounded selected context and proposes changes; it is never the authoritative database.

### Five largest implementation risks

1. Stable origin and portability can fail together or create misleading confidentiality assumptions (S7-01/S7-16).
2. Partial/missing/substituted objects can acquire false graph/data availability unless publication and identity are verified (S7-02/S7-11).
3. Concurrent/late writers can lose updates or resurrect deleted data without CAS and owner epochs (S7-03/S7-04).
4. Migration, quota and privacy cleanup can destroy wanted history or retain unwanted legacy data (S7-05/S7-07/S7-15).
5. Imported historical memory/results can be confused with current execution authority unless the types and validators remain distinct (S7-09/S7-10/S7-14).

## Baseline checks and reproducible probes

All 1,286 tracked files were captured with hashes/sizes/mtimes. A qualification copy under `candy-scope7-readiness-work/s` was checked against those byte hashes and the corresponding immutable Git blobs, allowing ordinary checkout EOL conversion. Dependencies and build output were created in that copy. This is baseline testing of unchanged source, not a new release/package qualification or commit-bound provenance claim for a generated snapshot archive.

| Gate | Final result | Evidence |
|---|---|---|
| npm ci | PASS, clean install | `candy-scope7-readiness-work/baseline-complete/npm-ci.txt` |
| npm test | **PASS: 288/288 test files**, runner 186.3 s | `candy-scope7-readiness-work/baseline-verified-test.txt` and `.json` |
| npm run lint | PASS | `candy-scope7-readiness-work/baseline-complete/lint.txt` |
| npm run build | PASS | `candy-scope7-readiness-work/baseline-complete/build.txt` |
| npm run build:github | PASS | `candy-scope7-readiness-work/baseline-complete/build-github.txt` |
| npm audit --omit=dev | PASS: zero vulnerabilities | `candy-scope7-readiness-work/baseline-complete/production-audit.txt` |
| git diff --check | PASS on target worktree | `candy-scope7-readiness-work/final-verification.json` |
| Focused read-only production-module probes | PASS: 11 probes, including confirmed gap behavior | `candy-scope7-readiness-work/probes.json` |

Environment: Windows, Node v24.20.0, npm 11.19.0, Python 3.13.15. The install summary reported two High non-production dependency advisories; production-only audit was zero. No dependency update or unrelated fix was attempted. Existing native/Runtime fixture tests are not new genuine-GPU or physical reboot evidence.

Probe results cover authority stripping, missing bytes, supported/unsupported/malformed records, silent message truncation, stale snapshot overwrite, disposed queued-save loss, silent configuration failures, weak profile schema/bounds, surviving legacy profile key, remembered transport config, distinct URL origins and the :5174 Runtime allowlist mismatch. In-memory IDB tests do not prove real browser persistence or crash durability.

### Retained failed/setup attempts and classification

The first preparation helper mishandled a trailing NUL and was corrected before completing the copy. A gate controller was started prematurely, stopped, and its install/partial-test output retained; the subsequent copy validation covered all 1,286 files. Two completed suite attempts stopped at 47/288 because the nested audit copy's extracted fixture discovered the enclosing repository; `GIT_CEILING_DIRECTORIES` alone did not fix this because the producer deliberately sanitizes `GIT_*`. An inert invalid `.git` sentinel in the **audit work directory** isolated discovery without creating a repository or changing product provenance rules. The packaging regression then passed.

A further suite reached 61/288 before Windows long paths in a nested fixture failed. An audit-only S: alias to the permitted work directory shortened temporary paths. Running the source itself through that alias produced duplicate React module identities and stopped at 1/288; the final run kept the normal source cwd and used only `S:\t` for fixtures. It passed all 288 files. An isolated command also had an incorrectly constructed TEMP path; it created no fixture and was corrected. These were audit-tooling/environment failures, not demonstrated v7.3.15 product regressions. Every completed failed-suite log and initial partial log remains; setup notes distinguish console-only attempts.

The alias target was verified and removed after tests; no audit child process still referenced it. No real Git repository/index/ref was created or changed by the sentinel. Final staged entries and index bytes match the initial state. A read-only status command refreshed the index file's **mtime** while its SHA256 stayed identical; that incidental metadata change is disclosed rather than hidden. The first preservation helper treated mtime equality as required, recorded a failed assertion and was followed by the byte/ref/content verification. See setup notes and final verification.

## Coverage, evidence and stop boundary

The restart plan contains **55 planned cases**, including every requested restart/failure, corruption/quota/migration/multitab scenario and authority/privacy/import boundary. It distinguishes existing fixture/probe evidence from future real-browser/service/native/Windows evidence. This audit did not physically restart Windows, a browser, Ollama or a user's Runtime, measure large-project persistence performance, verify effective Windows ACLs, or perform a product-wide vulnerability scan. Those remain explicit implementation/qualification gates, not waived risks.

All original tracked files, including 401 tracked historical artifact files, retain bytes, size and mtime. All local refs and protected remote identities are unchanged. Index bytes and staged contents are unchanged; no tracked or staged diff exists. New untracked work is confined to the seven primary files below and their permitted supporting work directory. The final verification checks this boundary and every inspected source citation; the evidence manifest hashes primary deliverables and retained supporting receipts/tooling. Temporary dependency/cache/fixture trees are diagnostic work, not proposed product files.

Exactly seven primary deliverables:

1. `artifacts/candy-scope7-persistence-readiness-audit.md`
2. `artifacts/candy-scope7-current-persistence-map.md`
3. `artifacts/candy-scope7-persistence-gap-register.json`
4. `artifacts/candy-scope7-storage-schema-map.md`
5. `artifacts/candy-scope7-restart-recovery-test-plan.md`
6. `artifacts/candy-scope7-security-threat-model.md`
7. `artifacts/candy-scope7-implementation-plan.md`

Supporting audit tooling, logs, hashes, source-copy manifest, probe results and failure records: `artifacts/candy-scope7-readiness-work/`. They are excluded from any proposed product commit boundary. Implementation, staging, commits, tags, pushes, merges and main changes remain outside this completed audit.

READY FOR PHASED IMPLEMENTATION
