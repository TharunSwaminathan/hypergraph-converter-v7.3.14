# Extracted snapshot corrective — exact-SHA closure

READY FOR SCOPE 6E EXTRACTED SNAPSHOT CORRECTIVE QUALIFICATION TAG AND MAIN PROMOTION

Recorded 2026-10-26T06:17:40.483212+00:00. Repository `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-scope6e-extracted-snapshot-corrective`; branch `candy-integration-scope6e-extracted-snapshot-corrective`; exact candidate `d2a2bdb86ebf785ed2d7b43a9cca3a80ee7eb0d2`; starting qualified baseline `e84f06cdaa750803a06007ade63124b6bce693c8`.

## Exact identity and scope

HEAD and the live GitHub branch match the exact candidate. Tracked and staged changes are empty. The committed delta is exactly `tests/candy-scope6a-release.test.mjs`, 19 additions / 2 deletions. Its blob matches the reviewed prospective blob. No other product/test/doc/Runtime/native/package-policy or evidence path changed in the commit. The local origin is the historical local witness, so GitHub identity was checked directly against its HTTPS repository and live REST branch record.

The committed caller preserves the helper default in a Git-backed project and explicitly passes snapshot mode only for the intentionally Git-free extracted self-test. Assertions enforce commit-bound/current-SHA results or structural-only/null-commit results as appropriate. A separate no-Git call without snapshot mode still must fail closed and create no success report. Producer, verifier, helper and production policy are unchanged.

## Live exact-SHA remote CI

All five required checks completed successfully on `d2a2bdb86ebf785ed2d7b43a9cca3a80ee7eb0d2`. [PR #9](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/pull/9) was observed as draft and was not changed. No earlier candidate CI was reused. Both overall workflow conclusions and individual matrix job/check conclusions were checked, including every substantive step.

| Required check | Run ID | Job / check ID | Result |
| --- | --- | --- | --- |
| CPU release / push | [40277242192](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40277242192) | [121422483147](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40277242192/job/121422483147) | PASS |
| CPU release / pull_request | [40277433267](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40277433267) | [121423037851](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40277433267/job/121423037851) | PASS |
| Ubuntu | [40277433271](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40277433271) | [121423037746](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40277433271/job/121423037746) | PASS |
| macOS | [40277433271](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40277433271) | [121423038142](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40277433271/job/121423038142) | PASS |
| Windows | [40277433271](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40277433271) | [121423037991](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40277433271/job/121423037991) | PASS |

The connector returned 404. Read-only GitHub REST used existing Git authentication; credentials were never printed or persisted. Raw branch, PR, run, job and check responses plus SHA bindings are in `remote/`.

## Fresh committed repository and Git-free extracted gates

| Gate | Repository | Fresh Git-free extraction |
| --- | --- | --- |
| npm ci | PASS | PASS |
| npm test | PASS — 287/287 discovered files | PASS — 287/287 discovered files |
| lint | PASS | PASS |
| build | PASS | PASS |
| build:github | PASS | PASS |
| production audit | PASS — 0 vulnerabilities | PASS — 0 vulnerabilities |
| git diff --check | PASS | Not applicable without Git |

The extraction is a new directory outside every repository: `C:\Users\tharu\AppData\Local\Temp\candy-snapshot-exact-extracted-c07lk6oj\product`. It has no `.git`, no ancestor repository discovery and no root evidence at extraction. It contains the exact committed corrective, not a precommit overlay. The complete extracted suite passed, including `candy-scope6a-release.test.mjs` and its explicit snapshot/provenance/default-failure assertions. No product/test bytes, hidden Git metadata or fallback were introduced for these runs. `repository-gates.json`, `extracted-gates.json` and raw hashed logs record actual discovery, commands, times and results.

## Real clean/populated package reproducibility

The qualified producer and independent verifier were compiled directly from candidate Git blobs and invoked against both actual roots with explicit revision `d2a2bdb86ebf785ed2d7b43a9cca3a80ee7eb0d2` and a shared `product` ZIP root. Both verify as commit-bound to that SHA and are byte-identical: **SHA256 `508977338144acc212fc88c8a622e7725e98a16d56c9c36052be4566e56cc3ba`; 1,729,984 bytes; 940 entries; 884 files; 56 directories**.

The populated witness remains at its existing HEAD `e84f06cdaa750803a06007ade63124b6bce693c8`; its existing object database supports the explicit candidate revision without checkout, ref, source or index changes. All 22 historical untracked scripts remain excluded. There are 555 observed shared checkout-only EOL differences, which do not affect release bytes. The corrected test itself exactly matches its committed blob in the ZIP. Local Scope 6D installation/qualification namespaces and root artifacts are absent; production native source and Runtime artifactStore remain present. Both historical 937-vs-941 and 939-vs-961 blocker classes remain closed.

The release contains no binary member identified by the binary-member observations; the unchanged committed synthetic input-policy test independently proves all-byte/NUL/CRLF binary preservation and dirty-binary independence in both fresh full suites. No text normalization is applied to qualified release input. Archive manifests and detailed witness records are in `package-reproduction.json` and the two manifests.

## Package adversarial regression and security

The independent exact committed verifier rejected 24 malicious mutations of the actual release archive and accepted six canonical production controls. The matrix explicitly covers arbitrary new scripts/source files, local native installs, root artifacts, trailing-dot/space and mixed/backslash aliases, traversal, POSIX/Windows absolute and UNC paths, token/credential/environment contamination, unsafe executable aliases, NUL/control/illegal names, symlinks, special files and unsafe modes. Both fresh full suites also passed the unchanged committed untracked/dirty/EOL/binary, no-Git, independent-verifier and Windows extraction-guard regressions. See `adversarial-matrix.json` and `corrective-semantics.json`.

**Focused semantic security review: PASS; no unresolved Critical/High issue in this corrective.** See `security-review.md` and `security-review.json`.

Substantive product security qualification PASS under the explicitly accepted security-infrastructure exception; automated Codex Security completion seal UNAVAILABLE / NOT COMPLETED.

No Codex Security automated scan, completion or sealing was invoked. The accepted historical infrastructure exception was not rewritten and is not a waiver of product findings. This security statement is limited to the extracted-snapshot corrective.

## Separate native blocker and preservation

**The five-file Scope 6D incremental native qualification-evidence blocker remains OPEN. Overall integrated Scope 6E remains NON-PASS.** No missing evidence was fabricated, regenerated, copied from similarly named sources, silently replaced or reinterpreted. No CUDA execution or final integrated Runtime/browser/soak qualification occurred in this task.

`preservation.json` verifies 1285 primary tracked files, 440 prior primary artifacts, 1307 populated tracked/script files, 6 populated local-install files and 980 populated prior artifacts retained exact bytes. Both indexes/all refs and populated status/branch/HEAD are unchanged. Historical NON-PASS, corrections, alias/security infrastructure/acceptance and precommit review evidence were preserved. Only the ignored test-generated routing timing report was excluded from prior-artifact comparison, as declared in the initial snapshot.

No staging, commit, push, tag, merge, main modification or Ready for review action occurred. This report establishes readiness for qualification-tag and main-promotion review of this exact corrective only. Stop at corrective closure; integrated Scope 6E is not complete and has not resumed.

Final evidence digest inventory: `final-inventory.json`.
