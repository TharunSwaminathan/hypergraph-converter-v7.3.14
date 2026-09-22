# Post-Scope-4C handwritten patch checklist

Date: 2026-09-21
Baseline: `faeca1053f95a61bfe03ac88295c563d32f91969`
Decision: **PASS**

| # | Requirement | Final evidence | Status |
|---:|---|---|---|
| 1 | `.edge` / `.edges` upload support | Shared allowlist and Workspace DOM regression include both extensions. | **PASS** |
| 2 | Advanced selector hides legacy Freeform/NLP and AI Prompt | Visible selector remains limited to supported routes. | **PASS** |
| 3 | File upload drag/drop | Batch Updates retains the authoritative choose/drop surface; Workspace reuses the same action. | **PASS** |
| 4 | File/resource caps | Shared policy enforces 50 files, 10 MiB each, 50 MiB total, concurrency 3, and 128 KiB detection samples. | **PASS** |
| 5 | ESCHER triads versus CANDY motifs | Statistics labels Line-Graph Triangles separately and exposes the qualified CANDY 30-class product (6 OPEN_WEDGE, 24 CLOSED_TRIANGLE) without ESCHER source. | **PASS** |
| 6 | Quick Links persist | Explain H2V, Graph stats, Diagnostics, and Assistant help remained visible across upload, conversion, read-only navigation, and confirmation staging. | **PASS** |
| 7 | Composer Attach/New Batch remains removed | Live DOM and regression show only the message composer and Send. | **PASS** |
| 8 | Batch Updates has a real upload path | Existing choose/drop upload remains; Workspace is a second UI entry to the same processor, not a second pipeline. | **PASS** |
| 9 | Graph Preview custom sizing and filters | Fixed 10/25/50/100/200 plus custom 1..10,000; vertex and Hypergraph-only hyperedge search each provide found/not-found/clear behavior. | **PASS** |
| 10 | Statistics review | Browser metrics, Line-Graph Triangles, and Hypergraph 3-Edge Motifs are distinct. Qualified compute stages exact Assistant confirmation; unavailable CUDA is truthful with no CPU fallback or projection. | **PASS** |
| 11 | V2 Graph Preview | Force/Circular/Grid, resize, drag, pan, zoom, selection, search, limits, graph replacement, empty state, Hypergraph, and Line Graph all remain covered by 6/6 Stage 5 suites. | **PASS** |

## Live corrective evidence

- Custom preview `2` applied; invalid `0` showed the bounded error and retained the previous effective preview.
- Vertex `4` and hyperedge `h1` were found; missing queries produced explicit not-found feedback; both cleared cleanly.
- Line Graph removed hyperedge-search affordance and stated that dots are vertices.
- `Show the triads.` compiled through `typed_dashboard_control` to `NAVIGATE_STATS`, made zero model calls, changed no graph state, and started no Runtime job.
- The real paired companion advertised no qualified CUDA motif capability and the UI refused compute without fallback.
- A trusted in-process qualification fixture enabled the button only for UI-path verification; the request staged the existing exact CANDY confirmation and was cancelled before any native job.

All successful changes remain uncommitted.
