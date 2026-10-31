# Scope 8A pre-commit qualification

READY TO CREATE SCOPE 8A WORKSPACE PORTABILITY CANDIDATE COMMIT

**PRE-COMMIT / PROPOSED-SOURCE QUALIFICATION** only. Branch: `candy-integration-scope8a-workspace-portability`. Baseline/unchanged HEAD: `1d4c3b0659e39ae015f8e85888a1f0f68b14cecf`. Final immutable source manifest SHA256: `7194025eaa319fad20dc1daa0b948d875f5d735b1711b4f26d444ba6b8f42a99`. A future commit and remote CI are not claimed.

## Result

Baseline source: 305/305. Final immutable source: 308/308; fresh Git-free extracted source: 308/308. Both final roots passed fresh npm ci, full suite, focused Scope 7A 4/4, 7B 3/3, 7C 3/3, 7D 3/3, 7E 4/4 and 8A 3/3, lint, production build, Pages build, relative build and production audit. All 23 outputs per build mode are byte-identical across source/extracted roots. All input bytes remained unchanged; git diff --check passed. The three new test files contain 22 grouped cases plus variants.

Native Windows Chrome / native IndexedDB: **19/19 PASS** in owned isolated state. Exporter and importer are genuinely separate clean profiles. Actual UI download matched deterministic API bytes. Fresh import, normal Resume, browser/server restart, durable reconnect OFF, explicit replacement/Cancel, project A/B isolation, duplicate conflict, surviving-tab stale save/delete rejection, corrupt file rejection and actual process interruption on both sides of native commit passed. Cancel-first review also preserves unsaved edits/current project before a separate import (guarded write-failure injection). Actual local qwen3:8b returned successfully and the captured request contains only permitted imported project memory as untrusted context. Import restored data and safe model selection, never mutation authority or a remembered connection callback.

Corruption/security matrix: **32/32 grouped scenarios PASS** (aggregate assertions; separate from the native count). Scoped manual review unresolved Critical/High/Medium: **0/0/0**. Two availability findings were corrected, not waived: long-whitespace secret scanning and metadata-reference Blob expansion. Compatibility corrections cover historical graph references, digit-containing saved slots, all fourteen input formats and valid eight-MiB canonical base64. Production vulnerabilities: **0**. Automated security seal: **NOT RUN / NOT CLAIMED**. The unchanged baseline's eight development dependency advisories (six moderate, two high) remain separately recorded; this is not a zero-advisory full dependency audit.

## Package

Final proposed-source ZIP SHA256: `539b90683bd2e8d201ee1eb5c03782819eb31b041fc98f51c4a9616ebef9957d`. Bytes: **1,979,418**; entries: **1016**; files: **960**; directories: **56**. ZIP root: `candy-scope8a-proposed-7194025eaa31`. Existing unchanged snapshot producer/verifier: structural-only PASS, every packaged payload independently matched frozen proposed-source bytes. Clean and populated inputs produced byte-identical archives, excluding synthetic private workspace/memory/native/model/credential markers, node_modules and actual build output. This is NOT commit-bound provenance; source commit is null. Extracted root contains no .git; a parent work-directory sentinel blocks upward Git discovery. All 960 extracted file inputs were preserved through testing/building.

## Exact proposed product/test/doc boundary

**16 paths: seven modified, nine new; +550 / -4 canonical Git-normalized lines.** No conversion algorithm, Runtime/native/CUDA/workflow/package-policy/dependency change. The existing saved-slot validator changes only two regexes to accept qualified digit-containing format names. The final inventory records physical SHA256, canonical SHA256 and Git blob identities for every proposed source path.

| Path | Change | Lines | Proposed Git blob |
| --- | --- | --- | --- |
| `docs/CANDY_SCOPE8A_WORKSPACE_PORTABILITY.md` | added | +53 / -0 | `e082b0fc48cd0d6ae555285a8d4fb337a0925ba3` |
| `src/components/ResumeWorkspacePanel.css` | modified | +1 / -0 | `fb4857f54f56db1676638906802cf3de165dd09d` |
| `src/components/ResumeWorkspacePanel.jsx` | modified | +2 / -1 | `41dd85b47178e1ce84b9145fcf4207eb3e66274e` |
| `src/components/WorkspaceExperience.jsx` | modified | +21 / -1 | `e30c362d6a1892a641a596cbba2b3204b3190ed2` |
| `src/components/WorkspacePortabilityPanel.jsx` | added | +50 / -0 | `6da2943098882aad787865a1fcc490b2ae0467e1` |
| `src/persistence/projectSession.js` | modified | +15 / -0 | `0be7aa60fed9a975751106a383d7643c6762846b` |
| `src/persistence/projectStore.js` | modified | +83 / -0 | `3b8b7eee2b364ba69cc30d2aed688f6afaa981cb` |
| `src/persistence/workspaceCapture.js` | modified | +2 / -2 | `7750ef686358cac09e706ab282616955b03810a0` |
| `src/persistence/workspacePortability.js` | added | +160 / -0 | `c0708640fff2b44f63e902049d99771b1dc40a0e` |
| `src/persistence/workspaceResumeCoordinator.js` | modified | +8 / -0 | `6a3209269e13ff18a2d9d9adc000930c3eb04f69` |
| `tests/candy-scope8a-adversarial.test.mjs` | added | +17 / -0 | `3b7b30b5784fee05f30fb43968e140c0716d9e08` |
| `tests/candy-scope8a-portability.test.mjs` | added | +71 / -0 | `4fa20d036a0516b5d49a666f58bbd0de65d0d180` |
| `tests/candy-scope8a-ui.test.mjs` | added | +13 / -0 | `48a06105ef12427ce978f7784c84396e840346ed` |
| `tests/fixtures/candy-scope8a-browser.html` | added | +1 / -0 | `ebd008ad9a9d235dbc5f693b4374fc3df5d6428e` |
| `tests/fixtures/candy-scope8a-browser.mjs` | added | +42 / -0 | `6dcaa0902d5104824c9c69c0649eea7d0366ff93` |
| `tests/fixtures/candy-scope8a-portability.mjs` | added | +11 / -0 | `3831e7b6ed538c864baf8c4a9a1858649fe5e3fe` |

## Proposed evidence boundary

The proposed commit review boundary is these 16 product/test/doc paths plus the following nine final additive evidence paths: **25 paths total**. This is an inventory for review, not staging authorization. The inventory's own hash is pinned externally in the excluded work-directory digest receipt, avoiding a recursive self-hash.

- `artifacts/candy-scope8a-threat-model-v6.md`
- `artifacts/candy-scope8a-security-review-v6.md`
- `artifacts/candy-scope8a-test-results.json`
- `artifacts/candy-scope8a-browser-results.json`
- `artifacts/candy-scope8a-corruption-security-matrix.json`
- `artifacts/candy-scope8a-proposed-source-package.json`
- `artifacts/candy-scope8a-protected-history.json`
- `artifacts/candy-scope8a-final-inventory.json`
- `artifacts/candy-scope8a-qualification-report.md`

The earlier design, preliminary threat models and V5 manual review remain preserved outside this proposed final evidence boundary. Everything under `artifacts/candy-scope8a-work/**` is excluded: temporary controllers/servers/probes, isolated profiles, raw logs, snapshots, extracted trees, build outputs, ZIPs and digest receipts. Preliminary failures/snapshots were retained; final readiness uses V6 only. Development harness failures (download-session lifetime, test timing/selection and cleanup) are not hidden or reclassified as final PASS.

## Protected history and limits

PASS: local refs and origin main/all tags match the initial read-only snapshot, including v7.3.15 and Scope 7A-7F identities. All 1381 unaffected tracked files retain their bytes and mtimes. All twelve prior Scope 7F evidence files remain byte-identical, as do tracked historical PASS/NON-PASS artifacts. Index remains empty. No stage, commit, push, tag, main change or security scan occurred. Owned qualification browser/server processes were terminated; personal profiles were not touched. Existing local Ollama service is not a qualification-owned process.

Hash integrity is not sender authentication. Recognizable credential patterns are refused, while arbitrary secrets hidden in user data still require the explicit source-content review described in the UI. Compressed workspace containers, cloud sync and arbitrary filesystem extraction are unsupported. Native process-kill evidence is not physical power removal or all-platform browser reliability. Mock quota/abort/held-completion tests, guarded native timing hooks and actual model traffic are labeled separately.

Deferred: human candidate-boundary review and creation of a candidate commit; exact candidate-SHA/commit-bound package qualification; candidate-bound remote CI/final exact-SHA closure; Scope 8B motif history and further Scope 8 work. No tag or promotion readiness is claimed. Hard stop before staging/commit/push/tag/main changes.
