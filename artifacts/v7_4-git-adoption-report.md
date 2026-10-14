# v7_4 Git adoption / provenance closure

READY TO COMMIT QUALIFIED V7_4 MERGED BASELINE

The exact qualified corrected source has been adopted into the existing Git worktree on `v7_4-merged-baseline-integration`. HEAD, main, v7.3.14 and candy-v7.3.14-rc2-qualified still resolve to `9d79d9f9027b338096d7cf62d67c2a22e9cab247`. No commit, push, merge, tag movement, native edit or Scope6B work was performed.

## Exact source identity

The authoritative ZIP SHA256 is `04b80210705cd5be0395760bdf1f5833da3505a2ef668d0eba0cf5feec7a2f0c`: 1,652,855 bytes, 909 entries, 853 source files and 56 directories under `final/`. Every imported portable source file matches its qualified SHA256, and the portable file set matches exactly. Both clean and populated rebuilds using the repository producer are byte-identical to this ZIP.

The producer derives the archive root from the directory basename. To retain the required `final/` layout from a differently named repository, each witness uses a fresh `final/` staging directory populated only by byte-for-byte copies of the Git-worktree portable domain. No source normalization, alternate producer or candidate edits were used. The populated witness adds inert excluded files, never actual credentials or injected native qualification. [Package identity](v7_4-git-adoption-package-identity.json).

All 47 intentional fixture files, artifactStore.js, the corrected UI contract test and the corrective regression file are included. Root artifacts, .git, node_modules, dist, coverage, .local, native build output, credentials and temporary helpers remain excluded. The exclusion sets and exclusion function are AST-identical to RC2. The qualified producer adds .command executable support and required-source assertions; these are carried cross-platform changes, not relaxed exclusions.

## Import diff

The synchronization added 24 source files, replaced differing bytes in 50 files and removed four obsolete tracked product files: src/App.css, src/assets/hero.png, src/assets/react.svg and src/assets/vite.svg. Each removal was classified before deletion and backed up outside the repository. Some replacements affect line endings only; they were copied exactly from the qualified archive.

Every source path is classified in [the diff inventory](v7_4-git-adoption-diff.json) as merged UI, Assistant live context, cross-platform, corrective fix/test, documentation or expected obsolete removal. New adoption evidence under root artifacts is additive repository-only documentation. [Import patch](v7_4-git-adoption.diff), [source inventory](v7_4-git-adoption-source-inventory.json).

Manifest changes are fully carried from the qualified ZIP: Node engines, relative build and launcher scripts, three bundled fonts, and the qualified lockfile refresh. The lockfile differential records 13 added packages, 8 removed packages, 69 version changes and 99 metadata-only changes, including React/Acorn and build/lint/transitive pins. No dependency update or resolution change was made during adoption. [Complete dependency differential](v7_4-git-adoption-lockfile-differential.json).

`git diff --check` exits 2 with exactly two pre-existing qualified EOF blank-line warnings:

- candi-s1-assistant-awareness-corrective-report.md:50
- tests/v74-corrective-regressions.test.mjs:155

These advisories are fully explained and deliberately retained because deleting those bytes would violate the exact-source/package identity requirement. A diff-check PASS is not claimed. All mandatory readiness predicates in the adoption request pass. Existing core.autocrlf=true also produces Git LF/CRLF notices; no Git settings or qualified source bytes were changed to suppress them. Re-verify package identity after any future checkout that transforms line endings.

## Worktree validation

A fresh npm ci began with no node_modules at the repository path; prior dependencies were moved to an external backup. Official npm.cmd test passed all 274 discovered files. Lint, build, build:github and production npm audit all passed; vulnerabilities: 0. [Fresh worktree gates](v7_4-git-adoption-gates.json).

All nine corrected issues and V74-D01 retain the exact qualified source implementation. Fresh worktree tests revalidated the corrective regression file. No corrective feature was reimplemented and no browser/model/native replay was necessary for this byte-identical adoption. [Corrective invariants](v7_4-git-adoption-corrective-invariants.json).

## Protected source and historical evidence

All 91 protected files across candy-runtime/src, candy-runtime/native, src/graph, src/candy, src/persistence, src/visualization and src/utils remain byte-identical to qualified RC2. Native CUDA, Makefiles, Runtime schemas, motif taxonomy and qualification logic were not edited. Existing .git, ignored Runtime qualification/build directories and all prior tag objects were preserved.

All 415 pre-import root artifact files match their original hashes at closure. Required tests regenerated three ignored generic NLU reports; their new results were retained under additive adoption names and their original bytes were restored only after exact pre-import SHA256 verification against existing backup copies. The integrated routing report was recovered from the existing RC2 ZIP. Historical RC1/RC2 release evidence was untouched. [Restoration receipt](v7_4-git-adoption-test-report-restoration.json).

New source files have intent-to-add entries so the complete product diff is reviewable; no implementation content has been staged for commit. Additive adoption reports are untracked repository evidence. HEAD remains RC2. [Final Git inventory](v7_4-git-adoption-final-inventory.json).

## Retained qualification limits

- Human review of model-generated parser source remains required.
- Generated parser qualification handled valid fixtures but skipped malformed input rather than rejecting it.
- No fresh macOS execution qualification performed.
- No fresh Linux whole-product execution qualification performed.
- No new whole-product browser matrix beyond recorded corrective coverage.
- Scope6B remains deferred.

Hard stop: the worktree and additive provenance artifacts are ready for human commit review. No commit, push, merge or tag was performed.
