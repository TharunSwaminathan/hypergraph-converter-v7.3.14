# CANDY Scope 4A-R 30-class taxonomy

## Independent derivation

Region order is `[A only, B only, C only, AB only, BC only, CA only, ABC]`. Scope 4A-R enumerates all 128 Boolean signatures, explicitly verifies each hyperedge is nonempty, retains signatures whose pair-intersection graph has at least two edges, and quotients the retained signatures under all six S3 permutations.

Derived results:

- Total Boolean signatures: 128
- Connected labeled signatures: 96
- S3 permutation orbits: 30
- Closed-triangle orbits: 24
- Open-wedge orbits: 6
- Disconnected/noncountable signatures: 32

Stable product IDs are assigned by ascending canonical numeric mask. The canonical mask is the least mask in the orbit under the documented region bit order. This ordering is independently defined and does not expose the upstream lookup table.

| Product ID | Canonical mask | Signature | Orbit size | Shape |
|---:|---:|:---:|---:|:---|
| 1 | 24 | 0001100 | 3 | OPEN_WEDGE |
| 2 | 25 | 1001100 | 6 | OPEN_WEDGE |
| 3 | 26 | 0101100 | 3 | OPEN_WEDGE |
| 4 | 27 | 1101100 | 6 | OPEN_WEDGE |
| 5 | 29 | 1011100 | 3 | OPEN_WEDGE |
| 6 | 31 | 1111100 | 3 | OPEN_WEDGE |
| 7 | 56 | 0001110 | 1 | CLOSED_TRIANGLE |
| 8 | 57 | 1001110 | 3 | CLOSED_TRIANGLE |
| 9 | 59 | 1101110 | 3 | CLOSED_TRIANGLE |
| 10 | 63 | 1111110 | 1 | CLOSED_TRIANGLE |
| 11 | 64 | 0000001 | 1 | CLOSED_TRIANGLE |
| 12 | 65 | 1000001 | 3 | CLOSED_TRIANGLE |
| 13 | 67 | 1100001 | 3 | CLOSED_TRIANGLE |
| 14 | 71 | 1110001 | 1 | CLOSED_TRIANGLE |
| 15 | 72 | 0001001 | 3 | CLOSED_TRIANGLE |
| 16 | 73 | 1001001 | 6 | CLOSED_TRIANGLE |
| 17 | 75 | 1101001 | 3 | CLOSED_TRIANGLE |
| 18 | 76 | 0011001 | 3 | CLOSED_TRIANGLE |
| 19 | 77 | 1011001 | 6 | CLOSED_TRIANGLE |
| 20 | 79 | 1111001 | 3 | CLOSED_TRIANGLE |
| 21 | 88 | 0001101 | 3 | CLOSED_TRIANGLE |
| 22 | 89 | 1001101 | 6 | CLOSED_TRIANGLE |
| 23 | 90 | 0101101 | 3 | CLOSED_TRIANGLE |
| 24 | 91 | 1101101 | 6 | CLOSED_TRIANGLE |
| 25 | 93 | 1011101 | 3 | CLOSED_TRIANGLE |
| 26 | 95 | 1111101 | 3 | CLOSED_TRIANGLE |
| 27 | 120 | 0001111 | 1 | CLOSED_TRIANGLE |
| 28 | 121 | 1001111 | 3 | CLOSED_TRIANGLE |
| 29 | 123 | 1101111 | 3 | CLOSED_TRIANGLE |
| 30 | 127 | 1111111 | 1 | CLOSED_TRIANGLE |

The six open-wedge classes are product IDs 1-6. Each taxonomy entry stores its complete orbit, orbit size, shape, and a bounded description. Tests independently rebuild the 96-signature partition rather than trusting these recorded totals.

## Upstream comparison

The supplied upstream table also partitions these same 30 orbits but assigns a different implementation label ordering. The correspondence is provenance only. Its H2H-clique enumerator reaches all closed classes but cannot reach any of the six open-wedge orbits. Product tests construct and classify a realizable minimal witness for every product class.

## Permanent qualification

The taxonomy test independently rebuilds each complete orbit and compares membership, not merely the recorded totals. Every one of 96 connected masks belongs to exactly one orbit, each canonical mask is its orbit minimum, and all six permutations classify identically. All 32 noncountable masks classify into no bin. The incidence/oracle matrix visits all 128 signatures: witnesses with nonempty hyperedges are counted according to independently computed set connectivity; signatures with an empty hyperedge are noncountable and rejected by the v1 incidence policy. All 30 canonical witnesses, including all six open-wedge witnesses, have exact one-bin contributions. String and sparse numeric renaming/dense reordering preserve counts. Taxonomy version: `candy.hypergraph-3edge-motif-taxonomy/1`.

These mathematical gates pass; they do not waive the separately incomplete security-tool coverage gate documented in the audit report.
