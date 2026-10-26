# Scope 6E package corrective — final exact-SHA closure

**READY FOR SCOPE 6E PACKAGE CORRECTIVE QUALIFICATION TAG AND MAIN PROMOTION**

Recorded 2026-10-26T01:59:00.738461+00:00. Repository `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-scope6e-package-corrective`; branch `candy-integration-scope6e-package-corrective`. HEAD, local `origin/candy-integration-scope6e-package-corrective` and the independently queried live GitHub branch all equal **`d22b9c89f79446fbfea2480e98e807f8da4dfbf4`**. Starting Scope 6D baseline: `c294ed0cea093bb8933d06e6e23177a7f1409952`. The worktree has no tracked or staged changes; only untracked qualification evidence is present.

## Exact committed boundary

Git reports **4 files changed, 334 insertions, 4 deletions** between the baseline and candidate. No `artifacts/**` path is in that committed delta.

| Committed path | Insertions | Deletions | Git blob |
| --- | ---: | ---: | --- |
| `docs/PORTABLE_LOCAL_INSTALL_POLICY.md` | 59 | 0 | `dfff63bc12a92451d94fa04a94831d9628d00b98` |
| `scripts/package-portable-source.py` | 20 | 2 | `e4e0a7fea2fd0ed73897e4bce1c213a59a6ece44` |
| `scripts/verify-portable-archive.py` | 23 | 2 | `3c082f72f103849c72f7453f6bb09fb3eaf4aa89` |
| `tests/candy-scope6e-package.test.mjs` | 232 | 0 | `56b437b9b22af2d51b2800c719f2ac572cad74e3` |

The exact candidate blobs match the previously accepted corrective's prospective Git blob identities. Current product worktree SHA256 values also match that accepted record. No native/CUDA algorithm, runtime job, graph, candy, persistence or visualization source changed.

## Independent exact-SHA remote CI

All five required results were independently fetched from GitHub, not inferred from user statements or reused from the baseline. Every workflow run, job and matching check-run binds to `d22b9c89f79446fbfea2480e98e807f8da4dfbf4`, is completed and successful, and every substantive recorded job step succeeded. The macOS/Windows job conclusions were inspected individually despite their workflow's continue-on-error configuration.

| Required result | Event | Run ID | Job/check ID | Result |
| --- | --- | --- | --- | --- |
| CPU release / push | push | [40253919517](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40253919517) | [121351567840](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40253919517/job/121351567840) | PASS |
| CPU release / pull_request | pull_request | [40253978257](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40253978257) | [121351750027](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40253978257/job/121351750027) | PASS |
| Ubuntu | pull_request | [40253978319](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40253978319) | [121351750366](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40253978319/job/121351750366) | PASS |
| macOS | pull_request | [40253978319](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40253978319) | [121351750650](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40253978319/job/121351750650) | PASS |
| Windows | pull_request | [40253978319](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40253978319) | [121351750544](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40253978319/job/121351750544) | PASS |

[Draft PR #7](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/pull/7) remains draft and unmerged, with this exact head SHA and base `c294ed0cea093bb8933d06e6e23177a7f1409952` on `main`. The GitHub connector returned repository 404 responses; the fallback used authenticated read-only GitHub REST through the repository's existing Git credentials. Credential material was never printed or retained. Raw API branch, PR, run, job and check evidence is under `scope6e-exact-d22b9c8/remote/`; the bound summary is `candy-scope6e-package-corrective-remote-ci-closure.json`. No check was rerun or remote object changed by this task.

## Fresh immutable-candidate gates

The candidate was freshly exported using `git archive d22b9c89f79446fbfea2480e98e807f8da4dfbf4` into a disposable `product` directory with no candidate overlays. Every exported file's canonical Git blob was checked against `git ls-tree` for this commit before execution; every tracked export byte remained unchanged after the gates. Fresh `npm.cmd ci` installed dependencies only in that disposable export. All requested gates then ran there from the candidate's source, with `git diff --check` reconfirmed on the clean persisted worktree.

| Gate | Result |
| --- | --- |
| `npm.cmd test` | PASS, 286/286 discovered test files |
| `tests/candy-scope6e-package.test.mjs` | PASS in the full suite and explicit focused command |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run build:github` | PASS |
| `npm.cmd audit --omit=dev` | PASS, 0 production vulnerabilities |
| `git diff --check` | PASS |
| Exact-candidate adversarial API/CLI matrix | PASS, 31 unsafe rejections and 6 legitimate acceptances |
| Actual Windows extraction guard proof | PASS, 16 representative cases |

Full commands, exit codes, durations and log hashes are in `scope6e-exact-d22b9c8/qualification/gates.json`. The expected bundle-size advisory remains informational; both builds passed. Test counts refer to discovered files, not individual assertions.

## Exact-commit package identity

Fresh committed-clean and committed-populated witnesses have identical bytes and member content. Their shared authoritative identity is:

- SHA256: `f726b96762211682753d9316e0f7649b22bba5932c83c8100bb1c1bb39518c3f`
- Byte size: **1,730,542**
- ZIP entries: **939**
- Files: **883**
- Directories: **56**

Both witnesses start from the exact committed candidate, with no source overlays. Only the populated copy receives synthetic local qualification state. Both production native source trees, `candy-runtime/src/artifacts/artifactStore.js`, and the corrective test are present and bound to committed source. Canonical Scope 6D local installations, root `artifacts/**`, `.local`, native build outputs, dependencies/caches, credential/token filenames and synthetic temporary qualification state are absent. All expected exclusion markers are absent from every packaged file. Producer and independent verifier accept both corrected archives.

Git archive applies committed attributes and this Windows checkout's EOL policy. Canonical Git blobs and raw exported/package SHA256 values are recorded separately; documentation/test files exported with CRLF differ in raw bytes from their earlier precommit working copies while retaining the identical accepted Git blobs. This exact-commit export's new archive identity is authoritative for this run; no earlier archive identity is substituted. No product source was edited to change line endings.

The exact-candidate matrix preserves the prior corpus: canonical installation contamination, trailing-dot/space aliases, mixed/repeated/backslash separators, traversal, absolute/UNC names, relevant case spellings, symlink/special entries and credential/executable aliases are rejected; canonical native paths and nested legitimate lookalikes are accepted. The explicit corrective regression also verifies unsafe writable/executable/ordinary/directory modes, duplicates/case collisions and CRC corruption. API and CLI checks use the exact export's verifier. Raw paths, Windows-normalized/extracted paths, decisions and fresh crafted witnesses are retained in the new qualification directory.

## Accepted security-infrastructure exception

**Substantive product security qualification PASS under an explicitly accepted security-infrastructure exception; automated Codex Security completion seal UNAVAILABLE.**

The unchanged additive exception and human-acceptance records confirm substantive security review completion with **0 Critical, 0 High, 0 Medium and 0 Low unresolved findings**, the previous Low/P3 CWE-180 bypass no longer reproducing, and explicit human acceptance limited to the reproducible checkpoint-lifecycle / completion-ordering infrastructure failure. No product-security finding was waived. The accepted product hashes/Git blobs were independently bound to this exact candidate. See `scope6e-exact-d22b9c8/security-exception-binding.json`.

No Codex Security scan, completion operation or state recovery was invoked. The automated seal is **UNAVAILABLE / NOT COMPLETED**, never PASS. `.codex` state was not modified. This closure does not rewrite prior NON-PASS or pre-seal evidence.

## Additive evidence and hard stop

The new final inventory is `candy-scope6e-package-corrective-exact-sha-final-inventory.json`; the earlier `candy-scope6e-package-corrective-final-inventory.json` is preserved unchanged. The remote summary, exact-SHA package record and this report are also additive. All prior evidence and all tracked product bytes, Git refs and index bytes were checked for preservation.

This is readiness for the package-corrective qualification tag and main promotion only. **No tag, main promotion, merge, commit, stage or push was performed.** PR #7 remains draft. Scope 6E integrated qualification has not resumed and is not declared qualified by this report. Stop after this closure report.
