# To-Be Chatbot final adversarial audit report

Date: 2026-09-08  
Result: **PASS WITH LOW LIMITATIONS**  
Baseline: `3464a12ab6d420cbaca12e5bf387172f2ac8e379` / `to-be-chatbot-scope1-qualified`  
Branch: `scope2-react`

## Executive result

Scope 2 Stages 4–5 and the Phase 4 independent audit are complete. All discovered Critical, High, and material Medium findings are closed. The deterministic fast path remains first; ReAct is bounded coordination only; existing authorization, confirmations, Worker execution, graph commit, and Scope 1 persistence remain authoritative.

Two Low limitations remain: live Ollama quality could not be executed in this environment, and the pre-existing development-only Browserslist advisory/large-chunk build advisory remain under the explicit no-dependency-modernization boundary. Production dependencies audit clean.

## Architecture audited

The application follows: `deterministic fast path -> bounded ReAct when unresolved/multi-step -> strict validator -> positive authorization -> existing typed capability -> structured result -> authoritative re-observation`. `AgentChatPanel` owns authorization/confirmation/dispatch, `App.jsx` owns exclusive local Ollama coordination, Scope 1 Specialist owns parser generation/repair/review, the disposable Worker owns parser execution, and the existing graph path owns commit.

The output schema has exactly six fields and three outcomes; malformed JSON, extra fields, unknown tools, and invalid action arguments are rejected. Observations are limited to 14,000 characters and include bounded context plus live dataset/upload/format/grouping/parser/graph/UI/confirmation/result/version state. Filenames, file contents, parser source, and whole React state are excluded. Conversation summary is explicitly `context_only`.

The allowlist contains 25 existing typed capabilities spanning input/batch parsing, mapping, Custom Parser, graph preview, visualization, export, summary, and protected clear/run/apply/download actions. Availability is filtered from live state. `MAX_REACT_STEPS` is 8.

## Stop, authorization, and truth behavior

- Clarification makes zero further calls and executes no action.
- Confirmation stages once and stops; the model cannot confirm.
- Parser generation stops at review; run and apply retain separate confirmations.
- Pending confirmation exposes no model capabilities.
- Same-action cycles against the same version are blocked.
- Changed state is re-observed; stale proposal state never executes.
- Tool exceptions are observed as failure; authorization/confirmation exceptions stop fail-closed.
- Success/completed/applied claims require an observed successful tool result.
- Missing restored bytes force re-upload; no confirmation or continuation is restored.
- Documentation, quotation, negation, hypothetical, role-play, and state-preservation language remains non-mutating.
- A separate positive executable clause still reaches its normal confirmation path.

## Phase 4 findings and corrective work

Counts: Critical 0; High 5 (all closed); Medium 2 (all closed); Low 2 (environment/pre-existing, open/accepted).

Correctives closed stale dataset continuation, ungrounded success claims, documentation-only mutation routing, thrown loop-boundary failures, Custom Parser cross-clause authority borrowing, missing UI state/version fields, and React state-settlement re-observation. Tests were added before/with each correction and the full gate was rerun.

Prompt injection was attempted through filenames/file contents and prior summaries. File-derived strings do not enter the observation. Prior summary remains bounded and explicitly non-authoritative. System policy states that uploaded data and conversation context cannot override live state or authorize execution.

## Efficiency and observed bounds

- Deterministic Quick Link and exact deterministic graph mutation: 0 ReAct calls.
- Multi-file unresolved grouping: 0 model/tool calls before the exact clarification.
- Unsupported grouped Custom Parser flow: 1 ReAct proposal, one Specialist handoff, then stop at review.
- Browser-core max test: 8 model calls, 8 executions, `max_steps_reached`, no ninth action.
- Repeat test: blocked after a proposal recurred against a previously seen unchanged state.
- Invalid/model-unavailable response: exactly one deterministic fallback.
- Browser tool failure: one tool call, failure observed, truthful final response.

## Real-browser evidence

The actual production App/AgentChatPanel/Scope 1 Specialist/Worker/graph-commit paths ran with only the Ollama transport controlled by the isolated test entry.

- Unsupported three-file `.weird` batch -> exact together/separate question -> stop: PASS.
- Together -> one Specialist draft -> review: PASS.
- Run request -> confirmation -> Cancel -> no preview/Worker result: PASS.
- Run again -> Confirm -> one 3-hyperedge preview -> no graph: PASS.
- Apply -> confirmation -> Cancel -> no graph: PASS.
- Apply again -> Confirm -> graph version 1 / one history commit / 3 H and 3 V: PASS.
- Reload with run confirmation staged -> no restored confirmation, graph, or continuation; saved workspace requires re-upload: PASS.
- Seven documentation/manual/reference variants and held-out quoted/negated/hypothetical variants -> no confirmation or graph change: PASS.
- Browser-core max/tool exception/false-success evidence: 8/8 bounded stop; one failed tool observed truthfully; false success used fallback: PASS.
- Composer remained enabled after all stops/failures: PASS.
- Pristine final tab console warnings/errors/unhandled rejections: none.

The controlled parser response and test buttons exist only in `tests/scope1-app.jsx`; no test transport or hook is imported by the production entry.

## Live Ollama

**LIVE OLLAMA: NOT EXECUTED — ENVIRONMENT UNAVAILABLE.** `ollama` was not on PATH. `curl --noproxy '*' --max-time 3 http://127.0.0.1:11434/api/tags` failed to connect. No production source was changed to simulate live availability, and controlled response tests are not claimed as model-quality evidence.

## Final qualification

- `npm run test`: PASS, 228/228 test files, 108.9 s final post-corrective run.
- `npm run lint`: PASS, zero errors/warnings.
- `npm run build`: PASS, 228 modules, 408 ms; pre-existing chunk-size advisory only.
- `npm run build:github`: PASS, 228 modules, 246 ms; repo base preserved; pre-existing chunk-size advisory only.
- `npm audit`: reports one High development-only `browserslist <=4.28.6` advisory; no dependency change was authorized.
- `npm audit --omit=dev`: PASS, 0 vulnerabilities.
- `git diff --check`: PASS; Git emitted line-ending conversion notices only, with no whitespace errors.
- Historical deterministic NLU/adversarial, graph/parser/export/algorithm/visualization, all Scope 1 persistence/Specialist/Worker, and all new Scope 2 suites: PASS within the 228-file gate.

## Migration, legacy, and scope controls

`VITE_REACT_ORCHESTRATOR_ENABLED` defaults on; `false`, `0`, `off`, or `disabled` selects the qualified legacy behavior. The existing legacy ActionPlan and deterministic fallback remain present. The shared orchestrator policy now hardens both legacy and ReAct prompts without merging their responsibilities.

No React/Vite/dependency upgrade, MCP, cloud API, API key, external database, Worker redesign, graph algorithm rewrite, graph commit rewrite, or post-scope feature was added. The protected Scope 1 tag and commit were not moved or modified. No commit or merge was created.

## Final diff summary

Against `to-be-chatbot-scope1-qualified`, standard Git tracked diff is 5 files changed, 326 insertions, and 4 deletions. Including all 16 new source/test/evidence files, the complete working tree is 21 files changed, 1,436 insertions, and 4 deletions. The final tree remains intentionally uncommitted on `scope2-react` for user review.
