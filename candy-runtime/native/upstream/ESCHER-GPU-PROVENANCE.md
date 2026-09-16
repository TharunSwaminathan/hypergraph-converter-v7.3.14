# ESCHER-GPU research-source provenance

## Supplied archive

- File: `ESCHER-GPU-main.zip`
- Supplied path: `C:\Users\tharu\Downloads\College\candi\old\ESCHER-GPU-main.zip`
- SHA-256: `CE2D5C1A1A486ECED59FA70122FA271EF9E528D36188E97AD326ECDF3ECAA302`
- Size: 2,155,972 bytes
- Role: research/reference input only

No `LICENSE`, `LICENCE`, `COPYING`, or `NOTICE` file was present in the supplied archive. The README statement that the project is academic research is not a license grant. The archive and its source are not copied or redistributed in this repository.

## Files inspected

- `README.md`, `PROJECT_STRUCTURE.md`, `Makefile`
- `include/motif.hpp`, `include/motif_update.hpp`, `include/structure.hpp`
- `kernel/motif_utils.cuh`, `kernel/motifs.cu`
- `src/HMotifCount.cu`, `src/HMotifCountUpdate.cu`
- `src/type1.cu`, `src/type2.cu`, `src/type3.cu`, `src/coarseTriangle.cu`
- `src/main.cu`, `src/graphGeneration.cpp`
- `structure/operations.cu`
- `docs/README.md`, `docs/IRREGULAR_GRAPH_OPTIMIZATIONS_AND_DYNAMIC_HYPERGRAPH.md`
- Bundled paper: *Efficiently Counting Triangles for Hypergraph Streams by Reservoir-Based Sampling*

## Confirmed research-source characteristics

- The seven-bit classifier records presence of `A only`, `B only`, `C only`, `AB only`, `BC only`, `CA only`, and `ABC` regions.
- The lookup table covers 30 permutation-invariant connected-three-hyperedge classes.
- The static CUDA enumerator traverses only H2H cliques. It reaches 24 closed-triple classes and omits all six connected open-wedge classes.
- The incremental anchor implementation can count unaffected triangles sharing a minimum-ID anchor, so its reported delta is not generally the exact new-minus-old difference.
- Type1 is `sum_e C(|e|, 3)`.
- Type2 is a pair-overlap combinatorial count `C(|A intersect B|, 2) * |A only| * |B only|` over qualifying pairs.
- Type3 sums products of the three pair-exclusive overlap cardinalities over qualifying H2H triangles.
- Coarse inner, outer, hybrid, and hyperedge triangle counters are separate experimental quantities and are not the complete 30-class taxonomy.
- H2V, V2H, H2H, CBST layout, payload capacity, alignment, deleted-slot reuse, and dense one-based IDs are implementation/storage concerns rather than product semantics.

## Clean-room product boundary

Scope 4A-R independently defines `HYPERGRAPH_3EDGE_MOTIF_COUNT` from incidence sets and S3 orbit equivalence. The portable CPU reference oracle enumerates unordered triples directly and defines incremental delta as exact full recomputation: `newCounts - oldCounts`.

No CUDA kernel, CBST implementation, upstream lookup array, parser, generator, update kernel, executable, or source layout is copied into the product. The supplied static and incremental defects remain documented evidence and are not emulated.
