# CANDY Scope 6E V5 integrated qualification

NON-PASS — CANDY SCOPE 6E INTEGRATED QUALIFICATION BLOCKED

Exact baseline: `d2a2bdb86ebf785ed2d7b43a9cca3a80ee7eb0d2`. Branch: `candy-integration-scope6e-integrated-qualification-v5`. origin/main remains the exact baseline.

## First failed hard gate: section 7

**A freshly uploaded artifact cannot be queried through the committed client metadata method in the Git-free extracted Runtime.** The normal call `client.getArtifactMetadata(id)` returns HTTP404, classification ALGORITHM_FAILURE, message `Unknown runtime route.`

Client `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-scope6e-native-evidence-recovery\src\candy\client.js:80` applies `encodeURIComponent(id)`, producing `sha256%3A…`. Server `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14-scope6e-native-evidence-recovery\candy-runtime\src\server.js:14` matches the raw request URL with a literal `sha256:` route. Its lookup at lines85–86 is never reached for the encoded path.

| Same fresh artifact, authenticated request | HTTP | Result |
|---|---:|---|
| `/v1/artifacts/sha256%3A9082f31a8158020729e5084899269beb0293c8fa3f5e0ba1b4bf2296af7becc5/metadata` | 404 | Unknown runtime route |
| `/v1/artifacts/sha256:9082f31a8158020729e5084899269beb0293c8fa3f5e0ba1b4bf2296af7becc5/metadata` | 200 | Correct uploaded artifact metadata |

The literal-path request is a bounded diagnostic control, not a workaround used to pass qualification. No production client/server code was changed. The mismatch is reproduced using the exact extracted committed modules, an ordinary fresh Runtime, and a fresh authenticated upload. It is a product API contract defect, not the Codex Security infrastructure exception, missing native installation state, stale authentication, or an absent artifact.

## Gates completed and boundaries

| Gate | Result | Evidence / limit |
|---|---|---|
| Exact branch, HEAD, origin/main | PASS | d2a2bdb baseline, no tracked/staged changes |
| Both qualified native installations | PASS | All18 record/source/Makefile/binary/evidence files exact, protected tags exact |
| Ordinary production capability discovery | PASS | Both CUDA_STATIC and CUDA_INCREMENTAL AVAILABLE; no injected discovery/runner/environment |
| Fresh repository product gates | PASS | ci; 287/287 tests; lint; both builds; audit0 production vulnerabilities; diff check |
| Clean/populated portable archives | PASS | Exact byte identity, independent commit-bound verification, private-state exclusions, fresh committed Windows alias regression |
| Git-free extracted product gates | PASS | ci; 287/287 tests; lint; both builds; audit0 production vulnerabilities |
| Extracted health/authenticated capabilities | PASS | Fresh ordinary Runtime and client |
| Extracted CUDA truthfulness | PASS | Both motif CUDA backends UNAVAILABLE with private state excluded |
| Extracted CPU reference function | PASS in bounded diagnostic | Committed first taxonomy witness gives exact30-bin vector [1,0,…,0] |
| Extracted normal artifact metadata | NON-PASS | Client encoded-path404 versus literal-path200 for same uploaded artifact |
| Genuine V5 STATIC validation | NOT RUN | Stopped after section7 failure |
| Genuine V5 INCREMENTAL validation | NOT RUN | Stopped after section7 failure |
| Dedicated live Scope6C Runtime regression | NOT RUN | Fresh committed full-suite regressions passed; not substituted for the dedicated live stage |
| Production browser Scope6B regression | NOT RUN | Browser inventory inspected only; no product page or instrumentation build used |
| Integrated dual-backend soak | NOT RUN | Zero V5 native jobs attempted |
| Substantive integrated security/provenance | NOT COMPLETED | Focused source observations retained; no full V5 security PASS |
| Final preservation | PASS | Historical evidence, all18 native files, refs/index/source/build bytes and mtimes preserved |

## Package identity

SHA256 `508977338144acc212fc88c8a622e7725e98a16d56c9c36052be4566e56cc3ba`; 1,729,984 bytes; 940 entries, 884 files, 56 directories. Clean and fully populated archives are byte-identical. Root artifacts, .git, dependencies/build outputs, both private installations, qualification tooling and known secret/credential patterns are excluded. Production Runtime artifact-store source remains included. The unchanged independent verifier binds membership/content to the exact commit.

## Extracted gate session interruption

The identical V5 request was resubmitted while the extracted gate tool session was active. The extracted suite persisted its complete287/287 PASS log. The runner had advanced through ci, tests, lint and the two builds to audit, proving prior zero exits under its sequential fail-stop logic, but its final in-memory timing/summary was not saved. Original logs were preserved, including incomplete/NUL-padded build output. The two short builds and production audit were freshly rerun with new logs, exact exit codes and timings. For the earlier ci/test/lint commands, recovered elapsed approximations are explicitly marked in extracted.json; the test runner itself reports196.4seconds. No missing measurement is presented as an exact monotonic timing.

## Additional material observation

`src/candy/artifactPresence.js` probes previously uploaded artifact IDs using the same committed metadata helper. Its existing404 handling may discard a reuse entry and reupload, masking the route mismatch as an eviction/miss. Later live browser reuse/retention behavior was not exercised in V5, so no broader impact or security severity is claimed. Full repository and extracted tests passed despite this live HTTP contract defect.

## Security-infrastructure exception and limits

Codex Security automated completion seal remains **UNAVAILABLE / NOT COMPLETED**. No scan, completion or sealing was invoked. The previously accepted infrastructure exception does not waive this product gate. Substantive integrated product-security qualification was not completed in this blocked attempt and is not claimed as PASS.

No10k/100k-edge native CUDA,1M-incidence native CUDA, persistent-worker support or public-CI GPU qualification is claimed. The current qualified admission envelope remains unchanged. Persistent native workers remain deferred.

## Preservation

All 1,376 pre-existing tracked/prior-artifact file entries retain exact content hashes. All18 native identity files retain exact hashes, sizes and mtimes. V1–V4 NON-PASS evidence, Scope4B1/6D and corrective evidence were not rewritten, including their mtimes. The complete local-ref inventory and raw index hash are unchanged; HEAD, branch, origin/main, protected tags and historical evidence branches are unchanged. The preflight inventory explicitly excludes the generic deterministic-NLU routing telemetry regenerated by the committed full test suite. Two additional generic telemetry files, deterministic-nlu-quality-report.json and deterministic-nlu-compiler-quality-report.json, were rewritten by tests/deterministic-nlu-quality-metrics.test.mjs with identical bytes but updated mtimes; these metadata differences are retained in the final inventory and are not represented as untouched. No historical Scope qualification evidence changed.

Both extracted Runtime instances used for the check and bounded diagnosis shut down cleanly. No browser/build/Runtime service was left running by V5. No native job, native rebuild, native qualification or sanitizer run was performed in this V5 attempt. Prepared later-stage evidence drivers were not executed. No source, policy, Runtime architecture, native installation or historical evidence was corrected. Nothing was staged, committed, pushed, tagged or merged. No automatic corrective has started.

## Evidence

- `artifacts/candy-scope6e-v5-preflight.json`
- `artifacts/candy-scope6e-v5-product-gates.json`
- `artifacts/candy-scope6e-v5-package.json`
- `artifacts/candy-scope6e-v5-extracted.json`
- `artifacts/candy-scope6e-v5-work/extracted-runtime.json`
- `artifacts/candy-scope6e-v5-work/extracted-metadata-route-repro.json`
- `artifacts/candy-scope6e-v5-work/first-failed-gate.json`
- `artifacts/candy-scope6e-v5-native-static.json`, `native-incremental.json`, `runtime.json`, `browser.json`, `soak.json`: NOT_RUN records
- `artifacts/candy-scope6e-v5-security-review.md`
- `artifacts/candy-scope6e-v5-final-inventory.json`
