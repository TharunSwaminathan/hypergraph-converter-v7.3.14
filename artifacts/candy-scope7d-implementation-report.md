# Scope 7D implementation and candidate boundary review

**READY TO CREATE SCOPE 7D MODEL CONNECTION CONTINUITY CANDIDATE COMMIT**

**PRE-COMMIT / PROPOSED-SOURCE QUALIFICATION**. No staging or commit. Baseline/HEAD `4f165ea3049e41c46da60ff9264ac04a613edc7a`; branch `candy-integration-scope7d-model-reconnect`. Initially clean tracked tree/index, HEAD, origin/main, live origin branch and peeled Scope 7C qualification tag matched the required baseline before edits. All local refs and live origin main/7D branch/tags remain unchanged.

Immutable source digest: `02038050f9feeac9e52cba7790a0aa2ad7b5b3429d24523c5b9a744064b47382` over 1,352 file paths and physical SHA256 values. Proposed product/test/doc delta: 15 paths (11 new, 4 modified), +534 / -118 lines. Eight additive reports bring the proposed candidate boundary to 23 paths. Exact product hashes and normalized proposed Git blobs are in final-inventory.json; all 23 hashes are in the excluded work/proposed-commit-manifest.json.

## Implemented behavior

One application/origin-level safe Ollama profile and selected model; project memory remains project-owned. Native IDB CAS revisions, tombstones and completion receipts; v3→v4 adds only modelConnections. Legacy selection can migrate as an unverified draft with auto OFF; old observed liveness/transport never grants permission. General settings no longer duplicate private connection selection; Forget cleans legacy hints while preserving source/graph/memory/history.

The App waits for workspace and memory restore, then loads the profile and attempts fresh GET model discovery only with explicit reconnect permission. CONNECTED is runtime evidence, not persisted configuration. Exact model verification precedes committed manual selection. Four bounded retry attempts, fixed increasing backoff, whole-response timeout, bounded inventories and a shared lease prevent tight polling. Missing model, stale owner and incompatible profiles fail closed. No automatic model/provider/transport substitution or inference health check.

Manual Connect remains explicit; OFF and Disconnect persist across reopen. Forget tombstones preference without deleting projects. Generations, aborts, local write serialization, native CAS and revision-only broadcasts prevent stale callbacks or foreign rebases. Healthy monitor checks preserve an in-flight inference; failed checks invalidate connection. Existing generation/diagnostics observations cannot grant live connection authority. The separate current Scope 7C context is rebuilt for real requests; no pending action or old prompt blob resumes.

## Qualification

| Gate | Frozen source | Git-free extraction |
|---|---|---|
| Clean npm ci | PASS | PASS |
| Full discovered tests | 301/301 PASS | 301/301 PASS |
| Focused 7A / 7B / 7C / 7D | 4/4; 3/3; 3/3; 3/3 PASS | 4/4; 3/3; 3/3; 3/3 PASS |
| Lint / production / Pages / relative builds | PASS | PASS |
| Production vulnerabilities | 0 | 0 |

Native Chrome: 27/27 PASS in fresh guarded profiles, comprising 23 App/continuity/control-server cases and 4 supplementary native upgrade/versionchange/timing cases. Actual already-running local qwen3:8b accepted three real App requests carrying freshly restored bounded project memory across reload and graceful browser close/reopen. Manual reconnect after durable OFF passes. Outage/missing model/retry exhaustion use an isolated owned loopback server; real Ollama was neither stopped nor started. Native cross-tab CAS and Forget preservation pass. v3 layout reconstruction preserves valid source/graph/memory and v4 adds exactly one store; this is not an old-binary or physical power-loss run.

Observed native measurements (warm running Ollama): approved profile restore 0.4 ms; initial manual discovery+commit 9.5 ms; standalone actual discovery 2.6 ms; automatic reconnect 11.6 ms. The controlled recovery and bounded-failure elapsed timings are in reconnect-results.json. No latency, arbitrary scale or physical persistence guarantee is inferred.

Substantive complete Scope 7D source/data-flow security review PASS: zero validated unresolved Critical/High. Automated Codex Security NOT RUN / no seal claimed. Production audit zero. Existing non-production install advisories are retained separately (6 moderate / 2 high); dependency manifests and lockfile are unchanged.

Proposed-source ZIP SHA256 `f0dd9b25ccc16ea0f44f5660dd0427b7dd28a63f4e4f48e2c307d040229fd604`; 1,891,713 bytes; 992 entries (936 files / 56 directories). Producer and independent structural verifier pass. Clean/populated archives are byte-identical; every archived file matches the frozen physical source inventory, all 15 reviewed paths are included, and read-only Git attribute normalization proves exactly those canonical blobs differ from baseline. Synthetic private endpoint/history/credentials/native/model-weight/cache markers are absent. All 23 relative-build output files match source/extraction exactly. Packaging/verifier policy is unchanged.

These are immutable proposed-source snapshots, not candidate commit provenance. Exact candidate-SHA package production, commit-bound verification, remote CI and final exact-SHA qualification remain DEFERRED until human boundary review and candidate creation.

## Boundaries and remaining work

Runtime/native/CUDA, STATIC/INCREMENTAL separation, no CPU fallback, graph algorithms, deterministic action authority, explicit confirmation and stale-context checks, no implicit projection, Analyze/Apply separation and parser review/Run/Apply remain unchanged. No process launcher, shell invocation, model installation, cloud provider, dependency, workflow or package-policy change. Existing model client and bridge implementations are unchanged; a new GET probe and coordinator own connection continuity.

S7-12 and S7-18 CLOSED within this explicit local bounded-reconnect scope. Polished Resume Workspace/visualization preferences (7E), physical power-loss/final integrated restart matrix (7F), historical motif archive and full workspace archive/cross-origin portability remain deferred/partial. Broader Runtime/bridge coherence remains partial. Lease expiry can permit a late suspended-request overlap; generation/CAS still prevent stale authority. Browser storage is origin-local rather than encrypted; same-origin compromise is outside these persistence guarantees.

1337 prior tracked files, including 416 historical artifact files, retain hashes and mtimes. All 38 historical tag objects and every local ref are unchanged. Pre-commit development failures remain under work; the first browser harness wait was corrected and final frozen runs pass. No historical NON-PASS evidence was rewritten or assertions weakened. No staging, commit, product push, tagging, merge, main update or Scope 7E.

## Exact proposed commit inventory

- `artifacts/candy-scope7d-browser-results.json`
- `artifacts/candy-scope7d-connection-state-machine.json`
- `artifacts/candy-scope7d-final-inventory.json`
- `artifacts/candy-scope7d-gap-closure.json`
- `artifacts/candy-scope7d-implementation-report.md`
- `artifacts/candy-scope7d-reconnect-results.json`
- `artifacts/candy-scope7d-security-review.md`
- `artifacts/candy-scope7d-test-results.json`
- `docs/LOCAL_MODEL_CONNECTION_CONTINUITY.md`
- `src/App.jsx`
- `src/agent/modelConnectionProbe.js`
- `src/agent/modelReconnectCoordinator.js`
- `src/components/AgentChatPanel.jsx`
- `src/components/ModelConnectionControls.jsx`
- `src/persistence/modelConnectionSchema.js`
- `src/persistence/projectSchema.js`
- `src/persistence/projectStore.js`
- `src/persistence/usePersistentModelConnection.js`
- `tests/candy-scope7d-mounted.test.mjs`
- `tests/candy-scope7d-profile-probe.test.mjs`
- `tests/candy-scope7d-reconnect.test.mjs`
- `tests/fixtures/candy-scope7d-browser.html`
- `tests/fixtures/candy-scope7d-browser.mjs`

Exclude all artifacts/candy-scope7d-work/**, profiles, source/extraction trees, packages, dependencies and temporary engineering harnesses from the candidate commit.
