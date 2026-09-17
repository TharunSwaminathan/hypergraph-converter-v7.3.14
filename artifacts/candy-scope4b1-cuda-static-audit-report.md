# Scope 4B1 CUDA STATIC audit report

Status: **PASS**. All source changes remain uncommitted for review.

| Qualification area | Result |
|---|---|
| Overall / branch / baseline | PASS; candy-integration-scope4b1-cuda-static; 7b4206ba66f38df18b0a0fe33d55800f79ef0000 |
| Native architecture and contract | Standalone C++17/nvcc executable accepts `--request <regular-file>`, with strict v1 H2V token transport. CUDA_STATIC JSON v1 binds graph/version/device and returns 30 bins plus their total. Typed failures contain no counts. |
| CUDA environment | WSL2 Ubuntu; RTX 5060 device 0, compute capability 12.0, `sm_120`; nvcc 13.4.59, Compute Sanitizer 2026.3.0.0, runtime/driver version 13040. Exact queried output is retained. |
| CUDA execution | All 487 parity graphs launched and synchronized successfully. CUDA-event milliseconds are informational; no timing-based correctness or speedup claim. |
| Taxonomy/provenance | Host code derives all 128 classifier entries using six S3 permutations and ascending canonical masks: 96 connected signatures, 30 orbits, 24 closed classes and 6 open classes. No upstream executable source or data was accessed or copied. |
| Witnesses / signatures | All 30 classes pass, including all 6 open wedges and 24 closed triangles. All 128 signatures are accounted for: 96 connected, 13 realizable disconnected yielding zero, and 19 requiring empty edges rejected by both adapter and native parser. |
| Invariance / edge cases | 180 S3 graphs, 30 order transformations and 30 sparse renaming/isolate graphs pass. Numeric `0` and string `"0"`, distinct identical hyperedges, singletons, mixtures, zero-count graphs and fewer than 3 edges preserve exact results. |
| Stress/parity | Fixed seed `0x4b1c0de`: 96/96 pass, 0 fail, with 1–32 vertices and 0–18 edges across both static hypergraph types. All 30 bins and the connected total agree exactly across all 487 parity graphs. |
| Error/no-fallback | All 69 rejection checks pass (56 native typed failures), covering malformed/oversized requests, offsets, memberships, type/mode/schema/identity/device errors and corrupt results. Actual `CUDA_VISIBLE_DEVICES=-1` and four separate fault builds fail closed without counts. |
| Compute Sanitizer | Memcheck, racecheck, initcheck and synccheck each pass 3/3 production workloads: all 30 classes simultaneously, mixed memberships and 100 identical edges. Zero errors, hazards or warnings; raw diagnostics retained. |
| Regressions | Scope 4A-R: 4/4 focused files. Scope 3: 4/4 focused files, plus 12 native fixtures and 40 stress graphs using seed `0x5eed1234`. CPU and SSSP source diffs are empty. |
| Security | Fresh scan `8e9e0d07-c48f-4535-a9f2-938409894751` sealed and read back: complete coverage, 0 deferred, 0 findings, 0 Critical and 0 High. The tool's five-JSON inventory was reconciled to all 14 original changed files; independent architecture/native review complemented parent transport/evidence review. |
| Application gates | Full npm test: 245/245 files in 99.9 seconds. Lint, production build, GitHub build, production dependency audit (0 vulnerabilities) and diff check all pass. Dependencies unchanged; existing build chunk-size warning only. |
| Exposure boundaries | No projection or runtime/capability/browser/UI/ReAct/Ollama/model/adaptive integration. Qualified semantic sources, SSSP sources, production consumers and package manifests are unchanged. |
| Git / cleanup / stop | All changes uncommitted; historical tags unchanged. No commit, tag, push, merge, reset or history rewrite. Temporary requests, special files and gate logs cleaned; motif binaries retained only in ignored build directory for local review. Scopes 4B2 and 4C unstarted; hard stop. |

Qualification ELF SHA256 (this build only): `fd0e2af192a322a00f719c8289218a0e08f96a4861553d31613d1fab6c346688`.

Build: `make -C candy-runtime/native/hypergraph-motif-cuda NVCC=/usr/local/cuda-13.4/bin/nvcc CUDA_ARCH=sm_120 all qualification-faults`.

Dedicated qualification: `wsl -d Ubuntu --cd /mnt/c/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14 --exec /home/tharu/.nvm/versions/node/v22.23.1/bin/node candy-runtime/test/run-hypergraph-motif-cuda-qualification.mjs`. Append `--sanitizer=<tool>` for each recorded sanitizer run.

Protected peeled tags:

- `candy-integration-scope4a-qualified` → `7b4206ba66f38df18b0a0fe33d55800f79ef0000`
- `candy-integration-scope4a-security-blocked` → `9b70bd2f2ede2130857822d0603b1c394bb6c557`
- `candy-integration-scope3-cuda-qualified` → `48b78c106615add75128832236ccc07e0bcff6cc`
- `candy-integration-scope3-cuda-env-blocked` → `81491e4a04b4d33adb3ebd0679cbe196ce109288`

Exact changed-file manifest (relative to `C:/Users/tharu/OneDrive/Documents/Candi/hypergraph-converter-v7.3.14`):

- `.gitignore`
- `artifacts/candy-scope4b1-cuda-static-architecture.md`
- `artifacts/candy-scope4b1-cuda-static-audit-report.md`
- `artifacts/candy-scope4b1-cuda-static-environment.txt`
- `artifacts/candy-scope4b1-cuda-static-initcheck-qualification.json`
- `artifacts/candy-scope4b1-cuda-static-issue-register.json`
- `artifacts/candy-scope4b1-cuda-static-memcheck-qualification.json`
- `artifacts/candy-scope4b1-cuda-static-native-qualification.json`
- `artifacts/candy-scope4b1-cuda-static-qualification.json`
- `artifacts/candy-scope4b1-cuda-static-racecheck-qualification.json`
- `artifacts/candy-scope4b1-cuda-static-synccheck-qualification.json`
- `artifacts/candy-scope4b1-security/coverage.json`
- `artifacts/candy-scope4b1-security/findings.json`
- `artifacts/candy-scope4b1-security/report.md`
- `artifacts/candy-scope4b1-security/scan-manifest.json`
- `candy-runtime/native/hypergraph-motif-cuda/Makefile`
- `candy-runtime/native/hypergraph-motif-cuda/README.md`
- `candy-runtime/native/hypergraph-motif-cuda/src/main.cu`
- `candy-runtime/test/hypergraph-motif-cuda-contract.mjs`
- `candy-runtime/test/run-hypergraph-motif-cuda-qualification.mjs`
- `tests/candy-scope4b1-static-contract.test.mjs`

Limitations:

- STATIC only. CUDA incremental and Runtime Companion/browser/UI/model/adaptive integration remain unstarted.
- Single-machine correctness qualification on WSL2 Ubuntu / RTX 5060 / sm_120; no portable fixed ELF hash or speedup claim.
- Limits remain <=256 hyperedges, <=100000 incidences, <=5000000 aggregate membership visits; nonempty-edge/work constraints imply <=216 realizable accepted edges. Vertex metadata <=1000000 and request bytes <=2MiB.
- CUDA allocation/launch/sync fault errors are safe compile-time injections; actual no-visible-device failure is also tested. No deliberate production binary corruption or uncontrolled OOM experiment.
- CLI path grants explicit local regular-file read authority; parent symlinks use OS resolution. No remote file service or sandbox/cryptographic executable attestation is implemented.
- Initial harness workspace creation/binary hashing precede its main try/finally. A missing binary at initialization may leave an ignored empty workspace; actual qualification scratch directories were removed.
- Security snapshot covers all 14 original changed files after manual reconciliation of the tool's five-JSON inventory. Final aggregate/audit/issue documents and four unchanged canonical readback copies are reporting-only additions after sealing; no source/build/test/transport code changed after the reviewed snapshot.

The three sealed canonical JSON documents and tool-generated Markdown report are unchanged readback copies, not hand-authored replacements. Final reporting-only additions were reconciled after sealing; reviewed executable/build/transport/harness/test sources stayed unchanged.

Tool-reported rollout usage: 5,560,995 total tokens (5,522,259 input, including 5,286,912 cached; 38,736 output; 8,534 reasoning output), three threads, coverage complete. This includes owning-task implementation and worker contexts, not a separately metered review-only budget.

Final verification: the exact 21-file manifest matches Git (1 modified `.gitignore`, 20 untracked additions, no staged files). Protected tags and HEAD still match; source hashes and sealed findings/coverage hashes verified. CUDA `cuobjdump --list-elf` confirms both embedded images are `sm_120`. Qualification scratch and regression-only SSSP builds are absent; five ignored motif binaries remain for local review. `git diff --check` and source whitespace checks pass.
