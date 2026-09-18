# Scope 4B2 CUDA INCREMENTAL audit report

Status: **PASS**. Native, sanitizer, regression, application and sealed security gates pass. Branch `candy-integration-scope4b2-cuda-incremental`, baseline `592c91f938675d6c76d3179b080c95ed6e1b9398`, protected Scope4B1 tag `a27eb1246e342097de448408ffa0a4775545c4ae`.

Standalone C++17/nvcc executable with strict v1 transport derives exact signed deltas from unique affected OLD/NEW triples. Qualified update adapter alone creates NEW and affected semantic sets. Common typed vertex/edge mappings permit native verification of unchanged incidence. SHA256 binds the entire payload; result consumer checks graph/version/update/digest/device, histogram/candidate limits, signed subtraction and total. Delta-only: no prior counts or stale-state authority, full-count recomputation, CPU fallback or persistent replay ledger. Different-request replay fails; identical retry is stateless.

Host loops enumerate i<j<k once and retain affected tuples only; independent duplicate-producing anchor-set enumeration verifies candidate cardinality/deduplication. GPU alone merges rows and classifies candidate data. CANDY-derived S3 classifier retains 128 signatures,96 connected,30 classes,24 closed,6 open. No upstream source/lookup/CBST/update/min-ID strategy copied or accessed. Pure insertion cannot change existing triples: the suite adds a new class alongside a wedge, and replacements cover actual class changes.

Environment freshly queried: WSL2 Ubuntu, RTX5060 device0, CC12.0, sm_120, nvcc13.4.59, runtime/driver13040, Compute Sanitizer2026.3.0.0. Binary SHA256 `f8930b6e1b169edb8c9fbaf2846a4744466477c75333326c51b5040121d46758`. Actual launches/synchronization pass and cuobjdump verifies both sm_120 images. No speedup/portable ELF claim.

Build: `make -C candy-runtime/native/hypergraph-motif-cuda-incremental NVCC=/usr/local/cuda-13.4/bin/nvcc CUDA_ARCH=sm_120 all qualification-faults`.

Qualification: `wsl -d Ubuntu --cd /mnt/c/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14 --exec /home/tharu/.nvm/versions/node/v22.23.1/bin/node candy-runtime/test/run-hypergraph-motif-cuda-incremental-qualification.mjs`. Append each `--sanitizer=memcheck`, `racecheck`, `initcheck`, `synccheck` for the recorded mode.

| Gate | Final result |
|---|---|
| Incremental CPU/STATIC old/new/delta/reconstruction | 405/405 updates, all30 bins and total exact;810 independent CPU snapshots and810 STATIC runs |
| Classes/S3 | Creation30/30, destruction30/30;open6/6,closed24/24;180 S3 transitions |
| Insertion/deletion/replacement/mixed/zero effect | Named matrix plus deterministic stress pass;typed sparse IDs, identical incidence, isolates,new vertices,singletons,0/1/2 edges,2->3 and3->2 covered |
| Deduplication | Two/three deleted or inserted members,overlapping replacements,mixed affected members verified;candidate counts match independent sets |
| Permanent anchor | Old closed2,new closed1,CUDA closed delta-1;faulty anchor reference-2;all other bins exact |
| Update stress | 128/128 seed0x4b2c0de,zero failures |
| Chains | 12/12 steps;insert/delete,delete/reinsert,replacement/replacement,mixed,zero/nonzero;prior new ref/counts match next OLD |
| Failure/stale/replay matrix | 104/104 checks,63 native typed failures;no crash/hang/partial counts;invaliddevice,actual no visible GPU,four isolated fault builds fail closed |
| Sanitizers | All4 modes6/6 workloads,zero production errors/hazards/warnings;full diagnostics retained |
| Scope4B1 STATIC | 487 exact graphs,69 rejection checks,all30/sixopen/96 stress;source/validator/evidence unchanged |
| Scope4A-R / Scope3 | Focused4/4 each;SSSP native12 fixtures+40 stress,CUDA/OpenMP/reference exact |
| App tests | 246/246 files PASS |
| Lint/build/GitHub build/audit/diff | PASS;241 modules,existing chunk-size warning;production audit0 vulnerabilities |
| Exposure/dependencies | No projection,H2H/V2H authority,Runtime/REST/capabilities/browser/UI/ReAct/Ollama/adaptive integration;dependencies unchanged |
| Git/stop | Uncommitted,unstaged;no commit/tag/push/merge/reset/history rewrite/tag changes;Scope4C unstarted |

Protected tags:
- `candy-integration-scope4b1-cuda-static-qualified` -> `a27eb1246e342097de448408ffa0a4775545c4ae`
- `candy-integration-scope4a-qualified` -> `7b4206ba66f38df18b0a0fe33d55800f79ef0000`
- `candy-integration-scope4a-security-blocked` -> `9b70bd2f2ede2130857822d0603b1c394bb6c557`
- `candy-integration-scope3-cuda-qualified` -> `48b78c106615add75128832236ccc07e0bcff6cc`
- `candy-integration-scope3-cuda-env-blocked` -> `81491e4a04b4d33adb3ebd0679cbe196ce109288`

Exact review inventory:

- `.gitignore`
- `artifacts/candy-scope4b2-cuda-incremental-application-gates.json`
- `artifacts/candy-scope4b2-cuda-incremental-architecture.md`
- `artifacts/candy-scope4b2-cuda-incremental-audit-report.md`
- `artifacts/candy-scope4b2-cuda-incremental-environment.txt`
- `artifacts/candy-scope4b2-cuda-incremental-initcheck-qualification.json`
- `artifacts/candy-scope4b2-cuda-incremental-issue-register.json`
- `artifacts/candy-scope4b2-cuda-incremental-memcheck-qualification.json`
- `artifacts/candy-scope4b2-cuda-incremental-native-qualification.json`
- `artifacts/candy-scope4b2-cuda-incremental-qualification.json`
- `artifacts/candy-scope4b2-cuda-incremental-racecheck-qualification.json`
- `artifacts/candy-scope4b2-cuda-incremental-synccheck-qualification.json`
- `artifacts/candy-scope4b2-cuda-static-regression.json`
- `artifacts/candy-scope4b2-sssp-regression.json`
- `candy-runtime/native/hypergraph-motif-cuda-incremental/Makefile`
- `candy-runtime/native/hypergraph-motif-cuda-incremental/README.md`
- `candy-runtime/native/hypergraph-motif-cuda-incremental/src/main.cu`
- `candy-runtime/test/hypergraph-motif-cuda-incremental-contract.mjs`
- `candy-runtime/test/run-hypergraph-motif-cuda-incremental-qualification.mjs`
- `tests/candy-scope4b2-incremental-contract.test.mjs`

Known limitations:

- Bounded correctness envelope: <=256 declared edges, <=100000 incidences, <=5000000 full-snapshot membership visits per snapshot, <=1000000 vertices, <=2MiB packed request. Nonempty edges imply <=216 realizable accepted edges.
- Host generates index candidates; GPU alone classifies/counts them. No benchmark or speedup claim.
- Single-machine WSL2 Ubuntu/RTX5060/sm_120 qualification. ELF hash binds this build only, without portable reproducibility or cryptographic executable attestation.
- Standalone stateless delta-only CLI, no prior full-count state, property store, persistent replay ledger or application capability exposure. Different-request replay fails binding; identical retries are deterministic.
- Local operator/JS adapter/toolchain are trusted; SHA256 payload binding is integrity, not authentication. Native independently verifies unchanged incidence but cannot authenticate original external semantic IDs.
- Allocation/launch/synchronization failures are trusted compile-time injections, not uncontrolled production OOM experiments. Actual unavailable-device tests also pass.
- Insertion alone cannot change the classification of an existing triple; another class is added alongside an existing wedge. Replacements cover actual connected/class conversions.
- Qualified STATIC sources/validator are unchanged. Historical Scope4B1 evidence was restored byte-for-byte after fresh regression, which is retained separately.
- Final sealed-security readback copies and status/scan/hash updates are reporting-only post-seal material; production/build/transport/harness/tests remain unchanged after review.

Sealed security decision:

- Scan `b5744ec4-ddba-4a37-9675-c3a51dc958f4`, snapshot `codex-security-snapshot/v1:sha256:00dd2a9567a50716984bde46276d15dc147a5d56bf68a37b355c060cdb8a35c0`.
- Sealed status completed; coverage complete; deferred0; openQuestions0; Critical0/High0/Medium0/Low0; final-review-pending absent.
- Tool inventory10 JSON paths reconciled to all20 Git paths, each explicitly represented in sealed coverage; no source/build/transport/harness/test change after reviewed snapshot.
- Four canonical readback copies are byte-identical to sealed originals and recorded seal digests match findings/coverage bytes.
- Only aggregate/issue/audit reporting metadata updated after seal; all17 other original path hashes unchanged. Reviewed20 SHA256 hashes and24 final paths retained in aggregate.
- Ignored generate.py was removed before snapshot; write-evidence.py and transient report-transfer/finalizer/log files removed after finalization. Five ignored local ELFs remain for review; no tracked build paths, objects/PTX/cubin/fatbin/request/sanitizer scratch.
- Dependencies unchanged; final git diff --check passes;1 modified,23 untracked,0 staged; no Git history/publication/tag changes; Scope4C unstarted; hard stop.

Exact final changed-file manifest (24):

- `.gitignore`
- `artifacts/candy-scope4b2-cuda-incremental-application-gates.json`
- `artifacts/candy-scope4b2-cuda-incremental-architecture.md`
- `artifacts/candy-scope4b2-cuda-incremental-audit-report.md`
- `artifacts/candy-scope4b2-cuda-incremental-environment.txt`
- `artifacts/candy-scope4b2-cuda-incremental-initcheck-qualification.json`
- `artifacts/candy-scope4b2-cuda-incremental-issue-register.json`
- `artifacts/candy-scope4b2-cuda-incremental-memcheck-qualification.json`
- `artifacts/candy-scope4b2-cuda-incremental-native-qualification.json`
- `artifacts/candy-scope4b2-cuda-incremental-qualification.json`
- `artifacts/candy-scope4b2-cuda-incremental-racecheck-qualification.json`
- `artifacts/candy-scope4b2-cuda-incremental-synccheck-qualification.json`
- `artifacts/candy-scope4b2-cuda-static-regression.json`
- `artifacts/candy-scope4b2-security/coverage.json`
- `artifacts/candy-scope4b2-security/findings.json`
- `artifacts/candy-scope4b2-security/report.md`
- `artifacts/candy-scope4b2-security/scan-manifest.json`
- `artifacts/candy-scope4b2-sssp-regression.json`
- `candy-runtime/native/hypergraph-motif-cuda-incremental/Makefile`
- `candy-runtime/native/hypergraph-motif-cuda-incremental/README.md`
- `candy-runtime/native/hypergraph-motif-cuda-incremental/src/main.cu`
- `candy-runtime/test/hypergraph-motif-cuda-incremental-contract.mjs`
- `candy-runtime/test/run-hypergraph-motif-cuda-incremental-qualification.mjs`
- `tests/candy-scope4b2-incremental-contract.test.mjs`

Canonical copy SHA256:

- `artifacts/candy-scope4b2-security/scan-manifest.json`: `81b02e18d58ea7f57791601159d595b8e93821cb1249ede301a2725913d89bb3`
- `artifacts/candy-scope4b2-security/findings.json`: `697acf6f36a3926ef3f64864a305d8bd55d0a85fa0f15e31ded798255601931b`
- `artifacts/candy-scope4b2-security/coverage.json`: `c95575dd381f8c6bc90f8f6a519d880a50c0d1eb79a8d17638f28a90c7f605f3`
- `artifacts/candy-scope4b2-security/report.md`: `271bad1238c8639a12dbf73ad74d2a7b157c98294a2aa22bf31b892536137aae`

Measured security-tool rollout usage:12,552,528 total tokens (12,491,629 input,11,769,600 cached input,60,899 output,7,652 reasoning output),3 tasks;source codex_rollout,coverage complete. This is tool-reported rollout accounting, not a price or fresh-test claim.
