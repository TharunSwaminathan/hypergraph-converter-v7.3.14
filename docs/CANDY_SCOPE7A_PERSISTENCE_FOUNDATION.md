# Scope 7A persistence foundation

This contract changes metadata/chat storage integrity and launcher identity. It does not implement a resumable workspace. Uploaded bytes, graphs/history, semantic Assistant memory, native results/artifacts, pending mutations and execution authority remain outside durable storage. Runtime/native qualification and graph algorithms are unchanged.

## Origins and launch policy

Canonical local frontend origin: **http://127.0.0.1:5173**. Combined Ollama, dev and preview launchers check that port and use Vite `--strictPort`; an occupied port fails instead of silently choosing :5174. No other listener is killed. Explicit `FRONTEND_PORT` on combined launchers selects one exact port, prints the selected origin and warns that persistence is separate. Shell HOST override on dev/preview is also explicit/noncanonical. No wildcard origin/CORS rule is introduced.

localhost, 127.0.0.1, different ports and Pages are different browser storage namespaces. Existing data on a former preview origin such as :4173 is not moved to :5173. Cross-origin export/import is deferred to 7B; the scripts do not scrape browser profiles. Project/app names prevent accidental key collisions, not access by another script already sharing the same origin. Direct manual `npm run dev` remains an advanced Vite invocation; to follow this policy supply `--host 127.0.0.1 --port 5173 --strictPort` or use the launcher.

The existing Runtime browser-origin allowlist is not widened by an advanced frontend override. If it rejects a noncanonical frontend, report that mismatch; do not turn it into wildcard trust. Ollama remains local-only; there is no new reconnect loop, service installation, model download or cloud API.

## Project database and ownership

Database `hypergraph-studio-projects`, version 1, app namespace `hypergraph-converter-studio`. Object stores:

| Store | Key / data |
|---|---|
| projects | Canonical lowercase UUIDv4 projectId; strict schemaVersion 1 metadata, revision, previousRevision, createdAt/updatedAt, deleted/tombstone, storageState=committed, migrationLineage. Maximum serialized manifest 256 KiB. No graph/dataset/result/semantic-memory fields. |
| threads | projectId → existing safely projected thread record. Browser thread id `main` is not a project identity. Historical messages/summary/references only. |
| meta | Versioned app-scoped default-project selector. Missing/corrupt selectors with existing projects fail read-only rather than guess. |
| migrations | Versioned legacy-thread migration receipt bound to the selected project and its manifest lineage. |
| quarantine | Bounded recovery descriptors identifying preserved original sources; no duplicate raw chat/parser/secret payload. Maximum 40 descriptors. |

Project creation uses add, not upsert; at most 80 identities including tombstones. Every update supplies the exact expected positive safe-integer revision. A single native read/write transaction reads/validates the project, checks revision/deletion, and writes the next manifest plus thread/lineage or deletion. Only transaction completion resolves a committed receipt. Missing projects are not auto-created by writes. Duplicate identities, stale revisions and tombstones reject. Timestamps are descriptive, not CAS.

Delete commits a higher revision tombstone and removes thread data in the same transaction. Clear project data retains minimal selectors/identity tombstones/migration markers to prevent late writes and automatic legacy re-import. A deleted selected project stays read-only; future UI can explicitly create a new UUID project through the foundation API. No automatic project selector/Resume UX is introduced here.

## Save receipts and failures

Coordinator states: clean, dirty, queued, writing, committed, error, conflict, read_only, abandoned. Receipt includes projectId, committedRevision, local sequence/committedSequence, unsaved, typed code/error. One in-flight write and one newest pending snapshot bound memory; flush waits for completion/error. Disposing a dirty owner does **not** claim its queued state was saved; late callbacks cannot publish into it. versionchange invalidates the owner epoch as well as the connection.

The displayed acknowledgement names a committed project revision. Dirty/writing/error/conflict states say not saved. beforeunload warning is best-effort and may be suppressed by a browser; it is not a save mechanism. No guarantee of fsync, immediate disk flush, survival of forced browser/OS termination, or physical erasure is made. Browser storage is not an external backup.

Metadata creation alone is not saved chat. A coordinator without a committed thread starts dirty. A missing thread at a published non-deleted revision fails read-only instead of silently replacing it with empty/default content.

Quota/abort leave the prior valid revision intact. Retry is explicit for recoverable storage failures; a conflict does not silently rebase and overwrite another tab. Reload/review is required for conflict or versionchange. Denied/missing storage leaves deterministic controls usable in an explicitly unsaved session. Unknown versions, malformed data and invalid lineage fail read-only; source records are preserved. Quarantine descriptors support diagnosis without executing or guessing a repair. Full recovery/export UX is deferred.

## Bounded data and adapters

All newly accepted data is inspected before JSON serialization: plain finite acyclic values only, bounded depth/nodes/arrays/strings/serialized UTF-8 bytes, no accessors or prototype-mutating keys. Existing thread projection/limits and inert restore semantics remain; an additional 2 MiB byte and structural admission bound precedes its character check. No whole graph/dataset is added to that record.

Settings: `hypergraph-studio.settings.v1`, envelope schema 1, value settingsVersion 3, 16 KiB value budget plus 4 KiB envelope allowance, depth/node/text bounds. Numeric fields are finite and within timeout 1–120 seconds, temperature 0–1, preview files 1–50 and lines/file 1–500. Legacy supported settings versions 0–3/providers migrate through the existing local-only normalizer; future versions are not downgraded. activeTransport/activeBaseUrl/lastSuccessfulTransport remain bounded historical hints, never a Connected proof. App startup remains disconnected. `saveLocalModelConfig` now returns an explicit success/failure receipt; App exposes failed persistence.

Profiles: `hypergraph-studio.parser-profiles.v1`, envelope schema 1; profile versions 2 and 3 accepted. Maximum 100 profiles, 2 MiB collection, 60,000 code characters / 240,000 UTF-8 code bytes, 128 KiB bounded mapping/signature metadata/profile, depth 12, 5,000 metadata nodes and 1,000-item nested arrays. Unknown fields/future versions/invalid shapes reject rather than silently drop. The existing lightweight profile fingerprint remains a convenience identifier, not a cryptographic source binding. Explicit Use, code-safety validation, worker limits and separate Apply are unchanged.

localStorage publication is a synchronous atomic setItem of value plus lineage, acknowledged only after that API succeeds. It is **not transactional project CAS**, cross-store atomicity, or a physical disk guarantee. Project conversation/metadata uses IndexedDB CAS; global preferences/profiles remain app-scoped localStorage. Do not claim these independent stores provide workspace-wide multi-store transactions.

## Non-destructive migration

COPY → bounded VALIDATE → PUBLISH new namespace → RECORD LINEAGE. Legacy inputs:

- IndexedDB `hypergraph-chat-threads/threads/main`, schema 0/1, passed through the existing safe projector;
- localStorage `hypergraph-local-model-settings`;
- current parser key `hypergraph_converter_parser_profiles_v7_3`, else legacy `hypergraph_converter_parser_profiles_v7_2`.

Original legacy data is retained during migration. Thread publication and project lineage commit atomically; value and lineage for each localStorage adapter share one setItem. New namespace data takes precedence; an empty new profile collection does not reveal legacy profiles. Unsupported/corrupt original data is not replaced by defaults. Quarantine records only source/error metadata; the original remains in its original store. Current project-schema data cannot be manufactured from a graph fingerprint or a migration claim alone.

Migration does not restore message actions, pending mutations/approvals, Runtime jobs/authentication/native availability, or graph availability. Historical parser code remains inert. A stale old release can still write its old legacy store, but cannot overwrite the new project namespace. Those later legacy writes are not silently merged into a migrated project.

## Privacy and deletion scopes

| Operation | Scope and acknowledgement |
|---|---|
| Clear chat | Existing UI resets messages/summary and pending conversational state; asynchronous project save must commit before a saved receipt. Does not delete the project or other stores. |
| Forget saved workspace references | Existing UI removes historical recovery references; later project commit records the change. Does not delete chat, current source files or all local data. |
| Delete project | Foundation API checks expected revision, commits tombstone and deletes project thread atomically; stale owners cannot recreate it. No new project-management UI in 7A. |
| Clear local application data | Foundation orchestration commits project tombstones, then clears legacy threads, both legacy settings/profile keys, new adapter values and session pairing hint. App-adapter deletion markers remain to prevent fallback. Returns PARTIAL if an independent later step fails; never claims one atomic erase across stores. |

Adapter markers deliberately reject later ordinary saves after a clear. A fresh app-preference/profile initialization policy/UI is deferred; do not bypass the marker by writing cached old data. Minimal identity/deletion markers contain no thread/parser/dataset payload. Delete/clear never visits Runtime `.local`, native build/evidence files, user downloads, external backups, other origins or physical browser remnants. No secure-erase promise is made. Origins and backups need separate explicit cleanup.

## Qualification boundary

7A includes metadata/chat ownership, save integrity, bounded settings/profiles and migration/deletion foundations. 7B authoritative bytes/graphs/results/portability, 7C semantic memory, 7D reconnect, 7E Resume/recovery UI and 7F physical/integrated qualification remain deferred. Current source tests, transactional doubles, mounted happy-dom tests and isolated real native IndexedDB tests are labeled separately. No automatic Security seal or native/GPU qualification is implied.
