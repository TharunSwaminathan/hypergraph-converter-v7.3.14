# CANDY Scope 6 readiness audit

Date: 2026-10-09. Scope: documentation-only architecture, resource, benchmark and release audit.

**Verdict: READY FOR PHASED IMPLEMENTATION.** Start with a small release-hardening and measurement phase. The qualified Scope 5 authority model is a sound foundation, but neither large motif workloads nor sustained thousands-of-job operation are supported by the current resource envelope. Do not begin with an across-the-board limit increase, persistent GPU service or automatic batching.

The [gap register](candy-scope6-gap-register.json) contains **24 gaps: Critical 0, High 7, Medium 15, Low 2**. High means a barrier to the requested scale, sustained operation or reproducible release; it does not mean seven demonstrated security vulnerabilities.

## Baseline and evidence

Initial working tree was clean; branch was and remains `candy-integration-scope6-readiness`.

| Reference | Verified SHA |
| --- | --- |
| HEAD / authoritative integration baseline | b24c4e32100d2e7c05b13df3c8f6f9e279fd8828 |
| candy-integration-scope5f-final-qualified peeled | 54dd4d3edb73681f51bf8bb69b9708778a46a502 |
| candy-integration-scope5f-browser-blocked peeled | bf0240a54fb6ac8284bd9ac371306511158a1a2e |
| post-diagnosis-full-corrective-qualified peeled | 57daa23050c89cd0d2c74328766d284311376da4 |

Status, branch, HEAD, all four references, the last 20 decorated commits and diff whitespace were checked before analysis. The final-qualified commit contains browser closure and a version-bound panel-notice correction; b24c4e3 promotes the qualified integration. The blocked tag is permanently historical and must never be relabelled qualified.

Authoritative inputs reviewed comprise the seven Scope 5 design/readiness artifacts, final qualification Markdown/JSON, implementation report and qualification JSON for each phase 5A–5E, and Scope 5F environment, live Runtime, browser, security and source-inventory artifacts. Current source was traced independently; the old Scope 5 readiness map is a pre-implementation description, not the present architecture.

Evidence hierarchy:
1. User-authoritative current baseline and qualified tag.
2. Current implementation and byte verification.
3. Final live qualification and browser closure.
4. Earlier phase reports and historical blocked attempts, with their original limitations retained.

The final Scope 5 evidence reports 268 passing test files, lint, both builds and zero production advisories at that qualification time. Live evidence reports seven incremental cases, 24 negatives, seven lifecycle cases and 34 authenticated jobs; all 30 bins obey OLD STATIC + delta = NEW STATIC. Browser closure supplies 22 visible gates. These are historical correctness/authority observations, not latency distributions, large-graph support or a fresh dependency audit.

Some original Markdown still says browser blocked, and final JSON retains `qualifiedCommit: null`, `releaseEligible: false` and working-tree provenance alongside browser PASS. This is evidence captured before the final commit, not proof that b24c4e3 is unqualified. S6-21 requests a new additive release manifest; no historical evidence was rewritten.

Source inventory comparison found five production correction files matching their recorded CRLF checkout hashes. The five test/harness files match recorded LF Git-blob hashes rather than this checkout's CRLF bytes. There is no unexplained content corruption; deployed-byte and newline policies need explicit release provenance. Native qualification must always hash exact deployed bytes.

No large workloads, browser app actions, new Runtime jobs or CUDA execution were performed. Small Node 24.19.0 size/packing calculations were read-only. This is a scoped architecture/threat audit, not an exhaustive new repository security certification.

## Explicit decisions

| Question | Answer |
| --- | --- |
| Is immediate implementation safe? | Yes for bounded 6A work preserving current contracts. Major scale expansion is unsafe without measurements and new qualification. |
| Should Scope 6 be phased? | Yes; browser, Runtime and native boundaries have different risks and evidence requirements. |
| Highest-priority first phase? | 6A: reproducible measurement, portable-release provenance, transport cleanup and concrete browser retention fixes. |
| Main browser bottleneck? | Repeated whole-state clone/canonicalize/hash work and fifty history snapshots; skewed inputs also bypass effective vertex/DOM preview budgets. |
| Main Runtime bottleneck? | Repeated validation/parsing/packing/process startup on one motif queue; the 256 retained-job lifetime ceiling is the immediate sustained-operation blocker. Startup dominance is a hypothesis to measure. |
| Main CUDA bottleneck? | Combinatorial triple work: STATIC E³ launch slots, incremental full host triple enumeration; affected-only kernels do not eliminate preparation or OLD/NEW transfers. |
| Main long-session risk? | Runtime job/artifact admission exhausts; browser graph-status chat and unreleased export URLs can accumulate. |
| Introduce artifact caching? | Yes, bounded exact-byte reuse with session-scoped presence and independent fresh action authority. Start with data, not accepted result authority. |
| Introduce batching? | Defer automatic batching. Explicit composition against one unchanged base is possible but has high authority risk and uncertain measured benefit. |
| Release v7.3.14 before/after Scope 6? | After small 6A release hardening, before major 6B–6D performance changes. Publish only the exact qualified release payload; current old packaging evidence is insufficient. |

## Actual resource envelope

Three capacities must not be conflated.

- General incidence adapter: up to 1M vertices, 1M hyperedges, 1M memberships per edge and 10M total incidences, with identifier strings limited to 512 characters. These are adapter rejection bounds, not browser responsiveness or qualified motif support.
- Pending DynamicHypergraph projection: OLD and proposed each at most 256 edges/100k incidences; delete/insert counts each at most 256 and inserted incidences at most 100k. Full preview occurs before this projection check.
- Qualified motif analysis/native: each snapshot additionally has membership-work budget W = I(E−1)(E−2)/2 ≤ 5,000,000, native request ≤ 2MiB and decoded artifact ≤ 6MiB. Runtime HTTP request ≤ 8MiB, including base64 envelope.

All valid incidence rows are nonempty, hence I ≥ E. Therefore E=216 singleton rows fit (W=4,969,080), E=217 do not (W=5,038,740). The nominal 256-edge bound cannot be attained with valid nonempty rows under this work budget. Pending Stage can still validate some graphs above 216 when within its simpler projection counts; analysis then rejects on W. Do not label every VALIDATED update analyzable.

| E | Maximum I under count/work bounds | Feasible with nonempty rows |
| --- | ---: | --- |
| 10 | 100,000 | yes |
| 16 | 47,619 | yes |
| 32 | 10,752 | yes |
| 64 | 2,560 | yes |
| 100 | 1,030 | yes |
| 128 | 624 | yes |
| 216 | 217 | yes |
| 217 | 215 | no |
| 256 | 154 | no |

Source: `src/candy/motifPreflight.js:27`, `src/candy/adapters/graphMutationToHypergraphUpdate.js:12`, `src/candy/adapters/hypergraphIncidenceAdapter.js:19`, `src/candy/adapters/identifierMapping.js:3`, both native parsers. Smaller edge counts can permit larger individual rows; a 100k-membership single edge is not automatically excluded by W, but transfer/preview and exact byte bounds still apply.

## Large-target assessment

The browser representation may hold the following shapes; no new support claim follows.

| Target | Browser/preview/history | Serialization/upload | CUDA/native | First limiting layer |
| --- | --- | --- | --- | --- |
| 10k edges, 40k incidences | O(I) clones, 25 paired snapshots; up to 10k edge DOM rows, quadratic indexOf lookups at maximum display; no measured heap guarantee | Multiple strings/maps; may fit bytes with short IDs but not motif edge limit | Rejected before native; naive choose(10000,3)=166,616,670,000 triples | Dynamic Stage projection; qualified analysis preflight |
| 100k edges, 400k incidences | Large row/object and history overhead; preview slices edge count but import/state still full | Artifact size shape-dependent; motif count rejects | Rejected; no CUDA measurement needed | Stage/analysis hard limits, then generic browser heap |
| 1M incidences | General adapter permits shape within E/V/cardinality limits; one edge can create ~1M preview vertices and list rows | Short string membership tokens alone can exceed 6MiB; vertex list adds IDs again | Qualified I≤100k; native text≤2MiB | Motif limits; generic import/UI independently risky |
| 2M–10M incidences | General representation only within generic limits; full snapshots and copies are serious memory risks | No bounded production upload for this scale; base64 and multiple copies amplify bytes | Not qualified; no GPU fit claim | Generic browser memory/admission, qualified motif rejection |
| 128/512-character IDs | Sorting comparison/key construction scale with ID length; repeated membership strings dominate | Measured growth below; semantic IDs disappear from membership indices in native text | Mapping must preserve type/identity; ID bound remains | Browser hashing/serialization or byte ceiling |
| Few large/skewed edges | Edge-only display limit fails to cap nodes; all memberships processed before visual sampling | I and distinct V, not average alone, determine bytes | Few edges may fit W if I≤100k; all snapshots must pass | UI and artifact envelope, then work/count limits |
| Repeated tiny changes | Every edit can recompute full proposed state and hash; history remains large | Same OLD reuploaded until Apply; new versions change exact artifact bytes | Fresh process and CUDA context per job | Runtime lifetime quotas / host preparation |

Native GPU memory is not the first reason these large targets fail. They are rejected upstream. Inside current bounds, candidate buffers dominate incremental graph arrays; CUDA context/external workloads can still cause OOM. Raising generic Runtime limits does not raise motif limits.

## Browser cost inventory

See the [current-state map](candy-scope6-current-state-map.md) for A–N flows.

| Operation | Actual cost / retention | Classification |
| --- | --- | --- |
| Import/conversion and committed envelope | Full raw/normalized rows, membership dedup and attribute copy; V2H/H2H sort rows/memberships; post-commit flatMap/Set summary. Parsing runs synchronously after timer; envelope shallow frozen retaining incoming graph reference; raw text can coexist | Necessary representation; serious unbounded import work risk for large inputs; potential admission/worker optimization |
| Fingerprint/collision-safe identity | Canonical edge copies, E sort, recursive sorted attributes, full stringify and FNV pass. nextCommittedGraphIdentity computes exact OLD/NEW strings even when marker differs or replacement already forces lineage | Exact comparison necessary when needed; repeated preparation potential optimization |
| History | JSON stringify/parse BEFORE and AFTER each material commit, rolling 25 events | Serious large-data retention blocker; bounded, not an infinite leak |
| Mutation preview | Map clone every row/membership, operation scans, final edge sort, two fingerprints, before/after vertex Sets, exact collision fallback | Preview correctness necessary; whole-state repeated work potential optimization |
| Pending validation/edit | Clone/freeze plan; derive preview/proposed fingerprint; canonicalize OLD/NEW; diff maps and membership key sorts; clone preview into SHA-256 content, stable stringify, clone/deep freeze result | Immutable revision necessary; avoidable duplicate copies; rejected-large work serious blocker |
| Apply | Fresh base/currentness checks and full rederivation/digest/exact preview comparisons, then commit/history | Revalidation necessary; revision-bound immutable reuse possible only with live authority rechecks |
| Analysis Stage then submit | Cheap preflight; Stage packs feasibility; submit copies graph again, canonicalizes OLD and rebuilt NEW, packs/digests; no automatic action | Independent confirmation necessary; preparation reuse potential optimization |
| Upload | Full JSON/hash text, second JSON, UTF-8 array, per-byte binary string, base64, wrapper string | Current protocol acceptable for small inputs; potential optimization |
| Result/UI selectors | One result registry, one job, constant 30 bins and bounded scalar authority keys | Acceptable; no full result history or graph JSON dependency key found |
| Dynamic preview/Viz | Semantic maps compare full OLD/proposed edges; selected graph topology/membership overlays allocate before sampling, per-frame selected membership scans/ring geometry; all selected vertices rendered | Serious skewed-input UI blocker |
| Stats/derived products | Stats memoized by graph array, mappings demand-driven; heavy derived operations use cancellable worker or deferred synchronous fallback, graph-scoped cache clears on transition; chosen CSR/Full JSON exports stringify and retain large duplicated mapping/graph text | Acceptable improvements already present; worker structured-clone/fallback, export cache bytes and retention need measurement |
| Assistant | Bounded outgoing observation/prompt but local mutation index/counts traverse full graph; full key arrays built before sampling | Payload bounds acceptable; index reuse potential optimization |
| Persistence | Inert schema, 80 threads × 80 messages, 6000 chars/message, 2000 summary, 1M serialized chars/record; one in-flight plus latest save | Acceptable authority model; bytes/quota observability useful |

Browser identity canonicalization preserves application membership order; incidence/native canonicalization sorts typed mappings and native memberships. These are different canonical forms. Replacing one with another without an explicit compatibility decision risks no-op and digest changes.

## Deterministic size measurements

These are byte counts, not timing or heap measurements. No production state or evidence was mutated. Synthetic states use graphId `fixture`, version 1, DynamicHypergraph, no explicit isolated vertices, IDs e0…e(E−1), K members per edge. Vertex ID n is `v` + six zero-padded digits, padded with x to L characters; n=(3e+j) mod 256. The proposed state replaces e0 with its members plus novel v000300. updateId=`fixture-r1`, next version 2.

Measured using production `motifGraphValue`, `deriveHypergraphMotifUpdate`, browser request projection and both frozen native packers. Browser/native incremental packed byte lengths agreed for all five fixtures. No kernel ran.

| E / I / ID chars | OLD JSON bytes | Update JSON | Proposed graph JSON | OLD HTTP body | Update HTTP body | STATIC / incremental native bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 16 / 128 / 8 | 2,542 | 402 | 2,564 | 3,522 | 668 | 750 / 1,653 |
| 64 / 512 / 8 | 9,598 | 402 | 9,620 | 12,930 | 668 | 2,347 / 5,138 |
| 64 / 512 / 128 | 94,678 | 1,482 | 94,940 | 126,370 | 2,108 | 2,347 / 5,138 |
| 64 / 512 / 512 | 366,934 | 4,938 | 367,964 | 489,378 | 6,716 | 2,347 / 5,138 |
| 128 / 256 / 8 | 8,650 | 336 | 8,672 | 11,666 | 580 | 1,673 / 4,232 |

The HTTP column includes compact upload-schema/media/encoding envelope; base64 length is exactly 4×ceil(JSON_bytes/3). Incremental HTTP sends OLD plus update, not a full proposed graph. The trusted native request nevertheless packs full OLD and NEW incidence arrays.

Fifty copies of edge-array JSON alone are 364,350 bytes for the 64/512/8 fixture and 13,266,750 for 64/512/512. These are serialized-size reference values, not retained JS heap. JS objects, pointers, arrays, attributes and strings differ by engine; one-byte versus two-byte string backing means a universal heap multiplier would be false precision.

At 6MiB decoded content, base64 alone is 8MiB, so any nonempty HTTP wrapper exceeds the 8MiB body bound. The actual maximum decoded upload is slightly below 6MiB. Admission should use exact encoded bytes, not advertise both ceilings as simultaneously attainable.

Typed numeric incidence buffers can reduce host copies, and byte reuse avoids a proven duplicate stringify. Binary/streaming protocol is a later measured decision. Compression is not presently accepted; it would add decoded-size/ratio/CPU limits and bomb threats. SharedArrayBuffer requires deployment headers and mutable-buffer ownership controls; current GitHub Pages/browser isolation cannot be assumed. No evidence yet justifies those complexities over exact-byte reuse.

## Runtime and native findings

Runtime protects loopback routes with bearer authentication and an exact allowlist when Origin is present. Originless authenticated CLI is intentional. Health is public and limited. Per request it reads buffered JSON, decodes artifact, checks media/bytes, hashes and writes immutable digest files; artifacts reread with regular-file/containment/digest checks.

Jobs validate descriptors and verify local qualification, retain a record, join a single motif Promise queue, reread/parse/hash artifacts, reconstruct OLD/NEW, write temp native text, verify executable again, launch fixed setsid/bash supervisor (WSL Ubuntu on Windows), initialize CUDA, allocate/copy/count/extract, validate and store result, clean job directory, then expose accepted terminal state. There is no persistent prepared graph or GPU context. Motif execution is serialized; SSSP bypasses that queue, so GPU exclusivity across algorithms/external tools is not proven.

256 retained jobs are a lifetime bound, not just active concurrency. Quotas are checked before dedup; normal fresh request UUIDs prevent repeated user analyses from being the same dedup job. Artifacts cap at 512/64MiB with no reclamation. A rough changing-base incremental job introduces OLD/update/result artifacts; ~170 three-artifact transitions can consume the item budget, but identical contents/dedup, failed jobs and bytes alter the exact exhaustion point. No guaranteed 100-job capacity follows for large artifacts.

HTTP in-flight memory has no total reservation found; queued artifact copies precede retained quota checks. Qualification work occurs before job admission. Treat authenticated flooding as an availability hypothesis with concrete missing aggregate controls, not a proven unauthenticated vulnerability.

CUDA STATIC allocates offsets, flattened members, 128-entry lookup and 30 u64 bins, transfers synchronously, launches E³ slots filtering ordered triples and counts via atomics. Incremental builds candidate vectors by full choose(E,3) host enumeration, retains OLD and NEW vectors, then allocates/copies/counts/frees each snapshot sequentially. Kernel event time excludes context, host preparation, allocation and transfers.

Approximate device payload, excluding context/allocator alignment:
- STATIC: 4(I+E+1) + 512 + 240 bytes.
- One incremental snapshot: STATIC payload plus 12C bytes for triples; OLD/NEW device snapshots are sequential.
- Both host candidate vectors coexist: ~12(C_old+C_new) bytes, excluding snapshots and parsing.

At effective maximum E=216, all-affected C=1,656,360 per snapshot; candidate bytes=19,876,320 per vector (~18.96MiB), ~37.91MiB for both. Source's nominal E256 ceiling permits an explicit upper vector bound of 33,162,240 bytes (~31.63MiB), even though W prevents reaching it with nonempty valid rows. Device/context peak needs measurement, not arithmetic alone.

Direct affected-triple enumeration, tighter host lifetimes and one-process workspace reuse deserve profiling. Device pools/pinned transfers could help only after transfer/allocation costs are measured. Persistent native processes change cancellation, device lifetime, stale prepared-data and executable qualification boundaries. Multi-stream concurrency is deferred; current single-device qualified execution and memory budgets are preferable until evidence supports it.

## Long sessions and recovery

| Sequence | Current expectation |
| --- | --- |
| 100 Stage/Edit/Apply cycles without analysis | Ledger bounded to 256 small lifecycle entries; graph history rolls at 25 full paired snapshots; live graph-status chat grows unless a normal bounded append trims it |
| 100 analyses | May complete if artifact/item/byte budgets suffice; fresh process each; browser retains one result/job |
| 1,000 analyzed updates | Cannot complete in one Runtime session with current 256 job ceiling; artifacts may fail earlier |
| 10,000 analyzed updates | Unsupported; restart/re-discovery is a safety recovery, not a scalable workflow |
| Repeated Stage/Edit | Supersedes ledger revision, clones/hashes proposed data; transient GC pressure. STALE pending retains its preview until discard/replacement |
| Apply/discard | Controller clears pending and result authority; old proposals can remain temporarily in captured promises/history/caller return values, then become collectible |
| Export loops | dl creates URLs with no revoke: concrete browser Blob retention |
| Reload/two tabs | Inert thread data only; graph/update/approval/results are not restored; tabs have independent volatile workspaces |

Workers terminate on settle/cancel; preview RAF scheduler disposes; thread database closes on version change; subscriptions provide unsubscribe; normal native runner clears timers/listeners. No unconditional browser polling loop or infinite result registry was found. Worker abort listener detachment on normal completion merits lifecycle measurement, but signal ownership was not shown to establish a leak. Derived cache call sites presently use a small finite set of options; absence of an internal cap is not proof of unbounded growth.

Recovery disposition:
- Native crash/invalid output/timeout: reject result; cleanup; graph untouched and Apply remains independent.
- Artifact/result corruption: rehash/strict binding rejects; no cache should bypass these.
- Partial upload: per-body count/JSON rejection; no authorized half artifact; aggregate reservation/abort cleanup needs stress coverage.
- Browser close/dispose: local authority revoked, best-effort cancellation. Transport may remain pending until client abort support; abrupt browser death may leave Runtime work.
- Runtime restart during upload/job or rapid reconnect: new session prevents stale acceptance; fresh discovery/authorization required.
- Driver reset/GPU OOM: checked CUDA error paths fail closed; active reset/OOM recovery is not live-qualified by existing evidence.
- Abrupt Runtime crash: graceful shutdown coverage does not establish orphan-process/temp/pairing-file cleanup. Never delete arbitrary temp/process state during recovery.

## Release and phasing

Choose release option C: small release hardening before major performance work. Do not ship the old Stage 9/10 source ZIP as though it included and qualified current Scope 5. The packager scans filesystem files, excludes artifacts/dependencies/Git but does not exclude native `build` or Runtime `.local`; gitignore alone does not constrain it. Local qualification records exist in this checkout. This is an inclusion-policy risk, not evidence a contaminated archive was shipped. Production imports packer/validators from `candy-runtime/test`; deleting that directory from a release breaks motif execution.

Conversely, `candy-runtime/src/capabilities/motifQualification.js:49` reads exact historical qualification artifacts and line61 invokes Git to verify fixed qualification tags. The source ZIP excludes both artifacts and Git metadata. A clean extracted source package therefore cannot enable qualified motif CUDA merely by building binaries; it fails closed. Git executable/history and historical evidence are current user-facing prerequisites for this qualified backend, not just development tooling. Choose an explicitly browser/source-only distribution or a separately reviewed CUDA release qualification bundle/identity path. Do not remove those checks to make extraction pass.

Supported production qualification is narrowly Windows/Ubuntu WSL or Linux process-launch machinery with RTX5060 device0, compute12.0/sm120, compiler13.4.59 and reported CUDA runtime13040. WSL distribution name Ubuntu, fixed companion8791 and origins5173 are deployment assumptions. Launchers merely call npm; alternate frontend ports need deliberate allowlist/config setup. Node24/npm11 are observed, not declared minimums. Python is source-package tooling, not required by Runtime's Node/native path. Codex-local report/tool paths are development provenance, not product prerequisites.

GitHub Pages is frontend hosting; browser-only default remains usable without Runtime. It cannot launch a Node companion/GPU or prove HTTPS-to-loopback browser policy. Pairing, allowed origin/private-network permission and unavailable-backend UI need manual target-browser release qualification. Do not broaden origin policy just to make setup easier.

| Phase | Purpose | Priority outcome |
| --- | --- | --- |
| 6A | Release hardening, measurement baseline and concrete browser lifecycle fixes | Exact portable payload/provenance; bounded chat/URLs/requests; CI and baseline samples; stable v7.3.14 release candidate |
| 6B | Browser data path and display budgets | Cheap rejection; byte-aware history; immutable derived reuse; bounded preview/Assistant indexes |
| 6C | Runtime retention, artifact reuse and operations | Sustainable jobs/artifacts, aggregate admission, queue/deadline/device policy, safe host preparation reuse |
| 6D | Measured CUDA/native improvements and separately gated scale research | Demonstrated crossover and memory gains; new limits only with new qualification |
| 6E | Final integrated benchmark, soak and release qualification | Exact source/binary/archive/environment evidence and rollback-ready performance release |
| 6F optional | Explicit update composition | Only after user need and measured amortization justify authority complexity |

See [benchmark plan](candy-scope6-benchmark-plan.md), [threat model](candy-scope6-security-threat-model.md), [test plan](candy-scope6-test-plan.md) and [implementation plan](candy-scope6-implementation-plan.md) for executable future gates. No phase is authorized by this audit.

Top five priorities: measurable end-to-end baseline (S6-01); honest native/Stage capacity and early rejection (S6-02/03); browser snapshot/skewed-preview costs (S6-04/05/06); Runtime lifetime quotas and safe exact artifact reuse (S6-08/09/10/11); exact portable release and provenance (S6-20/21/22).

## Final repository integrity

Final validation confirms JSON syntax, complete gap fields, allowed severities, 24 unique IDs, nonempty acceptance criteria, valid dependencies, seven artifact links and every explicit source file/line reference. Branch/HEAD/tags remain the exact values above. Tracked diff from b24c4e3 is empty; protected production/test/Runtime/native/manifests diff is empty; only the seven requested Scope 6 files are untracked. `git diff --check` passes; new artifact trailing whitespace is checked separately because untracked files are not covered by Git diff.

No production, test, Runtime, native or package implementation occurred. No commit, tag movement, push or Scope 5 evidence modification occurred. Hard stop after this report.
