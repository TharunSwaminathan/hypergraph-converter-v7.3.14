# MOSP-CUDA research-source provenance

## Supplied archive

- File: `MOSP-CUDA-main.zip`
- SHA-256: `290C2670B5C037BBCF595E5058250A6097D99DBCC8DF714E9CE932E62C26EDCF`
- Size: 44,440 bytes
- Role: research/reference input only

No `LICENSE`, `LICENCE`, `COPYING`, or `NOTICE` file was present in the supplied archive. No license terms are inferred. Upstream source is not copied or redistributed in this repository.

## Files inspected

- `Makefile`
- `README.md`
- `headers/dijkstra.cuh`
- `headers/parallelSOSPUpdate.cuh`
- `headers/sequentialSOSPUpdate.cuh`
- `src/Dijkstra.cu`
- `src/parallelSOSPUpdate.cu`
- `src/sequentialSOSPUpdate.cu`
- `src/parallelStressTest.cu`
- `src/parallelCombinedGraph.cu`
- `src/main.cu`

## Confirmed source characteristics

- The Makefile defaults to `sm_70`.
- `main.cu` is a synthetic/demo pipeline and does not implement the Studio's one-request-path native boundary.
- Static Dijkstra is host-side code.
- CUDA kernels are used for incremental SOSP propagation and reachability.
- The demo also invokes a combined multi-objective graph heuristic, which is outside this SSSP scope.
- The supplied CUDA path does not select/validate a device, preflight available memory, or derive its architecture from the actual device.
- Allocation byte multiplication is not checked before `cudaMalloc`.
- Several early CUDA failures can return before already-created allocations are released.
- Kernel launches call `cudaGetLastError`, while synchronization generally relies on later blocking copies; there is no explicit synchronization check after every launch.
- The distance-update kernel concurrently reads and writes the same global distance vector without an atomic distance protocol.
- The demo `main` does not aggregate every helper result into a truthful non-zero process status.

## Clean-room implementation boundary

The candidate under `native/sssp-cuda` is independently authored. It reuses the repository's own qualified CANDY request/result semantics and draws only on general algorithmic concepts confirmed in the supplied research source: affected-subtree invalidation after deletion, insertion seeding, iterative device relaxation, and independent static validation.

It does not copy the supplied parser, demo pipeline, graph generators, combined-graph code, multi-objective code, tests, or filesystem layout. It is named incremental SSSP, not MOSP, and does not claim Pareto-front behavior.

The candidate is deliberately not connected to runtime capability discovery until it has been built and qualified on a compatible CUDA toolkit/device.
