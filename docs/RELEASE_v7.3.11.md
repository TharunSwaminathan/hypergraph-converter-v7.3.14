# Hypergraph Converter Studio v7.3.11

## Remediation release over v7.3.10

v7.3.11 addresses the two Critical and four High findings from the v7.3.10 diagnostics
report in full, plus a targeted subset of the Medium/Low findings chosen for being
concretely scoped and independently verifiable. It does **not** claim to close every
finding in the v7.3.10 issue register — see "Deferred" below for an explicit list of
what was not attempted and why, rather than a silent gap.

## Critical fixes

### V7310-D01 — Read-only/action classifier gaps (compositional Help safety)

The deterministic request-semantics classifier (`requestSemantics.js`) was missing 23
categories of read-only phrasing found by the v7.3.10 expanded fuzz matrix: deferral
("before I decide", "hold off on"), permission/consent denial, definitional wrapping
("explain the meaning of"), comparison ("compare X with doing nothing"), quoted-span
explanation with curly quotes, and ambiguous trailing-question-mark phrasing on an
otherwise-imperative sentence. Fixing this also surfaced — and fixed — two places
(`dashboardActionGrammar.js`'s navigation path, `parserWorkflowGrammar.js`'s workflow-
preparation path) where the central classifier's `readOnlyScope` decision was being
short-circuited by an earlier, narrower pattern match before it could run.

Verified against all 1,023 originally-failing queries from the uploaded
`expanded_readonly_fuzz_report.json` (now `tests/fixtures/v7.3.11/expanded-readonly-known-failures.json`),
plus 3,772 requests through the real production compile pipeline
(`tests/expanded-readonly-safety-v7-3-11.test.mjs`), plus the full existing 6,560 +
3,280-request v7.3.10 safety corpus with zero regressions.

### V7310-D02 — Pending-state replacement candidacy

`isPlausibleGraphMutationText()` treated a pending graph mutation as a "plausible
replacement" whenever the incoming text contained any of a handful of extremely
common words ("only", "use", "it", "that", "cancel") *anywhere*, and — separately — fell
through to a general "propose a new mutation" matcher that granted an automatic pass
whenever *any* mutation was pending, regardless of wording. Replaced both with an
explicit typed-correction requirement: a replacement must name the pending target and
supply a concrete new field/operand/value (e.g. "Change the pending vertex from 6 to
7", "Replace author_id with researcher_id in the pending mapping").

Verified against all spec examples plus a 249-request stress test wrapping
pending-relevant commands in every known read-only frame
(`tests/pending-state-correction-typing-v7-3-11.test.mjs`).

## High fixes

### V7310-D03 — Eager/unbounded projection materialization

Added deterministic, overflow-safe budgets (`estimateProjectionPairCount`,
`buildTwoSectionProjectionSafely`) so a huge candidate pair count is refused before
allocation instead of hanging the tab. Statistics now use a smaller, always-on budget
(50K pairs) separate from the larger budget used when a person explicitly opens the
Mappings tab (2M pairs) — this is what actually fixes the concrete repro (a single
1,000-vertex hyperedge went from a ~3 second freeze on every load to ~3ms). Also fixed
an accidental O(H²) hot path in `buildH2H` (linear `.find()` → `Map` lookup).
**Not implemented**: Web Worker offloading and `AbortController`-based cancellation —
see "Deferred" below.

### V7310-D04 — Spread-based `Math.min(...)`/`Math.max(...)` overflow

`Math.min(...arr)`/`Math.max(...arr)` throw `RangeError: Maximum call stack size
exceeded` for large arrays well before the array is otherwise "too large." Added
one-pass `arrayMin`/`arrayMax`/`arrayMinMax` helpers (`src/utils/numeric.js`) and
replaced every graph-derived-array spread call site across the repo. Verified with a
1,000,000-element array and a 200,000-hyperedge degree distribution.

### V7310-D05 — Cornell/SNAP cardinality validation

`parseCornell` previously performed no validation at all: NaN/negative/fractional
sizes, mismatched `sum(nverts)` vs. `simplices.length`, and mismatched `times.length`
all silently produced corrupted or truncated hyperedges. Rewrote with full validation
(structured diagnostic messages, overflow-safe summation) that throws before
constructing any hyperedge — so a malformed file can never partially replace the
previously loaded graph.

### V7310-D06 — CSR/CSC structural validation

Added a shared `validateSparseMatrixStructure()` validator (pointer length, first
pointer = 0, monotonicity, terminal-pointer match, index range, duplicate-ID
rejection) used identically by both the JSON and CSV entry points.

## Selected Medium/Low fixes

### V7310-D07 — Prototype-sensitive identifiers

A vertex or hyperedge named `__proto__` crashed multiple mapping builders
(`buildV2H`, `buildH2H`, `computeStats`, `countTriads`, `validateHes`) and several
parsers, because they used plain objects as untrusted-key maps. Replaced every
identified site with `Map`. Verified all 9 reserved names
(`__proto__`, `prototype`, `constructor`, `toString`, `hasOwnProperty`, `valueOf`,
`then`, `length`, `name`) round-trip correctly as both vertex and hyperedge IDs across
every affected builder/parser.

### V7310-D08 — Lossless CSV/text exports

Added an RFC 4180-compatible CSV serializer (`csvCell`/`csvRow`/`csvDocument`) and a
matching RFC 4180-aware parser (`parseCsvDocument`, operating on the whole text via a
state machine so quoted fields with embedded newlines parse correctly), and applied
both to every CSV import/export path (`expIncidence`, `expBipartite`, `expClique`,
`expMatrix`, `expCSRCsv`, `parseIncidence`, `parseCSRCsv`). Verified round-tripping
commas, quotes, CR/LF/CRLF, tabs, leading/trailing spaces (on quoted fields), Unicode,
emoji, and `0`-valued time/weight fields.
**Known limitation**: exact leading/trailing whitespace preservation on *unquoted*
free-text formats (h2v/v2h/h2h/v2v plain-text export) still goes through the
pre-existing `tok()` helper's universal `.trim()`, used throughout the whole parser
codebase — changing that was judged too invasive/wide-blast-radius for this pass. CSV
formats (the primary interop path) are fully lossless.

### V7310-D11 — Batch activation no-op truthfulness

`setActiveAgentBatch()` unconditionally cleared parser result/logs/errors and bumped
`batchVersion` even when re-activating the *already*-active batch, while the caller
separately (and correctly) reported `changedState: false` — an accurate report sitting
on top of an inaccurate action. Added the missing early-return guard.

### V7310-D17/D18 — Unused legacy Python backend

Confirmed `server.py` is not referenced by the frontend, any launch script, the
packaging script's required-files list, `package.json`, or any test — genuinely
unused. Removed it from the release per the spec's preferred disposition for an
unused component.

### V7310-D19 — ZIP permission normalization

`package-portable-source.py` previously used `zipfile.write()`, which copies the
*source filesystem's* mode bits into the archive — a loose umask or a bad extraction
upstream could silently produce world-writable release entries. Rewrote to build
explicit `ZipInfo` entries with a fixed policy (0644 regular files, 0755 for
`.sh`/`.bat`/`.ps1` launchers only, deterministic timestamp for reproducibility), plus
added symlink rejection and case-insensitive path-collision detection. Verified by
actually running the script and inspecting the produced archive's real permission
bits (not a source-string match).

## Deferred (not attempted or only partially attempted this pass)

- **D03 (partial)**: Web Worker offloading and `AbortController` cancellation for
  projection/statistics work were not implemented. The crash/hang risk is closed
  (verified), but CPU-bound computation still runs on the main thread for in-budget
  graphs.
- **D08 (partial)**: unquoted free-text format whitespace trimming, noted above.
- **D09, D10** — Custom Parser AST-based validation and cycle-safe output validator.
  Not started. D09 in particular requires adding and pinning a new AST-parser
  dependency, which is a larger, separate piece of work.
- **D12** — Model/settings mutation-trace normalization. Not started.
- **D13** — Request-coordinator busy-state ownership (reference-counted owner set).
  Not started; requires real component-level testing infrastructure this pass didn't
  set up.
- **D14, D15** — `local-runtime-bridge.js` env-var validation and
  timeout/streaming/disconnect handling. Not started.
- **D16** — Upload concurrency/size limits. Not started.
- **D20** — Broader test-infrastructure improvements (real DOM/component tests,
  checking in the full 97-frame corpus rather than the 23-frame subset this pass
  reconstructed from the fuzz report, browser smoke tests). Partially addressed in
  spirit by this pass's new tests, which exercise the real production compile
  pipeline and real packaging script rather than source-string matching — but the
  broader D20 ask (component-level tests, full 97-frame corpus check-in) was not done.

## Release gates run this pass

```
npm install   — clean
npm run lint  — clean (0 errors)
npm test      — clean (exit 0), 18 v7.3.11-specific test files added
npm run build — clean
```

`npm audit`, `npm run build:github`, and browser smoke tests were not run in this
environment — reported as unverified rather than reported as passing.
