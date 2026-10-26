# Scope 6E V2 package input corrective — candidate commit boundary review

**READY TO CREATE SCOPE 6E V2 PACKAGE INPUT CORRECTIVE CANDIDATE COMMIT**

Reviewed 2026-10-26T04:24:16.834854+00:00. Branch `candy-integration-scope6e-v2-package-input-corrective`; HEAD/baseline `d22b9c89f79446fbfea2480e98e807f8da4dfbf4`. No staged changes. This review made no product-source edits and performed no staging, commit, push, tag, merge, main update, older-witness cleanup or broader integrated qualification.

## Exact proposed inventory and classification

The CURRENT Git inventory contains **eight modified tracked product paths and one untracked regression test**: **nine proposed files, 415 additions, 55 deletions**. The earlier eleven-edited-path description included nine product/test/contract files plus two evidence-only engineering helpers. It is not an eleven-product-file boundary. No non-artifact path is classified D (unnecessary).

| Path | Classification | Reason | + | − |
| --- | --- | --- | ---: | ---: |
| `scripts/package-portable-source.py` | A | Required product corrective: replaces implicit filesystem release inputs with a pinned commit tree/raw blobs; retains explicit reviewed snapshots for Git-free compatibility. | 95 | 14 |
| `scripts/verify-portable-archive.py` | A | Required product corrective: independently derives trusted committed membership/content and rejects extra/missing/changed files/directories, while preserving structural policy and explicit verification levels. | 94 | 26 |
| `scripts/qualify-scope6a-package.py` | A | Required production qualification caller: its temporary no-Git clean/populated trees must use explicit snapshots assembled from the same committed blobs as actual release production, with independent commit-bound verification. | 15 | 8 |
| `docs/CANDY_SCOPE6A_RELEASE_CONTRACT.md` | C | Required current contract update: the old unconditional intended-untracked/observed-byte policy would contradict the corrected release mode; preserves historical capture-time claims and explicitly documents Git-free snapshots. | 12 | 3 |
| `docs/PORTABLE_LOCAL_INSTALL_POLICY.md` | C | Required source trust-boundary documentation: distinguishes committed release authority from explicit reviewed snapshots, no automatic fallback, external trusted verifier inventory and structural-only results. | 41 | 0 |
| `tests/candy-rc2-package.test.mjs` | B | Required compatibility regression: constructs no-Git temporary trees and deliberately adds a nested source fixture. Explicit snapshot mode preserves that existing contract; every assertion and all other code are unchanged. | 1 | 1 |
| `tests/candy-scope6e-package.test.mjs` | B | Required prior-fix regression: constructs synthetic no-Git clean/populated and unsafe-name trees. Two explicit snapshot arguments preserve the same alias/local-install/metadata/extraction assertions; no assertion changed. | 2 | 2 |
| `tests/zip-permissions-v7-3-11.test.mjs` | B | Required metadata regression in both contexts: explicitly selects Git for a checkout and snapshot for an extracted source tree. No permission/executable/non-Unix/entry-count assertion was removed or relaxed. | 2 | 1 |
| `tests/candy-scope6e-package-input.test.mjs` | B | Required independent new regression: disposable commits test arbitrary untracked injection, EOL/dirty binary checkout changes, exact committed binary/script/native/fixture content, independent inventory tampering rejection, unsafe Git modes/paths, metadata overrides, ancestor roots and no silent fallback. | 153 | 0 |

A = REQUIRED PRODUCT CORRECTIVE; B = REQUIRED REGRESSION TEST; C = REQUIRED CONTRACT/DOCUMENTATION UPDATE; D = UNNECESSARY / SHOULD NOT ENTER CANDIDATE.

PRODUCT/CONTRACT FILES — five paths, 257 additions / 51 deletions:

- `scripts/package-portable-source.py`
- `scripts/verify-portable-archive.py`
- `scripts/qualify-scope6a-package.py`
- `docs/CANDY_SCOPE6A_RELEASE_CONTRACT.md`
- `docs/PORTABLE_LOCAL_INSTALL_POLICY.md`

TEST FILES — four paths, 158 additions / 4 deletions:

- `tests/candy-rc2-package.test.mjs`
- `tests/candy-scope6e-package.test.mjs`
- `tests/zip-permissions-v7-3-11.test.mjs`
- `tests/candy-scope6e-package-input.test.mjs`

`git diff --check`: **PASS**. The untracked test was separately checked with a no-index comparison against `/dev/null`; no whitespace errors were reported. New-file statistics are included above, unlike ordinary tracked-only `git diff --stat`. Nothing has been staged.

## EVIDENCE/TOOLING — MUST NOT COMMIT

**Every `artifacts/**` path is excluded from this candidate**, including explicitly:

- `artifacts/candy-scope6e-v2-package-input-work/qualify.py`
- `artifacts/candy-scope6e-v2-package-input-work/report.py`
- All engineering/boundary-review helpers, historical reports, ZIPs, logs, manifests, snapshots, reproduction records and generated/ignored qualification outputs.

The companion JSON enumerates every current Git-untracked path and every ignored artifact path, separately from the exact nine-file candidate. Existing tracked historical artifacts are unchanged and outside this delta. Temporary directories outside the repository and the older local native installation are never candidate files. No diagnostic/tooling path was included merely because it was convenient during testing.

## Source-of-truth policy review

1. **Membership:** Git mode enumerates the one resolved commit tree and applies release exclusions; it does not discover eligible source by walking arbitrary worktree files.
2. **Committed bytes:** content-addressed raw Git blobs are read and their type/length/digest verified. Index/staged/dirty checkout bytes are not used.
3. **Untracked files:** arbitrary filenames under `scripts/`, `src/` or other otherwise-allowed directories cannot enter that committed inventory. The 22 names are not hardcoded.
4. **LF/CRLF:** checkout representations never become release bytes; the exact blob is used rather than blindly normalizing file content.
5. **Binary:** raw blob bytes are preserved, including embedded NUL, all byte values and CRLF. Fresh disposable-commit regression verifies this even after the binary checkout is changed. This real source archive currently selects no PNG/ICO/WOFF assets outside excluded historical artifacts; no real binary-member count is invented.
6. **Usable Git:** the source root must be the actual worktree root; the ref is pinned once. Ambient metadata overrides and replacements are disabled. Git metadata and the selected revision are operator trust boundaries, not publisher authenticity.
7. **No Git:** default release production fails. It does not discover an ancestor repository or silently enable a filesystem fallback.

Git-free capability remains only through an **explicit operator/caller snapshot choice**, preserving reviewed extracted trees and intentional fixtures. Such a mutable snapshot is not a committed release and does not inherit source identity. Independent qualified verification requires a trusted external Git root/revision and checks every expected file byte/path and directory. The verifier never imports producer policy or trusts an in-ZIP inventory. Reports without the external source root explicitly say `structural-only`; structural `ok` does not qualify membership.

Determinism is bounded to the same commit, producer/policy version, root name and compatible compression implementation. This review does not assert bit identity across arbitrary zlib implementations or equate an uncommitted review snapshot with a future committed release. Default HEAD releases deliberately exclude the current uncommitted corrective; the separately hashed reviewed candidate snapshot and future exact-SHA qualification remain necessary.

## Fresh real-witness reconfirmation

The current producer was invoked directly against the actual clean and older populated worktrees, using the same exact committed revision and archive root `product`. The older witness remained read-only. Both outputs passed independent commit-bound verification and have identical bytes and counts:

- SHA256: `c7b9d7a14c88b9c2330ee601e92eeb60434ad6c3f9438f1b5509763c0eb7a1b2`
- Bytes: **1,721,572**
- Entries: **939**
- Files: **883**
- Directories: **56**

All 22 untracked Scope 6D scripts remain present in the older input but absent from the ZIP. Local-install and root-artifact state remain absent; production native source and `candy-runtime/src/artifacts/artifactStore.js` remain included. The shared checkout EOL differences cannot affect raw committed output. Fresh regression covers exact committed binary content independently. Prior measured V2 failure ZIPs and reports remain unchanged rather than being replaced with the corrected result.

## Historical test and contract integrity

The three changed pre-existing tests were compared to HEAD after removing only the explicit source-mode call changes. With consistent UTF-8/EOL decoding, **the entire remaining code is identical**, including every assertion, error check and control. **No assertion became less strict.**

- RC2 intentionally constructs Git-free temporary copies and a nested uncommitted fixture; making that snapshot choice explicit preserves the test instead of bypassing Git authority for releases. Its contamination, metadata, native-source and extracted Runtime assertions are unchanged.
- The existing Scope 6E test uses synthetic no-Git fixture trees, including POSIX unsafe-name trees. Two explicit snapshot arguments keep the same byte-identity, local-install, Windows alias, path, metadata and extraction checks. No successful case was removed.
- The permissions regression explicitly chooses Git for a checkout and snapshot for a Git-free extraction. Its permission masks, executable suffix allowlist, create-system and minimum-member checks are unchanged. Missing/broken metadata does not silently change the producer's default policy.

The new input-policy regression independently constructs disposable Git objects/refs and verifies committed source selection, arbitrary untracked names in unrelated directories, dirty/EOL/binary checkout irrelevance, intended committed script/native/fixture inclusion, exclusions, independent member mutation/addition/removal rejection, unsafe included Git modes, raw aliases/case collisions, ambient metadata overrides and explicit no-Git behavior. It does not rely on a producer's archive manifest to authorize extra source. No synthetic fixture commit/ref belongs to either product worktree.

The two documentation updates truthfully distinguish current qualified release policy from historical captured source bytes and explicit snapshots. The old Scope 6A helper had to change because its temporary clean/populated trees have no Git metadata: it now assembles those copies from committed blobs and explicitly snapshots them, while independently checking actual/clean/populated packages against the same external commit. The retained hash-bound helper run shows all three identical and commit-bound. Historical evidence itself is untouched.

## Verification and security conclusion

Freshly reran the new input-policy test and all three changed pre-existing tests: **all PASS**. The existing full engineering run remains bound to every current proposed file hash: **287/287 test files**, lint, both builds, production audit zero and diff-check PASS. A broader full rerun was unnecessary because no proposed bytes changed. The observed install-time development advisories remain in retained logs; no clean global development audit is claimed and dependency manifests are unchanged.

Focused review of the package input boundary found **no unresolved Critical or High issue**. Git metadata/ref selection remains explicitly trusted; untracked/dirty checkout state has no release authority; raw Git paths and modes are checked; binary bytes are not transformed; independent verification is external to the archive; explicit snapshot review cannot silently become committed release qualification. The prior local-install, trailing-dot/space, mixed/backslash, traversal/absolute, metadata and canonical production-path controls remain intact and their focused regression passed.

No Codex Security automated completion or sealing was invoked. The already accepted infrastructure exception remains historical; the automated seal is **UNAVAILABLE / NOT COMPLETED**, never automated PASS. This is a bounded candidate review, not repository-wide certification or integrated Scope 6E qualification.

## Protected boundaries and hard stop

No changes exist under `candy-runtime/native/**`, `candy-runtime/src/**`, `src/**`, `package.json` or `package-lock.json`. The current product bytes were unchanged by this review; all prior artifact hashes, refs and index bytes are preserved. The older tracked files, 22 scripts, local-install files, status and index are unchanged. No implementation correction was needed or made.

The proposed commit contains exactly the five product/contract paths and four tests above. **Exclude all evidence/tooling. Do not stage or commit as part of this review.** Stop after this exact inventory; no tag, merge, main promotion or broader integrated qualification has occurred.
