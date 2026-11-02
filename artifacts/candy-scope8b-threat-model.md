# Scope 8B threat model

Scope: the frozen pre-commit delta atop f1e040e90764eac925d04c78d734a884dc4cd6cc. This is a manual source-backed model, not an automated Security scan or seal. The threat-model skill's required independent architecture review identified the CPU-preview/committed-graph distinction, lazy trace/Map normalization, volatile native result authority, v4 persistence ownership and v1/v2 portability boundary before implementation. Those facts were cross-checked in the current-analysis-flow report.

## Assets and trust boundaries

Assets are authoritative workspace/source/graph bytes; current writer ownership/revision; Assistant memory; local reconnect intent; historical outcome integrity and truthful saved receipts; bounded local storage; native authentication and fresh analysis/Apply approval. Browser origin and installed local operator remain trusted. Import files, graph labels, model text, persisted records and historical provenance are untrusted data. A same-origin script or fully compromised browser/OS can already alter application data; SHA256 is consistency evidence, not publisher authenticity or protection against that principal.

| Boundary | Data flow | Enforcing source |
| --- | --- | --- |
| Explicit CPU Run → history | Captured operation UUID, options and actual `finalHes`; automatic recomputation stays live-only | `src/hooks/useAlgorithms.js` run/runSelection/completion effect; `src/App.jsx` analysisHistoryContext |
| Native completion → detached history | Exact current registry acceptance precedes projection; no job/client/token authority serialized | `src/candy/motifAnalysisController.js` openResult; unchanged motifWorkflow/resultRegistry validators |
| Raw outcomes → plain schema | Whitelisted final outcome keys, bounded normalization, strict owner/type/algorithm/backend/taxonomy and digests, sensitive-text screening | `src/persistence/analysisHistorySchema.js` |
| Owner → IndexedDB | Existing serialized session lineage, exact CAS, snapshot recheck, current-owner predicate, transaction completion receipt | `src/persistence/projectSession.js`; `projectStore.js` readAnalysisHistory/mutateAnalysisHistory |
| Imported bytes → staged handle | Canonical bounded JSON, complete legacy validation plus strict v3 records; private WeakMap handle | `src/persistence/workspacePortability.js` stagePortableWorkspace |
| Staged data → local owner | Deterministic remint, IMPORTED/unverified origin, no adoptable revisions, atomic all-category publication and stale replacement checks | workspacePortability preparePortablePublication; projectStore importWorkspace |
| History → UI/rerun | Escaped read-only text; computed current digest; new request through current CPU/native review | `AnalysisHistoryPanel.jsx`; App rerunHistoricalAnalysis |

## Threat disposition

| Threat | Control / test evidence |
| --- | --- |
| Malformed, future, corrupted, deeply nested or oversized records | Strict exact keys and nested CPU/native types; byte/node/depth/array caps; all three record digests and envelope digest verified. Adversarial and history suites reject rehashed malformed output. |
| Prototype pollution or executable serialization | boundedCopy rejects dangerous keys, accessors, cycles, exotic prototypes/functions. Normalization inspects array/object descriptors without executing getters. Tests assert getter counter stays zero. |
| HTML/script injection | No HTML sink; React text/pre escaping. Mounted test proves `<img>` remains text with no image node. Native historical inspection exercises actual renderer. |
| Foreign project substitution / spoofed backend or provenance | Owner equality, exact supported enums/taxonomy, consistency checks; portable import remints owner/record IDs and always labels imported/unverified. Rehashed malicious native/CPU variants rejected. A valid rehashed claim remains untrusted historical data. |
| Stale append / destructive lost update | Shared CAS and private one-use command/revision reviews. Foreign and same-owner intervening changes reject reviewed history delete/clear. Native two-tab append/clear and project switch during crypto preparation tested. |
| Duplicate callback / deleted result resurrection | Fresh operation identity, observer dedup plus durable completion digest ledger retained through clear/delete/eviction. Changed replay conflicts; ledger exhaustion fails rather than discarding guards. |
| Imported authority or graph-digest mismatch | No serialized execution action fields admitted. Imported records cannot reconstruct current controller/confirmation/client. Equivalence recalculated from current input; rerun independently rechecks current input and current safe path. |
| Unsafe endpoints, callbacks, credentials | No endpoint/handle/callback/token fields in schema; CPU final data strictly typed. Credential-like text blocked even inside strings and raw manifest fields; graph content remains sensitive user data requiring intentional export. No claim that arbitrary unlabeled secrets are detectable. |
| Quota / storage amplification | Record256KiB/project2MiB/global8MiB, nodes/depth caps,24 retained results,512 lifetime ledger, workspace/history128MiB shared cap. Deterministic eviction never touches memory/workspace. Tests verify byte/global limits and atomic failure. |
| Partial publication / false receipt | Crypto outside transaction, CAS/snapshot checked inside; success only on oncomplete. Unit abort/quota/delayed completion and native actual browser kills before put/after commit-before-receipt verify all-or-nothing recovery. Post-commit discovery error retains truthful committed receipt. |
| Schema downgrade or broken old exports | Additive DB5 creates only missing store. Future history fails closed without rewrite. Genuine prior Scope8A exported file still imports; v1/v2 keep original semantic budgets. V3 history uses explicit extension and same authority/payload rules. |
| Scope7 model/memory regression | No model client/coordinator/schema changes. Actual qwen3:8b request receives only permitted imported project memory as untrusted context; reconnect OFF survives actual browser restart. Focused7C/7D plus preserved full regression. |

## Local deployment/resource facts

Studio uses the qualified canonical loopback origin 127.0.0.1:5173 with strict port. Durable history is origin-local IndexedDB `hypergraph-studio-projects`, schema5, `analysisHistories` projectId key; it is not an OS file or cloud sync. v3 exports are explicit user downloads; only selected project validated data is included. Qualification uses task-owned Chrome profiles beneath artifacts/candy-scope8b-work, an external frozen/extracted source root, an owned strict-port server and test-only guarded fixtures. Native fault hooks are excluded from production assets. No real personal CANDY browser profile is touched.

Native Runtime endpoints, bearer/session handling, CUDA executable/qualification records, supervisor, artifactRoot and temporary-job resources are unchanged. Historical device/build strings do not start/probe CUDA or provide authentication. STATIC/INCREMENTAL transport tests explicitly simulate capability/result data; no live CUDA qualification is inferred. The old Runtime README explicit-root cleanup discrepancy remains outside Scope8B and is preserved in the initial flow map.

Ollama remains the existing local service at localhost:11434, model qwen3:8b, discovered freshly only by the existing explicit Connect control. The first native attempt stopped when WSL/Ollama was unavailable. After the user confirmed it running, the isolated frozen-source retry used an actual successful local request. Product history introduces no automatic process launch or model reconnect. No credentials appear in portable history or reports.

## Deferred trust and work

History is not a signed scientific attestation, replayable executable job, persistent native artifact registry or independent GPU qualification. No failed/partial computation is archived as success. Favorites/pinning/metadata editing, additional analysis families, history-only workspace export, cloud/cross-user synchronization and Scope8C are outside this delta. Commit-bound package provenance and candidate CI remain deferred until a human authorizes and creates a candidate. Automated security seal: NOT RUN / NOT CLAIMED.
