# V7_4 Windows CI second corrective: command reference EOL portability

PASS — corrective ready for review. Exact Windows checkout failure reproduced and fixed locally on Node v22.23.3. A new remote GitHub run is not claimed.

Baseline: `c07ce6b261e02f4fcc1c8a000dc1a7f18f771d23`, branch `v7_4-merged-baseline-integration`. Main checkout HEAD and every recorded ref remain unchanged.

## Root cause and reproduction

A separate fresh Git clone checked out the exact baseline detached, with `git -c core.autocrlf=true checkout --detach c07ce6b261e02f4fcc1c8a000dc1a7f18f771d23`. Before applying any correction its Git status was clean. Node 22.23.3 reproduced the supplied stale-reference assertion (exit 1), recorded in `v7_4-windows-ci-eol-logs/before-focused-node22.log`.

`git config --show-origin --get core.autocrlf` returns `file:C:/Program Files/Git/etc/gitconfig true`. `git check-attr -a -- docs/DETERMINISTIC_COMMAND_REFERENCE.md` returns no attributes. Existing `.gitattributes` controls launcher and binary files, with no Markdown EOL rule. No Git configuration or attributes were changed. Local clone initially encountered an ownership safety check; the retry supplied an exact source `.git` safe-directory exception only in the subprocess environment, without changing persistent configuration.

The committed Git blob and generator output are byte-identical: 81,369 bytes, 2,764 LF and zero CRLF. SHA256: `5cd93b48d76366a486930ecef55f49de0199642090061241493b000e3be094de`. The original imported working file also retained those LF bytes.

The fresh checkout has 84,133 bytes and 2,764 CRLF pairs. SHA256: `ff8b7dde00d383083b89a77759f17bdf22284c9d5ab1bbd4be349f7a8579ed4f`. Replacing only CRLF with LF produces the exact generator output. No content was stale. Checkout line-ending conversion caused the strict string assertion to fail.

## Exact correction and integrity coverage

Only `tests/deterministic-command-reference-doc.test.mjs` changed. Its local assertion helper normalizes `\r\n` to `\n` on both actual and expected text, then uses the same strict equality assertion and original stale-document message. The real checked-in document still passes through this assertion and its provenance-marker checks.

Coverage in the same existing test file verifies LF/LF, CRLF/LF, LF/CRLF and CRLF/CRLF. Seven mutations each fail with an AssertionError on the actual side and expected side (14 rejected comparisons): changed title/content, missing first character, added content, missing final newline, doubled internal space, added trailing space, and lone CR. Fixture guards prove each mutation changes the original. No trimming, collapsed spaces, arbitrary content normalization, platform skip or process.platform branch was added. The suite still has 274 test files.

The generator script and formatter retain their existing deterministic LF output. The reference Markdown was never regenerated or edited. No attributes, manifests, workflows, catalog semantics, production sources, native/CUDA code or Scope 6B code changed. The previous job-engine correction remains byte-identical.

## Windows validation

All commands below ran from the separate fresh checkout, using the existing exact Node v22.23.3 installation, CI=true, stdin disconnected and Node 22 placed first only in the child process PATH. The corrected test was copied with CRLF endings; the document retained its original CRLF checkout bytes throughout. The checkout contains only the one intended tracked test modification.

| Gate | Result | Duration |
| --- | --- | --- |
| focused-node22-1 | PASS | 0.195 s |
| focused-node22-2 | PASS | 0.182 s |
| focused-node22-3 | PASS | 0.188 s |
| focused-node22-4 | PASS | 0.182 s |
| focused-node22-5 | PASS | 0.184 s |
| focused-node22-6 | PASS | 0.183 s |
| focused-node22-7 | PASS | 0.182 s |
| focused-node22-8 | PASS | 0.187 s |
| focused-node22-9 | PASS | 0.187 s |
| focused-node22-10 | PASS | 0.186 s |
| focused-supported-runner | PASS | 0.261 s |
| previous-job-engine-correction | PASS | 2.961 s |
| npm-ci | PASS | 11.827 s |
| npm-test | PASS | 165.116 s |
| lint | PASS | 11.069 s |
| build | PASS | 0.953 s |
| build-github | PASS | 0.846 s |
| production-audit | PASS | 1.041 s |

`npm.cmd test` passed **274/274**, including the prior CANDY Scope 2 test. The separate prior-job-engine run also passed. Production audit reported zero vulnerabilities. The main LF checkout additionally passed the focused test. Both checkouts passed `git diff --check` (Git may emit its normal LF-to-CRLF conversion notice).

Fresh checkout: `C:\Users\tharu\OneDrive\Documents\Candi\v7_4-windows-ci-eol-corrective-20261014\fresh-checkout`. No new Ubuntu/macOS run was performed; normalization covers both EOL forms without operating-system branches.

## Protection and security/reliability review

Compared against a pre-change SHA256 snapshot: only the intended test changed; **1254 other tracked files** remain byte-identical in the main checkout. Protected tracked path counts: `{"src/": 266, "candy-runtime/": 55, ".github/": 3, "docs/": 83, "scripts/": 69}`. All **590 pre-existing artifact files** retain their hashes. Main, tags and all recorded refs are unchanged. Full-suite generated reports and build output were created only in the separate checkout; historical evidence was not overwritten.

Manual review found zero unresolved Critical/High concerns in this change. It adds no runtime behavior, network access, subprocess creation, dependencies or filesystem writes to the test. Exact equality still detects all differences except the specified CRLF/LF representation. Regression assertions also protect meaningful whitespace and malformed lone-CR changes. Existing fixture read and deterministic formatter calls remain unchanged. This is a focused manual assessment, not a repository-wide security scan.

## Review artifacts and stop

`v7_4-windows-ci-eol-diagnosis.json`: Git configuration, attributes, byte counts, hashes and before-failure evidence.
`v7_4-windows-ci-eol-gates.json` and `v7_4-windows-ci-eol-logs/`: exact commands, working directory, timings, exits and full logs.
`v7_4-windows-ci-eol-final.json`: protection and review results.
`v7_4-windows-ci-eol-corrective.diff`: complete one-file patch.

No commit, push, merge, tag or Scope 6B work was performed. Hard stop for review; a human-controlled commit/push and subsequent remote CI rerun remain outside this completed local corrective pass.
