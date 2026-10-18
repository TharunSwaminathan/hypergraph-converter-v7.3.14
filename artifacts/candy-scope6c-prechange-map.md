# Scope 6C current Runtime prechange map

Baseline: 61e3dda985b74be35e98f1e6b3886d33b58a4bfd. Captured before any production edit. Historical Scope6 findings mapped to current Scope6B source; source inventory hashes exact checkout bytes.

## A. CLI startup

- fileFunction: candy-runtime/src/cli.js: top-level / stop
- stateCreated: Random token file, service handle
- lifetime: Process
- cleanupPath: SIGINT/SIGTERM unlink and close; abrupt death leaves file
- repeatedSetupCost: Full startup discovery
- processCreationCost: Qualification probes; no native launch
- qualificationDiscoveryCost: Full startup
- concurrency: Single service
- retentionBound: One token/service
- restartBehavior: Fresh token; no stale-file reconciliation
- authorityDependency: Private bearer file and loopback service

## B. HTTP startup

- fileFunction: candy-runtime/src/server.js: startCandyRuntime
- stateCreated: Store, jobs, HTTP listener
- lifetime: Process
- cleanupPath: close; startup exception cleanup incomplete
- repeatedSetupCost: Full discovery before listen
- processCreationCost: Qualification git/WSL probes
- qualificationDiscoveryCost: Full startup
- concurrency: HTTP handlers parallel
- retentionBound: Per-body 8 MiB; aggregate unbounded
- restartBehavior: New objects/default temp root
- authorityDependency: Loopback, exact origin, bearer

## C. Authentication

- fileFunction: candy-runtime/src/auth/sessionAuth.js: createSessionAuth
- stateCreated: Random 32-byte bearer; manager session UUID
- lifetime: Process
- cleanupPath: Process exit; CLI unlink
- repeatedSetupCost: Timing-safe token comparison
- processCreationCost: None
- qualificationDiscoveryCost: None
- concurrency: Synchronous
- retentionBound: One token + one session UUID
- restartBehavior: New random credential and UUID
- authorityDependency: No persisted approvals or tokens in responses

## D. Discovery

- fileFunction: candy-runtime/src/capabilities/capabilityRegistry.js: buildCapabilityDeclaration
- stateCreated: New declaration on every request
- lifetime: Response
- cleanupPath: GC
- repeatedSetupCost: Rebuild and reread every time
- processCreationCost: Per-backend environment probes and Git
- qualificationDiscoveryCost: Every call full
- concurrency: Parallel HTTP calls can overlap
- retentionBound: No retained cache
- restartBehavior: Recomputed
- authorityDependency: Fresh exact qualified source/device truth

## E. Qualification

- fileFunction: candy-runtime/src/capabilities/motifQualification.js: verifyQualifiedMotifBackend; cudaQualification.js
- stateCreated: Parsed records/evidence, hashes, device metadata
- lifetime: Call
- cleanupPath: GC
- repeatedSetupCost: All bytes reread/reparsed, Git and environment probed
- processCreationCost: Motif Git + 3 environment commands per backend
- qualificationDiscoveryCost: On discovery, motif admission, native launch
- concurrency: No aggregate verification admission
- retentionBound: 16 MiB regular-file read bound; no parse cache
- restartBehavior: Reestablish from disk/device
- authorityDependency: Exact record/source/binary/evidence/tag/environment, no fallback

## F. STATIC motif

- fileFunction: src/candy/motifWorkflow.js: submitMotifWorkflow; candy-runtime/src/backends/motifJobAdapter.js: prepareMotifJob
- stateCreated: Graph artifact, packed request, fresh job/result binding
- lifetime: Job
- cleanupPath: Workspace removed; job/artifacts retained
- repeatedSetupCost: Projection/hash/upload/parse/pack and launch repeated
- processCreationCost: One fresh native process
- qualificationDiscoveryCost: Admission and launch verify
- concurrency: Serialized motif queue
- retentionBound: Native E/I/work/bytes limits
- restartBehavior: Old jobs lost
- authorityDependency: CUDA_STATIC, absolute 30-bin counts; explicit approval

## G. INCREMENTAL motif

- fileFunction: same workflow/adapter + hypergraphUpdateAdapter
- stateCreated: OLD/update artifacts; reconstructed NEW; packed request
- lifetime: Job
- cleanupPath: Workspace removed; job/artifacts retained
- repeatedSetupCost: Full exact OLD/update parsing/reconstruction
- processCreationCost: One fresh incremental process
- qualificationDiscoveryCost: Admission and launch verify
- concurrency: Serialized motif queue
- retentionBound: Both snapshots within qualified bounds
- restartBehavior: Old jobs/results not restored
- authorityDependency: Exact pending identity; CUDA_INCREMENTAL; Analyze independent of Apply

## H. Native launch

- fileFunction: candy-runtime/src/backends/nativeProcessRunner.js: run; nativeSupervisor.sh
- stateCreated: Child/group, pipes, bounded stdout/stderr, timers
- lifetime: One request/process
- cleanupPath: Abort/timeout group kill; close listeners/timers
- repeatedSetupCost: WSL launch and CUDA context each job
- processCreationCost: One setsid/bash/native request; kill helper if needed
- qualificationDiscoveryCost: Fresh executable verification
- concurrency: Motif serial; SSSP outside motif queue
- retentionBound: Timeout + output limits
- restartBehavior: Abrupt parent cleanup not established
- authorityDependency: Fixed argv; parent acknowledges group before execution

## I. Validation/parsing

- fileFunction: server.js: decodeArtifactUpload; http/httpUtils.js: readJsonBody; jobs/jobManager.js: submit/execute
- stateCreated: Body chunks, decoded/copy buffers, JSON objects
- lifetime: Request/job
- cleanupPath: GC/finally workspace cleanup
- repeatedSetupCost: Repeated JSON and strict schema validation
- processCreationCost: None beyond qualification
- qualificationDiscoveryCost: Before backend execution
- concurrency: Many authenticated readers possible
- retentionBound: 8 MiB body / 6 MiB artifact; no aggregate reservation
- restartBehavior: Partial request not committed
- authorityDependency: Independent schema/content/hash/currentness validation

## J. Graph/update payload

- fileFunction: src/candy/motifWorkflow.js; motifJobAdapter.js: prepareMotifJob
- stateCreated: Serialized strings, base64, artifacts, packed OLD/NEW
- lifetime: Request/job
- cleanupPath: GC; disk quota retains
- repeatedSetupCost: Workflow hashes text but uploads object, serializes again
- processCreationCost: None
- qualificationDiscoveryCost: Independent qualification
- concurrency: Sequential upload then submit
- retentionBound: 6 MiB decoded / 2 MiB packed; no browser presence reuse
- restartBehavior: Must upload into fresh service
- authorityDependency: Artifact SHA/media and exact graph/update refs

## K. Job creation

- fileFunction: jobs/jobManager.js: submit
- stateCreated: UUID, cloned request/snapshot/payload, AbortController
- lifetime: Runtime lifetime
- cleanupPath: No eviction
- repeatedSetupCost: Qualification before quota
- processCreationCost: Verification helpers
- qualificationDiscoveryCost: Fresh motif verification
- concurrency: Concurrent admissions race around await
- retentionBound: maxJobs 256 all states
- restartBehavior: New Map; old IDs unknown
- authorityDependency: Strict request and artifact binding

## L. Queue

- fileFunction: jobs/jobManager.js: motifQueue / submit microtask
- stateCreated: Promise chain and captured jobs
- lifetime: Until execution
- cleanupPath: Settlement
- repeatedSetupCost: Residence outside native timeout
- processCreationCost: None until launch
- qualificationDiscoveryCost: May occur before queueing
- concurrency: Motif serial; SSSP bypass
- retentionBound: Only lifetime job ceiling
- restartBehavior: Queue lost
- authorityDependency: Cancelled queued job checks abort before execution

## M. Execution

- fileFunction: jobs/jobManager.js: execute
- stateCreated: Parsed graph, workspace, packed request, native result
- lifetime: Execution
- cleanupPath: finally removes workspace
- repeatedSetupCost: Parse/pack/temp write and launch
- processCreationCost: One one-shot child
- qualificationDiscoveryCost: Runner verifies again
- concurrency: Motif one; SSSP concurrent
- retentionBound: Per-job limits; no end-to-end deadline
- restartBehavior: No resume
- authorityDependency: Exact native validation before result acceptance

## N. Cancellation

- fileFunction: jobs/jobManager.js: cancel; nativeProcessRunner.js: terminate
- stateCreated: Abort state + terminal error
- lifetime: Job
- cleanupPath: Runner group cleanup; workspace finally
- repeatedSetupCost: Bounded kill helper work
- processCreationCost: Windows kill helper (retry at most once)
- qualificationDiscoveryCost: No new qualification for cancel
- concurrency: Queued/active idempotent
- retentionBound: Terminal record remains forever
- restartBehavior: Old handle unknown
- authorityDependency: Local browser authority revoked before HTTP await

## O. Publication

- fileFunction: jobs/jobManager.js: execute/result; src/candy/motifResultRegistry.js
- stateCreated: Result artifact + fullResult + one browser evidence
- lifetime: Runtime job / browser current context
- cleanupPath: No Runtime eviction; browser clear
- repeatedSetupCost: Strict parse/digest/binding
- processCreationCost: None
- qualificationDiscoveryCost: Result binds selected executable fingerprint
- concurrency: Motif publishes after cleanup; SSSP before finally cleanup
- retentionBound: Result <=8 MiB, Runtime max256 jobs; browser registry1
- restartBehavior: Old result rejected
- authorityDependency: Never mutation authority; 30-bin binding exact

## P. Artifact creation

- fileFunction: artifacts/artifactStore.js: put/putOwned
- stateCreated: Owned buffer, SHA filename, frozen metadata
- lifetime: Runtime/store
- cleanupPath: Only full dispose
- repeatedSetupCost: Copy before queued quota check; hash/write
- processCreationCost: None
- qualificationDiscoveryCost: None
- concurrency: Serialized writes, unbounded waiting copies
- retentionBound: 512 items / 64 MiB / 6 MiB item
- restartBehavior: Override files remain unaccounted
- authorityDependency: wx, regular-file and exact collision checks

## Q. Artifact lookup

- fileFunction: artifactStore.js: metadata/read
- stateCreated: Metadata and verified read buffer
- lifetime: Call
- cleanupPath: GC
- repeatedSetupCost: lstat/realpath/read/hash every read
- processCreationCost: None
- qualificationDiscoveryCost: Content integrity independent of backend
- concurrency: Reads may overlap
- retentionBound: Per-file bound
- restartBehavior: Only current metadata recognized
- authorityDependency: Digest/media/length and containment; no symlink

## R. Artifact retention

- fileFunction: artifactStore.js: metadataById/dispose
- stateCreated: All accepted files
- lifetime: Until close(default) or indefinitely(override)
- cleanupPath: Recursive root disposal(default)
- repeatedSetupCost: Quota summation each put
- processCreationCost: None
- qualificationDiscoveryCost: None
- concurrency: No pin or eviction
- retentionBound: 512 /64 MiB current metadata only
- restartBehavior: Override stale files not reconciled
- authorityDependency: Root must be regular directory; no owned selective deletion

## S. Job retention

- fileFunction: jobManager.js: jobs Map
- stateCreated: All terminal + active payload/results
- lifetime: Entire Runtime
- cleanupPath: Process exit
- repeatedSetupCost: Linear duplicate scan
- processCreationCost: None
- qualificationDiscoveryCost: None
- concurrency: Active and terminal share ceiling
- retentionBound: 256 lifetime total, no reclamation
- restartBehavior: Map empty
- authorityDependency: Old UUID never rebound

## T. Stale behavior

- fileFunction: jobManager.js: get/result; motifAnalysisController.js: isCurrent/invalidate
- stateCreated: One job/result and epoch in browser
- lifetime: Context/session
- cleanupPath: Synchronous revoke + abort
- repeatedSetupCost: Exact checks after each await
- processCreationCost: Best-effort cancel
- qualificationDiscoveryCost: Fresh context required
- concurrency: One browser owner
- retentionBound: Unknown jobs typed error; no tombstones
- restartBehavior: New session rejects previous bindings
- authorityDependency: Graph/pending/session/approval independent currentness

## U. Shutdown

- fileFunction: server.js: close; jobManager.js: close; cli.js: stop
- stateCreated: Closing flag and cancellation
- lifetime: Shutdown
- cleanupPath: Drain jobs/server; default root and pairing removal
- repeatedSetupCost: Wait execution cleanup
- processCreationCost: Group kill if active
- qualificationDiscoveryCost: No new jobs once closing
- concurrency: Drain Promise Set
- retentionBound: No explicit server shutdown deadline
- restartBehavior: Override root survives
- authorityDependency: Cleanup success required before acceptance

## V. Restart/recovery

- fileFunction: startCandyRuntime + ArtifactStore.initialize
- stateCreated: New auth/jobs/store metadata
- lifetime: New process
- cleanupPath: Old default directories not reconciled after crash
- repeatedSetupCost: Fresh qualification
- processCreationCost: New discovery probes
- qualificationDiscoveryCost: Full fresh checks
- concurrency: Independent new service
- retentionBound: Old disk files can escape current accounting
- restartBehavior: No in-memory job/result persistence
- authorityDependency: No adoption of old session; orphan cleanup gap

## W. Browser reconnect

- fileFunction: src/candy/useCandyRuntime.js: pair/discover; client.js
- stateCreated: Stored token hint; live state and discovery generation
- lifetime: Mounted browser
- cleanupPath: Unmount abort; explicit pair/discover clears analysis
- repeatedSetupCost: Full capability discovery
- processCreationCost: Service probes
- qualificationDiscoveryCost: Authenticated explicit discovery
- concurrency: One discovery generation
- retentionBound: One result/job; bounded transport deadlines
- restartBehavior: Mount unauthorized; idle ready state does not proactively detect loss
- authorityDependency: Pair hint never approval; idle loss detection missing

## X. Failure classification

- fileFunction: errorClasses.js; httpUtils.js: structuredError/statusForError; jobManager.js: catch/finally
- stateCreated: Typed sanitized error
- lifetime: Request/job
- cleanupPath: Terminal state + workspace cleanup
- repeatedSetupCost: Bounded validation/errors
- processCreationCost: Kill helper for timeout/cancel
- qualificationDiscoveryCost: Unavailable/stale fails closed
- concurrency: Failure does not break motif Promise chain
- retentionBound: Failed/cancelled consume lifetime quotas/artifacts
- restartBehavior: Old job absent
- authorityDependency: No error may grant result/Apply authority

## Current finding disposition

S6-07/08: double serialization and absent browser presence checks remain. S6-09/10: job lifetime ceiling and unreclaimed artifact quotas remain. S6-11: aggregate admission gap remains. S6-12: motif-only queue and queue residence gap remain. S6-18: qualification/parse/setup repeats, one-shot native protocol confirmed in both main(argc, argv) functions; persistent workers deferred. S6-23: abrupt parent/job workspace and override-root reconciliation need closure. Scope6A transport deadlines already implemented; Scope6B graph/preview/cache bounds remain qualified and out of this implementation.

No native source, limits, algorithms, manifest or historical evidence changed. Qualification remains exact-file/evidence/tag/device verification.
