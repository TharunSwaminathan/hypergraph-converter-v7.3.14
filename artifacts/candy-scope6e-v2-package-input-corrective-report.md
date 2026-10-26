# Scope 6E V2 portable package input-policy corrective

**READY FOR SCOPE 6E V2 PACKAGE INPUT CORRECTIVE CANDIDATE REVIEW**

Recorded 2026-10-26T04:05:48.206454+00:00. Primary worktree `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-scope6e-v2`; branch `candy-integration-scope6e-integrated-qualification-v2`; unchanged HEAD/baseline `d22b9c89f79446fbfea2480e98e807f8da4dfbf4`. No new product commit exists. The previous V2 NON-PASS and both historical ZIP witnesses are preserved unchanged.

## Diagnosis and chosen contract

The previous producer selected files using an exclusion-filtered filesystem walk and archived raw checkout bytes. Git membership and canonical blobs were not consulted. That explains both measured failures: the 22 untracked `scripts/` files were selected as ordinary source, and 555 LF/CRLF-only differences changed bytes despite identical Git blobs. The prior local native-install namespace and root-artifacts exclusions were already working and remain intact.

Historical compatibility was established from `CANDY_SCOPE6A_RELEASE_CONTRACT.md`, `RELEASE_v7.3.14.md`, the Scope 6A helper, RC2 package tests, synthetic Scope 6E fixtures and the ZIP permission regression. They intentionally support Git-free source trees and generated/reviewed fixture files. A Git-only implementation would break that contract. The correction therefore makes two distinct modes explicit:

- **Default Git release:** one pinned commit tree defines membership; raw Git blobs define bytes. No index/dirty/untracked or checkout EOL/attribute/filter input can alter the output. Unusable Git metadata fails instead of falling back. Binary content is not normalized.
- **Explicit reviewed snapshot:** preserves the prior filesystem/exclusion behavior for Git-free distributions, intentional fixtures and reviewed uncommitted candidate snapshots. This mode is not a committed-release attestation. The CLI/API choice is explicit and documented.

Qualified verification independently derives the expected tree/content from a trusted Git source root and revision. It rejects additional, missing or changed members and directories. It never trusts a producer-supplied archive manifest. Structural-only verification is separately labelled and cannot attest source membership. The existing path-alias, native-install, root-artifact, credential/token, executable and metadata rules remain enforced.

## Actual real-worktree reproduction — PASS

The corrected producer was invoked directly against this primary Git worktree and the actual older populated worktree `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14`. Both use the same exact committed revision and `product` root name. No temporary tracked-only copy, 22-filename blacklist, file deletion or EOL rewrite was used.

Both resulting release archives have:

- SHA256 **`c7b9d7a14c88b9c2330ee601e92eeb60434ad6c3f9438f1b5509763c0eb7a1b2`**
- **1,721,572 bytes**, **939 entries**, **883 files**, **56 directories**

They are byte-identical and both independently pass commit-bound verification. All 22 untracked diagnostic/qualification scripts, all other untracked state, root artifacts and local qualification installations are absent. Both legitimate production native source trees and `candy-runtime/src/artifacts/artifactStore.js` are present. The older witness's script bytes, native-install files, tracked bytes, Git status, index and refs are unchanged. Newly named script/source injections are independently rejected.

The source revision of these default releases remains committed baseline `d22b9c89f79446fbfea2480e98e807f8da4dfbf4`: the uncommitted correction is deliberately **not** silently included. To bind the intended draft itself, a separate explicit reviewed snapshot contains the baseline's canonical committed product plus exactly the nine inventoried corrective files, with every overlay checked against the actual worktree bytes. Its SHA256 is `81cef0a4a22387c6a841ce62b9c69212ff25b6a191f5b9fc501ca17b63f2b7a9`. CLI Git-free snapshot repackaging reproduces that exact archive. It is a review candidate, not a fabricated committed release. Future exact-SHA qualification is still required after the user creates the corrective commit.

## Regression and full product gates — PASS

| Check | Result |
| --- | --- |
| New Git-input regression on Windows | PASS |
| Same new regression in WSL Linux | PASS |
| Existing alias/local-install synthetic regression | PASS |
| RC2 nested-fixture/extracted source regression | PASS |
| Scope 6A actual/clean/populated package helper | PASS, byte-identical and independently commit-bound |
| Git-free CLI default | Expected fail-closed refusal |
| Explicit Git-free snapshot CLI | PASS, reviewed candidate round-trip byte identity |
| Qualified verifier CLI | PASS |
| `npm.cmd test` | **287/287 discovered test files PASS** |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run build:github` | PASS |
| `npm.cmd audit --omit=dev` | PASS, **0 production vulnerabilities** |
| `git diff --check` | PASS |

Dependencies were installed fresh with `npm.cmd ci` before the full gates. The usual bundle-size advisory is informational; both builds passed. Logs, command exit codes, timings and hashes are retained under `candy-scope6e-v2-package-input-work/`.

The new deterministic Git fixture covers clean committed output; arbitrary untracked script and unrelated source-file injection; LF/CRLF checkout differences; exact binary preservation even when the binary checkout is dirty; committed script/native/intentional fixture inclusion; committed local-state/root-artifact exclusion; independent extra/missing/mutated members and extra directories; included Git symlink/submodule rejection; unsafe raw Git paths and case collisions; ambient Git metadata override removal; ancestor-root rejection; and no automatic Git-free fallback. Its synthetic Git objects/refs exist only in disposable test repositories, never in either product worktree. Existing malformed-path/mode/CRC/extraction tests remain active.

## Exact proposed product boundary

Nine product paths are needed: producer, verifier, one historical package helper, four packaging regression files (including the new input regression), and two directly relevant contracts. The historical callers/tests explicitly selected snapshots rather than being allowed to silently weaken default release production. No application, Runtime algorithm, graph or CUDA/native source changed.

- `docs/CANDY_SCOPE6A_RELEASE_CONTRACT.md`: Current release contract compatibility and committed byte authority.
- `docs/PORTABLE_LOCAL_INSTALL_POLICY.md`: Current source trust boundary, modes and fallback policy.
- `scripts/package-portable-source.py`: Pinned commit inventory/raw-blob release input and explicit snapshot compatibility.
- `scripts/qualify-scope6a-package.py`: Historical package qualification caller compatibility; no silent fallback.
- `scripts/verify-portable-archive.py`: Independent commit-bound membership/content verification.
- `tests/candy-rc2-package.test.mjs`: Intentional uncommitted nested-source fixture explicitly selects snapshot mode.
- `tests/candy-scope6e-package.test.mjs`: Existing synthetic fixtures explicitly select snapshot mode.
- `tests/zip-permissions-v7-3-11.test.mjs`: Permission test supports both real Git and extracted no-Git source.
- `tests/candy-scope6e-package-input.test.mjs`: New deterministic Git input and independent-verifier regression.

The machine-readable final inventory contains byte sizes, SHA256 values and prospective Git blob identities for every path. Every `artifacts/**` path is qualification evidence/tooling and excluded from the proposed product commit. No evidence or product file was staged.

## Focused semantic security and preservation

The separate security-review document records the Git metadata/operator trust boundary, untracked injection, traversal/aliases, symlink/special behavior, checkout/index manipulation, raw binary/text preservation and explicit no-Git behavior. No unresolved Critical/High issue was identified within this bounded input-policy review; no remaining reportable issue was identified. No Codex Security tool or automated sealing was invoked. The prior accepted infrastructure exception remains unchanged: automated Codex Security completion is **UNAVAILABLE / NOT COMPLETED**, never automated PASS.

All preexisting V2 NON-PASS evidence and tracked files outside the nine-path corrective inventory retain their pre-task hashes. The older populated witness was read-only and unchanged. Git HEAD, branch, index, refs, main and qualification tags are unchanged. No application/native behavior, staging, product commit, push, tag, main update, cleanup/stash/reset of the older witness, or broader Scope 6E integrated qualification occurred.

Stop at corrective candidate review. This result closes the two measured package-input defects for the defined release mode; it does not qualify a new corrective commit, resume integrated qualification or replace historical evidence.
