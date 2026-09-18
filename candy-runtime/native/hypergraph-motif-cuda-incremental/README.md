# Scope 4B2 CUDA affected-triple delta

Standalone C++17/nvcc CLI: `build/candy-hypergraph-motif-cuda-incremental --request <regular-file>`. No Runtime Companion/capability/UI/model registration, CPU fallback, full STATIC recomputation, persistence or prior-count authority exists.

Build in WSL Ubuntu:

```sh
make -C candy-runtime/native/hypergraph-motif-cuda-incremental NVCC=/usr/local/cuda-13.4/bin/nvcc CUDA_ARCH=sm_120 all qualification-faults
node candy-runtime/test/run-hypergraph-motif-cuda-incremental-qualification.mjs
node candy-runtime/test/run-hypergraph-motif-cuda-incremental-qualification.mjs --sanitizer=memcheck
node candy-runtime/test/run-hypergraph-motif-cuda-incremental-qualification.mjs --sanitizer=racecheck
node candy-runtime/test/run-hypergraph-motif-cuda-incremental-qualification.mjs --sanitizer=initcheck
node candy-runtime/test/run-hypergraph-motif-cuda-incremental-qualification.mjs --sanitizer=synccheck
```

CUDA is mandatory, with fixed direct native or WSL argv, 60-second child timeouts and no shell execution of request contents. Four compile-time fault builds are isolated qualification executables; production accepts no fault flags. Build variables and toolchain are trusted local operator authority.

## Transport and semantic authority

The standalone JS transport reuses the qualified CANDY incidence/update adapters. Only the OLD DynamicHypergraph and qualified DELETE_THEN_INSERT batch are accepted as external inputs; the adapter derives NEW. Deletions affect old indices; insertions affect new indices, including delete/reinsert replacements. Typed IDs, identical-incidence distinct edges, isolates, inserted vertices, exact version progression and collision rejection retain qualified semantics. H2H/V2H and projections are forbidden.

Wire framing is exactly `CANDY_HYPERGRAPH_MOTIF_CUDA_INCREMENTAL_REQUEST_V1\nrequest_digest <lowercase SHA256>\n<payload>`. SHA-256 covers the UTF-8 payload bytes, and native independently verifies it. The digest provides integrity and request/result binding, not authentication or a proof that an untrusted local caller used the adapter.

Payload tokens occur in this exact order:

```text
algorithm HYPERGRAPH_3EDGE_MOTIF_COUNT
taxonomy candy.hypergraph-3edge-motif-taxonomy/1
mode INCREMENTAL
graph_type DynamicHypergraph
graph_id_u16 <lowercase UTF16 code-unit hex>
old_graph_version <safe integer>
new_graph_version <old+1>
update_id_u16 <lowercase UTF16 code-unit hex>
cuda_device <nonnegative INT32 index>
old_vertex_count <common vertex universe size>
old_hyperedge_count <n>
old_incidence_count <q>
old_edge_tags <n> <sorted unique common semantic tags>
old_offsets <n+1> <zero to q strictly increasing offsets>
old_memberships <q> <sorted unique rows of common vertex indices>
old_affected <a> <sorted unique affected native edge indices>
old_candidate_count <C(n,3)-C(n-a,3)>
new_vertex_count ...
new_hyperedge_count ...
new_incidence_count ...
new_edge_tags ...
new_offsets ...
new_memberships ...
new_affected ...
new_candidate_count ...
END
```

Each new-prefixed field follows the identical old-prefixed rule. Unknown/missing/trailing tokens are rejected. Both packed snapshots share NEW's vertex universe: new-only vertices are additional isolates in OLD and cannot change its motifs. Dense common semantic edge tags are derived from the union of typed edge IDs. Native verifies that all unaffected tagged edge rows match exactly between snapshots, rejecting omitted changed edges. The trusted adapter determines which unchanged delete/reinsert rows are affected and binds update identity.

Graph/update identities are bounded to 512 UTF16 units; graph versions are JS safe integers; decimal tokens have at most 16 digits. Both snapshots preserve <=256 edges, <=100000 incidences, <=1000000 vertices, and <=5000000 full-snapshot incidence visits. Nonempty edges imply <=216 realizable accepted edges. Request <=2MiB; candidates <=2763520 per snapshot and host tuple storage <=33162240 bytes per snapshot. CUDA processes the snapshots sequentially so only one candidate device buffer exists at a time. No external candidate tuples are accepted.

Local request-path read authority is explicit. A single bounded O_NOFOLLOW/O_NONBLOCK descriptor must refer to a regular file; final symlink/FIFO/directory rejection prevents races and hangs. Ordinary parent-directory resolution remains local OS authority.

## Exact delta and result

Host loops visit each i<j<k tuple once, retaining only those containing an affected index. They generate indices only. The count C(n,3)-C(n-a,3) is checked independently. GPU kernels merge three sorted H2V rows and classify seven exclusive region-presence bits using the CANDY-derived 128-entry S3 classifier (96 connected signatures, 30 classes, 24 closed and 6 open). Disconnected candidates count zero. Every candidate contributes at most once.

Unsigned 64-bit integer atomics accumulate old/new affected histograms. Both histograms are checked against their candidate bounds before conversion; checked bounded int64 subtraction yields `deltaCounts = newAffectedCounts-oldAffectedCounts`. The total is their signed sum. No CPU motif count, min-ID anchor ownership, two full STATIC calls or floating-point count accumulation is used. Generic helpers and mathematical classifier/merge logic originate only from project-owned Scope 4B1 source; no ESCHER archive source, lookup, CBST, parser/generator or update logic was accessed.

Success schema `candy.hypergraph-motif-cuda-incremental-result/1` returns `ok`, algorithm/taxonomy, CUDA_INCREMENTAL/INCREMENTAL, input/output graph refs, updateId/requestDigest, old/new affected-edge and candidate counts, old/new affected histograms, signed deltaCounts[30], signed deltaTotalConnectedTriples and CUDA device/build/launch/synchronization metadata. Two actual kernel launches and synchronization occur even with zero candidates. Cleanup succeeds before success is emitted. Event timing is informational.

The result is delta-only. Full old/new property counts are not accepted or claimed; stale prior-count fields are forbidden. Consumer validation requires branded adapter-derived context, exact keys, identity/version/update/digest/device binding, safe integers, histogram bounds and exact signed subtraction/sum. It reuses the unchanged STATIC CUDA-metadata validator without invoking STATIC. The external qualification harness alone reconstructs full counts against independent CPU and CUDA_STATIC authorities. Different-request replay fails binding; identical retry is deterministic and stateless, with no persistent anti-replay ledger.

Failure exits 1 with only `{ok:false,error:{classification,message}}`, never partial histograms/counts. Categories include INVALID_GRAPH_SCHEMA, INVALID_GRAPH_TYPE, INVALID_VERTEX, INVALID_UPDATE_BATCH, STALE_GRAPH_VERSION, UNSUPPORTED_MODE, RESOURCE_LIMIT, BACKEND_UNAVAILABLE, ALGORITHM_FAILURE and RESULT_VALIDATION_FAILURE. Failure-unwind cleanup is best effort. Missing binaries fail before harness temporary-directory creation.

Qualification is bounded correctness work on the recorded local toolchain/GPU. No speedup, portable linked-ELF hash, cryptographic executable attestation, persistent property store or application capability exposure is claimed. Insertion alone never changes an existing triple's class; tests add another class alongside an existing wedge, while replacements test true class conversion.
