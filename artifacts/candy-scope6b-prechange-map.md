# Scope 6B current v7_4 prechange map

Baseline da4629b1f4204fbfc8f8e6d14941d29319d79e90; exact branch/remote/tag and clean tree verified. No AGENTS.md found in repository or ancestor directories. Historical planning locations reconciled against current source. No historical evidence edited.

## A. src/App.jsx commitGraph / src/graph/graphState.js

Trigger: import, replacement, Apply. Cost: O(I + E log E). Copies: No owned copy; retains caller graph. Materialization: No. Eager: commit only. Repeats unchanged: No. Retention: current state. Correctness: sole committed authority.

## B. src/graph/graphFingerprint.js / graphIdentity.js

Trigger: every commit/fingerprint. Cost: O(I + E log E + bytes). Copies: canonical rows and strings. Materialization: canonical authority. Eager: Yes. Repeats unchanged: Yes on repeated read. Retention: temporary. Correctness: collision-safe exact no-op comparison.

## C. src/graph/graphMutationEngine.js / pendingHypergraphUpdate.js

Trigger: preview, Stage, Edit, Apply. Cost: O(I + E log E + RI). Copies: Yes. Materialization: full proposed graph. Eager: on explicit action. Repeats unchanged: Yes during revalidation. Retention: pending revision. Correctness: plan sole Apply authority.

## D. src/graph/graphHistory.js

Trigger: material commit. Cost: O(graph JSON bytes). Copies: two JSON copies per event. Materialization: before/after snapshots. Eager: Yes. Repeats unchanged: same adjacent snapshots duplicated. Retention: 25 events / 50 snapshots. Correctness: undo is fresh transition.

## E. src/App.jsx derivedCache / src/hooks/useAsyncDerivedProduct.js

Trigger: mapping/export demand. Cost: O(I), projections budgeted. Copies: worker structured clone. Materialization: requested product only. Eager: No. Repeats unchanged: cache prevents. Retention: current graph. Correctness: exact successful products only.

## F. src/utils/mappings.js computeStats / App graphResultSummary

Trigger: graph change and summary deps. Cost: O(I), bounded projection/triads. Copies: membership flatMap. Materialization: stats and validation. Eager: Yes. Repeats unchanged: summary revalidates on format/result changes. Retention: current graph. Correctness: truthful unavailable projections.

## G. src/components/Viz.jsx topology and overlay

Trigger: graph/preview size change. Cost: O(selected I + relation budget). Copies: all selected memberships. Materialization: full selected topology. Eager: Yes. Repeats unchanged: memoized rows. Retention: mounted Viz. Correctness: display only.

## H. src/components/Viz.jsx draw

Trigger: RAF/selection/search/layout. Cost: O(selected I + V), list indexOf O(E²). Copies: highlight arrays per frame. Materialization: rings, nodes, relations. Eager: Yes. Repeats unchanged: Yes per frame. Retention: effect lifetime. Correctness: display only.

## I. src/visualization/previewRuntime.js / Viz

Trigger: search typing. Cost: O(selected V/I). Copies: search arrays. Materialization: filtered list. Eager: on search. Repeats unchanged: per query. Retention: search lifetime. Correctness: filter limited to displayed subset.

## J. src/App.jsx buildExportResult / utils/mappings.js

Trigger: export demand. Cost: O(output bytes), budgeted projections. Copies: export strings and Blob. Materialization: exact requested export. Eager: No. Repeats unchanged: cache prevents. Retention: current graph + URL 1s. Correctness: must preserve full graph.

## K. src/agent/assistantContextSnapshot.js / AgentChatPanel / prompts/graphMutationPlannerPrompt.js

Trigger: conversation/planner. Cost: snapshot bounded; planner O(I). Copies: planner index and full key arrays. Materialization: bounded outgoing summaries. Eager: on request. Repeats unchanged: planner reindexes unchanged graph. Retention: request / conversation. Correctness: read-only context grants no authority.

## L. src/visualization/dynamicUpdatePreview.js / pendingHypergraphUpdate.js

Trigger: Inspect/Stage/Edit. Cost: O(I + graph bytes). Copies: full proposal revalidation. Materialization: semantic comparison graph. Eager: on explicit demand. Repeats unchanged: by pending version. Retention: one pending revision. Correctness: stale graph/revision rejected.

## M. src/App.jsx / Viz.jsx

Trigger: React render. Cost: counts O(E); summary validation/triads on unstable result deps. Copies: counts not full copy. Materialization: duplicate summary/Statistics work. Eager: Yes. Repeats unchanged: Yes with no graph change. Retention: render. Correctness: committed/legacy-preview separation.

## N. src/App.jsx texts, customResult, derivedCache / AgentChatPanel

Trigger: load/parser/export. Cost: O(input/output bytes). Copies: raw text, parser output, export strings. Materialization: chosen outputs. Eager: on demand. Repeats unchanged: cache hit. Retention: component/current graph. Correctness: parser and Apply separate.

## O. src/utils/downloadLifecycle.js / hooks/useAsyncDerivedProduct.js

Trigger: download/worker demand. Cost: O(output bytes). Copies: Blob/worker copies. Materialization: download/derived output. Eager: on demand. Repeats unchanged: No leak found; Scope6A cleanup. Retention: URL 1000ms; worker until settle/cancel. Correctness: no executable authority.

## P. src/persistence/threadStateSchema.js / threadStore.js / threadSaveQueue.js

Trigger: render/save/restore. Cost: bounded descriptions. Copies: no graph/history persistence. Materialization: 80 threads/messages, 1M chars/record. Eager: save demand. Repeats unchanged: bounded latest save queue. Retention: IndexedDB inert records. Correctness: reload cannot restore authority.
