# Scope 7 — phased implementation proposal

Planning baseline: `335c320a052eab48d3f0c2d309805d10a5918189` / frozen v7.3.15. **No phase is implemented or authorized to begin by this document.** All proposed source/test/document paths below are future boundaries, not files created by this audit. Historical evidence and qualification tags remain immutable.

## Architecture decision and definition of Resume

Recommend **7A → 7B → 7C → 7D → 7E → 7F**, with failure/security tests introduced in each phase rather than postponed to 7F. This conceptual order is supported by the actual dependencies. 7A must settle the stable-origin/portability and project-ownership contracts before durable data is introduced; 7D implements model/companion liveness against those contracts. Do not defer origin identity to a documentation-only final step.

Resume means: select a committed project revision, validate its schema/objects/digests, disclose missing data and interrupted work, instantiate fresh live owners from available validated data, restore explicitly historical context, and separately reconnect current services. It does not mean replaying a sequence of assistant messages or commands.

Recommended common store: browser-first IndexedDB project manifests and separate content objects/chunks, optional consented source bytes, explicit export/import and stable launcher origin. This retains browser/Pages operation without a mandatory Runtime installation. Consider OPFS/File System Access as capability-detected adapters after measurement; consider a **separate** optional authenticated Runtime project-storage service only after another design/security boundary review. Do not repurpose temporary Runtime artifacts or native `.local` provenance.

Application-owned schemas must distinguish logical project/source/graph lineage from fresh live owner/session/confirmation identity. Local verified content can instantiate a graph through a deterministic restore path; imported historical id/version/available fields alone cannot. Imported results get an explicit historical read-only type, never `motifResultRegistry` evidence or Apply authority.

## 7A — persistence foundation, origin contract, schema and migration

- **Objective:** establish storage adapter interfaces, explicit app/project identity, bounded typed schemas, CAS revisions/tombstones, truthful save/dirty/error receipts, migration quarantine and the stable-origin/portable-backup contract.
- **Likely boundary:** existing `src/persistence/threadStateSchema.js`, `threadStore.js`, `threadSaveQueue.js`, `usePersistentThread.js`; proposed `src/persistence/projectSchema.js`, `projectStore.js`, `storageCoordinator.js`, `storageMigration.js`; model/profile storage adapters; focused new persistence tests; new current Scope 7 contract documentation. Launcher design/input policy in `scripts/launcher-preflight.mjs` and `run-with-ollama.bat/.sh` if the stable-origin behavior is implemented here. Keep platform wrappers coherent; no wildcard CORS or automatic port takeover.
- **Dependencies:** human review of this audit and policy choices; exact existing v7.3.15 reader compatibility fixtures. No durable graph/native changes needed.
- **Invariants:** explicit schema support and byte/depth/count budgets; normalize data without authority; atomic previous-or-new manifest; one authoritative project revision; stale writers cannot undo deletion; no false saved status. Origin stability helps continuity but is not same-origin script isolation or backup.
- **Failure behavior:** storage unavailable/quota/blocked/corrupt/future version → session-only or read-only recovery with export/retry; preserve source bytes and last good revision. Do not overwrite sole corrupt/unknown evidence with defaults. Migration is copy/validate/publish with a retained original, not destructive field guessing.
- **Legacy migration:** read v0/v1 thread through its current safe projector, record an immutable migration snapshot/source digest and user review. Read current/legacy profiles/settings with bounded adapters. Publish into a new app/project namespace once; mark lineage. Old bundles may continue writing the legacy database, but cannot overwrite the new project database. Do not imply old changes are automatically synchronized; explicit re-import/merge is reviewed. Delete both legacy/current data only under the separately specified clear-local-data scope.
- **Tests:** R08, R12–R22, R39–R40, R45, R48, R52, R54; reproduce P05/P06/P07/P08 as regressions; load future versions without write-back; fake and real browser transaction failures; concurrent revisions; all original no-authority restoration checks.
- **Qualification gate:** all applicable existing source gates plus exact-SHA 7A fault/compatibility tests; evidence proves tracked boundary, supported migration examples and failure receipts. A new schema is not qualified by lint/build alone.
- **Non-goals:** graph/dataset/result persistence, background command execution, model semantic memory, mandatory Runtime filesystem database, changes to algorithms/native qualification or existing historical docs/evidence.

## 7B — durable workspace/project data and portability

- **Objective:** persist consented source bytes separately from metadata, canonical graph snapshots/type/lineage and typed parser/mapping drafts; introduce bounded verified workspace export/import and exact reattachment.
- **Likely boundary:** proposed `src/persistence/workspaceManifest.js`, `workspaceObjects.js`, `workspaceImportExport.js`, `workspaceRestore.js`; `src/App.jsx` orchestration; existing upload/parser/graph identity modules only as necessary to expose a validated restore boundary; dedicated tests. Optional storage-worker module for chunk hashing. New current contract docs; no product source archive verifier weakening.
- **Dependencies:** qualified 7A adapter/CAS/migration/origin contracts. Existing upload limits, canonical graph normalization and explicit user control remain authoritative.
- **Invariants:** exact bytes + cryptographic digest distinguish same-name/size replacements; no phantom available file/graph; object publication precedes manifest reference; no parser execution or graph mutation caused by loading metadata. A snapshot contains data, not serialized closures, callbacks, tokens or pending-controller objects.
- **Failure behavior:** missing/corrupt/oversize blob remains unavailable with re-upload/export guidance; partial staging cannot publish; old committed manifest remains usable; reattachment and mapping conflict require review. Retain interrupted drafts as inert, not completed work.
- **Tests:** R02–R11, R14–R18, R23–R27, R39–R40, R44–R48, R52–R54; actual browser Blob persistence; missing chunk/manifest crash timing; renamed-identical and replaced-identical-size sources; safe archive paths/expansion bounds and malformed imports; default local/Pages browser-only operation.
- **Qualification gate:** exact-SHA data-only restart/portability tests and all existing gates; measured memory/disk/backpressure; immutable export inventory/digests with a verified round trip. Keep portable **product-source** archive provenance/security contract distinct from workspace package format.
- **Non-goals:** restoring old pending mutations/approval/job authority, unbounded history, automatic profile code execution, native binary/qualification migration, CPU fallback or implicit projection.

## 7C — structured Assistant long-term memory

- **Objective:** meaningful multi-session objectives, stable decisions, completed-work references and unresolved tasks without raw-chat replay becoming the database.
- **Likely boundary:** proposed `src/agent/workspaceMemorySchema.js`, `workspaceMemoryReducer.js`, `workspaceMemoryContext.js`; `src/agent/conversationMemory.js`, `assistantContextSnapshot.js`, `orchestratorObservation.js`, existing thread/conversation/ReAct prompt builders, `src/components/AgentChatPanel.jsx`; deterministic event emitters and focused tests.
- **Dependencies:** verified 7A/7B project identities, content refs and commit receipts; current action allowlists/validators/confirmation owners unchanged.
- **Invariants:** application-generated events alone mark transformations/analyses completed; model suggestions are tagged unverified proposals. Memory cannot grant a capability, refer to an absent graph as available, select an unapproved endpoint, mint a pending update, mark Apply completed or replace live observation. Cross-project memory is not implicitly combined.
- **Failure behavior:** summarization/generation interruption leaves prior verified memory intact; stale facts are marked unresolved/stale, not silently rebound to new bytes; missing provenance excludes a claim from authoritative context. Bounded summaries remain historical fallback.
- **Tests:** R23–R27, R35–R37, R41–R43, R45, R50, R52–R55; false completed-job/approval claims, summary conflicts, project switching, source replacement, event duplication and selective context budgets; deterministic zero-mutation/job assertions.
- **Qualification gate:** exact-SHA memory/event/provenance tests, real bounded local-model continuity examples when available, and independent deterministic checks proving model responses cannot update authoritative facts. Missing model is a supported offline state, not permission to use a cloud API.
- **Non-goals:** unconstrained transcript replay, autonomous task continuation, automatic parser Run/Apply, new planner execution privileges, hidden background actions.

### Proposed structured memory contract

| Field / object | Deterministic application owner | What the model may read or propose |
|---|---|---|
| appId/workspaceId/schemaVersion/revision | Storage layer, committed CAS manifest; model cannot choose or revise ownership. | Read current selected identity as context; never manufacture it. |
| currentObjective | User-approved text, scope, timestamps and status; not executable command payload. | Suggest clarification/rewording or unresolved subtask; acceptance is typed application/user action. |
| stableDecisions | Decision id/value/scope/source-message-or-user-event, reviewedBy, createdAt and supersededBy. | Read selected relevant decisions; proposed/inferred decisions stay unverified until accepted. |
| datasets | Logical ids, exact source SHA256/bytes, consented object refs, aliases and current availability. | Read bounded previews/metadata actually available; filename is not proof of bytes. |
| graph | Verified logical lineage, type/schema/canonical digest, source transformations; fresh live-owner mapping separate. | Read the current validated observation; historical graph refs labeled historical/unavailable. |
| transformationsCompleted | Immutable application events with before/after graph refs, operation schema, parser/mapping digest and verified outcome. | Explain completed work; cannot mark an event executed or replay it. |
| analysesCompleted | Immutable output/provenance refs, input/update/algorithm/taxonomy/backend versions and validation status. | Summarize verified historical output; cannot assert current job/result/Apply authority. |
| unresolvedTasks | Bounded user/accepted task records, dependency refs, state and last-reviewed time. | Propose next questions/actions through current policy; no automatic resumption. |
| assumptions / notes | Source/trust/expiry and dataset/project scope; clearly distinct from verified facts. | Generate suggestions or caveats; never promote them by summarizing repeatedly. |
| provenance/timestamps | Application sequence, parent event/manifest digests, product/schema versions, observedAt/verifiedAt. | Read lineage; cannot rewrite validation/clock/author fields or erase conflicting evidence. |

Only current relevant project facts, a ≤2,000-char summary and bounded selected recent turns should enter ordinary prompts. An initial additional 8 KiB structured-context budget is a design target to measure, not a token guarantee. Never send all projects, raw large datasets or whole graph snapshots simply because they are now stored. Content digests and provenance are references, not implicit user permission to disclose sensitive bytes.

## 7D — Ollama and companion reconnect continuity

- **Objective:** separate stored preferences/last-known observations from current liveness; explicit unverified/connecting/verified/stale/error states, bounded transport fallback and coherent frontend/bridge/Runtime origin configuration.
- **Likely boundary:** `src/agent/localModelSettings.js`, `ollamaConnectionManager.js`, `localModelRuntimeState.js`, `localModelRequestCoordinator.js`, `localRuntimeDiagnostics.js`; App connection lifecycle; launcher/preflight and bridge configuration; `src/candy/useCandyRuntime.js` only for preserving/clarifying current fresh-session behavior; focused tests. A CANDY origin configuration interface, if needed, is a separately reviewed exact-origin change, not a wildcard.
- **Dependencies:** 7A identity/origin/freshness schema, stable host/port and bounded reviewed settings. 7B/7C enable user-facing recovery but do not authorize network activity by themselves.
- **Invariants:** enabled/model/timeout preferences can persist; sockets, connected booleans, active generations, capability lists and authorization do not. Reprobe current model listing and structured generation. Keep local-only architecture, fixed/configured destinations, no silent model download/substitution/cloud fallback. Do not reuse prior Runtime session/job authority.
- **Failure behavior:** missing Ollama/model/bridge, changed port or spoofed health → clear reason and deterministic controls remain usable; bounded retry/backoff without duplicate generation/action. A former Connected observation has a timestamp and becomes unverified/stale, not a current assertion.
- **Tests:** R09–R11, R28–R34, R37–R38, R49/R51/R55; Direct/Bridge alternatives, wrong responder, stale static build config, disabled assistant and Runtime restart with graph still mounted.
- **Qualification gate:** exact-SHA deterministic network-fault tests plus real selected Ollama/bridge restart smoke, separate Runtime authenticated discovery, all existing source gates. Services used for testing must be owned and cleaned up.
- **Non-goals:** background service installation, arbitrary port scanning, remote/cloud inference, model-generated connection targets, storage of credentials in portable workspaces, CUDA qualification changes.

## 7E — Resume Workspace UX and recovery controls

- **Objective:** one truthful reviewable recovery flow: list available projects/revisions, show saved/dirty/missing/corrupt/stale states, choose source reattachment/import, distinguish historical context from available current data, reconnect services and obtain fresh review for drafts.
- **Likely boundary:** App composition; proposed `src/components/WorkspaceResumePanel.jsx`, project selector and recovery status components; `AgentChatPanel.jsx`; narrow public storage/import/restore adapters from prior phases; accessible UI tests and current docs.
- **Dependencies:** qualified 7A–7D contracts and error receipts; no UI direct writes around deterministic validators.
- **Invariants:** RESTORE/REVALIDATE/RECONNECT/REUPLOAD/RECOMPUTE/DISCARD/REVIEW meanings from the current map; no automatic Apply/Run/download or misleading “resumed everything”. Clear chat, forget references, delete project and clear local data are distinct actions with precise scopes and receipts. External backups/downloads cannot be silently erased.
- **Failure behavior:** recoverable errors remain visible/actionable; export available when save cannot proceed; deletion races/tombstones handled; unsupported schema can be exported/quarantined without destructive repair.
- **Tests:** accessible real-browser flows across the full R-matrix, especially R09–R25, R35–R36, R40/R46/R47/R53; no phantom availability, repeated work, navigation surprises or hidden native calls.
- **Qualification gate:** exact-SHA UI/storage/service integration evidence, explicit state transitions, keyboard/screen-reader error recovery and all existing gates. Physical reboot cases remain separately labeled until actually run.
- **Non-goals:** automatically completing unresolved tasks, approving actions during restore, secure deletion of user-owned external files or assuming a saved browser permission survived.

## 7F — restart, crash, privacy, security and integrated qualification

- **Objective:** qualify implemented Scope 7 end to end at one immutable candidate SHA, including real browser/OS failure behavior, bounded scale, source/portable/extracted behavior and all protected Scope 1–6 contracts.
- **Likely boundary:** new tests/fixtures and qualification tooling for Scope 7, CI additions only when approved, new evidence/contracts. Any product fix discovered becomes a separately reviewed corrective with a new SHA; do not rewrite failed evidence or qualify mixed trees.
- **Dependencies:** qualified phases and complete case-to-evidence mapping; authorized physical-restart window; actual exact local installations if genuine GPU execution is claimed; retained historical evidence/tag identity inventory.
- **Invariants:** deterministic authority; typed validation; explicit mutation and motif confirmations; stale-context/graph checks; Runtime auth; STATIC/INCREMENTAL separation; fail closed; no CPU fallback, implicit projection, cloud requirement or automatic parser execution. Native `.local` inputs, algorithms and prior tags are not migration targets.
- **Failure behavior:** truthful NON-PASS with exact layer/reproduction; preserve evidence. An unavailable external tool is reported as unavailable, never relabeled PASS. No old infrastructure exception automatically waives a new product finding or missing Scope 7 gate.
- **Tests:** all R01–R55; full npm gates; actual browser lifecycle/quotas/crashes; user-controlled Windows restart; model/Runtime clean and abrupt restarts; genuine backend parity/regression where applicable; portable package provenance and independent verifier; secret/authority exclusion from workspace exports; large-object backpressure and project deletion recovery.
- **Qualification gate:** exact candidate SHA, complete executed/failed/deferred matrix, source/CI/package identities and immutable evidence inventory; zero unresolved unacceptable product risks. Any automated Security seal availability is stated separately under current policy. No release/promotion is authorized by this plan.
- **Non-goals:** new graph algorithms, native performance/scalability claims, requalification by remembered flags, changes to historical published release identities, unreviewed main promotion/tagging.

## Top five implementation risks and decision checkpoints

1. **Origin continuity:** a stable port alone does not migrate old data or isolate cohosted scripts. Choose fail/explicit-relocation and portable backup semantics before schema rollout (S7-01/S7-16).
2. **Authoritative data publication:** missing/partial blobs or stale digest/type/lineage must never become an available graph; don't store everything inside the chat record (S7-02/S7-11).
3. **Concurrent writers and deletion:** CAS, owner epochs and tombstones must prevent lost updates and resurrection, including late old-mount writes (S7-03/S7-04).
4. **Migration/privacy:** preserve old data, reject unknown future schemas, distinguish clear scopes and avoid silent quota/default overwrites (S7-05/S7-07/S7-15).
5. **Historical output/memory becoming authority:** typed memory/result import must remain inert until current deterministic validation; no approval/job/native-availability replay (S7-09/S7-10/S7-14).

Recommended first implementation phase: **7A**, beginning with reviewed contracts, failure fixtures and a minimal metadata/CAS/migration slice. The current audit stops before that work.
