# CANDY Scope 5 implementation plan

This is a proposed dependency-ordered plan only. No Scope-5 implementation was performed.

## Design decision

Use the existing `GraphMutationPlan` as the single authoring and graph-application authority. Add one pending-update aggregate that owns a validated preview and derives the qualified `HypergraphMotifUpdate` as a transport projection. Do not create an independent mutation language, preview engine, or model-authored Runtime request.

## Dependency order

```text
5A graph envelope/type/version authority
  -> 5B pending update aggregate + mutation-to-motif projection
     -> 5C Runtime/result binding to pending revision
        -> 5D UI + Assistant workflow
           -> 5E stale/confirmation/persistence/race hardening
              -> 5F full qualification
```

Tests are added with each phase; 5F is the integrated gate rather than the first test point.

## Scope 5A — DynamicHypergraph application contract

### Deliverables

- Replace implicit `hes + graphIdentity` assumptions with an application graph envelope that includes `graphType`, explicit committed hyperedges, and (if supported) explicit isolated vertices.
- Default existing imports to `Hypergraph`; require an explicit user/action transition to `DynamicHypergraph`.
- Include graph type in state-version/fingerprint authority so a type-only change invalidates results and confirmations.
- Preserve existing replacement, clear, undo, history, preview, and derived-product behavior.
- Keep ordinary graph types contract-only unless a separately scoped product workflow introduces them.

### Likely production files to change

- `src/App.jsx`
- `src/graph/graphIdentity.js`
- `src/graph/graphFingerprint.js`
- `src/agent/orchestratorObservation.js`
- `src/candy/motifStatisticsAvailability.js`

### Likely new file

- `src/graph/graphState.js`

### Exit criteria

DynamicHypergraph is a real, explicit, observable application state; STATIC continues to work; INCREMENTAL remains unavailable without a pending update; all existing graph identity/history tests pass.

## Scope 5B — authoritative pending update model

### Deliverables

- Add a reducer/domain object for the lifecycle in `candy-scope5-state-machine.md`.
- Reuse `GraphMutationPlan` and `previewGraphMutation` for draft/validation.
- Derive a canonical net incidence diff from committed versus proposed graphs.
- Convert adds/deletes/membership changes into qualified `HypergraphMotifUpdate`; membership changes become exact delete/reinsert.
- Retain plan hash, base refs/fingerprint, proposed fingerprint, next version, update revision/digest, motif-impact classification, and stale reason.
- Enforce one authoritative pending update; edits mint a fresh revision/update ID and invalidate dependent state.
- Add an atomic apply controller that revalidates immediately before `commitGraph` and performs no Runtime work.

### Likely production files to change

- `src/App.jsx`
- `src/graph/graphMutationValidator.js`
- `src/graph/graphMutationPreview.js`
- `src/utils/batchUpdates.js`
- `src/candy/contracts/hypergraphMotifSchemas.js` only if an application helper needs an exported validator; do not weaken the contract

### Likely new files

- `src/graph/pendingHypergraphUpdate.js`
- `src/candy/adapters/graphMutationToHypergraphUpdate.js`

### Exit criteria

Insert, delete, replacement, incidence edit, multiple operations, metadata-only changes, no-op, stale base, collision, duplicate ID, and discard/apply transitions are deterministic and tested. The committed graph is unchanged until separately confirmed Apply.

## Scope 5C — incremental Runtime adapter/integration

### Deliverables

- Pass the authoritative DynamicHypergraph graph value and exact pending update to `useCandyRuntime`.
- Add a shared preflight exposing existing qualified limits before upload.
- Bind confirmation and job state to pending revision/digest/proposed fingerprint synchronously.
- Preserve exact `INCREMENTAL/CUDA_INCREMENTAL` capability selection and the existing immutable-artifact/native path.
- Add an application result registry keyed by Runtime session, request/job, graph/update artifacts, base graph, pending revision/digest, taxonomy, and proposed graph.
- Keep delta-only as default. Allow derived before/delta/after only with exact validated prior STATIC authority.
- Do not change or import a CPU fallback.

### Likely production files to change

- `src/candy/useCandyRuntime.js`
- `src/candy/motifWorkflow.js`
- `src/candy/requestPolicy.js`
- `src/candy/resultObservation.js`
- `src/candy/motifStatisticsAvailability.js`
- `src/candy/runtimeCapabilityPresentation.js` only if status presentation needs the pending lifecycle

### Likely new files

- `src/candy/motifPreflight.js`
- `src/candy/motifResultRegistry.js`

### Runtime files expected to remain unchanged

- `candy-runtime/src/backends/motifJobAdapter.js`
- `candy-runtime/src/jobs/jobManager.js`
- `candy-runtime/src/artifacts/artifactStore.js`
- `candy-runtime/src/backends/nativeProcessRunner.js`
- `candy-runtime/src/capabilities/motifQualification.js`

Change a Runtime file only if an application-level requirement cannot be met at the browser boundary and after a new audit demonstrates the need. The current qualified path already supplies the necessary execution/result bindings.

### Exit criteria

The real application can submit an exact validated pending update, observe a signed delta, reject stale/substituted results, and prove workspace non-mutation.

## Scope 5D — UI and Assistant exposure

### UI deliverables

- Show graph type next to committed graph identity.
- Add a Dynamic Update panel in the Batch Updates/graph workspace area.
- Show operations, base/next version, status, validation, limits, stale reason, and discard/edit controls.
- Reuse the existing Preview/Viz graph. Add bounded semantic styling/legend for deleted, inserted, and replaced hyperedges; do not build a second visualization engine.
- Expose “Analyze motif delta” separately from “Apply update.”
- Render signed changed classes and expandable all-30 taxonomy; keep Line-Graph Triangles separate.
- Provide Quick Link/navigation to the pending update panel and stale explanations.

### Assistant deliverables

- Reuse deterministic/model typed graph operations to stage pending updates.
- Add strict bounded capabilities for stage/manage/discard/apply; the model supplies selectors only.
- Preserve `MAX_REACT_STEPS = 8`, one action per iteration, deterministic fast path, strict allowlist, confirmation, and re-observation.
- Add separate confirmation policies for Runtime analysis and Apply.

### Likely production files to change

- `src/App.jsx`
- `src/components/AdvancedOptionsPanel.jsx`
- `src/components/Viz.jsx`
- `src/components/CandyRuntimePanel.jsx`
- `src/components/CandyMotifStatistics.jsx`
- `src/components/CandyMotifResult.jsx`
- `src/components/AgentChatPanel.jsx`
- `src/agent/orchestratorCapabilities.js`
- `src/agent/orchestratorObservation.js`
- `src/agent/motifQueryPolicy.js`
- `src/agent/confirmationPolicy.js`
- `src/agent/confirmationState.js`
- `src/agent/prompts/reactOrchestratorPrompt.js`
- `src/agent/deterministicNlu/domains/graphMutationGrammar.js` only for explicit pending-update mode/routing

### Likely new file

- `src/components/DynamicHypergraphUpdatePanel.jsx`

### Exit criteria

The complete workflow is understandable and operable without Assistant use; the Assistant reaches the same application controllers and cannot construct trusted updates/requests. Rendering or opening a panel never auto-runs or auto-applies.

## Scope 5E — stale state, confirmation, persistence, and race hardening

### Deliverables

- Centralize invalidation for graph mutation/replacement/clear/undo, pending edit/supersession, Runtime reconnect, cancellation, timeout, and reload.
- Consume confirmation tokens once and bind them to action type plus exact update revision/digest.
- Enforce one pending update and one current analysis binding; old jobs/results may remain inert history only.
- Cancel superseded jobs where possible; reject late results regardless of cancellation success.
- Preserve conservative persistence: no restored execution authority. Prefer no pending persistence in v1; if descriptive persistence is added, load stale/review-required.
- Ensure browser digest/upload promises cannot commit abandoned component/session state.
- Add bounded evidence/audit fields without storing secrets or raw graph/update bodies in conversation memory.

### Likely production files to change

- `src/App.jsx`
- `src/candy/useCandyRuntime.js`
- `src/components/AgentChatPanel.jsx`
- `src/agent/confirmationState.js`
- `src/persistence/threadStateSchema.js` only if inert summaries are persisted
- `src/persistence/usePersistentThread.js` only if inert summaries are persisted

### Exit criteria

Every race in the test plan fails closed; cancel/timeout/reload never applies; fresh Apply remains possible only through a new independent confirmation when the pending update is still valid.

## Scope 5F — live Runtime/CUDA, browser, and security qualification

### Deliverables

- Run all application tests, lint, production/GitHub builds, dependency audit, `git diff --check`, and clean-debris checks.
- Run unchanged Scope 4A/4B1/4B2/4C regressions.
- Verify zero diff in both frozen native directories.
- Run one new authenticated live Runtime/CUDA suite with insert/delete/replacement/zero-delta/stale/cancel/timeout/restart/substitution cases.
- Run visible browser Mode A and Mode B workflow qualification.
- Run Assistant deterministic and installed-model qualification for staging, analysis, and separate Apply.
- Perform a fresh security review of the implemented state machine.
- Write only new Scope-5 qualification artifacts and create a new qualification tag only in a later explicitly authorized release step.

### Likely new qualification files

- `candy-runtime/test/run-scope5-live-qualification.mjs`
- `artifacts/candy-scope5-application-gates.json`
- `artifacts/candy-scope5-browser-qualification.json`
- `artifacts/candy-scope5-live-runtime-qualification.json`
- `artifacts/candy-scope5-security-qualification.md`
- `artifacts/candy-scope5-final-qualification.md`

### Exit criteria

No Critical/High unresolved security issue; all required matrix rows pass; real CUDA_INCREMENTAL produces correctly bound signed deltas; graph remains unchanged until separate Apply; application then commits exact proposed state and re-observes the new version.

## Components to reuse unchanged

- 30-class taxonomy and reference oracle for tests;
- incidence/update validators and `applyHypergraphMotifUpdate`;
- `CUDA_STATIC` and `CUDA_INCREMENTAL` Runtime schemas and exact backend pairing;
- authenticated loopback client/server;
- artifact store, motif job adapter/queue, qualification checks, native runner;
- delta-only result validator and truthful result component foundation;
- GraphMutationPlan, engine, preview, history, deterministic grammar, confirmation registry;
- thread persistence safe projection.

## Components frozen from modification

- `candy-runtime/native/hypergraph-motif-cuda/`
- `candy-runtime/native/hypergraph-motif-cuda-incremental/`
- historical qualification evidence and protected tags
- semantic constants: `CUDA_STATIC`, `CUDA_INCREMENTAL`, 30 S3 classes, 24 CLOSED_TRIANGLE, 6 OPEN_WEDGE, `DELETE_THEN_INSERT`, `DELTA_ONLY_NO_PRIOR_COUNTS`, no CPU fallback, no implicit projection

## Implementation stop conditions

Stop and re-audit before proceeding if implementation would require changing native CUDA source, weakening exact update semantics, reconstructing counts without prior authority, persisting executable authority, allowing multiple active pending updates, or coupling analysis and Apply into one confirmation.

