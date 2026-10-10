# Scope 6A source release and provenance contract

This additive contract describes the uncommitted 6A candidate; it does not qualify
a new native build. Its machine-readable provenance is recorded separately in
`artifacts/candy-scope6a-release-manifest.json`.

| Identity | Commit / meaning |
| --- | --- |
| Scope 5 qualified | `54dd4d3edb73681f51bf8bb69b9708778a46a502`, peeled `candy-integration-scope5f-final-qualified` |
| Historical blocked | `bf0240a54fb6ac8284bd9ac371306511158a1a2e`, peeled `candy-integration-scope5f-browser-blocked`; permanently historical |
| Integration baseline | `b24c4e32100d2e7c05b13df3c8f6f9e279fd8828` |
| Scope 6 readiness / starting HEAD | `f8343ae195e37885726c396733dd6f5b9468f0fb` |

Blocked precedes qualified, which is an ancestor of integration, the parent of
readiness. Tags must not move. Old final JSON records precommit HEAD and
`allChangesUncommitted` because it was captured before the user committed the
correction/evidence. Those fields describe capture time. Later qualified tag
ancestry and browser-closure evidence establish subsequent closure; they do not
retroactively qualify the blocked tag. Scope 5 evidence is preserved.

The 6A manifest binds HEAD, the tracked binary diff digest and exact selected
source inventory, including intended untracked files. It describes a review
candidate, not a signed publisher release or executable grant.

## Browser-only source archive

The ZIP contains browser/Runtime source and production-imported contract modules
under `candy-runtime/test`. It excludes Git, generated/historical `artifacts`,
native `build`, Runtime `.local`, dependencies, caches, uploads, temporary files,
common key/token/secret files and executables. Intended uncommitted source files
are included. This filesystem exclusion policy cannot detect arbitrary secrets
with innocuous names: publish only a reviewed source tree.

Identical selected bytes, root name and compression implementation yield identical
ZIP bytes. Timestamps, order and modes are fixed: ordinary files 0644, approved
launchers 0755. The verifier checks traversal, symlinks, collisions, CRC and modes
before extraction. ZIP output must be outside the source tree. Qualified native
binaries and local records are never included.

Extracted source runs the browser with lockfile-defined `npm ci` and `npm run
build`/`npm run dev`. Runtime health can work; qualified CUDA stays unavailable
without exact local records/native bytes, protected Git tags, historical evidence
and matching device/toolchain. The verifier is unchanged. Regressions inspecting
historical evidence/Git require a full checkout; extracted qualification separately
checks browser build/usability and genuine unavailable CUDA.

A future CUDA-enabled standalone distribution requires an independently reviewed
release-verification contract binding signed identity, exact binary/source,
toolchain/device, taxonomy and qualification evidence. It is not implemented or
substituted for current verification in 6A. Unsigned local operator records prove
local consistency, not publisher authenticity.

## Actual bounds and byte policy

Unchanged motif limits: 256 hyperedges, 100000 incidences, 256 deletions and
insertions each, 100000 inserted incidences, 2 MiB packed native request, and
`I * (E-1) * (E-2) / 2 <= 5000000` on both snapshots (zero when E<3). Disjoint singleton E216 fits the
work bound; E217 fails. The edge-count limit alone is not a capacity promise.
Artifact upload is 6 MiB, JSON HTTP request 8 MiB. Native selector timeout remains
1..60000 ms. Client transport deadlines are separate: 15 seconds normally, 30
seconds for uploads, explicit overrides 1..120000 ms. No capacity is increased.

STATIC stays CUDA_STATIC, INCREMENTAL stays CUDA_INCREMENTAL, with 30 bins,
24 closed triangles, 6 open wedges, DELETE_THEN_INSERT,
REJECT_EXCEPT_EXACT_DELETE_REINSERT and DELTA_ONLY_NO_PRIOR_COUNTS. No fallback,
projection or large-browser-fixture native support is implied.

Git blobs may use LF while a Windows checkout uses CRLF. Source/ZIP digests bind
exact observed bytes; semantic newline equivalence is distinct from byte equality.
Deployed native binary/source/Makefile qualification still binds exact bytes
independently. Do not normalize deployed native bytes or rewrite old records.

## CPU and trusted GPU lanes

The workflow runs install, full current regressions, lint, production/GitHub
builds, deterministic bounds, package integrity, extracted build and production
audit. Public Ubuntu CI is a CPU lane: GPU live is UNAVAILABLE/SKIPPED. Simulated
contract tests are never native qualification evidence. Node 24.19.0 is observed
and tested, not a minimum support policy. Locally npm 11.6.2 runs from a temporary
pnpm tool cache because this host lacks npm; manifests/lockfile remain unchanged.

Immutable pins bind checkout v7.0.1 and setup-node v7.1.0, checked against upstream
tags: [checkout](https://github.com/actions/checkout/releases),
[setup-node](https://github.com/actions/setup-node/releases). CI has read-only
contents permission, no persisted Git credential, deployment, repository secrets,
self-hosted GPU runner or privileged pull_request_target/workflow_run trigger.
The trusted manual GPU lane requires operator-reviewed exact builds/device;
untrusted PR code must never execute on that privileged release host.

## Measurement support and limits

The fixture generator implements S1/S2/S3/B1 and published seeds, xorshift32
label permutation, exact shape/byte/work/hash manifests and a Q-lane packing
guard. B and future N inputs cannot enter native execution. Other families remain
specified in the preserved Scope 6 plan. The smoke measures production fixture
load, Stage/Edit/preview/Apply, JSON/hash/envelope accounting, retention and a
small authenticated Runtime request. Ephemeral qualification uses only generated
fixtures and private test controllers/session/confirmations. Its output contains
descriptive measurements; no credentials, approvals, live workspace handles or
private graphs. It does not accept user graph input or restore its output.

Existing process/kernel timings are captured only when real qualification is
available. Internal CUDA allocation/transfer and unexposed service spans stay
unavailable. Full cold/warm repetitions, distributions, crossover and speed
claims are deferred to a dedicated measurement run. This smoke cannot establish
throughput or large native capacity.
