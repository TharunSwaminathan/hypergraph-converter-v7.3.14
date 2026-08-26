# MODEL_SETUP.md

## Hypergraph Converter Studio v7.3.13 - deterministic command authority with optional local Ollama

Ollama remains optional local assistance only. It is not command authority and cannot bypass deterministic request semantics, the final side-effect authorization gate, required-context checks, validators, previews, confirmation policy, stale-state checks, or runtime outcome reporting.

v7.3.13 keeps the v7 GitHub Pages/local runtime model and tightens local-runtime reliability:

- direct and bridge Ollama access remain local/private only;
- the local bridge streams model responses instead of buffering the full response before returning data;
- bridge timeout, upstream-error, client-disconnect, and response-cap paths are handled without crashing the bridge;
- prompt/request bodies are still not logged or stored by the bridge;
- model settings that are already selected are reported as successful no-ops, not as committed mutations.

GitHub Pages is still static hosting. It cannot start Ollama, host a model, or run the bridge for the user. The browser can only contact a local runtime or local bridge that the user already started on the machine running the browser.

If direct `http://localhost:11434` access fails from a deployed page, run Local Runtime Diagnostics, verify `curl http://localhost:11434/api/tags` from the same OS/browser environment, configure `OLLAMA_ORIGINS` for the deployed origin if needed, or start the local bridge and use `http://127.0.0.1:8787/ollama`.

Custom Parser remains reviewed/trusted local JavaScript in a disposable Web Worker with defense-in-depth checks. It is not a formal sandbox for hostile code.

---

## Historical: Hypergraph Converter Studio v7.3.12 - deterministic command authority with optional local Ollama

Ollama remains optional local assistance only. It is not command authority and cannot bypass deterministic request semantics, final side-effect authorization, required-context checks, validators, previews, confirmation policy, stale-state checks, or runtime outcome reporting.

v7.3.12 adds stricter runtime/resource behavior around local assistance:

- read-only or explanatory requests never run model/runtime controls just because they mention an action;
- same-value model settings are successful no-ops and are not traced as mutations;
- the optional local Ollama bridge validates request/response limits and upstream timeouts;
- oversized bridge requests return deterministic HTTP 413 and are not forwarded upstream;
- prompt/request bodies are not logged or stored by the bridge.

For GitHub Pages or other static hosting, the browser can only contact a local runtime that the user has already started. GitHub Pages cannot run Ollama or llama.cpp. If direct `http://localhost:11434` access is blocked by CORS/origin/private-network policy, start the local runtime bridge and use the documented bridge URL instead.

Custom Parser remains reviewed/trusted local JavaScript in a disposable Web Worker with defense-in-depth checks. It is not a formal sandbox for hostile code.

---

## Hypergraph Converter Studio v7.3.10 - deterministic command authority with optional Ollama

Ollama remains optional local assistance. It is not command authority and cannot bypass deterministic request semantics, required-context checks, validators, previews, confirmation policy, stale-state checks, or runtime outcome reporting.

Compositional Help and explicit non-execution remain local and deterministic:

```text
Explain the steps to run the custom parser. -> read-only Help, no model call
Make no changes; tell me how to clear graph. -> read-only Help, no mutation
Run the custom parser.                      -> confirmation-gated trusted-code run
Use model qwen3:8b.                         -> updates the configured local model name
Stop.                                       -> stops active cancellable work only
```

When Ollama is disconnected, the Help catalog, graph previews, mapping/grouping edits, parser workflow controls, dashboard routing, and manual routes continue to work. A model selection command changes only local settings; it does not download a model or contact a remote service.

Custom Parser executes reviewed/trusted local JavaScript in a disposable Web Worker. Static blocking, reduced globals, constructor hardening, timeout, cancellation, bounded input, pre-serialization output bounding, validation, preview, and confirmation reduce risk, but the worker is not a formal security boundary for hostile code. Review generated or pasted parser code before running it.

## Hypergraph Converter Studio v7.3.7 - deterministic Help works without Ollama

v7.3.7 adds a catalog-driven command Help system. Browsing Help, searching commands, inserting examples, and asking chat Help questions such as `What commands can I use?` or `Which commands require confirmation?` are deterministic offline features. They do not call Ollama, cloud APIs, API keys, a backend, or bundled model weights.

Ollama remains optional local assistance only. It may help with unusual phrasing or mapping/parser guidance after deterministic routing is not confident, but it is not command authority and cannot bypass validation or confirmation.

If local Ollama is disconnected, the deterministic command catalog, graph previews, mapping/grouping edits, parser workflow controls, dashboard routing, and manual dashboard routes continue to work.

## Hypergraph Converter Studio v7.3.6 - deterministic runtime preserved

v7.3.6 does not add a cloud model, API key, backend dependency, hosted model endpoint, or bundled model weights. The conversational assistant remains deterministic and offline for supported routing, graph mutation, parser, mapping, export, and dashboard-control requests. Ollama remains optional local assistance only.

This release focuses on correctness around the graph state that the assistant controls:

- graph mutation IDs are normalized before plans are staged;
- batch updates must be previewed/committed/discarded explicitly;
- graph edits are blocked while a batch preview overlay is active;
- V2V projection, statistics, and Dijkstra shortest-path weights use shared semantics.

If local Ollama is disconnected, deterministic controls and manual dashboard routes continue to work.

## Hypergraph Converter Studio v7.3.5 - deterministic graph dispatch and read-only question safety

v7.3.5 keeps Ollama optional. A current high-confidence precompiled graph plan is forwarded intact, validated, previewed, and staged for confirmation without a model call or second graph compilation. Medium-confidence domain language may still use one typed local-model planner when connected.

Read-only speech acts cannot trigger state-changing handlers:

```text
informational question -> grounded response
hypothetical question -> grounded response
reported command -> grounded response
quoted command -> grounded response
polite request -> typed action after deterministic validation
```

Completed runtime traces report observed model calls, graph recompilation, legacy parser calls, raw dashboard classification, validators, confirmation staging, and commits. A generation task failure still does not imply the local endpoint is disconnected.

## Hypergraph Converter Studio v7.3.4 - deterministic runtime first, Ollama optional

v7.3.4 keeps Ollama optional and secondary. The actual chat runtime now calls `compileDeterministicTurn(...)` in `App.jsx`, which performs one NLU analysis and one `compileDeterministicAction(...)` call with verified app state. High-confidence supported requests dispatch their typed result directly through existing validators and confirmation boundaries.

Observed runtime diagnostics now distinguish:

```text
analysisCount
compilationCount
authoritativeCompiler
dispatchPath
modelCalls
genericActionPlannerCallCount
legacyRawParserCallCount
rawControlClassifierCallCount
mappingRecompileCount
graphRecompileCount
```

For high-confidence supported deterministic turns, the expected observed counts are:

```text
modelCalls: 0
genericActionPlannerCallCount: 0
legacyRawParserCallCount: 0
rawControlClassifierCallCount: 0
analysisCount: 1
compilationCount: 1
```

Ollama remains available only as a local assist for medium-confidence or unsupported domain-specific language. It cannot execute parser code, bypass graph confirmation, change graph state without validation, or send data to a cloud endpoint.

## Hypergraph Converter Studio v7.3.3 - deterministic first, Ollama optional

v7.3.3 keeps local model assistance optional and secondary. High-confidence supported requests use the shared deterministic NLU layer and one authoritative compiler, then pass through existing typed validators and confirmation boundaries. The local Ollama runtime is not used for these deterministic corpus paths.

The deterministic route reports diagnostics such as:

```text
authoritativeCompiler: dataset_mapping_v1 | graph_mutation_v1 | dashboard_control_v1
legacyParserCalled: false
modelCalled: false
genericActionPlannerCalled: false
```

Use Ollama only as a local assist for genuinely ambiguous or unsupported phrasing. It still cannot execute parser code, bypass graph confirmation, change graph state without validation, or send data to a cloud endpoint.

## Hypergraph Converter Studio v7.3.2 - deterministic NLU with optional Ollama

v7.3.2 keeps the local model optional. The deterministic assistant can now understand routine supported mapping, grouping, parser-workflow, graph-mutation, dashboard, and grounded-question requests offline through `src/agent/deterministicNlu/`.

Preferred routing is:

```text
high-confidence supported request -> deterministic typed action, zero model call
medium-confidence domain request -> targeted clarification or typed local-model planner when connected
low-confidence/open-ended request -> local conversation when connected, deterministic help when offline
```

Ollama still cannot run parser code, replace graph state, bypass graph confirmation, invent files/columns, or execute arbitrary instructions. Model output is only advisory typed JSON and must pass deterministic validators before any state change.

For local-model testing, the recommended runtime remains Ollama with:

```bash
ollama pull qwen3:8b
```

The v7.3.2 regression suite verifies that the primary authorship mapping flow works with no model call:

```text
Authors are the nodes, papers are the groups, and authorships links them.
Use the ID columns and keep papers with no authors.
```

## Hypergraph Converter Studio v7.3.0 — Ollama-only runtime setup

v7.3.0 keeps Ollama optional. The app remains useful offline without a model: profiling, grouping, deterministic mapping drafts, transformation-plan generation, deterministic parser generation, reviewed/trusted parser runs in disposable workers, reconciliation, previews, and confirmed apply all run in the browser.

When Ollama is connected, the local model may provide:

- a non-executable `DatasetInterpretationDraft`;
- a non-executable typed `DatasetMappingPatch`;
- conversational explanation.

The model cannot run parser code, replace the graph, invent unavailable files/columns, or bypass deterministic validation. All v7.3 model tasks use the existing exclusive request coordinator, Stop behavior, timeout handling, and bounded metrics.

This release supports one local model runtime: Ollama.

v7.2.2 keeps Ollama as an optional local assistant only. Conversational graph mutations and Custom Parser mapping corrections are executed by deterministic dashboard code after validation and, for graph-changing actions, explicit confirmation.

Recommended model:

```bash
ollama pull qwen3:8b
```

The app automatically tries:

```text
last successful transport
-> direct Ollama at http://localhost:11434
-> local Ollama bridge at http://127.0.0.1:8787/ollama
-> one consolidated failure result
```

Direct and bridge are internal connection methods to the same Ollama runtime. The user does not choose a model-server implementation.

## Standard launch

Windows:

```bat
run-with-ollama.bat
```

Linux, WSL, or macOS:

```bash
bash run-with-ollama.sh
```

The launcher:

1. locates Ollama,
2. verifies or starts the Ollama server,
3. checks `qwen3:8b`,
4. offers to pull the model if missing,
5. starts the local Ollama bridge,
6. verifies bridge health,
7. installs npm dependencies when needed,
8. starts Vite,
9. prints the dashboard URL, model, direct endpoint, and bridge endpoint.

## Assistant Settings

Expected normal card:

```text
Local model: qwen3:8b
Status: Connected / Connecting / Disconnected / Disabled / Error
Connection: Automatic / Connected via Direct Ollama / Connected via Local Bridge
Generation: Idle / Generating / Stopping / Degraded / Timed out
Selection: current verified graph entity or none
```

Actions:

- Connect
- Reconnect
- Disconnect local assistant
- Open diagnostics
- Is qwen3:8b installed?
- Test graph planner
- Stop active local request

Advanced connection details are read-only and may show direct endpoint, bridge endpoint, active endpoint, timeout, temperature, last successful method, last generation state, and bounded Ollama timing/token metrics.

## v7.2.2 runtime reliability policy

Only one local Ollama request may run at a time. The chat composer uses a synchronous in-flight lock for rapid clicks, and the app also uses a central local-model request coordinator so diagnostics, conversation, graph planning, mapping, parser generation, and summaries cannot overlap.

If a model request is active, later Send clicks and model-backed buttons are rejected immediately with:

```text
The local assistant is already working. Wait for it to finish or press Stop.
```

The typed composer text is retained. v7.2.2 does not silently queue stale graph-edit requests.

Stop behavior:

- streamed conversation and non-streaming structured planner calls share the active abort controller;
- explicit Stop is classified as `request_aborted`;
- explicit Stop does not trigger deterministic graph fallback, repair, pending action creation, or graph mutation;
- timeout is classified separately as `model_generation_timeout`;
- graph-planner timeout may use deterministic fallback, but only through normal preview/confirmation safety.

Task-specific timeout defaults:

| Task | Timeout |
| --- | ---: |
| basic health check | 30 seconds |
| full graph planner total budget | 60 seconds |
| graph planner first attempt target | 45 seconds |
| minimum repair budget | 10 seconds |
| ActionPlan orchestration | 60 seconds |
| conversation | 120 seconds |
| mapping | 120 seconds |
| custom parser generation | 120 seconds |
| optional summarization | 45 seconds |

The planner uses `keep_alive: 10m`, `think: false`, and `num_predict: 768`. Connection health and generation state are separate: a timed-out planner can leave the endpoint connected while the generation state is degraded or timed out.

## Local Runtime Diagnostics

Diagnostics check:

- current page origin, protocol, hostname, and deployment mode
- direct Ollama `/api/tags`
- local bridge `/health`
- bridged Ollama `/ollama/api/tags`
- `qwen3:8b` model presence
- tiny structured `/api/chat` generation with `think: false`
- full graph-planner readiness using a tiny in-memory graph
- prompt/schema sizes and bounded Ollama metrics when available
- last error classification and suggested fix

Isolated probes are read-only. Testing direct or bridge does not change the active connection unless the user clicks Connect/Reconnect.

The full graph-planner readiness test validates a returned `GraphMutationDraft` and never stages or commits a graph mutation. It is separate from the basic connection test because a tiny health response can pass while a full planner request is slow, invalid, stopped, or timed out.

## Local Ollama bridge

Manual bridge start:

```bash
bash run-local-runtime-bridge.sh
```

Windows:

```bat
run-local-runtime-bridge.bat
```

Allowed routes:

```text
GET  /health
GET  /ollama/api/tags
POST /ollama/api/chat
```

The bridge binds to `127.0.0.1` by default, forwards only known Ollama paths, blocks public targets, uses an origin allowlist, supports preflight/CORS, and does not persist request bodies.

To change the deployed GitHub Pages origin, edit `ALLOWED_ORIGINS` in `local-runtime-bridge.js` or set:

```bash
HYPERGRAPH_BRIDGE_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://YOUR_USERNAME.github.io
```

## Direct GitHub Pages to local Ollama

GitHub Pages is static hosting and cannot run Ollama or the bridge. The browser can only connect to a runtime that the user has already started on the same machine or private network.

Checklist:

1. Install Ollama on the same machine that opens the browser.
2. Pull `qwen3:8b`.
3. From that same OS/browser environment, verify:

   ```bash
   curl http://localhost:11434/api/tags
   ```

4. If the browser blocks direct access, configure `OLLAMA_ORIGINS` and restart Ollama.
5. Start `run-with-ollama.sh` or `run-with-ollama.bat`.
6. Open the dashboard and click Connect.
7. Run diagnostics if direct and bridge both fail.

## OLLAMA_ORIGINS examples

Helper examples:

```text
configure-ollama-origins.example.sh
configure-ollama-origins.example.ps1
configure-ollama-origins.example.bat
```

Linux/WSL systemd flow:

```bash
sudo systemctl edit ollama
```

Paste:

```ini
[Service]
Environment="OLLAMA_ORIGINS=https://hypergraphproject.github.io,http://localhost:5173,http://127.0.0.1:5173"
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

Windows flow:

```powershell
[Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', 'https://hypergraphproject.github.io,https://YOUR_USERNAME.github.io,http://localhost:5173,http://127.0.0.1:5173', 'User')
```

Fully quit and restart Ollama after setting the variable.

## WSL vs Windows troubleshooting

If the page is opened in Windows Chrome, test from Windows PowerShell:

```powershell
curl.exe http://localhost:11434/api/tags
curl.exe http://127.0.0.1:8787/health
curl.exe http://127.0.0.1:8787/ollama/api/tags
```

If Windows PowerShell cannot reach Ollama, Windows Chrome usually cannot either. Check whether Ollama is running in Windows or WSL, whether localhost forwarding is enabled, and whether a firewall is blocking the port.

From WSL:

```bash
curl http://localhost:11434/api/tags
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/ollama/api/tags
```

## Troubleshooting sequence

1. Confirm Ollama is running.
2. Confirm `qwen3:8b` is installed.
3. Run `run-with-ollama.sh` or `run-with-ollama.bat`.
4. Click Reconnect.
5. Run Local Runtime Diagnostics.
6. If the deployed page cannot reach direct Ollama, use the local bridge and confirm the bridge origin allowlist includes your page.
7. Run `node scripts/smoke-test-graph-mutation-planner.mjs` only when Ollama and `qwen3:8b` are actually available.

## Always-available model options

GitHub Pages alone cannot provide an always-available model. Options are:

1. a local Ollama runtime on the user's machine,
2. the local Ollama bridge running on the user's machine,
3. a private lab/server runtime over a secure private network,
4. a separately hosted authenticated model service,
5. a future browser-based model mode.

Do not expose a public unauthenticated model endpoint for uploaded-data workflows.

## Validation commands

```bash
node -v
npm -v
npm ci
npm run test
npm run lint
npm run build
npm run build:github
npm audit
npm audit --omit=dev
bash -n setup-ollama-model.sh
bash -n run-with-ollama.sh
bash -n check-local-model-runtime.sh
bash -n run-local-runtime-bridge.sh
bash -n smoke-test-qwen3-8b.sh
node scripts/smoke-test-graph-mutation-planner.mjs
```

## Deterministic authority note

Ollama may produce a strict non-executable `GraphMutationDraft`; deterministic dashboard code still validates the draft, resolves references, creates the existing `GraphMutationPlan`, previews the result, asks confirmation for real graph changes, and commits only after stale-state checks. If Ollama is disconnected, times out, or invalid output is returned after one repair attempt, the offline deterministic graph-mutation fallback remains available. If the user explicitly presses Stop, fallback is not run and no graph change is prepared.

No-op graph edits do not create confirmation cards. Preview-only requests do not stage commits. No cloud APIs, API keys, hosted model endpoint, backend service, bundled model weights, or LangGraph dependency are added.
## Hypergraph Converter Studio v7.3.1 - dataset mapping runtime behavior

v7.3.1 preserves the Ollama-only local assistant design and corrects dataset-mapping routing. For active Custom Parser batches, explicit file/column/role/join instructions go to `plan_dataset_mapping_patch` when Ollama is connected. If the model draft is invalid, times out, or the local assistant is disconnected, the app uses a deterministic typed mapping fallback instead of the generic ActionPlan or route planner.

Runtime connection state and generation state remain separate:

```text
Connection healthy + invalid mapping draft -> connected/degraded
Connection healthy + mapping timeout -> connected/timed_out
Network or bridge unavailable -> disconnected/error
```

The degraded mapping banner is:

```text
QWEN3:8B DEGRADED · DETERMINISTIC MAPPING FALLBACK AVAILABLE
```

No model task can run parser code, replace the graph, invent unavailable files/columns, or bypass deterministic validation.
