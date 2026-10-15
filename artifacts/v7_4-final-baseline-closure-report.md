# V7_4 merged baseline — final package and provenance closure

**READY FOR FINAL V7_4 MERGED BASELINE PROMOTION**

Final exact candidate: `da4629b1f4204fbfc8f8e6d14941d29319d79e90`. Repository: `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14`. Branch: `v7_4-merged-baseline-integration`. HEAD, origin tracking ref and live remote branch all match this SHA. Tracked and staged working trees are clean. Intermediate `0fb1e9d` and `c07ce6b` are historical provenance only, not final qualification anchors.

## Exact Git identity and preservation

Released immutable v7.3.14 / RC2 remains `9d79d9f9027b338096d7cf62d67c2a22e9cab247`. All recorded refs (including main, tags, RC1/RC2 evidence branches and `v7_4-merged-baseline-evidence`) remain unchanged. All 1255 pre-existing tracked working files and 617 historical artifact files retain their pre-session SHA256 hashes. Evidence is additive and untracked; no product source change was made in this closure.

Git records **77 paths: 25 added, 48 modified, 4 deleted** against RC2. The former 74-path delta gains three paths: the two existing tests modified by the Windows corrections and the added polling helper. The exact candidate delta is recorded in `v7_4-final-baseline-inventory.json` with every added path explained below.

## All five remote checks bound to the final SHA

Authenticated read-only GitHub API results identify `head_sha=da4629b1f4204fbfc8f8e6d14941d29319d79e90` for all three workflow runs and all five jobs. Both platform jobs have real success conclusions; their workflow's continue-on-error setting is not used to infer a pass. The `Run npm test` steps succeeded. The Windows raw job log additionally contains both correction markers and `Node test suite passed: 274/274` together.

| Gate | Result | Exact-SHA evidence |
| --- | --- | --- |
| CPU release / pull_request | PASS | [`da4629b` job 116192934846](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/38664422698/job/116192934846) |
| Ubuntu | PASS | [`da4629b` job 116192935832](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/38664422827/job/116192935832) |
| Windows | PASS | [`da4629b` job 116192935878](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/38664422827/job/116192935878) |
| macOS | PASS | [`da4629b` job 116192935892](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/38664422827/job/116192935892) |
| CPU release / push | PASS | [`da4629b` job 116192924245](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/38664419177/job/116192924245) |

The initial connector/anonymous API attempts returned 404. Existing Git credential access then retrieved metadata and Windows logs successfully. Credentials were used in memory only and are absent from evidence. The signed log redirect was followed without forwarding the GitHub credential. `v7_4-final-baseline-ci.json` contains metadata, job steps, URLs and Windows log marker/hash evidence; the raw log is retained under the final log family.

The first Windows failure was the test's 100-poll window depending on timer/HTTP cadence; it could expire while a job was still preparing, before successful completion. The second was Git CRLF checkout representation compared with intentional LF generator output. The final Windows run proves the deadline-based wait and EOL-only comparison together. Neither correction changed production Runtime/native/CUDA code; neither failure established such a production defect.

## Protected production identity

All **91 protected files** are byte-identical between RC2 and this candidate: `candy-runtime/src`, `candy-runtime/native`, `src/graph`, `src/candy`, `src/persistence`, `src/visualization`, and `src/utils`. Per-file bytes, SHA256 and Git blob IDs are recorded in `v7_4-final-baseline-protected.json`. There is no protected production/native delta, including native Makefiles, Runtime schemas, motif taxonomy and qualification logic. Packaged protected files were verified against committed Git blobs, then extracted source bytes were rechecked after all tests and Runtime shutdown.

## Fresh automated gates

The first witness was exported using raw `git cat-file --batch` blobs from `da4629b1f4204fbfc8f8e6d14941d29319d79e90`. Every exported file was checked against its committed blob ID. This bypasses Git checkout filters; an initial diagnostic `git archive` export on this host applied EOL conversion and was replaced before any gate or package witness was accepted. No old package/extraction was used. Dependencies began absent; `npm.cmd ci` installed a fresh lockfile state in each test root.

Windows Node v22.23.3 was selected only for these child processes. Both official suites passed **274/274**. Both logs contain the job-engine and deterministic-command-reference pass markers. The two tests also passed separate explicit runs in the committed witness. Lint, build, build:github and audit passed in both roots. Production vulnerability count is zero in both audit JSON results.

| Root | Gate | Result |
| --- | --- | --- |
| Committed populated witness | `committed-ci` | PASS (21.669s) |
| Committed populated witness | `committed-test` | PASS (159.755s) |
| Committed populated witness | `committed-lint` | PASS (10.434s) |
| Committed populated witness | `committed-build` | PASS (0.891s) |
| Committed populated witness | `committed-build-github` | PASS (0.773s) |
| Committed populated witness | `committed-audit` | PASS (0.885s) |
| Committed populated witness | `committed-job-engine` | PASS (2.811s) |
| Committed populated witness | `committed-command-reference` | PASS (0.175s) |
| Separate package extraction | `extracted-ci` | PASS (11.937s) |
| Separate package extraction | `extracted-test` | PASS (157.298s) |
| Separate package extraction | `extracted-lint` | PASS (10.512s) |
| Separate package extraction | `extracted-build` | PASS (0.897s) |
| Separate package extraction | `extracted-build-github` | PASS (0.789s) |
| Separate package extraction | `extracted-audit` | PASS (0.856s) |

Committed populated witness: `C:\Users\tharu\OneDrive\Documents\Candi\v7_4-final-baseline-closure-20261015\committed-populated\hypergraph-converter-v7.3.14`.
Separate extracted root: `C:\Users\tharu\OneDrive\Documents\Candi\v7_4-final-baseline-closure-20261015\extracted\hypergraph-converter-v7.3.14`.
All commands, candidate identity, durations, exit codes and logs are retained in `v7_4-final-baseline-local-gates.json`, `v7_4-final-baseline-extracted-gates.json` and `v7_4-final-baseline-logs/`.

## New authoritative portable package

Archive: `C:\Users\tharu\OneDrive\Documents\Candi\v7_4-final-baseline-closure-20261015\hypergraph-converter-v7_4-da4629b-portable.zip`

| Property | Final value |
| --- | --- |
| Candidate | `da4629b1f4204fbfc8f8e6d14941d29319d79e90` |
| SHA256 | `a27dfbd50d4fb7ebfa9c91f6a8190ac6b20d2d8cdc48877bf6c19c5962477e84` |
| Byte size | 1,694,450 |
| ZIP entries | 910 |
| Files | 854 |
| Directories | 56 |
| Root | `hypergraph-converter-v7.3.14/` |
| Clean/populated byte comparison | IDENTICAL |
| Archive verifier | PASS; zero issues; CRC integrity OK |

Both witnesses use the unchanged qualified repository packager, its fixed timestamps, path sorting and permissions. The clean source is solely the committed tree. The populated source also contains actual installed dependencies, both build output and suite-generated artifacts, plus synthetic excluded-path witnesses for Git metadata, evidence, native build output, `.local`, temporary files and secret/config locations. Both ZIP files are byte-identical. Every one of the 854 packaged file entries matches a blob in the exact final commit; no untracked evidence or diagnostic input entered the product package.

Included: `candy-runtime/src/artifacts/artifactStore.js`, both Windows test files, `tests/helpers/waitForJobStatus.mjs`, `tests/v74-corrective-regressions.test.mjs`, and **all 47 committed portable test fixture files**. Excluded: root artifacts, `.git`, node_modules, dist, coverage, Runtime `.local`, native build outputs, credentials/tokens, temporary qualification scripts and local diagnostic clones. The archive verifier, full member manifest and package JSON provide exact entry evidence. Root historical evidence is omitted while intentional nested fixtures are included; the extracted full suite passes this policy.

Historical archive SHA `04b80210705cd5be0395760bdf1f5833da3505a2ef668d0eba0cf5feec7a2f0c` is retained solely as historical identity. It is not this candidate's package.

## Fresh extracted Runtime and service state

No prior Vite, Runtime, Ollama, bridge, browser tab or PID receipt was trusted. Studio and Ollama were not needed and were not started as services; no model call or prior browser qualification was repeated. Automated tests own any temporary test servers they create.

After extracted automated gates, the Runtime port was confirmed unoccupied and the Runtime was explicitly started with `npm.cmd run candy:runtime` from the fresh extraction. PID `16156` owned the new `127.0.0.1:8791` listener; its process receipt and freshly created pairing file tie the response to this launch. HTTP `/v1/health` returned 200 with `runtimeStatus=ready`; process existence alone was not treated as readiness.

Unauthenticated discovery: **401**. Wrong credential: **401**. Disallowed Origin: **403**. Authenticated discovery: **200**, schema `candy.capabilities/1`, fresh Runtime session `0f4858a9-3777-4db2-8ace-3b8096e5835b`. A fresh-session nonce artifact was uploaded and its metadata successfully read back. Source SHA256s and archive identity tie the launch working directory to this final package. Pairing credential material is absent from evidence.

Without trusted native qualification context, discovery publishes no executable CUDA capability. `LOCAL_CUDA`, `CUDA_STATIC` and `CUDA_INCREMENTAL` qualification checks all report unavailable. The actual NativeProcessRunner trusted-executable gate rejects all three with BACKEND_UNAVAILABLE before spawning native execution. No injected trusted discovery context, native build or live GPU qualification was used.

Runtime shutdown: **PASS — SIGINT handled by CLI; pairing credential removed; PID exited; listener closed**. The new process is gone, port listener is closed, and its pairing credential file is removed. After Ctrl+C, npm.cmd prompted to terminate its batch; confirming Y returned wrapper exit code 1, the requested interruption rather than a failed Runtime gate. The CLI's own graceful cleanup was independently verified. Evidence: `v7_4-final-baseline-runtime.json`, `v7_4-final-baseline-runtime-console.json` and the CUDA log.

## Issue and security/reliability closure

The existing corrective register retains **10 RESOLVED / 0 STILL OPEN**, including V74-D01; it records zero confirmed Critical/High issues. Its path/hash is referenced in `v7_4-final-baseline-closure.json`, without rewriting it. The only product difference from the previously adopted qualified baseline is the two narrow test corrections across three paths. Manual review of those changes and the package/authentication checks found no unresolved Critical/High issue. This final pass is package/provenance qualification, not a new repository-wide security scan.

Limits remain: human review of generated Custom Parser code is required; model-generated behavior is not automatically trusted; public GPU CI does not substitute for prior exact native qualification; no live GPU qualification was performed in this closure; Scope 6B has not been implemented or qualified.

## Added paths and purpose

| Added path | Purpose |
| --- | --- |
| `.github/workflows/ci.yml` | Ubuntu/macOS/Windows automated build and test qualification. |
| `.github/workflows/deploy-pages.yml` | Browser Studio GitHub Pages deployment workflow. |
| `.nvmrc` | Supported local Node version selection. |
| `candi-s1-assistant-awareness-corrective-report.md` | Imported S1 Assistant awareness corrective provenance. |
| `candi-s1-merge-candidate-report.md` | Imported S1 merge-candidate provenance. |
| `clean-install.sh` | Cross-platform clean dependency installation launcher. |
| `docs/CROSS_PLATFORM.md` | Supported cross-platform setup and operation guidance. |
| `docs/MERGE_NOTES.md` | Merged baseline integration notes. |
| `docs/V7_4_CORRECTIVE_NOTES.md` | Qualification corrective behavior and limits. |
| `public/.nojekyll` | Static Pages publishing marker. |
| `run-build.sh` | Supported shell build launcher. |
| `run-dev.command` | macOS double-click development launcher. |
| `run-dev.sh` | Supported shell development launcher. |
| `run-preview.command` | macOS double-click preview launcher. |
| `run-preview.sh` | Supported shell preview launcher. |
| `run-with-ollama.command` | macOS local model application launcher. |
| `scripts/check-node-version.mjs` | Supported Node version validation. |
| `scripts/launch.mjs` | Cross-platform launcher implementation. |
| `setup-ollama-model.command` | macOS local model setup launcher. |
| `src/agent/assistantContextSnapshot.js` | Live Assistant context snapshot for grounded responses. |
| `src/agent/assistantReadOnlyGrounding.js` | Read-only Assistant grounding in current application state. |
| `src/studio.css` | Merged Studio visual styling. |
| `tests/assistant-live-context-v7-3-14.test.mjs` | Assistant live-context grounding regression coverage. |
| `tests/helpers/waitForJobStatus.mjs` | Windows corrective: bounded monotonic job polling with abort and diagnostics. |
| `tests/v74-corrective-regressions.test.mjs` | Merged corrective regressions including portable fixture/evidence policy. |

## Modified paths

- `.gitattributes`
- `.gitignore`
- `MODEL_SETUP.md`
- `README.md`
- `configure-ollama-origins.example.sh`
- `docs/DETERMINISTIC_COMMAND_REFERENCE.md`
- `package-lock.json`
- `package.json`
- `scripts/package-portable-source.py`
- `scripts/verify-portable-archive.py`
- `src/App.jsx`
- `src/agent/actionIntentRegistry.js`
- `src/agent/actionPlanner.js`
- `src/agent/agentResponses.js`
- `src/agent/capabilityRegistry.js`
- `src/agent/customParserSpecialist.js`
- `src/agent/deterministicNlu/commandCatalog.js`
- `src/agent/deterministicNlu/commandCatalogFormatter.js`
- `src/agent/deterministicNlu/domains/datasetGroupingGrammar.js`
- `src/agent/deterministicNlu/domains/graphMutationGrammar.js`
- `src/agent/deterministicNlu/domains/parserWorkflowGrammar.js`
- `src/agent/deterministicNlu/graphOperationAuthorization.js`
- `src/agent/deterministicNlu/intentClassifier.js`
- `src/agent/deterministicNlu/positiveAuthorization.js`
- `src/agent/modelPromptBuilder.js`
- `src/agent/ollamaActionPlanValidator.js`
- `src/agent/routeRegistry.js`
- `src/components/AdvancedOptionsPanel.css`
- `src/components/AdvancedOptionsPanel.jsx`
- `src/components/AgentChatPanel.css`
- `src/components/AgentChatPanel.jsx`
- `src/components/AlgorithmsPanel.jsx`
- `src/components/BarChart.jsx`
- `src/components/CandyMotifResult.jsx`
- `src/components/CandyMotifStatistics.jsx`
- `src/components/CustomParserSpecialistPanel.jsx`
- `src/components/DeterministicCommandHelp.css`
- `src/components/DynamicHypergraphUpdatePanel.jsx`
- `src/components/ErrorBoundary.jsx`
- `src/components/Viz.jsx`
- `src/components/ui.jsx`
- `src/index.css`
- `src/main.jsx`
- `src/theme.js`
- `tests/candy-scope2-job-engine.test.mjs`
- `tests/deterministic-command-reference-doc.test.mjs`
- `tests/postqualification-correctiveB-ui-contract.test.mjs`
- `tests/zip-permissions-v7-3-11.test.mjs`

## Deleted paths

- `src/App.css`
- `src/assets/hero.png`
- `src/assets/react.svg`
- `src/assets/vite.svg`

## Additive deliverables and hard stop

Final evidence family: `artifacts/v7_4-final-baseline-*`, including closure report/JSON, package identity, CI binding, inventory, protected hashes, both automated gate receipts, Runtime receipt, verifier/manifest and complete logs. Both pre-existing Windows corrective evidence families and earlier adoption/RC1/RC2 evidence remain unchanged. The final witness/export/probe tooling is outside the product repository and excluded from the archive.

No commit, evidence commit, push, tag, merge of main or the Draft PR, movement of v7.3.14, Scope 6B work, or CUDA/native source modification was performed. **Hard stop for review.**
