# Scope 6E artifact metadata route corrective exact-SHA closure

READY FOR SCOPE 6E ARTIFACT METADATA ROUTE CORRECTIVE QUALIFICATION TAG AND MAIN PROMOTION

Candidate: `51e8a46ad527760b838bd92e78e19404d07acf40`. Parent: `d2a2bdb86ebf785ed2d7b43a9cca3a80ee7eb0d2`. Branch: `candy-integration-scope6e-artifact-metadata-route-corrective`.

## Exact candidate and boundary

The candidate is exactly one commit above the qualified baseline. Its complete delta is MODIFY candy-runtime/src/server.js and ADD tests/candy-scope6e-artifact-route.test.mjs. No dependency manifest, native input, package policy, historical evidence or unrelated product path changed. Working tree and index have no tracked/staged changes.

| Committed path | Reviewed Git blob |
|---|---|
| `candy-runtime/src/server.js` | `9d3f3601fe9221090bffaf4fe1abe3b63be01cea` |
| `tests/candy-scope6e-artifact-route.test.mjs` | `a5752a8dddfeed11b29b2cf0b080b2fe4abdbdda` |

## GitHub exact-SHA checks

The connected GitHub tool could not access this repository. Existing Git authentication was used only for GitHub REST GET requests; no credential was logged or written to evidence. PR 10 remains open and Draft with the exact candidate head. Raw workflow attempts/jobs and a final remote readback are retained.

| Required check | Event | Run ID | Attempt | Job ID | Conclusion | Completed UTC |
|---|---|---:|---:|---:|---|---|
| CI / Build and test (macos-latest) | pull_request | 40746908719 | 2 | 123035794338 | success | 2026-10-28T19:14:34Z |
| CI / Build and test (windows-latest) | pull_request | 40746908719 | 2 | 123035797808 | success | 2026-10-28T18:44:51Z |
| CI / Build, lint and test (Ubuntu) | pull_request | 40746908719 | 2 | 123035796748 | success | 2026-10-28T18:42:21Z |
| CPU regression and browser source release / cpu | pull_request | 40746906216 | 1 | 123022999099 | success | 2026-10-28T18:42:20Z |
| CPU regression and browser source release / cpu | push | 40744662515 | 1 | 123015143014 | success | 2026-10-28T18:28:00Z |

Historical CI attempt 1 of run `40746908719` is retained with GitHub workflow conclusion **failure** and macOS job `123023005928` conclusion **cancelled**, completed `2026-10-28T18:52:53Z`. It is not represented as success. The user reports runner/capacity circumstances; API evidence independently confirms the cancellation. The same-SHA macOS rerun in attempt 2, job `123035794338`, succeeded. Current required jobs and all three relevant workflows are successful on the exact candidate. The latest-attempt API carries Windows/Ubuntu successes with original execution times; no fresh execution is inferred merely from their latest-attempt IDs.

## Fresh exact-candidate product gates

All tested product-source inputs were materialized directly from the pinned committed candidate, with every path/blob/content digest retained in committed-source.json. This is not a proposed-source overlay. The clean physical tree protects pre-existing worktree evidence from generated test telemetry. All committed source bytes were rechecked before/after both product sweeps. The authoritative package independently uses Git and commit-bound verification.

| Gate | Exact committed clean source | Fresh authoritative-archive extraction |
|---|---|---|
| npm.cmd ci | PASS | PASS |
| npm.cmd test | PASS 288/288 | PASS 288/288 |
| npm.cmd run lint | PASS | PASS |
| npm.cmd run build | PASS | PASS |
| npm.cmd run build:github | PASS | PASS |
| npm.cmd audit --omit=dev | PASS, 0 production vulnerabilities | PASS, 0 production vulnerabilities |
| git diff --check | PASS in exact candidate Git worktree | Not applicable in Git-free tree |
| Real upload/public-client metadata/reuse/isolation/36 route negatives | PASS in fresh full suite | PASS in full suite and separate live readback |

Commands, exact cwd, elapsed wall time, exit status, test discovery count and log SHA256 are recorded in the product/extracted gate reports. Expected current count was confirmed as 288. No earlier pre-commit test result was substituted for these fresh runs.

## Commit-bound package provenance and reproducibility

Authoritative source production used the unchanged Git-backed producer with explicit revision `51e8a46ad527760b838bd92e78e19404d07acf40`. The independent verifier used the same explicit revision and trusted repository inventory. Every case reports `sourceCommit=51e8a46ad527760b838bd92e78e19404d07acf40` and `verificationLevel=commit-bound`.

Three independently generated witnesses match byte-for-byte: the authoritative Git archive from the evidence-populated current worktree, a committed-clean raw-source witness, and a populated raw-source witness with known synthetic excluded-state markers. Clean/populated physical inputs are raw committed-source materializations; their separate witness producer mode does not determine the final claim. Each archive independently passed the full commit-bound verifier against the candidate. No structural-only or proposed-source evidence is used as final package provenance.

Archive SHA256 `911c69d7e7956e71149daa41af5317bbbfec8dafcbaae8cb6a778ba8700041c2`; 1,733,082 bytes; 941 entries (885 files, 56 directories). Entry sets and every committed payload match. Corrective server/test blobs are included. Private/local records, native builds, versioned local installs, root artifacts, diagnostic/tooling and synthetic secret/credential markers are excluded. Production Runtime artifact-store source remains included. The existing Windows path-alias/adversarial package matrix and real extraction guard passed. No policy or verifier was changed.

## Fresh Git-free extracted V5 regression closure

The authoritative commit-bound archive was extracted into a brand-new temporary directory with no Git metadata or injected private state. Its full suite passed. A separate invocation of the committed integration regression started ordinary production Runtime instances, used normal session authentication and the unchanged public client, uploaded a fresh artifact, and fetched exact metadata through getArtifactMetadata(id). Literal/%3A/%3a controls, presence/reuse, genuine eviction, authentication/origin failures, isolated stores and all 36 malformed raw routes passed. Pairing credentials were not recorded.

A separate fresh extracted Runtime health/authenticated capability check reports both CUDA_STATIC and CUDA_INCREMENTAL UNAVAILABLE with motif_qualification_unavailable_or_stale. Private .local/build/versioned install paths are absent. No availability/runner/qualification override was injected. All test Runtime instances shut down cleanly.

## Security closure

Substantive product security qualification PASS under the accepted security-infrastructure exception; Codex Security automated completion seal UNAVAILABLE / NOT COMPLETED.

Fresh focused review covers only the committed corrective delta and its route/authority context. Literal/encoded compatibility, absence of generic decoding, traversal and separator aliases, double/malformed percent escapes, identity/collision, authentication/origin/store isolation and false-presence/false-eviction behavior were assessed. No unresolved Critical/High finding was identified. The automated seal was not invoked or represented as PASS.

## Preservation and readiness limit

All 1,286 tracked files and 444 pre-existing evidence files retain exact bytes, sizes and mtimes. All local refs, protected tags, the raw index hash, HEAD and the origin corrective ref are unchanged. Remote corrective branch remains `51e8a46ad527760b838bd92e78e19404d07acf40` and remote main remains `d2a2bdb86ebf785ed2d7b43a9cca3a80ee7eb0d2`; PR 10 remains Draft. Historical V1–V5 NON-PASS evidence was neither used as fresh qualification nor rewritten. No private native state was copied/touched, no native executable/job/qualification/sanitizer ran, and no native evidence was regenerated.

No stage, commit, amend, push, tag, merge, main promotion or PR-ready action was performed. This result is readiness for a later qualification tag and main promotion, not execution of those actions. Scope 6E V6 integrated qualification has not begun. V5 remains historically NON-PASS; this exact committed corrective closes its identified route defect.

## Evidence

- artifacts/candy-scope6e-artifact-route-exact-sha-ci.json
- artifacts/candy-scope6e-artifact-route-exact-sha-product-gates.json
- artifacts/candy-scope6e-artifact-route-exact-sha-package.json
- artifacts/candy-scope6e-artifact-route-exact-sha-extracted.json
- artifacts/candy-scope6e-artifact-route-exact-sha-security-review.md
- artifacts/candy-scope6e-artifact-route-exact-sha-final-inventory.json
- artifacts/candy-scope6e-artifact-route-exact-sha-work/: before inventory, committed input manifest, exact gate logs, workflow attempts/jobs, archive/manifests, live reports and remote final readback.
