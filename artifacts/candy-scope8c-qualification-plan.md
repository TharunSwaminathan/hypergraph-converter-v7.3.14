# Scope 8C eventual qualification plan

**PLANNED / NOT EXECUTED.** Baseline `4237de4c768daa98f81536423e9bf6ff787f09ce`. This readiness audit performs no product qualification, browser run, model inference, build, audit or scan. A contract freeze and later implementation authorization are separate steps.

## A-Z gates

| ID | Gate | Required evidence / acceptance |
| --- | --- | --- |
| A | Proposed-source qualification | Freeze exact authorized source/test/doc paths and SHA256/Git blob receipts. Run all gates from an immutable snapshot containing exactly that delta. Label archive/results PRE-COMMIT / PROPOSED-SOURCE QUALIFICATION; never fake commit provenance or weaken verifier. A proposed-source result cannot satisfy final candidate identity. |
| B | Exact candidate-SHA qualification | After separately authorized candidate commit: prove parent, remote head, exact path inventory and frozen blobs; inspect actual candidate-bound CI on Ubuntu/Windows/macOS and CPU/browser release gate. If PR uses synthetic merge SHA, record candidate/base/merge trees and require complete tree equality or block/account for every difference before acceptance. Cancelled/skipped is not PASS. Fresh candidate-SHA package required. |
| C | Git-free extraction | Produce fresh committed-source ZIP using unchanged producer/verifier; independently verify provenance, payload SHA, exclusions, archive SHA/bytes/entries/files/directories. Compare clean/populated output bytes. Extract to fresh path without .git; npm ci, full/focused tests, lint, production/Pages/relative builds and production audit there. Do not reuse proposed ZIP as commit-bound evidence. |
| D | Native browser / real IndexedDB | Use isolated disposable profiles at canonical 127.0.0.1:5173, strictPort/no silent 5174. Run named browser cases below in actual browser/IndexedDB, capture exact URL/browser/profile/commit/receipts. Native storage evidence and injected faults must be labeled separately; do not touch real user storage. |
| E | Project isolation | A/B labels/history/source/graph/memory snapshots unchanged by import to C; new local UUID, deterministic reminted record IDs relative to C; no caller-selected destination. Return to A preserves memory and existing graph/action isolation. |
| F | Cross-tab/stale destructiveness | Two real tabs race new-file imports and preference changes; one identical import only. Review delete then local same-owner history append, foreign write, graph save, switch, deletion/tombstone and callback delay: reject obsolete destructive token/write; no readback adoption or resurrection. |
| G | Failures/quota | Native transaction abort and request errors; injected failure at project/history/thread/meta writes, preflight storage estimate, hard quotas and versionchange. Assert atomic rollback and oncomplete-before-saved. Full inventory/ledger/history/shared byte budgets; no existing data evicted; saved-but-discovery-error truthful. |
| H | Import/export compatibility | Old workspace v1/v2/v3 files remain accepted as before; v3 with history, v2 without history, genuine pre-8B DB upgrade. New wire v1 recognized only by new codec, rootless export supported; missing/invalid history fail closed. Full-workspace root requirement remains. |
| I | Malformed/corrupt matrix | Run corruption matrix below through pure decoder, staged API and mounted/native UI where reachable. Rehash forged claims to test semantic checks beyond digests. Validation/cancel writes nothing, original persisted bytes unchanged. |
| J | Resume | No saved state, history-only state, manual Resume, autoResume ON/OFF, Start Fresh, partial/corrupt workspace with valid history, corrupt/future history error; independent category counts; restart after import in profile B. No automatic mount from file or automatic analysis. |
| K | Authority isolation | Instrument Apply/delete/graph replacement/parser Run/Apply/CUDA submission/pending confirmation/live result registries; import/Resume/inspection counts zero. Imported model/endpoint/token fields reject; no owner/review capability reconstructed. |
| L | Fresh rerun | History-only project cannot rerun without matching current input. Add current input explicitly through existing path; CPU rerun gets fresh identity; changed input rejected; STATIC current confirmation double, INCREMENTAL fresh pending update requirement; no result SHA universal semantic equality claim. |
| M | Scope7C memory | Existing focused memory suites plus A recall preserved, C history-only memory absent, stale/conflict exclusion, untrusted_context_only, no history auto-retrieval, no imported instructions/action approval. |
| N | Scope7D reconnect | Existing focused reconnect suites plus fresh model verification, bounded outage/recovery, global durable OFF/tombstone untouched, stale generation invalidation and no automatic inference/process launch. |
| O | Scope7E Resume | Existing Resume/destructive tests plus unsaved-edit Cancel/confirm and same-origin reload; independent history status after append/delete/import, no obsolete count on switch. |
| P | Scope8A portability | Run all existing 8A files unchanged. Workspace with durable history and legacy history-free files export/import atomically; staged object forgery, replacement CAS, data bytes/memory/model rules unchanged. |
| Q | Scope8B history | Run all existing 8B history/adversarial/UI/motif files unchanged: six CPU families, validated native doubles, dedup, replay ledger, retained clear/delete semantics, stale exact command/revision, detached capture and imports remain unverified. |
| R | Full tests | Clean npm ci in exact immutable source and fresh extracted directory; npm test; discover/count test files at each snapshot and record executed file/case totals separately. Baseline discovery is 312, not audit execution. Any added test paths adjust future count; do not predeclare PASS. |
| S | Lint | npm run lint from both source snapshot and Git-free extraction; retain exit codes/logs. |
| T | Production build | npm run build from both locations; verify expected outputs and no accidental private state. |
| U | Pages build | npm run build:github from both locations; exercise base URL asset policy. |
| V | Relative build | Use exact relative build invocation defined by candidate scripts (currently documented below), from both locations. Verify relative URLs; no new launcher/origin widening. |
| W | Production dependencies | npm audit --omit=dev in source/extracted; record exit code/report and require zero production vulnerabilities. No dependency changes expected. |
| X | Manual scoped security review | Review final actual diff and codec->stage->transaction->Resume flow against each threat row. Critical/High/Medium unresolved = 0, no masking of malformed-record failures. Automated seal only if separately actually executed; otherwise NOT RUN / NOT CLAIMED. |
| Y | Protected history | Before/after local and live remote main/qualified tags, failed 2d5ae411 immutable NON-PASS and all prior evidence hashes unchanged. No .codex/product/workflow/native/CUDA/runtime/launcher or private qualification state expansion; no work tooling staged; historical evidence never rewritten. |
| Z | Actual qwen3:8b | REQUIRED because project selection/Resume context is touched. Real model discovery and inference: restore A permitted memory, import C with no A recall, explicitly request in C and verify no history-as-instructions, return A and show permitted memory delivered to real request. Verify selected qwen3:8b, truthful fresh connection, durable OFF and controlled outage/recovery. If unavailable, report blocked; no double substitutes. |

Use exact candidate scripts, verified before execution. Baseline script values (facts, not invocations run):

```json
{
  "build": "vite build",
  "build:github": "vite build --base=/hypergraph-converter/",
  "build:relative": "vite build --base=./",
  "lint": "eslint .",
  "test": "node scripts/run-node-tests.mjs"
}
```

If no named relative script exists, use the repository's existing relative-build convention, `npm run build -- --base=./`, and record exact invocation/output; do not add a script for audit convenience. Run focused tests using repository's current test harness on every discovered 7A/7B/7C/7D/7E/8A/8B file plus the three new8C test files. Record per-file and internal case totals, no inferred success from old evidence. Existing focused file inventories are in current-state.md.

## Native browser matrix

**36 planned case groups; zero executed in readiness.** Each group may have multiple cases; eventual report records exact executed total and outcomes rather than claiming this planning count as a passing total. Native IndexedDB success evidence must be separate from injected faults/doubles. Use fresh disposable profiles; one process/profile cannot prove separate-profile transfer. Record isolated profile directories, restart process identities, input/output file digest and database receipts; do not use the user's real data. Browser tooling/raw traces remain in the future work namespace, not product candidate.

1. Fresh isolated profile has no history/download and no unexpected saved state
2. History-only project discovered with correct count/source-graph absence
3. Valid rootless history export; missing-root full-workspace export still fails explicitly
4. Export with partial/corrupt workspace but independently valid history
5. Zero/corrupt/future history refuses export without writes
6. Two exports of identical snapshot are byte-identical
7. Explicit file preview is read-only and Cancel leaves all stores unchanged
8. Successful new-project import uses fresh UUID, IMPORTED origin and empty authority-free thread
9. Separate profile A download -> profile B import through file picker
10. Close/restart profile B -> manual Resume imported history; no model/native/analysis autoexecution
11. Startup autoResume ON/OFF and Start Fresh preserve history-only project
12. Selection returns to source project A without importing A memory into C
13. Unsaved edit navigation/import Cancel-first retains edits; explicit confirm follows existing review
14. History summary updates after append/delete/clear/import without stale cached owner count
15. Workspace-only delete retains history and disclosure is truthful
16. Whole project deletion removes history and tombstone prevents stale resurrection
17. Two-tab identical import has one committed destination only
18. Replay same file after delete/retained marker refuses; different-file caps still enforced
19. Stage file then switch project/change selected preference; late callback invalidated
20. Delete review then same-owner history write rejects old review
21. Delete review then foreign-tab save/delete/tombstone rejects old review
22. Foreign stale save rejected and no foreign readback adopted as writer authority
23. Quota/abort injection rolls back project/history/thread/selection atomically
24. Committed receipt only after native transaction completion
25. Versionchange closes obsolete handle and exposes reload path, no false saved claim
26. Full record/envelope/application/inventory limits fail closed
27. Rehashed semantic corruption and plain-text XSS names rejected/escaped as appropriate
28. New history file invalid MIME/extension not trusted; oversized file stopped before decode
29. Apply/delete/parser/native/CUDA/graph-replacement/pending-confirmation counters remain zero on import/Resume
30. Matching current-input explicit CPU rerun fresh UUID; changed/no input disables
31. STATIC confirmation and INCREMENTAL pending-update boundaries through declared doubles
32. Legacy workspace v1/v2/v3 cross-profile transfer and history regressions unchanged
33. Actual qwen3:8b discovery/inference with permitted A memory; C no inherited memory/history instructions
34. Global model reconnect OFF survives import/restart; no probe/inference from file
35. Controlled model outage/recovery bounded; late response cannot overwrite switched owner
36. Keyboard/file/Cancel-default/status accessibility; cleanup of download URL/staged file on exit

## Corruption/security matrix

1. bad magic/format; unsupported/missing schema; unknown or duplicate keys/noncanonical JSON; invalid UTF-8/trailing junk
2. 3MiB boundary +/-1; depth/node/array/string bounds; 24 records +/-1; zero records; per-record/envelope post-rebase byte limits
3. prototype/constructor keys, accessor/function/symbol/Map/exotic object direct API inputs; cyclic structures
4. invalid/mismatched source owner/record UUID; duplicate record IDs with same/different completion digest
5. wrong file/record/completion/result/input digests; rehashed valid-shape but invalid semantic CPU/motif fields
6. forged local/imported provenance and graph revision/publication claims; false backend/device metadata stays unverified
7. source/graph/memory/chat/model/endpoint/token/credential/pending-op/approval/seen-ledger fields refuse
8. HTML/script/URL/instruction-looking names/outcomes rendered only as text or rejected by unchanged admission
9. unsupported/future persisted project/history envelope; tombstoned owner; corrupt preferences/default pointer
10. expired/forged/reused stage; owner switch during hash/preview/publication; selection CAS race; same-file concurrent import
11. quota/transaction errors each write; full80 inventory/full32 lineage/full8MiB history/shared128MiB; unchanged old ledger at512
12. legacy genuine workspace files accepted by old codec; new history-only file rejected by old workspace codec without partial write

## Frozen inventory and diff-check hard stops

Before candidate creation freeze exact proposed13 paths, modes, SHA256, Git blobs, parent, test evidence and immutable snapshot hash. `git diff --check` must pass for parent->proposed and cumulative future delta. Check new untracked files with `git diff --no-index --check` against an empty file; verify an intentional extra-EOF-blank control is detected. A no-index return1 may mean only content differs; separate whitespace errors from diff-presence status using captured output/control. After separately authorized staging, `git diff --cached --check` must pass and staged blobs must equal frozen receipt. **Any failure is STOP; never manually continue to commit.** Audit itself does not stage anything.

Commit-bound phase repeats gates from exact committed bytes and records remote branch == candidate, parent, all13 blobs and new package manifest source commit/verification level. No artifacts/*-work paths in candidate. Reproduce clean/populated ZIP equality and independent per-entry provenance/payload hashes; forbid private local/native qualification state in ZIP. New schema1 history files are data artifacts, not product source provenance.

## Pass/blocked policy

Unresolved Critical/High/Medium scoped findings must be zero; production dependencies zero vulnerabilities; all mandatory gates genuinely pass on the appropriate snapshot/SHA. Required qwen service unavailability or native browser proof absent blocks implementation qualification. Mocked native transports do not prove GPU execution; actual native code remains outside 8C.

**LIVE CUDA EXECUTION NOT REQUIRED / NOT CLAIMED** if backend behavior remains unchanged. Changing CUDA/native/Runtime boundaries requires a separately reviewed scope, not a new unsupported live CUDA claim. Preserve STATIC/INCREMENTAL separation, no CPU fallback/no implicit projection, Analyze/Apply and parser review/Run/Apply separation.

Automated security seal: **NOT RUN / NOT CLAIMED** unless a later separately authorized actual execution completes. Manual threat-model review is not a seal. Candidate/tag/main promotion requires its later exact-SHA verdict and explicit authorization; no Scope8D start is implied.
