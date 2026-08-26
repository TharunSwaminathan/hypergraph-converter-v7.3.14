# v7.3.14 No-Regression Contract

This manifest freezes the behavior that must survive the controlled v7.3.13 to v7.3.14 repair. It is not a claim that v7.3.13 is correct. Known defects are recorded separately by the Stage 0 oracle and must not be converted into preservation expectations.

## Frozen baselines

- Repair target: `hypergraph-converter-v7.3.13-portable.zip`
  - package version: `7.3.13`
  - SHA-256: `D42DD5EDC1F91B3F495D53A9CD7BAF05EFE41B9638FD1564B1AF52059CF5D362`
- Behavioral reference: `hypergraph-converter-main.zip`
  - package version: `7.3.11`
  - SHA-256: `0E6D551BC3BAC044959CEE6B2877920BFF5FEED21BC545EA131DD375DB428917`

The main archive is a differential reference only. It is not a golden implementation and must never be wholesale-copied into the repair tree.

## Protected v7.3.13 behavior

1. RFC-aware CSV remains intact:
   - quoted fields;
   - commas inside quoted fields;
   - doubled quotes;
   - CRLF, LF, and embedded newlines in quoted cells;
   - malformed quote rejection;
   - lossless export/import behavior already covered by the v7.3.11 CSV regression test.
2. Projection safety remains present. Repairing false refusals must separate resource dimensions; it must not remove limits or restore unrestricted clique expansion.
3. H2H and V2V remain demand-driven. Loading a graph must not globally recreate unconditional V2V work.
4. Weight `0` remains a valid value through parsing, canonical data, weighted algorithms, statistics, and exports. Preview must be brought into agreement with this contract.
5. Custom Parser Studio keeps its worker, timeout, output-size/depth, host-global, network, mutation, and prototype-escape protections.
6. Downstream side-effect authorization gates remain fail-closed even when upstream request semantics are redesigned.
7. `scripts/package-portable-source.py` remains the single authoritative portable packager. Its normalized POSIX paths and explicit `0644`/`0755` mode policy must be preserved.
8. Valid string and finite-number identifiers, display order, serialization schema, existing algorithms, deterministic agent features, Ollama-only optional local assist, and offline operation remain supported unless a later approved stage documents a narrower intentional contract.

The executable preservation gate is `tests/stage0-v7-3-13-preservation.test.mjs` together with the pre-existing full suite.

## Permanent fixture corpus

`tests/fixtures/v7.3.14/stage0-regression-fixtures.mjs` defines these required families:

| Fixture | Contract |
| --- | --- |
| `TinyBasic` | Small connected/disconnected sanity graph. |
| `WhitespaceRows` | Historical row-hyperedge text produces `[1,2,3]`, `[2,4]`, `[1,3,4,5]`. |
| `CSVQuoted` | RFC quoting, quoted commas/quotes, CRLF, and embedded newline. |
| `ZeroID` | Numeric `0` and string `"0"` are represented explicitly. |
| `PrototypeIDs` | `__proto__`, `constructor`, and `toString` remain ordinary graph identifiers. |
| `LiteralNullID` | The real identifier `"null"` is distinct from unset UI state. |
| `WeightZero` | Time and weight zero are preserved. |
| `DuplicateHyperedgeID` | Ambiguous duplicate semantic identity is reproducible for later rejection. |
| `DuplicateOverlap` | 200 identical 46-vertex hyperedges: 207,000 candidate operations, 1,035 unique projected edges. |
| `OneHugeEdge1K` | CC/BFS/DFS must eventually work without storing 499,500 pair edges. |
| `OneHugeEdge5K` | Stress case for incidence-backed traversal/layout. |
| `ManySingletons2001` | Statistics must never return `computed` with an unavailable value or crash. |
| `IncidenceConflict` | Conflicting repeated hyperedge metadata must not be silently discarded. |
| `CSRInvalidIds` | Object/array IDs must be rejected before string coercion. |
| `MalformedH2H` | Full H2H grammar consumption is required. |
| `MalformedAdjacency` | Colon structure is required and extra structural colons are invalid. |
| `LargeSparse` | Large incidence-linear graph for lazy derivation/performance gates. |
| `DenseProjection` | Visualization/projection boundary case near 200,000 unique edges. |
| `ExpectedProtoID` | Expected-output comparison treats `__proto__` as a real ID. |

`tests/stage0-v7-3-14-fixture-corpus.test.mjs` prevents fixture drift.

## Known defects are not preservation contracts

The Stage 0 oracle reproduces 24 issue families: `HG713-R01` through `HG713-R08`, `HG713-C01` through `HG713-C09`, `HG713-S01` through `HG713-S04`, and `N01` through `N03`. Later approved stages must turn each reproduction into a corrected regression test. Do not make the full suite green by preserving the faulty output, skipping a case, weakening an assertion, or deleting an authorization/resource gate.

## Gates that must remain green after every approved stage

```text
npm run test
npm run lint
npm run build
npm run build:github
npm audit
npm audit --omit=dev
git diff --check
```

Run the Stage 0 oracle with the immutable reference root and both original archives:

```text
node scripts/run-v7-3-14-stage0-oracle.mjs \
  --main-root=<read-only-main-root> \
  --target-archive=<original-v7.3.13-zip> \
  --main-archive=<original-main-zip>
```

UI-related stages also require real browser qualification against loaded graphs. Release packaging requires fresh-extraction verification of the actual deliverable archive, including ZIP CRC/path checks and Unix `0755` metadata for intended launchers.
