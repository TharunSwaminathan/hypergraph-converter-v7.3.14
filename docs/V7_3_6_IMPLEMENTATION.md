# v7.3.6 implementation notes

v7.3.6 is a targeted remediation release over the merged v7 app. It preserves the existing deterministic offline assistant, local Ollama-only assist, upload batches, DatasetMappingSpec workflow, parser generation, trusted-code Custom Parser worker, algorithms panel, visualization, exports, and run scripts.

Main implementation changes:

- added `src/agent/deterministicNlu/domains/graphIdentifierNormalizer.js`;
- routed graph mutation grammar and graph entity extraction through the shared identifier normalizer;
- added a graph-operation suspicious identifier sanity check before mutation plans are created;
- changed Advanced Options batch updates from a checkbox overlay to explicit Preview / Commit / Discard controls;
- blocked conversational graph edits while a batch preview is active;
- added `src/algorithms/projection.js` and reused it for V2V exports, stats, and weighted Dijkstra adjacency;
- renamed ambiguous density and singleton/self-loop labels;
- updated K-core labels to exact coreness/k-shell language;
- removed Google Fonts network requests and switched to system font stacks.

No cloud APIs, paid APIs, API keys, model weights, or public hosted model endpoints were added.
