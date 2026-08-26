# Hypergraph Converter Studio v7.3.13

## Independent-diagnostics remediation release over v7.3.12

v7.3.13 preserves the deterministic offline architecture and repairs the v7.3.12 independent-diagnostics findings without adding cloud APIs, API keys, hosted model calls, bundled model weights, public model endpoints, or a backend requirement.

## Changelog

### Safety and pending-state integrity

- Reworked request semantics so graph, mapping, grouping, parser, batch, runtime, navigation, confirmation, and download side effects require a positively authorized executable clause.
- Kept direct valid actions executable while blocking read-only wrappers, reported commands, quoted examples, hypotheticals, and explicit no-action scopes.
- Tightened pending graph replacement so typed correction text alone is not authority; replacement requires executable semantics and explicit pending-target language.
- Added v7.3.13 read-only and pending-preservation corpora on top of the existing v7.3.12/v7.3.11 gates.

### Resource and export behavior

- Added selected-derived-view routing so ordinary graph load/mapping summaries do not eagerly request H2H and V2V projections.
- Enforced V2V output/reference budgets and dense-matrix cell/byte budgets before allocation.
- Reused memoized V2V projection results for canonical JSON and clique CSV exports.
- Computed the selected export preview once per selected export/graph/options render path.
- Emitted RFC-style CRLF rows from CSV document export helpers while retaining LF/CRLF input parsing.

### Parser and Custom Parser validation

- Validated JSON hyperedge identifiers, vertex identifiers, duplicate IDs, times, and finite weights before normalization/coercion.
- Rejected malformed CSV quoting, malformed incidence rows, malformed H2V/V2H/H2H syntax, and non-finite row weights with explicit parse errors.
- Replaced raw substring Custom Parser safety checks with AST/scope-aware checks using `acorn`, preserving harmless local identifiers/object properties while blocking actual host-runtime/network/dynamic-code/prototype-escape access.

### Local bridge, upload, and runtime reliability

- Streamed bridge responses with response-byte accounting instead of buffering full model output.
- Hardened bridge timeout, upstream socket failure, client disconnect, and streamed response-cap paths so the local bridge stays alive.
- Preserved prompt-body privacy in bridge logs.
- Used bounded file slices for detection samples and cancellable stream/FileReader reads for full uploads.
- Prevented aborted uploads from returning partial batches for commit.
- Reported no-op local-model settings changes as `changedState:false` / `stateMutationCommitted:false`.

### Component/browser assurance

- Added a real DOM lifecycle test that renders `AgentChatPanel`, submits through the actual composer, stages pending graph actions, verifies read-only pending preservation, exact confirm/cancel text, valid pending correction, Help/Stop while pending, and local-model settings no-op/mutation traces.

## Validation highlights

- `tests/readonly-safety-v7-3-13.test.mjs`: 6,560 / 6,560 newly authored read-only wrappers safe with positive-action contrast intact.
- `tests/pending-preservation-v7-3-13.test.mjs`: 20 / 20 pending-state wrappers preserve the staged action with direct correction/control contrasts intact.
- `tests/resource-budgets-v7-3-13.test.mjs`: selected-view projection laziness, projection row/reference budgets, dense matrix budget, CRLF CSV output, and export projection reuse.
- `tests/parser-validation-v7-3-13.test.mjs`: malformed parser inputs and invalid normalized graph objects fail closed.
- `tests/custom-parser-scope-v7-3-13.test.mjs`: AST/scope-aware Custom Parser guard coverage.
- `tests/bridge-streaming-v7-3-13.test.mjs` and `tests/bridge-robustness-v7-3-13.test.mjs`: streaming and bridge failure-mode coverage.
- `tests/upload-cancellation-v7-3-13.test.mjs`: detection sampling, cancellable reads, full read preservation, and no partial upload commit.
- `tests/agent-chat-panel-dom-v7-3-13.test.mjs`: real `AgentChatPanel` DOM lifecycle coverage.

See `artifacts/v7.3.13-test-summary.md` for the exact commands run in this working copy.
