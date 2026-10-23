# Scope 6D bounded implementation plan

READY FOR BOUNDED SCOPE 6D IMPLEMENTATION

Baseline: `46ae55173407bb71683614ef212d9d4d4127ecc3`. This recommends one
first tranche only. No native optimization has been implemented.

## Tranche 1 — incremental host candidate-vector lifetime, class B

Target only orchestration inside `execute()` in
`candy-runtime/native/hypergraph-motif-cuda-incremental/src/main.cu:343`.
Keep `candidates()`, `affected_count()`, parsing, classifier, kernels, bounds,
wire framing, result schema, backends and Runtime/browser authority unchanged.

Today both vectors coexist before either pass. Instead:

1. Derive the same classifier, then construct/count OLD within a scope returning
   only its fixed 30-bin counts and validated actual candidate-vector size.
2. Destroy OLD vector before constructing NEW in a second scope.
3. Preserve both validated lengths before destruction, all old/new histograms,
   signed subtraction, output order/metadata, two launches/synchronizations even
   with zero candidates, and checked release-before-success behavior.

Do not return a reference into a vector or retain it through a lambda capture.
For full-replace-216, prospective peak live candidate element payload changes
from `12(C_old+C_new)=39,752,640` bytes to
`12 max(C_old,C_new)=19,876,320` bytes. This is an expected structural 50%
reduction, not a measured optimized result or a promised 50% RSS/VRAM reduction.
Existing device snapshots are already sequential; device payload peak should
remain 19,878,804 bytes. Work budget and effective edge ceiling remain unchanged.

This tranche has an auditable memory outcome. It does not solve one-shot setup,
JS packing, high-cardinality GPU parallelism, or larger-edge admission. No
latency speedup or new scale is claimed.

## Build and qualification boundary

1. Preserve exact baseline source, Makefiles, binaries, records and historical
   evidence by hash. Build a candidate in an isolated output path; do not rebuild
   over the qualified executable merely to compare it.
2. Implement only scoped lifetimes plus relevant regression/profiling fixtures.
   An internal value/helper may return counts and validated tuple length;
   external API/schema fields do not change.
3. A source/binary change must invalidate the old Runtime qualification record.
   That is expected fail-closed behavior. Experimental binary comparisons use an
   explicit offline qualification harness and exact candidate hashes, without
   bypassing production verification or installing an unqualified candidate.
4. Production advertisement/promotion is a later reviewed binding step. Current
   `MOTIF_SPECS` pins historical Scope4 records/tags/evidence. Fresh versioned
   qualification/sanitizer evidence and record/spec identity must bind the new
   exact source, Makefile, binary, toolchain, GPU and approved qualified commit.
   Never rewrite old evidence/tags or silently relax those checks. Existing native
   wire/result and record schemas need no extension for this change. If any
   schema/protocol extension is proposed, STOP for human review.

## Correctness gates — any mismatch is a hard failure

- Reproduce all 30 baseline cases and exact 30-bin STATIC / signed incremental
  parity. Also compare incremental old/new affected histograms and candidate
  counts, including zero-delta cases. Exclude only timing and expected new build
  fingerprint from semantic comparisons.
- Re-run existing standalone native qualification into new additive candidate
  evidence: historical inventories are 487 positive / 69 negative STATIC and
  405 positive / 104 negative INCREMENTAL. Verify current inventories rather than
  assuming these counts cannot change.
- Cover all 96 connected region signatures, 30 S3 orbits and edge permutations;
  numeric/string IDs, Unicode/lone-surrogate identity, distinct identical edges,
  isolates, unchanged/changed delete-reinsert replacements, no-op,
  insertion-only, deletion-only, zero/one/two edges and zero affected candidates.
- Add at least 200 seeded bounded OLD/update/NEW randomized transitions with an
  independent set oracle. Require OLD counts + signed delta = NEW counts for
  every bin; this never introduces production CPU or STATIC fallback.
- Preserve DELETE_THEN_INSERT, semantic tags, unaffected-row verification,
  digest/version binding, delta-only output and independent Analyze/Apply.

## Resource, failure and lifecycle gates

- Both full host candidate vectors must never coexist. Verify lexical RAII scopes
  and validated length capture; payload peak is at most `12 max(C_old,C_new)`
  within the existing reserve cap. GNU-time RSS is a process-memory proxy;
  allocator caching can prevent RSS falling by the whole payload reduction.
- Retain all count/byte/work/grid/checked-product guards. Re-run malformed input
  and cap±1 cases. Never raise a limit to make a benchmark pass.
- Run memcheck, racecheck, initcheck and synccheck on sparse/dense/local/high-impact,
  high-cardinality and zero-candidate fixtures. Any error is a hard failure.
- Inject OLD/NEW host allocation and CUDA allocation/copy/launch/sync/free
  failures in isolated fault builds. NEW may now fail after OLD GPU work; keep
  counts private and never emit partial success. Cleanup must complete or fail
  truthfully. Do not add production fault parameters.
- Test cancel/timeout in each phase, shutdown with queued/running work, abrupt
  parent death, restart/reconciliation, stale session/job/result rejection and
  subsequent valid work. Re-run five Scope6C regressions. Once a candidate is
  eligible for production qualification, repeat genuine long-session and browser
  recovery gates on the exact final bytes.

## Measurement and acceptance

Collect at least 30 interleaved baseline/candidate pairs for local-216,
full-replace-216, high-impact-128 and representative STATIC controls, recording
order and first/warm process labels. Use the same GPU/toolchain and serial jobs.
Record background conditions without inventing isolation. Keep Nsight captures
separate from unprofiled Runtime timings.

Require exact correctness, unchanged admission, intended live payload bound,
no leaks/sanitizer errors, zero owned processes after drained work and no material
latency regression. Proposed review gate: investigate/reject matched end-to-end
p95 growth over 10%; gather more paired samples when noise is ambiguous. This is
a proposed tranche gate, not a retroactive readiness threshold. Report absolute
milliseconds and payload/RSS differences; do not claim speedup from three
baseline samples or one profile.

After actual implementation, run full tests, lint, build, build:github and
production audit. Record exact then-current test count and zero production
vulnerabilities. Readiness-only verification ran five Scope6C files, taxonomy
derivation and both native transport contract files; it did not rerun the
historical full 284-file suite or 1,000-job soak.

## Later options — no automatic second tranche

An A experiment could replace the full affected-candidate scan: for each `(i,j)`,
emit all `k>j` if either prefix index is affected, otherwise only sorted affected
`k>j`. Prove tuple-for-tuple equality, order and uniqueness independently before
considering it. It is outside tranche one.

Per-request device-buffer lifetime reuse is a separate B experiment. Compact
STATIC launching/cooperative high-cardinality merges are C experiments.
Any D budget proposal needs its own safe-work model and demonstrated scale.
Persistent workers are E and require STOP/human review. One-shot overhead makes
them a future investigation, but the first tranche does not require a worker
protocol and does not authorize one.

Stop after the first tranche is implemented/qualified for review. Do not start a
second tranche, commit, push, tag, merge or modify main without a later explicit
user instruction. This readiness task stops before implementing even tranche one.
