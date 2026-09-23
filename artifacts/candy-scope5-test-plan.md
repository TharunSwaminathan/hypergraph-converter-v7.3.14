# CANDY Scope 5 test plan

## Qualification strategy

Use a layered test pyramid. Reuse the frozen Scope 4A/4B/4C contracts and fixtures; do not modify native CUDA sources. Most Scope-5 tests should be browser/domain tests with injected Runtime clients. Run the expensive live CUDA qualification once at the final 5F gate, not during every phase.

## Reusable evidence and tests

| Source | Reuse |
|---|---|
| `tests/candy-scope4a-taxonomy.test.mjs` | stable 30-class taxonomy: 6 OPEN_WEDGE, 24 CLOSED_TRIANGLE |
| `tests/candy-scope4a-contracts-adapter.test.mjs` | typed incidence/update validation, replacement, stale refs, collision rejection |
| `tests/candy-scope4a-oracle-delta.test.mjs` | exact old/delta/new invariant and transition fixtures |
| `tests/candy-scope4a-adversarial.test.mjs` | malformed data, all 128 signatures, numeric renaming, boundary checks |
| `tests/candy-scope4b1-static-contract.test.mjs` | CUDA_STATIC pack/result bindings and bounds |
| `tests/candy-scope4b2-incremental-contract.test.mjs` | affected candidates, DELETE_THEN_INSERT, signed delta, replay/digest rejection |
| `tests/candy-scope4c-contracts.test.mjs` | browser selector schema, stale async context, result substitution, confirmation, no fallback |
| `tests/post-scope4c-motif-statistics.test.mjs` | Statistics separation, no auto-run, 30-bin and delta-only UI truthfulness |
| `tests/graph-mutation*.test.mjs`, `tests/conversational-graph-mutation.test.mjs` | typed planning, preview, stale plan, no-op, undo, model/deterministic planners |
| `tests/batch-preview-guard-v7-3-6.test.mjs`, `tests/post-scope4c-preview-controls.test.mjs` | temporary preview behavior and visual controls |
| `tests/confirmation-*.test.mjs` | stale confirmation and authority binding |
| `tests/scope1-persistence-trigger-specialist.test.mjs`, `tests/scope1-browser.js` | no restored approval or active graph |
| `candy-runtime/test/run-scope4c-boundary-qualification.mjs` | Runtime readiness, lifecycle, result confusion, retention limits |
| `candy-runtime/test/run-scope4c-live-qualification.mjs` | authenticated Windows/WSL/CUDA static+incremental end-to-end |
| `artifacts/post-diagnosis-corrective-live-runtime-requalification.json` | current-tree seven-case CUDA parity and 21 expected negative cases |

## Proposed test files

- `tests/candy-scope5-graph-state.test.mjs`
- `tests/candy-scope5-pending-update.test.mjs`
- `tests/candy-scope5-update-adapter.test.mjs`
- `tests/candy-scope5-result-binding.test.mjs`
- `tests/candy-scope5-confirmation.test.mjs`
- `tests/candy-scope5-ui.test.mjs`
- `tests/candy-scope5-assistant.test.mjs`
- `tests/candy-scope5-persistence.test.mjs`
- `tests/candy-scope5-races.test.mjs`
- `candy-runtime/test/run-scope5-live-qualification.mjs`

Names are proposed and may be consolidated, but each matrix row must remain covered.

## Contract and state matrix

| ID | Case | Expected assertion | Layer |
|---|---|---|---|
| G01 | Create DynamicHypergraph explicitly | graph type is authoritative; new state token/version; no inference from content | graph state |
| G02 | Hypergraph remains static by default | incremental unavailable even if graph is edited | graph state/routing |
| G03 | Type-only transition | invalidates old result/confirmation; fingerprint/state token changes | graph identity |
| G04 | Replacement | new graph ID, monotonic version, pending/result stale | graph identity |
| G05 | Undo | creates a new committed version; old pending/result remains stale | graph history |
| U01 | Pending insert | preview only; committed graph unchanged; canonical insertion derived | pending reducer/adapter |
| U02 | Pending delete | existing ID required; deletion derived | pending reducer/adapter |
| U03 | Replacement same ID | exact delete then insert; accepted | adapter |
| U04 | Replacement new ID | delete old + insert new; accepted | adapter |
| U05 | Incidence add/remove | net membership change projects to delete/reinsert | adapter |
| U06 | Multiple affected hyperedges | canonical deterministic update independent of operation ordering | adapter |
| U07 | Metadata-only edit | `motifImpact: NONE`; no fake delta; Apply remains independent | reducer/UI |
| U08 | Full graph no-op | no authoritative next version/update; no Runtime job | reducer |
| U09 | Empty inserted hyperedge | rejected before staging | validator |
| U10 | Invalid/missing vertex semantics | new insertion vertex accepted; undeclared base reference rejected where applicable | adapter |
| U11 | Duplicate deletion | rejected | validator |
| U12 | Duplicate insertion | rejected | validator |
| U13 | Insert existing ID without delete | collision rejected | validator |
| U14 | Delete missing ID | rejected | validator |
| U15 | Unsupported ordering/policy | rejected; constants cannot be caller-selected | validator |
| U16 | Invalid next version | rejected | validator |
| U17 | Stale base ID/version/fingerprint | transitions to STALE; no job/apply | reducer |
| U18 | Edit validated update | fresh ID/revision/digest; confirmation/result invalidated | reducer |
| U19 | Duplicate update ID, same digest | explicit idempotent handling only, no duplicate authority | ledger |
| U20 | Duplicate update ID, different digest | rejected | ledger |
| U21 | Consumed/discarded update replay | rejected | ledger/reducer |

## Static/incremental and result matrix

| ID | Case | Expected assertion |
|---|---|---|
| R01 | Explicit current count on Hypergraph | `STATIC/CUDA_STATIC` only |
| R02 | Explicit current count on DynamicHypergraph with pending update | still STATIC unless user requests change analysis |
| R03 | Explicit change question with validated pending update | `INCREMENTAL/CUDA_INCREMENTAL` only |
| R04 | DynamicHypergraph without pending update | typed unavailable; no fallback/model/native call |
| R05 | Pending update with backend absent | `BACKEND_UNAVAILABLE`; no alternate backend |
| R06 | Ordinary/projected graph | rejected; no implicit projection |
| R07 | Incremental signed 30-bin result | exactly 30 safe integers; signed total equals sum |
| R08 | Positive, negative, and zero bins | UI formats `+N`, `-N`, `0`; preserves taxonomy labels |
| R09 | Delta-only without prior count | no full/new count shown |
| R10 | Valid exact prior static result | derived before/delta/after allowed and labeled derived |
| R11 | Stale/wrong-taxonomy/wrong-artifact prior result | reconstruction suppressed; delta-only remains |
| R12 | Result graph/update/request/session substitution | rejected |
| R13 | Result artifact content substitution | digest mismatch rejected |
| R14 | Wrong device/backend/mode/taxonomy | rejected |
| R15 | Output next version mismatch | rejected |
| R16 | Native request digest mismatch | rejected |
| R17 | Analysis completes | committed graph and pending update unchanged |
| R18 | Line-Graph Triangles | stays separate; incremental delta never appears there |

## Confirmation and authority matrix

| ID | Case | Expected assertion |
|---|---|---|
| A01 | Create/edit draft | no committed mutation; positive edit intent required |
| A02 | Run incremental analysis | exact separate confirmation required; no job before confirm |
| A03 | Apply pending update | exact separate confirmation required; no analysis implied |
| A04 | Confirm analysis | creates job only; never Apply |
| A05 | Confirm Apply | commits once; never creates Runtime job |
| A06 | Edit after analysis confirmation | old token rejected |
| A07 | Edit after Apply confirmation | old token rejected |
| A08 | Graph replacement after either confirmation | token rejected |
| A09 | Runtime reconnect after analysis confirmation | token rejected |
| A10 | Confirmation expiry | rejected |
| A11 | Apply success | exact proposed fingerprint/version verified after commit; pending authority cleared |
| A12 | Apply reentry/double click | exactly one commit/version transition |
| A13 | Apply failure | graph unchanged; pending update remains validated or becomes typed failed/stale |

## Concurrency and lifecycle matrix

| ID | Scenario | Required fail-closed result |
|---|---|---|
| C01 | Graph changes during graph upload | stop before update upload/job where possible; typed stale |
| C02 | Update changes during update upload | no job, or submitted job cancelled; old binding stale |
| C03 | Graph changes while job runs | late result rejected as current |
| C04 | Pending update changes while job runs | new revision supersedes; late result rejected |
| C05 | Second update before first completes | exactly one authoritative pending update; first job non-current/cancelled |
| C06 | Repeated cancellation queued/running | terminal cancelled; no accepted result; no orphan |
| C07 | Cancel then Apply using old token | rejected; fresh separate Apply may be requested |
| C08 | Native timeout then Apply using old token | rejected; no result; fresh Apply required |
| C09 | Runtime restart | old session job/result/binding stale |
| C10 | Browser reload while running | no job/result/apply authority restored |
| C11 | Late completion after cancel | result not accepted/current |
| C12 | Application unmount/reload | no state update from abandoned async digest/upload |

## Persistence matrix

| ID | Case | Expected assertion |
|---|---|---|
| P01 | Browser reload | graph unavailable until reloaded; confirmation absent |
| P02 | Assistant thread reload | messages may return; pending authority does not |
| P03 | Graph replacement | pending update/result cleared or stale, never rebound automatically |
| P04 | Dataset replacement | same as graph replacement |
| P05 | Application restart | companion session, jobs, bindings, and results not assumed valid |
| P06 | Optional inert pending summary | loads only as `STALE_REVIEW_REQUIRED`; no action buttons enabled |
| P07 | Persisted malicious extra fields | closed schema drops/rejects authority fields |

## Assistant matrix

| ID | Utterance/workflow | Expected result |
|---|---|---|
| AS01 | “delete hyperedge h1” in dynamic-update mode | typed remove plan staged as pending preview, not committed |
| AS02 | “replace h2 with …” | delete/reinsert pending update with current refs |
| AS03 | “add these hyperedges as one update” | one plan/update revision, bounded operation count |
| AS04 | “show how motifs would change” | incremental selector only if valid pending update; confirmation staged |
| AS05 | “run incremental motif analysis” | exact backend/device/update selector; no fallback |
| AS06 | “apply the pending update” | separate Apply confirmation; no Runtime run |
| AS07 | quoted/negated/hypothetical command | no action |
| AS08 | model supplies graph/update/path/token/candidates | strict schema rejection and re-observation within 8 steps |
| AS09 | pending correction (“instead…”) | replaces draft with new revision; old authority invalid |
| AS10 | stale Assistant observation | dispatcher rejects and re-observes |

## Limits and performance matrix

- exact 256-hyperedge acceptance and 257 rejection;
- deletion/insertion bounds at 256 each, inserted incidence boundary at 100,000;
- 2 MiB packed request, 6 MiB artifact, 8 MiB request/result/stdout, and 64 KiB stderr boundaries;
- timeout 1 and 60,000 accepted; 0/60,001/noninteger rejected;
- preview 10,000 limit and bounded visual sampling at 3,000/100,000/4,000;
- browser preflight rejects before artifact upload/model/native call;
- repeated edits do not retain unbounded result/job/update histories;
- no quadratic preview path beyond existing bounded visualization policy.

## Final 5F qualification gates

1. All application tests, lint, production build, and GitHub build pass.
2. Full Scope 4A/4B1/4B2/4C and post-diagnosis regression suites pass unchanged.
3. Protected native directory diff remains zero.
4. Browser Mode A proves feature-disabled/no-fallback behavior.
5. Browser Mode B proves first-class DynamicHypergraph create → pending preview → separate analysis confirmation → actual CUDA_INCREMENTAL delta → no automatic apply → separate Apply confirmation → new graph version → re-observation.
6. Live authenticated Runtime/CUDA covers insert, delete, replacement, zero delta, stale update, cancellation, timeout, Runtime restart, and result substitution.
7. Fresh security review covers the implemented state machine and no unresolved Critical/High issues.
8. Historical qualification artifacts and tags remain unchanged; new Scope-5 evidence uses new filenames.

