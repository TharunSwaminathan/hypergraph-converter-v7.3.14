# CANDY Scope 5A targeted security review

## Result

**PASS — no reportable findings and no unresolved High issue.**

- Scan ID: `084a9b07-4873-471d-8e0a-5554451e232a`
- Mode: working-tree diff
- Baseline: `215d6d11b7413670100c4cb9c59d8bb22a566a10`
- Coverage: complete, 10/10 changed production surfaces closed
- Findings: 0
- Daybreak access: not granted, advisory only; it did not block the local review or affect the security result.
- Generated Codex Security report: `C:\Users\tharu\AppData\Local\Temp\codex-security-scans-M3Ye9a\hypergraph-converter-v7.3.14\215d6d11b7413670100c4cb9c59d8bb22a566a10_20260923T160525Z_qj449c1z\report.md`
- Measured scan usage: 3,924,323 total tokens; 3,913,610 input tokens; 3,769,216 cached input tokens; coverage complete.

## Production files reviewed

- `src/App.jsx`
- `src/agent/confirmationState.js`
- `src/agent/deterministicNlu/contextBinding.js`
- `src/agent/orchestratorObservation.js`
- `src/graph/graphFingerprint.js`
- `src/graph/graphHistory.js`
- `src/graph/graphIdentity.js`
- `src/graph/graphMutationEngine.js`
- `src/graph/graphMutationPreview.js`
- `src/graph/graphState.js`

The new test file was reviewed as regression evidence but is not part of the production attack surface inventory.

## Reviewed threat cases and disposition

| Threat case | Result | Evidence-based disposition |
|---|---|---|
| Implicit graph-type promotion or inference from content/model wording | No issue found | The application-state constructor accepts only an explicit supported type; imports/replacements default to `Hypergraph`; no cardinality-based inference exists. |
| Stale CANDY result surviving a type transition | No issue found | Type is included in graph value and the CANDY context key; the effect clears selected result currency, while job bindings require the exact context key. |
| Stale Assistant confirmation surviving a type transition | No issue found | Confirmation snapshots and stale checks include `graphType`; version and fingerprint also change. |
| Duplicate authority sources or `hes` divergence | No issue found | `App.jsx` owns one `graphState`; `hes` and graph identity are derived selectors. |
| Graph identity/type desynchronization | No issue found | State construction and commit derive type-aware identity and fingerprint atomically. |
| Persistence restoring type or execution authority | No issue found | Scope 5A adds no graph-state persistence; existing thread persistence remains inert and does not restore graph availability, confirmations, jobs, or results. |
| Model gaining graph-type mutation authority | No issue found | Observation exposes the actual type, but no new orchestrator capability or selector was added. |
| CUDA_INCREMENTAL reachable without a pending update | No issue found | Scope 5A passes no pending update to the Runtime hook; incremental submission remains rejected by existing validation. |
| Type-only transition failing to invalidate authority | No issue found | Graph type participates in the canonical fingerprint; a type-only commit increments version and changes fingerprint. |
| Replacement, clear, or undo preserving stale authority | No issue found | Replacement and clear use committed identity transitions; history carries before/after type; undo is previewed and receives a fresh committed version. |
| Preview changing committed graph type/version | No issue found | Preview returns a proposed type only; commit remains the sole state mutation path. |
| STATIC selection regression | No issue found | Compatibility and Scope 5A tests cover STATIC for both hypergraph-family types. |
| CPU fallback introduction | No issue found | No backend-selection or fallback source was changed. |
| Implicit projection introduction | No issue found | CANDY receives the authoritative hypergraph-family value directly; no projection path was added. |

## Security conclusion

The Scope 5A delta preserves the browser-owned graph authority boundary and strengthens stale-state invalidation by binding application type into version/fingerprint, confirmations, deterministic context, and CANDY result currency. The Assistant gains observation only. No new process, filesystem, network, credential, CPU fallback, projection, or incremental execution capability was introduced.

The user subsequently completed `npm audit --omit=dev` from normal PowerShell outside the Codex sandbox and supplied a passing result of `0 production vulnerabilities`. The earlier block was specific to the Codex environment/network policy, not a product failure. No dependency manifest or product source changed to obtain that result.
