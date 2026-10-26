# Extracted snapshot self-test corrective — candidate review

READY TO CREATE SCOPE 6E EXTRACTED SNAPSHOT CORRECTIVE CANDIDATE COMMIT

Recorded: 2026-10-26T05:41:23.210310+00:00. Branch `candy-integration-scope6e-extracted-snapshot-corrective` at baseline `e84f06cdaa750803a06007ade63124b6bce693c8`. The candidate remains uncommitted.

Working clone: `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-scope6e-extracted-snapshot-corrective`. The original populated repository `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14` remains read-only. A separate local clone was necessary because the instructions name that same original repository both as the corrective repository and as a read-only witness. The requested branch is checked out in the clone; no original branch, index, ref, source or historical state was changed.

## Contract and correction

`diagnosis.md` traces both contracts and the helper. The helper correctly defaults to pinned Git inventory/raw blobs and fails when Git is unavailable. Explicit snapshots remain supported for reviewed Git-free self-tests. The old test omitted that explicit mode in extracted source. The correction selects snapshot mode only when the self-test project has no root `.git` entry; Git-backed invocations retain the helper default. Present but broken metadata does not trigger a snapshot retry.

**Exact proposed commit inventory: one path, 19 additions / 2 deletions — `tests/candy-scope6a-release.test.mjs`.** All prior assertion lines remain unchanged. New assertions enforce commit-bound/current-HEAD results in Git-backed runs, structural-only/null-commit results in snapshot runs, and failure with no success report for a no-Git helper call that omits the snapshot opt-in. Producer, verifier, helper, contracts, package files, native/CUDA, Runtime and application source are unchanged.

Candidate file SHA256: `c26a5cd4bb0c8620d27cfe6d42f41577f43be8d8adf36390b2f953b605c602e6`; prospective Git blob: `4882f08a36337fd74c72eac2d5ea2f33298b5ce6`. `proposed-commit-inventory.json` and `candidate.patch` bind the exact proposed change. All artifact evidence is excluded from the proposed product commit.

## Fresh product and extracted gates

| Gate | Working clone | New Git-free extraction |
| --- | --- | --- |
| npm test | PASS — 287/287 discovered files | PASS — 287/287 discovered files |
| lint | PASS | PASS |
| build | PASS | PASS |
| build:github | PASS | PASS |
| production audit | PASS — 0 vulnerabilities | PASS — 0 vulnerabilities |
| git diff --check | PASS | Not applicable without Git |

Fresh npm ci passed in the working clone and extraction. Logs, exit codes, discovered test counts, timing and digests are in `repository-gates.json` and `extracted-gates.json`. `regression-matrix.json` maps all five requested regression requirements. Both full suites include the unchanged contamination and path-alias tests. No test was disabled, assertion weakened, Git metadata injected into extraction, or package-input fallback introduced.

The extracted full suite ran in `C:\Users\tharu\AppData\Local\Temp\candy-snapshot-corrective-extracted-0j_1wunv\product` outside every repository, with no `.git` and no root evidence at extraction. Its test bytes exactly match the one externally recorded candidate overlay.

## Reproducibility and qualification boundary

Fresh default Git-mode packages from the actual clean clone and actual populated read-only witness are byte-identical: SHA256 `7a297cf32dfc9b40a627ab1158c0f62dcfe2088f60df990a2a1cf3e80db361f9`, 1,729,529 bytes, 940 entries, 884 files, 56 directories. Both independently verify as commit-bound to `e84f06cdaa750803a06007ade63124b6bce693c8`. All 22 historical untracked Scope 6D scripts, local-install qualification state and root artifacts remain absent; legitimate native source and Runtime artifactStore remain included.

The default Git release correctly excludes the uncommitted correction. To validate this candidate without weakening release authority, each real committed inventory was separately extracted to a reviewed temporary source tree, overlaid with exactly the same approved test bytes, and packaged with explicit snapshot mode. Those two reviewed candidate projections are also byte-identical.

Reviewed candidate snapshot: SHA256 `8ff3906c22b2a897fc45ccc2a07bd9fa548f37c7725fb0e67e635f1d4c422876`, 1,729,996 bytes, 940 entries, 884 files, 56 directories. It verifies as structural-only, with null sourceCommit. Baseline commit-bound verification rejects exactly `product/tests/candy-scope6a-release.test.mjs`, confirming that the draft is not falsely attested as baseline content. The fresh extracted full suite used this corrected candidate archive. A future candidate commit still needs exact-SHA qualification; no new commit or automated release seal is claimed.

## Security and preservation

Focused semantic security review PASS: no unresolved Critical/High issue. No production trust boundary changed. See `security-review.md` and `security-review.json`. **Automated Codex Security completion seal UNAVAILABLE / NOT COMPLETED.** No Codex Security scan/completion/sealing was invoked; the historical accepted exception was not rewritten.

`preservation.json` confirms 1284 other clone tracked files, 1307 original tracked/script files, 6 original local-install files and 981 original prior artifacts are byte-identical. Both indexes and all refs are unchanged; the original status, branch and HEAD are unchanged. Neither historical package NON-PASS nor V3 NON-PASS was reinterpreted or overwritten.

The five missing Scope 6D evidence files were not fabricated, reconstructed or replaced. No CUDA execution, native-source change, Runtime restart, Studio/browser integration or integrated Scope 6E qualification was attempted. No staging, commit, push, tag, merge or main change occurred. Stop after this candidate review.

Final evidence hashes: `final-inventory.json`.
