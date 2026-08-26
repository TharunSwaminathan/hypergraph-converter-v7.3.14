# Projection and statistics semantics

v7.3.6 centralizes V2V projection behavior in `src/algorithms/projection.js`.

Default V2V projection:

- uses the hypergraph 2-section / clique expansion;
- creates one projected edge for each pair of vertices that co-occur in at least one hyperedge;
- uses `count_shared_hyperedges` as the default displayed/exported weight;
- stores the contributing hyperedge IDs on each projected edge.

Weighted shortest path:

- uses `min_hyperedge_weight` as the pairwise cost policy;
- accepts zero as a valid non-negative Dijkstra cost;
- replaces missing, negative, or invalid weights with cost `1` and returns warnings.

Statistics now report two distinct densities:

- incidence density: incidences divided by `vertex_count * hyperedge_count`;
- V2V projection density: observed projected vertex pairs divided by possible vertex pairs.

Singleton hyperedges are reported as singleton hyperedges. They are not labeled as graph self-loops.
