# CANDY / Hypergraph Converter v7.3.14 S1 — Assistant Awareness Corrective

## Purpose

This corrective sits on top of the merged S1 + assistant candidate. It addresses the remaining visible-browser issues found after the 269/269 automated suite passed:

1. **Algorithm provenance** — questions such as “How many connected components does the current graph have?” must not present an inferred value as an Algorithms-panel result when the algorithm has not actually been run.
2. **Read-only Custom Parser explanation** — “Explain what Run custom parser does, but do not run anything” is answered deterministically and does not depend on an active upload batch.
3. **Exact hypothetical hyperedge deletion counts** — read-only “what would happen if I delete h2?” questions use only the explicitly referenced hyperedge and current graph counts to provide an exact count preview without staging a mutation.
4. **Mutation authority remains unchanged** — executable deletion requests still use the existing deterministic preview → separate confirmation → commit flow.

## Source changes

- `src/agent/assistantReadOnlyGrounding.js` — new pure read-only grounding helpers.
- `src/agent/assistantContextSnapshot.js` — algorithm summary now carries explicit `status: computed|not_computed`; includes the previously qualified lint correction (`let summary;`).
- `src/agent/modelPromptBuilder.js` — reinforces that non-computed algorithm state must never be inferred and presented as an application result.
- `src/components/AgentChatPanel.jsx` — authoritative read-only helpers run before ordinary model conversation for the narrow cases above. Explicit workflow-status handling remains deterministic.
- `tests/assistant-live-context-v7-3-14.test.mjs` — covers computed vs not-computed algorithm provenance, read-only Custom Parser explanation, exact hypothetical deletion counts, and ensures executable parser/deletion commands are not consumed by the read-only helpers.

The existing missing historical evidence artifact used by the full suite is also present in the full corrected-source archive. The small overlay does not need to replace it if it is already in the working tree.

## Qualification performed in the patch build environment

Passed:

- `node tests/assistant-live-context-v7-3-14.test.mjs`
- `node tests/deterministic-nlu-question-safety.test.mjs`
- `node tests/deterministic-nlu-graph-mutation.test.mjs`
- `node tests/graph-mutation-pending-correction.test.mjs`

The complete Windows qualification still needs to be rerun after applying the overlay because the visible candidate and its Windows-installed dependencies are authoritative for final qualification.

## Required browser rerun

Use a fresh thread/session if practical so old persisted assistant messages are not confused with the corrected behavior.

1. Convert a small H2V graph.
2. Ask: `Explain what Run custom parser does, but do not run anything.`
   - Must explain the control.
   - Must not say an upload batch is required merely to explain it.
   - Must not run the parser.
3. Without running Connected Components, ask: `How many connected components does the current graph have?`
   - Must say Connected Components has not been computed yet.
4. Run Connected Components in Algorithms, then ask the same question.
   - Must report the current stored result.
5. Ask: `What would happen if I delete hyperedge h2?`
   - Must remain read-only and provide the exact count preview when h2 exists.
6. Ask: `Delete hyperedge h2`.
   - Must still stage the deterministic preview and require the separate confirmation before commit.

