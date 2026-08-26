# v7.2 Migration Notes

Source baseline:

- `hypergraph-converter-v7-final-ollama-only-assistant-portable.zip`
- baseline package: `hypergraph-converter-v7-final-ollama-only-assistant@7.1.1`

New package:

- folder: `hypergraph-converter-v7-conversational-graph-mutation-custom-parser`
- zip: `hypergraph-converter-v7-conversational-graph-mutation-custom-parser-portable.zip`
- package: `hypergraph-converter-v7-conversational-graph-mutation-custom-parser@7.2.0`

Major changes:

1. Added deterministic graph identity, fingerprinting, mutation schema, mutation validation, preview, commit, and undo history.
2. Routed conversational graph edits through preview + confirmation + re-validation.
3. Stopped treating route switches and preview toggles as graph-version changes.
4. Committed Batch Updates through the graph mutation engine instead of only toggling an overlay.
5. Added visualization selection lifting so “that hyperedge” can resolve safely.
6. Added deterministic mapping-conversation helpers and local parser profiles.
7. Hardened Custom Parser Web Worker execution with limits, blocked APIs, bounded logs, and serializable-output checks.

Preserved behavior:

- Ollama-only local assistant
- deterministic route controller
- GitHub Pages/local Ollama diagnostics and bridge
- upload batches and mapping workflow
- algorithms panel and visualization highlighting
- parser generation, expected-output comparison, training/debug export
- all existing parser/export/visualization routes and launch scripts
