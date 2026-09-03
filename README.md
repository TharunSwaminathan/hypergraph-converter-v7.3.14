# Hypergraph Converter Studio v7.3.14

## v7.3.14 packaging, versioning, and clean-extraction release

v7.3.14 is the release-engineering closure of the approved Stage 0–8 implementation. It changes no parser, algorithm, Preview, worker, deterministic NLU, authorization, mapping, or graph semantics. The release uses the repository's authoritative portable-source packager, preserves explicit Unix launcher metadata in the actual ZIP, excludes transient evidence, and is qualified from a fresh extraction with `npm ci`.

The portable archive is deterministic for identical source bytes: member order, timestamps, compression settings, POSIX paths, and Unix mode metadata are normalized by `scripts/package-portable-source.py`. Final archive identity and clean-extraction evidence are recorded outside the package under the Stage 9 artifacts.

See `docs/RELEASE_v7.3.14.md` for the release contract and qualification scope.

---

# Historical notes: Hypergraph Converter Studio v7.3.13

## v7.3.13 independent-diagnostics remediation release

v7.3.13 is a remediation release over the preserved v7.3.12 portable source. It keeps the same deterministic, offline-first architecture: no cloud APIs, API keys, hosted model calls, public model endpoint, bundled model weights, or backend requirement were added.

This release focuses on independent-diagnostics findings that were not exposed by the previously green packaged suite:

- Safety: state-changing requests now require a positively authorized executable clause; read-only, quoted, reported, hypothetical, explanatory, preserve-state, and no-action scopes do not inherit execution from embedded command text.
- Pending-state integrity: pending graph replacement requires executable semantics, explicit pending-target language, and a typed correction; read-only pending wrappers preserve the staged plan.
- Resource bounds: expensive H2H/V2V projections, dense matrix export, and projection-backed exports are requested only by the specific selected view/export and enforce documented row/cell/byte budgets.
- Parser validation: identifiers, times, finite weights, malformed CSV quoting, malformed incidence rows, and malformed H2V/V2H/H2H rows now fail with explicit errors instead of being silently coerced.
- Custom Parser guard: static checks are AST/scope-aware through `acorn`, so harmless local bindings/properties are allowed while actual host-runtime, dynamic-code, network, and prototype-escape access remains blocked.
- Bridge/runtime robustness: the local Ollama bridge streams responses, handles timeouts/client disconnects/upstream failures/capped responses without crashing, and still avoids prompt-body logging.
- Uploads: detection uses bounded file slices, full reads use cancellable stream/FileReader paths, and aborted uploads return no partial batch for commit.
- Runtime settings: successful no-op local-model configuration changes no longer report a committed mutation.
- Component assurance: v7.3.13 adds a real DOM lifecycle test for `AgentChatPanel` pending actions, Help/Stop while pending, confirm/cancel, pending correction, and local model settings traces.

See:

- `docs/RELEASE_v7.3.13.md`
- `artifacts/v7.3.13-remediation-plan.md`
- `artifacts/v7.3.13-issue-resolution-register.json`
- `artifacts/v7.3.13-test-summary.md`

---

# Historical notes: Hypergraph Converter Studio v7.3.12

## v7.3.12 comprehensive remediation and validation release

v7.3.12 is a remediation release over the preserved v7.3.11 UI-update source. It keeps Hypergraph Converter Studio deterministic and offline-first: no cloud APIs, API keys, backend dependency, bundled model weights, public model endpoint, or automatic remote model call was added.

This release focuses on:

- Safety: a whole-request execution semantic result plus a final side-effect authorization gate prevents explanation, syntax, quotation, code-example, reported, hypothetical, no-execution, and preserve-state phrasing from mutating graph, mapping, grouping, parser, batch, runtime, navigation, confirmation, or download state.
- Pending-state integrity: read-only Help/questions while an action is pending preserve the staged operation; graph replacement requires an executable, strongly typed pending correction.
- Scalability: H2H, V2V, clique export, and triad analysis use structured computed / not-requested / over-budget status rather than silently materializing large projections or displaying omitted work as zero.
- Projection semantics: over-budget V2V is reported as unavailable, not as `0 edges`; header-only clique exports are refused with an explanation.
- Parser integrity: JSON and sparse CSR/CSC metadata are validated before normalization, malformed membership arrays are rejected, and `weight: 0` is preserved.
- Custom Parser: trusted local parser code keeps defense-in-depth checks, but harmless fields such as `row.location`, strings, and comments are no longer blocked by raw substring matching; shared acyclic output objects are allowed while true cycles are rejected.
- Runtime bridge: the local Ollama bridge validates numeric limits, returns deterministic 413 for oversized requests, caps upstream responses, and aborts timed-out/disconnected upstream work without logging prompt bodies.
- Uploads: file-count, single-file, aggregate-size, and read-concurrency limits are enforced before full text reads.
- Accessibility: the Advanced Options / Algorithms / Hypergraph Assistant tool switcher now uses accessible tab semantics while preserving mounted state.
- Testing: v7.3.12 adds a 4,920-case independent read-only safety corpus, a 20-case pending preservation corpus, parser/resource/upload/bridge regression tests, and release artifacts.

Resource-heavy projections now fail closed with an explanation. For example, a V2V projection whose estimated pair count exceeds the configured safety limit is shown as "not computed / over budget" and is not exported as a misleading empty CSV.

Custom Parser remains reviewed/trusted local JavaScript run in a disposable worker with static blocking, reduced globals, timeout, cancellation, and output limits. It is not claimed to be a hostile-code sandbox.

See:

- `docs/RELEASE_v7.3.12.md`
- `artifacts/v7.3.12-remediation-plan.md`
- `artifacts/v7.3.12-issue-resolution-register.json`
- `artifacts/v7.3.12-test-summary.md`

---

# Historical notes: Hypergraph Converter Studio v7.3.10

## v7.3.10 compositional Help-intent safety and end-to-end state preservation

v7.3.10 repairs the remaining v7.3.9 safety and runtime-control defects while preserving the deterministic, offline-first architecture. No cloud API, hosted model, backend service, API key, bundled model weight, or automatic remote model call was added.

The release invariant is now compositional rather than a small prefix list:

```text
Any request for explanation, instructions, steps, syntax, procedure,
documentation, a walkthrough, a button/menu location, an example,
or explicit non-execution is read-only even when it contains a valid action.
```

Examples:

```text
I was wondering how to add vertex 6 to h2.     -> read-only Help
Could you tell me what to type to apply it?    -> read-only Help
Make no changes; explain how to clear graph.   -> read-only Help
This is an example command: "Cancel action."   -> read-only Help
Add vertex 6 to h2.                            -> preview + confirmation
Cancel pending action.                         -> direct pending control
Stop.                                          -> direct runtime control only when cancellable work exists
```

Main repairs:

- added shared compositional request semantics for instructional, explicit read-only, reported, quoted, hypothetical, negated, and correction scope;
- added a final side-effect authorization gate so read-only speech cannot compile into mapping, grouping, parser, graph, batch, runtime, or pending-control mutation;
- routed pending Help/confirm/cancel through one pure pending-state router before broad conversation handling;
- replaced the shared request-in-flight Boolean with owner-ID coordination so concurrent Help or Stop cannot clear another request lifecycle;
- made registry required-context and handler metadata enforceable at dispatch time;
- bound selection-relative confirmations to the selected entity and reject them when selection changes;
- implemented numbered batch commands without recursive chat submission and made missing parameters fail safely with clarification;
- made `Use model <model name>` update the local model setting through the existing settings action;
- made execution traces depend on explicit handler outcomes rather than assuming every handled action committed state;
- centralized confirmation policy and action lexicons;
- bounded and cloned custom-parser output before worker serialization;
- reclassified Custom Parser honestly as reviewed/trusted local code in a disposable worker with defense-in-depth checks, timeout, output limits, and explicit confirmation—not a hostile-code security boundary;
- repaired duplicate file input wiring, ARIA tab semantics, Help disclosure state synchronization, and compressed planner formatting.

Release gates include the complete existing suite plus 6,560 compositional instructional requests and 3,280 explicit non-execution requests with zero state-changing compilations.

See:

- `docs/RELEASE_v7.3.10.md`
- `docs/V7_3_10_TEST_REPORT.md`
- `docs/COMPOSITIONAL_HELP_INTENT_SAFETY.md`
- `docs/PENDING_STATE_HELP_SAFETY.md`
- `docs/ACTION_REGISTRY_AUTHORITY.md`
- `docs/COMMAND_CATALOG_PARAMETERIZED_ACTIONS.md`
- `docs/CUSTOM_PARSER_CONVERSATION.md`
- `docs/DETERMINISTIC_COMMAND_REFERENCE.md`

## v7.3.8 deterministic Help safety and complete command inventory

v7.3.8 is a focused safety and completeness pass over the v7.3.7 deterministic Help catalog. It keeps the assistant offline-first and deterministic: no cloud APIs, hosted model calls, backend service, API keys, bundled model weights, or automatic remote model calls were added.

The key safety boundary is now explicit:

```text
Help-seeking / explanatory / hypothetical wording
-> deterministic Help query
-> catalog lookup
-> read-only response
-> no state mutation, no confirmation staging, no model call
```

Direct action wording remains actionable:

```text
How do I clear the active batch?  -> read-only Help
Could you clear the active batch? -> direct legacy action intent
Clear the active batch            -> direct legacy action intent
```

Key changes:

- added an authoritative legacy action intent registry for file/batch controls, mapping validation/repair, local runtime controls, exports/navigation, pending confirmation controls, runtime stop, and correction commands;
- expanded the catalog from the v7.3.7 command set to include public legacy deterministic commands while keeping internal-only intents out of executable Help entries;
- guarded Help-seeking phrases such as `How do I clear...`, `How do I connect...`, and `How do I validate...` so they cannot execute graph, batch, parser, mapping, runtime, or pending-confirmation handlers;
- split correction, runtime stop, pending cancel, pending confirm, parser apply, and graph undo into separate documented/tested entries instead of treating them as one grouped control surface;
- fixed panel-only algorithm Help filtering so algorithm responses list only panel-only algorithm entries;
- reconciled quoted graph-identifier diagnostics so `"a vertex 6"` is reported and compiled as the same literal vertex ID;
- added Help deep links and related-command navigation using `#help/<command-id>` and `#help/category/<category-id>`;
- preserved the v7.3.7 verified examples and expanded executable catalog verification to 179 examples.

See:

- `docs/DETERMINISTIC_COMMAND_REFERENCE.md`
- `docs/DETERMINISTIC_HELP_ARCHITECTURE.md`
- `docs/DETERMINISTIC_ACTION_INTENT_INVENTORY.md`
- `docs/DETERMINISTIC_HELP_SAFETY_BOUNDARY.md`
- `docs/COMMAND_CATALOG_MIGRATION_V7_3_8.md`
- `docs/V7_3_8_IMPLEMENTATION.md`
- `docs/V7_3_8_TEST_REPORT.md`

## v7.3.7 deterministic command catalog, searchable Help, and executable documentation

v7.3.7 turns the assistant Help area into a catalog-backed command reference for the deterministic offline chatbot. The catalog documents what the chatbot can actually compile and dispatch, what remains panel-only, which commands require graph/parser confirmation, which requests are read-only questions, and how quoted identifiers are handled.

The new Help system is still offline-first: it performs local search over a serializable catalog, generates chat Help responses from that same catalog, and never calls Ollama or any external service for ordinary command help. Try buttons insert examples into the chat composer only; they do not auto-send or mutate graph/mapping state.

Key changes:

- added `src/agent/deterministicNlu/commandCatalog.js` plus schema, search, formatter, and generated-reference support;
- replaced the FAQ-only Help tab with searchable/filterable command cards and catalog-derived Quick Start suggestions;
- added deterministic Help queries such as `What commands can I use?`, `How do I add a vertex to a hyperedge?`, and `Which commands require confirmation?`;
- verified every advertised chat example through `analyzeDeterministicNlu -> compileDeterministicAction` and integrated dispatcher tests;
- labeled algorithms honestly as panel-only where the deterministic chat controller does not execute them;
- repaired adjacent phrase coverage for multi-vertex graph edits, quoted/named graph edits, dataset grouping, and parser negation examples exposed by catalog verification.

See:

- `docs/DETERMINISTIC_COMMAND_REFERENCE.md`
- `docs/DETERMINISTIC_HELP_ARCHITECTURE.md`
- `docs/V7_3_7_IMPLEMENTATION.md`
- `docs/V7_3_7_TEST_REPORT.md`

## v7.3.6 merged algorithms, graph-mutation correctness, visualization, and batch-state remediation

v7.3.6 is a release-quality correction pass over the merged v7 line. It preserves the deterministic offline assistant, local-only Ollama assist, DatasetMappingSpec workflow, trusted-code Custom Parser worker, upload batches, exports, visualization, and algorithm registry while tightening correctness around graph mutation, projection statistics, batch updates, and offline packaging.

Key changes:

- shared deterministic graph identifier normalization so unquoted natural-language wrappers such as `a vertex 6` and `vertices 8 and 9` do not become literal graph IDs;
- quoted graph IDs remain literal, so `"a vertex 6"` is preserved when the user intentionally quotes it;
- batch updates now have explicit Preview, Commit, and Discard controls, and conversational graph edits are blocked while a batch preview is active;
- V2V projection weight semantics are centralized in `src/algorithms/projection.js`;
- statistics now distinguish incidence density from V2V projection density;
- singleton hyperedges are reported as singleton hyperedges, not graph self-loops;
- K-core results are labeled as exact coreness/k-shell groups;
- Dijkstra accepts zero-weight edges and reports missing, negative, or invalid weights before using the safe default cost;
- Google Fonts network dependencies were removed in favor of system font fallbacks.

See:

- `docs/V7_3_6_IMPLEMENTATION.md`
- `docs/V7_3_6_TEST_REPORT.md`
- `docs/GRAPH_IDENTIFIER_NORMALIZATION.md`
- `docs/BATCH_PREVIEW_COMMIT_SEMANTICS.md`
- `docs/PROJECTION_AND_STATISTICS_SEMANTICS.md`
- `docs/ALGORITHM_CORRECTNESS_NOTES.md`

## v7.3.5 graph dispatch, corpus authenticity, and question-safety remediation

v7.3.5 repairs the remaining v7.3.4 graph forwarding, runtime-trace, corpus-authenticity, and read-only question defects.

```text
one user message
-> one deterministic NLU analysis
-> one authoritative compilation
-> speech-act and side-effect safety gate
-> canonical typed dispatch
-> existing validator / preview / confirmation
-> completed observed runtime trace
```

High-confidence precompiled graph plans now reach `App.prepareGraphMutationForAgent(...)` intact and bypass Ollama and graph recompilation. Informational questions, hypotheticals, reported commands, and quoted commands are converted to read-only grounded responses before any mapping, graph, parser-run, or apply handler can execute. Polite action requests remain actionable.

The held-out evaluation uses 840 static reviewed fixtures, 315 semantic families, 756 substantive skeletons, and 796 clause skeletons. Opaque synthetic suffixes are rejected. Compiler and integrated routing reports are separated, and forbidden-call injection tests verify that zero model/ActionPlan/legacy/raw-classifier rates are observable rather than hard-coded.

See:

- `docs/V7_3_5_IMPLEMENTATION.md`
- `docs/V7_3_5_TEST_REPORT.md`
- `docs/DETERMINISTIC_NLU_SPEECH_ACTS.md`
- `docs/DETERMINISTIC_NLU_SIDE_EFFECT_POLICY.md`
- `docs/DETERMINISTIC_NLU_CORPUS_AUTHENTICITY.md`
- `docs/DETERMINISTIC_NLU_PRODUCTION_HANDLER_TESTING.md`
- `docs/DETERMINISTIC_RUNTIME_TRACE_LIFECYCLE.md`

## v7.3.4 deterministic NLU runtime integration and corpus completion

v7.3.4 makes the deterministic NLU compiler the normal browser runtime path, not just a compiler-quality test helper.

```text
one user turn
-> one deterministic NLU analysis
-> one authoritative domain compilation
-> semantic confidence decision
-> canonical typed dispatch
-> existing validator / preview / confirmation / safe execution
```

High-confidence supported dataset-mapping, graph-mutation, parser-workflow, dashboard-control, and grounded-question turns run with zero model calls, zero generic ActionPlan calls, zero legacy raw-parser calls, and no duplicate graph/mapping compilation. Medium-confidence domain-specific requests can still clarify or use the optional local Ollama typed planner when appropriate.

Important correction from v7.3.3: the prior 46-fixture corpus and compiler diagnostics were useful regressions, but they were not observed integrated runtime-call measurements. v7.3.4 separates compiler evaluation from integrated routing evaluation, reports truthful numerator/denominator metrics, and replaces the held-out set with 840 checked-in static fixtures plus the 46 core regressions.

See:

- `docs/V7_3_4_IMPLEMENTATION.md`
- `docs/V7_3_4_TEST_REPORT.md`
- `docs/DETERMINISTIC_NLU_RUNTIME_DISPATCH.md`
- `docs/DETERMINISTIC_NLU_INTEGRATED_METRICS.md`
- `docs/DETERMINISTIC_NLU_CORPUS_COMPLETION.md`
- `docs/CANONICAL_DASHBOARD_DISPATCH.md`
- `docs/DETERMINISTIC_FIRST_GRAPH_ROUTING.md`

## v7.3.3 deterministic NLU consolidation and corpus hardening

v7.3.3 consolidates the offline conversational assistant around one authoritative compiler per supported deterministic domain. The intended runtime path is:

```text
user message
-> shared deterministic NLU
-> one authoritative compiler
-> typed action/draft
-> existing validator
-> existing preview/confirmation/safe execution path
```

This release keeps the assistant deterministic and offline for routine supported requests. It does not add cloud APIs, hosted model calls, API keys, LangGraph, a backend service, or bundled model weights. Ollama remains optional local assistance only for unsupported or ambiguous language.

Key v7.3.3 changes:

- replaces repeated-template held-out claims with a checked-in static semantic corpus of 46 unique utterances across 37 families;
- routes dataset mapping through `dataset_mapping_v1` typed patches without a second legacy raw-text parser;
- routes graph mutation through `graph_mutation_v1` typed plans before the existing preview/confirmation validator;
- routes dashboard/control requests through canonical `DashboardControlIntent` values rather than raw-text delegation;
- keeps compatibility wrappers non-authoritative and reports `legacyParserCalled: false` for deterministic runtime paths;
- writes `artifacts/deterministic-nlu-quality-report.json` during quality tests, but portable packaging excludes generated artifacts.

See:

- `docs/V7_3_3_IMPLEMENTATION.md`
- `docs/V7_3_3_TEST_REPORT.md`
- `docs/DETERMINISTIC_NLU_AUTHORITATIVE_COMPILERS.md`
- `docs/DETERMINISTIC_NLU_CORPUS_GUIDE.md`
- `docs/DETERMINISTIC_NLU_QUALITY_METRICS.md`
- `docs/LEGACY_PARSER_MIGRATION.md`

## v7.3.2 deterministic conversational NLU workflow expansion

v7.3.2 expands the assistant's offline deterministic language layer for routine dataset grouping, dataset mapping, parser workflow, graph mutation, dashboard routing, and grounded status/explanation questions.

The new path is:

```text
user message
-> quote-aware normalization
-> tokenization
-> clause parsing
-> domain and intent scoring
-> verified entity/value extraction
-> negation, correction, and reference handling
-> confidence/ambiguity analysis
-> existing typed draft/action structures
-> existing validators and confirmation boundaries
-> grounded response from verified results
```

This is not a cloud chatbot and does not add a backend, API keys, LangGraph, bundled model weights, or remote model calls. Routine high-confidence supported requests run without Ollama. Ollama remains an optional local enhancement for unusual or ambiguous language, and its output remains non-executable until deterministic validators accept it.

Supported deterministic domains include:

- dataset grouping, such as "the first two CSVs belong together" and validation-only files;
- dataset mapping, including conversational file roles, keys, joins, empty-hyperedge policy, metadata columns, and corrections;
- parser workflow, including transformation-plan generation, parser generation, status, and confirmation-required parser runs;
- graph mutation paraphrases, routed through the existing graph mutation preview and confirmation pipeline;
- dashboard/control routing for stats, visualizations, exports, routes, and runtime diagnostics;
- grounded questions such as "why did you interpret it that way?" using concise interpretation traces.

The primary offline authorship flow now works conversationally:

```text
Authors are the nodes, papers are the groups, and authorships links them.
Use the ID columns and keep papers with no authors.
```

Expected result: one validated mapping revision, an inspectable deterministic trace, no model call, no parser run, and no graph change.

See:

- `docs/DETERMINISTIC_CONVERSATIONAL_NLU.md`
- `docs/DETERMINISTIC_NLU_LEXICON.md`
- `docs/DETERMINISTIC_NLU_REFERENCE_RESOLUTION.md`
- `docs/DETERMINISTIC_NLU_RESPONSE_COMPOSER.md`
- `docs/V7_3_2_IMPLEMENTATION.md`
- `docs/V7_3_2_TEST_REPORT.md`

## v7.3.1 dataset mapping routing remediation

v7.3.1 fixes the conversational routing gap in the v7.3 multi-file Custom Parser workflow. When an active Custom Parser batch exists, explicit dataset-mapping language is intercepted before generic dashboard ActionPlan routing. The corrected flow is:

```text
mapping request
-> mapping intent
-> ensure DatasetMappingSpec v2
-> local model typed patch or deterministic typed fallback
-> deterministic validation
-> mapping diff/revision
-> stale plan/parser invalidation
```

The assistant can now bootstrap a valid `DatasetMappingSpec` v2 from deterministic profile/grouping evidence when the user has not clicked “Generate mapping” yet. Connected Ollama may return only a typed `DatasetMappingPatch`; invalid, timed-out, disconnected, or disabled local-model paths use the deterministic typed mapping fallback for supported explicit language. The fallback still validates exact active filenames, exact profiled columns, joins, file roles, and policies before changing the mapping.

This release preserves the active Custom Parser route and parse mode unless a validated mapping patch explicitly changes parse mode. Mapping turns do not run parser code, do not apply graph state, do not call cloud APIs, and do not route valid mapping requests through the generic ActionPlan planner.

The primary fixed transcript is:

```text
Set authors.csv as the vertex table using author_id.
Set papers.csv as the hyperedge table using paper_id.
Set authorships.csv as the membership table, joining author_id to authors.csv and paper_id to papers.csv.
Use papers.csv year as hyperedge time.
Preserve papers with no membership rows as empty hyperedges.
```

Expected result: one validated mapping revision, deterministic diff, stale transformation plan/parser state, and unchanged graph.

## v7.3.0 conversational multi-file Custom Parser workflow

v7.3.0 adds a mapping-first workflow for unfamiliar single-file and multi-file datasets:

```text
profile -> group -> map -> clarify -> plan -> generate -> run -> reconcile -> preview -> apply
```

The workflow is deterministic and offline-first. A local Ollama model may help interpret dataset meaning or suggest typed mapping patches, but model output is never executable authority. Files and columns are verified against bounded deterministic profiles; mapping patches are schema-validated; parser code is generated from a validated `DatasetMappingSpec` v2 and deterministic `TransformationPlan`; parser execution stays inside the existing trusted-code disposable Web Worker; and graph replacement still requires a separate confirmation.

Key v7.3 additions:

- bounded dataset profiles with delimiter, header, column, candidate-key, list-column, and exact/sampled evidence;
- cross-file relationship evidence for likely joins;
- logical dataset groups, including static graph, validation-only, update-stream, ignored, and unknown roles;
- `DatasetMappingSpec` v2 with groups, entities, relationships, filters, policies, revision metadata, and v1 migration;
- typed mapping patches with revision history and undo;
- deterministic transformation-plan and parser-code compilation;
- parser reconciliation before graph apply;
- parser profile schema v3 with structural header/relationship matching.

Update streams are recognized but not executed in v7.3.0. Use the existing Batch Updates route for dynamic updates.

Conversational runtime reliability remediation release.

This portable source package keeps the v7 conversational Hypergraph Assistant, deterministic dashboard controller, mapping workflow, trusted-code parser worker, algorithm panels, exports, and GitHub Pages/local-runtime diagnostics. The local model layer is now intentionally simple:

- one local runtime: Ollama
- one recommended model: `qwen3:8b`
- one normal user action: Connect / Reconnect
- two automatic internal transports: direct Ollama, then the local Ollama bridge
- no cloud model calls, API keys, bundled model weights, or hosted model endpoint

The deterministic controller remains authoritative. Ollama may help with natural-language understanding, mapping drafts, parser guidance, and conversation, but graph-changing actions still go through deterministic validation and confirmation.

## v7.2.2 conversational runtime reliability remediation

v7.2.2 hardens the v7.2.1 conversational planner for one local Ollama runtime. The assistant now accepts at most one local-model request at a time, uses an immediate synchronous submission lock in the chat composer, shows Stop for streamed and structured model calls, separates endpoint connection from current generation state, captures bounded Ollama timing/token metrics, and keeps graph edits inside the deterministic preview/confirmation pipeline.

The graph-mutation planner uses a compact prompt and compact structured response schema. The schema is still attached to Ollama through the `format` field, but it is not duplicated in prompt text. Current measured budgets are:

- typical planner prompt: 2,370 characters
- bounded maximum planner prompt: 9,106 characters
- serialized response schema: 2,981 characters
- repair prompt addition: 1,265 characters
- planner output cap: 768 tokens
- total graph-planner deadline: 60 seconds

Timeouts and explicit Stop are deliberately different. A planner timeout may use the deterministic fallback and still requires the normal preview/confirmation flow. A user-clicked Stop does not run repair or fallback and does not stage a graph change.

## v7.2.1 conversational planner remediation

v7.2.1 corrects the graph-mutation flow so connected Ollama is used as a semantic planner before the regex fallback. The model returns a strict, non-executable `GraphMutationDraft`; the app validates that draft, resolves all entity references deterministically against the current graph, creates the existing `GraphMutationPlan`, previews the effect, and asks for confirmation only when graph content would actually change.

The regex interpreter is still present for offline use and model-failure fallback. It also now handles trailing conversational modifiers such as `again`, `too`, `as well`, `please`, and `now` without globally deleting those words from legitimate quoted IDs.

Important behavior:

- Duplicate/no-op mutations, such as adding a vertex that is already in a hyperedge, respond immediately without a confirmation card.
- Preview-only requests show deterministic impact and do not stage a commit.
- A pending graph mutation can be revised conversationally; the earlier pending plan is discarded and a new confirmation token is created for the revised plan.
- Real graph changes still require confirmation and stale graph/version/fingerprint checks.
- No cloud APIs, API keys, hosted model endpoint, backend service, bundled model weights, or LangGraph dependency were added.

## v7.2 conversational graph mutation

v7.2 adds a deterministic offline graph-mutation layer above the existing dashboard. The assistant can stage small graph edits such as:

- `add Charlie to h0`
- `create hyperedge h9 with A, B, C`
- `rename vertex Alice to Alicia`
- `set weight of h1 to 2.5`
- `remove Bob from h2`
- `clear current graph`
- `undo last mutation`

Every graph-changing request is converted into a local mutation plan, validated against the current graph ID/version/fingerprint, previewed, and shown in a confirmation card before execution. If the graph, selected entity, parser result, mapping revision, or plan hash changes before confirmation, the action is rejected as stale.

The canonical graph is still `hes` with normalized hyperedges `{ id, vertices, time, weight, attributes }`. There is no standalone vertex table, so “add a vertex” requires a target hyperedge.

Route switches, text edits, export-preview selection, visualization layout changes, and batch-preview toggles do not increment `graphVersion`; only committed canonical graph content changes do.

## v7.2 Custom Parser conversation and profiles

Custom Parser remains mapping-first:

```text
upload files -> mapping spec -> repair/validate -> generate parser -> run parser -> confirm apply
```

The assistant can apply deterministic mapping guidance such as “authors are vertices,” “papers are hyperedges,” “year is time metadata,” or “expected output is validation.” These edits update the active `DatasetMappingSpec` and re-run existing repair/validation; they do not modify the graph directly.

Custom Parser Studio also includes local parser profiles. Profiles save parser code plus mapping/file signatures in browser local storage for reuse with similar file batches. They are local-only and exportable as JSON.

The parser Web Worker now has additional deterministic safeguards: blocked network/DOM/storage APIs, sanitized file objects, input/output limits, bounded logs, serializable-output checks, timeout, and cancellation support.

## Quick start

Install Ollama separately, then pull the recommended model:

```bash
ollama pull qwen3:8b
```

Start the dashboard and local bridge:

```bash
bash run-with-ollama.sh
```

On Windows:

```bat
run-with-ollama.bat
```

The launcher verifies Ollama, checks `qwen3:8b`, starts the local Ollama bridge, installs dashboard dependencies when needed, and starts Vite at:

```text
http://localhost:5173
```

Then open Assistant Settings and click Connect. The app tries the last successful transport first, then direct Ollama, then the local bridge, and reports one connected or failed state.

## Windows batch run files

Double-click `run-dev.bat` to start the development server.
Double-click `run-build.bat` to build the app.
Double-click `run-preview.bat` to build and preview the production version.
Double-click `clean-install.bat` to fully reinstall dependencies and rebuild.

WSL/Linux users can continue using the `.sh` scripts.

## Local assistant behavior

Assistant Settings shows:

- Local model: `qwen3:8b`
- Status: connected, connecting, disconnected, disabled, or error
- Connection: Automatic, Connected via Direct Ollama, or Connected via Local Bridge
- Generation: idle, generating, stopping, degraded, or timed out
- Last task, elapsed timing, fallback use, and bounded Ollama metrics when available
- Selection: current verified graph selection or none

Normal users do not select a model server, edit a base URL, or choose direct versus bridge. Direct and bridge are connection methods to the same local Ollama runtime.

Useful assistant commands:

- `Connect local assistant`
- `Reconnect`
- `Disconnect local assistant`
- `Run local model diagnostics`
- `Is qwen3:8b installed?`
- `Show connection details`
- `Use H2V route`
- `Generate mapping spec`
- `Generate parser from repaired mapping`

If Ollama is unavailable, deterministic dashboard commands still work.

## Local Runtime Diagnostics

The diagnostics panel checks:

- browser origin, protocol, hostname, and deployment mode
- direct Ollama reachability
- local bridge health
- bridged Ollama reachability
- selected model presence
- tiny structured `/api/chat` generation
- full graph-planner readiness test
- last error classification and suggested fix

Isolated direct/bridge probes are read-only. A failed probe does not disconnect an already healthy active session. The graph-planner readiness test uses a tiny in-memory graph, validates the returned `GraphMutationDraft`, reports prompt/schema sizes and metrics, and never stages or commits a graph mutation.

## Local Ollama bridge

`local-runtime-bridge.js` is an optional local helper started by `run-with-ollama` or manually with:

```bash
bash run-local-runtime-bridge.sh
```

Windows:

```bat
run-local-runtime-bridge.bat
```

It binds to `127.0.0.1:8787` by default and forwards only:

```text
GET  /health
GET  /ollama/api/tags
POST /ollama/api/chat
```

It is not a general proxy. It allowlists origins, blocks public targets, forwards request bodies in memory only, and does not log full prompts or uploaded file previews.

## GitHub Pages + local Ollama

GitHub Pages hosts only the static dashboard. It cannot start Ollama, run Node helpers, or keep a model always available.

Correct architecture:

```text
GitHub Pages static dashboard
  -> browser fetch from the user's machine
  -> local Ollama or local Ollama bridge
  -> downloaded local model managed by Ollama
```

Checklist for a deployed GitHub Pages page:

1. Install Ollama on the same machine that opens the browser.
2. Pull `qwen3:8b`.
3. Verify `curl http://localhost:11434/api/tags` from the same OS/browser environment.
4. If direct browser access is blocked, configure `OLLAMA_ORIGINS` for the deployed URL and restart Ollama.
5. Start the project with `run-with-ollama.sh` or `run-with-ollama.bat` so the bridge is available.
6. Open the dashboard and click Connect.
7. Run Local Runtime Diagnostics if both direct and bridge attempts fail.

For repository-base GitHub Pages builds:

```bash
VITE_BASE_PATH=/hypergraph-converter/ npm run build
```

or:

```bash
npm run build:github
```

## Can the model be always available from GitHub Pages?

Not from GitHub Pages alone. Static hosting cannot run local executables or model weights. To make a model always available you need one of:

1. a local Ollama runtime on the user's machine,
2. the local Ollama bridge running on the user's machine,
3. a private lab/server runtime reachable over a secure private network,
4. a separately hosted authenticated model service,
5. a future browser-based model mode.

A public unauthenticated model endpoint is unsafe because uploaded file previews may be sent to it and anyone could use the server. This release does not implement a public hosted model endpoint.

## Security and privacy

- uploaded previews are bounded before model use
- full uploaded files are not sent to diagnostics
- remote/public endpoints are blocked by default
- no API keys are stored
- no cloud fallback exists
- the local bridge allowlist prevents arbitrary proxying
- model-generated plans are schema-validated and then semantically checked before any deterministic dashboard action is dispatched

## Development commands

```bash
npm ci
npm run test
npm run lint
npm run build
npm run build:github
npm audit
npm audit --omit=dev
```

Runtime helper checks:

```bash
bash check-local-model-runtime.sh
bash smoke-test-qwen3-8b.sh
node scripts/smoke-test-graph-mutation-planner.mjs
```

Windows:

```powershell
.\check-local-model-runtime.ps1
.\smoke-test-qwen3-8b.ps1
```

## Source packaging

Create the portable source ZIP:

```bash
python scripts/package-portable-source.py
```

The ZIP excludes `node_modules`, `dist`, caches, `__MACOSX`, and `.DS_Store`, and preserves a single project root.

See [MODEL_SETUP.md](MODEL_SETUP.md) for detailed Ollama, bridge, GitHub Pages, and WSL/Windows troubleshooting.

Additional v7.2 design notes:

- [Graph Mutation Architecture](docs/GRAPH_MUTATION_ARCHITECTURE.md)
- [Graph Mutation Schema](docs/GRAPH_MUTATION_SCHEMA.md)
- [Conversational Mutation Planner](docs/CONVERSATIONAL_MUTATION_PLANNER.md)
- [Local Model Runtime Reliability](docs/LOCAL_MODEL_RUNTIME_RELIABILITY.md)
- [v7.2.2 Remediation Notes](docs/V7_2_2_REMEDIATION.md)
- [v7.2.2 Test Report](docs/V7_2_2_TEST_REPORT.md)
- [Custom Parser Conversation](docs/CUSTOM_PARSER_CONVERSATION.md)
- [Parser Profile Schema](docs/PARSER_PROFILE_SCHEMA.md)
- [v7.2 Migration Notes](docs/V7_2_MIGRATION.md)
- [v7.2 Known Limitations](docs/V7_2_KNOWN_LIMITATIONS.md)
- [v7.2 Test Report](docs/V7_2_TEST_REPORT.md)
