# Scope 7B durable workspace pre-commit qualification

**READY TO CREATE SCOPE 7B CANDIDATE COMMIT**

This is **PRE-COMMIT / PROPOSED-SOURCE QUALIFICATION**. No candidate commit has occurred at generation. Branch: `candy-integration-scope7b-durable-workspace`. Baseline: `b34e6bbf5359a4855db6c9bbf1395f9b25b6d738`. Frozen source digest: `c2d792a2044f6f7057e85670a5b54f019752bee709cc8c092edbb44cbb30a198`. The existing interrupted work was preserved and continued; the resume inventory records all seven modified and thirteen added implementation paths before completion.

## Implemented behavior

Actual upload Blob/File bytes, explicit UTF-8 editor sources, canonical immutable graphs, mapping/derived metadata and bounded checkpoints now persist separately from chat/localStorage/project metadata. SHA-256 covers source bodies, snapshots, descriptors/root and mapping. Source/provenance/schema/ownership/digest/fingerprint validation finishes before App receives an available graph. Exact source reattachment distinguishes changed/missing/corrupt/unsupported bytes and preserves graph identity without running transformations. Minimal retry/reattachment and restored-parser review controls expose truthful state; no polished Resume UI is added.

Scope 7A CAS/tombstone contracts extend atomically across project revision, workspace root and body publication/deletion/eviction. One tab's chat/workspace writers share only their own bounded local revision lineage, never a rebase of another tab. No request-success acknowledgement is called committed. Native versionchange revokes owners; atomic abort/quota failure preserves the previous committed data. History reads are explicit verified historical data, not executable undo or pending authority.

## Final pre-commit gates

| Gate | Result |
|---|---|
| Clean npm ci | PASS |
| Full suite | **295/295 files**, 219.9 s |
| Focused Scope 7A / 7B | **4/4 / 3/3 files PASS** |
| Lint | PASS |
| Production / GitHub-Pages / relative builds | PASS / PASS / PASS |
| Production audit | **0 vulnerabilities** |
| git diff --check | PASS |
| Native browser/App matrix | **20 cases PASS** |
| Focused manual persistence security review | PASS, no validated unresolved Critical/High |

All 1,313 frozen source-tree files match the current proposal before/after gates. Full installs still report two High non-production advisories; manifests/lockfiles are unchanged. The test results contain exact commands/log hashes and distinguish 14 transactional workspace groups, 9 budget/adversarial groups, mounted happy-dom tests and real browser cases. No required case was passed by skipping it.

The real isolated headless Chrome matrix uses actual App File upload and Convert controls, verified refresh and graceful CDP Browser.close/reopen, a second top-level App, stale source/graph rejection, delete during preparation, native transaction-completion receipts, native abort and injected quota/API failures, versionchange, bounded history, source repair and parser review/Run/Apply separation. A separate native v1-to-v2 database case preserves valid 7A project/chat, leaves old references unavailable and proves old-client downgrade fails closed. User profiles/data/services were not accessed or restarted. There is no physical reboot/fsync claim. All qualification browser processes were gracefully closed.

Measured native cases include 0/128 KiB/1 MiB source objects and up to 5,000 hyperedges; timings are in storage-budget-results.json. Caps are 8 MiB source, 8 MiB graph, 256 KiB derived, 128 KiB root, 24 current sources, 5 prior checkpoints, 32 MiB logical/project and 128 MiB logical/application. Logical metadata/body bytes are counted; browser overhead/quota is not promised. Source sets are prechecked; browser estimate is attempted and actual transaction quota errors remain authoritative. Full archive export/import remains a versioned-contract foundation, explicitly partial, as permitted by the Scope 7B request.

## Protected boundary and limitations

Runtime/native/CUDA, deterministic authority, explicit mutation confirmation, stale-context/graph identity checks, STATIC/INCREMENTAL separation, no fallback/projection, Analyze/Apply, local-only Ollama and parser review/Run/Apply remain protected. Graph data restoration never restores credentials, jobs, pending actions, approvals or model liveness. No structured Assistant memory, automatic reconnect, motif result archive, cloud persistence/sync or later-phase implementation is introduced. Manual security review is separate from an automated security seal, which was NOT RUN / NOT CLAIMED.

S7-02/03/07/08 are closed within stated scope. S7-01/04/05/06/11/13/15/16/20 remain partial; S7-09/10/12/14/17/18 deferred; S7-19 unchanged. Historical motif results and full archive portability are not claimed complete merely because object contracts now exist. Per-gap reasons are in gap-closure.json.

There are **20 product/test/doc paths: 13 source, 6 tests/fixtures, 1 doc**, with **1147 insertions / 17 deletions**. The continuation additionally authorizes seven final evidence files, producing an exact **27-path proposed candidate commit**. The final inventory separates those boundaries and contains normalized expected Git blob IDs as well as physical source hashes. New source modules are direct schema/provenance/budget/restore/local-writer integration dependencies. Upload helpers retain original Blob owners rather than losing original encoding; App/Assistant integration shares storage ownership. The existing 7A browser fixture changes only its future versionchange target to databaseVersion+1, preserving the assertion after the additive database upgrade.

All 401 old tracked artifact files, other protected source/package/workflow inputs and original refs/index remain unchanged at this boundary. Diagnostic work under artifacts/candy-scope7b-work is excluded from staging. That directory may receive a narrow repository-local ignore entry to keep final status clean; no tracked .gitignore/package/workflow policy change is proposed. Later exact-SHA receipts will stay there and will not require an extra product commit. Existing NON-PASS/setup receipts remain preserved, including the first development harness's incorrect hidden-input selector; the harness was corrected without weakening product validation.

Exact proposed commit paths:

```text
artifacts/candy-scope7b-browser-results.json
artifacts/candy-scope7b-final-inventory.json
artifacts/candy-scope7b-gap-closure.json
artifacts/candy-scope7b-implementation-report.md
artifacts/candy-scope7b-security-review.md
artifacts/candy-scope7b-storage-budget-results.json
artifacts/candy-scope7b-test-results.json
docs/CANDY_SCOPE7B_DURABLE_WORKSPACE.md
src/App.jsx
src/agent/fileDetection.js
src/hooks/useFileUpload.js
src/persistence/projectSchema.js
src/persistence/projectSession.js
src/persistence/projectStore.js
src/persistence/storageBudget.js
src/persistence/usePersistentThread.js
src/persistence/usePersistentWorkspace.js
src/persistence/workspaceCapture.js
src/persistence/workspaceObjectSchema.js
src/persistence/workspaceProvenance.js
src/persistence/workspaceRestore.js
tests/candy-scope7b-budget-security.test.mjs
tests/candy-scope7b-mounted.test.mjs
tests/candy-scope7b-workspace.test.mjs
tests/fixtures/candy-scope7a-browser.mjs
tests/fixtures/candy-scope7b-browser.html
tests/fixtures/candy-scope7b-browser.mjs
```

After this pre-commit PASS, the continuation authorizes exact staging review, one candidate commit, normal branch push, committed-SHA source/browser/package/CI qualification, a new annotated qualification tag and fast-forward-only origin/main promotion. None of those post-commit/promotion results is claimed by this pre-commit record. They must pass independently; historical v7.3.15 and Scope 7A identities remain immutable.
