# Exact CUDA_STATIC installation recovery and positive production validation

READY TO START SCOPE 6E V5 INTEGRATED QUALIFICATION

Repository: `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-scope6e-native-evidence-recovery`. Branch: `candy-integration-scope6e-static-install-recovery`. Exact product baseline: `d2a2bdb86ebf785ed2d7b43a9cca3a80ee7eb0d2`.
Recorded UTC: 2026-10-27T02:41:29.298924+00:00. Scope6E V5 has not started; this result permits that next qualification stage without claiming integrated qualification.

## Exact recovery

Pre-recovery checks passed before installation writes: correct HEAD and branch, no tracked/staged changes, protected STATIC tag peels to `a27eb1246e342097de448408ffa0a4775545c4ae`, both transfer destinations absent, both authoritative source sizes/digests exact, nine recovered incremental files intact, and existing STATIC source/Makefile/five evidence files exact. The populated source repository was read only.

Exactly two installation files were read as binary bytes, written with exclusive `open(destination,"xb")`, closed, reread and rehashed. Both sources were checked before either installation write. Both destination absences were rechecked before transfer. No existing installation file was overwritten.

| Source | Destination | Bytes | Expected SHA256 = observed source = observed destination |
|---|---|---:|---|
| `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14\candy-runtime\.local\cuda_static-qualified-build.json` | `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-scope6e-native-evidence-recovery\candy-runtime\.local\cuda_static-qualified-build.json` | 1,487 | `68d5e17696c67c04f5558e3aba556f4f86afdbf0750f44c1c80539b86f8d021f` |
| `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14\candy-runtime\native\hypergraph-motif-cuda\build\candy-hypergraph-motif-cuda` | `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-scope6e-native-evidence-recovery\candy-runtime\native\hypergraph-motif-cuda\build\candy-hypergraph-motif-cuda` | 1,160,632 | `fd0e2af192a322a00f719c8289218a0e08f96a4861553d31613d1fab6c346688` |

## Qualified record and unchanged inputs

The recovered record validates schema `candy.motif-qualified-build/1`, backend `CUDA_STATIC`, algorithm `HYPERGRAPH_3EDGE_MOTIF_COUNT`, taxonomy `candy.hypergraph-3edge-motif-taxonomy/1`, qualified commit `a27eb1246e342097de448408ffa0a4775545c4ae`, architecture `sm_120`, nvcc `13.4.59`, runtime API `13040`, runtime package `13.4.49`, exact record/device/evidence keys and expected source/Makefile/binary/evidence identities. Device is GPU0 NVIDIA GeForce RTX 5060, 8,151MiB, CC12.0. Record bytes were never regenerated or reserialized.

| Existing file retained | Before and after SHA256 |
|---|---|
| `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-scope6e-native-evidence-recovery\candy-runtime\native\hypergraph-motif-cuda\src\main.cu` | `74a9210e8872cf845d7c4c958732615c6f1eb81e4225a823542567aa837ac797` |
| `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-scope6e-native-evidence-recovery\candy-runtime\native\hypergraph-motif-cuda\Makefile` | `695d82ec5c51ddf157bb1e4163ab9212711f72024797a190e3202a72038036a6` |
| `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-scope6e-native-evidence-recovery\artifacts\candy-scope4b1-cuda-static-native-qualification.json` | `fa82a2e46518adc959b8b6b25f4e67dc44cbfe72d03b75cd07b764f8c305af63` |
| `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-scope6e-native-evidence-recovery\artifacts\candy-scope4b1-cuda-static-memcheck-qualification.json` | `bc8071686bff75bc26d8d426225bc317a950606cd074a74ee160fc1dc2f125df` |
| `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-scope6e-native-evidence-recovery\artifacts\candy-scope4b1-cuda-static-racecheck-qualification.json` | `5d60eaceae2cffb7aee62ef1798beedd7cf7b0fd05e4c081db53c99071601fe6` |
| `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-scope6e-native-evidence-recovery\artifacts\candy-scope4b1-cuda-static-initcheck-qualification.json` | `8f77642af711595fd4ba1b66cb04608b8a856060802209e77210341091dbdf72` |
| `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-scope6e-native-evidence-recovery\artifacts\candy-scope4b1-cuda-static-synccheck-qualification.json` | `27c10a45cebb0526f1440b347a0fe63e8c527488ed7da6f2f448f66c59b0ceee` |

The STATIC source and Makefile remain their qualified CRLF Windows checkout bytes. Their canonical Git LF hashes intentionally differ. No checkout, normalization, copy, restoration or rewrite was applied to them. All five existing evidence files remained unchanged, with native 487 cases/69 failure checks, sanitizer 3 cases each, status NATIVE_QUALIFICATION_PASS and failed=0.

## Ordinary production discovery and one genuine smoke job

Ordinary `buildCapabilityDeclaration(createRuntimeConfig())` passed without injected availability, runner or qualification data. Both STATIC and INCREMENTAL are AVAILABLE. Accepting STATIC through this committed production path requires the exact record/tag/source/Makefile/binary/five evidence payloads and the fresh live device/compiler/runtime package predicates. The runtime uses its original five-second environment probe bounds.

One bounded STATIC job ran through the committed Runtime server, authenticated CANDY HTTP client, JobManager, qualification binding, NativeProcessRunner, native supervisor and the recovered executable. Runtime used an ephemeral loopback port; no backend configuration was injected. The graph is committed taxonomy witness 0 (three connected hyperedges), whose expected vector is `[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]`, total 1.

Job `a9d063ae-333d-4dc5-b1ba-7a8c623c9f9d` completed with lifecycle `queued, preparing, running, validating, completed`. Result schema `candy.runtime-motif-result/1` and nested native schema `candy.hypergraph-motif-cuda-static-result/1` validated. Backend/mode were CUDA_STATIC/STATIC, exitCode 0, exact native fingerprint, 30 nonnegative integer bins, exact expected vector/total, kernel launch and synchronization succeeded, sm_120/nvcc13.4.59/runtime13040. No CPU fallback, incremental substitute or projection was used. The graph stayed unchanged. Runtime shut down cleanly.

Production packed request digest: `f0c09485a9439e03179e90741764d5e6fb75f63ad7adad840579bdf5df910365`. Submission JSON SHA256: `89e680bc6fc0ccbcbcc1f44b7db219aa0d55e790559643c810a2e1907028ef3c`. Result JSON SHA256: `dfb1da7b103d54ab86b014067386d3998f6018e36d9ac2eb6166d84f085223be`. The smoke JSON contains the complete graph, authorized request, snapshot/artifact references, native result and execution identity. It records the command used to run the evidence driver and labels the native wrapper command as a template, rather than claiming an independently captured process command line. Pairing credentials are not recorded.

## Incremental preservation and package non-contamination

Fresh ordinary production capabilities after the STATIC job still advertise CUDA_INCREMENTAL with fingerprint `sha256:58772e07cc04a5135a4cd21d8f6ba33701801b79d06925cde99284db075d12ff`. All nine incremental installation/evidence files retain the exact before bytes, sizes and mtimes. No incremental job, build, copy or evidence generation was needed.

The current committed producer packaged the fully populated recovery worktree using its default pinned Git source policy. A clean committed-source snapshot was materialized in a new temporary directory outside both repositories from raw pinned production blobs, then packaged with the unchanged producer in explicit snapshot mode. Both archives received independent committed verifier checks with verificationLevel=commit-bound and sourceCommit equal to the exact baseline. The scratch directory was removed after validation; new archives/manifests are retained only under the recovery evidence directory.

Clean/populated archives are byte-identical: SHA256 `508977338144acc212fc88c8a622e7725e98a16d56c9c36052be4566e56cc3ba`, 1,729,984 bytes, 940 entries (884 files, 56 directories). Both exclude candy-runtime/.local/**, STATIC native build/**, the complete versioned Scope6D incremental installation, and root artifacts/**. Production source under candy-runtime/src/artifacts remains included. No package policy was changed.

## Preservation and stop boundary

Preservation rehashed 3,265 pre-existing file entries across the recovery and read-only populated repositories, including all tracked files, prior evidence artifacts, qualified records, retained native builds and the versioned incremental installation. Sizes, SHA256s and mtimes remained unchanged. Raw Git indices, HEADs, branches and the complete local refs inventory are unchanged. This covers origin/main, main, protected tags and historical evidence branches. The populated source status is identical. New untracked paths are limited to this task artifacts; the only persistent installation additions are the two authorized files.

Historical V4 NON-PASS reports and their nested evidence remain byte-identical. There are zero tracked changes and zero staged changes. No native binary was rebuilt, no native qualification/sanitizer run or evidence regeneration occurred, and Codex Security was not invoked. Nothing was staged, committed, pushed, tagged or merged. No main or tag movement occurred. Scope6E V5 integrated qualification is NOT started, and no integrated PASS is claimed.

## New evidence

- `artifacts/candy-scope6e-static-install-recovery.json`
- `artifacts/candy-scope6e-static-positive-discovery.json`
- `artifacts/candy-scope6e-static-smoke.json`
- `artifacts/candy-scope6e-static-install-final-inventory.json`
- `artifacts/candy-scope6e-static-install-recovery-work/`: before inventory, exact-transfer readback, record validation, package archives/manifests and the evidence drivers.
