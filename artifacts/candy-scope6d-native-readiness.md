# Scope 6D native optimization readiness

READY FOR BOUNDED SCOPE 6D IMPLEMENTATION

Branch: `candy-integration-scope6d-native-optimization`.
Baseline: `46ae55173407bb71683614ef212d9d4d4127ecc3`.
HEAD, origin and peeled
`candy-integration-scope6c-runtime-reuse-recovery-qualified` agree.
Initial tracked/untracked Git state was clean. This is readiness work only:
no production/native implementation, build, protocol, schema or limit changed.

## First-tranche decision

Recommend one class-B tranche: shorten incremental OLD/NEW host candidate-vector
lifetimes so they cannot coexist. Keep the existing enumerator, GPU kernels,
parsing, budgets, signed-delta semantics and one-shot protocol. Prospective
worst-case live tuple payload is 19,876,320 rather than 39,752,640 bytes.
This is a proposed structural reduction, not a measured optimized result or
promised RSS/VRAM reduction. No latency speedup or larger supported scale is claimed.

The [implementation plan](candy-scope6d-native-implementation-plan.md) defines the
exact change, qualification boundary and acceptance gates. No first or second
optimization tranche was implemented. A/B precede C; D needs new correctness and
resource evidence; E requires STOP/human review. Persistent workers are excluded
and unnecessary for this bounded lifetime change.

## Current admission envelope, rechecked

The earlier approximate 216-edge observation remains true for the current
qualified implementation, based on fresh execution and source checks:

- STATIC accepted E=216, I=217, W=4,992,085. E=217, I=217 was rejected by public
  preflight and unchanged native parser at W=5,038,740. E=216, I=218 was rejected
  at W=5,015,090. E=256/257 cases were also rejected.
- Each nonempty row contributes at least one incidence, so I≥E. With
  `W=I(E−1)(E−2)/2≤5,000,000`, E≥217 is impossible. The nominal 256-edge bound is
  not jointly attainable with valid nonempty rows under current work admission.
- INCREMENTAL accepted OLD=NEW=216 and a full batch of 216 deletions plus 216
  insertions. A raw OLD=217 incremental request was rejected. Both full snapshots
  retain the same work budget even for a local update.

| Dimension | Current contract | Freshly exercised |
|---|---|---|
| STATIC / incremental snapshots | Nominal ≤256 edges; effective ≤216 with nonempty rows/work | 216 accepted; over-bound cases rejected |
| Incidences | ≤100,000 each snapshot | STATIC 4×25,000 and 1×100,000 accepted; NEW 100,000 accepted in a one-edge replacement; 100,001 rejected |
| Aggregate native work | ≤5,000,000 membership visits per snapshot | W=4,999,680 accepted at E=64/I=2560; above-work cases rejected |
| Maximum cardinality | Implied ≤100,000 by total incidence cap | One 100,000-member edge accepted; no claim of many such edges |
| Delete/insert counts | ≤256 each nominal; inserted incidences ≤100,000; OLD/NEW still must pass | 216+216 operations accepted; 257-operation cases rejected; inserted incidences 100,000 accepted / 100,001 rejected |
| Packed request | ≤2 MiB each; artifact ≤6 MiB, HTTP body ≤8 MiB independently | Legitimate matrix packets max 589,878 bytes; STATIC padded exact 2 MiB accepted / +1 byte rejected. Incremental exact padded boundary not independently exercised. |
| Vertices | Native field ≤1,000,000; other layers/bytes apply | STATIC observed 100,000; incremental NEW common universe 100,001 including a retained old isolate. The 1M field bound is not a demonstrated scale claim. |

The [matrix/admission table](candy-scope6d-native-benchmark-matrix.md) gives maximum
I by E, conditional on every other bound. Generic incidence-adapter capacity,
browser capacity and qualified native capacity are distinct. No 10k/100k-edge or
1M-incidence capability is claimed. No admission limit was raised.

## Controlled baseline and correctness

The [full benchmark JSON](candy-scope6d-native-benchmark-before.json) records
30 accepted fixture cases / 54 genuine CUDA jobs and 14 admission/parser/byte
boundary probes. Eight seeded STATIC plus eight seeded incremental cases use the
independent set oracle. Larger deterministic fixtures use exact
disjoint/coincident/hub/chain formulas. Seed is `0x6d202610`; recipes are in
`scripts/measure-scope6d-native.mjs`. Input request digests and representative
packed requests are preserved. All 30 STATIC bins or all signed 30-bin deltas
matched exactly; CPU calculation is validation only, never a production fallback.

The matrix covers many small rows, high cardinality, sparse/dense overlap,
open-wedge-only connected motifs, closed triangles, local and high-impact
updates, near limits and intentional rejection. The chain counts 62 connected
open wedges; most candidate triples are disconnected. The hub counts all 41,664
triples as connected closed triangles. These statements do not confuse
candidate triples with counted motifs.

The taxonomy remains 30 S3 classes, 24 CLOSED_TRIANGLE and six OPEN_WEDGE,
derived from 96 connected labeled signatures. Line-Graph Triangles is separate.
STATIC remains CUDA_STATIC; INCREMENTAL remains CUDA_INCREMENTAL,
DELETE_THEN_INSERT, signed delta-only. No implicit projection, STATIC substitution,
CPU fallback or Analyze→Apply coupling was introduced. No benchmark applied a graph.

Per-case V/E/I, cardinality distributions, candidate/work counts, packet bytes,
host packing/preparation, supervised native wall, CUDA-event interval, Runtime
E2E, result bytes and observed/estimated memory are recorded in the JSON and
[readable matrix](candy-scope6d-native-benchmark-matrix.md). Incremental NEW shapes
and operation counts are separate from OLD. Fixture/pending derivation precedes
timing. Independent oracle and standalone pack timings are outside Runtime E2E.

Most deterministic cases have three sequential samples; the two largest-cardinality
boundaries and each randomized fixture have one. Medians are descriptive, not p95
or candidate speedup claims. No tuned clocks, cache reset or guaranteed desktop
GPU isolation is claimed. Profiling occurred after unprofiled benchmarks.

## Bottlenecks and memory

The [bottleneck map](candy-scope6d-native-bottleneck-map.md) distinguishes measured
boundaries from source-derived scaling and unisolated phases:

- STATIC launches E³ slots, filtering i<j<k. At E=216 this is 10,077,696 slots
  for 1,656,360 unordered triples.
- Incremental generation scans all choose(E,3) tuples whenever candidates are
  nonzero. Local-216 retains 23,005 per snapshot but scans 1,656,360. There is no
  candidate sorting/deduplication phase; uniqueness is inherent in the loops.
- High-impact-216 holds both host candidate vectors: 39,752,640 element bytes.
  Its profiled host wall gap containing candidates/classifier/checks is
  23.757448 ms, H2D transfer 39,757,128 bytes / 7.323789 active ms, and kernels
  1.364266 active ms. Gap attribution is inferred from source; it is not an
  isolated CPU generation timer and may include scheduling.
- Local-216 profile: host gap 1.572519 ms, active GPU kernels 0.021535 ms. Its
  unprofiled native wall median is 282.2560 ms and Runtime E2E 717.9979 ms.
  One-shot setup/bridge/teardown and qualification dominate these small admitted
  jobs, but their individual costs are not isolated.
- High-cardinality 4×25k input has just four useful triples yet 4.146881 ms
  active GPU time. Long serial merges and few useful threads are a problematic
  shape. Occupancy/cache hardware counters were not collected.
- Large host representation matters: single-sample 100k-incidence STATIC
  preparation is 198.4473 ms; NEW-100k incremental preparation 368.8115 ms.
  These are aggregate qualified JS/artifact/packing costs, not native compute.

Nsight Systems captured CUDA API/activity/allocation data from unchanged
qualified executables for five cases. The existing native `kernelMilliseconds`
event interval includes host launch submission spacing; in the same local trace,
event interval was 1.790780 ms versus 0.021535 ms active kernels. API time can
overlap device work and is not summed into process wall time. See
[profile analysis](candy-scope6d-native-profile-analysis.json) and NVIDIA's
[report definitions](https://docs.nvidia.com/nsight-systems/AnalysisGuide/index.html).

The explicit allocation trace pairs all alloc/free events, ends at zero and
matches payload formulas. High-impact-216 peak live cudaMalloc payload is
19,878,804 bytes; OLD/NEW device buffers are already sequential. This excludes
context, allocator padding, driver allocations and external GPU users; precise
total peak VRAM is unavailable. Global nvidia-smi memory usage was not attributed
to these jobs. Unprofiled cases retain null observed peak; estimates are labeled.

GNU-time native peak RSS medians (three runs each): local-216 117,784 KiB,
full-replace-216 155,772 KiB, high-cardinality 118,336 KiB. RSS includes
host/runtime/driver mappings, excludes Windows parent/GPU memory, and is not
isolated tuple memory or direct JavaScript heap telemetry.

## Scope 6C and resource safety

All five Scope6C preservation files passed (5/5 in 11.8 s): retention, recovery,
qualification parsing reuse, browser reconnect and corrective lifecycle.
Taxonomy derivation and both STATIC/INCREMENTAL transport contract test files
also passed. This is fresh targeted verification, not a rerun of the historical
full 284-file suite or 1,000-job soak. No tracked production code changed.

The measurement Runtime was explicitly started, reached HTTP 200, advertised
both exact qualified CUDA backends, and closed cleanly. All 60 observed owned
native groups drained to zero live/zombie processes. No Studio, Ollama or
persistent native worker was started.

Scope6C qualification JSON/Markdown from the earlier chat was absent in this
checkout at initial precheck. Available Scope6C logs, committed contract/tests,
user-authoritative qualified tag and native qualification records were retained.
Missing historical evidence was not recreated. The prechange inventory records
this distinction and hashes every available historical artifact.

The [risk register](candy-scope6d-native-risk-register.json) traces integer/work
overflow, allocations, offsets, CUDA indices, DoS/cardinality, fixed output,
signed deltas, cancellation/group cleanup and qualification/authority. No current
readiness blocker was identified. Potential-impact High entries are future guard
requirements, not claims of current exploitable High findings. This is a scoped
resource-safety readiness review, not a new exhaustive security certification.

Every future native source/binary change must invalidate its old qualification
record. Offline candidate comparisons do not permit production advertisement;
new versioned evidence and exact release binding are required before activation.
No historical record, tag, schema or verifier may be silently repointed or weakened.

## Stop boundary

Only readiness tooling, fixtures/profiles and additive Scope6D evidence were
created. Native code/binaries, Runtime/browser code, manifests and historical
evidence are unchanged. No commit, push, tag, merge, main modification or
qualification-anchor movement occurred.

Stop after this report and first-tranche recommendation. Do not implement
tranche one or start a second tranche automatically.
