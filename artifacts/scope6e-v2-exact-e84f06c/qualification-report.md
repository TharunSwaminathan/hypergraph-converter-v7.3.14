# Scope 6E V2 package-input corrective — final exact-SHA qualification

READY FOR SCOPE 6E V2 PACKAGE INPUT CORRECTIVE QUALIFICATION TAG AND MAIN PROMOTION

Recorded: 2026-10-26T05:03:48.593465+00:00. Candidate `e84f06cdaa750803a06007ade63124b6bce693c8` on `candy-integration-scope6e-v2-package-input-corrective`; baseline `d22b9c89f79446fbfea2480e98e807f8da4dfbf4`.

## Candidate and remote CI

HEAD, origin-tracking ref and live origin branch all identify the candidate. No tracked or staged changes remain. The committed delta is exactly nine reviewed paths, 415 additions and 55 deletions. Every committed blob matches its reviewed prospective Git blob. No evidence/artifacts, native/CUDA source, Runtime/application source or package manifest/lockfile delta is present.

Draft [PR #8](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/pull/8) remains open. All five required checks completed successfully on the exact candidate; both workflow conclusions and individual job/check conclusions were verified, including the informational matrix jobs. No earlier candidate CI was reused.

| Required check | Run ID | Job / check ID | Result |
| --- | --- | --- | --- |
| CPU release / push | [40269371830](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40269371830) | [121398652468](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40269371830/job/121398652468) | PASS |
| CPU release / pull_request | [40269443440](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40269443440) | [121398857072](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40269443440/job/121398857072) | PASS |
| Ubuntu | [40269443407](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40269443407) | [121398856985](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40269443407/job/121398856985) | PASS |
| macOS | [40269443407](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40269443407) | [121398856857](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40269443407/job/121398856857) | PASS |
| Windows | [40269443407](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40269443407) | [121398856661](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/40269443407/job/121398856661) | PASS |

Raw read-only GitHub API responses and SHA bindings are retained in `remote/`; `remote/closure.json` summarizes the checks. The connector returned 404; existing repository Git authentication was used for GET requests only. Credential material was never printed or persisted.

## Fresh committed product gates

| Gate | Result |
| --- | --- |
| `npm.cmd ci` | PASS |
| `npm.cmd test` | PASS — 287/287 files |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run build:github` | PASS |
| `npm.cmd audit --omit=dev` | PASS — 0 production vulnerabilities |
| `git diff --check` | PASS |

These runs used the clean committed candidate checkout, including a fresh dependency installation. Git checkout line-ending representations are distinguished from raw committed blob hashes in `committed-delta.json`. Exact candidate producer/verifier code for the real witnesses was compiled directly from Git blobs. `product-gates.json` records command times, exit codes and log digests; `toolchain.json` records observed versions.

## Real package witnesses

Both actual worktrees produced identical archives using explicit revision `e84f06cdaa750803a06007ade63124b6bce693c8` and the same `product` archive root. SHA256: `7a297cf32dfc9b40a627ab1158c0f62dcfe2088f60df990a2a1cf3e80db361f9`. Size: **1,729,529 bytes**. Inventory: **940 entries, 884 files, 56 directories**.

The populated worktree stayed at the baseline on main; the shared object database supplied the explicit candidate revision without checkout or ref changes. It was not cleaned or edited. All 22 untracked Scope 6D scripts remain absent from both ZIPs. The required native production source, Runtime artifact store and new input-policy test are present. Root artifacts, Git/Codex state and local qualification/install state are absent. The independent verifier reports commit-bound success and the exact candidate SHA for both archives. Every one of their 884 files was additionally compared directly with its raw Git blob.

The prior precommit baseline archive had 939 entries; it is historical evidence of baseline inputs. This fresh archive includes the newly committed test and all nine committed corrections. Its identity was measured anew and is not inferred from the old archive.

## Input policy, prior fixes and security

Fresh focused Windows tests and WSL regression bodies passed. `input-policy-regressions.json` maps each required control to raw execution evidence. These cover arbitrary untracked and dirty/EOL inputs, exact binary bytes, legitimate committed source, Git-free fail-closed behavior, explicit snapshots, independent commit-bound verification, structural-only labeling, local-install/root artifacts exclusion and all prior alias/path/mode controls. The Windows extraction guard passed; the earlier CWE-180 alias bypass no longer reproduces. WSL lacked Node, so the unmodified Python bodies from the exact committed tests ran directly under WSL Python; the initial launcher failure and successful alternative runs are retained.

Fresh exact-blob comparisons confirm historical assertions were not weakened. The Scope 6A helper and extracted browser source build also passed in each exact-SHA CPU release workflow.

**Focused substantive security review: PASS; 0 unresolved Critical, High, Medium or Low findings within the reviewed boundary.** See `security-review.md` and `security-review.json` for the source/dataflow analysis and limits.

**Automated Codex Security seal UNAVAILABLE / NOT COMPLETED.** No security automation was invoked. The historical human acceptance remains limited to the documented checkpoint-lifecycle/completion-ordering infrastructure failure; it does not waive any product-security finding. Neither this report nor the passing substantive review represents an automated seal.

## Preservation and permitted next boundary

`preservation.json` confirms 1285 primary tracked files, 469 prior primary artifacts, 980 prior populated artifacts, 1306 populated tracked/script files and 3 local-install files remained byte-identical. Both indexes and all refs are unchanged. Prior NON-PASS, blocker, alias-bypass, interrupted security, exception and human-acceptance evidence was preserved. The ignored test-generated routing timing report was excluded from historical-artifact comparison in the before snapshot; no qualification history was excluded.

This closure permits human review of qualification tagging and main promotion for this exact package-input corrective candidate. No tag, staging, commit, push, PR merge, main modification or broader integrated Scope 6E qualification was performed. Broader Scope 6E integration remains unqualified and has not resumed. Stop at this exact-SHA closure.

Evidence inventory and SHA256s: `final-candidate-inventory.json`.
