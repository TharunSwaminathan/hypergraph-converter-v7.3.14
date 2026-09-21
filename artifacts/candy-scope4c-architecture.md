# Scope4C integration architecture and initial audit

Baseline: `candy-integration-scope4c-runtime-integration`, HEAD
`1df4890e8bc80be44a5324727c00fde8cbbc01c6`. The working tree was clean;
all seven protected qualification tags matched the supplied peeled commits.

The existing optional Runtime owns loopback binding, random pairing credentials,
exact Origin checks, content-addressed private artifacts, UUID jobs, cancellation,
and backend discovery. The browser owns the committed incidence graph. Its
existing Runtime hook exposes only cardinalities and rejects submission because
it has no authoritative artifact payload. ReAct already has strict one-action
steps, bounded observations, eight iterations, and expensive CUDA confirmation.
These boundaries are reused rather than replaced.

The qualified static and incremental native directories and qualification
harnesses are frozen. Runtime imports their unchanged qualification transport
adapters. STATIC routes exclusively to CUDA_STATIC; INCREMENTAL routes
exclusively to CUDA_INCREMENTAL. The latter accepts an immutable OLD graph and
qualified update artifact. The trusted adapter alone derives NEW, affected sets,
candidate counts, and the native request digest. No prior count state or count
reconstruction is introduced. Results are analysis only.

Readiness is independently verified per backend against an ignored local operator
record: fixed executable, binary/source/Makefile hashes, protected qualification
commit, qualification evidence hashes, actual GPU and nvcc probes. This unsigned
record establishes local consistency, not publisher authenticity. Missing or
stale records fail closed. Requests cannot choose an executable, directory,
environment, distro, URL, token, packed request, NEW graph, or candidate set.

The shared job manager needs a serialized bounded motif queue and shutdown drain.
The existing Windows runner kills its Windows WSL client without proving Linux
child termination; integration must use a fixed supervisor and Linux process-group
termination, wait for cleanup, and verify cancellation/timeout without native
fault modifications. Artifact reads need digest revalidation against local
substitution. Accepted result wrappers must bind job, Runtime session, graph and
update digests, mode, device, taxonomy, and native execution metadata.

The current Studio explicitly types its committed graph as Hypergraph. Static
analysis can upload that canonical incidence snapshot. Incremental analysis must
have an explicit authoritative DynamicHypergraph plus pending qualified update
context; absent such context it is unavailable, never inferred from visual
appearance or invented by the model. Browser and ReAct receive only bounded
context selectors and validated result summaries. Generic status/cancel/open
actions remain shared, and every action is rechecked against current state.

Mode A continues to import browser-only modules. Node, WSL, CUDA and process APIs
remain confined to the optional Runtime. Existing SSSP capability contracts,
parser review/apply boundaries, feature flags, and legacy ActionPlan behavior
must remain intact.

Qualification will exercise Windows Runtime authenticated HTTP through fixed
Ubuntu WSL executables on RTX 5060, browser client/UI, and installed local
qwen3:8b; preserve historical native evidence while recording fresh Scope4C
regressions; then run application gates and a fresh sealed complete security
review. Initial live probes confirmed RTX 5060 / CC12.0, nvcc13.4.59, and a real
qwen3:8b READY response. WSL was kept active to avoid listener startup races.

Status: architecture audit recorded before implementation; qualification pending.
