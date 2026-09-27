# CANDY Scope 5A implementation report

## Decision

**PASS**

All Scope 5A product, regression, build, integrity, targeted security, and dependency-audit requirements pass. The user completed `npm audit --omit=dev` manually from normal PowerShell outside the Codex sandbox and reported `0 production vulnerabilities`. The previous block was specific to the Codex environment/network policy, not a product failure. No dependency manifest changed.

## Baseline and repository state

- Branch: `candy-integration-scope5a-graph-state`
- Starting SHA and current `HEAD`: `215d6d11b7413670100c4cb9c59d8bb22a566a10`
- Delivery state: uncommitted working tree; no commit, tag, push, merge, amend, reset, or history rewrite was performed.

## Exact final working-tree inventory

Modified tracked production files:

- `src/App.jsx`
- `src/agent/confirmationState.js`
- `src/agent/deterministicNlu/contextBinding.js`
- `src/agent/orchestratorObservation.js`
- `src/graph/graphFingerprint.js`
- `src/graph/graphHistory.js`
- `src/graph/graphIdentity.js`
- `src/graph/graphMutationEngine.js`
- `src/graph/graphMutationPreview.js`

New implementation and test files:

- `src/graph/graphState.js`
- `tests/candy-scope5-graph-state.test.mjs`

New Scope 5A evidence files:

- `artifacts/candy-scope5a-implementation-report.md`
- `artifacts/candy-scope5a-test-results.json`
- `artifacts/candy-scope5a-security-review.md`
- `artifacts/candy-scope5a-qualification.json`

No other tracked or untracked files are part of the Scope 5A delta.

## Implemented graph authority model

`src/graph/graphState.js` defines the single authoritative application graph envelope:

```text
graphType
graphId
graphVersion
graphFingerprint
hyperedges
explicitVertices
```

`explicitVertices` is reserved and remains `null` under Scope 5A; existing membership-derived vertex behavior is unchanged. The only accepted application graph types are `Hypergraph` and `DynamicHypergraph`. Ordinary graph types and projected ordinary graph types are rejected at this application-state boundary.

`App.jsx` owns one `graphState` value. The legacy `hes` and graph-identity values are derived selectors, not independent writable authorities. Imports and graph replacements default to `Hypergraph`; ordinary content and hyperedge cardinality never promote a graph implicitly.

## Type, version, and fingerprint semantics

- A user-explicit `Hypergraph` to `DynamicHypergraph` transition, or the reverse, is a committed authority transition.
- A type-only transition preserves graph contents and graph ID, increments graph version, and changes the graph fingerprint, including for the empty domain-state case.
- The fingerprint canonicalizes graph type, the reserved explicit-vertex slot, and canonical hyperedges. It is a stale-state marker, not a cryptographic artifact digest.
- Normal graph mutations preserve the current graph type.
- Imports and replacements create a new graph identity and default to `Hypergraph`.
- Clear remains a committed replacement-like transition while preserving the selected application graph type.
- History records before/after types; undo proposes the prior type and contents through preview, then receives a fresh committed version when applied.
- Preview does not modify committed graph type, version, identity, or contents.

## Explicit UI and Assistant behavior

The committed-graph card now contains a `Committed graph type` selector populated only from the two application graph types. Changing the selector routes through the graph commit authority, invalidates stale state, clears the active batch preview, and does not start a CANDY job.

Assistant observation, deterministic context binding, confirmation snapshots, and orchestrator state versioning now include the authoritative graph type. A type transition therefore invalidates stale confirmations and deterministic actions. No Assistant graph-type mutation capability, pending-update capability, or new native-execution authority was added.

## CANDY behavior

- CANDY receives the authoritative application `graphType`; the previous hard-coded `Hypergraph` value is removed.
- STATIC motif analysis remains compatible with both `Hypergraph` and `DynamicHypergraph`.
- `DynamicHypergraph` alone does not authorize `INCREMENTAL` or `CUDA_INCREMENTAL`.
- `useCandyRuntime` receives no Scope 5A pending update, so an incremental request remains rejected with the existing invalid-update path.
- No CPU fallback or implicit graph projection was introduced.
- The CANDY context key includes graph type and graph value, so a type transition clears selected motif-result currency and makes prior bindings stale.

## Verification summary

- Focused Scope 5A, graph-mutation, Scope 4C, and orchestrator regressions: PASS.
- Complete application suite: **254/254 test files PASS**.
- Lint: PASS.
- Production build: PASS.
- GitHub Pages build: PASS.
- Existing Vite large-chunk advisory only; no new build failure.
- `git diff --check`: PASS.
- Protected native-source delta: none.
- `package.json` / `package-lock.json` delta: none.
- Targeted Codex Security diff scan: complete coverage of 10 changed production files, zero findings, no unresolved High issue.
- `npm audit --omit=dev`: PASS — completed outside the Codex sandbox from the user's normal PowerShell; externally supplied result reports `0 production vulnerabilities`.
- The prior audit block was environment-policy-specific. `package.json` and `package-lock.json` remain unchanged, and no product source changed after the green test/build run.

## Deferred to Scope 5B

Scope 5A intentionally does not add `PendingDynamicHypergraphUpdate`, `updateId`, pending revision authority, `motifUpdate`, `proposedGraphFingerprint`, `applyPendingHypergraphUpdate`, update authoring/lifecycle UI, incremental submission enablement, or authoritative update application. These remain future Scope 5B work.

## Final phase decision

The Scope 5A implementation is complete, security-reviewed, and fully qualified: **PASS**. The previously blocked advisory gate was closed by the externally executed `npm audit --omit=dev` result of `0 production vulnerabilities`; no source or dependency-manifest change was required.
