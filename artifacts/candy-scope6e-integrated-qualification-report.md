# Scope 6E integrated system qualification

NON-PASS — SCOPE 6E INTEGRATED QUALIFICATION BLOCKED

The required clean/populated portable archive gate fails on the unchanged product. Qualification stopped at this verified defect, as required by the Scope 6E instructions. No corrective product change was made.

## Exact product and clean start

- Worktree: C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14-scope6e
- Branch: candy-integration-scope6e-integrated-qualification
- HEAD and origin branch: c294ed0cea093bb8933d06e6e23177a7f1409952
- Initial tracked, staged, untracked and ignored status: clean.
- No old Scope 6D local diagnostic, build or profile state was present in this worktree.
- Scope 6D product tag: candy-integration-scope6d-tranche1-qualified -> c294ed0cea093bb8933d06e6e23177a7f1409952, verified locally and remotely.
- Scope 6D native tag: candy-integration-scope6d-tranche1-native-qualified -> f3fa7dc3d0c1ac3ef927b080da79b004ce93f0f0, verified locally and remotely.
- Main remains c294ed0cea093bb8933d06e6e23177a7f1409952. All starting Git refs, historical evidence branches and 1,282 tracked file hashes remain unchanged.

## Verified blocker: local native installation contaminates the portable source archive

The real, unmodified scripts/package-portable-source.py enumerates the filesystem with root.rglob at lines 465–470 and applies path/extension exclusions at lines 439–451. It does not exclude the versioned local native qualification source/Makefile, and it does not constrain those files to the committed product tree.

The Scope 6D binding qualification classified this versioned directory as local qualification installation state, outside the product commit:

`candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-f3fa7dc3/`

When that approved installation is present, the producer adds these uncommitted local-state members to the release ZIP:

- product/candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-f3fa7dc3/Makefile
- product/candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-f3fa7dc3/src/main.cu

No other file contents changed between the two archives. Two directory entries are also added. Thus release bytes depend on local qualification installation state, violating the required byte-identical committed-clean / committed-populated contract. The current archive verifier accepts both archives with zero reported issues, so it does not catch this contamination.

This is a packaging/release correctness blocker. The witness did not expose an executable or qualification record in the ZIP: build/ and .local/ exclusions worked. Synthetic credential/evidence/cache markers were also excluded. No real credential leakage or executable qualification bypass is claimed by this reproduction.

## Controlled reproduction and authoritative archive inventory

1. Read the exact c294ed0 committed tree using git archive, without changing either worktree or any ref.
2. Extract it into an isolated committed-clean/product directory and copy it unchanged to committed-populated/product. Both use the same product/ archive root, so root-name differences cannot explain the result.
3. Add only the approved versioned installation and synthetic excluded local-state markers to the populated witness. The installed source, Makefile, binary and record are hash-checked against metadata read from candy-integration-scope6d-tranche1-evidence. The original installation and evidence branch are read-only.
4. Run the repository's real create_zip producer and verify-portable-archive verifier on both witnesses.
5. Compare complete archive bytes and all file-member digests. Preserve both actual ZIPs under this worktree's root artifacts/.

| Witness | Bytes | Entries | Files | Directories | Verifier |
| --- | ---: | ---: | ---: | ---: | --- |
| Committed-clean | 1,723,688 | 937 | 881 | 56 | PASS, 0 issues |
| Committed-populated | 1,733,075 | 941 | 883 | 58 | PASS, 0 issues |

Clean SHA256: `03a9ba540b59a3dd69f2881b833dd00d1ef2cf7bc735fba16af722b89ef64ce2`

Populated SHA256: `bf6c0eb69ccb95d24f55992b6a818813b20795b54c67abc0f92a6b328e1a0380`

The added installation bytes have the approved identities:

| Item | SHA256 |
| --- | --- |
| LF main.cu | ce425e455649fb1e2fec632cd608834dd6f8d7b31969c81673a8d1304908ee2b |
| Makefile | 7460a217f6d29f5c4c8eaf9079babfcc8e7ef2f79ba7a2890ca3442f6a24cc8b |
| Executable, excluded from ZIP | 58772e07cc04a5135a4cd21d8f6ba33701801b79d06925cde99284db075d12ff |
| Record, excluded from ZIP | 065ba1a42fcf8b641104f67c26661364ca4aa293d2489cd4a8146a97e03b312f |

Required production Runtime source, including candy-runtime/src/artifacts/artifactStore.js, is present in both archives. Archive paths, permissions and CRC checks pass. Their successful integrity checks do not override the failed reproducibility gate.

## Completed gates and stopped work

Fresh Node v24.20.0 / npm 11.19.0 dependency installation with npm.cmd ci passed. The full base suite passed 285/285 files in 162.1 seconds. git diff --check passes. The required production-only audit was not run; npm ci's zero-vulnerability output is not substituted for that gate.

| Qualification area | Status |
| --- | --- |
| Exact clean baseline and qualification anchors | PASS |
| Fresh dependency installation | PASS |
| Base tests | PASS, 285/285 |
| Product byte/ref preservation and diff check | PASS |
| Clean/populated portable archive equality | NON-PASS, confirmed blocker |
| Lint, build, build:github, production-only audit | NOT RUN after stop |
| Fresh native/Studio end-to-end workflows and authority matrix | NOT RUN after stop |
| Browser scalability, Runtime plateau/recovery, long-session and multi-tab qualification | NOT RUN after stop |
| Assistant, parser/mapping and export lifecycle qualification | NOT RUN after stop |
| Extracted-package installation/tests/Runtime qualification | NOT RUN after stop |
| Independent Scope 6E remote CI readback | NOT RUN after stop; earlier Scope 6D results are not relabeled as new Scope 6E evidence |
| Full integrated security/trust-boundary review | NOT COMPLETED; no overall security PASS or zero-unresolved assurance is claimed |

No Runtime, Studio/Vite, model, profiler or sanitizer qualification service was started. The already-running base test command completed and exited. No stale service/session was reused.

The existing heap, >10 MiB B4, pointer/selector, one-shot worker, generated-parser review and native-admission limitations remain unchanged. No new scale, performance, memory or native safety claim is made.

## Evidence, preservation and next authorization boundary

The prechange inventory, package result, detailed reproduction, dependency/test logs and test results are additive and uncommitted under artifacts/. Actual clean/populated archives and temporary witnesses are retained. Qualification tooling is confined to artifacts/candy-scope6e-tooling/. Source files, qualification records, historical reports, tags, evidence branches and main were not edited.

Primary evidence files:

- artifacts/candy-scope6e-prechange-inventory.json
- artifacts/candy-scope6e-package.json
- artifacts/candy-scope6e-package-reproduction.json
- artifacts/candy-scope6e-package/committed-clean.zip
- artifacts/candy-scope6e-package/committed-populated.zip
- artifacts/candy-scope6e-test-results.json
- artifacts/candy-scope6e-final-inventory.json

A separately authorized corrective phase is required to change packaging inclusion and its regression/verifier coverage. No correction was implemented or staged. Scope 6E cannot receive a qualification tag on this result. No tag creation, commit, push, main modification, new native tranche, persistent worker or limit increase occurred.
