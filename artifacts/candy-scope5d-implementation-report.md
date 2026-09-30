# CANDY Scope 5D implementation report

Verdict: **PASS**. Scope 5D is implemented and remains entirely uncommitted. Final HEAD is `adad84847dac54261f3036dc488c35ed4caef3e7` on `candy-integration-scope5d-ui-assistant`. No commit, tag, push or merge was performed.

## Manual workflow

1. Select DynamicHypergraph in the committed graph card.
2. Open Batch Updates (Assistant Quick Link **Pending update**, or Runtime **Open pending update panel**).
3. Author the existing Batch Updates commands. Stage the pending proposal; committed graph/version stay unchanged.
4. Inspect the comparison preview in existing Viz. Edit the commands and explicitly re-stage a complete replacement proposal, or discard.
5. Optionally choose **Analyze motif delta**, review its computational confirmation, then **Confirm analysis only**. No job exists before confirmation; analysis never commits.
6. Refresh analysis status and open the signed delta result. It describes the pending transition.
7. Independently choose **Apply pending update**, review its graph-mutation confirmation, then **Confirm Apply only**. Analysis is optional; Apply creates no Runtime job.
8. Observe the committed next graph version and normal graph history. Pending executable authority is cleared, and old pending delta is no longer current.

The panel shows graph type, pending status, shortened ID, revision, base/next versions, operation count, motif impact, validation/preflight, analysis status, stale reason and result currency. Hypergraph keeps its earlier Batch controls; DynamicHypergraph uses the dedicated pending surface.

## Lifecycle/controller mapping

| Surface/capability | Allowed model arguments | Existing owner |
|---|---|---|
| Stage / re-stage / STAGE_DYNAMIC_HYPERGRAPH_UPDATE | Exactly {} (original user query is planned by the application) | Existing typed GraphMutationPlan / Batch parser → Scope 5B stage |
| Discard / DISCARD_DYNAMIC_HYPERGRAPH_UPDATE | updateId, positive safe revision only | Scope 5B discard |
| Analyze / ANALYZE_DYNAMIC_HYPERGRAPH_UPDATE | updateId, revision only | Scope 5C preflight, owned analysis token, exact CUDA_INCREMENTAL stage/submit and registry |
| Apply / APPLY_DYNAMIC_HYPERGRAPH_UPDATE | updateId, revision only | Existing confirmation snapshot → Scope 5B exact Apply |

`dynamicUpdateControls` retains approvals and an in-progress guard only. It reads committed/pending/result authority from live qualified owners. It creates no second graph, update ledger or result registry. Neither model nor UI constructs trusted update/Runtime bodies, digests, proposed fingerprints, candidate sets, artifacts, credentials or native paths.

## Assistant behavior

Delete h1, replace h2, compound multi-add, and “instead, replace …” use deterministic typed planning. Each material correction re-stages one fresh Scope 5B revision/ID/digest. The mounted AS01–AS10 scenario executes with zero model calls.

The four new capability schemas are closed. Observations expose bounded lifecycle fields, not trusted bodies. Pending ID/revision/status, analysis status and result currency join the state-version comparison. Stale observation is rejected and re-observed before another bounded action. MAX_REACT_STEPS remains 8 and one action per iteration remains enforced. Quoted, hypothetical, negated and explanatory requests preserve read-only behavior.

Only a sole Undo can use the historical generic Undo flow. Mixed Undo/edit plans use pending staging and cannot bypass the final generic DynamicHypergraph guard.

## Confirmation and races

Analysis and Apply have different owned tokens and action types. Copying, replaying, substituting, or crossing their tokens is rejected. Apply confirmation is consumed before the first await; Scope 5B still rederives digest/content and rechecks the exact current base immediately before commit. Panel and Assistant protect duplicate confirmation/reentry.

New analysis staging and cancellation revoke prior Apply approval. Approval also binds the observed Runtime session and analysis job/status; a terminal-to-new-job round trip cannot revive it. A later fresh independent Apply remains allowed even without successful analysis.

Edit/discard/graph type or identity changes invalidate old pending selectors, confirmations and result currency. The UI displays stale reasons and offers explicit discard/re-stage; there is no silent rebase. Expired confirmations fail at existing owner TTL validation and require a fresh request. A discard during gated analysis upload cannot attach a late current job/result. Successful Apply after a result commits once without another job.

## Delta and preview

Motif change remains **delta only**, with signed total and +N / -N / 0 values. Nonzero classes appear first; all 30 stable taxonomy classes remain expandable. Copy states that the graph has not been applied, that the result describes the pending transition, and that graph/update/session changes make it stale. No prior-count reconstruction was added.

Existing Viz renders comparison semantics: unchanged gray, inserted green, deleted red/dashed with old memberships, and replaced/same-ID changes amber with proposed memberships. The existing visualization budget remains in force and the preview discloses sampling. It remains a presentation overlay; Statistics/export graph state uses the committed graph. Line-Graph Triangles remains separate from CANDY Hypergraph 3-Edge Motifs. Current count requests, including DynamicHypergraph with pending changes, still use STATIC. Proposed-change analysis requires qualified INCREMENTAL with no CPU/STATIC fallback or implicit projection.

Rendering, opening panels, Statistics, Runtime, Assistant and Quick Links never stage, analyze or Apply. No executable pending/result/confirmation restoration was added.

## Verification

| Gate | Final result |
|---|---|
| Scope 5D focused suite | 3/3 files, 4.8s |
| npm run test | **263/263 files**, 117.4s |
| npm run lint | PASS |
| npm run build | PASS |
| npm run build:github | PASS |
| npm audit --omit=dev | PASS, zero vulnerabilities |
| git diff --check | PASS |
| Final targeted security review | Complete, all 18 changed production files, zero findings/unresolved High |

Full tests include Scope 5A/5B/5C, Scope 4C, graph mutation, confirmations, and deterministic/ReAct regressions. New mounted tests cover actual panel/Assistant interactions with real qualified owners and existing test-only Runtime fixtures. Additional cases cover selector/schema rejection, token crossing/copies, stale correction/result, discard during upload, Apply after result, cancellation/reanalysis, and simultaneous Apply.

One earlier source-boundary assertion was preserved by removing direct grammar coupling from Chat. Three existing tests update phase-specific source/Quick Link expectations while retaining their behavior checks. Final production source was unchanged after the final green run.

Builds retain the existing Vite chunk-size advisory. Git reports normal LF/CRLF conversion advisories; neither fails a gate. npm commands ran through the existing npm 11.4.2 client with Node 24.19.0; Python was added to PATH for existing full-suite ZIP checks. Audit used approved read-only network escalation after default sandbox registry access failed.

No new live GPU/Runtime execution was performed. Mixed Undo regression uses the actual compiler plus both source guard assertions; it is not a dedicated mounted App mixed-commit reproduction. These limits do not claim Scope 5F live qualification.

## Security and protected deltas

The Codex Security security-diff-scan workflow reviewed every changed production file and supporting qualified authority/persistence consumers. A mixed Undo lifecycle gap and cancellation/reanalysis approval gap were closed before final qualification. Final scan `ae750a68-1c9c-4a3a-bea9-fa02825727c9` is sealed against the frozen source snapshot `codex-security-snapshot/v1:sha256:1058802432100fa872a65ddefec3f756d615f83dc9dc740c06ed7ddca017c2cd`, with no changed-tree warning. All final production hashes matched the independently reviewed bytes. See `candy-scope5d-security-review.md`.

Runtime production, both native CUDA directories, package.json/package-lock.json, prior evidence and qualified tags have **zero delta**. Scope 5C/5B/5A tag targets remain adad848… / 3379e010… / eb829fb….

Deferred: Scope 5E broader persistence/multi-tab/recovery/concurrency semantics; Scope 5F final live application/CUDA qualification; optional exact prior STATIC reconstruction.

## Exact modified files (17)

- `src/App.jsx`
- `src/agent/confirmationPolicy.js`
- `src/agent/deterministicNlu/domains/graphMutationGrammar.js`
- `src/agent/deterministicNlu/graphOperationAuthorization.js`
- `src/agent/motifQueryPolicy.js`
- `src/agent/orchestratorCapabilities.js`
- `src/agent/orchestratorLoop.js`
- `src/agent/orchestratorObservation.js`
- `src/agent/prompts/reactOrchestratorPrompt.js`
- `src/components/AdvancedOptionsPanel.jsx`
- `src/components/AgentChatPanel.jsx`
- `src/components/CandyMotifResult.jsx`
- `src/components/CandyRuntimePanel.jsx`
- `src/components/Viz.jsx`
- `tests/agent-chat-panel-dom-v7-3-13.test.mjs`
- `tests/candy-scope5-graph-state.test.mjs`
- `tests/candy-scope5-runtime-integration.test.mjs`

## Exact added files (12)

- `src/agent/dynamicUpdatePolicy.js`
- `src/components/DynamicHypergraphUpdatePanel.jsx`
- `src/graph/dynamicUpdateControls.js`
- `src/visualization/dynamicUpdatePreview.js`
- `tests/candy-scope5d-assistant.test.mjs`
- `tests/candy-scope5d-lifecycle.test.mjs`
- `tests/candy-scope5d-ui.test.mjs`
- `tests/fixtures/candy-scope5d-controls.mjs`
- `artifacts/candy-scope5d-implementation-report.md`
- `artifacts/candy-scope5d-test-results.json`
- `artifacts/candy-scope5d-security-review.md`
- `artifacts/candy-scope5d-qualification.json`

Total: **29 files** = 18 production + 7 test/fixture + 4 evidence. No staged files. Hard stop after this Scope 5D report.

