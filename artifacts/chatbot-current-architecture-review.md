# Hypergraph Assistant current architecture review

Date: 2026-09-21
Baseline: `faeca1053f95a61bfe03ac88295c563d32f91969`
Branch: `post-scope4c-chatbot-ui-corrective`
Decision: **PASS**

## Preserved control flow

```text
user message
  -> deterministic intent/help/safety compiler
  -> bounded ReAct only when unresolved or genuinely multi-step
  -> strict one-action schema validation
  -> positive authorization
  -> action/state-bound confirmation where required
  -> typed application or authenticated Runtime executor
  -> authoritative result and bounded re-observation
```

The model cannot execute tools, self-confirm, invent authoritative job IDs, select executables, or convert model prose into success. Restored browser state contains no pending approval or execution authority.

## Corrective integrations

- Workspace `Upload files` delegates to the existing bounded `agentActions.uploadAgentFiles` action. Upload alone does not parse, call a model, run/apply parser code, mutate the graph, or submit Runtime work.
- Documentation framing remains read-only. The named manual/run/delete questions resolve to specific catalog Help and cannot positively authorize mutation.
- `Show the triads.` is a deterministic `NAVIGATE_STATS` request. The integrated bridge classifies `show_stats` as navigation, opens Statistics, and performs no graph or Runtime action.
- Graph Preview adds strict custom sizing (1..10,000), capped vertex/hyperedge search text, explicit clear/not-found behavior, and Hypergraph-only hyperedge filtering.
- Statistics adds a separate Hypergraph 3-Edge Motifs product. It never substitutes Line-Graph Triangles, never projects a graph, and never selects CPU fallback.
- A Statistics compute click does not submit directly. It sends the exact `SUBMIT_CANDY_MOTIF_JOB` arguments into the existing Assistant confirmation path. Native submission remains after confirmation only.
- Motif result presentation is shared by Runtime and Statistics, validates 30 bins, groups 6 OPEN_WEDGE and 24 CLOSED_TRIANGLE classes, distinguishes STATIC absolute counts from INCREMENTAL signed deltas, and displays a result only for the current graph ID/version.

## Trust boundaries

- File ingestion remains subject to extension/count/byte/concurrency limits before reading.
- Local-model output remains advisory and schema/capability/authorization/confirmation constrained.
- Custom Parser remains reviewed/trusted code executed in a disposable bounded Worker; preview and graph apply stay separate.
- Derived Worker results remain request-ID, graph-version, and graph-identity bound.
- CANDY remains build-gated, HTTP loopback-only, bearer-authenticated, exact-origin checked when present, immutable-artifact bound, exact-backend/device qualified, and fixed-executable only.

## Qualification

- Focused corrective set: 41/41 Node subtests passed.
- Full suite: 249/249 files passed.
- Lint, production build, GitHub Pages build, production dependency audit, and final diff check passed.
- The build-only large-chunk warning remains a non-blocking performance observation.
- Qualified native CUDA motif directories have zero source delta.
