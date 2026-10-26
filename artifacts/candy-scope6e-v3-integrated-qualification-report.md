# Scope 6E V3 final integrated qualification

NON-PASS — CANDY SCOPE 6E INTEGRATED QUALIFICATION BLOCKED

Recorded: 2026-10-26T05:21:52.548457+00:00. Branch: `candy-integration-scope6e-integrated-qualification-v3`. HEAD and origin branch: `e84f06cdaa750803a06007ade63124b6bce693c8`. Package-input qualified tag resolves to the same SHA. The production/native Scope 6D tags resolve to the requested `c294ed0cea093bb8933d06e6e23177a7f1409952` and `f3fa7dc3d0c1ac3ef927b080da79b004ce93f0f0` anchors.

## Exact blocking findings

1. **The unmodified extracted-package `npm.cmd test` fails.** It discovers 287 files and passes 47 before failing at `tests/candy-scope6a-release.test.mjs:32`. That caller invokes `qualify-scope6a-package.py` without `--source-mode snapshot` in a package with no `.git`. Its now-correct default Git input policy rejects missing metadata. The same helper succeeds when explicitly invoked in snapshot mode as a separate diagnostic. The failed suite was not retried with edits, hidden Git metadata, environment workarounds or a weakened test. Evidence: `candy-scope6e-v3-work/extract-gate-1.log`, `extracted-followup.json`, `explicit-snapshot-helper.json`, and `blockers.json`.

2. **Ordinary incremental native qualification lacks persisted prerequisite evidence.** The populated witness's exact incremental record references five missing files: native, memcheck, racecheck, initcheck and synccheck qualification JSON. The binary/source/record exist, but production binding also requires those exact evidence bytes. Their absence was recorded; no discovery/runner injection or mock native success was used. Evidence: `candy-scope6e-v3-work/native-preparation-blocker.json`.

No corrective source/test/native/policy edit was authorized or made. This is a final NON-PASS qualification record, not a product fix or a promotion approval.

## Gates that passed

The initial V3 tracked/staged state was clean, with no inherited untracked Scope 6D scripts or install directory. Live origin and local tags/refs matched the requested baseline.

The first hard package gate **passed**: clean and actual populated read-only worktrees produced byte-identical archives from the exact committed implementation/revision and equal `product` root. SHA256 `7a297cf32dfc9b40a627ab1158c0f62dcfe2088f60df990a2a1cf3e80db361f9`; **1,729,529 bytes; 940 entries; 884 files; 56 directories**. All 22 historical untracked scripts remain excluded, despite 555 observed shared checkout LF/CRLF differences. Local qualification/install namespaces and root artifacts are absent; legitimate native source and `candy-runtime/src/artifacts/artifactStore.js` are present. Both independent verifier results are commit-bound to the exact SHA. Both historical blocker classes remain closed. Fresh committed synthetic binary/input/alias regressions passed in the repository full suite.

Fresh repository gates **all passed**: npm ci; **287/287 discovered test files**; lint; build; build:github; production audit **0 vulnerabilities**; git diff --check. See `candy-scope6e-v3-test-results.json` and hashed raw logs.

The archive was extracted to a new directory outside every repository: `C:\Users\tharu\AppData\Local\Temp\candy-scope6e-v3-extracted-gzej6clz\product`. Its npm ci, lint, build, build:github and production audit **0 vulnerabilities** passed. Its required full test suite failed as detailed above; the extracted package is therefore **NON-PASS**. Later independent diagnostics did not alter or replace the failed result.

Fresh extracted Runtime startup, health (200), absent-credential rejection (401), new authentication, authenticated discovery, clean shutdown, fresh restart/session/credentials, stale-token rejection (401), fresh discovery and final shutdown **passed**. CUDA was truthfully unavailable in this Git/evidence-free portable extraction. No old token, pairing file or session was reused. See `candy-scope6e-v3-work/extracted-runtime.json`.

All five exact-SHA remote checks **PASS**: CPU push, CPU pull_request, Ubuntu, macOS and Windows. The prior exact-SHA CI record is reused only as explicitly permitted, with its source SHA256 and run/job/check identities in `candy-scope6e-v3-remote-ci.json`. No earlier-SHA CI was used.

## Integrated gates not qualified

Scope 6A/6B/6C committed repository regression tests passed, including transport/message/URL cleanup, preview/fingerprint/cache/history, FIFO/admission/retention/recovery fixtures and authentication/session revocation. Fixture coverage is reported separately from real native/browser execution.

A fresh Studio/Vite process started successfully and was stopped after the blockers were confirmed. A production live-runtime deployment was attempted using additive archive copies and existing byte-qualified native installation files. Static source/Makefile checkout representation was confirmed to normalize to the same committed blobs, while exact historical qualification bytes were preserved; no existing source file was edited. The qualified deployment could not finish because the five native evidence files were missing. The fresh service did not start; no credential or previous process was reused. Partial additive deployments remain as attempt evidence.

The B5/browser interactive scalability flow, visible end-to-end DynamicHypergraph Analyze/Apply/Undo/Assistant/parser flow, genuine STATIC/INCREMENTAL CUDA execution, integrated abrupt recovery and native long-session soak were **NOT COMPLETED / NOT QUALIFIED**. **Zero genuine V3 CUDA jobs were submitted.** No GPU result, signed-delta correctness, live candidate-vector optimization, long-session retention, browser screenshot or scale claim is fabricated. Available GPU detection alone is not native qualification.

## Security and preserved limits

Package adversarial regression **PASS** and extracted live authentication/restart **PASS**. Full integrated substantive security qualification remains **NOT COMPLETED**. See `candy-scope6e-v3-security-review.md`. **Automated Codex Security completion seal UNAVAILABLE / NOT COMPLETED** under the unchanged historical accepted infrastructure exception; that exception does not waive product findings or missing native evidence. No Codex Security automation was invoked.

Generated Custom Parser code still requires human review; model-generated behavior is not automatically trusted. Public CPU CI is distinct from GPU qualification. Browser scale remains limited to measured/admitted workloads; no V3 B5 or precise heap telemetry claim is made. Persistent native workers remain outside Scope 6 and no protocol was introduced. No native workload beyond its admission envelope is qualified.

## Preservation and stop

Preservation checks passed: 1285 primary tracked files, 401 prior primary artifacts, 981 prior populated artifacts, 1307 populated tracked/script files and 6 populated native/.local files retained exact bytes. Both indexes and all refs are unchanged. Historical 937-vs-941 and 939-vs-961 NON-PASS evidence, corrections, alias/security infrastructure history and prior qualification evidence were not rewritten. Evidence absent before this run was not represented as present.

The fresh Studio was stopped; both extracted Runtime instances closed cleanly. No tag, commit, staging, push, merge or main change occurred. Stop at this NON-PASS report. A separate authorized corrective review and restoration of exact native evidence are required before a fresh integrated attempt can qualify.

