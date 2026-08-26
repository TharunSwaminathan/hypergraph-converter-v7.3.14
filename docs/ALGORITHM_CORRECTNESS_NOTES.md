# Algorithm correctness notes

The algorithms panel continues to run over the V2V 2-section projection of the current hypergraph.

Correctness clarifications in v7.3.6:

- Connected Components, BFS, and DFS use unweighted connectivity on the 2-section projection.
- Shortest Path uses Dijkstra over non-negative projected costs.
- K-core output is grouped by exact vertex coreness. These groups are k-shell/coreness groups, not separate claims that every listed group alone is "the k-core".
- The shared projection utility keeps V2V display/export and weighted shortest-path projection policy explicit.

Large graphs still run in the browser. For very large datasets, use the visualization limit and algorithm controls carefully.
