# CANDY Scope 1 OpenMP SSSP POC

This is an independently executable native proof of concept. It is not connected to React, the chatbot, ReAct, or a network service.

Supported contract:

- directed ordinary graphs only;
- zero-based CSR;
- one non-negative 32-bit integer weight per edge;
- `STATIC`, `INCREMENTAL`, and `COMPARE` modes;
- explicit prior distance/parent state for incremental modes;
- delete-then-insert update semantics;
- duplicate edges and conflicting update operations rejected;
- explicit `OrdinaryGraph`, `DynamicOrdinaryGraph`, or already materialized `ProjectedOrdinaryGraph` request type; hypergraph types fail with `INVALID_GRAPH_TYPE` and are never projected;
- JSON result/error on stdout and diagnostics on stderr;
- truthful non-zero exit for every structured failure.

The single allowed invocation shape is:

```bash
./build/candy-sssp-openmp --request /server/owned/job/request.txt
```

There is no general flag forwarding, output-path argument, executable selection, shell input, environment input, or arbitrary operation name. The future companion must resolve the request path inside its own job directory.

Build on Linux/WSL:

```bash
make
```

The Makefile respects an explicitly selected `CXX` and otherwise uses `g++`; it does not require `g++-15`.

Qualification from the repository root (Windows with WSL):

```powershell
node candy-runtime/test/run-native-qualification.mjs
```

The harness builds in WSL, uses only harness-created temporary request files, runs deterministic fixtures plus fixed-seed stress cases, validates output, and removes temporary requests. Native build output remains ignored/uncommitted.

Distance `INF` is emitted as JSON `null`. The source parent is `-1`; unreachable parents are `-1`. Stable CSR ordering, the priority queue's `(distance, vertex)` order, and strict-improvement relaxation make tie behavior deterministic without rewriting equal-distance parents into cycles. `COMPARE` requires exact distance equality; parent arrays may differ only when both arrays independently encode valid, source-rooted shortest-path trees.

The POC caps request files at 64 MiB and graphs at 10,000 vertices so its inline result arrays remain bounded. A later companion may replace inline arrays with immutable file-backed result artifacts without changing algorithm semantics.
