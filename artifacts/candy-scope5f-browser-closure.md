# Scope 5F visible-browser closure — 2026-10-09

**PASS for the corrected, uncommitted working tree.** All required visible-browser gates completed using Chrome and the real application at `http://127.0.0.1:5173`, with the authenticated loopback companion at `http://127.0.0.1:8791` for compute. This is not qualification of frozen commit `bf0240a54fb6ac8284bd9ac371306511158a1a2e`: the browser uncovered a presentation defect, which was corrected and requalified. A new final commit must eventually be bound to the corrected source before a qualified release/tag. No commit or tag was created.

The initial baseline was clean, on `candy-integration-scope5f-final-qualification`, with HEAD and `candy-integration-scope5f-browser-blocked^{}` both at the expected frozen checkpoint. The earlier helper failure is preserved in browser JSON history. A fresh supported browser launch worked; no product change was needed to repair tooling. The existing `VITE_CANDY_RUNTIME_ENABLED=true` launch flag enabled the ordinary Runtime UI. No mocks, injected browser state, fixture Runtime or DOM harness replaced these observations.

## Browser observations

The known H2V graph was `h0:A,B; h1:B,C; h2:A,C; h3:C,D`. Convert created Hypergraph version 1; explicitly selecting DynamicHypergraph advanced to version 2 without compute. States below were observed through the visible UI. Raw captured panel text is in `candy-scope5f-browser-observations.json`; screenshots are listed in browser qualification JSON. Earlier observations without raw saved text are transcribed from computer-use tool output, not generated from a harness.

| Step / before | User action | Visible after | Result |
| --- | --- | --- | --- |
| Manual base, DynamicHypergraph v2, no pending | Author REMOVE h1, ADD h4:A,D, UPDATE h2:A,C,D; Stage | Revision 1 VALIDATED, proposed 2→3, four net operations. Committed contents/version/history unchanged. | PASS |
| Staged revision 1 | Inspect pending preview | Gray unchanged, green inserted, red dashed deleted and amber replacement legend/overlays; comparison remains non-authoritative. | PASS |
| Unpaired Runtime, staged local update | Open Dynamic workflow / request analysis | RUNTIME_UNAVAILABLE with “Discover an authenticated Runtime session first”; Analyze disabled, no selected fallback or mutation. Apply separately available. | PASS |
| Unpaired UI | Enter credential in the ordinary masked field; Pair and discover | Same loopback endpoint, paired/ready, CUDA_INCREMENTAL and CUDA_STATIC qualified on RTX 5060, sm_120. CPU is not a motif fallback. | PASS |
| v2 / revision 1 VALIDATED | Analyze motif delta | Distinct “Confirm analysis only”, exact revision 1 / 2→3; no job or Apply yet. | PASS |
| Analysis approval | Confirm analysis only, then explicit refresh/open | Real job RUNNING→completed→RESULT_READY. Pending remains VALIDATED, current=yes, committed v2 and content unchanged. Example job: `5ea99cca-99a0-4d54-b950-c7f4f8b527fc`. | PASS |
| Current mixed-update delta | Inspect title, signs and expand taxonomy | MOTIF CHANGE (DELTA ONLY); total 0; classes 2,19,21 show +1; 5,7,14 show -1; others 0. All stable classes 1–30 available. Graph-not-applied copy visible. | PASS |
| Current delta / pending revision 1 | Apply pending update, then distinct Confirm Apply only | v2→3 exactly once, history 2→3, h1 removed/h4 added/h2 replaced. Pending NONE, old result non-current/STALE; no additional Runtime analysis job. | PASS |
| Local staged revision 1, v2, unpaired | Open Statistics, Runtime, Assistant, Quick Links, Dynamic panel and Preview | Same graph version/pending revision/status; no automatic Stage, Analyze or Apply. Statistics shows Line-Graph Triangles=2 separately from the independent 30-class motif section. | PASS |
| A has its own graph v3/revision 2 and analysis approval | Open same origin in B; independently load DynamicHypergraph v2 | B starts empty, then owns its own graph and NONE pending. No A confirmation/result/pending authority appears in B. | PASS |
| A confirms its own analysis and holds current delta -3; B stages revision 1 | B separately requests/confirms Apply | Only B v2→3. A stays v3/revision 2/current=yes. A cannot see/use B Apply approval; B cannot see/use A analysis/result/Apply approval. No shared-storage execution was observed. | PASS |
| Independent tabs | Close B and reopen same origin | Empty v0/NONE/no approvals/current=no despite descriptive saved chat. Explicit load/stage required. This behavior tests policy; it is not a general proof of absence of all possible cross-tab mechanisms. | PASS |
| A current result with retained analysis approval | Restart actual companion; Pair/discover with prior session | Unauthorized/unpaired at the same endpoint; result STALE/current=no. Old confirmation visibly stale and its Confirm disabled. Pending remains separately VALIDATED. | PASS |
| Stale session/approval | Cancel old confirmation, normal fresh pairing, fresh Analyze request/confirm | Ready at same endpoint; fresh authorization required and real incremental result opens. No external/untrusted endpoint was tested. Browser fetch from app origin succeeded, auth failure was truthful; frozen auth/origin negatives remain supporting CORS evidence. | PASS |
| B2 DynamicHypergraph v2/unpaired | Stage UPDATE_WEIGHT h0:2.5 | Metadata-only VALIDATED, motifImpact NONE, NO_MOTIF_RELEVANT_CHANGE; Analyze unavailable, Apply independent. Apply produces v3 without compute. | PASS |
| B2 v3 with weight 2.5 | Stage identical UPDATE_WEIGHT h0:2.5 again | Full no-op: NONE, no pending authority created, version unchanged. | PASS |
| A VALIDATED v6/revision 6 (corrected source) | Real browser reload (A) | Empty v0, pending NONE, analysis STALE/current=no; no Apply/analysis approval, no automatic action. | PASS |
| A v2/revision 1 with analysis confirmation pending | Real browser reload (B) | Confirmation gone, empty v0/NONE/STALE/current=no; no job submitted by unconfirmed approval. | PASS |
| A v3/revision 2 with real RESULT_READY | Real browser reload (C) | Empty v0/NONE/STALE/current=no; job/result/Apply authority not restored. | PASS |
| B2 v3/revision 3 with Apply confirmation pending | Real browser reload (D) | Confirmation gone; empty v0/NONE/STALE/current=no. Proposed change was never applied; graph must be explicitly reloaded/re-staged. | PASS |
| Assistant, DynamicHypergraph v2 | “delete hyperedge h1” | Staged revision 1 only; v2/content unchanged. | PASS |
| Assistant staged revision 1 | Quoted “Explain \"delete hyperedge h1\" without executing it.”; negated “Do not delete hyperedge h1.”; hypothetical question | Read-only responses, same revision 1 and graph v2. Hypothetical response was generic/no active upload batch, but created no authority or mutation. | PASS |
| Assistant pending revision 1 | “instead delete hyperedge h2” | Fresh revision 2/update ID; graph v2 unchanged. One earlier rapid tool fill/Send did not submit; that attempt is labelled separately in raw evidence. Actual subsequent conversation explicitly records revision 2. | PASS |
| Assistant Apply approval for revision 2 | Re-stage h3 through normal Batch UI to revision 3, then click old Assistant Confirm | Truthful outdated-confirmation rejection; no commit or analysis. An attempted correction while an approval was open was also blocked until resolving that approval. | PASS |
| Assistant v2/revision 3 | “show how motifs would change”; separate Confirm | Exact costly analysis approval; real job `6c014827-87a8-465f-94ad-c23638921121`; no Apply. Explicit refresh/open yields current delta. | PASS |
| Assistant current delta/revision 3 | “apply the pending update”; separate Confirm | Commit v2→3, pending NONE, result STALE/current=no, no CUDA job caused by Apply. Panel retained an incorrect old local graph-not-applied notice: reproduced defect below. | FAIL at frozen checkpoint; corrected rerun PASS |
| Corrected source, A v3/revision 4 with current real delta -1 | Assistant separate Apply request/Confirm | Commit v3→4; pending NONE/current=no/STALE. Old local “Graph has not been applied” notice disappears. | PASS |
| Corrected A v6/revision 6; model normally reconnected to Qwen3:8b | Send simulated model-provided Runtime body with forged update/artifact/job IDs, then an invented CANDY result UUID | Body message rejected as ambiguous; invented selector got a read-only no-implicit-projection response. Graph v6/revision 6 unchanged; no result/currentness/approval/job authority installed. Messages used deterministic visible routing; no malicious model output was injected. Frozen installed-model/schema negatives support the broader boundary. | PASS |
| Corrected A v4/revision 5, real current +1 delta | Normal H2V Convert with X,Y,Z replacement graph | Committed v5/new contents, pending STALE, old result current=no, Analyze/Apply disabled; subsequent explicit DynamicHypergraph selection advances v6. Small replacement smoke only; collision investigation not repeated. | PASS |
| Corrected B2 v2, unpaired, local revision 1 | Separate panel Apply/Confirm | Commit v3 exactly once; NONE/current=no/STALE. Own success notice remains visible: “Applied once. Committed graph version 3. No Runtime job was created.” | PASS |

## Browser-observed correction and requalification

Root cause: `DynamicHypergraphUpdatePanel` kept local notice text without binding it to the committed graph version. Assistant used the shared controls to commit successfully, while the mounted panel still claimed its earlier analyzed transition had not been applied. The committed graph, pending clearing and result invalidation were correct; the contradictory status was a genuine presentation defect.

The smallest correction binds `{message, graphVersion}` to each local notice and renders it only for the current committed version. The panel's own successful Apply explicitly binds its notice to the returned committed version. No authority, protocol, native code, dependency or manifest was changed. The existing mounted UI test now reproduces an external/shared-controls Apply after a current delta, asserts the old notice disappears, and retains the assertion that local Apply success remains visible. It failed at the intended assertion before the correction and passed afterward. Real Assistant Apply and real panel Apply were then repeated successfully in the visible browser.

| Required rerun after correction | Result / evidence |
| --- | --- |
| Full Node suite | PASS, 268/268 files, 113.3s; `candy-scope5f-browser-corrective-tests.log` |
| ESLint | PASS; `candy-scope5f-browser-corrective-lint.log` |
| Production and GitHub Pages builds | PASS; corresponding corrective build logs; existing large-chunk advisory retained |
| Existing `npm audit --omit=dev --json` gate | PASS, zero vulnerabilities; `candy-scope5f-browser-corrective-audit-production.json` |
| Supplementary broad audit | Records four development dependencies (3 high/1 moderate) in unchanged lock; not the existing production qualification gate. No manifests changed. `candy-scope5f-browser-corrective-audit.json` |
| Corrective security diff review | Complete, no reportable finding in the narrow correction; scan `6edd9569-6fb9-4cf0-8e69-263a8e077455`. Finalization retains a working-tree snapshot warning because browser evidence changed during review; corrected source/test SHA-256 binds reviewed final bytes separately. |
| Repository integrity | HEAD/blocked tag unchanged; diff check passes; one production component and one regression changed. Runtime/native/manifests and prior collision/Runtime/model/security artifacts unchanged. |

Full expensive CUDA/model/collision matrices were reused from the frozen checkpoint. Browser compute above was limited to exercising UI gates and the affected correction. No secret credential is included in screenshots or observations. Logs may be Git-ignored; command receipts and hashes are preserved in browser qualification JSON.

## Disposition

Browser evidence, the correction and regression remain **UNCOMMITTED**. The browser-blocked tag still points to the frozen commit. No final tag, parent fast-forward, merge, push or history rewrite occurred. Final PASS describes the corrected working tree only; `qualifiedCommit` remains null and release/tag eligibility remains false until a future final commit is explicitly qualified. Hard stop after this report.

## Finalization evidence binding

All 22 continuation-request browser gates are individually marked PASS in browser qualification JSON, with observed step references. Frozen `bf0240a` remains permanently unqualified because it contains the stale-notice defect. Corrected source and test hashes are unchanged from the completed automated/security checks.

One old checksum in the frozen final JSON was already stale: the original security qualification Markdown exactly matches its frozen Git blob (SHA-256 `c22bd9cc025ae0dced9a702612020ac186cba5889946256dd7857c3fe469fde0`), while the prior record says `506c4e8e4e58546caa7a56d4d1491affdf413f3cc27ca5d7d91979712d271563`. The file was not edited. The prior recorded checksum remains preserved and the current evidence digest is reconciled explicitly.

Exact final repository inventory and protected-delta command receipts are recorded in `candy-scope5f-browser-final-integrity.json`; temporary helpers outside the repository are excluded.
