# Scope 8D frozen contract — Search and filter retained analysis history

Date 2026-11-15 (America/Chicago). Repository `TharunSwaminathan/hypergraph-converter-v7.3.14`.

- Qualified Scope 8C baseline `339f62c09821a227937ec3eb1653d1e34cbf46e8`.
- Qualified tree `5a90a1bb30fda50c131bc088c2978a4045ba7ce1`.
- Qualification tag `candy-integration-scope8c-history-portability-qualified`.
- Evidence branch `candy-integration-scope8d-readiness`.

This file is the authoritative frozen Scope 8D implementation contract. The seven readiness files remain historical evidence for the recommendation and the qualification design. This freeze authorizes an evidence-only commit and push to the readiness branch. Implementation has not begun and requires separate authorization.

## Exact four-path implementation boundary

| Change | Path | Baseline Git mode and blob |
|---|---|---|
| MODIFY | `src/components/AnalysisHistoryPanel.jsx` | `100644 f092a766423b081892650d0a14c6a0e18f6f79f3` |
| MODIFY | `src/components/AnalysisHistoryPanel.css` | `100644 7709c86ff06e8585f0c1572312b8aa6301f4e8c9` |
| NEW | `tests/candy-scope8d-history-search.test.mjs` | Absent at baseline |
| NEW | `docs/CANDY_SCOPE8D_ANALYSIS_HISTORY_SEARCH.md` | Absent at baseline |

The existing `AnalysisHistoryPanel({ history, confirm, onRerun, nativeReady })` props supply records, project identity, status and existing actions. `analysisHistoryCoordinator.js` supplies the validated owner-scoped snapshot. `analysisHistorySchema.js` already validates label, backend and origin. App mounts the panel in Algorithms at `src/App.jsx:5587`. `WorkspaceExperience.jsx:88` keys the active scene by owner and generation. The four paths cover the view, styling, mounted regression and documentation. Future isolated browser drivers may reuse existing fixtures as temporary qualification work.

Protected dependencies include `src/App.jsx`, `src/components/WorkspaceExperience.jsx`, the history coordinator, hook and schema, project/session/Resume/confirmation code, persistence and storage policy, graph and analysis controllers, both portability codecs and download lifecycle, Assistant, Ollama, Runtime and CUDA, existing tests and fixtures, package/dependencies, build/release tooling, launchers, and workflows. A change to any protected path requires separate scope authorization before proceeding.

## Matching and presentation

- One native input has the associated accessible label **Search analysis labels**. Search the existing validated `record.label` only. Apply a literal, case-insensitive substring match after trimming leading/trailing query whitespace. Enforce an 80 UTF-16 code unit cap on raw query input in the control and matching boundary before trimming or normalization. Empty or whitespace-only input has no query restriction. Derive results synchronously. Use no regular expressions, indexing, or asynchronous search. Outcome payloads, source text, graph data, and Assistant memory are outside the search boundary.
- **Backend** offers exactly All, CPU, CUDA_STATIC, and CUDA_INCREMENTAL. **Origin** offers exactly All, LOCAL, and IMPORTED, using `record.provenance.origin`. Origin display labels may be Local and Imported / unverified. Unsupported filter values resolve to All. Combine query, backend, and origin with AND.
- For a loaded snapshot, display **Showing X of Y results**, where X is visible matching records and Y is total loaded retained records. Keep `data-history-count` as Y. A separate visible-count attribute is optional. Preserve the existing reverse retained-record order, without sorting, deduplication or changes to records or identity.
- Provide native **Reset filters**. It restores the empty query and All for both selectors, bringing back the complete retained list. Initial values use the same defaults.

## Status and selection

| View state | Required behavior |
|---|---|
| Loading | Show the existing loading status. An initial empty array does not establish an empty archive. |
| Unavailable or error | Keep storage and handler errors visible. If previously verified rows are present, treat them as a loaded snapshot and keep their counts distinct from a fresh successful read. An initial empty array does not establish an empty archive. |
| Ready with zero retained records | Show the zero count and the confirmed no-retained-results message. |
| Ready with retained records and zero matches | Show the count for zero matches, separate no-match text and access to Reset. |
| Ready with visible matches | Show the matching count and applicable list and detail. |
| Writing or refreshing with a previously loaded snapshot | Keep the existing status visible and identify displayed rows and counts as the previously loaded snapshot. Do not show a new empty-archive claim from a transient empty array. This is a presentation rule using the supplied state, with no new coordinator status or operation. |

Query, filters, and selection are ephemeral and scoped to the mounted project. Reset them on any project identity transition, including null-to-project, without an intermediate render pairing the previous project's state with the new rows. A project-keyed boundary inside the panel is appropriate. Remount or reload starts at defaults. Hiding and showing Algorithms within the same mounted project retains the local state.

Keep a selected record when it remains visible and eligible in the current snapshot. Clear it when the record disappears or is excluded. Show detail and record-specific controls only for a current visible selected record. Widening filters, resetting criteria and refreshing data do not select or reselect a record. Reset retains a selection that was still eligible at the time of reset. Typing, Enter, selector changes and Reset do not execute a history action. Maintain existing row identity and selection indication.

Use native labeled input, select and button controls in normal keyboard tab order. Announce matching counts politely without shifting focus during typing. Restore focus safely to the search control when removal of a focused row drops focus and a modal does not own it. Verify no overlap or clipping on narrow viewports and at browser zoom. Preserve Escape, Cancel, confirmation focus, and existing error visibility.

## Security, persistence and authority

A filter is a read-only projection of the supplied project's already validated records. Treat queried input and imported claims as data. Render through native controls or plain React text. Use no HTML, Markdown or URL interpretation of query text or record metadata. Filtering adds no storage reads/writes, network or inference requests, browser persistence, telemetry, outputs or control-plane calls. Do not change project revisions, archive bytes, imported provenance, retention, replay or tombstone state. Pending reads or stale snapshots do not authorize new actions or transfer authority to another project.

Retain explicit, exact confirmation and destructive-review bindings to owner, project, command and revision. Filtering cannot retarget, mint or reuse a review or approval. Existing **Clear project analysis history** still clears the entire retained history after confirmation. Existing record delete retains reviewed ID and digest. Rerun still requires an explicit user action and current-input checks, and existing CUDA_STATIC review and CUDA_INCREMENTAL current-update requirements still apply. Filtering creates no current-input identity, rerun permission, graph mutation, parser execution, Apply, native job, or Runtime authorization. Existing import and Resume continue to isolate historical data, executable authority and Assistant memory. Query and history filters never enter the Assistant prompt or change reconnect consent.

Non-goals include new IndexedDB stores, migrations, record fields, localStorage or URL persistence, new endpoints, archive or download format changes, execution changes, Ollama endpoint/model/configuration changes, Assistant memory changes, retention or replay changes, favorites, annotations, comparison, cross-project search, and the README launcher correction. The README discrepancy is deferred separately. No new source/graph/history serialization or global search state.

## Qualification and acceptance gates

1. **Frozen proposed-source.** Pin the direct baseline and exact four-path delta, modes, Git blobs, physical hashes and tree or frozen snapshot identity. Verify a clean index and whitespace, including the new files. Run clean install, full source suite with rediscovered count, focused 7A/7B/7C/7D/7E/8A/8B/8C/8D suites, lint, production/Pages/relative builds, and production audit with zero vulnerabilities. Run the existing package producer and verifier on the frozen proposed source with the appropriate snapshot provenance. Verify deterministic clean/populated outputs, allowed membership, integrity, modes and exclusions, then repeat clean install, tests, builds, lint and production audit from a fresh Git-free extraction. Record tests and package results separately.
2. **Mounted Scope 8D regression.** Test query and combined facet matching, default/reset, whitespace/case, cap and literal adversarial text, unsupported facets, all three backends and both origins, loaded counts, all six status cases, and reverse retained order. Test selection exclusion, deletion/eviction, reappearance, project switch including null-to-owner, remount, and absence of stale row/detail leakage. Verify keyboard Enter and Reset are inert. Confirm existing explicit review behavior with positive controls. Label DOM/store/Runtime doubles.
3. **Native Chrome and IndexedDB.** Use guarded disposable profiles and established historical regression fixtures. Test real navigation and rootless import/Resume, legacy full-workspace portability, active owner changes, two-tab stale writes/deletes and retained authority guards. Verify keyboard, focus recovery, live count/accessible labels, Escape/Cancel, narrow layout and browser zoom. Distinguish native events from timing or storage-failure injection. For normal passive interactions measure zero filtering-triggered storage writes, network requests, inference or execution-authority actions and verify unchanged project/history/ledger, graph, memory and profile identity. Use explicit-action positive controls and existing current-input rerun guard coverage. Verify actual import/Resume isolation. Where a model isolation gate is required, use actual local qwen3:8b and identify any double separately. Use the existing service only, with no start, stop or reconfiguration of user WSL/Ollama. Live CUDA is excluded.
4. **Exact candidate SHA.** After separately authorized creation of a product candidate, verify direct parent and the complete tree and four committed blob identities against the frozen proposed-source receipt. Rerun applicable source, native browser, manual scoped security and separate Git-free extraction gates from exact bytes. Create a new deterministic commit-bound archive using the existing producer and independent verifier. Record source commit/tree, archive hash/size/counts and per-entry verification. Require exact candidate-bound PR and applicable branch push CI, including completed/success for Ubuntu, Windows, macOS and CPU/browser. If a synthetic merge is used, verify ordered parents and complete recursive tree equality before accepting it. Verify protected refs, tags and historical PASS/NON-PASS evidence before and after qualification. Following any separately authorized promotion, verify exact `main` identity and its required fresh CI.
5. **Decision.** Any required failed or unverified gate blocks qualification. Preserve failed evidence. No unresolved Critical, High or Medium finding may pass the scoped security gate. Automated security seal is **NOT RUN / NOT CLAIMED** unless separately performed. Live CUDA execution is **NOT REQUIRED / NOT CLAIMED**.

This freeze performed source and evidence verification only. No implementation, runtime qualification, live CUDA execution or Ollama service action occurred.
