# Workspace portability (Scope 8A)

Use **Export workspace** and **Import workspace** in the Workspace panel. These controls are separate from source upload and the Assistant composer.

Export includes the selected project's saved source bytes, converted graph, provenance, bounded existing graph checkpoints, name/identity, project memory and allowed local model selection. Pending edits are not included. Review source contents before sharing a file. Recognizable credential material is refused rather than silently redacted. The application does not read/export credential stores, reconnect leases, browser storage internals, chat transcripts, approval tokens, pending actions or Runtime/process state.

After selecting an import file, wait for **Ready to import**. Validation changes no saved data. Choose **Import as separate workspace** to create a fresh local project. The source project identity is retained as provenance in the import receipt and bounded project migration lineage; the file's writer revision is never adopted as local authority.

If the current workspace has unsaved edits, importing a separate workspace requires the existing Cancel-first review before publication. Cancel retains the edits and current workspace.

To replace an existing project, Resume it first, ensure its changes are saved, then choose **Replace selected workspace…**. The confirmation identifies the destination and incoming project. Replacement changes that project's source, graph/checkpoints and project memory and resets its local chat/pending actions. Other projects are retained. Cancel leaves all saved data unchanged. Any destination change after review requires a new review; a stale tab cannot rebase its confirmation or overwrite the import.

**Import complete** means the native IndexedDB transaction completed. Choose normal **Resume workspace** to open the imported project. Reopening the browser follows the existing Auto Resume preference. Import restores data, never Apply/delete/graph-replacement/parser/CUDA permission. Imported parser code requires the existing review/Run/Apply workflow.

Only active memory is imported, with `IMPORTED` provenance and `UNVERIFIED` confidence. Superseded/forgotten content never becomes active. Recall remains project-scoped, bounded and `untrusted_context_only`; instruction-like text cannot authorize an action. Existing valid workspace-derived references are remapped to the newly sealed local root; obsolete references remain stale.

Safe model selection is stored with Auto Reconnect OFF and no remembered availability/success proof only when this installation has no existing model preference. Existing model configuration or an explicitly forgotten profile is retained. Use qualified Assistant Settings to connect and freshly verify the selected local model. Import itself never probes a model, runs a process or falls back to a cloud provider.

## Container contract

The file is an **uncompressed** UTF-8 container with the exact prefix `CANDY-WORKSPACE\n`, followed by canonical JSON. Its extension/MIME type is a convenience, not a trust decision. ZIP, GZIP and all other containers are rejected before parsing/decompression; there is no decompression or filesystem extraction path.

The top-level fields are exactly `format`, `manifest`, `manifestSha256` and `payloads`. `format` is `candy.workspace`. JSON object keys are canonicalized using the application's stable key ordering, with no insignificant whitespace; duplicate keys or alternate representations are rejected. SHA-256 of canonical manifest JSON binds all root/object hashes and project/memory/model metadata.

Current manifest version **2** contains exactly:

- `schemaVersion: 2`;
- `project`: version 1, source project UUID, bounded name and creation date;
- `workspace`: version 1 and the verified qualified workspace root;
- `memory`: a verified version-1 memory envelope or `null`;
- `modelPreferences`: `null` or version 1 containing only provider `ollama`, approved loopback endpoint, transport and explicitly selected model.

Supported minimal version **1** has the same project/workspace/memory contract but no model preference field. Validation checks its original manifest hash before explicitly migrating it to version 2 with `modelPreferences: null`. This is a defined compatibility schema, not a claim that an earlier published application shipped it. Unknown future versions fail with an incompatible-version result and preserve saved data.

Every payload has exactly `schemaVersion: 1`, `path`, `encoding: base64` and `data`. Paths must be lowercase canonical `objects/<UUID-v4>.bin` names matching a referenced object. Absolute paths, separators other than the one literal `/`, traversal, percent encoding, aliases, duplicate names and unreferenced payloads are rejected. Original source filenames remain bounded metadata and are never used as paths. Every payload's byte length and SHA-256 must match the exact referenced qualified object header. All retained current/checkpoint graphs, metadata and provenance are validated before staging completes.

Limits: 48 MiB encoded container; 32 MiB aggregate decoded payloads (also subject to existing durable project accounting); at most 156 referenced payloads; existing 8 MiB per source/graph, 256 KiB derived-data, 24-source and five-checkpoint limits. Before materializing application data, each checkpoint is limited to 156 source references and 64 MiB of expanded source/graph-binding references, preventing repeated metadata references from multiplying Blob allocations. Memory retains the qualified 100-record/32-active envelope limits, with recall at most eight items, 6000 characters and two per type. Existing project/application byte, project-count and migration-lineage budgets remain enforced. No compression expansion budget is needed because compressed input is unsupported and never inflated.

Repeated export of unchanged saved data is byte-identical. There is no export-time timestamp/random identifier. Payloads are sorted by UUID, and timestamps/identifiers already belonging to saved data remain data. Transient model connectivity and global chat-only revisions are omitted.

## Publication and conflicts

The parser validates bounded container/schema, canonical names, manifest hash, every object hash, source/graph relations, application restoration metadata, memory and model policy before producing a private staged handle. No staged object is an authoritative database object.

Publication mints local ownership and re-seals root/memory for the fresh local project/revision, or advances the reviewed destination's existing revision exactly once. A single transaction publishes project/root/objects/memory, empty authority-free chat, startup selection/name and eligible model selection. It also establishes the default-project pointer atomically on a truly new installation. Invalid/missing existing default identity is not implicitly repaired.

The receipt resolves only on transaction completion. Errors/abort roll back every category. A crash after native commit but before acknowledgement can leave a valid complete imported project, which normal Resume may discover; the old UI must not claim a receipt it never received.

The exact same file has an explicit duplicate-conflict policy: an import lineage marker rejects replay, including attempts after editing or deleting the imported project. It never silently rolls back data or resurrects a tombstone. New and replaced destinations have bounded lineage; a full lineage requires a separate project rather than evicting replay protection. Replacement requires fresh owner review/confirmation for each attempt. Replaced mounts are invalidated so their queued old snapshots cannot overwrite the imported state. Global startup/display intent and existing model intent are retained, apart from the explicitly selected imported project/name.

Hashes provide integrity, **not publisher authentication**. Imported files and memory remain untrusted even when their hashes are internally valid. A malicious file cannot obtain local mutation authority through schema/provenance fields. Arbitrary secrets hidden in user source bytes cannot be semantically identified with certainty; source review before sharing remains necessary.

Scope 8A adds no motif result history, workspace synchronization, cloud storage, general archive extraction or Runtime redesign. Proposed-source qualification does not claim candidate-commit provenance or remote CI before a candidate exists.
