# CANDY v7.3.14 RC1 release qualification

**Verdict: NON-PASS. Not eligible for final v7.3.14 release tagging.**

Exact RC1 commit/branch/origin/Scope6A tag are verified at `117ed4b9d8caa929ead5df3d6af59ad70a878cb2`. Initial working tree was clean. Two unresolved release blockers prevent PASS: the package drops a required Runtime production module, and current documentation is not fully truthful. No product change was made to repair either defect.

| Gate | Observation |
| --- | --- |
| Remote CPU CI | PASS, release branch run [38022467285](https://github.com/TharunSwaminathan/hypergraph-converter-v7.3.14/actions/runs/38022467285), completed success for exact RC SHA on GitHub-hosted Ubuntu 24.04. Two same-SHA tag/branch runs also green. GPU live UNAVAILABLE/SKIPPED. |
| Archive SHA256 | `007cac9c9a183d70a5289687f44346c4e57bdf19bca1ccfd80929bb2730b7457` |
| Archive bytes / entries | 1,664,327 bytes; 887 entries = 831 files + 56 directories |
| Package script SHA256 | `50c73f7518beea827f9b604bf5cc5dd9cd7e2a367e412df9ada6cfed5bb29af0` |
| Lockfile SHA256 | `53fb9226f7b511cb55db2455e331a03bc6e57161375ef3cdca2d4038fbddd22b` |
| Source inventory SHA256 | `f52a9fbe7a4f93a912457cef5492968000e7fdecd9f25f7aded559709fd838b2` |
| Reproducibility | Exact Git blob clean/populated snapshots produce identical payloads and container bytes. Raw current checkout/populated checkout also identical to each other. |
| Checkout byte distinction | 236 files differ only in LF/CRLF. Checkout ZIP is ba30c6352cb11595c9534c6df43aba44d84139d64e80095a99911c3ea82522cb / 1,667,220 bytes. It is not the exact committed-byte RC1 ZIP. |
| Extraction | Fresh external `C:\Users\tharu\AppData\Local\Temp\candy-rc1-a81c6409d57c4ec7a622719b1b054dbc\extracted\hypergraph-converter-v7.3.14`; no Git, evidence, .local or native binaries copied in |
| Extracted npm ci / build / build:github | All PASS, lockfile/manifests unchanged |
| Browser | PASS in real Chrome from extracted GitHub production build; 3 edges / 4 vertices / 6 incidences, correct rows/export preview/statistics/graph rings; DynamicHypergraph and Assistant render; navigation leaves pending/analysis NONE with no automatic Stage/Analyze/Apply |
| Source mode | Truthful browser-only panel; optional companion discovery disabled in default build |
| Extracted CUDA | Both CUDA_STATIC and CUDA_INCREMENTAL unavailable with motif_qualification_unavailable_or_stale from unmodified production verifier and capability registry |
| Extracted Runtime startup | FAIL ERR_MODULE_NOT_FOUND: candy-runtime/src/artifacts/artifactStore.js omitted by artifacts exclusion |
| Repository build / build:github | Both PASS |
| Qualified local smoke | PASS: both backends discovered with unchanged names; one genuine STATIC S1 run returns all 30 zero bins and total zero; exact native/source/Makefile/record hashes and protected native tags unchanged |
| Production audit | PASS zero vulnerabilities in repository and extraction. Full audit separately records one moderate / three high dev-only advisories; no dependency remediation |
| Security | No unresolved reportable release Critical/High. Actual archive raw paths/modes/CRC/secrets/qualification boundary reviewed. Windows verifier backslash limitation recorded |
| Documentation / provenance | Provenance PASS with historical capture-time records preserved; documentation NON-PASS due Runtime availability and STATIC-only contradictions |
| Source delta | NONE from RC1, including native, Runtime, manifests, packager and verifier |

## Exact blockers

RC1-01: `scripts/package-portable-source.py` excludes a directory called artifacts anywhere in the tree. This removes the committed production module `candy-runtime/src/artifacts/artifactStore.js`, imported from `candy-runtime/src/server.js:5`. The verifier also treats this production path as forbidden. Browser compilation is successful, but `npm run candy:runtime` cannot start from this extraction. No HTTP-health/discovery success is claimed. A packaging-policy repair changes protected RC1 source and therefore requires a subsequent candidate and requalification; it is not performed here.

RC1-02: `candy-runtime/README.md:31` says current Studio provides only Hypergraph and enables STATIC only. The exact candidate visibly supports DynamicHypergraph staging controls. `docs/CANDY_SCOPE6A_RELEASE_CONTRACT.md` says extracted Runtime health can work, contradicted by RC1-01. Scope6A contract correctly preserves browser-first distribution, matching exact trusted CUDA requirements, real motif bounds, public CPU/GPU distinction and no large native capacity claim. Historical precommit wording/status fields remain capture-time evidence, not current RC1 authority. This additive report identifies current truth without rewriting old records or correcting packaged docs.

## Provenance and limits

The immutable anchors are RC/Scope6A 117ed4b9d8caa929ead5df3d6af59ad70a878cb2; readiness f8343ae195e37885726c396733dd6f5b9468f0fb; pre-Scope6 main b24c4e32100d2e7c05b13df3c8f6f9e279fd8828; Scope5 qualified 54dd4d3edb73681f51bf8bb69b9708778a46a502; historical browser-blocked bf0240a54fb6ac8284bd9ac371306511158a1a2e. Ancestry, readiness parent and peeled historical tags are verified. Prior source inventory and ZIP digests bind CRLF checkout bytes; new package.json binds raw committed blobs. Old CPU NOT_RUN fields describe earlier capture time and are superseded only by the additive remote-ci.json receipt. The historical write-scope6a-provenance writer was read but not run, since it requires the old readiness HEAD and writes historical files.

Observed local tools: v24.20.0, npm 11.19.0, Python 3.13.15. Windows plus Ubuntu WSL genuine local motif qualification is observed; no cross-platform GPU or large-scale support is added. Limits remain 256 hyperedges, 100000 incidences, 5,000,000 aggregate work, 2 MiB packed request, 256 deletions/insertions each and unchanged transport limits. No 10k/100k-edge or 1M-incidence native claim. Local smoke is bounded, not a matrix rerun or performance qualification. Public CPU success does not qualify GPUs. Full audit's dev-only advisories and existing bundle warning remain. Unsigned evidence is descriptive, not publisher attestation.

The actual ZIP's original member spellings pass independent normalized-path inspection. Eleven of twelve hostile verifier probes are rejected; Windows zipfile normalizes backslashes before the verifier can inspect filename, so that one probe is accepted. This is recorded as a verifier portability limitation, with no actual unsafe RC1 entry and no broad hostile-archive certification.

Archive retained outside repository at `C:\Users\tharu\AppData\Local\Temp\candy-rc1-a81c6409d57c4ec7a622719b1b054dbc\hypergraph-converter-v7.3.14-rc1-source.zip`. Clean, populated and checkout witness ZIPs/inventories, raw build logs and external qualification harnesses remain under `C:\Users\tharu\AppData\Local\Temp\candy-rc1-a81c6409d57c4ec7a622719b1b054dbc`. Package/source inventories and case digests are persisted in additive package.json; identical-case inventories are referenced rather than duplicated.

## Additive evidence and final repository state

All reviewable additions are listed exactly in `candy-v7.3.14-rc1-repository-inventory.json`. The seven principal records are qualification.json, release-manifest.json, package.json, browser.json, security.md, report.md and checksums.txt under the `candy-v7.3.14-rc1-` prefix; supporting receipts contain CI, builds, CUDA/native smoke, audits, release review, browser snapshots and three screenshots. Checksums bind all other additive evidence and the release archive; repository inventory records the required final Git command outputs and untracked files.

Branch stays release-v7.3.14-rc1 and HEAD stays 117ed4b9d8caa929ead5df3d6af59ad70a878cb2. Tracked diff, protected source delta and staged diff are empty. Only RC1 evidence is untracked. Historical evidence and tags are unchanged. No commit, tag, push, merge or Scope6B work. The final inventory is captured after all files are created.

Recommendation: do not tag this RC1 as final v7.3.14. Stop here. Packaging/documentation repairs require separately authorized changes and a new exact candidate qualification.
