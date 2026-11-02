# Scope 8B implementation and proposed-source qualification

READY TO CREATE SCOPE 8B DURABLE ANALYSIS HISTORY CANDIDATE COMMIT

Qualification level: **PRE-COMMIT / PROPOSED-SOURCE QUALIFICATION**. No candidate commit exists and no commit-bound release provenance or remote candidate CI is claimed.

Baseline: `f1e040e90764eac925d04c78d734a884dc4cd6cc`.
Branch: `candy-integration-scope8b-analysis-history`.
Parent qualification: `candy-integration-scope8a-workspace-portability-qualified` (peeled baseline; annotated object `f06a812497ba689fbcd312487b79f0fa9135845c`). Main, origin/main and origin/Scope8B matched baseline before implementation and remain unchanged.

The post-promotion baseline main workflows completed success: CI 41257524933, CPU/browser release 41257524952, Pages 41257524877. Those are baseline evidence only. Candidate-bound remote CI is deferred.

## Resulting behavior

Explicit CPU analysis and validated STATIC/INCREMENTAL motif completion archive bounded detached historical data with parameters, consumed input digest, graph/workspace revision and safe backend provenance. History is project-scoped, restored independently of live execution on Resume and inspected in a separate escaped-text UI. Current-input equivalence is freshly computed; intentional rerun enters the current safe request path. No old mutation/confirmation, parser Apply, native job/client/token or model connection authority is restored.

IndexedDB upgrades additively from v4 to v5. Shared project CAS, serialized writer lineage, exact destructive review and a private replay ledger reject stale or duplicated completions. Delete/clear retains replay guards. Retention limits are explicit:24 records,256KiB per record,2MiB per project,8MiB all history,512 lifetime completion identities and bounded node/depth admission. History cooperates with the existing128MiB workspace/history cap and never evicts memory/workspace. On ledger exhaustion new saving stops with LIMIT. Completed analysis and native transaction acknowledgement are separate UI states.

History-free exports remain v2; validated history uses an explicit v3 extension. Genuine pre-8B native-export bytes still import. V3 import remints record IDs/owner, marks historical origin IMPORTED/unverified and publishes atomically with existing Scope8A categories. Hashes detect consistency/corruption; they are not signatures of backend execution. Runtime/native/CUDA, model/agent behavior, package policy and historical evidence are unchanged.

## Qualification

| Gate | Frozen source | Fresh Git-free extraction |
| --- | --- | --- |
| Clean npm ci | PASS | PASS |
| Full discovered test files |312/312 PASS|312/312 PASS|
|7A /7B /7C /7D /7E /8A /8B focused files|4/4,3/3,3/3,3/3,4/4,3/3,4/4 PASS|4/4,3/3,3/3,3/3,4/4,3/3,4/4 PASS|
|Lint|PASS|PASS|
|Production /Pages /relative build|PASS /PASS /PASS|PASS /PASS /PASS|
|Production dependency audit|0 vulnerabilities|0 vulnerabilities|

Scope8B focused files contain11 history/compatibility groups,9 adversarial groups,3 native transport observer groups and mounted StrictMode UI qualification. Native Chrome/IndexedDB passed27 Scope8B groups (23 main +4 current-result/stale/corrupt supplemental), plus19 preserved Scope8A groups:46/46 total against frozen source. Quota-like failures and delayed crypto are guarded injected faults; browser/server terminations and IndexedDB transactions are actual. No personal profile was accessed. Native CPU tests ran all six algorithms. STATIC/INCREMENTAL tests explicitly simulate validated available and unavailable capabilities; no live CUDA execution is claimed.

Actual local qwen3:8b discovery/inference passed in the history portability and preserved8A flows. The requests contained only permitted restored project memory with untrusted-context authority. Existing durable model reconnect OFF remained OFF after browser restart. History did not alter memory or reconnect policy. Early unavailable-Ollama attempts were retained; the user confirmed the service running before the successful complete frozen-source retry. An automatically rejected bounded WSL hold was not retried.

Security review: PASS; unresolved Critical0 /High0 /Medium0. Automated security seal: **NOT RUN / NOT CLAIMED**. The manual scoped threat/security reports distinguish data integrity, local-origin trust and imported unverified claims. `git diff --check` passed. All protected refs (local and live remote), main, historical qualification tags including7F/8A and v7.3.15 are unchanged. All1,395 untouched tracked paths retain their initial physical SHA256 and mtime, including prior PASS/NON-PASS evidence. No staged paths, commit, push, tag, merge, main change or Scope8C start occurred.

## Proposed-source package

Frozen source inventory SHA256: `99e382a3a4dfec517c313bc6be2e723afa9cff0f2c698a69a8c42b3a2ae4aa20` (1420 Git-normalized files). Product/test/doc delta:25 paths, +723/−39 lines. Frozen files and extracted payload bytes were rechecked after qualification with zero mismatches.

Archive SHA256: `7f272e81f1a9dedd8481b4af44876e87a9fdad0faac8003aadc19ea5894f8bd3`. Bytes:2,019,325. Entries:1030 (974 files,56 directories). Clean and populated archives are byte-identical. The unchanged producer used explicit snapshot mode; the unchanged verifier reports structural-only. Independent verification additionally matched every payload SHA256 and exact membership to the frozen proposed-source inventory, checked permissions/path/CRC and extracted bytes. **No commit-bound provenance is claimed.**

All new persistence/UI/fixture/doc paths are included in the package. Root artifacts, raw qualification work/profiles, Git metadata, dependencies/build outputs, native local qualification installs and model/credential files are excluded by the existing policy. The source manifest and raw proof are retained under `artifacts/candy-scope8b-work`. The owned temporary S: mapping was removed after checking its exact external target; sources/extraction/logs are retained, and owned browser/server process termination receipts passed. User-managed Ollama was not stopped.

## Exact proposed implementation boundary

These25 paths were frozen before final qualification; no existing test was weakened/deleted and no product/test/doc source changed afterward. Full file byte sizes, SHA256 and Git blob IDs are in `candy-scope8b-final-inventory.json`.

|Path|Change|Git blob|
|---|---|---|
|`docs/CANDY_SCOPE8B_ANALYSIS_HISTORY.md`|added|`085129485b3c2434a2c1d8204908e6b48273f2e4`|
|`src/App.jsx`|modified|`f5f599f497f833e85889c950cbe6831e266fd604`|
|`src/candy/motifAnalysisController.js`|modified|`7f3b158be92c9254013643e21715eb479724d9d8`|
|`src/candy/useCandyRuntime.js`|modified|`50b58d212350a86b1cb8b8601d7249f72e7bad2f`|
|`src/components/AnalysisHistoryPanel.css`|added|`7709c86ff06e8585f0c1572312b8aa6301f4e8c9`|
|`src/components/AnalysisHistoryPanel.jsx`|added|`f092a766423b081892650d0a14c6a0e18f6f79f3`|
|`src/components/WorkspaceExperience.jsx`|modified|`33456b0fe43b3d5b2ea3747762400dddef252742`|
|`src/components/WorkspacePortabilityPanel.jsx`|modified|`aa1219f2829a6b0ed49b68a44407413bf290c460`|
|`src/hooks/useAlgorithms.js`|modified|`3ebc42283c229b1ecd15bba4316204f4d8476cda`|
|`src/persistence/analysisHistoryCoordinator.js`|added|`cb8a0be34160eb010999d51c2860511b3bf10aca`|
|`src/persistence/analysisHistorySchema.js`|added|`65d407869ae5d0d3c44a147157af7a1bf43b4dab`|
|`src/persistence/projectSchema.js`|modified|`8776770a387070c59d7959ab0e0c13c9c54ffd0a`|
|`src/persistence/projectSession.js`|modified|`6186ed952a06cb06d0bb4282adbeac7053750955`|
|`src/persistence/projectStore.js`|modified|`354904ea5662c38a090c7301e24b04ec5dafe9c2`|
|`src/persistence/useAnalysisHistory.js`|added|`26f52c8f3a73e372e4eb7ed243227db700a53d36`|
|`src/persistence/workspacePortability.js`|modified|`56f6d33c0d7ea1e00814ee3cd2c9899501d39142`|
|`src/persistence/workspaceResumeCoordinator.js`|modified|`558c5260a28d5d73b06450414e28d88376407de4`|
|`tests/candy-scope8b-adversarial.test.mjs`|added|`fb24bb180cf8fef01b2f40f4bc7a4db7053e3605`|
|`tests/candy-scope8b-history.test.mjs`|added|`690306b2461277010191fbc021bf96c8237335b6`|
|`tests/candy-scope8b-motif.test.mjs`|added|`6125467ffc00fdf40c2c858cac4629bf8771fd51`|
|`tests/candy-scope8b-ui.test.mjs`|added|`b08ff850605b372b9705b1eae34d5e2f074a1472`|
|`tests/fixtures/candy-scope8b-browser.html`|added|`a4107084a71d0ae0c9740a9ed232ca8e07ea48ed`|
|`tests/fixtures/candy-scope8b-browser.mjs`|added|`cec8826692de2217b2673102e180c5075eee80c1`|
|`tests/fixtures/candy-scope8b-history.mjs`|added|`6f7a90ab77a4a87fb7c1f5b8212c6948d7726d02`|
|`tests/fixtures/candy-scope8b-pre8b-workspace.json`|added|`f4d5dd39c2afde033297edeb15adb5d213051a69`|

The proposed review boundary also includes the11 additive Scope8B evidence files listed separately in the final inventory:36 candidate paths total. Evidence is completed after execution and cannot recursively hash its own inventory; the exact36-path SHA256/Git-blob receipt, including the inventory file itself, is retained externally to the candidate boundary at `artifacts/candy-scope8b-work/final-boundary-receipt.json`. Temporary tooling/raw qualification files under `artifacts/candy-scope8b-work/**` are excluded. Evidence additions are not represented as executable source tested before they were written.

## Deferred work

Exact candidate-SHA remote CI, commit-bound package production/verification, exact-SHA qualification, tagging and main promotion await human review and explicit commit authorization. Live GPU requalification, other analysis families, history-only export, favorites/pinning/metadata editing, cloud/cross-user synchronization and Scope8C are not claimed. Existing older partial/deferred Scope7/8 capabilities are not silently closed by this history feature.

Historical pre-commit attempts, baseline evidence, old exports and all prior PASS/NON-PASS records remain preserved. Hard stop at this proposed-source verdict.
