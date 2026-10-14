# CANDY v7.3.14 S1 consolidated candidate

## Inputs
- `hypergraph-converter-v7.3.14(2).zip`: correctness authority / solo line
- `hypergraph-converter-v7.3.14-s1(3).zip`: UI + cross-platform authority / collaborative S1 line
- existing assistant-context overlay + hotfix v2 from this chat

## Merge policy
- S1 retained for visual system, fonts, layout, launcher/cross-platform additions, package metadata and UI component styling.
- Solo Scope 5F correctness retained for graph identity/version collision protection, graph mutation material-change detection, DynamicHypergraph stale-notice behavior, and Scope 5F regressions/harnesses.
- Assistant read-only application context integrated on top of S1 UI.
- `recentVerifiedReferences` hotfix v2 included.
- Solo `artifactStore.js` retained (stronger runtime implementation), with portable packaging fixed so `candy-runtime/src/artifacts/` is not excluded as generated evidence.

## Key merged files
- `src/App.jsx`: S1 UI + assistant state snapshot + Scope 5F graph-change/version correctness
- `src/components/AgentChatPanel.jsx`: assistant live-context routing + Scope 5F authoritative `preview.graphChanged`
- `src/components/DynamicHypergraphUpdatePanel.jsx`: S1 styling + version-bound local notices
- `src/graph/graphIdentity.js`: solo Scope 5F corrected version
- `src/graph/graphState.js`: solo Scope 5F corrected version
- `src/graph/graphMutationPreview.js`: solo Scope 5F corrected version
- `src/agent/assistantContextSnapshot.js`: assistant context hotfix v2
- `src/agent/modelPromptBuilder.js`: bounded live application snapshot support
- `candy-runtime/src/artifacts/artifactStore.js`: solo runtime implementation
- `scripts/package-portable-source.py`: preserves runtime source artifacts
- `scripts/verify-portable-archive.py`: matching archive verification rule

## Validation performed in the merge environment
PASS:
- `node tests/assistant-live-context-v7-3-14.test.mjs`
- Scope 2 runtime foundation
- Scope 2 job engine
- Scope 2 job failure matrix
- Scope 4C contracts
- Scope 5F graph-collision regression

Not completed in the merge container:
- mounted Vite/happy-dom UI regression and full Vite build, because the uploaded `node_modules` contains Windows native bindings while the merge container is Linux; a fresh Linux npm installation did not complete in the available execution window.

Therefore this archive is a **candidate**, not a qualified release. Run the Windows qualification commands before replacing the working baseline.
