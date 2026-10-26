# Exact-SHA extracted snapshot corrective — focused semantic security review

Candidate: `d2a2bdb86ebf785ed2d7b43a9cca3a80ee7eb0d2`. Baseline: `e84f06cdaa750803a06007ade63124b6bce693c8`. The committed delta is exactly `tests/candy-scope6a-release.test.mjs`, 19 additions / 2 deletions, matching the previously reviewed prospective Git blob `4882f08a36337fd74c72eac2d5ea2f33298b5ce6`. This review examines the exact committed source and unchanged helper/contract trust boundary; it does not reuse a precommit execution result as exact-SHA evidence.

**No unresolved Critical or High product issue identified in this corrective.** No reportable security finding was identified in the bounded review.

## Caller authority and fail-closed behavior

The test preserves the helper default for a Git-backed self-test. A project-root `.git` directory or linked-worktree file causes no snapshot argument to be supplied. If present metadata is broken, there is no error-catching fallback or retry that could change release authority. Only the intentionally Git-free extracted self-test selects the explicit `--source-mode snapshot` argument.

The helper remains unchanged: default inputs are a pinned Git inventory and raw blobs; temporary comparison snapshots in Git mode come from those blobs and are independently verified against trusted Git. Explicit snapshot mode is filesystem self-test qualification, not committed release provenance. The added assertions require each helper result to be commit-bound with the current SHA in Git-backed runs or structural-only with null source commit in snapshot runs. A separate helper invocation against newly extracted Git-free source must exit 1 with the missing-metadata error and produce no success report when the snapshot argument is omitted. Snapshot operation cannot satisfy these assertions while masquerading as commit-bound qualification.

Presence detection is confined to this known self-test environment. It does not change the producer, verifier, CLI defaults, independent source validation or documented production input policy. Subprocesses receive fixed argument arrays without shell interpolation. The change grants no Runtime, model, parser, native-backend or mutation authority and uses no previous credentials or sessions.

## Exact package and adversarial evidence

Fresh archives use producer and verifier code compiled directly from this candidate's Git blobs, explicit candidate revision, default Git mode and identical archive root names. Both actual source roots independently verify against the candidate SHA. Their output ignores the 22 populated untracked scripts, local-install state and 555 observed checkout-only EOL differences. The exact committed corrected test is included. No precommit overlay or snapshot is used to generate the authoritative release archive.

`adversarial-matrix.json` records 24 rejected mutations of that actual release archive and six accepted canonical production controls. Its raw cases cover arbitrary new scripts/source files, reserved native installs, root evidence, trailing-dot/space aliases, mixed/backslashes, traversal, POSIX/Windows absolute paths, an explicit UNC path, token/credential/environment contamination, executable aliases, NUL/control/illegal names, symlinks, special files and unsafe modes. The independent commit-bound verifier rejects extra otherwise-allowed source members; structural checks independently reject malformed members. The original candidate archive passes all commit-bound checks.

The unchanged committed input-policy test exercises arbitrary untracked inputs, dirty text/binary bytes, LF/CRLF independence, exact all-byte/NUL/CRLF binary preservation, independent inventory/content verification, non-regular Git entries, no-Git fail-closed behavior and explicit snapshots. The full repository and extracted suites record fresh execution evidence separately. Existing path-alias and Windows extraction-guard regressions remain part of those suites. Archive binary-member observations and synthetic binary proof are distinguished in the package record.

## Scope and exception status

Substantive product security qualification PASS under the explicitly accepted security-infrastructure exception; automated Codex Security completion seal UNAVAILABLE / NOT COMPLETED.

That statement applies only to this one-file extracted-snapshot corrective and its package policy regression boundary. No Codex Security automated scan, completion or sealing was invoked. The historical accepted infrastructure exception was not rewritten and does not waive a product-security finding.

The separate five-file Scope 6D native-evidence blocker remains **OPEN**. No missing evidence was fabricated, regenerated, copied from similarly named sources, replaced or reinterpreted. No genuine CUDA, Runtime/browser integration or final Scope 6E qualification was attempted. Overall integrated Scope 6E remains **NON-PASS**.
