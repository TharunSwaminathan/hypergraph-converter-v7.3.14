# CANDY Integration Scope 1 Implementation Report

## Identity and overall result

- Protected starting commit: `7b8fd71e2951482b3c30a6be9ec8886e86d2c1be`
- Implementation branch: `candy-integration-scope1`
- Overall result: **PHASE A QUALIFIED / PHASE B QUALIFIED**
- Commit/tag/push/merge performed: **none**
- Phase C started: **no**

The work is additive below the qualified chatbot. No frontend, deterministic NLU, ReAct, Custom Parser, visualization, Ollama bridge, or browser execution path was modified.

## Phase A — contracts and semantic boundary

### Result

**PASS.** Focused Phase A tests pass 2/2 files. The independent audit has zero open Critical and zero open High findings.

### Graph/hypergraph type policy

The canonical enum contains:

- `OrdinaryGraph`
- `DynamicOrdinaryGraph`
- `Hypergraph`
- `DynamicHypergraph`
- `ProjectedOrdinaryGraph`

SSSP accepts only the ordinary-graph family. `ProjectedOrdinaryGraph` is accepted only as an already materialized graph with validated projection provenance. Phase A implements no projection workflow and imports no browser projection helper.

Exact fail-closed evidence:

- `validateAlgorithmGraphCompatibility("SSSP", "Hypergraph")` throws `CandyContractError` with code `INVALID_GRAPH_TYPE` and `implicitProjectionPerformed: false`.
- The same holds for `DynamicHypergraph`.
- A valid `Hypergraph` snapshot passed to `validateAlgorithmRequest` reaches the compatibility gate and returns `INVALID_GRAPH_TYPE`, rather than failing first on contradictory metadata.
- The native POC independently rejects `graph_type Hypergraph` with non-zero status and `INVALID_GRAPH_TYPE`.

### Contract modules

- `src/candy/contracts/schemaVersions.js` — fixed version identifiers.
- `src/candy/contracts/errorClasses.js` — deterministic structured error codes and retry/user-correctable traits.
- `src/candy/contracts/graphTypes.js` — canonical graph types and SSSP compatibility.
- `src/candy/contracts/contractValidation.js` — strict objects/keys, graph refs, and SHA-256 artifact refs.
- `src/candy/contracts/algorithmSchemas.js` — GraphSnapshot, GraphUpdateBatch, SSSP request/result, weight/resource, stale-state, and bounded-observation validators.

GraphSnapshot rejects unknown versions/types, missing identity, invalid versions, malformed artifact refs, ordinary/hypergraph count contradictions, invalid weights, and missing projected-graph provenance. GraphUpdateBatch requires explicit `DELETE_THEN_INSERT`, `REJECT` duplicate/conflict policy, and an exact base graph identity/version.

`STATIC` requests forbid prior/update references. `INCREMENTAL` and `COMPARE` require exact, graph-bound property and update references. Only `SSSP`, modes `STATIC|INCREMENTAL|COMPARE`, and backend `LOCAL_OPENMP` are executable contract values.

Execution success and correctness validation are independent in AlgorithmResult. `COMPARE` cannot report `not_requested`; it requires passed validation. Model summaries are capped at 4096 UTF-8 bytes and warnings at 20 strings of at most 512 characters.

### Vertex mapping

The deterministic mapping accepts non-empty strings and safe-integer IDs. It uses type-tagged canonical keys and exact code-unit lexical ordering, so numeric `10` and string `"10"` do not collide or coerce. It provides checked bidirectional lookup and fails unknown IDs with `INVALID_VERTEX`.

### CSR behavior

The adapter accepts directed ordinary graphs only, preserves isolated/disconnected vertices, maps to zero-based native indices, sorts edges by native source/target, emits row offsets/columns/weights deterministically, supports zero weights, and rejects negative/floating/non-finite/over-INT32 weights. Duplicate directed edges are rejected. Self loops are explicitly `ALLOW` or `REJECT`; the default is documented `ALLOW`. Caller cardinality limits are bounded by native hard maxima.

### Phase A audit

Closed findings:

- High: state/update references were not structurally and version-bound validated.
- Medium: the original hypergraph integration test stopped at contradictory metadata.
- Medium: locale collation was unnecessary mapping variability.
- Medium: result observation bounds and strict COMPARE semantics were incomplete.
- Medium: zero algorithm-state version was accepted instead of treated as missing/stale.

Evidence:

- `artifacts/candy-scope1-phaseA-audit-report.md`
- `artifacts/candy-scope1-phaseA-issue-register.json`

## Phase B — standalone OpenMP SSSP POC

### Provenance

Reference archive: supplied `MOSP-OpenMP-main.zip`, SHA-256 `ED12A58F2B5E4C5EBE229875BE8D3502C1EAD80506B077013D6B04CB34BA6C69`.

The archive contains no LICENSE/COPYING file. No upstream source or build output was copied. `candy-runtime/native/upstream/MOSP-OpenMP-PROVENANCE.md` records the source identity, inspected files, concepts used, and the clean implementation distinction. The POC is named SSSP and does not expose the upstream combined-tree heuristic as general MOSP.

### Native boundary

The only invocation is:

```text
candy-sssp-openmp --request <test-harness/server-owned-request-path>
```

The executable accepts no raw shell command, executable path, environment map, output path, generic flag forwarding, CUDA/ESCHER/HPC operation, or browser/model input. The future companion must own and contain the request path. In Scope 1, only the deterministic harness creates request files under the OS temporary directory and removes them in `finally`.

The request explicitly carries graph type, graph identity/version, optional validated projection-provenance artifact ID, source, thread count, bounded CSR, prior property identity/state, and explicit delete/insert batches. JSON success/errors go to stdout with truthful non-zero failures.

### Build environment actually used

- Host execution mode: WSL2
- Kernel/platform: `Linux 6.18.33.2-microsoft-standard-WSL2 x86_64 GNU/Linux`
- Compiler: `g++ (Ubuntu 15.2.0-16ubuntu1) 15.2.0`
- Language/build flags: C++17, `-O2 -Wall -Wextra -Wpedantic -fopenmp`
- OpenMP macro: `_OPENMP 201511`
- Build system: narrow portable Makefile; `CXX ?= g++`, no `g++-15` hard dependency
- Warning-visible clean build: PASS, no compiler warnings

### Algorithm semantics

`STATIC` runs deterministic Dijkstra over directed, non-negative INT32 single-objective edges. Distances use signed 64-bit arithmetic with checked saturation; unreachable values serialize as JSON `null`. Source and unreachable parents are `-1`.

`INCREMENTAL` requires prior distances/parents and matching graph/property versions. It validates the old property, applies explicit delete-then-insert updates, invalidates the affected predecessor subtree for deleted parent edges, reconnects affected vertices in an OpenMP per-target loop, and propagates improvements with a priority queue. It does not silently substitute static recomputation as the updated result.

`COMPARE` runs the incremental path and independently recomputes static SSSP on the updated graph. Distance equality is mandatory. Parent arrays may differ only if the incremental result independently forms a valid, cycle-free, source-rooted shortest-path tree. A qualification-only compile-time fault binary deliberately corrupts one distance and proves a non-zero `RESULT_VALIDATION_FAILURE`.

### Deterministic qualification

Normal native qualification: **PASS**.

- 12/12 deterministic fixtures:
  - simple chain;
  - diamond/equal-cost alternatives;
  - disconnected graph;
  - insertion decreases shortest path;
  - insertion does not affect shortest path;
  - deletion invalidates parent edge;
  - deletion creates an unreachable vertex;
  - mixed insertion/deletion;
  - isolated vertices;
  - zero-weight cycle;
  - invalid negative weight;
  - stale graph version.
- 40/40 mixed-update stress cases.
- Fixed seed: `0x5eed1234`.
- Independent JavaScript distance oracle: PASS for every stress case.
- Malformed request/CSR path: non-zero `INVALID_GRAPH_SCHEMA`.
- Graph-version mismatch: non-zero `STALE_GRAPH_VERSION`.
- Corrupted prior parent/property array: non-zero `STALE_PROPERTY_STATE`.
- Missing/invalid weight: deterministic `UNSUPPORTED_WEIGHT_MODEL`.
- Native `Hypergraph`: non-zero `INVALID_GRAPH_TYPE`; no projection performed.
- Forced compare mismatch: non-zero `RESULT_VALIDATION_FAILURE`.
- Missing request file: non-zero structured failure.

Performance fields separately report preparation, incremental/static compute, and validation/reference time. Tiny-fixture timings are instrumentation checks only; no speed claim is made.

### Sanitizers

AddressSanitizer + UndefinedBehaviorSanitizer qualification: **PASS** across the same 12 fixtures, 40 fixed-seed stress cases, malformed/stale/hypergraph cases, and forced mismatch. Options halted on first detected error.

ThreadSanitizer: **not executed and not claimed**. GCC `libgomp`/TSan runtime compatibility was not established for this environment.

### Phase B audit

Closed findings:

- High: native request lacked its own explicit graph-type assertion.
- High: equal-distance parent rewrites could create zero-weight parent cycles.
- Medium: request/inline-result bounds were misaligned.
- Medium: stale graph and property classifications were conflated.
- Medium: projected input lacked native provenance assertion.

Open/accepted Low limitations:

- no TSan qualification;
- old prior-state authenticity validation currently runs static Dijkstra and is included in preparation cost.

Evidence:

- `artifacts/candy-scope1-phaseB-audit-report.md`
- `artifacts/candy-scope1-phaseB-issue-register.json`

## Full application regression and production gates

- `npm run test`: **PASS — 231/231 test files in 99.4s** (final post-corrective rerun).
  - Protected baseline: 228 files.
  - New Scope 1 permanent tests: 3 files.
  - First attempt stopped at 135/231 because Python was not on PATH; rerun with the provided bundled Python directory on PATH passed. This was environment-only.
- `npm run lint`: **PASS**.
- `npm run build`: **PASS**, Vite 8.0.16, 228 modules transformed.
- `npm run build:github`: **PASS**, repo base `/hypergraph-converter/`, 228 modules transformed.
- Build warning: existing main bundle exceeds Vite's 500 kB advisory threshold; no Scope 1 frontend module is imported into the bundle.
- `npm audit --omit=dev`: **PASS — 0 vulnerabilities**. The first sandboxed registry request failed; the approved network retry succeeded.
- `git diff --check`: **PASS** (only a Windows line-ending advisory for `.gitignore`, no whitespace error).
- Dependency/package-lock changes: **none**.

## Changed-file classification and manifest

### A. Phase A production contract/adapter

- `src/candy/contracts/schemaVersions.js`
- `src/candy/contracts/errorClasses.js`
- `src/candy/contracts/graphTypes.js`
- `src/candy/contracts/contractValidation.js`
- `src/candy/contracts/algorithmSchemas.js`
- `src/candy/adapters/vertexMapping.js`
- `src/candy/adapters/csrAdapter.js`

### B. Phase A permanent test

- `tests/candy-phaseA-contracts.test.mjs`
- `tests/candy-phaseA-csr.test.mjs`

### C. Phase A evidence

- `artifacts/candy-scope1-phaseA-audit-report.md`
- `artifacts/candy-scope1-phaseA-issue-register.json`

### D. Phase B native source/build definition

- `candy-runtime/native/upstream/MOSP-OpenMP-PROVENANCE.md`
- `candy-runtime/native/sssp-openmp/README.md`
- `candy-runtime/native/sssp-openmp/Makefile`
- `candy-runtime/native/sssp-openmp/src/main.cpp`

### E. Phase B permanent fixture/test

- `candy-runtime/test/fixtures/sssp-fixtures.mjs`
- `candy-runtime/test/run-native-qualification.mjs`
- `tests/candy-phaseB-source-contract.test.mjs`

### F. Phase B and combined evidence

- `artifacts/candy-scope1-phaseB-audit-report.md`
- `artifacts/candy-scope1-phaseB-issue-register.json`
- `artifacts/candy-scope1-implementation-report.md`

### G. Necessary repository hygiene

- `.gitignore` — ignores only `candy-runtime/native/sssp-openmp/build/`.

### H. Temporary/debug/generated artifacts

- Native normal, fault-injection, and sanitizer binaries under the ignored `build/` directory were removed before handoff.
- Harness request files were removed from the OS temporary directory.
- No object file, dataset, benchmark dump, `node_modules`, `dist`, Python cache, credential, or token was added to the review tree.

## Known POC limitations

- Linux/WSL OpenMP only; no qualified native Windows build.
- One directed, single-objective, non-negative INT32 weight model.
- Duplicate edges rejected; no update-in-place weight semantics.
- Request capped at 64 MiB; graph capped at 10,000 vertices and 10,000,000 edges.
- Full distance/parent arrays are inline JSON. Phase C can use immutable file-backed artifacts.
- Prior-state authenticity check recomputes old static distances, so preparation cost is not an optimized production session path.
- No TSan claim.
- No performance superiority claim from bounded fixtures.
- No projection workflow; projected input is only a contract reservation requiring provenance.
- No runtime companion, REST, authentication, browser discovery, ReAct capability, UI, CUDA, ESCHER, adaptive selector, HPC, Slurm, or MCP implementation.

## Hard-stop statement

**Phase C did not start.** Scope 1 stops after Phase A contracts/audit and Phase B standalone OpenMP SSSP/audit. The working tree is intentionally uncommitted for user review.
