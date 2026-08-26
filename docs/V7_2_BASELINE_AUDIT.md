# v7.2.0 Baseline audit

This audit was written before product-code edits for the v7.2.0 conversational graph mutation and mapping-first custom parser expansion.

## Baseline archive

- Source ZIP: `hypergraph-converter-v7-final-ollama-only-assistant-portable.zip`
- Expected SHA-256: `4E3BFB16D469FF26D949E1020CACB216B7F975B97E438AFFEA77AA6F95D15B2D`
- Actual SHA-256: `4E3BFB16D469FF26D949E1020CACB216B7F975B97E438AFFEA77AA6F95D15B2D`
- Expected extracted root: `hypergraph-converter-v7-final-ollama-only-assistant`
- New working root: `hypergraph-converter-v7-conversational-graph-mutation-custom-parser`
- Baseline package name: `hypergraph-converter-v7-final-ollama-only-assistant`
- Baseline package version: `7.1.1`
- Source file inventory count before dependency install: `104`

## Tooling

- Shell `node` and `npm` were not on PATH.
- Bundled Node used for validation: `v24.14.0`
- Cached npm CLI used for install/run/audit: `11.4.2`
- `npm ci`: passed, `added 166 packages in 13s`.
- `npm test`: local cached npm package is incomplete and lacks `lib/commands/test.js`; this is a local npm-cache tooling issue.
- `npm run test` with bundled Node on PATH: passed.
- `npm run lint`: passed.
- `npm run build`: passed with the existing Vite chunk-size warning.
- `npm audit --omit=dev`: passed after registry access approval, `found 0 vulnerabilities`.
- Direct `node tests/agent-local-model.test.mjs`: passed.
- Direct `node tests/intent-heldout.test.mjs`: passed.

Baseline direct test output:

```text
settings migration: 10/10
automatic connection fallback: 10/10
client payloads: 5/5
UI assertions: 13/13
diagnostic isolation: 9/9
bridge allowlist: 6/6
conversation/action regressions: 10/10
script/source assertions: 24/24
Ollama-only local model tests passed.
Held-out matrix: 1320/1320
Combined minimum with held-out: 8580/8580
Held-out negative non-conversion cases: 5/5
Held-out semantic relation tests passed.
```

Build output warning:

```text
(!) Some chunks are larger than 500 kB after minification.
```

## Source inventory

```text
check-local-model-runtime.ps1
check-local-model-runtime.sh
clean-install.bat
configure-ollama-origins.example.bat
configure-ollama-origins.example.ps1
configure-ollama-origins.example.sh
eslint.config.js
index.html
local-runtime-bridge.js
MODEL_SETUP.md
package.json
package-lock.json
public/favicon.svg
public/icons.svg
README.md
run-build.bat
run-dev.bat
run-local-runtime-bridge.bat
run-local-runtime-bridge.sh
run-preview.bat
run-with-ollama.bat
run-with-ollama.sh
scripts/package-portable-source.py
server.py
setup-ollama-model.bat
setup-ollama-model.sh
smoke-test-qwen3-8b.ps1
smoke-test-qwen3-8b.sh
src/agent/actionPlanner.js
src/agent/agentResponses.js
src/agent/canonicalIntentResolver.js
src/agent/capabilityRegistry.js
src/agent/confirmationState.js
src/agent/conversationIntentResolver.js
src/agent/conversationMemory.js
src/agent/customParserContinuation.js
src/agent/datasetMappingSpec.js
src/agent/deterministicControlPlanner.js
src/agent/deterministicPreMapping.js
src/agent/expectedOutputComparison.js
src/agent/fileDetection.js
src/agent/intentClassifier.js
src/agent/localModelClient.js
src/agent/localModelSettings.js
src/agent/localRuntimeDiagnostics.js
src/agent/mappingSpecAutoRepair.js
src/agent/mappingSpecParserGenerator.js
src/agent/mappingSpecTrainingBuilder.js
src/agent/mappingSpecValidationSeverity.js
src/agent/mappingSpecValidator.js
src/agent/modelPromptBuilder.js
src/agent/modelReliability.js
src/agent/modelResponseValidator.js
src/agent/modelSchemas.js
src/agent/ollamaActionPlanSchema.js
src/agent/ollamaActionPlanValidator.js
src/agent/ollamaConnectionManager.js
src/agent/ollamaOrchestrator.js
src/agent/orchestrationPlanner.js
src/agent/orchestratorContext.js
src/agent/parserBinding.js
src/agent/prompts/customParserPrompt.js
src/agent/prompts/externalAiPromptPrompt.js
src/agent/prompts/formatFewShots.js
src/agent/prompts/ollamaOrchestratorPrompt.js
src/agent/resultSummary.js
src/agent/routeRegistry.js
src/agent/safetyGuards.js
src/agent/trainingExampleBuilder.js
src/algorithms/bfs.js
src/algorithms/connectedComponents.js
src/algorithms/dfs.js
src/algorithms/graphModel.js
src/algorithms/registry.js
src/algorithms/traversal.js
src/App.css
src/App.jsx
src/assets/hero.png
src/assets/react.svg
src/assets/vite.svg
src/components/agent/AgentComposer.jsx
src/components/agent/AgentMessage.jsx
src/components/AgentActionCard.jsx
src/components/AgentChatPanel.css
src/components/AgentChatPanel.jsx
src/components/AlgorithmsPanel.jsx
src/components/BarChart.jsx
src/components/ErrorBoundary.jsx
src/components/LocalRuntimeDiagnosticsPanel.jsx
src/components/ui.jsx
src/components/Viz.jsx
src/hooks/useAlgorithms.js
src/hooks/useFileUpload.js
src/index.css
src/main.jsx
src/theme.js
src/utils/batchUpdates.js
src/utils/customParser.js
src/utils/mappings.js
src/utils/parsers.js
tests/agent-local-model.test.mjs
tests/intent-heldout.test.mjs
vite.config.js
```

## Architecture map

### Canonical graph ownership

- Committed graph state is owned by `src/App.jsx` as `const [hes, setHes] = useState(null)`.
- Canonical normalization happens through `normalizeHyperedges(...)` in `src/utils/parsers.js`.
- Derived mappings/statistics/exports use `finalHes`, which is either committed `hes` or a batch-update preview overlay.
- `src/utils/mappings.js` provides `buildH2V`, `buildV2H`, `buildH2H`, `buildV2V`, `buildCSR`, `computeStats`, and `validateHes`.
- There is no persistent standalone vertex table. A vertex exists only when it appears in at least one hyperedge membership list.

### Existing `setHes` call sites

- `src/App.jsx:240` in `sw(f)`: route switch clears graph.
- `src/App.jsx:261` in `parseAndCommit(...)`: parse error path can clear graph when `preserveOnError` is false.
- `src/App.jsx:267` in `parseAndCommit(...)`: parsed normalized input replaces graph.
- `src/App.jsx:2027` in `applyCustomResult()`: custom parser result replaces graph.
- `src/App.jsx:2052` in `clearGraph()`: clears graph.

### Existing `graphVersion` changes

- `src/App.jsx:214`: editing batch text while batch preview is applied increments graph version.
- `src/App.jsx:239`: switching input route increments graph version if a graph exists.
- `src/App.jsx:268`: successful parse increments graph version.
- `src/App.jsx:2030`: applying custom parser result increments graph version.
- `src/App.jsx:2051`: clearing graph increments graph version.
- `src/App.jsx:2066`: toggling batch preview increments graph version.

This baseline does not yet enforce the v7.2 rule that `graphVersion` changes only when committed canonical graph content changes.

### Base graph and batch overlay

- `hes` is the committed graph.
- `applyBatch` is a checkbox/flag for previewing batch updates.
- `batchUpdates` is derived from `texts.batch` through `parseBatchUpdates(...)`.
- `batchApplication` derives `{ hyperedges, warnings }` using `applyBatchUpdates(hes, batchUpdates)` only when preview is enabled.
- `finalHes` drives visualization, mappings, statistics, export previews, and algorithms.
- `applyBatchUpdatesForAgent()` currently turns the preview flag on. It does not commit into `hes`.

### Confirmation flow

- `src/agent/safetyGuards.js` defines confirmation-required action types including clear graph, parse uploads, custom parser run/apply, batch update apply, file download, and training exports.
- `src/agent/confirmationState.js` creates snapshots with `actionType`, `batchId`, `batchVersion`, `customResultId`, `graphVersion`, `customCodeVersion`, and `createdAt`.
- Baseline confirmation snapshots do not include graph ID, graph fingerprint, mutation plan ID/hash, expiry, selection fingerprint, or mapping revision.
- `src/components/AgentChatPanel.jsx` stages confirmation cards and calls `isConfirmationStale(...)` before dispatching the action.

### Action-plan flow

- Ollama structured action planning uses:
  - `src/agent/ollamaActionPlanSchema.js`
  - `src/agent/ollamaActionPlanValidator.js`
  - `src/agent/orchestrationPlanner.js`
  - `src/agent/ollamaOrchestrator.js`
  - `src/agent/prompts/ollamaOrchestratorPrompt.js`
  - `src/agent/conversationIntentResolver.js`
  - `src/agent/conversationMemory.js`
- Existing action schema supports routing, parsing, graph view/layout/search, custom parser workflow, exports, clear graph, and placeholders.
- Baseline schema does not yet include graph mutation actions.

### Custom Parser flow

- Active upload batches are isolated in `agentFileBatches`.
- Mapping-first modules already exist:
  - `datasetMappingSpec.js`
  - `deterministicPreMapping.js`
  - `mappingSpecValidator.js`
  - `mappingSpecAutoRepair.js`
  - `mappingSpecParserGenerator.js`
  - `customParserContinuation.js`
  - `parserBinding.js`
  - `expectedOutputComparison.js`
- Generated/manual parser code runs through `src/utils/customParser.js` in a Web Worker with timeout and static code scanning elsewhere.
- `runCustom()` runs parser code and stores a preview.
- `applyCustomResult()` applies the preview as a graph replacement after confirmation.
- Parser-result application is currently a replacement graph event, not a mutation event.

### Visualization selection

- `src/components/Viz.jsx` keeps `selHE` and `selV` local.
- Selection is not yet lifted to `App.jsx`, so the chatbot cannot bind confirmations to selected graph entities.

## Known baseline gaps for v7.2.0

- No pure graph mutation engine.
- No graph fingerprint.
- No graph ID lifecycle.
- `graphVersion` increments for non-committed route/preview/UI changes.
- Batch updates are a preview overlay, not a confirmed commit workflow.
- Confirmation snapshots lack plan hash/fingerprint/expiry/selection binding.
- No deterministic entity resolver for conversational references.
- No mutation history/undo mechanism.
- Parser profiles are not yet implemented.
- Parser worker limits are scattered and minimal.

## Planned files likely to change

- `package.json`
- `README.md`
- `MODEL_SETUP.md`
- `src/App.jsx`
- `src/components/Viz.jsx`
- `src/components/AgentActionCard.jsx`
- `src/components/AgentChatPanel.jsx`
- `src/agent/capabilityRegistry.js`
- `src/agent/confirmationState.js`
- `src/agent/orchestratorContext.js`
- `src/agent/ollamaActionPlanSchema.js`
- `src/agent/ollamaActionPlanValidator.js`
- `src/agent/safetyGuards.js`
- `src/utils/batchUpdates.js`
- `src/utils/customParser.js`
- new `src/graph/*`
- new parser-profile and parser-hardening modules
- new tests under `tests/`
- new v7.2 documentation under `docs/`
