# MOSP OpenMP source provenance

Reference archive supplied for this scope:

- Archive: `MOSP-OpenMP-main.zip`
- SHA-256: `ED12A58F2B5E4C5EBE229875BE8D3502C1EAD80506B077013D6B04CB34BA6C69`
- Upstream project title in the archive: `MOSPOpenMP`
- Inspected entry points: `src/main.cpp`, `src/Dijkstra.cpp`, `src/parallelSOSPUpdate.cpp`, `src/generateTestCases.cpp`, and `src/parallelStressTest.cpp`

The supplied archive contains no LICENSE or COPYING file. Consequently, no upstream implementation file is copied into this repository. The Scope 1 POC in `../sssp-openmp/` is a clean, narrowly scoped implementation of the published/static-Dijkstra and incremental affected-tree concepts, with its own request/result contract and tests. It is not represented as upstream MOSP code and does not implement the upstream combined-tree multiobjective heuristic.

The archive was used as research material to identify:

- zero-based CSR conventions;
- prior distance and parent state requirements;
- delete/insert update batches;
- static Dijkstra comparison;
- the need to correct false-success comparison paths;
- the intended OpenMP execution target.

Generated datasets, binaries, object files, HTML documentation, and benchmark output from the archive are intentionally excluded.
