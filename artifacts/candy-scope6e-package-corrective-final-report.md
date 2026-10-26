# Scope 6E package corrective fresh closure

**NON-PASS — SCOPE 6E PACKAGE CORRECTIVE VERIFIER POLICY BYPASS**

Fresh run: 2026-10-24T17:18:31.783639+00:00. Branch `candy-integration-scope6e-package-corrective`; HEAD and original baseline `c294ed0cea093bb8933d06e6e23177a7f1409952`.

The existing four-file corrective implementation is byte-for-byte identical to the previously qualified candidate. No product file was changed during this run. Fresh tests and normal packaging gates pass. An additional adversarial check found a reproducible Windows extraction alias bypass, so the independent contamination-rejection requirement is not satisfied and the corrective is not declared qualified for review.

## Confirmed closure blocker

**Low / P3, CWE-180 — Windows path component aliases bypass the reserved local-install guard.** At `scripts/verify-portable-archive.py:125-130`, raw `candy-runtime./native/` or `candy-runtime/native./` components fail the canonical namespace equality check. The actual verifier API and CLI accept both crafted archives with zero issues. Actual Windows Python ZIP extraction removes the trailing dot and writes synthetic `src/main.cu` into `candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-alias/`. The producer excludes that canonical extracted file. The same payload using the canonical ZIP path is rejected.

This is a bounded release-policy bypass with demonstrated producer/verifier disagreement. It requires a supplied or repacked ZIP and subsequent Windows extraction. No code execution, private secret access, native activation or privilege escalation was demonstrated. There are **0 unresolved Critical, 0 High, 0 Medium and 1 Low** findings. The severity threshold passes; the independent contamination-rejection requirement fails. This product finding is distinct from security infrastructure availability.

Suggested follow-up, not applied: reject noncanonical Windows component aliases before path-policy matching and add independent injection plus actual Windows extraction regressions. The preservation constraint limits this attempt to verification and reporting; the implementation remains intact.

Evidence: `candy-scope6e-package-corrective-final-run/windows-alias-result.json`; source/input ZIPs retained in the fresh security scan under `artifacts/02_discovery/validation_artifacts/candidate-75ede7b1f21f28b6/`.

## Fresh qualification results

| Gate | Result |
| --- | --- |
| `npm.cmd test` | PASS, 286/286 discovered test files |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run build:github` | PASS |
| `npm.cmd audit --omit=dev` | PASS, 0 vulnerabilities |
| `git diff --check` | PASS |
| Focused package corrective regression | PASS |
| Real baseline + exact four-file overlay, clean/populated archives | PASS, byte-identical |
| Canonical local-install injected contamination | PASS, verifier rejects |
| Windows trailing-dot alias contamination | FAIL, verifier accepts before canonicalizing extraction |
| Fresh security finalization | PENDING |

The build retains its existing advisory about bundles larger than 500 kB. Logs, command exit codes and log SHA256 values are in `candy-scope6e-package-corrective-final-run/gates.json`. The runner counts test files, not individual assertions.

## Exact package identity and source completeness

Fresh clean and populated archives both have SHA256 `31d85c85ee1013cdc9270a9065e0d34d74660f5b6cd57dd4d437b2a97236c384`, 1,728,395 bytes, 939 entries, 883 files and 56 directories. This reproduces the previous corrective archive exactly. The package represents the exact committed baseline plus four current uncommitted overlays; no candidate commit was created.

Canonical Scope 6D local qualification source, build binaries and qualification records are absent for historical, arbitrary, empty and mixed-case qualifiers. Both legitimate production native source trees and `candy-runtime/src/artifacts/artifactStore.js` remain present. Relative to the original clean archive, there are zero removed source members, exactly two added product members (test and documentation), and exactly two changed members (producer and verifier). See `candy-scope6e-package-corrective-package-final.json` and the retained ZIP manifests.

## Proposed product commit inventory — four files only

| Path | Classification | Worktree SHA256 |
| --- | --- | --- |
| `scripts/package-portable-source.py` | packaging policy | `8eda426922db87b11614fadd4cef1f929122164a92c4e35c626750b3decaaf61` |
| `scripts/verify-portable-archive.py` | independent archive verifier policy | `ca1208f8ef8340101fc4d92b4bce1367c38e767ff42814e1a3abee0307e713ce` |
| `tests/candy-scope6e-package.test.mjs` | package corrective regression test | `ed233f496164e16ba9c020408a9342b4061746a9fda2cb65c967c578c45ac160` |
| `docs/PORTABLE_LOCAL_INSTALL_POLICY.md` | directly relevant packaging policy documentation | `23114bcd6a4d1d30912c3e49fee9d13c7f37012d523aa86b7d7acbd1e7f0b249` |

The machine-readable inventory includes byte sizes, baseline Git blobs and prospective filtered Git blob identities. Every path under `artifacts/**`, including qualification tooling and all final reports/witnesses, is excluded from the proposed product commit. Nothing has been staged.

## Preservation and review coverage

All four current file hashes match prior gate/package overlay records; prior log digests were independently checked. All other 1,280 tracked files, Git refs and index bytes are unchanged. Protected native algorithm trees, jobs, graph, candy, persistence and visualization paths have no changes. No reset, restore, clean, stash, worktree recreation, commit, push, tag change or main update was performed. Scope 6E integrated qualification was not resumed.

The test suite regenerated one gitignored nondeterministic telemetry file, `artifacts/deterministic-nlu-integrated-routing-report.json`. A deliberately broad preservation assertion consequently stopped the evidence runner after all gates and package checks had passed. `preservation-reconciled.json` independently verifies the exact difference, confirms it is ignored, and verifies that all product files, tracked historical evidence, prior corrective evidence, Scope 6E NON-PASS evidence, refs and index are preserved. This instrumentation assertion is not a test, product or security-infrastructure failure. No historical evidence was restored or rewritten.

The fresh security review covers path-prefix bypass, slash/backslash handling, case variants, nested lookalikes, traversal, absolute paths, symlinks/special entries, qualification records, executable/credential/token filename exclusions, production native false positives, producer/verifier disagreement, root artifacts and local installations, and source completeness. The compact tool inventory listed 13 paths: two product scripts and eleven evidence/tooling paths; the new untracked test and document were explicitly reviewed in addition. Root artifacts are excluded from product scope by the user's request. This is a bounded corrective diff review, not a repository-wide or native/runtime security certification. Path exclusions do not establish arbitrary secret detection within otherwise legitimate source contents.

Fresh security scan `ce39ac67-885a-486d-b456-99dd082d9c70`; directory `\\?\C:\Users\tharu\.codex\state\plugins\codex-security\scans\hypergraph-converter-v7.3.14-scope6e-package-corrective\c294ed0cea093bb8933d06e6e23177a7f1409952_20261024T170845Z_e5i5f7vi`. A fresh checkpoint and final semantic draft were created; the old missing checkpoint was neither recovered nor used. Canonical security finalization status: **PENDING**.
