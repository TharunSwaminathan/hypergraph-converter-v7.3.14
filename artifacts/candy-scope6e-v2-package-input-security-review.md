# Scope 6E V2 package input — focused semantic security review

Reviewed 2026-10-26T04:05:48.206454+00:00, baseline `d22b9c89f79446fbfea2480e98e807f8da4dfbf4` plus the explicit current nine-file packaging-policy/test/documentation delta. No Codex Security tool, scan or automated completion/sealing was invoked. This is a bounded source/dataflow review, not a repository-wide audit.

## Source authority and validation-to-use boundary

The old producer used `iter_source_files` filesystem membership and `read_bytes` checkout contents. That admitted any otherwise-allowed untracked file and made CRLF/LF representations release inputs. Current `git_source_entries` (`scripts/package-portable-source.py`) resolves the operator-selected revision once, enumerates the pinned tree with NUL-separated Git records, rejects unsafe names/case collisions and non-regular included modes, and reads objects with `cat-file --batch`. The object header, type, length and blob digest are checked before bytes are archived. No checkout filters, hooks or text conversion execute. Binary and text content are unchanged raw blobs. Untracked and dirty/staged worktree inputs have no release authority.

`create_zip` defaults to Git mode and must match the exact Git worktree root. Broken/missing metadata or discovery of an ancestor repository fails; no automatic fallback is taken. Ambient `GIT_*` metadata/config overrides are removed, replacement objects disabled and optional locks disabled. Subprocesses use argument arrays, not a shell; revision parsing uses `--end-of-options`. Git configuration/metadata and the operator's selected commit are explicitly trusted inputs: this is a reproducible-source boundary, not a publisher signature or defense against an operator deliberately choosing malicious committed code. A changed commit is a different authority. Qualification passes an exact SHA.

## Independent verifier and attacker-controlled archive

The verifier imports no producer implementation. Its `committed_inventory` independently enumerates the trusted external Git tree, applies its own exclusions and hashes the exact blobs. Commit-bound `verify(... source_root=..., revision=...)` compares every file's path and content plus directory inventory. A fabricated manifest inside the ZIP cannot authorize an extra script. Tests inject newly named scripts and ordinary source files, mutate binary contents, omit required members, and add empty directories: commit-bound verification rejects them. The corrected verifier also detects source-inventory mismatches in both historical V2 ZIPs without modifying them.

Legacy structural verification remains available, clearly labelled `structural-only`, for intentionally assembled Git-free snapshots and fixtures. It checks path/type/mode/exclusion integrity, not source provenance. `ok` at this level must not be used as committed-release attestation. Qualified production requires Git-mode production plus commit-bound verification against an external trusted root/revision. This is an explicit trust boundary, never a silent fallback to filesystem walking.

## Paths, symlinks, metadata and bytes

Raw Git paths are validated before constructing host Paths; backslashes, traversal/dot/empty components, trailing dots/spaces, controls, Windows illegal names and case collisions fail. Included committed symlinks and submodules fail regardless of regular-looking checkout targets. Release production does not read worktree symlink targets. Explicit snapshot mode retains the existing file-symlink/nonportable-source checks and excludes non-files from its walk; it is for trusted reviewed trees, not an untrusted concurrent filesystem sandbox. Existing archive traversal/absolute/UNC, raw-alias, symlink/special, permissions, executable allowlist, duplicate/case, root and CRC controls remain active. Tests cover both Windows and Linux and retain the prior independent malformed-archive regression.

No arbitrary text-wide normalization occurs. A binary fixture containing all byte values, NUL and CRLF survives bit-for-bit; changing its checkout copy cannot affect committed output. A text fixture's LF/CRLF worktree representations produce identical release bytes. Commit-bound verification rejects changed bytes rather than normalizing them into acceptance.

## Compatibility, limitations and outcome

The existing Scope 6A contract and RC2 tests intentionally supported source trees without `.git`, nested source fixtures and reviewed uncommitted source. That capability is preserved through explicit snapshot mode; historical callers/tests were updated to choose the correct mode. The Scope 6A helper derives its actual Git source and temporary clean/populated snapshots from the same raw commit and independently verifies all three against that commit. Their bytes match. Git-free CLI snapshot round-trip also matches the explicitly reviewed candidate snapshot exactly.

The direct real-worktree gate passes without removing any of the older witness's 22 diagnostic scripts or changing its 555 checkout EOL differences. The default release source is still committed HEAD `d22b9c89f79446fbfea2480e98e807f8da4dfbf4`; uncommitted corrective files intentionally do not appear in that release. A separate explicit nine-file candidate overlay is hashed and packaged for review. A future commit containing the corrective must receive exact-SHA qualification; no new commit is claimed here.

**Outcome: no unresolved Critical or High issue identified within this package-input trust boundary.** No remaining reportable finding was identified in the bounded review. No application, graph, Runtime or CUDA/native behavior was changed. This does not qualify broader Scope 6E integration, provide arbitrary-content secret detection, sign a release, or make a concurrency guarantee for an explicitly reviewed mutable snapshot.

The prior human acceptance remains narrowly applicable to the documented security infrastructure failure and has not been rewritten. Substantive review here passes under that accepted exception; the automated Codex Security completion seal remains **UNAVAILABLE / NOT COMPLETED**, never automated PASS.
