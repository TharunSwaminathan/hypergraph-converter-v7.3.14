# Scope 6C Runtime contract

The Runtime reuses data, never qualification, graph, pending-update, session or
mutation authority. Native sources and protocols remain unchanged: each native
job is one-shot; persistent workers require a separately qualified later scope.

One FIFO execution lane serves motif and SSSP backends. At most 16 active/queued
jobs and 4 protected HTTP operations are admitted; the HTTP server permits 32
connections. Queue residence is at most 60 seconds; the separate end-to-end job
deadline is 120 seconds, including preparation and cleanup. Existing selected
native timeouts and byte/work limits remain independently enforced. Overload and
expiry fail explicitly; cancelled/expired queued jobs never launch.

Terminal history retains the newest 32 jobs within 16 MiB of serialized job
payload/result/error accounting. Active jobs are never evicted. Storage pressure
can expire older terminal jobs earlier. Expiration unpublishes the job before
unpinning/deleting its unshared outputs. Unknown/expired job or artifact handles
return HTTP 404; UUIDs are never rebound. The legacy SSSP exact-request retry
contract is limited to retained jobs. Motif deduplication is in-flight only.

Artifacts retain at most 512 items / 64 MiB, with existing 6 MiB item admission.
Unpinned artifacts use deterministic LRU. If these cannot make room, storage
expires oldest terminal owners, preserving every active-job pin. At most four
artifact writes own buffers concurrently. Reads pin their bytes while checking
regular-file shape, containment, length and digest. Failed/cancelled job outputs
are removed; cleanup failure is reported and blocks new job admission.

The CLI uses one marked stable root per checkout in the current user's temp
directory. An exclusive OS-managed loopback TCP lease, keyed by canonical root,
serializes ownership before inspecting stale PID material. Its port is in
12000..31999; a collision fails closed. It accepts and immediately closes sockets,
serves no protocol/data, and is held through final deletion. The kernel releases
it on process death. PID files are diagnostics, never ownership authority.
Roots are private to one local host/network namespace; sharing a root across
hosts, containers or Windows/WSL Runtime instances is unsupported. WSL native
children do not own the Windows Runtime store.

Startup reconciles only recognized regular digest files and owned request
workspaces under the marked root. Persisted bytes never restore metadata,
jobs, results or approval. Unknown entries, links, changed roots and cleanup
failures fail closed. Cleanup uses bounded regular-file unlink and empty-directory
removal, with bounded retries for transient filesystem sharing errors; no
recursive production deletion. A caller-supplied root must be empty or previously
marked by this Runtime. Programmatic default roots are isolated and their caller
owns crash cleanup; the supported CLI provides stable restart reconciliation.

Fresh bytes key the immutable qualification JSON parsing cache (16 entries /
4 MiB source-byte accounting). Every verification still rereads and validates
files, hashes, evidence, tags and device/toolchain. Discovery shares one fresh
environment observation within that call only. Source-byte budgets and serialized
accounting are deterministic bounds, not direct heap measurements.

Browser uploads use exactly the hashed text. The tab-local data cache retains at
most four entries / 8 MiB, keyed by endpoint, Runtime session, SHA, media and length;
reuse requires authenticated metadata revalidation. Eviction gives a safe reupload
miss. Every analysis has fresh confirmation/request/job/result bindings. Analyze
never applies. STATIC remains CUDA_STATIC; pending delta remains CUDA_INCREMENTAL.

An authenticated lightweight session check runs every two seconds while paired,
with a three-second transport deadline. Loss, unauthorized transport, or session
change revokes readiness, capabilities, confirmations and current results.
Reconnect and fresh pairing/discovery are explicit. Restart creates new random
credentials/session and an empty job Map. Graph/pending proposal remains browser
owned; an old result cannot become current after reconnect.
