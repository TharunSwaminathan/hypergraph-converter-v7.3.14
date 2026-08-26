# v7.2 Known Limitations

- Standalone vertices are not supported because the canonical graph stores vertices only through hyperedge membership.
- v7.2.1 adds model-backed semantic planning for graph mutations when Ollama is connected, but it still only resolves to the existing operation set: add/remove/rename hyperedges or incidences, rename vertices, set time/weight/attributes, clear graph, and undo.
- The model planner is not a general graph query language. It returns a strict draft, and deterministic validation may still ask for clarification.
- Offline mode uses the deterministic regex fallback. It now handles common modifiers, but it is intentionally narrower than the connected semantic planner.
- Ambiguous empty-hyperedge removals ask for clarification instead of guessing.
- Quoted modifier-like IDs are preserved; unquoted trailing modifiers are interpreted through command-aware suffix parsing.
- Parser profiles are stored in browser local storage and are not shared across browsers unless the user exports/imports JSON.
- The Custom Parser sandbox is a browser Web Worker hardening layer, not a formal security boundary for hostile code.
- Ollama remains optional and local-only. It can assist with conversation and mapping guidance but cannot bypass deterministic validation/confirmation.
- GitHub Pages still cannot start Ollama or the local bridge; users must start local runtime helpers themselves.
