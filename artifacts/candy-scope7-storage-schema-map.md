# Scope 7 — storage schemas, owners and proposed boundaries

Target `335c320a052eab48d3f0c2d309805d10a5918189`. **Current** describes inspected production code; **proposed** describes unimplemented Scope 7 contracts. The current-persistence map traces the consumers and restart behavior.

## Current browser stores

### Thread database

Owner: the browser origin/profile and `AgentChatPanel` hook; not a filesystem path or checkout-specific workspace. IndexedDB name `hypergraph-chat-threads`, version 1; `threads` object store, keyPath `id`; generic create/list/delete/append APIs exist, but the mounted application uses only `main`. Serialization is IndexedDB structured clone of a projected plain object; JSON.stringify is used to enforce a character budget, not as the stored serialization format. `src/persistence/threadStore.js:16`, `src/persistence/threadStore.js:43`, `src/persistence/usePersistentThread.js:37`.

| Projected field | Bounds / meaning |
|---|---|
| schemaVersion | Output 1; input exactly 0 or 1. Version 0 is normalized with the same projector, not a journaled multi-step migration. |
| id / updatedAt | Strings ≤200 chars each. Save replaces updatedAt with current ISO timestamp. No CAS revision, project discriminator, integrity digest or migration marker. |
| messages[] | Last 80, roles user/agent only; id ≤80, text ≤6,000 chars, tone empty, actions empty. Truncation is silent. |
| summary | ≤2,000 chars; free-form historical text. |
| workspace.activeBatchId / detectedFormat | Strings ≤200 chars; historical only. |
| workspace.files[] | First 50; id/name ≤200 chars, numeric size (`Number(...) || 0`), requiresReupload true. No bytes, content digest, media type, path or handle. |
| workspace.parseMode | together/separate, else unknown. |
| workspace.parser | numeric version, source ≤200, code ≤60,000, status requires_review, resultId ≤200, historicalStatus ≤200. No executable binding/result bytes restored. |
| workspace.graph | id/fingerprint ≤200, numeric version; available false. No graph type, canonical bytes or history. |
| workspace.workflow | historical status ≤200, numeric attempts, requiresReview true; last 3 drafts, each id ≤200, code ≤60,000, up to 50 filenames ≤240, numeric attempts, status requires_review. |
| pendingAction, workspace.pendingAction | Always null. Unlisted keys, credentials, approvals, jobs, pending updates and results are omitted. |

`THREAD_LIMITS` is 80 threads, 80 messages, 6,000 message chars, 2,000 summary chars, 1,000,000 input-record JSON characters. These are JavaScript string lengths, **not byte or disk quotas**. Numeric metadata is loosely coerced rather than comprehensively range-validated. A null file entry causes TypeError; load rejects instead of restoring authority. The JSON size check happens before projection, so oversized extra fields also reject. `src/persistence/threadStateSchema.js:2`, `src/persistence/threadStateSchema.js:7`, `src/persistence/threadStateSchema.js:23`; probes P01–P04.

Creation/update: whole safe record put plus trimming in the same transaction; save resolves on transaction completion. saveMessage does read/append/write in one transaction but the hook does not use it. Trimming walks key order, preserves main/current, and is not age-based or LRU. listThreads loads all records before projecting id/time. A theoretical 80 × 1,000,000-character budget is not a practical storage guarantee. `src/persistence/threadStore.js:5`, `src/persistence/threadStore.js:32`, `src/persistence/threadStore.js:55`.

Errors/lifecycle: open denial/error or normalization failure makes the hook unavailable, without recovery/export/quarantine/retry UI. Open blocked rejects with a close-other-tabs message; a later successful blocked connection is closed. versionchange closes the cached database and resets its promise. No abnormal-close recovery handler, revision conflict resolution, broadcast reload, durable unsaved marker or shutdown flush exists. Transaction abort/errors reject; the hook displays a save error, but status remains ready after a write failure. Queue retains one in-flight and one latest snapshot; disposal discards the latest and suppresses callbacks, without aborting an already-issued write. `src/persistence/threadStore.js:20`, `src/persistence/usePersistentThread.js:12`, `src/persistence/threadSaveQueue.js:3`.

Delete: generic deleteThread exists; Clear chat and Forget references do not call it. Their narrower meanings and surviving stores must remain explicit. Portable across origins/machines: no native thread/workspace exporter/importer.

### Local model settings

Owner App; JSON localStorage key `hypergraph-local-model-settings`; `settingsVersion:3`. Current normalized allowlist: enabled, runtime=ollama, model, timeoutMs, temperature, maxPreviewFiles, maxPreviewLinesPerFile, transportPreference=auto, lastSuccessfulTransport, activeTransport, activeBaseUrl, migrationNotice, migrationNoticeSeen, settingsVersion. No API key field. `src/agent/localModelSettings.js:24`, `src/agent/localModelSettings.js:145`.

Reusable configuration: enabled/model/timeout/temperature/preview budgets and preferred transport hint. Ephemeral observations currently serialized alongside it: activeTransport/activeBaseUrl, without verifiedAt or a live generation. Migration normalizes old providers/model/timeout and rewrites changed settings; model name has a 128-character syntax limit. Numeric values are finite-coerced here, while actual requests separately clamp timeout and temperature. No explicit total record cap or strict future-version rejection exists; unknown settings versions are normalized to current. `src/agent/localModelSettings.js:64`, `src/agent/localModelSettings.js:99`, `src/agent/localModelClient.js:69`.

Read/parse/storage-access/migration-write errors return defaults; writes catch errors silently and return no persistence acknowledgement. No application-wide erase, export or cross-origin migration exists for settings. Plaintext model/endpoint/notice configuration is available to same-origin scripts; it must never be taken as current liveness. `src/agent/localModelSettings.js:165`; P07/P10.

### Parser profiles

Owner App; current key `hypergraph_converter_parser_profiles_v7_3`, fallback legacy `hypergraph_converter_parser_profiles_v7_2`. JSON array; loader also accepts an object with profiles. Profile fields created by production: id, schemaVersion 3, name, createdAt, updatedAt, datasetType, fileRoles, fileSignatures (names/extensions/size buckets/header fingerprints/headers/role), relationshipSignature, mappingSpec, parserCode, fingerprint. `src/agent/parserProfiles.js:3`, `src/agent/parserProfiles.js:6`.

Validation is only truthy id/name plus string parserCode. `migrateProfile` supplies defaults then spreads the original profile, preserving unsupported versions and unknown fields. Save filters and caps count to 100; individual code/mapping/signature size and load count are not explicitly bounded. Browser quota is the ultimate storage cap. The profile fingerprint is a short length/prefix-derived identifier, **not a cryptographic dataset or parser integrity check**. `src/agent/parserProfiles.js:104`, `src/agent/parserProfiles.js:127`, `src/agent/parserProfiles.js:143`; P08.

Load parse/access errors return []; save/delete/upsert/import can throw quota/access exceptions. Saving current data does not erase the legacy key. An empty current array shadows it; removing only the current key can expose old legacy profiles again. P09 reproduces that precise condition; ordinary Delete alone does not immediately resurrect a profile.

Export format is `{schema:"hypergraph-parser-profiles-v7.3",exportedAt,profiles}`; current download filename is `parser-profiles-v7-2.json`. Import helper merges by id and saves, but no full workspace import consumer is present. Explicit Use puts code into the editor without running it; execution safety is a separate invariant. `src/agent/parserProfiles.js:67`, `src/agent/parserProfiles.js:75`, `src/App.jsx:3878`, `src/App.jsx:3897`.

### Session pairing

Owner Runtime hook/browser page session; sessionStorage key `hypergraph-studio.candy-runtime-token.session`, raw bearer-token string, no explicit browser field length limit. The server creates a 32-byte random token and uses timing-safe equality; authorization is checked on protected routes. Storage errors are caught so live pairing can still work. Pairing replacement invalidates existing analysis/discovery; unauthorized connection failure removes the hint. No hint grants authorization without current authenticated discovery. `src/candy/useCandyRuntime.js:9`, `src/candy/useCandyRuntime.js:52`, `candy-runtime/src/auth/sessionAuth.js:3`.

## Current filesystem / process resources

| Resource / owner | Effective location and schema | Creation, validation, migration, cleanup and limits |
|---|---|---|
| Standard CLI artifacts / Runtime | `<os.tmpdir()>/candy-runtime-owned-<first16hex(SHA256(cli import.meta.url))>/<64hex>.artifact`; workspaces under `workspaces/job-XXXXXX/request.txt`. | Content-addressed immutable bytes, metadata in RAM; marker `candy.artifact-store/1`, realpath checks and exclusive kernel lease. Requested modes 0700 directory / 0600 files. Recognized old artifacts/workspaces deleted at startup, unknown files fail closed; no workspace schema migration/recovery. Default 6 MiB/artifact, 512 artifacts, 64 MiB total, 4 pending writes. `candy-runtime/src/cli.js:7`, `candy-runtime/src/artifacts/ownedRoot.js:20`, `candy-runtime/src/artifacts/artifactStore.js:11`, `candy-runtime/src/config.js:16`. |
| Pairing file / CLI | `<os.tmpdir()>/candy-runtime-pairing-<same rootKey>.txt`. Current audit installation computes rootKey `a31b335b6f9c7307`; current normal tmpdir is `C:\Users\tharu\AppData\Local\Temp`. These paths were calculated, not opened. | Stale file must be regular, non-symlink, ≤512 bytes before deletion; new exclusive write requests 0600; normal SIGINT/SIGTERM deletes it. Crash may leave it until next start. Secret never included in evidence. Windows effective ACLs were not tested. `candy-runtime/src/cli.js:10`; `candy-scope7-readiness-work/probes.json`. |
| No-override library artifacts / Runtime | Random `<os.tmpdir()>/candy-runtime-artifacts-*`, same child naming. | Normal server close disposes root; a configured root closes/releases ownership. Stable CLI reconciliation does not prove cleanup of abandoned random roots. `candy-runtime/src/server.js:48`, `candy-runtime/src/server.js:120`. |
| Jobs/results / Runtime RAM + temporary artifacts | Random fresh runtimeSessionId; in-memory job map; request/result contract schema versions. | Default 16 active jobs, 32 terminal, 16 MiB terminal retained state; 60 s queue wait, 120 s job deadline, 8 MiB result. Limits do not create durable jobs. `candy-runtime/src/jobs/jobManager.js:79`, `candy-runtime/src/jobs/jobManager.js:182`, `candy-runtime/src/config.js:16`. |
| CUDA_STATIC qualification / local operator | `candy-runtime/.local/cuda_static-qualified-build.json`; native build/source and hash-bound native/sanitizer evidence. Schema `candy.motif-qualified-build/1`. | Record bounded to 32 KiB, regular non-symlink; related files bounded by regularBytes; exact expected commit/tag and hashes, CUDA/device/toolchain validation. Never general user project data. `candy-runtime/src/capabilities/motifQualification.js:24`, `candy-runtime/src/capabilities/motifQualification.js:37`. |
| CUDA_INCREMENTAL qualification / local operator | `candy-runtime/.local/cuda_incremental-scope6d-tranche1-f3fa7dc3-qualified-build.json`; versioned native directory and exact evidence. | Same strict checks plus approved exact record SHA256. Distinct from STATIC; not replaced by a remembered available flag. `candy-runtime/src/capabilities/motifQualification.js:25`, `candy-runtime/src/capabilities/motifQualification.js:43`. |
| Earlier SSSP qualification / local operator | `candy-runtime/.local/cuda-qualified-build.json`, schema `candy.cuda-qualified-build/1`. | Independent manifest/source/Makefile/binary/device/toolchain checks. Unrelated to project persistence or motif output authority. `candy-runtime/src/capabilities/cudaQualification.js:10`, `candy-runtime/src/capabilities/cudaQualification.js:72`. |
| Windows native request / qualified process | Host workspace request path translated from drive letter to `/mnt/<drive>/...` in Ubuntu WSL. | Fixed executable/supervisor, shell:false, qualification boundaries; graph data confidentiality also depends on host and WSL permissions. No automatic import of binaries/attestations. `candy-runtime/src/backends/nativeProcessRunner.js:10`, `candy-runtime/src/backends/nativeProcessRunner.js:43`. |
| Launcher/service logs / operator | Shell combined launcher uses `${TMPDIR:-/tmp}/hypergraph-local-runtime-bridge.log` and `hypergraph-ollama-server.log`; Windows launcher uses its process/output lifecycle rather than these shell redirects. | Bridge logs method/path/status operational data; forwarding is in memory and code explicitly avoids logging request bodies. External Ollama server logs/model storage have their own operator lifecycle, not an application workspace schema. `run-with-ollama.sh:11`, `run-with-ollama.sh:53`, `local-runtime-bridge.js:191`, `local-runtime-bridge.js:301`. |
| Downloads / browser-user filesystem | Browser-chosen filenames/directory, selected export formats and profile JSON. | User retains/deletes; app cannot promise secure deletion or know download completion from anchor click. Object URL registry cleans handles after delay/unmount. No authority-bearing resume token. `src/utils/downloadLifecycle.js:3`. |

No production persistence consumer for CacheStorage, service-worker/offline cache, cookies or stored File System Access handles was found in tracked src/index.html. Vite dependency/browser HTTP caches can exist independently; they are not project data or an application resume mechanism. This inventory does not inspect the user's private browser profile or assert filesystem ACL protection that was not measured.

## Proposed storage architecture and option decision

Recommended first implementation: a browser-first project database with app-scoped names, project UUIDs and revision CAS, plus an explicit portable workspace layer and a stable launcher origin. Keep the existing legacy thread reader as a constrained migration input. Native/Runtime installation is optional and must remain so for browser/Pages use.

| Option | Decision and limits |
|---|---|
| Stable launcher origin | Adopt a canonical loopback hostname/explicit stable port policy; on conflict fail clearly or obtain an explicit relocation choice. Never kill another listener or silently imply its storage moved. Does not itself provide backup, same-origin security isolation or machine portability. |
| IndexedDB project database + portability | Preferred common baseline: separate small manifests, typed memory and content-addressed blobs/chunks; all references point at verified complete objects. Export/import handles origin/machine changes explicitly. |
| Runtime-mediated durable storage | Possible later optional adapter after a distinct authenticated project-storage API/security contract. Never reuse the temporary artifact root, cleanup lease, pairing token or live job API as the project database. Must work without a qualified GPU and use private storage outside native `.local` provenance. |
| Explicit export/import | Required escape hatch for origin changes, backup and Pages/local moves. Bounded manifests, digest verification, relative-path guards, schema migration preview, fresh project mapping on conflicts, no credentials/actions/binaries/attestation import. |
| Automatic origin migration | No silent cross-origin browser reads. Old-origin export/new-origin import is the baseline. An optional broker requires explicit trust, exact origins and authentication; a wildcard/postMessage dump or browser-profile scraping is unacceptable. |
| File System Access API | Optional user-selected local workspace adapter; permission and source bytes revalidated after restart. No assumption that handles/permissions exist on every browser or Pages; offer import/export fallback. |
| OPFS / large object backend | Consider only when measured IDB Blob/chunk performance warrants it. Separate capability-detected adapter, worker I/O and crash-safe manifest publication; never rely on cross-store atomicity that does not exist. |

### Proposed object contracts and initial budgets — design targets, not measured capacity

| Class | Proposed owner / contents | Initial bound and backpressure |
|---|---|---|
| Project manifest | Deterministic storage layer: appId, schemaVersion, workspaceId, revision, previousManifestDigest, sources/graph/result/memory refs, timestamps and committed object digests. No approvals/jobs/tokens. | 256 KiB hard serialized-byte cap; small atomic CAS publication; preserve last good manifest on failure. |
| Messages | Per-project append records, id/sequence/role/text/trust/source references; separately paginated. | Keep current 6,000-char per-message input cap initially, pages of 100, 10 MiB/project soft retained-history budget. Explain/prune/export before loss; do not silently claim infinite memory. |
| Summary / structured memory | Versioned application-owned typed facts and references; model proposals separately tainted. | Current 2,000-char summary compatibility; 256 KiB structured memory cap; deterministic validation and selective model context. |
| Source datasets | Optional consented exact bytes, SHA256, byte count, logical dataset id and display-name hints; missing bytes represented explicitly. | Retain current upload bounds: 50 files, 10 MiB/file, 50 MiB aggregate. Chunk writes ≤1 MiB with at most 2 pending chunks; no automatic expansion of parser/Runtime limits. |
| Canonical graph snapshots | Own content objects with graph schema/type, canonical digest and verified lineage; fresh live owner on restore. | Initial 16 MiB/object persistence cap, 50 MiB/project graph/history budget; refuse oversize durable save and keep working session/export available. Execution still obeys existing stricter algorithm/backend limits. |
| Immutable derived results | Output bytes + input/graph/update digests, algorithm/taxonomy/backend/build/device provenance and validation version. Historical display only until applicable checks pass. | Initial 8 MiB/object, 32 MiB/project result budget; explicitly evict recomputable results first, never source data without consent. |
| Runtime artifacts | Existing session-only owner/limits unchanged. | Re-upload verified input when current artifact is absent. Durable output is copied only through a separate validated archival path, never by adopting old job/session IDs. |
| Security/ephemeral state | Fresh in-memory owners only. | Zero durable approvals, pending execution tokens, authorized booleans, active requests, sockets or capability proofs. |

An initial 200 MiB/project soft total with an origin-wide cap of the smaller of 256 MiB and 20% of reported quota is a conservative planning target, not a browser guarantee. Keep at least 20% reported free space as headroom; fall back safely when estimation/persistent-storage requests are unsupported or denied. Tune with measured fixtures before qualification. Budgets include encoding/metadata overhead and may stop writes earlier. Exceeding a budget must set a visible unsaved/read-only state with export/retry, rather than discard authoritative data or acknowledge success.

Stage objects/chunks, verify their hashes, then publish a manifest referencing only complete objects in a final transaction. A crash before publication leaves harmless orphans; a crash after publication leaves a fully traversable previous-or-new manifest. Retain last good revision, bound staging, garbage-collect only unreferenced owned objects and use tombstones so stale writers cannot resurrect deletions. IDB transaction completion is an application acknowledgement, not an unconditional power-loss/fsync guarantee. A separate user export remains the backup boundary.
