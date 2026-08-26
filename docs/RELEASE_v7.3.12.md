# Hypergraph Converter Studio v7.3.12

## Remediation release over v7.3.11

v7.3.12 preserves the deterministic offline architecture and fixes the v7.3.11 remediation findings without adding cloud APIs, API keys, hosted model calls, bundled model weights, or a backend requirement.

## Changelog

### Safety

- Added whole-request execution semantics with `mode`, `executionAuthorized`, scoped clauses, and read-only reasons.
- Added a final side-effect authorization gate used by compilation and dispatch.
- Added a 4,920-case independent read-only safety corpus.

### Pending-state integrity

- Pending graph replacement now requires executable request semantics and a strongly typed pending correction.
- Read-only pending wrappers preserve staged actions; exact direct confirm/cancel controls remain available.

### Scalability and projection semantics

- H2H, V2V, and triad work expose structured `computed`, `not_requested`, and `over_budget` states.
- Dashboard summaries and exports preserve "not computed" instead of displaying omitted projections as zero.
- Hypergraph visualization no longer constructs V2V clique edges in Hypergraph mode; Line Graph mode enforces the shared projection budget.
- Force layout pauses for very large node sets and asks the user to use Grid or Circular.

### Parser integrity

- JSON hyperedges are schema-validated before normalization.
- CSR/CSC optional metadata vectors must match hyperedge count exactly.
- Finite weights are required when supplied, and `weight: 0` remains valid.
- Duplicate-hyperedge signatures use collision-safe serialization.

### Custom Parser

- The trusted-code guard ignores harmless comments, strings, and object-property names such as `row.location` and `row.process`.
- Actual global/network/dynamic-code access remains blocked.
- Shared acyclic output objects are accepted; self and mutual cycles are rejected.

### Runtime bridge

- Bridge limit environment variables are strictly parsed.
- Oversized request bodies return HTTP 413 and are not forwarded.
- Upstream requests have a timeout; upstream responses are capped.
- Prompt/request bodies are not logged or persisted.

### Uploads

- Uploads have shared limits for file count, single-file bytes, aggregate bytes, and read concurrency.
- Size preflight runs before reading full file text.

### Accessibility

- The Tools switcher uses `tablist`, `tab`, and `tabpanel` roles with roving tabindex and Arrow/Home/End/Enter/Space keyboard behavior.
- Inactive tool panels remain mounted so user state is preserved.

## Validation highlights

- `tests/readonly-safety-v7-3-12.test.mjs`: 4,920 / 4,920 read-only cases safe.
- `tests/pending-preservation-v7-3-12.test.mjs`: 20 / 20 pending read-only wrappers preserve state.
- `tests/data-resource-integrity-v7-3-12.test.mjs`: parser, projection, zero-weight, duplicate-signature, and Custom Parser regression coverage.
- `tests/upload-policy-v7-3-12.test.mjs`: upload limits and bounded concurrency.
- `tests/bridge-limits-v7-3-12.test.mjs`: bridge invalid config, health, forwarding, and request cap behavior.

See `artifacts/v7.3.12-test-summary.md` for the exact commands run in this working copy.
