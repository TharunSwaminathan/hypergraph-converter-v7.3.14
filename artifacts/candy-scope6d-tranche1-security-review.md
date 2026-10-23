# Scope 6D tranche 1 security and resource review

Scope: the actual uncommitted change to `candy-runtime/native/hypergraph-motif-cuda-incremental/src/main.cu`, based on `46ae55173407bb71683614ef212d9d4d4127ecc3`. Review included `execute()`, its candidate/counting callees, request parser, checked resource wrappers, result publication, native supervisor, and Runtime qualification/admission boundaries. This is a focused source and resource review, not a repository-wide vulnerability scan.

No unresolved Critical or High issue was found in this tranche.

| Concern | Evidence and conclusion |
| --- | --- |
| Use-after-free, aliases, captures | Each vector is a local value in its own lexical block. `affected_count()` completes synchronously before block exit. Its unchanged signature borrows the vector only for that call. Only two fixed 30-element histograms, scalar lengths, and elapsed time survive. No pointer, reference, span, lambda, or asynchronous host use survives either block. |
| Actual candidate length | `candidates()` still checks generated length against the independently parsed candidate count. `execute()` copies the returned vector's actual `size()` into `size_t`; serialization does not substitute an unchecked declaration. |
| Integer and allocation overflow | Checked `multiply()`, candidate byte bound, work formula, parser limits, Triple layout assertion, grid checks, count validation and signed subtraction bounds are byte-identical. The new code introduces no multiplication or narrowing conversion. |
| Malformed offsets / CUDA bounds | Parser endpoints, strictly increasing offsets, bounded sorted memberships, affected-index checks, unchanged-row verification and CUDA kernel remain unchanged. Matched malformed-request rejection and four sanitizer tools pass. |
| NEW failure after OLD | OLD histogram remains local stack state. No stdout success is written until both passes, subtraction, runtime/driver metadata checks, and checked release return. All seven injected NEW failure positions return only error JSON; subsequent valid work succeeds. Fault hooks exist only in isolated generated diagnostic copies. |
| Cleanup | `affected_count()` and DeviceBuffer/Event checked-release/destructor code are unchanged. Host-vector destruction occurs during exception unwinding. Diagnostic allocation traces return to zero. Process cancellation and parent-death cleanup were exercised through the real supervisor. |
| Cancellation and stale results | OLD/NEW/between-phase cancellation, timeout, Runtime shutdown, parent death and fresh-session reconciliation pass. No owned live or zombie process remains. Cancelled/failed jobs publish no result; prior handles and credentials lose authority after restart. |
| Qualification | The historical incremental record rejects the changed source, and ordinary authenticated capability discovery omits CUDA_INCREMENTAL. STATIC remains available. Candidate/diagnostic binaries remain isolated. Explicit offline test configuration never changes records, tags, CLI configuration, or installed binaries. |
| Limits / authority | No schema, protocol, Runtime, browser, cache, authentication, manifest, Makefile, STATIC source or admission limit changed. CPU set counting is confined to validation. There is no production CPU/STATIC fallback, Analyze-to-Apply coupling, persistent worker or new cache. |

The only reordered preconditions are classifier construction before vector allocation and delayed NEW allocation after OLD completion. Both still fail before success publication. The existing compile-time allocation fault remains inside OLD's scope before its count call. Hardware driver failures are not claimed to have been physically induced; isolated diagnostic hooks inject exceptions at phase boundaries to test unwinding and publication behavior.

Supporting evidence: source-diff, parity, randomized, taxonomy, boundaries, sanitizers, faults, memory, lifecycle, profile-analysis and project test-results JSON files with the `candy-scope6d-tranche1-` prefix. Final inventory binds the reviewed source and isolated binaries by SHA-256.
