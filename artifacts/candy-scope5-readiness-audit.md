# CANDY Scope 5 readiness audit

Audit date: 2026-09-23

Mode: architecture/readiness diagnosis only

Decision: **READY FOR PHASED IMPLEMENTATION, NOT READY FOR DIRECT END-TO-END IMPLEMENTATION**

Reason: the qualified Runtime/native incremental path is reusable, but the application lacks first-class graph type and pending-update authority.

## 1. Baseline verification

| Check | Observed | Result |
|---|---|---|
| Branch | `candy-integration-scope5-dynamic-hypergraph` | PASS |
| HEAD | `57daa23050c89cd0d2c74328766d284311376da4` | PASS |
| `post-diagnosis-full-corrective-qualified^{}` | `57daa23050c89cd0d2c74328766d284311376da4` | PASS |
| `post-scope4c-chatbot-ui-corrective-qualified^{}` | `4a2ca6ca535a4f8d78f6f6d0b61150b6fe9c0302` | PASS |
| `candy-integration-scope4c-runtime-integration-qualified^{}` | `faeca1053f95a61bfe03ac88295c563d32f91969` | PASS |
| Starting worktree | clean; no untracked files | PASS |
| Starting `git diff --check` | no output | PASS |

The twelve-commit log matched the requested lineage, headed by `57daa23 fix: complete post-diagnosis corrective qualification`.

## 2. Current DynamicHypergraph support

DynamicHypergraph is present in:

- graph-type contracts and compatibility checks;
- canonical incidence and update adapters;
- qualified incremental CUDA transport;
- Runtime capability discovery/job path;
- browser submission/result validation;
- Assistant observation, selector, prompt, and confirmation binding;
- tests and live qualification fixtures.

It is absent from the application’s authoritative graph state. `App.jsx` always emits `graphType: "Hypergraph"` and supplies no `pendingUpdate` to `useCandyRuntime` (`src/App.jsx:3699-3714`). Therefore it is a lower-level supported type, not a first-class application workflow.

Detailed inventory: `candy-scope5-current-state-map.md`.

## 3. Current update support

The repository has a strong generic mutation system:

- typed `GraphMutationPlan` with expected graph ID/version/fingerprint and plan hash;
- deterministic and model-assisted planners;
- non-authoritative preview;
- Batch Updates conversion into the same typed operations;
- explicit confirmation before Assistant-driven commit;
- graph history and undo.

It separately has a qualified `HypergraphMotifUpdate` contract and adapter with exact `DELETE_THEN_INSERT` / `REJECT_EXCEPT_EXACT_DELETE_REINSERT` semantics. There is no authoritative application-level object linking these systems.

Conclusion: Scope 5 must wrap/reuse the mutation plan, not invent a competing update language. The motif update should be a deterministic transport projection of the validated committed-versus-proposed incidence diff.

## 4. Current Runtime incremental support

The end-to-end lower-level path is implemented and qualified:

- exact `INCREMENTAL/CUDA_INCREMENTAL` request schema;
- immutable SHA-256 graph/update artifacts;
- graph/update/version/backend/device binding;
- qualified backend/device discovery;
- serialized motif queue;
- bounded temp request file and fixed native execution;
- timeout/cancellation/cleanup;
- native request digest and exact signed delta validation;
- immutable result artifact and browser digest/session/job/result validation;
- no graph mutation, prior-count state, CPU fallback, implicit projection, or STATIC fallback.

`artifacts/post-diagnosis-corrective-live-runtime-requalification.json` is current-tree evidence with `LIVE_RUNTIME_QUALIFICATION_PASS`, seven completed CUDA parity cases (three STATIC, four INCREMENTAL), 21 expected negative cases, server survival, and unchanged workspace. A new live probe was not needed for this architecture audit.

## 5. Current Assistant support

Reusable today:

- `MAX_REACT_STEPS = 8` and one action per iteration;
- deterministic preflight/routing for explicit motif requests;
- strict typed capability allowlist;
- exact bounded motif selector only;
- `DynamicHypergraph + pendingUpdateContext` requirement for incremental;
- separate expensive-compute confirmation;
- graph/session/context re-observation and stale checks;
- generic typed graph-mutation planning/preview/apply confirmation.

Missing: capabilities to stage existing graph mutations as a persistent pending update, edit/discard it, and separately apply it. The incremental Assistant route is correctly unreachable in the current App.

## 6. Current UI support

- Graph workspace shows committed version/fingerprint/history but not graph type.
- Batch Updates supplies the best reusable authoring and preview surface.
- Viz can render the proposed full graph but does not distinguish inserted/deleted/replaced edges.
- Statistics correctly keeps Line-Graph Triangles separate from CANDY Hypergraph 3-Edge Motifs.
- CANDY Runtime already has static and conditional incremental controls; the latter is unreachable without app state.
- `CandyMotifResult` already presents delta-only truthfully.
- There is no pending-update status/editor/discard/apply surface or stale explanation.

## 7. Graph/update authority model

Recommended authority chain:

```text
committed DynamicHypergraph envelope
  + typed GraphMutationPlan
  -> validated preview
  -> one PendingDynamicHypergraphUpdate aggregate
       plan/preview = application authority
       derived HypergraphMotifUpdate = Runtime transport
  -> optional separately confirmed CUDA analysis
  -> optional separately confirmed graph application
  -> authoritative re-observation
```

The Runtime result is evidence about the pending transition; it is never permission to apply it.

## 8. Version and stale-state model

Current commits increment version only when the graph fingerprint changes. Replacements/clear mint a new graph ID and still increment the previous version; undo is a new commit and increments again. Preview has no authority. Existing CANDY code rejects mismatched graph ID/version and async context changes.

Scope-5 additions required:

- graph type must participate in the state token;
- pending update binds base ID/version/fingerprint/type, plan hash, fresh revision/digest, next version, and proposed fingerprint;
- edits mint a fresh revision/update ID and invalidate confirmations/results;
- any committed graph transition makes the old pending update/result stale, even if content later resembles an older version;
- Apply revalidates immediately before commit and verifies the committed next state.

Full transition design: `candy-scope5-state-machine.md`.

## 9. Delta-only result semantics

`deltaCounts[30]` and `deltaTotalConnectedTriples` are signed changes, not full counts. UI must show `+N`, `-N`, and `0`, retain all taxonomy labels, and prominently label the result as delta-only.

Full “after” counts may be derived only when a validated prior STATIC result belongs to the exact base graph/artifact/taxonomy and the delta belongs to the exact update/next version. The derived result must cite both source bindings and pass safe-integer/nonnegative checks. Without prior authority, show only the delta.

## 10. Persistence model

Current persistence is conservative and safe: IndexedDB restores bounded messages and inert workspace references; graph availability is false and pending actions are null. Graph contents, job bindings, results, and confirmations are not restored. Pairing is sessionStorage-only.

Recommendation: do not persist the pending update in Scope-5 v1. If descriptive recovery is later desired, persist an inert summary/draft only and load it `STALE_REVIEW_REQUIRED`; require exact graph reload, rebase/validation, a new revision/digest, and fresh confirmations. A stored record never regains execution or apply authority solely by loading.

## 11. Concurrency risks

The Runtime serializes motif jobs and cleans up cancellation/timeout correctly, but application-level coordination is missing. Required fail-closed rules:

- one authoritative pending update at a time;
- edits/supersession invalidate prior job/result/confirmations;
- check current graph/update/session after every await and again before result acceptance/apply;
- cancel superseded jobs where possible, but correctness never depends on cancellation succeeding;
- cancel/timeout never applies anything and invalidates old Apply approval;
- Runtime restart invalidates old job/result authority;
- browser reload restores no active job/result/apply authority.

## 12. Security threat model

Primary threats are stale update replay, graph/next-version mismatch, update ID replay, duplicate identities, oversized updates, model-crafted content, result/artifact/session substitution, confirmation replay, unsafe persistence, graph/update races, concurrent updates, and cancel/timeout/apply races.

Existing controls are substantial: closed typed schemas, graph/version/fingerprint checks, exact mode/backend, immutable SHA-256 artifacts, authenticated loopback Runtime, fixed qualified executable, request/result digests, bounded resources, serialized motif queue, cancellation cleanup, and inert persistence.

The remaining security work is application binding: pending revision/digest/proposed fingerprint, consume/supersede rules, separate confirmation types, result-to-update attachment, and race invalidation. Full threat model: `candy-scope5-security-threat-model.md`.

## 13. Complete gap register

Machine-readable register: `candy-scope5-gap-register.json`.

| ID | Area | Severity | Blocking |
|---|---|---|---|
| S5-001 | application graph state | HIGH | yes |
| S5-002 | pending update lifecycle | HIGH | yes |
| S5-003 | update projection | HIGH | yes |
| S5-004 | authoritative apply | HIGH | yes |
| S5-005 | graph/update identity binding | HIGH | yes |
| S5-006 | update replay/uniqueness | MEDIUM | yes |
| S5-007 | confirmation boundaries | HIGH | yes |
| S5-008 | delta-only/prior counts | MEDIUM | no |
| S5-009 | result authority | HIGH | yes |
| S5-010 | concurrency/cancellation | HIGH | yes |
| S5-011 | static/incremental decision | MEDIUM | yes |
| S5-012 | UI workflow | MEDIUM | yes |
| S5-013 | Assistant capabilities | MEDIUM | yes |
| S5-014 | persistence/reload | MEDIUM | no |
| S5-015 | limits/browser performance | MEDIUM | yes |
| S5-016 | Scope-5 verification | MEDIUM | yes |

No CRITICAL gap was identified. Existing fail-closed behavior makes incremental unavailable rather than unsafe.

## 14. Reusable qualified components

- canonical incidence/update validators and adapters;
- exact 30-class taxonomy and reference oracle for tests;
- CUDA_STATIC and CUDA_INCREMENTAL packers/result validators;
- Runtime capability qualification, client/server, artifact store, job manager, native runner;
- immutable request/result/artifact binding;
- `CandyMotifResult` delta-only presentation;
- GraphMutationPlan, mutation engine/preview/history;
- Batch Updates parser and preview;
- deterministic graph grammar and Assistant ReAct loop;
- confirmation registry/stale checks;
- thread persistence safe projection;
- Scope 4 and post-diagnosis qualification fixtures/harnesses.

## 15. Components that must remain frozen

- `candy-runtime/native/hypergraph-motif-cuda/`
- `candy-runtime/native/hypergraph-motif-cuda-incremental/`
- all historical qualification evidence and protected tags
- semantic invariants: `CUDA_STATIC`, `CUDA_INCREMENTAL`, 30 S3 classes, 24 CLOSED_TRIANGLE, 6 OPEN_WEDGE, `DELETE_THEN_INSERT`, `DELTA_ONLY_NO_PRIOR_COUNTS`, no CPU fallback, no implicit projection

The baseline-to-current diff for both protected native directories is zero because HEAD is the authoritative baseline; no native source was edited during this audit.

## 16. Exact files likely to change during implementation

Core application/domain:

- `src/App.jsx`
- `src/graph/graphIdentity.js`
- `src/graph/graphFingerprint.js`
- `src/graph/graphMutationValidator.js`
- `src/graph/graphMutationPreview.js`
- `src/utils/batchUpdates.js`

CANDY browser integration:

- `src/candy/useCandyRuntime.js`
- `src/candy/motifWorkflow.js`
- `src/candy/requestPolicy.js`
- `src/candy/resultObservation.js`
- `src/candy/motifStatisticsAvailability.js`

UI:

- `src/components/AdvancedOptionsPanel.jsx`
- `src/components/Viz.jsx`
- `src/components/CandyRuntimePanel.jsx`
- `src/components/CandyMotifStatistics.jsx`
- `src/components/CandyMotifResult.jsx`
- `src/components/AgentChatPanel.jsx`

Assistant/authority:

- `src/agent/orchestratorCapabilities.js`
- `src/agent/orchestratorObservation.js`
- `src/agent/motifQueryPolicy.js`
- `src/agent/confirmationPolicy.js`
- `src/agent/confirmationState.js`
- `src/agent/prompts/reactOrchestratorPrompt.js`
- `src/agent/deterministicNlu/domains/graphMutationGrammar.js` if explicit pending-update routing is needed

Persistence only if inert summaries are chosen:

- `src/persistence/threadStateSchema.js`
- `src/persistence/usePersistentThread.js`

Runtime production files are not expected to change.

## 17. Exact new files likely required

- `src/graph/graphState.js`
- `src/graph/pendingHypergraphUpdate.js`
- `src/candy/adapters/graphMutationToHypergraphUpdate.js`
- `src/candy/motifPreflight.js`
- `src/candy/motifResultRegistry.js`
- `src/components/DynamicHypergraphUpdatePanel.jsx`
- Scope-5 tests and final qualification artifacts listed in `candy-scope5-implementation-plan.md`

These names are architectural proposals, not created implementation files.

## 18. Scope 5 test matrix

The full matrix is in `candy-scope5-test-plan.md`. It covers all requested cases: creation, insert/delete/replacement, DELETE_THEN_INSERT, stale/invalid version, duplicate update ID, collision, preview safety, confirmation separation, static/incremental choice, signed 30-bin delta, delta-only UI, stale result, job races, cancellation, restart, reload, Assistant staging/apply, no automatic apply, no CPU fallback, and no implicit projection.

## 19. Implementation dependency order

1. authoritative graph envelope/type and identity;
2. pending-update aggregate and lifecycle;
3. deterministic mutation-to-motif update projection;
4. atomic Apply and separate confirmation types;
5. Runtime/result binding, limits, and race coordination;
6. UI and delta/prior-result presentation;
7. Assistant capabilities and re-observation;
8. conservative persistence behavior;
9. integrated browser/Runtime/CUDA/security qualification.

## 20. Proposed Scope 5A–5F boundaries

- **5A:** first-class application graph envelope and DynamicHypergraph type authority.
- **5B:** one authoritative pending-update aggregate, deterministic preview/diff, and atomic Apply controller.
- **5C:** application-to-qualified Runtime wiring, result registry, exact pending/result binding, and preflight.
- **5D:** minimal UI plus bounded Assistant lifecycle capabilities.
- **5E:** stale-state, confirmation, persistence, concurrency, cancellation, and reload hardening.
- **5F:** full regression, visible browser, real authenticated CUDA, and security qualification.

Detailed phase exits and file mapping: `candy-scope5-implementation-plan.md`.

## Final hard-stop statement

No production source, test source, native CUDA source, dependency file, commit, tag, branch history, or historical qualification artifact was modified. Only the seven requested new Scope-5 diagnostic artifacts under `artifacts/` were written. Scope 5 was **not implemented**.

