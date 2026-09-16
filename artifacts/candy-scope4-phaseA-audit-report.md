# CANDY Scope 4A-R final audit and recovery report

Date: 2026-09-16
Overall disposition: **NON-PASS / FINAL_SECURITY_REVIEW_TOOLING_BLOCKED**
Functional qualification: PASS
Fresh security facility: canonical scan completed and sealed, but coverage is partial
Known open Critical: 0; known open High: 0; open Medium tooling blockers: 1
Zero known/reported findings is not a substitute for complete security coverage.

## Protected state and authorized boundary

- Branch: `candy-integration-scope4-escher`.
- HEAD: `48b78c106615add75128832236ccc07e0bcff6cc`.
- Protected tag: `candy-integration-scope3-cuda-qualified`, peeled to that same commit.
- The working tree intentionally contains uncommitted Scope 4A-R changes.
- No commit, tag, push, merge, reset, history rewrite or protected-tag movement was performed.
- No Scope 4B1, 4B2 or 4C work was started. Hard stop after this report.
- No semantic source or permanent tests were changed in this recovery. Only evidence was reconciled and a genuine tool-generated report preserved.

## History, source and license

The supplied archive SHA-256 is
`CE2D5C1A1A486ECED59FA70122FA271EF9E528D36188E97AD326ECDF3ECAA302`
(size 2,155,972 bytes). The hash and license-entry search were rechecked. No LICENSE,
LICENCE, COPYING or NOTICE exists in the supplied archive; academic-research README
wording is not a license grant.

The original 30-bin source classifier was not the problem: its static H2H-clique
enumerator reached only 24 closed classes, omitting six connected open-wedge
classes. Its incremental minimum-anchor strategy could subtract unaffected
triangles sharing the flagged anchor. Scope 4A initially stopped NON-PASS on these
discoveries. The user then explicitly authorized Scope 4A-R corrected semantics.

The independent mathematical implementation derives its taxonomy and enumerates
incidence sets directly. The CPU oracle is correctness authority, not the raw
ESCHER lookup table or kernels. No upstream production source, CUDA kernel,
CBST structure or lookup array was copied or redistributed. The original reference
defects remain documented, not described as repaired upstream code.

Type1, Type2, Type3 and coarse inner/outer/hybrid/hyperedge counts remain separate
research operations, not product aliases or unproven aggregates of the 30 classes.
They are deferred. Exact characterization is retained in the source audit.

## Mathematical and oracle qualification

Product: `HYPERGRAPH_3EDGE_MOTIF_COUNT`.
Taxonomy: `candy.hypergraph-3edge-motif-taxonomy/1`.
Backend: `CPU_REFERENCE_ORACLE`.

Region order: A-only, B-only, C-only, AB-only, BC-only, CA-only, ABC.
Independent exhaustive partition: 128 signatures, 96 connected labeled signatures,
30 disjoint S3 orbits, 24 closed classes and 6 open-wedge classes. Every connected
mask belongs to exactly one orbit; every canonical mask is its orbit minimum.
Product IDs are ascending minimum-mask order, not upstream label ordering.

STATIC considers exactly the distinct unordered triples `i < j < k`. Seven Venn
regions are calculated by union and three-set membership, then reduced to presence.
The triple counts iff the pair-intersection graph is connected (two or three pair
intersections), and contributes to exactly one of 30 bins. Disconnected triples
contribute to none. Total connected triples equals the safe sum of bin counts.

Permanent coverage includes all 30 realizable witnesses, all six open-wedge
witnesses, all 128 signature cases, all six hyperedge permutations, membership
ordering, vertex/hyperedge renaming, sparse numeric IDs, distinct string/number IDs,
and changed deterministic dense numbering. Empty-hyperedge signatures are
noncountable and rejected by the incidence contract; nonempty disconnected
witnesses are counted as zero. Tests independently rebuild orbit membership rather
than merely comparing constants or trusting fixture generation.

INCREMENTAL applies a typed update and fully recomputes exact old and new static
counts. Every delta is new minus old. All 30 per-class invariants and the total
invariant pass for insertion, deletion, mixed update, exact delete/reinsert,
no-change, open creation/destruction, closed creation/destruction, class change,
sparse IDs and identical-incidence distinct IDs. The adversarial matrix contains
10 semantic transition cases and an additional update-order repeat.

The permanent shared-anchor regression has two closed triangles sharing h1.
Deleting h2 leaves the unaffected second closed triangle: closed count 2 -> 1,
exact closed delta -1, versus faulty anchor-wide subtraction -2. Under the complete
connected product, open wedges also count: total 6 -> 3, exact total delta -3.
No unlicensed source is executed or imported to establish this counterexample.

## Contracts, type boundary and fail-closed matrix

| Boundary | Policy and evidence |
|---|---|
| Types | STATIC accepts Hypergraph and DynamicHypergraph. INCREMENTAL/update requires DynamicHypergraph. All three ordinary types fail with INVALID_GRAPH_TYPE. |
| Incidence | Strict versioned graph ID/version/type, explicit vertex list, hyperedge ID -> vertex-ID membership list; optional inert provenance. No H2H/V2H authority. |
| IDs | Nonblank strings <=512 characters or safe integer numbers; type-tagged Map/Set keys, deterministic codepoint order, no string-number coercion. Numeric zero and negative zero share ordinary numeric identity. |
| Duplicates | Duplicate vertices, hyperedge IDs and memberships rejected. Identical memberships under distinct semantic hyperedge IDs allowed. |
| Empty/singleton/isolation | Empty edge rejected in v1. Singleton allowed. Isolated declared vertices recorded and retained across updates. |
| Request | Algorithm/taxonomy/mode and graph ref bound; incremental state/schema/taxonomy/graph/update refs required. |
| Property state | Incremental runner requires independently supplied current state ref; state ID/version mismatch or missing authority fails STALE_PROPERTY_STATE. No property store is implemented. Standalone structural validation is not execution authority. |
| Update | DELETE_THEN_INSERT, exactly next graph version; missing delete and existing insert rejected, except exact same-ID delete/reinsert. New vertices extend the vertex list; duplicate operations rejected. |
| Result | Exactly 30 safe nonnegative integer counts, safe sum equals total, bound identity/backend/mode/refs. Incremental adds 30 signed deltas, exact next-version output ref and feasible previous per-bin counts. Warnings <=20, each <=512 characters. |
| Canonical trust | Private adapter-owned WeakSet branding and frozen mappings/memberships; forged mapping-shaped caller objects rejected. |
| Metadata | Acyclic inert provenance cloned and frozen; depth <=8, <=1024 nodes and checked container entries, <=16384 aggregate text characters. Prototype-sensitive keys use explicit property definition. |
| Resource/arithmetic | General ceilings: 1m vertices/edges/cardinality, 10m incidence. Oracle: <=256 edges, <=100k incidence and <=5m aggregate membership visits, checked before enumeration. Limits only tighten. Unsafe integers/totals, raised/unknown limits and oversized cardinality fail closed. |

Malformed/unknown schemas and extra keys, bad identifiers, unsafe numeric IDs,
duplicate/collision cases, stale graph/state/update refs, forged canonical markers,
cyclic/oversized provenance and resource bounds are covered by permanent contract
and adversarial tests. No caller result-status assertion proves correctness:
standalone result validation is structural/arithmetic; exact output is established
by the CPU oracle.

No implicit projection, clique/star expansion, pairwise conversion or conversion
workflow was added. Pair intersections are internal mathematical tests, not an
ordinary graph materialization or authoritative H2H input.

## SSSP and prohibited execution review

The existing SSSP checker body is unchanged: OrdinaryGraph, DynamicOrdinaryGraph
and ProjectedOrdinaryGraph accepted; Hypergraph and DynamicHypergraph rejected.
Existing qualified OpenMP/CUDA capability, typed routing, no-fallback and runtime
UI truthfulness regressions remain green in the retained full suite.

The additive diff contains no native ESCHER executable/source, runtime motif
dispatch, capability registration, ReAct/model action, UI/browser execution
control, arbitrary executable/path/flag/environment surface, shell/network/
filesystem sink, adaptive selection, projection workflow, MOSP product, PageRank,
SCC or coloring work. The only existing source edits are additive schema IDs and
a separate motif compatibility checker. App, AgentChatPanel and qualified native
SSSP/runtime code remain untouched.

## Adversarial findings and closures

The issue register retains 13 entries: 3 historical reference/license findings,
8 closed implementation audit findings, and 2 security-tooling records.

Closed product findings: private canonical branding (High), tighten-only resource
authority (High), aggregate CPU work (Medium), nested immutable snapshots
(Medium), bounded identifier/provenance metadata (Medium), authoritative state
matching (Medium), result arithmetic/identity validation (Medium), and preflight/
linear isolation scanning (Low). Their permanent tests and source controls are
listed individually in the register. These are earlier audit corrections; no
new product source defect was found or corrected in this recovery.

Historical reference defects are mitigated by the independent product boundary,
not fixed in upstream source. The license restriction remains: source excluded,
not licensed. No known open product Critical/High/Medium/Low finding is identified.
One Medium tooling blocker remains open. Because sealed coverage is partial,
absence of further security findings is not an exhaustive completed-review claim.

## Security facility recovery: exact outcome

The previous scan `5e7079fb-9220-4077-97c8-8aa72c3fbd03` in
`codex-security-scans-DIUo4a` failed finalization: rejected draft input left its
manifest absent. No missing manifest was fabricated, copied or repaired; that
interrupted attempt was not reused.

The user authorized a fresh scan:
`84d931f2-979f-49bf-828a-9a2c27d04693`,
new temporary root `codex-security-scans-pEPl6l`.
Snapshot digest:
`codex-security-snapshot/v1:sha256:fa1c2514da945e5833fabe9f58f7a64c52ab1eb8bc893ee86f4215df5f8de17d`.

The fresh minimal semantic checkpoint was accepted with `draft_written`. A
read-only filesystem verification confirmed that the tool itself created
scan-manifest.json, findings.json and coverage.json. The final submission specified
complete coverage, ten reviewed source surfaces and an empty deferred list. It
was accepted. Completion was called once and returned “Validated and indexed the
completed Codex Security scan.” Canonical readback reports:

- Manifest status: `completed`.
- Sealed/completed timestamp: `2026-09-16T16:01:16.671186Z`.
- Reportable findings: 0; known/reported Critical 0, High 0.
- Reviewed source surfaces: 10.
- Coverage: **partial**.
- Deferred item: `final-review-pending`, with the earlier checkpoint explanation
  that final qualification/provenance/inventory cross-checks are pending.

Thus final accepted input and sealed coverage disagree. The precise internal
merge cause is not established; the observed retained checkpoint is enough to
block truthful PASS. The sealed output was not manually edited, completion was
not retried, and no third scan was started. A manual “all reviewed” assertion
cannot substitute for the missing complete canonical coverage result.

An unchanged copy of the genuine generated report is preserved at
`artifacts/candy-scope4-security-review-tool-report.md`.
SHA-256:
`50d131beff0989f7a1ee89044690694e593c53e2a136210bb6240a28b603e40c`.
No canonical scan manifest was copied into product artifacts.

The security skill used a fresh prompt-driven session with sequential parent
fallback, not independent personnel or a multi-pass scan. Daybreak access was
`not_granted` (advisory only); token usage was unavailable
(`scan_thread_unavailable`), so no token total is invented.

## Application gates and retained evidence

| Gate | Result | Evidence timing |
|---|---|---|
| Focused Scope 4A-R | PASS 4/4 files | Fresh recovery run, 0.3s |
| npm run test | PASS 244/244 files, 98.9s | Retained preceding full qualification |
| npm run lint | PASS | Retained preceding qualification |
| npm run build | PASS | Retained preceding qualification |
| npm run build:github | PASS; /hypergraph-converter/ base | Retained preceding qualification |
| npm audit --omit=dev | PASS, 0 vulnerabilities | Retained successful read-only registry retry |
| git diff --check | PASS | Fresh recovery check |
| Final security coverage | NON-PASS: partial sealed coverage | Fresh completed scan readback |

The first preceding full test attempt stopped on missing Python at file 148/244.
Rerunning with the bundled interpreter via PYTHON passed all 244 files. The first
npm audit attempt lacked registry/cache access; its approved read-only retry
reported zero vulnerabilities. No dependencies were installed or changed.
Both builds retain the existing >500 kB bundle warning; no unrelated bundling
rewrite is authorized. No fresh expensive gate is required by source changes:
semantic source and tests are unchanged during this evidence-only recovery.
JSON qualification records include exact current source/test/package fingerprints.

## Exact changed/new-file manifest

All paths below are relative to the project root
`C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14`.

| File | Git state | Classification |
|---|---|---|
| src/candy/adapters/hypergraphIncidenceAdapter.js | new | production semantic contract/oracle code |
| src/candy/adapters/hypergraphUpdateAdapter.js | new | production semantic contract/oracle code |
| src/candy/adapters/identifierMapping.js | new | production semantic contract/oracle code |
| src/candy/contracts/graphTypes.js | modified | production semantic contract/oracle code |
| src/candy/contracts/hypergraphMotifLimits.js | new | production semantic contract/oracle code |
| src/candy/contracts/hypergraphMotifMetadata.js | new | production semantic contract/oracle code |
| src/candy/contracts/hypergraphMotifSchemas.js | new | production semantic contract/oracle code |
| src/candy/contracts/schemaVersions.js | modified | production semantic contract/oracle code |
| src/candy/hypergraphMotifs/referenceOracle.js | new | production semantic contract/oracle code |
| src/candy/hypergraphMotifs/taxonomy.js | new | production semantic contract/oracle code |
| tests/candy-scope4a-adversarial.test.mjs | new | permanent qualification test |
| tests/candy-scope4a-contracts-adapter.test.mjs | new | permanent qualification test |
| tests/candy-scope4a-oracle-delta.test.mjs | new | permanent qualification test |
| tests/candy-scope4a-taxonomy.test.mjs | new | permanent qualification test |
| tests/fixtures/candy-scope4-motifs.mjs | new | permanent qualification test |
| artifacts/candy-scope4-contract-decision.md | new | permanent evidence/provenance |
| artifacts/candy-scope4-phaseA-source-audit.md | new | permanent evidence/provenance |
| artifacts/candy-scope4-phaseA-taxonomy.md | new | permanent evidence/provenance |
| artifacts/candy-scope4-reference-qualification.json | new | permanent evidence/provenance |
| artifacts/candy-scope4-phaseA-audit-report.md | new | permanent evidence/provenance |
| artifacts/candy-scope4-phaseA-issue-register.json | new | permanent evidence/provenance |
| artifacts/candy-scope4-security-review-tool-report.md | new | permanent evidence/provenance |
| candy-runtime/native/upstream/ESCHER-GPU-PROVENANCE.md | new | permanent evidence/provenance |

Total: 23 files (2 tracked modified, 21 untracked new): 10 semantic source files,
5 qualification/fixture files, 8 permanent evidence/provenance files.
The ordinary `git diff --stat` reports only the two tracked modified files:
33 insertions, no deletions. The separate manifest includes all untracked files
without staging them. There are no unexpected changed files.

## Scratch, dependencies, limitations and stop

`.scope4-security-threat-model.md` was transient input copied only into the
fresh scan's context directory, then deleted through apply_patch. It is absent
from the final product tree and not designated permanent product evidence.
The real generated tool report is retained; no source/tests/evidence were cleaned
away. No additional temporary product debris remains.

package.json and package-lock.json are unchanged. No package upgrades, model
weights, cloud APIs, API keys, native ESCHER integration or paid services were added.
Existing development build output is ignored and not a deliverable.

Accepted limits: this is a bounded CPU reference, not scalable/native production
execution; incremental is full old/new recomputation; property authority must be
supplied by the caller independently; standalone result validation is not an
external correctness oracle; inert JSON-like data is the contract rather than
arbitrary JavaScript getter/proxy sandboxing; the archive is not licensed for
redistribution. None permits bypassing the incomplete security coverage gate.

Final tree remains uncommitted on the protected branch/HEAD. No commit/tag/push/
merge/reset/history rewrite occurred. Overall result remains NON-PASS until a
truthful complete fresh security coverage result is available. Stop here:
Scope 4B1, Scope 4B2 and Scope 4C were NOT started.
