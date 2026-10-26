# Exact-SHA package-input security review

Candidate: `e84f06cdaa750803a06007ade63124b6bce693c8`. Baseline: `d22b9c89f79446fbfea2480e98e807f8da4dfbf4`.

**Substantive focused review: PASS.** No unresolved Critical, High, Medium or Low finding was identified in the reviewed package-input boundary. This is a source/dataflow review of the committed producer, independent verifier, compatibility caller, regression tests and contract changes. It is not a repository-wide audit. The exact nine committed blob identities and their match to the reviewed candidate are recorded in `committed-delta.json`. No precommit execution result substitutes for the fresh exact-SHA results.

## Committed source authority

`git_source_entries` resolves the selected revision once and uses its immutable tree and raw blobs. NUL-delimited tree records preserve path spelling. Raw path validation precedes host Path construction; trailing-dot/space components, backslashes, dot/traversal/empty components, controls and the specified Windows-illegal characters are rejected. Included entries must be regular Git blobs, with casefold collision rejection. Object headers, types, lengths and Git blob digests are checked. Text and binary blobs receive no checkout conversion. The release path does not walk the filesystem or read the index, dirty files, untracked files or checkout symlink targets.

Git calls use argument arrays, `--end-of-options` for revision resolution, sanitized ambient `GIT_*` variables, disabled replacement objects and disabled optional locks. The root must equal the discovered worktree root. Missing metadata and discovery of an ancestor repository fail closed; neither selects snapshot mode. Git metadata and the operator-selected revision remain trusted inputs. These controls establish reproducible source identity, not a publisher signature or arbitrary-content secret detection.

## Independent archive verification

`committed_inventory` independently reads the externally supplied trusted Git root/revision. It imports no producer policy and accepts no archive-supplied manifest as authority. Commit-bound verification compares every file's membership and SHA256 and the complete directory set, in addition to structural checks. Extra script/source members, missing files, changed binary bytes and extra empty directories are rejected by the fresh committed regression. Both real archives also passed an independent direct comparison of all 884 archived files with raw candidate blobs.

Without a source root the verifier reports `structural-only` and no source commit. With an external source root it reports `commit-bound` and the resolved SHA, or fails if metadata is unavailable. Production qualification requires Git-mode generation and commit-bound verification; structural success alone is not committed-release qualification.

## Prior boundaries and explicit snapshots

The root artifacts and reserved local Scope 6D native-install namespaces remain excluded; nested production artifact-store source and the two committed native source trees remain included. Raw archive name, traversal, absolute path, backslash, duplicate/case, link/special-file, executable, permission, root-layout and CRC rejection remain active. The Windows regression exercises the extraction guard and demonstrates aliasing only in separate disposable directories using synthetic bytes. The WSL regression exercises the POSIX-only unsafe-source rejection and preserves an existing output on rejection. The prior CWE-180 trailing-dot/space alias bypass does not reproduce.

Snapshot mode remains an explicit choice for reviewed Git-free source and fixtures. It binds filesystem bytes and has no claim of commit provenance or protection against concurrent changes to an untrusted mutable tree. File symlinks and non-regular selected sources are rejected. The Scope 6A caller constructs its temporary snapshots from committed blobs in default Git mode and verifies them against the trusted commit. Both exact-SHA CPU CI runs passed this caller and the extracted source build. Historical test assertions are unchanged; `historical-assertions.json` records fresh exact-blob comparisons after removing only the explicit source-mode adaptations.

## Execution evidence and limits

`focused-regressions.json`, `wsl-regressions.json`, `package-reproduction.json` and the raw logs bind fresh runs to this candidate. The committed input test covers arbitrary untracked paths, LF/CRLF and dirty binary checkout mutations, exact binary preservation, legitimate committed inputs, independent verifier mutations, Git links/submodules, unsafe committed paths, ambient Git overrides, missing Git failure and explicit snapshots. Windows ran the committed Node test wrappers. WSL lacked a Node executable; its initial launcher failure is retained in `wsl-focused-0.log`. The same unmodified Python bodies were extracted from the exact committed test blobs and passed under WSL Python, as recorded in `wsl-regressions.json`.

**Automated Codex Security seal UNAVAILABLE / NOT COMPLETED.** No Codex Security tool, scan, completion or sealing was invoked. The previously accepted checkpoint-lifecycle/completion-ordering infrastructure exception remains historical and narrowly scoped. This review does not waive a product finding, rewrite that acceptance, or qualify broader Scope 6E integrated operation.
