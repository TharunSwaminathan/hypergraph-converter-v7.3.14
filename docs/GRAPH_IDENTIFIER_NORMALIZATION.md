# Graph identifier normalization

The deterministic graph-mutation compiler normalizes natural-language wrappers before creating a `GraphMutationPlan`.

Examples:

- `add a vertex 6 to hyperedge h2` -> vertex ID `6`;
- `create hyperedge h3 with vertices 8 and 9` -> vertices `8`, `9`;
- `remove the vertex 4 from h0` -> vertex ID `4`;
- `rename the vertex 4 to 5` -> old ID `4`, new ID `5`.

Quoted literals are preserved:

- `add "a vertex 6" to h2` -> vertex ID `a vertex 6`.

The normalizer is shared by the deterministic NLU entity extractor and the graph-mutation grammar so diagnostics and typed operations no longer disagree about the graph IDs that were resolved.
