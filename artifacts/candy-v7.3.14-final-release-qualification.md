# CANDY / Hypergraph Converter Studio v7.3.14 final release qualification

NON-PASS — v7.3.14 FINAL RELEASE QUALIFICATION BLOCKED

Recorded UTC: 2026-10-28T21:33:03.420645+00:00. Repository `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-final-release`. Branch `release-v7.3.14-final-qualification`.

## First release-blocking defect: existing stable-version identity conflict

The requested stable tag **`v7.3.14` already exists both locally and on origin and identifies different product bytes**:

| Identity | Existing stable release | Requested frozen candidate |
|---|---|---|
| Annotated tag object | `af3911c505a510ae7b0a90bcfcbd5db47d0921a4` | No new tag created |
| Product commit | `9d79d9f9027b338096d7cf62d67c2a22e9cab247` | `51e8a46ad527760b838bd92e78e19404d07acf40` |
| Tree SHA | `86a367ee1c4d8fabb8b9cf88d0c395a6e5ce02a3` | `d64da79235d0c149ea8ec475ba0494b816c2d9cd` |

There are 143 differing committed paths between the existing tagged product and the requested candidate. The existing tag's commit subject is `fix: correct v7.3.14 RC2 packaging and release docs`. GitHub's tag-ref and annotated-tag APIs independently agree with local Git and read-only `git ls-remote` about the existing object and peeled commit.

This blocks the requested readiness to assign the final stable version name: that operation would replace existing published version provenance rather than create a new unoccupied release identity. The current run authorizes qualification only; no tag, release, source, history or version policy was altered. This is a release-provenance conflict, not a newly established product-code or security defect. No repair or retagging was attempted.

## Correct preflight identities and stopped gates

The requested branch, HEAD, main, origin/main and final Scope 6E qualification tag all correctly identify `51e8a46ad527760b838bd92e78e19404d07acf40`. There are zero tracked/staged changes, no product delta from main, no dependency-manifest delta from main and no native delta from main. Candidate tree SHA is `d64da79235d0c149ea8ec475ba0494b816c2d9cd`. The final integrated qualification tag was not moved.

Fresh repository tests, npm install/audit, package generation and alias matrix, fresh extraction, Runtime/application/browser smoke, portable native boundary, local native execution sanity, final release security review, Pages deployment verification and documentation qualification are **NOT RUN** after the first blocker. No release ZIP or new archive provenance was generated. No prior 288/288, audit, browser or CUDA result is reused as a fresh release result. An initial read-only GitHub workflow inventory preceded confirmation of the blocker; it is not presented as completed final-release CI qualification.

Earlier Scope 6E integrated PASS for the exact candidate remains valid historical evidence; it does not resolve the distinct stable-version collision. Historical NON-PASS outcomes and accepted exception records remain unchanged.

## Preservation

All 1286 tracked files, all 1286 pre-existing local tracked/evidence entries and 884 external historical Scope 6E evidence files retain exact bytes, sizes and mtimes. The raw index and complete local refs inventory are unchanged, including existing `v7.3.14`, main and every qualification tag. No source, native installation, dependency manifest, historical evidence or branch was changed. This run started no Runtime, Studio, browser, native job, native build, requalification or sanitizer process. Only additive untracked reports/helpers under `artifacts/candy-v7.3.14-final-release-*` were created.

Nothing was staged, committed, amended, pushed, tagged, merged or released. No GitHub Release or next implementation scope was created. No historical branch was deleted.

Codex Security automated completion seal remains **UNAVAILABLE / NOT COMPLETED under the previously accepted infrastructure exception**. It was not invoked or represented as passed. This exception is unrelated to the stable-tag collision.

## Evidence

- `candy-v7.3.14-final-release-preflight.json` and `candy-v7.3.14-final-release-first-blocker.json`: exact identities and first blocker.
- `candy-v7.3.14-final-release-manifest.json`: explicit blocked provenance, with later results NOT RUN and archive fields null.
- `candy-v7.3.14-final-release-inventory.json`: preservation, new path inventory and evidence hashes.
- `candy-v7.3.14-final-release-work/github-stable-tag.json`, `remote-refs.json`, `before.json`: independent tag evidence and preservation snapshot.
- Suggested package/extracted/browser/Runtime/native/product/security/doc reports are truthful NOT_RUN records, not passing substitutes.
