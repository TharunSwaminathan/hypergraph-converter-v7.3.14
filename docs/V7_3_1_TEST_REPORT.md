# v7.3.1 Test Report

Validation date: 2026-07-30

## Commands and results

The local Windows environment did not expose `node`/`npm` on PATH, so the checks were run through the bundled Codex Node runtime. The project scripts and source remain standard React/Vite scripts.

```bash
node --version
npm --version
npm ci
npm test
npm run lint
npm run build
npm run build:github
npm audit --omit=dev
python scripts/package-portable-source.py
unzip -t hypergraph-converter-v7-dataset-mapping-routing-remediation-portable.zip
```

Results:

- Baseline ZIP SHA-256 verified before copying: `26D5885354E3E046C04408648030C6D36A3BB1E642A3017126A004300C7912D6`.
- `npm ci`: passed during baseline/current-project validation.
- `npm test`: passed by expanding the package test script through the bundled Node runtime; all 40 test scripts passed.
- `npm run lint`: passed via direct ESLint invocation.
- `npm run build`: passed via direct Vite invocation.
- `npm run build:github`: passed via direct Vite invocation with `/hypergraph-converter/` base.
- `npm audit --omit=dev`: passed, `found 0 vulnerabilities`.
- Browser smoke test: passed at `http://127.0.0.1:5174/`; the dashboard and Hypergraph Assistant rendered, with no console errors.
- Portable packaging: passed; generated one-root ZIP with no `node_modules`, `dist`, `.git`, logs, `__MACOSX`, `.DS_Store`, or backslash-separated entries.
- ZIP CRC test: passed with Python `zipfile -t`.
- WSL `unzip -t`: passed after an approved WSL launch retry.

Build note: Vite still reports the inherited large chunk-size warning for the main JS bundle. This is a warning only and is not new to v7.3.1.

Live local-model note: no live Ollama model generation was required for this deterministic routing remediation. The tests cover degraded/timed-out runtime states and deterministic fallback behavior.

## v7.3.1 automated coverage

Automated coverage added in v7.3.1:

- dataset mapping intent classification;
- exact five-sentence mapping regression fixture;
- deterministic typed mapping fallback;
- bootstrap from active profile without manual Generate Mapping click;
- no-op repeat behavior;
- runtime degraded/timed-out mapping banner;
- source assertions that mapping handling precedes generic ActionPlan routing;
- portable ZIP path-separator source assertions.

## Regression fixture

The exact regression request:

```text
authors.csv is the vertex table keyed by author_id. papers.csv is the hyperedge table keyed by paper_id and year is the time column. authorships.csv is the membership table connecting paper_id to author_id. Preserve papers with no authors as empty hyperedges. Deduplicate repeated authorships.
```

Expected deterministic result:

- `authors.csv` is mapped as the vertex entity table with key `author_id`.
- `papers.csv` is mapped as the hyperedge entity table with key `paper_id`.
- `papers.csv.year` is mapped as the hyperedge time column.
- `authorships.csv` is mapped as the membership table.
- `authorships.paper_id` links memberships to `papers.paper_id`.
- `authorships.author_id` links memberships to the author vertex entity.
- unmatched hyperedge rows are preserved as empty hyperedges.
- duplicate memberships are deduplicated.

The regression passes without using generic ActionPlan routing or route-tab planning for mapping edits.
