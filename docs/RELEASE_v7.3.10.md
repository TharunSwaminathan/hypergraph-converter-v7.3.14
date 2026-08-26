# Hypergraph Converter Studio v7.3.10

## Compositional Help-Intent Safety and End-to-End State Preservation

v7.3.10 is a remediation release over the preserved v7.3.9 package. It addresses all 24 findings in the v7.3.9 defect audit without introducing a second routing, parser, mapping, graph, or local-model pipeline.

## Safety changes

- Shared compositional request semantics now cover instructional, explicit read-only, quoted/reported, hypothetical, negated, and correction scope.
- A final compiler/dispatcher safety boundary blocks state-changing side effects for read-only speech.
- Pending Help, direct confirm, direct cancel, graph replacement, and conversation/block behavior use one pure ordering policy.
- Runtime Stop is a direct control only when active cancellable work is present.
- Owner-ID request coordination prevents concurrent Help/Stop from clearing another request’s lifecycle.
- Confirmation snapshots bind graph-relative edits to selected-entity fingerprints.
- Registry required context and handler metadata are enforced at runtime.
- Confirmation policy and action/control lexicons are centralized.

## Correctness changes

- `Generate parser for batch <number>` activates and verifies the target batch, then directly dispatches the existing parser-generation plan; no nested chat submission occurs.
- Missing numbered/model parameters produce deterministic clarification.
- `Use model <model name>` updates validated local settings.
- Production traces are built from structured execution outcomes and no longer infer commits from plan kind.
- Planner/registry drift tests extract actual planner cases.
- Correction has executable pending/recent-interpretation examples.

## Custom Parser boundary

Known constructor/computed-property/network escape forms are rejected, globals are reduced, constructor chains are hardened, and parser output is bounded before worker serialization. Parser run and graph apply remain separate confirmations.

Custom Parser is intentionally documented as reviewed/trusted local code in a disposable worker with defense-in-depth controls. It is not represented as a formal hostile-code sandbox.

## UI repairs

- duplicate file-input ref removed;
- complete ARIA tab/tabpanel relationships restored;
- native Help disclosure open state synchronized through `onToggle`;
- compressed planner cases expanded for maintainability.

## Release gates

- complete packaged Node test command;
- complete command-reference drift check;
- exact action-registry/planner case comparison;
- 6,560 compositional instructional Help requests;
- 3,280 explicit no-action/reported/hypothetical requests;
- TypeScript parser pass over JavaScript, JSX, and MJS sources;
- Node syntax check over non-JSX JavaScript/MJS files;
- portable ZIP root/path/CRC/content verification.

See `docs/V7_3_10_TEST_REPORT.md` for observed results and environment limitations.
