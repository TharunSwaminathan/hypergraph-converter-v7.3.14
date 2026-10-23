# Scope 6D native bottleneck map

Qualified baseline: `46ae55173407bb71683614ef212d9d4d4127ecc3`. Native,
Runtime, browser and qualification code remain unchanged. Current source line
references below supersede historical audit line numbers.

## Measured boundaries

| Boundary | Observation | Interpretation |
|---|---|---|
| Runtime artifact read/parse/pack/workspace write | Local-216 median 6.8561 ms; STATIC 100k-incidence sample 198.4473 ms; NEW-100k incremental sample 368.8115 ms | Measured aggregate preparation; not isolated sort, hashing or copying time. |
| Standalone host packing | STATIC 100k sample 221.1743 ms; incremental NEW-100k sample 379.7850 ms | Qualified JS canonicalization/packing and NEW reconstruction. Fixture/pending derivation preceded clocks. |
| Supervised native wall | Local-216 median 282.2560 ms; full-replace-216 290.4506 ms; most small cases around 250–290 ms | Includes WSL/setsid/native initialization and teardown. Their separate costs are not isolated. |
| Runtime end-to-end | Local-216 717.9979 ms; full-replace-216 716.4956 ms; NEW-100k single sample 1420.3563 ms | Includes workflow, upload, admission, qualification, transport and result validation. Not browser latency. |
| Incremental host gap | Local-216 1.572519 ms; full-replace-216 23.757448 ms | Nsight elapsed gap from device-properties return to first cudaMalloc. Source places candidate generation, classifier and checks here. May include scheduling; not an isolated CPU phase timer. |
| High-impact transfer | 39,757,128 bytes H2D; 7.323789 ms active copy time; D2H 480 bytes | One instrumented sample. Delta-only output does not avoid OLD/NEW input transfers. |
| Allocation | 10 cudaMalloc/free calls incremental; 4 STATIC | Per-request allocation/setup remains. OLD/NEW device buffers are already sequential. |
| Output | Fixed 30 STATIC bins / three 30-bin incremental arrays, bounded identity | Exact result sizes are recorded per case. Tuple lists are not serialized; output is not the main observed bottleneck. |

## Nsight CUDA activity and API measurements

One instrumented capture per row, using unchanged qualified binaries:

| Fixture | Actual GPU kernel active ms | Host gap ms | cudaMalloc API ms | cudaMemcpy API ms | Peak live explicit cudaMalloc bytes |
|---|---:|---:|---:|---:|---:|
| G-local-near-216 | 0.021535 | 1.572519 | 2.488804 | 0.703227 | 278,548 |
| B-high-cardinality | 4.146881 | 0.069948 | 1.680211 | 0.679549 | 400,772 |
| H-full-replace-216 | 1.364266 | 23.757448 | 2.546844 | 8.297155 | 19,878,804 |
| I-work-64-inc-2560 | 0.033088 | 0.068258 | 1.141821 | 0.380322 | 11,252 |
| E-open-wedges | 0.006912 | 0.079446 | 1.294192 | 0.343607 | 1,524 |

The native `kernelMilliseconds` field is a CUDA-event interval surrounding host
launch submission. In the same local-216 trace it was 1.790780 ms, while GPU
kernel activity totaled 0.021535 ms. These are different measurements. API
durations can overlap GPU execution and must not be summed into process wall time.
Profiles are not mixed with unprofiled Runtime medians.

Every tracked allocation/free pairs, the live tracked total ends at zero, and
the peaks match source payload formulas. These are explicit cudaMalloc payload
peaks, excluding context, allocator padding, driver allocations and other GPU
users. They are not total VRAM peaks. Unprofiled cases have null observed peak;
source estimates remain separate. See
[profile analysis](candy-scope6d-native-profile-analysis.json) and the NVIDIA
[analysis guide](https://docs.nvidia.com/nsight-systems/AnalysisGuide/index.html)
and [collection guide](https://docs.nvidia.com/nsight-systems/UserGuide/index.html).

## Source structure and scaling inferences

| Concern | Current qualified implementation | Implication / evidence class |
|---|---|---|
| STATIC enumeration | `hypergraph-motif-cuda/src/main.cu:186,205`: E³ launch slots, return unless i<j<k | Source-proven: E=216 launches 10,077,696 slots for 1,656,360 unordered triples. Compact launch may help but unranking and contention costs need experiments. |
| Incidence merge / cardinality | STATIC kernel line 186; incremental kernel line 280: merge three sorted H2V rows into seven region-presence bits | Source-proven. The 4×25k case has only four useful triples yet 4.146881 ms GPU activity. Long serial rows/low useful thread count are a problematic measured shape; occupancy/cache counters were not collected. |
| Incremental candidates | `hypergraph-motif-cuda-incremental/src/main.cu:215`: full choose(E,3) scan whenever affected candidates are nonzero | Local-216 scans 1,656,360 triples per snapshot to retain 23,005. Source-proven redundancy; no separate measured generation-only duration. |
| Sorting/deduplication | Candidate loops emit i<j<k exactly once; no candidate sorting/dedup phase | Do not invent a sorting bottleneck. JS typed-ID/membership canonicalization does sort/dedup; it is included in aggregate host preparation, not independently timed. |
| Host vector lifetime | Incremental `execute`, line 343, constructs OLD and NEW vectors before counting either | Source-proven live tuple payload 39,752,640 bytes in full-replace-216. Native peak RSS median 155,772 KiB versus local-216 117,784 KiB; RSS includes runtime/driver mappings. First-tranche target. |
| Sequential device snapshots | Incremental `affected_count`, line 300, allocates/copies/counts/frees one snapshot | Trace confirms peak 19,878,804 bytes, not twice that. No OOM observed; external VRAM pressure can still cause failure. |
| Incidence expansion | Packed CSR-like offsets/members arrays; full OLD/NEW packing | No native intersection graph or separate combinatorial incidence expansion table. Reconstructed NEW and candidate triples are the additional incremental representations. |
| Taxonomy | Classifier at STATIC line 155 / incremental line 249 | Derived 128-entry S3 table, 96 connected signatures, 30 classes, 24 closed / 6 open. Source derivation and targeted tests pass. STATIC host gap around 0.07 ms contains classifier plus checks, not pure taxonomy time. |
| Packed bytes | Observed legitimate packets 394–589,878 bytes; both native readers cap at 2 MiB | Byte cap was not primary for this matrix. STATIC padded exact cap and +1 were tested; incremental exact padded boundary was not independently exercised. |
| Launch / synchronization | STATIC one launch/sync; incremental two, even with zero candidates | Source and activity traces agree. Removing zero-work launches changes execution-proof behavior and is outside tranche one. |
| Protocol / startup | Both `main` functions accept one `--request` file and exit | No reusable worker protocol exists. Persistent workers are category E and require STOP/human review. Whole native wall time cannot be attributed solely to CUDA initialization. |

Per-process GNU-time peak RSS medians (three unprofiled runs each): local-216
117,784 KiB, full-replace-216 155,772 KiB, high-cardinality 118,336 KiB. These
include host/runtime/driver mappings and exclude Windows parent/GPU memory.
They are not isolated tuple memory or direct heap measurements.

## Optimization classes

- **A, algorithm preserving:** direct affected tuple enumeration with exact
  lexicographic uniqueness; setup removal only where measurements justify it.
  Later candidates, not automatically implemented.
- **B, lifetime/layout:** release OLD host candidate vector before constructing
  NEW. **First tranche.** Per-request device-buffer reuse is separate later work.
- **C, kernel restructuring:** compact STATIC indexing, cooperative large-row
  merging, contention reduction. Require dedicated exact-bin/sanitizer proof.
- **D, admission/work-budget:** excluded from tranche one. Require a checked
  work model, worst-case memory/time/cancellation evidence and review.
- **E, protocol/schema/worker:** STOP for human review. No implementation is
  authorized by this readiness recommendation.
