# Scope 6E V6 substantive integrated security review

PASS. Exact product commit `51e8a46ad527760b838bd92e78e19404d07acf40`. Recorded UTC 2026-10-28T21:11:40.765700+00:00.

Substantive product security qualification PASS under the accepted security-infrastructure exception; Codex Security automated completion seal UNAVAILABLE / NOT COMPLETED.

Fresh manual source and live-boundary review found 0 unresolved Critical, 0 High, 0 Medium and 0 Low issues in the reviewed integrated scope. No product-security finding is waived. This is not an automated security seal or an exhaustive repository scan. Codex Security was not invoked.

| Boundary | Fresh evidence and conclusion |
|---|---|
| Runtime auth/session | Loopback-only configuration; 32-byte random bearer credentials; constant-time comparison; origin allowlist; auth precedes metadata/job/result access; bounded request/admission controls. Fresh 401/403 controls passed; clean/abrupt restarts rotated sessions and credentials. |
| Artifact ownership/metadata | Canonical lowercase SHA256 IDs, in-memory presence before access, owned regular-file/realpath checks, bounded immutable stores and leases. Literal colon and `%3A`/`%3a` alone are accepted; no generic URL decode or alternate path authority. Fresh 36 raw adversarial routes rejected; absent artifact versus unknown route distinguished. Cross-Runtime credentials/store isolation passed. |
| Artifact reuse | Real browser public client emitted encoded metadata GET 200 with no intervening upload on repeat analysis. Fresh extracted eviction re-uploaded exactly once; auth/origin failures did not become false eviction uploads. |
| Portable source/provenance | Fresh clean/populated archives independently commit-bound to the exact SHA and byte-identical. Private records, native executable installs, versioned installation namespaces, root evidence/tooling, dependencies and untracked scripts excluded. Committed Windows alias/extraction guard regression passed. |
| Native qualification | All 18 source/Makefile/record/binary/evidence inputs pinned and rehashed, protected tags exact, ordinary discovery AVAILABLE. No injected discovery/runner, native rebuild, replacement, qualification regeneration or sanitizer run. Historical CRLF installation bytes preserved; Git LF relationship was compared in memory only and recorded, never normalized during transfer. |
| Scope 6D implementation | Exact qualified source digest and binary retained. Separate C++ OLD and NEW candidate-vector scopes release OLD candidates before NEW construction. Signed delta-only results, backend identity and all 30 bins passed genuine execution; no STATIC/CPU fallback or implicit projection. |
| Stale job/result authority | Production controller/registry checks bind graph, pending revision, request, job, session and result digests; immutable cloned evidence grants no Apply authority. Real browser Apply, reload and both Runtime restart cases revoked old authority; fresh results required fresh confirmations/authentication. |
| Recovery/process boundaries | Owned-root kernel lease and path checks restrict reconciliation/cleanup. Real clean/abrupt Runtime restarts recovered owned files; old handles were rejected. Default 32-job/512-artifact retention held during a 40-native-job S1 soak; zero completed workspaces and zero owned native/supervisor processes remained. Scope 6C fixture fault tests are identified separately from genuine GPU evidence. |

Assumptions: the operator controls the qualified local installation and its protected Git authority; no hostile local administrator or forged operator installation is treated as an untrusted HTTP principal. Browser runs used the unmodified committed Studio with its normal Vite server and explicit Runtime feature flag; no application instrumentation transform or fabricated native result. Native execution scale was bounded S1/taxonomy fixtures within the existing qualified admission envelope. Restarts were exercised while completed results/approvals existed; no claim is made for an in-flight GPU crash-kill experiment.

Reviewed source blobs and hashes: `candy-scope6e-v6-work/security-reviewed-source.json`. Live evidence: preflight/discovery, package, extracted, native STATIC/INCREMENTAL, cross-check, Runtime, browser and soak reports. The accepted exception covers unavailable automated completion/sealing only.
