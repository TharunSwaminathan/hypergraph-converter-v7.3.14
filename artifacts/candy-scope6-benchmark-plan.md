# CANDY Scope 6 reproducible benchmark plan

Baseline: b24c4e32100d2e7c05b13df3c8f6f9e279fd8828. **Plan only; no benchmark suite or instrumentation implemented.** The audit ran deterministic small size/packing calculations only, reported in the [audit](candy-scope6-readiness-audit.md). Scope 5 correctness evidence cannot supply crossover or throughput numbers.

## Questions and experiment separation

1. Where do load/Stage/Apply time and peak retained heap go?
2. What proportion of Analyze latency is serialization/hash/upload, qualification, queue, pack/launch, CUDA startup/transfers/kernel or result?
3. For which exact OLD/NEW shapes and affected-edge counts is incremental faster than STATIC NEW?
4. How much do exact-byte reuse and prepared host reuse save?
5. Which bound ends a sustained session first?
6. Do proposed improvements reduce p95 and retained resources without changing 30-bin truth/authority?

Use two lanes: Q (currently qualified motif inputs) and B (browser/representation scale). B graphs must not be submitted to qualified native code when over its bounds. A third N research lane exists only after a separately reviewed new native envelope. Record rejection as an expected output, not zero execution latency.

## Fixture specification and generator contract

Every generated fixture manifest records seed, generator version/source SHA, graph ID/version/type, E,V,I, each row's cardinality, min/max/mean/p50/p95, degree histogram/max, ID type/length distribution, explicit isolated count, overlap construction, expected work W, exact serialized/native bytes and SHA-256 of OLD/update/NEW. Record changed/deleted/inserted row IDs and inserted incidences/novel vertices/replacements. All rows nonempty, no duplicate members, typed semantic IDs unique.

Deterministic seed default 731406; publish seeds 731406,731407,731408. Parameter grid below is a finite initial suite, not all Cartesian products. Generator uses a documented seeded PRNG and Fisher–Yates where needed; sorted typed-ID mappings follow existing contract. Store enough manifest data to regenerate exact bytes; use integer counters for truth, not floats.

| Family | Exact initial parameters | Purpose / lane |
| --- | --- | --- |
| S1 sparse-small | E16,k4,I64,V64, disjoint rows; IDs8 chars | Small Q overhead, zero connected motifs |
| S2 sparse-medium | E64,k8,I512,V512, disjoint rows; IDs8 | Q mid-range, upload/preparation |
| S3 sparse-large-qualified | E128,k4,I512,V512, disjoint rows; IDs8 | Q near work envelope: W4,096,512 |
| D1 dense-overlap-small | E16,k8,I128,V24; vertices0..3 common; remaining4 are4+(3e+j) mod20 for j0..3 | Q dense counts/bin contention candidate |
| D2 dense-overlap-medium | E64,k16,I1024,V128; vertices0..7 common; remaining8 are8+(3e+j) mod120 for j0..7 | Q overlap at W1,999,872; degree skew |
| H1 few-large-hyperedges | E3,k in {1024,16384,32768}, I=3k; identical rows on V=k; IDs8/128; reject any byte-bound case explicitly | Q low E/high I; transfer/preview skew; 32768 gives I98304 |
| H2 many-small-hyperedges | E in {100,128,216}, k1, V=E disjoint; E217/256 controls expected W rejection | Q candidate overhead/effective bound |
| K1 skewed qualified | E32; row0 contains hub0 plus vertices1..2047; row e1..31 contains hub0 plus7 private vertices2048+7(e−1)+j for j0..6; I2296,V2265 | Q high degree/cardinality skew |
| ID1 long IDs | S2 topology, ID chars {8,128,512}; mixed safe integer/string variant distinct by type | Q semantic mapping/hash bytes |
| B1 browser-10k | E10000,k4,I40000,V40000, disjoint; IDs8 | B only, import/history/UI |
| B2 browser-100k | E100000,k4,I400000,V400000, disjoint; IDs8 | B only, admission/heap |
| B3 million-incidences | E10000,k100,I1000000,V100000; row member(97e+j) mod100000 for j0..99 | B only, data path; Stage/analysis rejects |
| B4 multimillion | E100000,k20,I2000000,V1000000; member(20e+j) mod1000000 for j0..19, repeated chunks; optional k50/I5000000 uses(50e+j) mod1000000 | B only; stop at safety/admission envelope |
| B5 single-huge-edge | E1,I=V in {100000,1000000}; IDs8; separate two/four-row skew variant with same I | B preview vertex-budget stress; 1M rejected by motif I cap |

Rows use IDs e0..e(E−1); integer vertex ordinals above become v plus zero-padded six-digit ordinal, then x-pad to requested length. S families use disjoint row member ke+j. H1 rows all contain0..k−1. H2 singleton row e contains e. B1/B2 use the same disjoint construction; B5 row contains0..I−1. Mixed-type ID1 maps even ordinals to safe integers and odd ordinals to strings, preserving identity. GraphId=fixture-family-seed, graphVersion=1, graphType=DynamicHypergraph, explicit isolated vertices=0. Construction order and serializer version are part of the manifest.

Updates choose the first n numeric row ordinals deterministically. Replacement substitutes the last member with a fresh ordinal above the base maximum; new vertices for distinct rows are distinct. Insertions get fresh IDs ins0.. and take k consecutive domain vertices starting at3t modulo V, reducing k only if V<k (recorded; default bases avoid that case). U5 replaces the last p members with p novel ordinals. U4 uses delete-only e0/e1, replacements e2/e3 and insertions ins0/ins1. Seed variants may permute ordinal-to-semantic-ID labels using the published seeded PRNG, without changing intended topology; record the permutation and preserve numeric row selection. Reject any configuration that creates invalid duplicate/empty rows.

Motif density is measured from qualified STATIC truth as connected triples / choose(E,3), with taxonomy-bin distribution. Do not equate construction name with actual density. Q fixtures must satisfy W≤5M on BOTH snapshots and exact bytes before running. Some H1/ID1 combinations will be rejected by artifact bytes; preserve those observations rather than silently shortening IDs.

| Update family | Fixed parameters on a selected Q base |
| --- | --- |
| U1 insert-heavy | insert n in {1,2,4,8}; each new row same k as base; zero deletes; same-domain vertices; n limited by NEW W |
| U2 delete-heavy | delete n in {1,2,4,8}; zero insert; deterministic sorted row positions |
| U3 replace-heavy | delete/reinsert exact same IDs n in {1,2,4,8,16}; change exactly one membership per affected row, cardinality preserved |
| U4 mixed | deletes2 + replacements2 + novel-ID insertions2; report 4 deletions/4 insertions, not six affected rows per snapshot |
| U5 novel-vertex-heavy | replace1 row, substitute p in {1,2,min(k,8)} members with novel IDs; fixed E/I, common vertex union changes |
| U6 affected sweep | replacement fraction with a in {1,2,4,8,ceil(E/4),ceil(E/2),E}; unique nonduplicate rows, qualified budgets only |
| U7 metadata/no-op | weight/time/attribute-only and exact full no-op controls; metadata Analyze unavailable, no-op grants no pending authority |

For OLD/NEW separately record affected edge a and C=choose(E,3)−choose(E−a,3). For one affected edge C=choose(E−1,2). Deletion/insertion/replacement and isolated/novel vertex behavior must be distinguishable in manifest. Existing packer can retain vertices that become isolated; V_new must come from its actual canonical result.

Sustained families L1/L2/L3 use100/1000/10000 transitions respectively. Pure Stage/Edit/Apply lane runs without jobs; analyzed lane includes one genuine analysis per transition. Keep E/I bounded by alternating fresh exact replacements on S2/D2 and deterministic row positions. Every transition gets a fresh revision/digest/confirmation; never replay an approval to make a benchmark faster.

L2/L3 analyzed lane currently terminates at admission limits; report boundary and memory plateau. Only after 6C may these become sustained-success gates. L1 alone can hit artifact byte/item cap on larger fixtures; capacity is not implied by sequence count.

## Common run contract applying to EVERY B-series benchmark below

Each row in the benchmark table inherits this full contract; deviations are listed in that row.

- Hardware: CPU/model/logical cores/RAM, GPU/index/name/UUID/VRAM/compute/driver, storage type/free space, power state; display/browser viewport/DPR. Record other GPU processes/load and thermals when available. Use the qualified RTX5060/device0/sm120 environment for production CUDA claims; no public CPU runner substitutes.
- Software: OS/build, WSL/kernel/distro/version and path/mount location, browser/version, Node/npm, lockfile SHA, CUDA compiler/runtime, build flags/arch, native binary/source/Makefile/qualification SHA, repo commit and diff digest, feature flags/origins/ports. Record source versus Git-blob newline policy. Never record bearer/token or raw private graph data in shared metrics.
- Qualified byte identity: baseline b24c4e3, deployed exact bytes/hashes, taxonomy/schema and all manifest IDs. Future phases get new source/binary evidence.
- Warm replicates: five unmeasured warmups then30 measured samples per fixture/config, in each of three independent sessions. Paired treatments randomize AB/BA order with recorded seed; no concurrent jobs unless testing contention.
- Cold replicates: zero warmup,20 measured independent starts per fixture/config per session. State the cold reset: fresh tab/controller for browser, fresh Runtime/session/store for Runtime, fresh native process/context per job (current architecture). Do not call disk-cache warm data truly cold. OS page cache not forcibly dropped unless a separate documented experiment.
- Cold and warm datasets remain separate. Warming the current Runtime does NOT keep CUDA context/device arrays alive; every job still starts a process. Warm means reusable browser/JIT, service, OS or artifact state only.
- Clock: browser performance.now and Node monotonic hrtime; CUDA events for scoped device phases. Never subtract unrelated host clocks; correlate request/job/run IDs.
- Output: raw per-run JSONL or JSON samples plus manifest and aggregate JSON, checksum inventory and compact Markdown interpretation. Files belong to a future approved benchmark run, not this seven-file audit.
- Summary: n, median,p95, min/max, failure/cancel/rejection counts, bootstrap95% CI for paired difference/ratio and peak/retained memory; include raw failures rather than dropping them. Report p95 uncertainty with n30. Cross-session variation is part of results.
- Universal failure: wrong truth/binding, accepted stale output, implicit fallback, missing samples/metadata, infeasible input secretly changed, clock-boundary ambiguity, timeout/error omitted, leaked executable authority. Fail correctness immediately; classify performance inconclusive if CI overlaps threshold or variance exceeds declared noise.

## Named benchmark runs

| Run | Fixtures / warmup and repetitions | Cold/warm state and timing boundary | Metrics and expected output | Additional failure criteria |
| --- | --- | --- | --- | --- |
| B1 load/commit/history | S1/S2/ID1/B1–B5; common5+30 warm,0+20 cold | File-ready→parse complete; parse→commit published; commit→next rendered frame; history initially empty and separately at25 | load/commit p50/p95, long tasks, rows/copies, retained heap at history0/25, exact graph identity/content | UI freeze/admission budget exceeded; history/identity/undo mismatch |
| B2 Stage/Edit/preview/Apply | Q families × U1–U7; B graphs expected reject; common counts | Stage click→VALIDATED/error; Edit→fresh VALIDATED; preview toggle→paint; Apply confirmation→commit+paint; no analysis required | stage/edit/Apply times, preview heap/DOM/visual sample budgets, exactly-once commit and no Runtime jobs | Oversized input incurs forbidden full work after new early-budget gate; duplicate commit, no-op pending or metadata zero-delta fabrication |
| B3 artifact serialization/hash/upload | S1/S2/ID1/H1 × U1/U3; common counts | Separate graph projection, JSON encode, SHA, base64/envelope, each HTTP completion; empty-store and verified same-artifact repeat | exact bytes, graph/update digest, upload bytes/time, peak JS/RSS; fresh versus exact-cache hit | ID/media/length substitution accepted, stale handle reuse, envelope exceeds limit after nominal success |
| B4 Runtime service decomposition | Q families/U1–U6; common counts; queue-depth sweep0/1/4/16 | auth/discovery and submit receipt→admission→queued→prepare→spawn→native end→cleanup→result publication | per-stage service/queue times, admission RSS/bytes, qualification/read/hash/parse/pack costs, result bytes | Queue/admission deadline broken; active jobs evicted; cross-backend device ownership breach |
| B5 STATIC/incremental crossover | S1–S3/D1/D2/H1/H2/K1 × U1–U6 feasible tuples; common paired counts | Pair incremental OLD+update with standalone STATIC NEW benchmark; measure kernel, process and submit→accepted validated result separately; also browser click→render | signed30-bin parity using independent STATIC OLD/NEW truth; ratio/difference C, E/I/density/shape metadata; crossover surface | Any bin mismatch; comparing different output contract without label; automatic backend substitution |
| B6 soak/retention/recovery | L1/L2/L3 using S2/D2; soak warmup5 cycles discarded,3 independent full measured sequences; crash subcases common0+20 on small fixtures | Continuous tab/Runtime; checkpoint every25 transitions; cold restart/reload variants separate | heap/RSS/artifact bytes/jobs/maps/listeners/workers/URLs/timers/GPU peak, cleanup latency, plateau/slope, resource rejection point | Monotonic retained growth after GC/idle checkpoints, leaked child/process, stale adoption, lost Apply independence |
| B7 UI/Assistant/deployment | Q plus B1/B3/B5 and500-message chat; common counts; browser interaction script repeated30 after5 warmups | pan/select/search→paint; observation request→bounded JSON; configured model response parse; clean extracted launch/discovery | input latency/frame traces, DOM/node counts, observation/prompt chars, context prep, extracted source integrity, unavailable mode | Full large graph sent to model; unbounded response accepted after new bound; inert reload becomes executable; packaging assets incorrect |

For B6 reset/error loop, do not perform driver reset or destructive host controls on a user's active GPU. Dedicated release workstation/operator must approve controlled hardware fault injection in the later implementation task. Failed native launch and fixture-controlled allocation failure can cover much of failure behavior in CPU CI; label these simulated, not actual driver recovery.

## Instrumentation boundaries and feasibility

Current native JSON exposes kernelMilliseconds only; it cannot distinguish H2D/D2H/allocation/context/host candidate time. Current jobs have lifecycle and timestamps, but not every phase timestamp. Future benchmark-only spans/profiler traces are required before claiming those costs separately. Until then report whole-process duration and kernel duration without subtracting them as precise component allocations.

Browser spans: file-read/import parsing, canonical identity, history cloning, Stage preview/projection/digest/freezing, analysis feasibility, serialization/TextEncoder/hash/base64, upload OLD/update, submit, explicit status/result reads, strict validation and render. Apply includes rederivation and history.

Runtime spans: auth/discovery, artifact admission/decode/hash/write/read, qualification, queue entry/start, parse/canonicalize/update/pack, temp write, verifier/WSL spawn+ack, child duration, parse/validate, result write and cleanup. Record preparation bytes/counts and true deadline start.

CUDA profiler/instrumented research build: init/context, malloc/free, H2D, kernel, synchronize, D2H, host candidate generation and candidate counts. Use Nsight/device timing only where supported; profiling changes overhead, so keep profiler traces separate from uninstrumented latency runs. Instrumented binaries are research artifacts until newly qualified; no changes in this audit.

Browser heap: use supported DevTools/automation allocation snapshots and explicit engine/version; performance.memory is optional/nonportable. Record post-idle/forced-GC diagnostics separately from user latency. Node RSS/heap and external Buffers measured together; nvidia-smi samples may miss peaks, so label sampled lower bounds or use CUDA/profiler allocation accounting plus context/external uncertainty.

## Crossover policy and semantic guardrail

Benchmark STATIC NEW as a counterfactual on a separately committed benchmark fixture. It is not a product fallback for a pending incremental request, nor does it apply the proposed graph. Compare the same NEW truth, but label absolute counts versus signed delta output. Computing OLD STATIC for parity is validation work and excluded from the incremental timed request unless reporting whole test expense.

Fit an interpretable policy from E_old/E_new,I,affected candidates, inserted incidences, degree/cardinality skew, ID bytes, artifact presence and measured launch cost. Split fixture seeds/families into training and held-out validation; report classification mistakes and cost regret. Kernel crossover and user-latency crossover may differ.

Recommendation threshold: declare an optimization faster only when paired median end-to-end improvement≥10%, CI excludes zero improvement, no supported-fixture p95 regression>10% beyond noise, and retained memory/authority gates pass. These are proposed engineering gates to freeze after 6A noise/SLO review, not historical service guarantees. Smaller improvements may still justify simpler byte reuse if transfer/retained-memory gains are material.

Product can offer descriptive performance guidance within discovered qualified modes. It must not silently convert INCREMENTAL to STATIC, compute prior counts or change confirmation selection. A future explicit mode recommendation needs its own UX/authority review.

## Optimization experiments and go/no-go

1. Exact JSON bytes reuse vs current reserialize: verify identical hashes, upload savings and peak strings.
2. Presence handle/cache hit vs fresh upload: Runtime restart/eviction force safe miss; same graph ID/version/type/bytes and exact revision only.
3. Immutable host prepared cache vs reread/parse: pin budget and qualification invalidation; cold/warm data separate.
4. Current triple enumeration vs direct affected enumeration: new native build, independent 30-bin parity, checked candidate/allocation products.
5. Host vector lifetime/workspace reuse vs baseline: track host/device peak and cancel/error cleanup.
6. Persistent worker/pinned memory/pools/streams: proceed individually only if B4/B5 identifies material cost; each expands qualification scope.
7. Explicit draft composition: measure update bursts and affected-work growth; do not compare one batched final result to every intermediate result as equivalent service.

Do not benchmark 10k/100k edges through current qualified native kernel. Current gate is expected RESOURCE_LIMIT. Large native research requires a new bounded algorithm and reviewed workload budget before execution.

## Reproducibility artifact schema

Future run manifest fields: schemaVersion, runId, capturedAt, repoCommit, dirtyDiffDigest, fixtureId/seed/generatorSha, graph/update/new digests, nativeRequestDigest, taxonomy/backend/mode/device/qualification hashes, hardware/software, coldResetPolicy, warmup/repetition/session/order, timingDefinitions, configuredLimits, byte/retention budgets, observer/tool versions and limitations.

Each sample: runId, session, pair/order, iteration, timestamps/durations by defined span, status/error/rejection, E/V/I/rowStats/degreeStats/density/deletions/insertions/insertedI/replacements/novelV/oldC/newC, bytes, memory peaks/retained checkpoints, result/artifact digest,30 truth/delta bins and sum parity. Token excluded. Summary retains failed samples and references raw sample hashes.

## Execution lanes

Public CPU CI: generator determinism, bound formulas, packer/browser digest parity, exact size limits, correctness/currentness/cache/admission tests, package tests and lint/builds. Only cheap smoke timing with informational results on noisy runners.

Matching protected GPU CI/manual release host: B4/B5 real native runs and parity, executable/toolchain qualification, controlled cancellation and cleanup, B6 analyzed soaks. Never use fake capabilities as positive GPU evidence.

Manual real browser/extracted product: B1/B2/B6/B7 interaction, heap, reload/two-tab/Assistant and GitHub-hosted loopback policy. Installed-model test requires exact configured model digest/version; CPU fixture tests are separate.

No large expensive run is required to validate these seven documents. Future benchmark execution has explicit fixture bounds and stop criteria before resource escalation.
