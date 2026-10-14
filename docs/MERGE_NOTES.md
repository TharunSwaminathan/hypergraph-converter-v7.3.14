# Final v7.3.14 build: what was merged

This build combines three lines of work. The version stays 7.3.14 because the test suite asserts it.

| Source | What it contributes |
| --- | --- |
| `hypergraph-converter-v7_3_14-crossplatform` | macOS/Linux/Windows launchers, GitHub Pages + CI workflows, Wolfram-style UI, bundled fonts |
| `hypergraph-converter-v7_3_14-s2-working` | Assistant awareness: live application snapshot, read-only grounding, model prompt additions, Scope 5f collision fixes |
| `hypergraph-converter-v7_3_14__1_` | CANDY Scope 6A only: runtime client and motif controller hardening, download lifecycle, live message history, release contract, benchmarks, RC2 packaging fix, CPU release-gates workflow |

The UI is the cross-platform design with further refinements (bar charts, assistant header, composer states).
Application logic is unchanged apart from the merged feature work above.
The CANDY native runtime still requires Linux or WSL.

Scope 6B is not implemented or qualified by this merge. S6-03, S6-04,
S6-05, S6-06, S6-16 and S6-17 remain deferred, as recorded in the qualified
RC2 Scope 6A evidence. This qualification does not implement Scope 6B.
