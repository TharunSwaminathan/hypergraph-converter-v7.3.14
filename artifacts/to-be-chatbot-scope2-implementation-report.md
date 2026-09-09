# To-Be Chatbot Scope 2 implementation report

Date: 2026-09-08  
Protected baseline: `3464a12ab6d420cbaca12e5bf387172f2ac8e379` (`to-be-chatbot-scope1-qualified`)  
Branch: `scope2-react`

## Result

Stages 4–5 are implemented through an additive bounded ReAct coordinator. The qualified Scope 1 application remains the execution authority: deterministic NLU runs first, the model may propose one allowlisted step, deterministic code validates and authorizes it, existing typed dispatch performs it, and the next bounded observation reports the actual result. The legacy ActionPlan path remains present for migration and when the ReAct feature flag is off.

## Architecture and boundaries

`AgentChatPanel` retains positive authorization, confirmation staging, and typed dispatch. `App.jsx` retains the exclusive Ollama request coordinator. The new `reactOrchestrator` prompt adapter produces one strict structured proposal; `orchestratorLoop` owns the eight-step ceiling, stale/repeat guards, stop behavior, and truthful fallback. It does not own the Worker, graph commit, parser validation, or persistence.

The Custom Parser sequence remains:

`ReAct -> START_CUSTOM_PARSER_WORKFLOW -> Scope 1 Specialist -> ready_for_review -> STOP -> run confirmation -> existing Worker -> preview -> apply confirmation -> existing graph commit`.

No generated parser can auto-run and no Worker result can auto-apply.

## Authoritative observation

Schema version 1 includes bounded thread summary marked `context_only`; active dataset ID/availability; file count and `requiresReupload`; detected format status/ID; grouping status/revision; specialist status, binding, run/apply readiness and trigger policy; graph ID/version/availability; pending confirmation type; last structured tool result; current UI route/section/export/visualization fields; a stable state-version token; and the current filtered capability list.

It excludes filenames, file contents, parser source, full conversation history, and arbitrary React state. Observation size is capped at 14,000 characters; thread summary is capped at 2,000 characters.

## OrchestratorStep contract

The response has exactly six fields: `outcome`, `action`, `arguments`, `requiresUserInput`, `userMessage`, and `finish`. Outcomes are only `PROPOSE_ACTION`, `REQUEST_USER_INPUT`, or `FINAL_RESPONSE`. Strict JSON parsing rejects missing/extra fields, malformed JSON, invented capabilities, and action-specific invalid arguments. No chain-of-thought field is accepted.

## Allowlisted capabilities

- `START_CUSTOM_PARSER_WORKFLOW`
- `AUTO_DETECT_ACTIVE_BATCH`, `SELECT_INPUT_ROUTE`, `PARSE_ACTIVE_BATCH`
- `SHOW_RESULT_SUMMARY`, `OPEN_SECTION`, `SELECT_EXPORT_PREVIEW`, `DOWNLOAD_EXPORT`
- `OPEN_GRAPH_PREVIEW`, `SET_GRAPH_VIEW`, `SET_GRAPH_LAYOUT`, `SET_VIZ_LIMIT`, `SEARCH_GRAPH_VERTEX`, `RESET_GRAPH_VIEW`, `REHEAT_GRAPH`, `EXPORT_GRAPH_PNG`
- `OPEN_CUSTOM_PARSER`, `REQUEST_PARSE_MODE`
- `GENERATE_MAPPING_SPEC`, `VALIDATE_MAPPING_SPEC`, `REPAIR_MAPPING_SPEC`, `GENERATE_PARSER_FROM_MAPPING`
- `RUN_CUSTOM_PARSER`, `APPLY_CUSTOM_RESULT`, `CLEAR_GRAPH`

Capabilities are removed when current files, graph, dataset, specialist lineage, or pending-confirmation state does not permit them. Protected actions retain the existing confirmation layer.

## Bounds, stops, and fallback

`MAX_REACT_STEPS = 8`. The loop stops on clarification, pending/staged confirmation, specialist review, final response, repeated action/cycle, authorization failure, confirmation failure, max steps, or unavailable/invalid model output. State changes between proposal and execution cause re-observation. Thrown tool failures become bounded structured observations. Ungrounded success wording is rejected and routed to the deterministic fallback.

The feature flag is `VITE_REACT_ORCHESTRATOR_ENABLED`; `false`, `0`, `off`, and `disabled` preserve the qualified legacy path. With ReAct enabled, confident deterministic commands remain first and make zero ReAct calls. Model failure invokes one bounded deterministic fallback and never broadens authority.

## Prompt architecture

`orchestratorPolicyPrompt.js` is the shared policy used by both legacy ActionPlan and ReAct prompts. `reactOrchestratorPrompt.js` contains only one-step ReAct decision rules. User request, bounded thread context, observation, and allowed actions remain in the user-data message; file-derived data is never placed in system policy.

## Measurements and tests

- Exact deterministic Quick Link and deterministic graph mutation: 0 ReAct calls.
- Unsupported multi-file unresolved grouping: 0 model calls; exact clarification and stop.
- Custom Parser handoff: 1 ReAct call, one Specialist handoff, stop at review.
- Controlled browser hard ceiling: 8 model calls, 8 typed executions, `max_steps_reached`; no ninth execution.
- Repeat-cycle test: one initial execution then deterministic repeat block.
- Model unavailable/invalid output: one fallback.

New focused suites: `scope2-react-core.test.mjs`, `scope2-react-integration.test.mjs`, and `scope2-react-adversarial.test.mjs`. The existing AgentChatPanel DOM suite now asserts deterministic zero-ReAct behavior. The controlled Scope 1 browser entry adds only test-scoped Ollama responses, unsupported-file fixtures, and browser-core evidence controls; no test transport is imported by production.

## Browser checkpoint

Real-browser controlled qualification passed: unsupported multi-file clarification/stop; together grouping; Specialist draft/review; run Cancel with no Worker preview; run Confirm with one 3-hyperedge preview and no graph; apply Cancel with no graph; apply Confirm with graph version 1 and one committed history event; staged-action reload with no restored approval/graph and `requiresReupload`; documentation/read-only corpus with no confirmation; max-step/tool-failure/false-success checks; and a clean console in a pristine final tab.

Live Ollama quality was not executed because `ollama` was not on PATH and `127.0.0.1:11434` refused the connection. Controlled transport evidence is not represented as live-model quality evidence.

## Phase 3 checkpoint diff

Before final audit artifacts, the complete implementation/test tree comprised 17 changed or new files, approximately 1,209 insertions and 4 deletions relative to the protected Scope 1 baseline. Final authoritative statistics are recorded in the final audit report after evidence files are included.
