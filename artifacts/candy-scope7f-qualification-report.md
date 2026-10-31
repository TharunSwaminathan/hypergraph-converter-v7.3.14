# SCOPE 7F PHYSICAL RESTART QUALIFICATION PASSED — EVIDENCE ONLY

Baseline: `1d4c3b0659e39ae015f8e85888a1f0f68b14cecf`. Branch: `candy-integration-scope7f-physical-restart-qualification`.
Required Scope 7E parent tag and main identify this baseline. No product/test/doc corrective is necessary; tracked source remains unchanged and the index is empty.

## Qualification results

- Fresh `npm ci`: PASS. Discovered source tests: **305/305 PASS**, fresh full run 409.3 seconds.
- Focused 7A / 7B / 7C / 7D / 7E: **4/4, 3/3, 3/3, 3/3, 4/4 PASS**.
- Lint, production build, Pages build, relative build, production audit and `git diff --check`: PASS. Production vulnerabilities: **0**.
- **20/20 requested interruption cases PASS** plus seven additional groups: **27/27** groups total. **35 actual forced browser restart cycles**, **2 actual renderer process crashes**, **6 dev-server process restarts**, and **1 actual WSL Ollama service stop/restart**. These counts describe different, overlapping boundaries and are not summed into a single case count.
- **15 fault-assisted groups** (11 in the primary twenty-case matrix). Hooks controlled boundary timing; native IndexedDB and actual process interruption remained real. Explicit native abort/quota, valid orphan and missing-current-graph injections are labeled in the matrix. No mocked storage substitutes for this final browser gate.
- True machine power-removal cases executed: **0**. OS shutdown/reboot: **0**. These remain unexecuted/deferred; no physical power-loss claim.
- Repeated recovery cycles: **12/12 PASS**: eight native core cycles over **13.025 seconds**, plus four integrated UI upload/conversion/memory/Resume/Start-Fresh/project-isolation cycles. Native objects stabilize at 18; UI objects stabilize at 39. No unexpected unbounded growth or browser exceptions/unhandled rejections observed in qualifying runs. The duration is bounded, not a long-duration reliability claim.
- Acknowledged saves retained. Pre-commit interruption preserves previous root; after native commit/before receipt interruption restores the complete new root, truthfully unacknowledged by old UI. No partial publication, orphan adoption or queued workspace/memory replay. Mounted chat/reference hydration may advance shared project revision without changing root/memory digests; this is distinct from replaying workspace/memory publication or authority.
- Native Assistant memory interruption, supersession, durable forgetting and bounded recall: PASS. Workspace/memory restore while real Ollama is stopped: PASS. Actual `qwen3:8b` request after forced application restart and again after actual service restart delivers restored bounded 7C memory as untrusted context: PASS.
- Durable Auto Reconnect OFF/manual disconnect: PASS; no automatic probes after restart. Actual outage exhausts four attempts and never claims Connected. Fresh runtime discovery precedes Connected.
- Stale save/delete rejection: PASS, including a stale surviving tab after renderer death and current-owner usability after an opponent crashes during publication. Explicit pre-confirmation kill never replays deletion.
- Resume restores DATA, never mutation AUTHORITY; project isolation and explicit/scoped Start Fresh: PASS. Missing newest graph is truthfully partial/read-only while the retained older graph checkpoint validates; no claim of arbitrary corrupted-root reconstruction.
- Manual security review: unresolved **Critical 0 / High 0 / Medium 0**. Automated seal: **NOT RUN / NOT CLAIMED**.

## Setup / retry evidence

Initial full run stopped at a Scope 5D UI test whose fixture waits 30 ms; one focused repeat also failed. A subsequent complete run passed that test but the Scope 6A package test correctly rejected temporary output located under source. Scratch storage moved outside source without weakening policy. A fresh full run then passed all 305 files and every remaining gate. All failed logs remain preserved. Transient Vite watcher EBUSY diagnostics involved owned Chrome profile files while mounted test servers scanned artifacts; the final full suite and lint succeeded.

Browser harness setup attempts 1–2 selected a Chrome built-in background target rather than a page, and attempt 3 supplied unsupported string source input. These ran zero qualification cases; their failure receipts remain preserved. Temporary tooling was corrected, product source unchanged. Qualifying runs are `native-4`, `ui-1` and `tabs-1`.

## Commit-bound hook exclusion and protected history

Fresh portable archive from exact baseline remains identical to the Scope 7E qualified archive: SHA256 `ce2ea6f6c8b3261f74e8636518e4efbfab47e657bcf1f3a5ff7177a0645d07f2`, **1,932,761 bytes / 1,007 entries / 951 files / 56 directories**. Verifier: **commit-bound**, source commit `1d4c3b0659e39ae015f8e85888a1f0f68b14cecf`. No Scope 7F hooks or temporary tooling are shipped.

Protected history: **PASS**. All 1388 tracked files and mtimes, all initial Git refs/tags, local/origin main and origin tags match initial snapshots. All eight prior untracked Scope 7E exact-SHA report digests match their preserved manifest. Prior failed SHA `d3eeb5049941ee606b378a8345e41f1d0fbd7636` and its historical NON-PASS evidence are not rewritten or reclassified. No staging, product commit, push, tag, merge or main modification.

## Exact evidence inventory

- `artifacts/candy-scope7f-physical-restart-plan.md`
- `artifacts/candy-scope7f-interruption-matrix.json`
- `artifacts/candy-scope7f-browser-results.json`
- `artifacts/candy-scope7f-restart-soak.json`
- `artifacts/candy-scope7f-memory-results.json`
- `artifacts/candy-scope7f-model-reconnect-results.json`
- `artifacts/candy-scope7f-security-review.md`
- `artifacts/candy-scope7f-final-inventory.json`
- `artifacts/candy-scope7f-qualification-report.md`

Temporary diagnostics, isolated profiles, source gate logs, raw crash receipts, screenshots (if any), and audit tooling remain under `artifacts/candy-scope7f-work/**`; exclude that entire directory from any future candidate. External temporary scratch path is recorded in `temporary-environment.json`. Product/test/doc proposed commit inventory: **empty**. The nine evidence files above are additive and untracked.

## Deferred work / hard stop

True machine power-loss/OS crash testing, physical disk/quota exhaustion, long-duration reliability soak and arbitrary damaged-root reconstruction are not established by these bounded tests. Workspace export/import, motif history and broader Runtime/bridge redesign remain deferred. No new scope or release/promotion action is started. Actual Ollama service has been restored active; all owned browser/dev-server processes are stopped.
