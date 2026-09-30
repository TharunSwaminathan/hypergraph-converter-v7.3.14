# CANDY Scope 5B Targeted Security Review

## Result

**PASS — 0 findings; unresolved High = 0**

The final hardened five-file production diff was reviewed with Codex Security diff scan `5067809b-dcdc-4fab-9363-7cb7fd63ac02`.

- target baseline: `eb829fb627de349be99d440ebfed11990f76837e`
- final working-tree snapshot digest: `codex-security-snapshot/v1:sha256:508592fe3e44fdf410aa61e3db4509126a48325dfafc073a2a39d37147228431`
- coverage: complete
- changed production files reviewed: 5 / 5
- reportable findings: 0
- unresolved Critical: 0
- unresolved High: 0
- unresolved Medium: 0
- unresolved Low: 0

## Reviewed files

- `src/App.jsx`
- `src/agent/confirmationPolicy.js`
- `src/agent/confirmationState.js`
- `src/candy/adapters/graphMutationToHypergraphUpdate.js`
- `src/graph/pendingHypergraphUpdate.js`

Supporting graph-state, mutation-validator, preview, fingerprint, motif-contract, identifier-mapping, and Runtime-gate controls were traced where necessary.

## Threats and controls reviewed

- stale update and confirmation replay
- updateId reuse and same-ID/different-digest substitution
- manipulated next graph version
- graph-type mismatch
- base and proposed fingerprint substitution
- plan and preview substitution
- model-crafted motif transport
- delete/reinsert collision bypass
- double click and concurrent Apply
- Apply after stale, discard, supersession, or prior Apply
- old-revision revival
- graph transition during asynchronous Apply derivation
- unauthorized Runtime execution
- analysis/Apply confirmation confusion
- duplicate authoritative application state
- persistence regaining authority
- oversized update preflight
- CPU fallback or implicit projection

## Security properties confirmed

- The current update ID, revision, lifecycle, and ledger-retained digest are required.
- The pending object is deeply frozen and its authoritative content is SHA-256 bound.
- Apply re-derives the preview, proposed fingerprint, motif transport, and digest.
- The controller re-reads live graph authority immediately before the synchronous commit.
- A graph transition can stale an in-flight Apply; catch handling cannot revive it.
- The distinct Apply action binds exact graph, plan, update, digest, proposal, and next-version fields.
- Successful Apply consumes authority before replay can commit again.
- Deterministic transport uses fixed ordering/collision semantics and typed identifier canonicalization.
- Qualified hyperedge/incidence bounds run before canonicalization allocations; update-specific bounds also fail closed.
- The application owns one private controller and exposes no Scope 5B UI/Assistant staging path.
- No pending authority is persisted or restored.
- Apply invokes only graph commit/history behavior, not Runtime.
- Runtime production, authentication, native execution, CPU fallback, and projection behavior are unchanged.

## Residual deferred boundaries

Scope 5D must preserve a trusted user-gesture/confirmation dispatch boundary when UI and Assistant workflow become reachable. Scope 5C/5D must retain upstream plan-operation/member bounds before accepting large user/model drafts. Broader multi-tab and persistence coordination remains Scope 5E. These are deferred product surfaces, not unresolved findings in Scope 5B.

The formal review produced no actionable security finding and required no modification to frozen native sources or dependency manifests.
