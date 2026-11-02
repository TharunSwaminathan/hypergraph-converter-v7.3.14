# Proposed Scope 8C: Standalone Analysis History Portability

Definition ready for human contract freeze; **not permission to implement**. Baseline `4237de4c768daa98f81536423e9bf6ff787f09ce`. Objective: explicitly export validated retained history independently of saved source/graph/root, and explicitly import it as a new history-only project. This is the one primary objective. Minimal history category/disclosure UX supports it.

Preferred future branch: `candy-integration-scope8c-history-portability`.
Preferred future worktree: `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.15-scope8c-history-portability`.
Retain current `candy-integration-scope8c-readiness` worktree/branch as evidence-only; do not rename it or create an implementation worktree in this audit.

## Exact expected implementation boundary

| Operation | Path | Responsibility |
| --- | --- | --- |
| new | src/persistence/analysisHistoryPortability.js | Independent bounded history wire codec; private staged handles; rebase through existing validator. |
| new | src/components/AnalysisHistoryPortabilityPanel.jsx | Explicit download, dynamic file picker, preview, confirm import-as-new, cancellation/status. |
| modify | src/persistence/projectStore.js | History-only atomic export snapshot and new-project atomic publication; no root or memory/model writes. |
| modify | src/persistence/workspaceResumeCoordinator.js | Fresh bounded history summary/invalid-category refresh bound to selected owner. |
| modify | src/components/WorkspaceExperience.jsx | Unsaved-edit/current-owner integration; expose import/download and truthful post-commit discovery. |
| modify | src/components/ResumeWorkspacePanel.jsx | Append historical result count/error category and disclose history retained by workspace-only deletion. |
| new | tests/candy-scope8c-history-portability.test.mjs | Codec, determinism, ID rebasing, import transaction, compatibility/budget tests. |
| new | tests/candy-scope8c-adversarial.test.mjs | Malformed input, spoofing, races, replay, rollback, quotas, authority exclusions. |
| new | tests/candy-scope8c-ui.test.mjs | Mounted control ownership, Cancel-first confirmation, stale callback, escaping and accessible status. |
| new | tests/fixtures/candy-scope8c-history-portability.mjs | Bounded CPU/motif history fixtures and declared transactional doubles. |
| new | tests/fixtures/candy-scope8c-browser.html | Isolated native-browser qualification entry point. |
| new | tests/fixtures/candy-scope8c-browser.mjs | Real IndexedDB/browser cases, profile handoff, restart, instrumented authority counters. |
| new | docs/CANDY_SCOPE8C_HISTORY_PORTABILITY.md | Wire format, lifecycle/limits, authority model and exact qualification obligations. |

Expected **13 paths: 6 product source, 6 tests/fixtures, 1 doc**. This is a proposed contract boundary, not an immutable future blob receipt or permission to commit these paths. If implementation needs additional paths, stop and review the contract boundary before widening it. Existing regression tests remain unchanged. Current audit evidence and work tools are excluded from a future product candidate.

Protected dependency files include App.jsx, useAlgorithms, analysisHistorySchema, analysisHistoryCoordinator, projectSession, workspacePortability, memory/model adapters, Runtime/native/CUDA, workflow/package verifier and launchers. Their unchanged behavior is tested, not extended. The new UI is composed through WorkspaceExperience/ResumeWorkspacePanel; do not modify the analysis execution path to expose it.

## Wire contract and schemas

Independent UTF-8 canonical uncompressed text: magic `CANDY-ANALYSIS-HISTORY\n`, format `candy.analysis-history`, wire schemaVersion 1, extension `.candy-analysis-history`. Exact top-level fields: `format schemaVersion sourceProjectId name records sha256`. `sha256` hashes the canonical UTF-8 body of the other five fields; magic is a fixed separately verified prefix. No timestamp at export, local revision, destination ID or private replay ledger on the wire. Reject unknown fields, duplicate JSON keys/noncanonical serialization, invalid UTF-8, non-UUID owners, empty/invalid names, and future schemas. Display/export naming is bounded to 80 characters and plain text.

Maximum file **3 MiB including prefix**; 1..24 records; records collection at most **2 MiB** and each record at most 256 KiB. Outer parsing limits depth24/nodes60000/array10000/string60000; reuse unchanged stricter record and envelope validators (record depth20/nodes30000; envelope depth22/nodes50000). Post-rebase sealed envelope including its new seen ledger must also fit 2 MiB. All bounds apply before writes; over-limit refuses rather than truncates. Export validates its own final bytes through the exact same decoder before download.

No IndexedDB migration: database v5 and project/history schema1 stay unchanged. No changes to Scope8A workspace file versions1/2/3, their root requirement, legacy migration or verifier policy. Do not fabricate a workspace/root to accommodate rootless history.

## Export, admission and atomic publication

1. Read project, history and bounded label in one readonly snapshot. Validate live non-tombstoned owner and complete history envelope independent of source/graph/root availability. Valid rootless or workspace-partial/corrupt projects may export valid history. Missing/zero results produces a truthful unavailable message. Corrupt/future history refuses without repair; no salvage in 8C. Export is read-only and must remain useful at the 512-entry lifetime ledger limit.
2. Export only retained normalized schema1 records and label. Exclude source/graph bytes, checkpoints, memory/chat, model profile/endpoints, credentials, native handles/jobs/tokens, pending updates/approvals, deletion reviews and private seen ledger. Outcome payloads may reveal vertex names or result values: show a plain sensitivity disclosure before an explicit download. Existing sensitive-content heuristics are not a universal secret detector. Same unchanged snapshot exported twice is byte-identical.
3. Explicit dynamic file picker -> size-limited read -> bounded canonical decoder -> unchanged history validators -> private WeakMap stage. File MIME/extension is a hint only. Show count, claimed backends, imported/unverified status and missing source/graph warning. Validation/preview/cancel writes nothing. Stage has no caller-forgeable mutable payload, is consumed at most once, and is invalidated on project/owner/file change.
4. Import **as a new project only**. Allocate fresh trusted `newProjectId()` locally; deterministic history-record remint uses existing `rebasePortableHistory(records, sourceProjectId, newProjectId, publicationRevision)`. Result origin IMPORTED/unverified; local capture and workspace publication revisions null. New private seen ledger contains just imported retained records. Full record hashes/IDs change; normalized payload/input/result digests remain as their contracts allow. Re-export after import need not match original file bytes.
5. In one native transaction publish new project, sealed history, empty authority-free thread, validated label/selection metadata and default pointer if absent. Read current project inventory, histories and workspace roots for caps/combined budgets. Validate existing default pointer and selection preferences as existing import does; corrupt app metadata fails closed. Do not create workspace root/objects, memory or model profile. No destination merge/replace, no writes to A or B, no eviction of existing data and no resetting other ledgers.
6. Put `history-portable/<fileDigest>/<sourceProjectId>` in new project's bounded migrationLineage in the same transaction. Reject a second/concurrent identical file using markers across validated inventory, including retained tombstones. Fresh random destination ID must not defeat duplicate protection. Re-serialized/rehashed different content is a different file, but caps still bound growth. Do not add a deleted-project recovery exception.
7. Keep project80/lineage32/history8MiB/shared128MiB budgets and OS/browser quota failure semantics. Confirm no destination collision, preferences CAS and owner generation immediately before and inside publication. Preserve current-app unsaved-edit Cancel-first review. Do not adopt foreign project readback as write authority. A new-project import never destructively replaces source project A, so not every A update is an import conflict; exact selection/review ownership must still be fresh. Transaction abort leaves projects/history/thread/preferences unchanged; committed receipt only after oncomplete. Post-commit discovery failure reports saved-but-discovery-failed, not rollback.
8. After import show **Resume available**; do not auto-run, auto-apply, start model inference or auto-mount from file. Explicit Resume (or later normal startup autoResume) mounts data only. No source/graph/memory in imported project; historical rerun stays unavailable until current safe matching input is explicitly supplied. Switching back to A restores A's own memory. Application-wide model settings/OFF/tombstone remain unchanged; selection may invoke existing fresh verification only when existing consent permits.

## UI/lifecycle and concurrency

Make standalone transfer available with selected valid history even when there is no root. Preserve existing workspace-transfer controls. Compose new explicit controls without competing with the default source upload input. Dynamic file input and Blob download URL must be released; cancel/stale async callbacks cannot replace newer stage/status.

Append Analysis history to Resume categories after existing Source/Graph/Memory/Model order; reflect count/error independently of source/graph validity. Guard summary refresh against old owner completion and avoid stale cached counts after imports/history changes. A refreshed summary is read-only, never a new writer revision. Say that workspace-only deletion retains analysis history, memory and chat; no storage deletion semantics change. Keep one-use exact reviewed delete tokens and same-owner intervening-change rejection intact.

Accessible keyboard/file/confirmation workflow; Cancel is first/default; explicit errors for corrupt, duplicate, quota, stale, incompatible and full inventory. No optimistic saved claim before transaction completion. Display backend/input/source provenance as claims; hashes are not execution authentication.

## Non-goals and protected behavior

No history merge/replacement into existing projects; pinning, notes, search/filter, comparison, new algorithms, retention changes, corrupt salvage, graph/source import in this format, memory transfer, new reconnect semantics, automatic runs, cloud sync, accounts, credentials, cross-user authority or process startup. No physical backup durability guarantee, historical evidence edits or backend/source path expansion. No Scope8D.

CPU algorithms and intentional current-input rerun paths remain unchanged. STATIC/INCREMENTAL boundaries, qualified binary selection, no CPU fallback, no implicit projection, Analyze/Apply separation and current parser review/Run/Apply separation remain protected.

**LIVE CUDA EXECUTION NOT REQUIRED / NOT CLAIMED**. Actual local **qwen3:8b continuity IS REQUIRED** in eventual qualification because new project selection/Resume touches restored context: new history-only project has no inherited A memory and history is not sent as instructions; A memory remains after return; restored model selection, fresh reconnect truth and durable OFF remain correct. No model/native service is started in this audit. Automated security seal: **NOT RUN / NOT CLAIMED**.

## Implementation order and exit criteria

After separate authorization: (1) freeze this contract/boundary, (2) bounded codec and adversarial tests, (3) snapshot/new-project atomic store path and quota/CAS tests, (4) Resume summary plus explicit UI and mounted tests, (5) native browser/profile/restart and real qwen cases, (6) source/extracted/build/audit/security/protected-history gates, (7) freeze proposed-source inventory/hashes, (8) human candidate-commit review, then fresh exact-SHA CI and package/extracted closure. Never continue after a failing diff check.

Exit: all planned A-Z gates pass with no unresolved Critical/High/Medium scoped finding, zero production dependency vulnerabilities, exact boundary and frozen blobs verified, real browser evidence distinguished from doubles, qwen continuity complete, safe legacy formats and all 7A-through-8B regressions preserved. Proposed-source PASS alone never authorizes exact-SHA promotion or tag/main changes. See qualification plan for concrete cases and stop conditions.
