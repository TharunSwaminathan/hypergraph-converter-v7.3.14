# Portable source and local native installations

## Intended inventory and source bytes

Qualified release production defaults to `--source-mode git --revision HEAD`.
The source root must itself be a Git worktree root. The revision is resolved
once to a commit; membership comes from that commit's tree after exclusions,
and contents come from its raw Git blobs. The index, untracked paths, dirty
tracked bytes, checkout line endings and Git checkout filters are not release
inputs. Binary and text blobs are preserved exactly; no text normalization is
applied. Symbolic links, submodules and other non-regular committed entries fail.
Git metadata and the selected revision are an operator trust boundary, not a
publisher signature. Ambient `GIT_*` overrides and replacement objects are
disabled for these reads. A changed HEAD is a different release identity.

For equal archive roots across worktree names, use `--project-name product`.
This changes only the top-level ZIP name, not membership or content.

Source archives without `.git` and intentional fixture/review snapshots remain
supported through **explicit** `--source-mode snapshot` (API: `source_mode="snapshot"`).
That mode retains the reviewed filesystem inventory and exact bytes, including
intentional fixtures/uncommitted source, with the existing exclusions and safety
checks. It is not committed-release qualification. Default Git mode fails on
missing/broken metadata or an ancestor repository; it never falls back to a walk.
Uncommitted candidate edits are deliberately not smuggled into HEAD releases:
review an explicit bounded candidate snapshot, then qualify its future commit.

The verifier remains independent. `--source-root <trusted-worktree> --revision
<commit>` independently derives expected Git inventory/content and rejects
missing, extra or changed members and extra directories, in addition to all
structural policy checks. It never trusts an inventory supplied inside the ZIP
or imports the producer's policy. Without `--source-root`, results are explicitly
`structural-only`; an `ok` structural report does not attest intended source or
committed identity. Commit-bound verification reports its resolved `sourceCommit`.
Qualified release use requires both Git-mode production and commit-bound
verification. Intentional snapshot fixtures use structural checks explicitly.

The Scope 6A helper retains Git-free snapshot comparison without silently
weakening the actual release input: in Git mode its clean/populated temporary
snapshots are assembled from the exact committed blobs. Its explicit snapshot
option is for reviewed Git-free trees. Historical capture-time inventories and
NON-PASS results are not rewritten by this policy correction.

The portable source producer excludes the root-relative namespace
`candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-*/`.
The prefix is reserved for local qualification installations: every qualifier,
including an empty suffix during installation, is excluded. Matching is case
insensitive and uses complete path components under `candy-runtime/native/`.
It does not depend on a particular commit hash or qualification record.

The committed production directories `hypergraph-motif-cuda/` and
`hypergraph-motif-cuda-incremental/` remain included. Nested source fixtures
with similar names outside that root-relative namespace remain source; the
rule is not a general substring exclusion. A new local installation namespace
requires an explicit producer/verifier policy update and regression coverage.

`scripts/verify-portable-archive.py` independently rejects matching files and
directory entries after the archive's project-root component. The verifier
also retains its separate rejection of backslashes, traversal, absolute paths,
duplicates, case collisions, symlinks, special files, unsafe permissions,
unexpected executables, incorrect roots and CRC failures. Neither tool imports
the other's exclusion implementation.

The verifier inspects each ZIP entry's original member spelling. Python's
Windows ZIP reader normalizes backslashes in its convenience `filename` field;
the original spelling is required to enforce the existing backslash ban.

Before namespace matching or `PurePosixPath` normalization, the verifier rejects
noncanonical raw components: trailing dots or spaces, empty components (including
repeated separators), `.`/`..`, ASCII control characters and Windows-illegal
characters. One final `/` for a directory entry is permitted; backslashes remain
independently prohibited. These paths are reported in `nonCanonicalMembers`
instead of being rewritten into accepted paths. Case-insensitive namespace
matching and collision detection remain in force. Canonical production native
paths and nested lookalikes outside the reserved root namespace remain valid.

This blocks `candy-runtime./native/`, `candy-runtime /native/`, `native.` or
`native ` components, and all-dot/all-space components that Windows extraction
can remove. The regression checks the API and CLI before extraction, then uses
known synthetic entries in a separate temporary directory to demonstrate actual
Windows extraction aliases without executing anything.

The producer also checks outgoing raw components before creating or replacing
its output. This is necessary for a real POSIX filesystem packaging path: Linux
can contain trailing-dot/space names that a normal walk preserves in ZIP entries.
An ordinary Windows filesystem walk generally cannot descend those aliases.
The producer fails explicitly on nonportable included source; it neither
silently renames nor drops that source. It does not import verifier policy.

Existing build, `.local`, dependency, cache, credential and root `artifacts/`
exclusions remain in force. Nested production source such as
`candy-runtime/src/artifacts/artifactStore.js` remains included. A qualification
record or executable inside a reserved installation cannot enter the package,
regardless of filename; ordinary native build outputs and Runtime `.local/`
records remain excluded by their existing rules.

Run `node tests/candy-scope6e-package.test.mjs` for temporary synthetic-fixture
coverage of byte-identical clean/populated archives and independently injected
contamination. This packaging correction does not establish integrated Scope
6E qualification or alter native qualification identities or Runtime behavior.
