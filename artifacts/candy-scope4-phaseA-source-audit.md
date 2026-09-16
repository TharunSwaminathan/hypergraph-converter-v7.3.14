# CANDY Scope 4A-R source audit

## Result

The supplied ESCHER archive is suitable only as unlicensed research evidence. Scope 4A-R uses a clean-room mathematical definition and independent implementation.

## Provenance and license

- Archive: `ESCHER-GPU-main.zip`
- SHA-256: `CE2D5C1A1A486ECED59FA70122FA271EF9E528D36188E97AD326ECDF3ECAA302`
- Size: 2,155,972 bytes
- License search: no `LICENSE`, `LICENCE`, `COPYING`, or `NOTICE` file found
- README wording: academic-research description only; no reuse grant inferred
- Redistribution: archive and source excluded from this repository

## Exact operations found

### Fine-grained seven-region classifier

For three hyperedges, the source derives cardinalities for seven exclusive Venn regions and reduces them to presence bits in this order:

1. A only
2. B only
3. C only
4. AB only
5. BC only
6. CA only
7. ABC

The embedded table is invariant under all six permutations and contains labels for 30 connected-signature orbits. It is research comparison only, not product authority.

### Static enumerator defect

`motifTriangleKernel` enumerates `i < j < k` by intersecting H2H adjacency lists. Therefore all three pairwise hyperedge intersections must be nonempty. The source can reach only table bins `1-20` and `27-30`; table bins `21-26` encode open wedges and are unreachable. Classification itself is complete, but enumeration is incomplete for the claimed 30-class product.

Disposition: `REFERENCE_IMPLEMENTATION_INCOMPLETE_FOR_30_CLASS_PRODUCT`.

### Incremental defect

`buildAnchorFlags` flags the minimum ID of a triangle touching the update frontier. `motifAnchorKernel` then enumerates every triangle under each flagged anchor without testing whether the triangle touches the frontier. A deletion can subtract unaffected triangles sharing that anchor.

Permanent counterexample: two H2H triangles `(h1,h2,h3)` and `(h1,h4,h5)` share minimum-ID `h1`; deleting `h2` destroys only the first closed triangle. Anchor-wide subtraction removes two, while the exact closed-triangle difference is minus one.

Disposition: reference incremental delta is not correctness authority.

## Separate research counters

- Type1: `sum_e C(|e|,3)`, the number of vertex triples contained by each hyperedge, counted with multiplicity across hyperedges.
- Type2: for each intersecting pair with overlap `a >= 2`, adds `C(a,2) * (|A|-a) * (|B|-a)`.
- Type3: for each H2H clique triple, adds `|AB only| * |BC only| * |CA only|` when every factor is positive.
- Coarse inner: same form as Type1.
- Coarse hyperedge: number of H2H 3-cliques.
- Coarse outer/hybrid: vertex-triangle quantities derived through a pairwise vertex graph and V2H membership tests.

These are not substitutions for, or proven aggregates of, the complete connected-three-hyperedge 30-class taxonomy and are deferred.

## Input/storage audit

The source demo generates synthetic integer-ID hypergraphs, builds derived V2H/H2H structures, flattens rows into payload arrays, and stores offsets in GPU CBST structures. IDs are dense and one-based internally. Update demos reuse deleted IDs and assign new dense IDs. Sortedness, sentinel values, payload capacity, and alignment are required by that implementation.

Scope 4A-R rejects those storage assumptions as product input. Product authority is typed incidence with preserved external IDs; V2H/H2H and dense mappings are derived only.

## Historical progression and final recovery

1. Scope 4A initially stopped NON-PASS after discovering the 24-of-30 static enumerator mismatch and anchor-wide incremental over-subtraction. These remain defects of the supplied reference, not defects silently fixed in redistributed upstream code.
2. The user explicitly authorized Scope 4A-R: independent connected-three-hyperedge product semantics including six open wedges, S3-derived taxonomy, and exact full old/new CPU recomputation.
3. The implementation is independently written mathematical contract/oracle code; it contains no upstream lookup table, CUDA kernel, CBST implementation or production source import. The CPU oracle, not the supplied reference, is correctness authority.
4. Adversarial hardening added private canonical branding, tighten-only limits, cardinality preflight, bounded aggregate CPU work, immutable snapshots/provenance, bounded identifiers, current-state checks and result arithmetic/identity validation. Permanent tests preserve both historical reference defects.
5. The previous security attempt (`5e7079fb-9220-4077-97c8-8aa72c3fbd03`, temporary root `codex-security-scans-DIUo4a`) failed: invalid draft arguments left `scan-manifest.json` absent. That interrupted attempt was not reused, repaired or treated as a completed scan.
6. The authorized fresh scan (`84d931f2-979f-49bf-828a-9a2c27d04693`, temporary root `codex-security-scans-pEPl6l`) accepted tool-authored drafts and sealed its own canonical artifacts. Its final readback nevertheless says `partial` coverage and retains `final-review-pending`; the final complete-coverage submission did not clear the earlier checkpoint item. This is a tooling/evidence blocker, not an identified source defect. Overall qualification is therefore NON-PASS, not a substituted manual security PASS.

The archive hash and absent LICENSE/LICENCE/COPYING/NOTICE entry names were rechecked during final recovery. No license grant, permission to redistribute source, or legal non-infringement guarantee is inferred from the research description.
