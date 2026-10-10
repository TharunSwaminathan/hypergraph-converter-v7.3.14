# CANDY Scope 5F final qualification — visible-browser closure

**Verdict: PASS — corrected UNCOMMITTED working tree.**

All required visible-browser gates now pass. The earlier browser-helper block is resolved and preserved as history. Real Chrome/UI checks used the authenticated loopback Runtime; four reload states, independent tabs, Assistant, inert navigation, unavailable Runtime and replacement/currentness checks completed.

The frozen checkpoint `bf0240a54fb6ac8284bd9ac371306511158a1a2e` is **not** claimed qualified: browser testing exposed a stale panel notice after Assistant Apply. One component and its mounted regression were corrected; affected real browser paths and 268/268 tests, lint, both builds, the existing production audit (zero vulnerabilities), diff check and corrective security review pass. A future final commit must bind and qualify the corrected bytes before release/tag; qualifiedCommit is null.

See [browser closure observations](candy-scope5f-browser-closure.md), [browser qualification](candy-scope5f-browser-qualification.json), and [corrective security disposition/source hashes](candy-scope5f-browser-corrective-security.json). The security scan found no reportable vulnerability in the narrow correction; its snapshot warning and measured usage remain recorded. The supplementary broad audit reports four development dependencies in the unchanged lock; it does not replace the existing `--omit=dev` audit gate.

HEAD and blocked tag remain `bf0240a`; all new evidence/correction stays UNCOMMITTED. No commit, tag, push, merge, fast-forward or history rewrite occurred. Prior collision finding/correction, real CUDA matrix, installed-model/controller evidence and integrated security evidence remain unchanged and valid for their original boundaries.

---

## Preserved original qualification report

The following original report is retained verbatim as historical evidence. Its blocked verdict, earlier head and uncommitted disposition describe the earlier qualification attempt; the closure above and browserClosure JSON describe current state.

# CANDY Scope 5F final qualification

**Verdict: PASS WITH QUALIFICATION BLOCKED**

The fingerprint-collision defect discovered during 5F is corrected. Final automated, integrated security, authenticated Runtime/CUDA and installed-model/controller checks pass. Visible browser-only observations remain **BLOCKED_ENVIRONMENT_BROWSER_HELPER**. Plain PASS is not eligible.

All changes are **UNCOMMITTED** on `candy-integration-scope5f-final-qualification`. HEAD remains `1e8f7fa2eac97f9cadf72224ae9e99febdea85df`. No commit, tag, push, merge, reset, amend or main-branch change was performed.

## Finding and exact correction

A real Medium integrity defect allowed different imported graphs with the same short fingerprint to retain previous committed graph lineage. Existing exact result bindings consequently accepted the old STATIC result as CURRENT. The earliest broken boundary was the no-op check in nextCommittedGraphIdentity, before explicit replacement handling.

The deterministic Hypergraph pair shares `gfp-27452219-287`, but actual CUDA counts are A=1 and B=0 connected triples. [Before correction](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-collision-before.json), replacement kept ID/version and old current result selection succeeded. [After correction](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-collision-after.json), lineage changes, version advances, and the old result/approval cannot remain current.

| Production file | Correction |
| --- | --- |
| src/graph/graphIdentity.js | Explicit replacement always advances lineage; ordinary no-op requires retained canonical content equality as well as marker equality. |
| src/graph/graphState.js | Type-only transition also requires exact canonical hyperedge equality. |
| src/graph/graphMutationPreview.js | Colliding material edits remain graphChanged. |
| src/App.jsx | Version changes trigger commit/history handling; prepared mutation results carry authoritative preview.graphChanged. |
| src/components/AgentChatPanel.jsx | Preview description consumes the authoritative material-change flag. |

The short fingerprint remains a stale/change marker. No algorithm rewrite, Runtime protocol change, native change, taxonomy change, fallback, projection or persistence of executable authority was introduced.

The [collision regression](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/tests/candy-scope5f-collision.test.mjs) uses real production currentness controls with explicitly labelled fixture Runtime evidence; separate real-CUDA reproduction proves the native distinction. It covers same-content no-op, ordinary collision commits, identical-content replacement, same marker/different ID or version, stale STATIC confirmations, Assistant observation, and DynamicHypergraph collision `gfp-7912e519-294` with pending/incremental result and approval revocation. Both STATIC and INCREMENTAL exact binding paths remain intact.

## Final gates after live work

| Gate | Result |
| --- | --- |
| npm run test | PASS — **268/268 test files**, final runner time 115.7s |
| Focused Scope 5 | PASS — **15/15 files** |
| npm run lint | PASS |
| npm run build | PASS |
| npm run build:github | PASS |
| npm audit --omit=dev | PASS — zero vulnerabilities |
| git diff --check | PASS |
| Frozen native directories | No tracked delta from baseline |
| package.json / package-lock.json | No delta |
| Historical tracked evidence and Scope 5A–5E tags | Unchanged |
| Integrated final-byte security review | PASS — collision remediated; no unresolved integrated finding |

Both builds retain the existing large-chunk advisory. A damaged temporary npm tool installation was repaired outside the repository; final gates used npm 11.4.2 without changing project manifests.

## Actual Runtime/CUDA and Assistant evidence

[Real Runtime qualification](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-live-runtime-qualification.json) passed **7 cases**, **24 negatives** and **7 lifecycle cases** across **34 authenticated Runtime job submissions**.

The matrix covers insertion, deletion, same-ID replacement, old/new-ID replacement, multiple affected hyperedges, disconnected topology insertion with zero signed delta, and novel inserted vertex. Each runs genuine qualified CUDA_INCREMENTAL, validates signed 30-bin results, and checks kernel launch/synchronization. Genuine old STATIC plus delta equals new STATIC in all 30 bins; sum(deltaCounts) equals deltaTotalConnectedTriples. Zero delta is qualified on the disconnected insertion fixture, not claimed for arbitrary edits.

Staging and analysis leave the committed graph unchanged and pending update VALIDATED. Fresh separate Apply commits once, advances version once, matches the proposed fingerprint, records one controller history transition, submits no Runtime job, revokes result currentness and rejects replay. Valid Apply without analysis commits once with zero jobs. Metadata-only change reports motifImpact NONE and blocks Analyze without manufacturing a zero delta; full no-op produces no pending/next-version/analysis/Apply authority.

All 21 required result/current-authority substitutions rejected; three real HTTP negatives rejected missing bearer, wrong bearer and untrusted Origin. Lifecycle evidence includes actual terminal cancellation, synchronous local revocation, held genuine late-result rejection, actual 1ms PROCESS_TIMEOUT, and Runtime restart with new session, old result/approval rejection and fresh reauthorization. Cancellation was requested immediately after submission; this does not prove interruption of an already running kernel.

[Installed-model qualification](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-assistant-qualification.json) passed three genuine Qwen3:8b responses through production bounded orchestration and authorizers: incremental proposal with separate confirmation, separate Apply proposal, and discard. Incremental confirmation ran actual CUDA. Apply committed once with no job; discard changed no graph. MAX_REACT_STEPS remains 8 and selectors remain bounded. The first CPU-model attempt timed out without mutation; the bounded warm retry passed. This does not qualify visible Assistant-panel rendering or the UI model bridge.

Deterministic staging/correction, quoted/negated/hypothetical requests, malformed/model-invented trusted fields, stale observations, independent approvals, inert rendering/navigation and persistence/concurrency are covered by the final automated Scope 5 suites. They are explicitly automated controller/mounted happy-dom evidence.

## Environment and browser block

Observed environment: Windows 11 Home build 26300, WSL 2.7.11.0 / Ubuntu 26.04, Node 24.19.0, npm 11.4.2; RTX 5060 device 0, compute 12.0, sm_120, driver 617.14, nvcc 13.4.59. Exact qualified STATIC and INCREMENTAL binary hashes were verified through production Runtime qualification. Installed model: Qwen3:8b Q4_K_M, Ollama 0.34.0.

The browser helper repeatedly exits before returning state: `trusted Node process exited unexpectedly; kernel reset, rerun your request`. Reset/documentation recovery and a fresh 2026-10-09 retry failed. No visible browser screenshot or observation was fabricated.

[Browser qualification](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-browser-qualification.json) marks visible stage/analyze/result/Apply, visible Assistant, reload from four representative states, two-tab independent workspaces, browser discovery/reconnect/CORS and inert rendering/navigation as **BLOCKED_ENVIRONMENT_BROWSER_HELPER**. Controller and happy-dom checks do not replace these gates.

## Security disposition, provenance and evidence inventory

[Integrated security qualification](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-security-qualification.md) explains the source-backed finding, final independent rereviews, threat scenarios and limitations. [Generated canonical security report](C:/Users/tharu/.codex/state/plugins/codex-security/scans/hypergraph-converter-v7.3.14/1e8f7fa2eac97f9cadf72224ae9e99febdea85df_20260930T155702Z_raud90lf/report.md) completed with zero remaining reportable findings and no deferred integrated task.

The workbench retains its original baseline revision and warns that the working tree changed during the scan. The report preserves that warning; final-byte qualification is supported separately by post-correction independent review, [SHA-256 source inventory](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-source-inventory.json), collision rerun and final gates. Whole-repository coverage is honestly partial; unrelated modules were not exhaustively audited. Windows private local-state/temp ACL remains a deployment assumption.

Planned deliverables:

- [Environment](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-environment.json)
- [Application gates](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-application-gates.json)
- [Browser qualification](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-browser-qualification.json)
- [Real Runtime/CUDA](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-live-runtime-qualification.json)
- [Assistant qualification](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-assistant-qualification.json)
- [Security qualification](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5f-security-qualification.md)
- [Machine-readable final qualification](C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14/artifacts/candy-scope5-final-qualification.json)

Qualification source inventory includes run-scope5f-collision-qualification.mjs, run-scope5f-live-qualification.mjs and run-scope5f-assistant-qualification.mjs, plus the collision fixture/test. Independent review confirms actual authenticated Runtime, qualified native execution, production graph/control ownership, no motif implementation, no fabricated positive responses and no graph setter bypass. Negative substitutions and gated genuine download are labelled.

Four intermediate Runtime attempts are retained separately. Their failed assertions concerned reason/classification distinctions, asynchronous cancelling-to-cancelled transition, or bounded controller error projection; final assertions use the actual contracts/terminal Runtime status. These were qualification harness corrections, not undisclosed product fixes.

Historical tags remain: 5A eb829fb…, 5B 3379e010…, 5C adad8484…, 5D 18fa9aeb…, 5E 1e8f7fa2…. All correction/evidence files remain uncommitted. **Hard stop after this final report.**