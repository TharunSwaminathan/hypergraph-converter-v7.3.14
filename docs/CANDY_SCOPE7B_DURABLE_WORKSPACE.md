# Durable workspace storage (Scope 7B)

Scope 7B stores authoritative source bytes and canonical graph data independently
of Assistant chat. It builds on the qualified Scope 7A project UUID, revision,
CAS, tombstone and transaction-completion contracts. It does not add semantic
Assistant memory, model reconnect, Runtime job continuation or Resume Workspace UI.

## Storage and versioning

The `hypergraph-studio-projects` IndexedDB database upgrades from version 1 to 2
by adding `workspaceRoots` and `workspaceObjects`. Existing project/chat/settings
schemas and originals are retained; no source/graph is guessed from old filename
references. Old clients opening database version 1 fail read-only with VersionError.
Upgrade/versionchange revokes old connections. Neither localStorage nor chat nor
the project metadata manifest contains complete datasets or graphs.

The bounded workspace root is a separate project-owned publication manifest.
It contains descriptors, source/snapshot/derived relationships, the current graph,
up to five historical checkpoints, publication revision, timestamps, lifecycle,
logical byte accounting and SHA-256. Object bodies use ArrayBuffer, without base64
or binary JSON inflation. Each body descriptor includes project UUID, object UUID,
type, schema 1, creation/publication revision, timestamps, byte length, SHA-256,
provenance and COMPLETE or EXTERNAL lifecycle. Keys include project and object ID.

SHA-256 comes from Web Crypto, tested against a published known vector. Source
hashes cover exact input bytes. Snapshot hashes cover the stable canonical JSON
payload; the existing short graph fingerprint remains a separate semantic change
marker. The root digest covers descriptors/provenance. Hashes detect corruption
and substitution relative to the stored manifest, not authenticity against hostile
scripts already controlling the same browser origin.

## Publication, ownership and deletion

Prepare bounded immutable payload copies and compute hashes outside the database
transaction. The read/write publication transaction checks expected project revision,
tombstone and previous root identity, checks the application budget, writes bodies,
publishes the root and advances the project revision together. An empty initial
chat record is created only for a genuinely unpublished project. Missing previously
published chat is corruption, not a reason to overwrite with defaults.

Only transaction.oncomplete acknowledges committed bytes. Native abort/quota failure
rolls back root, objects, checkpoint eviction and project revision. There are no
partially published authoritative objects. Recovery distinguishes INCOMPLETE or
ABORTED failures and reports ORPHANED records; explicit orphan cleanup requires
valid ownership/root/CAS and never adopts unreferenced bytes. Normal publication
also removes unreferenced objects belonging to that same project.

A tab shares one serialized revision lineage between its chat and workspace writers.
Only revisions produced by that local lineage can advance a writer's expected CAS
revision. Another tab's revision is never adopted by retry after local writing has
started. Conflict requires reload/review. The local queue retains at most the active
write and latest pending workspace input. Dirty/errors trigger a best-effort unload
warning; explicit retry is offered only for recoverable quota/unavailable/abort errors.
Disposed or versionchanged owners cannot acknowledge or restore into a new owner.

Delete project atomically tombstones the project and removes its chat/root and all
project-prefixed durable objects, including history/derived/orphans. Clear local
application data extends the 7A deletion foundation to these stores. Other projects,
downloads, external backups, Runtime/native `.local` qualification, model installation,
other browser origins and physical remnants are not erased. Cross-store application
clear remains a PARTIAL-capable operation, not a physical secure erase.

## Source and graph restoration

Actual File/Blob bytes are preserved for uploads. Editor text has explicit UTF-8
editor-source identity, not a false claim to recover original file encoding. Original
filename/media type and source keys are stored; parser route/code-source hashes,
mapping specification/hash and snapshot parent identity preserve the graph provenance
chain. Batch detection metadata is historical; bounded profiling may be recomputed
from validated bytes, without parser code execution. A graph retains the source
owners used to create it when current editor/uploads subsequently change.

Startup validates project, workspace root, all current object schemas/ownership,
lengths, SHA-256, graph source relationships, mapping digest and canonical graph
fingerprint, then reconstructs the immutable graph and input fields. Only afterwards
does App receive the restored graph. Missing/unsupported/corrupt records remain
unavailable/read-only with bounded quarantine descriptors; originals are retained.
Local edits started before validation finishes are not overwritten by old data.

Exact source reattachment compares bytes and SHA-256, not filename, timestamp or
size alone. Results distinguish EXACT_MATCH, CHANGED_SOURCE, MISSING_SOURCE,
CORRUPT_SOURCE and UNSUPPORTED_SOURCE. Minimal recovery file controls can repair
missing/corrupt source bytes only on an exact match, preserving graph identity.
Changed bytes never silently replace the old source/graph provenance. Normal new
uploads receive new source objects when published as a new workspace revision.
Reattachment never runs a parser, transformation, Apply or Runtime operation.

Canonical snapshots retain graph type, ID/version, vertices/incidences, attributes,
explicit vertices and fingerprint. Historical reads validate the selected checkpoint
and its sources/derived mapping before returning historical data. Unread checkpoints
are explicitly unverified; missing history is reported without fabricating it or
making the current valid graph unavailable. Checkpoint reads never publish a graph
or restore old undo/action/confirmation objects. App's execution history starts fresh.

## Explicit budgets and performance limits

| Policy | Cap |
|---|---:|
| Source body | 8 MiB |
| Graph body | 8 MiB |
| Derived deterministic metadata | 256 KiB |
| Workspace root | 128 KiB |
| Current source objects (including retained graph inputs/parser) | 24 |
| Prior graph checkpoints | 5 |
| Project logical durable bytes | 32 MiB |
| Application logical durable bytes | 128 MiB |
| Graph admission | 400,000 nodes; 100,000 entries per array; depth 16 |

Logical accounting includes body bytes, serialized object headers and the root;
browser database overhead is implementation-dependent. Declared source set sizes
are checked before copying/hashing. Root/derived/graph serialization is bounded.
Oldest unpinned historical checkpoints are removed first to fit project budget;
the current snapshot is never evicted before successful replacement publication.
There is no arbitrary pin UI in 7B. All application-root metadata is checked only
for write-budget accounting; startup reads selected project records, not all payloads.
Project object-key enumeration is metadata-only and bounded by the application policy.

Before publication, `navigator.storage.estimate()` is attempted when available.
Clearly insufficient estimated free space returns QUOTA. Missing/denied estimate
does not imply unlimited storage: configured caps and actual transaction errors still
apply. A 7A-compatible upload can remain usable in memory while exceeding durable
policy; its persistence error stays visible and the previous committed workspace stays
intact. Source/raw decoding and graph JSON validation still use the main thread within
these caps; Web Crypto hashes asynchronously. No larger-scale responsiveness claim
is made beyond measured fixtures (up to 1 MiB source / 5,000 hyperedges).

Browser quota is origin-wide and estimates are approximate; best-effort storage may
be evicted and private sessions may have different retention. These configured caps
are not a promise that the browser grants that amount. See [MDN storage quota and
eviction guidance](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
and [StorageManager.estimate](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate).
No persistent-storage permission prompt, backup guarantee, fsync or physical reboot
guarantee is introduced.

## Deliberately partial portability and unchanged authority

The versioned descriptor/object/digest contract is the export/import foundation.
No workspace archive reader/writer, ZIP parser or cross-origin transfer is shipped
in 7B. S7-16 remains PARTIALLY_CLOSED. Existing parser-profile export/import is a
separate legacy feature, not full workspace portability. Later archive work must
validate bounded membership, provenance and payloads and never execute imported
code/actions or admit credentials/native qualification state.

The canonical origin remains http://127.0.0.1:5173 with no silent port fallback,
wildcard CORS or browser-profile migration. Structured Assistant memory, automatic
Ollama reconnect, polished Resume Workspace UX, historical motif-result archives,
physical restart/crash qualification and later phases remain deferred. Graph/source
bytes are deterministic storage data; they do not restore approvals, pending updates,
Runtime authentication/jobs/results, native availability, model connection state or
execution authority. Parser text returns as a draft: Run stays blocked until the
user edits it or selects Use reviewed draft. That review does not Run the parser
or create an Apply result/approval; Run and Apply remain separate fresh actions.
