# Standalone analysis history portability — Scope 8C

Download retained historical results independently of saved source, graph or
workspace data. Choose a standalone file, review its contents, then explicitly
confirm **Import history as new project**. The result is a new history-only
project with **Resume available**. Import does not open or execute it. Normal
future startup Auto Resume may restore its data; it never resumes actions.

The controls are beside existing workspace portability controls. A dynamically
created file input avoids competing with normal source upload. Cancel is the
initial confirmation focus; Escape cancels. A separate unsaved-edit review
protects local edits before leaving the current project.

## Data and authority

Only validated retained analysis records and a bounded project display name are
included. Historical outcomes may contain sensitive user, result or vertex text.
Review before sharing: this is not anonymization or guaranteed secret removal.
There are no source/graph bytes, checkpoints, Assistant memory, chat, model
profiles/endpoints, credentials, native clients/jobs/tokens, pending updates,
confirmations, approvals or private completion ledgers in this format.

Hashes establish content consistency, not computation, backend identity,
authorship or trustworthy origin. Import preserves descriptive claims but marks
records **IMPORTED / unverified**, remints record IDs relative to a fresh local
project UUID, and clears adoptable capture/workspace-publication revisions.
Import never merges with or replaces an existing project. Its fresh private
completion ledger contains only imported retained records.

Resume/inspection restores no Apply, deletion review, graph replacement, parser
Run/Apply, native/CUDA, model connection or automatic rerun authority. Supplying
matching current input explicitly is required before the existing safe rerun
path becomes available. CPU rerun creates a fresh completion; STATIC requires
current confirmation; INCREMENTAL requires a current pending update. Analyze
and Apply remain independent. No CPU fallback or implicit projection is added.

## Standalone wire contract

UTF-8, uncompressed, magic `CANDY-ANALYSIS-HISTORY\n`, format
`candy.analysis-history`, schemaVersion `1`, extension `.candy-analysis-history`.
The exact top-level fields are `format`, `schemaVersion`, `sourceProjectId`,
`name`, `records`, `sha256`. The digest covers canonical UTF-8 encoding of the
other five fields, not the prefix. The prefix is independently checked. The
reported file SHA256 covers the complete file including prefix and digest.

Encoding uses the existing stable canonical JSON representation. Duplicate or
unknown keys, noncanonical serialization, trailing whitespace/junk, invalid
UTF-8, invalid UUID/name/digest and unsupported schemas are rejected. MIME and
extension do not establish trust. The produced export bytes pass the exact
same decoder used by import before download is offered.

Bounds are 3 MiB total file bytes, 1–24 records, 256 KiB per record, 2 MiB
retained-record collection, and outer depth24/nodes60000/array10000/string60000.
Existing stricter history record/envelope validators remain unchanged. The
rebased sealed envelope with its new ledger must also fit 2 MiB. Limits reject;
no silent truncation. Identical unchanged snapshots produce identical bytes.
Re-export after import can differ because local identities/provenance change.

## Storage, concurrency and lifecycle

Export reads project, history and display label in one readonly snapshot.
Workspace absence or corruption cannot impede independent valid-history
export. Missing, empty, corrupt or future history refuses export without repair.

Preview and cancellation write nothing. Admission data is private behind a
WeakMap staging handle; callers cannot replace it through preview properties.
The handle is consumed once, synchronously before asynchronous rebasing, and
discarded on file/owner/project changes. Obsolete UI callbacks are ignored.

A single native IndexedDB transaction publishes the fresh project, sealed
history, empty authority-free thread, label/selection/default metadata and
`history-portable/<fileSHA256>/<sourceProjectId>` lineage marker. Existing
selection CAS and current-owner checks apply before and inside publication.
Duplicate/concurrent identical files are rejected across validated project
inventory, including retained tombstones. There is no deleted-project recovery
exception. Distinct content remains bounded by inventory and byte limits.

Project80/lineage32/history8MiB/shared workspace-history128MiB policies remain.
Browser quota/transaction failures roll back all publication writes. Existing
data is not evicted to admit an import. Saved receipts follow transaction
completion, never merely request success. A successful commit followed by
discovery failure is reported as **saved but discovery failed**, not rollback.

Resume appends an independent Analysis history count/error category after
Source, Graph, Assistant memory and Local model. Summary refresh is generation
guarded and read-only; it does not adopt a writer revision. Workspace-only
deletion retains history, memory and chat; whole-project deletion remains
scoped/tombstoned. Existing reviewed stale-delete protections remain unchanged.

History-only imports contain no Assistant memory. Returning to a source project
restores its own memory. Application-wide model preferences, durable reconnect
OFF and profile tombstones are never changed by this import. An existing
consented connection may be freshly verified only through the unchanged model
restoration flow after explicit Resume; file admission itself never connects,
infers, starts a process or grants reconnect consent.

## Compatibility and qualification

No database migration: DBv5/project1/history1 remain unchanged. Existing full
workspace formats1/2/3, including their saved-root requirement, are unchanged.
The standalone format is not accepted by the workspace codec and vice versa.

Qualification requires immutable proposed-source and fresh Git-free extracted
full/focused suites, lint, production/Pages/relative builds, zero-vulnerability
production audit, native Chrome/IndexedDB separate-profile transfer/restart,
CAS/replay/rollback/quota tests, untrusted-data/authority review and actual local
qwen3:8b memory/reconnect continuity. Doubles/injected faults must be identified
separately from real-browser and real-model evidence. Tests and tools do not
certify physical backup or host disk/ACL guarantees.

Pre-commit packages are **PRE-COMMIT / PROPOSED-SOURCE QUALIFICATION**, never
commit-bound provenance. Exact candidate-SHA CI/package/extracted closure is
deferred until a separately authorized candidate exists. No staging/commit/tag
or main promotion is authorized by proposed-source qualification.

LIVE CUDA EXECUTION NOT REQUIRED / NOT CLAIMED.

Automated security seal: NOT RUN / NOT CLAIMED unless independently executed.

Deferred: merge/replacement, notes/editable result labels, pinning, search,
comparison, new analysis families, retention policy changes, corruption salvage,
memory/model transfer, cloud sync and Scope 8D.
