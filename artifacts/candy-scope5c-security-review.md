# CANDY Scope 5C targeted security review

Decision: PASS. Review complete; 0 findings, 0 deferred candidates, unresolved High=0.

## Final immutable scope

Branch: candy-integration-scope5c-runtime-binding.
Base and unchanged HEAD: 3379e0102704521960a5ccc1185a14a2beb2725d.
Scan ID: 06b37d23-5c5c-4afb-b016-c156a500519d.
Snapshot: codex-security-snapshot/v1:sha256:ab49a2794b716b80e34e5737d1b0150e024a209a670f1e5cf42979980383f515.
Completed/sealed: 2026-09-30T04:27:28.019542Z.
Canonical report: C:\Users\tharu\.codex\state\plugins\codex-security\scans\hypergraph-converter-v7.3.14\3379e0102704521960a5ccc1185a14a2beb2725d_20260930T041232Z_wofpq_ux\report.md

The Codex Security security-diff-scan skill governed the scan, delegated capability preflight and read-only architecture adjunct. Preflight was ready with all three capability checks passing. Supplied artifacts/candy-scope5-security-threat-model.md was retained exactly in managed context and the canonical threatModel summary (17806 characters); the current architecture adjunct did not rewrite it. No applicable SECURITY.md exists.

All 14 changed production files were reviewed with minimum supporting contracts, Runtime consumers, confirmation and persistence code. Canonical coverage is complete: 16 rows represent 14 unique production paths, with two retained checkpoint variants. No discovery candidates were found; candidate-specific validation/attack-path phases were therefore not needed. Final semantic draft, completion and completed-scan retrieval succeeded. No product source changed after the scanned snapshot/final green run.

## Reviewed controls and regression evidence

| Required threat surface | Control/evidence |
| --- | --- |
| Stale result replay; graph fingerprint/type substitution | Live bounded graph ID/version/fingerprint/type and epoch; result registry exact current key; graph-field substitution tests |
| Revision substitution; same updateId/new digest; proposed fingerprint/next version | Exact pending ID/revision/digest/proposed fingerprint/next/status/impact key; newer revision cannot inherit result; ledger rejects late revival |
| Runtime-session replacement | Immediate pair/discovery invalidation, generation guard, exact captured session; restart/reconnect/unmount tests |
| Graph/update artifact substitution | SHA of exact serialized bytes compared to returned upload IDs, immutable refs and Runtime reread hash/length checks |
| Result artifact substitution | Exact SHA rehash of accepted content and bound graph/update/result references; artifact-substitution test |
| Request/native digest substitution | Browser-derived expected qualified packed digest, outer/native equality; replacing both digests and resealing artifact is rejected |
| Job/request/backend/mode/device/taxonomy substitution | Exact authorized identities, fixed qualified CUDA metadata, signed 30-bin invariants and affected-work checks; substitution matrix |
| Stale analysis confirmation replay | Owned object identity, single consumption before await, exact selectors/current key/session and existing TTL; copied/expired/edited/reconnect-stale token tests |
| Analysis/Apply crossing | Distinct action-specific authorities; registry applyAuthority=false; neither analysis nor result calls commit; both crossing directions rejected |
| Graph/pending changes during work | Checks before/after digest/upload/job/poll/download/validation; live getters, epoch and exact key; upload/job/poll/download and supersession race tests |
| Cancel/late result; timeout/late result | Immediate local revocation before cancel await; no dependence on cancellation success; terminal failure clears binding, no automatic retry |
| Oversized browser serialization | Qualified counts/work limits before copies, artifact lower-bound and exact bytes, exact packed size before approval/upload; boundary tests and unchanged lower-layer enforcement |
| Model-crafted Runtime controls | Strict bounded selector keys; graph/update/native/NEW/candidates/path/token/artifact/digest fields forbidden; existing MAX_REACT_STEPS=8 and one-action loop retained |
| Credential/token leakage | Client sends bearer separately to validated HTTP loopback; token stays private; hook state and model observations omit credentials; injected HTTP auth assertion and state nonleakage test |
| Persistence restores authority | Existing thread projection sets graph unavailable and pendingAction null; it does not store controller ledger, approval, job binding or result evidence; fresh owners/session required |
| CPU or STATIC fallback; implicit projection | Exact explicit CUDA mode/backend/device capability and graph type required; unavailable returns typed refusal, never alternate execution |
| Delta/full-count confusion | Signed delta-only total/30 bins, no reconstruction, no graph mutation; Line-Graph Triangles remains separate |

## Effective resource chain

The unchanged browser client targets validated HTTP loopback (default 127.0.0.1:8791); protected routes use bearer auth and Runtime checks present Origin against its allowlist. Pairing retains the existing browser sessionStorage key; no new credential persistence was added.

Runtime artifact refs resolve to strict SHA-256 filenames under its private configured root or OS-temp candy-runtime-artifacts-<random>. Store read rechecks regular-file/path/size/hash/length controls. Its effective stored-artifact ceiling remains 6 MiB even where the generic result default is 8 MiB.

The unchanged Runtime packer rereads exact graph/update artifacts and derives per-job OS-temp candy-job-<random>/request.txt. Fixed qualified binaries reside under the two frozen native directories. Windows uses WSL2 Ubuntu and the fixed supervisor; Linux uses setsid and that supervisor. shell:false, fixed argv, process-group handshake, output/time limits and cleanup-before-terminal acceptance remain unchanged. These are source-established paths/controls, not a claim that a new live deployment was executed.

## Findings, limitations and measured usage

Findings: 0. Deferred security candidates: 0. Unresolved High: 0. No security fix or Runtime/native edit was required.

This is a targeted final production-diff review, not a whole-repository/deployment audit or a guarantee against all vulnerabilities. No new live CUDA qualification was run. Active startup overrides, concrete Linux tmpdir, deployed Windows ACL/WSL isolation and browser CSP were not verified. Local operator-controlled qualification establishes consistency, not publisher authenticity. Scope 5E hardening and 5F final live qualification remain deferred; these are scope/deployment assumptions, not discovered unresolved High findings.

The completion tool reports rollout usage across three participating threads: input 4718935 tokens, cached input 4506752, output 25438 (reasoning output 3078), total 4744373. Source: codex_rollout, coverage complete. These are tool-attributed rollout totals, not claimed as isolated scan-only fresh tokens.

## Qualification relationship

Fresh final gates: focused regressions 28/28 files PASS; full tests 260/260 PASS; lint PASS; production and GitHub Pages builds PASS; npm audit --omit=dev PASS with 0 vulnerabilities; git diff --check PASS. The advisory audit ran outside the sandbox through approved read-only execution. The earlier block was environment/network-policy-specific. No manifests changed.

Entire Runtime/native delta=0, dependency manifests delta=0, older evidence delta=0, qualified Scope 5A/5B tag targets unchanged. No product source changed after the final green run; only four new Scope 5C evidence files followed. Everything remains uncommitted.
