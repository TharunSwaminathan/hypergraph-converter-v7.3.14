# Scope 6A targeted security review receipt

Scan: 8e5c51a0-903e-4ad5-b13a-8ceb568021c3. Working tree at f8343ae195e37885726c396733dd6f5b9468f0fb.
Supplied Scope 6 threat model retained verbatim; SHA256 95d7da71b01d3c52f58d198cef7556679dc9d72a8e9b6d71b6e947f5259d1107.
Two independent read-only discovery workers reviewed the browser lifecycle and release/tooling partitions. Both returned zero candidates. Root reviewed metadata outputs and integrated evidence. No unresolved reportable issue in the changed surfaces.

Browser boundary: createCandyClient merges owned generation and per-operation cancellation, bounded deadlines span fetch and response-body reads, listeners/timers removed in finally. Per-method options admit signal and timeout only. Controller revokes confirmation/result authority synchronously before remote cleanup. Existing exact application/session/job/update/result digest currentness checks remain after awaits. Confirmation is consumed before await. Mounted React hook regressions hold uploads/status/result/discovery and exercise disconnect/retry/unmount. Late fixture responses are contract-valid test fixtures, not genuine CUDA qualification.

Message boundary: all five live append paths use appendLiveMessage, maximum 500. Pending/action/current result owners remain outside the helper. Persistence removes actions and pending authority. 10,000 append equivalents peak at 500. Existing selector/currentness and read-only wrapper regressions passed; no mounted 500-message stress claim.

Download boundary: only locally constructed Blob URLs are dispatched. Registry retains URL/timer, not export text. Anchor removed in finally; delay releases URLs; teardown and errors release immediately. Generated constant/timestamp filenames introduce no input path sink. 1,000 injected downloads retain zero URLs/timers. Real Chrome h2v export independently matched all 29 expected bytes.

Release boundary: producer/verifier exclude native build/.local/known secret/temp patterns case-insensitively, preserve required production-imported Runtime test contracts, and retain traversal/symlink/CRC/mode checks. Actual/clean/populated archives match SHA256 ba30c6352cb11595c9534c6df43aba44d84139d64e80095a99911c3ea82522cb, 1,667,220 bytes, 887 entries; zero integrity issues. Both CUDA backends unavailable in external extraction without Git/evidence. motifQualification.js unchanged.

CI boundary: immutable action SHAs, read-only permissions, persist-credentials false, no secret inputs, no privileged GPU/self-hosted/pull_request_target trigger. CPU runner explicitly reports GPU UNAVAILABLE/SKIPPED. Static contract tests passed; remote GitHub execution not run.

Measurement boundary: deterministic public fixture metadata, no persisted credential/approval/private raw graph, Q admission before native dispatch, B/N refused. Real bounded STATIC S1 smoke verified 30 zero counts; no capacity or crossover conclusion. Provenance describes local unsigned source/archive identities and four historical anchors; not authority or publisher attestation.

Limits: cancellation cannot remotely cancel an accepted job if its response/job ID is lost; unchanged bounded native job limits still apply. Message count is not a byte budget. URL dispatch lifetime is bounded, not maximum simultaneous count. Packaging excludes known secret patterns, not a proof against arbitrarily named secret files. Full paired incremental distributions, remaining fixture families, CI remote execution and GPU CI are outside this qualification.

The frozen 20-file source inventory SHA256 is d939cf867916e666160e7e4909df146610c4c21a3ca05ccbc521183258cba97e. Worker start/end hashes match the release manifest. Subsequent changes are additive descriptive evidence only. Historical Scope 5/6 records, dependency manifests, native implementations and historical tags remain unchanged.
