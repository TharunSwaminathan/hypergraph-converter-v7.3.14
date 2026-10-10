# CANDY Scope 6A implementation and qualification

Verdict: **PASS**, for the user-authorized bounded Scope 6A qualification. All work remains uncommitted on candy-integration-scope6a-release-hardening, HEAD f8343ae195e37885726c396733dd6f5b9468f0fb. No commit, tag, push, merge or main modification.

Resolved: S6-01, S6-13, S6-14, S6-15, S6-20, S6-21, S6-22. S6-01 resolution is measurement infrastructure plus the explicitly permitted bounded smoke; full benchmark distributions and crossover remain deferred.
Deferred gap IDs: S6-02, S6-03, S6-04, S6-05, S6-06, S6-07, S6-08, S6-09, S6-10, S6-11, S6-12, S6-16, S6-17, S6-18, S6-19, S6-23, S6-24. No later-scope optimization, batching, fallback, schema or native/CUDA algorithm change was implemented.

## Implementation

S6-13: Browser client exposes per-operation signals/deadlines. Owned controller/discovery generations abort on invalidation, reconnect, clear pairing and disposal. Deadlines default to 15 seconds, upload 30 seconds; finite overrides are 1..120000ms. Cleanup removes timers/listeners. Existing exact async currentness remains mandatory; local authorization/result owners are revoked synchronously before remote cancellation. No automatic retry was added.

S6-14: One appendLiveMessage helper caps every live append path at 500, including graph/batch/continuation/status paths. Pending, confirmation and current result ownership remains outside messages; persisted history stays inert. 10,000 append equivalents never exceed 500. Existing read-only, quoted/negated/hypothetical, bounded context and selector regressions remain passing.

S6-15: Shared download manager dispatches a hidden anchor, removes it, releases Blob URLs after 1000ms and on error/teardown; StrictMode remount is supported. Bytes are unchanged. 1,000 injected downloads release all URLs/timers; actual Chrome export bytes also match.

S6-20: Source/browser-only package explicitly excludes local native build, .local, known credentials/secrets and temporary assets. The production-imported Runtime test contract modules remain packaged. Existing archive path/symlink/mode/CRC checks are preserved. The unchanged motif qualification verifier fails closed on external extraction without Git/evidence.

S6-21: Additive release contract and manifest bind four historical anchors, exact dirty source inventory/archive bytes, ancestry, precommit Scope5 provenance and LF/CRLF distinction. Exact deployed native bytes remain separately qualified. Unsigned local records do not establish publisher authenticity.

S6-22: CPU workflow runs lockfile install, full tests, lint, both builds, production audit and package/extraction gates. Actions are pinned to immutable SHAs, permissions are read-only and checkout credentials are not persisted. Public CPU CI explicitly reports real GPU UNAVAILABLE/SKIPPED. Observed Node24.19.0 is documented; no unsupported minimum was invented.

## Benchmark infrastructure and findings

Seeded disjoint S1/S2/S3 qualified fixtures and B1 representation-only fixture record shape/cardinality/degree/ID/work/JSON/native-byte digests. Q admission checks precede native dispatch; B/N lanes are refused before native execution. Work remains I*(E-1)*(E-2)/2 <= 5000000, alongside all unchanged count/byte limits. The 10,000-edge B1 fixture is not motif qualification.

Production graph/pending/shared Apply code supplies B1/B2 spans; exact JSON hash/base64/upload envelopes supply B3; genuine HTTP and bounded native execution supply observable B4/B5; injected retention counters supply B6; existing bounded job projection and separate genuine browser/package evidence support B7. No runtime semantic instrumentation was changed. Timings exclude paint and unobservable internal stages.

Single descriptive smoke on Intel Core Ultra5 225F, 10 logical cores, 33,847,996,416 bytes RAM, Windows10.0.26300, Node24.19.0. Zero warmups, one replicate, one session. Seed731406. Cold/warm variance makes these numbers unsuitable for comparisons or speed claims.

| Fixture | E/V/I | Load ms | Stage ms | Apply ms | Artifact JSON bytes | Upload envelope bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| S1 | 16/64/64 | 5.778 | 5.294 | 1.869 | 2084 | 2910 |
| S2 | 64/512/512 | 0.426 | 3.834 | 4.073 | 13428 | 18034 |

Both fixture Apply runs created exactly one commit and one history entry, with zero native jobs. S1/S2 artifact hash spans were 0.026/0.024ms. Small real Runtime health/discovery/upload spans were 12.260/316.750/9.575ms. Genuine Q/S1 CUDA_STATIC end-to-end was 807.970ms, kernel0.8664ms; all30 counts and total verified zero, with truth/result checksums recorded. Genuine browser CUDA_INCREMENTAL delta also completed; no paired incremental timing distribution or crossover was captured. Retention: peak/final messages500 after10000 appends; zero URLs/timers after1000 injected downloads.

## Browser verification

Real Chrome loaded the public three-edge fixture. Type transition to DynamicHypergraph version2 starts no job. Explicit Stage creates revision1 proposed2->3 without changing committed2. Analyze requires its own confirmation, genuine CUDA_INCREMENTAL result is opened and current, and committed graph stays2. Separate Apply commits3 once; pending becomesNONE/current resultno/analysisSTALE, with version-bound no-job notice.

Assistant Delete h2 stages revision2; Instead delete h1 restages revision3 against unchanged committed3. Clear pairing truthfully reports unavailable. Fresh discovery restores qualified local availability, while old analysis staysSTALE. The visibly retained old confirmation rejects on click with fresh exact confirmation required; no job/result revival. Assistant Apply pending update requires separate Confirm, then commits4 once: h0/h2 retained, h1 removed, two edges/four vertices/five incidences. No extra Runtime job on either Apply, corroborated by unchanged shared-controller tests.

Actual Chrome h2v.txt completed at 29 bytes, SHA256 dc4a9a4fdfec94591974486a515780f252e69cad7863dfdbd27cc52e1aabbc60, matching exact expected UTF8/LF fixture export. Download-event automation timed out; completed-file verification supplies the proof. Injected repeated-download tests supply URL cleanup counters. Source selectors remain usable in the current Assistant flow; no mounted500-message stress claim.

Screenshots: candy-scope6a-browser-apply.png, candy-scope6a-browser-final.png and candy-scope6a-browser-extracted.png. Pairing/tabs/owned helper processes were cleaned up afterward; no old chat was copied to evidence.

## Package and release provenance

Actual, clean and synthetic populated packages are identical: SHA256 ba30c6352cb11595c9534c6df43aba44d84139d64e80095a99911c3ea82522cb, 1,667,220 bytes, 887 entries, zero integrity issues. Local ignored build/.local/credential markers are absent. Package generation spans: actual868.469ms, clean3306.450ms, populated2795.468ms. These include scan/verification costs of differing workspace layouts and are descriptive single samples.

Candidate ZIPs remain outside the repository at C:/Users/tharu/AppData/Local/Temp/candy-scope6a-package-sgwzit9q/ (actual.zip, clean.zip, populated.zip). Final clean package extracted outside Git/evidence; npm ci/build and real three-edge browser conversion passed. Advanced panel visibly reports browser-only mode. Both CUDA_STATIC and CUDA_INCREMENTAL independently return motif_qualification_unavailable_or_stale. Contract imports remain present; no verifier bypass occurred.

Anchors: integration b24c4e32100d2e7c05b13df3c8f6f9e279fd8828; readiness f8343ae195e37885726c396733dd6f5b9468f0fb; qualified54dd4d3edb73681f51bf8bb69b9708778a46a502; historical blockedbf0240a54fb6ac8284bd9ac371306511158a1a2e. Ancestry, readiness parent and historical tags verified unchanged. Scope5 final JSON precommit fields are explained, not rewritten. Git LF source blobs and CRLF checkout bytes remain different identities; native deployed bytes are never normalized.

## Automated correctness and dependency gates

npm ci PASS. Full npm test PASS271/271 files in125.6s. All three new focused tests PASS. lint PASS. build PASS. build:github PASS. Production npm audit --omit=dev PASS zero vulnerabilities. git diff --check PASS. Real actual/clean/populated integrity and extracted npm ci/build PASS. Fixture lane rejection and static CI/provenance contract checks PASS.

Host npm was absent; a pinned transient npm11.6.2 registry tool was used with the existing lockfile. npm ci's development-tree audit reports four advisories (one moderate/three high); no dependency upgrade performed. Existing production chunk warning remains. GitHub-hosted CI execution has not occurred; static contract checks and local equivalent gates do not claim remote execution or GPU CI PASS.

## Targeted security review

Completed Codex Security scan 8e5c51a0-903e-4ad5-b13a-8ceb568021c3; 23 reviewed surfaces, zero discovery candidates and zero unresolved reportable issues. Two independent read-only partitions covered browser lifecycle and release/tooling, with root metadata/evidence review. Supplied threat model retained exactly; SHA25695d7da71b01d3c52f58d198cef7556679dc9d72a8e9b6d71b6e947f5259d1107. Supplemental receipt exported unchanged to candy-scope6a-security-review.md.

Canonical report: C:/Users/tharu/.codex/state/plugins/codex-security/scans/hypergraph-converter-v7.3.14/f8343ae195e37885726c396733dd6f5b9468f0fb_20261010T032741Z_g9641u5w/report.md.
Completion warning: "Working-tree contents changed while the scan was running; results were saved for the original snapshot." This concerns added/refreshed descriptive evidence only; all20 frozen source/test/document hashes match worker start/end and the additive release manifest. Canonical sealed scan was not rewritten. Workbench measured usage: total6,782,256; input6,764,207; cached input6,479,104 tokens (codex_rollout, complete measurement).

## Exact source, test and CI inventory

Nine tracked source/document/tool files modified and eleven new source/test/document/CI files; 20 total. Three new test files; no existing test modified.

- .github/workflows/cpu-release-gates.yml: SHA256 019a953c73459c66f9ecfaffbc4f1cac878af4d6cff0c440da0e4e45f3125351
- candy-runtime/README.md: SHA256 4f55b29c621da7001bd077684fa0e8024f1c5591b8de88d7407c820b389e5596
- docs/CANDY_SCOPE6A_RELEASE_CONTRACT.md: SHA256 b45b093478cc031f181a7e89146780b30cb841fb894f5dc54044839fb99e4249
- docs/RELEASE_v7.3.14.md: SHA256 cd3701da4c00dbd21c4ed490cf2db2f4566f79d4b1820177dd4d232572b47ed1
- scripts/benchmarks/scope6a-fixtures.mjs: SHA256 122a00d68610dea841980c97367ad30d2a0d4874ec1dc28ffd25e56cb6cc1f41
- scripts/measure-scope6a-baseline.mjs: SHA256 4041c741efe9eb74f2f8589a2d390f7f75d550ee36ce7b4844973009320a1521
- scripts/package-portable-source.py: SHA256 50c73f7518beea827f9b604bf5cc5dd9cd7e2a367e412df9ada6cfed5bb29af0
- scripts/qualify-scope6a-package.py: SHA256 b4fe2db434c77b61dd82d29dc9fd83eb44929fbce01edccc2cdaa531ddc3d4bc
- scripts/verify-portable-archive.py: SHA256 9649090c21d4173238b08014c3f446cf24412ab9f9c1127e76d7226aa71a0ecc
- scripts/write-scope6a-provenance.mjs: SHA256 8aaf14973fc5999f50ff076177e7ea4e888e14a80302ba323c9ceabef00c2f13
- src/App.jsx: SHA256 bdec3c1fb1127417fc1eae77c45ff5e8e16df59e1bbe52555e408830a4b19f85
- src/agent/liveMessageHistory.js: SHA256 1c1354899fb3fa96a74e982b21d6a9d27fa4acf885cf9befc7a88f17c23d21ed
- src/candy/client.js: SHA256 bbfe516af51abb5b423e4e400a42434bbcbfdf2b5bbb2ebd443c8cf3b9abf88a
- src/candy/motifAnalysisController.js: SHA256 c52c818745d46ce172a2c6e7b136973a27dc33369c479fccd49b0c5adc56a134
- src/candy/useCandyRuntime.js: SHA256 cf0570390947643900f09aefc1357d2e3c57e5531085a820ab8b8a4cb008bbbb
- src/components/AgentChatPanel.jsx: SHA256 64c009c432a8ae4fba6fd8e936db7125e78e21d541866a4d83479028eee6382a
- src/utils/downloadLifecycle.js: SHA256 f74122ced7bf5a6838369655f5494a616f9a374f3c762827b2a7ad6daff42e5a
- tests/candy-scope6a-hook.test.mjs: SHA256 4b6341e7056ffe13f1db588edc0ea04a95830bcba67f945d498b82825fee9384
- tests/candy-scope6a-lifecycle.test.mjs: SHA256 eba8f26d8faccbc0e31591bb8ffb2a3c181492ea37bed5d94b521e47ab636bbf
- tests/candy-scope6a-release.test.mjs: SHA256 06864231d3012802ba25c0086470c22dc36ae84164454e0220ac4412dc5ee195

Additive evidence is listed exactly in candy-scope6a-repository-inventory.json. That file contains all requested final Git commands and the full untracked inventory. Ignored build/node_modules/test log outputs are distinguished from reviewable Git changes. The release manifest's source inventory excludes evidence to avoid self-referential authority.

## Protected integrity and limits

Both native motif directories: no delta. package.json/package-lock.json: no delta. Scope5/original Scope6 evidence: no delta. Historical qualified/blocked tags unchanged. No staged changes. HEAD unchanged. All remaining intended changes are uncommitted Scope6A files/evidence.

- Performance evidence is a single descriptive smoke: zero warmups, one replicate, one session. No speed, crossover or large-native-capacity claim.
- S1/S2/S3/B1 seeded generator subset is implemented. Remaining benchmark families, five warmups/30 warm repeats, 20 cold starts and three sessions belong to a dedicated measurement run.
- STATIC S1 ran genuinely on the qualified local CUDA backend. INCREMENTAL genuinely ran in the browser fixture flow; no paired incremental timing distribution was captured.
- Queue, H2D, D2H, allocation and CUDA context decomposition, peak heap/VRAM, thermals, power and storage were not measured.
- CPU CI contract checks and equivalent local gates passed. GitHub-hosted workflow execution is not yet observed; GPU live qualification is UNAVAILABLE/SKIPPED on that lane.
- npm ci reports four development-tree advisories (one moderate, three high). Required production-only audit reports zero. Dependency files were intentionally unchanged.
- Existing large production chunk warning remains (about 1.66 MB, 465.61 KB gzip). No bundle optimization was in Scope 6A.
- Message retention stress uses 10,000 append equivalents and source-path assertions; it does not claim a mounted 500-message paint/heap stress test. Current selectors were checked in the genuine Assistant flow and existing regression suite.
- Download retention counters use injected URL/timer APIs; a genuine Chrome download independently matched exact bytes. The Chrome automation download event timed out, but the completed file appeared and was verified.
- Old panel analysis confirmation can remain visibly rendered after reconnect, while analysis is STALE/current result no. Clicking it was rejected with fresh exact confirmation required and created no job.
- Local abort cannot remotely cancel an accepted job if its response and job ID are lost. Native jobs remain subject to unchanged limits; no stale result becomes current.
- 500 messages is a count bound, not a byte budget. URL cleanup bounds lifetime after dispatch, not simultaneous peak count.
- Packaging excludes known local/build/secret/temp patterns. Arbitrarily named undisclosed secret files are outside that proof; the actual reviewed package and synthetic marker checks passed.
- The sealed security scan retains its original snapshot and explicitly warns that working-tree contents changed during review. Frozen 20-file source hashes match both workers and the release manifest; only descriptive evidence changed afterward.
- Browser-only source distribution cannot enable qualified CUDA without separately verified exact Git/evidence/source/binary/environment prerequisites. Local unsigned manifests are not publisher attestation.

Recommended next action: review this uncommitted diff and evidence. Any commit/release or later phase requires a separate instruction. Hard stop after this qualification report.
