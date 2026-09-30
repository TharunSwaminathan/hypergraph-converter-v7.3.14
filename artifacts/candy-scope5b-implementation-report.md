# CANDY Scope 5B Implementation Report

## Decision

**PASS**

Scope 5B implements the authoritative browser-session `PendingDynamicHypergraphUpdate` model on branch `candy-integration-scope5b-pending-update`, starting from `eb829fb627de349be99d440ebfed11990f76837e`. All implementation, tests, and evidence remain uncommitted.

## Scope delivered

The application now owns one internal pending-update controller for DynamicHypergraph updates. The controller reuses `GraphMutationPlan` as the only graph-application authority, derives a deterministic non-authoritative preview, derives `HypergraphMotifUpdate` only as transport data, and keeps the committed graph unchanged until a separate exact Apply authorization.

The aggregate binds:

- `updateId`
- monotonically increasing `revision`
- `status`
- exact `baseGraphRef` and `baseGraphFingerprint`
- `graphType === DynamicHypergraph`
- exact `plan` and `planHash`
- deterministic `preview`
- `proposedGraphFingerprint`
- `nextGraphVersion === base + 1`
- derived `motifUpdate`
- `motifImpact`
- SHA-256 `updateDigest`
- `staleReason`

The aggregate is browser-memory-only. No pending update, confirmation, Runtime job, or result authority is persisted or restored.

## Authority and lifecycle

Allowed statuses are `DRAFT`, `VALIDATED`, `STALE`, `APPLIED`, and `DISCARDED`.

- Creating a draft validates the plan against the live committed graph but does not commit.
- Validation rechecks graph type, exact base identity, plan hash, preview, proposed fingerprint, next version, deterministic motif projection, qualified limits, and live session authority.
- A material edit supersedes the prior revision and mints a new revision, fresh update ID, proposal binding, and SHA-256 digest.
- A full graph no-op consumes the draft and creates no pending authority or version transition.
- Any committed graph authority transition stales the current draft, validated update, or in-flight Apply revision.
- Discard consumes authority without changing the graph or graph version.
- Successful Apply marks the revision applied, clears executable authority, and cannot be replayed.
- Failed pre-commit derivation/commit remains retryable only when the revision did not become stale.
- Consumed, discarded, stale, and superseded revisions cannot regain authority.

The module-private bounded session ledger retains at most 256 diagnostic records. The current update ID, revision, lifecycle, and validated digest must all match. Reload/remount creates a new session and restores no authority.

## Deterministic motif projection

`src/candy/adapters/graphMutationToHypergraphUpdate.js` computes transport from the canonical committed/proposed incidence diff, never from raw mutation-operation order.

- pure insertion -> insertion
- pure deletion -> deletion
- same-ID membership change -> delete old and insert new with the same ID
- old-ID/new-ID replacement -> delete old and insert new
- multiple changes -> canonical typed-identifier order
- metadata-only change -> `motifImpact: NONE` and empty topology delta
- full graph no-op -> no pending authority

The adapter fixes, rather than accepts from callers:

- ordering: `DELETE_THEN_INSERT`
- collision policy: `REJECT_EXCEPT_EXACT_DELETE_REINSERT`

It uses existing typed-identifier canonicalization and existing motif-update schema validation. Qualified limits are enforced at or before canonicalization: at most 256 hyperedges, 100000 graph incidences, 256 deletions, 256 insertions, and 100000 inserted incidences.

## Apply and confirmation boundary

`apply_pending_hypergraph_update` is a distinct required confirmation policy. It binds graph ID/version/fingerprint/type, plan ID/hash, update ID/revision/digest, proposed fingerprint, and next version. It cannot be substituted with an expensive CANDY-compute confirmation.

Apply:

1. accepts only the current validated ledger record;
2. checks the ledger-retained digest;
3. verifies the exact confirmation;
4. verifies the exact base graph;
5. moves synchronously to an applying lifecycle before asynchronous work;
6. re-derives preview, proposed fingerprint, motif transport, and digest;
7. re-reads live graph authority immediately before commit;
8. rejects an in-flight revision staled by another graph transition;
9. commits the exact proposed hyperedges through the existing graph commit/history path;
10. verifies committed graph ID/version/type/fingerprint;
11. consumes and clears authority.

Apply never invokes CANDY Runtime and reports `runtimeJobCreated: false`. CUDA incremental execution remains unavailable from the application workflow.

## Changed inventory

Modified production files:

- `src/App.jsx`
- `src/agent/confirmationPolicy.js`
- `src/agent/confirmationState.js`

New production files:

- `src/candy/adapters/graphMutationToHypergraphUpdate.js`
- `src/graph/pendingHypergraphUpdate.js`

New tests:

- `tests/candy-scope5-confirmation.test.mjs`
- `tests/candy-scope5-pending-update.test.mjs`
- `tests/candy-scope5-update-adapter.test.mjs`

New Scope 5B evidence:

- `artifacts/candy-scope5b-implementation-report.md`
- `artifacts/candy-scope5b-test-results.json`
- `artifacts/candy-scope5b-security-review.md`
- `artifacts/candy-scope5b-qualification.json`

No Runtime production file, native CUDA source, dependency manifest, Scope 5/5A evidence, or historical qualification tag changed.

## Verification

- focused Scope 5B tests: PASS
- Scope 5A graph-state regression: PASS
- full suite: **257 / 257 test files PASS**
- lint: PASS
- production build: PASS
- GitHub Pages build: PASS
- `npm audit --omit=dev`: PASS, 0 vulnerabilities
- `git diff --check`: PASS
- final targeted security scan: complete, 0 findings, unresolved High = 0
- protected native-source delta: 0
- `package.json` / `package-lock.json` delta: 0

The npm advisory gate was completed outside the Codex sandbox with an isolated temporary npm 11.4.2 client because the sandbox blocked registry socket access and exposed no npm executable. No dependency manifest changed.

## Deferred to later Scope 5 phases

- Scope 5C Runtime submission/result registry and signed result bindings
- end-user CUDA_INCREMENTAL reachability
- Scope 5D Assistant/UI draft, analysis, Apply, edit, and discard workflow
- broader Scope 5E persistence, multi-tab, cross-context, and concurrency hardening
- final Scope 5F qualification

No CPU fallback, implicit projection, automatic Runtime execution, or model-authored trusted motif transport was introduced.
