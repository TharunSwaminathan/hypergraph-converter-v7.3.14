# Scope 5F integrated security qualification

Disposition: **PASS for the reviewed integrated Scope 5 production boundaries; no unresolved correctness-impacting Medium, High or Critical finding.** Required visible browser qualification remains **BLOCKED_ENVIRONMENT_BROWSER_HELPER**.

The completed [generated Codex Security report](C:/Users/tharu/.codex/state/plugins/codex-security/scans/hypergraph-converter-v7.3.14/1e8f7fa2eac97f9cadf72224ae9e99febdea85df_20260930T155702Z_raud90lf/report.md) preserves the genuine collision finding and its correction history in coverage. Scan ID: `e45d8f49-801f-4eb9-ba8f-153daf34c1c6`. Canonical completion succeeded once, with zero remaining reportable findings and no deferred integrated review task.

## Collision found during 5F and corrected

The original defect was Medium, high confidence (CWE-328/CWE-345). A short 32-bit FNV change marker plus serialized length was treated as sufficient content equality before the authoritative replacement check. Different imported topology could retain the graph ID/version and an old STATIC result as CURRENT. Real authenticated CUDA produced one connected triple for A and zero for B while both Hypergraph markers were `gfp-27452219-287`.

[Pre-fix evidence](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-collision-before.json) records DEFECT_REPRODUCED. [Post-fix evidence](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-collision-after.json) records CORRECTION_PASS: replacement changes graph ID and advances version even with equal markers; old current selection and approval fail. The marker algorithm was preserved.

Five production files were narrowly corrected: graphIdentity.js, graphState.js, graphMutationPreview.js, App.jsx and AgentChatPanel.jsx. Exact canonical comparison now governs material change versus no-op, explicit replacement advances lineage, and authoritative preview/version changes reach application and Assistant consumers. Runtime/native/result-binding protocols were unchanged.

The [focused regression](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/tests/candy-scope5f-collision.test.mjs) also covers ordinary material collision commits, exact same-content no-ops, identical-content replacement, differing ID/version, stale Assistant observation, and DynamicHypergraph marker `gfp-7912e519-294` with pending INCREMENTAL evidence/confirmation. Old result and approval are revoked; pending authority becomes STALE. The final full suite passed 268/268 files and focused Scope 5 passed 15/15.

## Final production-byte review and canonical metadata limit

The independent baseline reviewed the full App.jsx and AgentChatPanel.jsx and integrated graph/Assistant/controller/persistence consumers. The runtime investigator reviewed Runtime auth/origin, immutable artifacts, fixed qualified native selection, contracts, launch/cleanup/bounds and exact result binding. A focused independent reread checked all five corrective files and their unchanged STATIC/INCREMENTAL consumers after correction. All three qualification harnesses were independently reviewed; a discard fixture issue was corrected before the successful installed-model run.

[Final source inventory](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-source-inventory.json) records SHA-256 hashes of the final correction, regression fixture/test and three harnesses. These are the bytes reviewed and tested.

The workbench correctly warns: “Working-tree contents changed while the scan was running; results were saved for the original snapshot.” Its registered revision remains the original Scope 5E baseline. We do not claim that its metadata silently retargeted the working tree. The final-byte qualification above rests on independent post-correction source reviews, recorded source hashes, collision rerun and final regression/live evidence. The [completion record](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-security-completion.json) preserves this warning.

Whole-repository coverage is marked partial: unrelated parser/export/specialist modules and general tests/historical documents were not exhaustively audited. Requested integrated Scope 5 boundaries were reviewed. This is not an exhaustive security certification of every repository file.

## Controls and practical limits

Reviewed controls preserve separate analysis/Apply confirmations, synchronous local revocation, exact graph/pending/session/job/request/artifact/digest/backend/mode/device/taxonomy bindings, fresh retry and reauthorization, inert descriptive persistence, React text rendering, private bearer handling, and qualified resource bounds. No CPU fallback, incremental-to-STATIC fallback, implicit projection, or executable authority restoration was introduced.

Actual Runtime/CUDA/controller qualification passed seven matrix cases, all 30-bin parity checks, 21 result/currentness substitutions plus three HTTP auth/origin negatives, cancellation, held genuine late-result rejection, actual PROCESS_TIMEOUT, and new-session reauthorization. Installed Qwen3 proposed incremental analysis, separate Apply and discard through production bounded orchestration.

These are controller/transport observations, not visible browser evidence. Immediate cancellation does not establish interruption of an already running kernel; late-result rejection uses a genuine completed native result whose download is deliberately held. Harness history records a commit transition, not a visible App history interaction. Browser CORS enforcement, React discovery/reconnect, reload and two-tab smoke remain blocked. Private Windows local-state/temp ACL protections remain deployment assumptions; no cross-user exploit was established.

The completion tool measured aggregate usage across four associated threads: 25,743,772 total tokens; 25,660,056 input tokens, including 24,085,248 cached input tokens. This is host-reported aggregate usage, not an estimate of this final correction alone.