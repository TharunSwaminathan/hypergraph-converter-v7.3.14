# v7.3.15 substantive release security review

Status: PASS. Exact candidate `335c320a052eab48d3f0c2d309805d10a5918189`. Fresh substantive review found 0 unresolved Critical and 0 unresolved High. Both fresh production npm audits reported 0 vulnerabilities.

Codex Security automated seal: **UNAVAILABLE / NOT COMPLETED — accepted infrastructure exception**. No automated scan/completion/seal was invoked or represented as PASS. No product-security finding was waived.

This is a fresh manual source/behavior review with current exact-candidate evidence, not an automated security seal. The companion used for qualified local native operations is the existing V6 installation; its entire Runtime implementation was verified byte-identical to the candidate before use. Portable extracted Runtime operations used the exact new release archive without private installations.

## Authentication and session authority

No unresolved Critical/High identified. Loopback-only service; 32 random bytes for pairing; length checked timing-safe bearer comparison; exact Origin allowlist is separate from authentication. Session/credential authority is regenerated on Runtime restart.

Source: `candy-runtime/src/auth/sessionAuth.js`, `candy-runtime/src/config.js`, `candy-runtime/src/server.js`.

Current evidence: extracted artifact-route auth controls, ownership isolation and old-token rejection; browser three fresh generations with authority revoked on both restarts.

## Artifact ownership, metadata and percent/path aliases

Only canonical literal sha256:<64 lowercase hex> or a single encoded colon is accepted on the raw request path. No general percent decode or query/fragment alias normalization. The digest is validated independently and metadata lookup is session-owned in memory.

Source: `candy-runtime/src/server.js`, `candy-runtime/src/artifacts/artifactStore.js`, `src/candy/artifactPresence.js`.

Current evidence: 36 malformed raw route spellings rejected; positive literal, %3A and %3a succeed; wrong auth/origin/method/isolation controls; browser reuse GET encoded metadata 200 without duplicate upload.

## ZIP traversal, aliases, modes, symlinks and provenance

Producer and independent verifier derive pinned committed membership/content separately. Raw path components are checked before normalization; orig_filename is examined; unsafe paths, duplicate/case collisions, symlinks/special entries and unsafe modes are rejected. Git-free checks remain structural-only; default producer refuses ancestor Git metadata.

Source: `scripts/package-portable-source.py`, `scripts/verify-portable-archive.py`, `docs/PORTABLE_LOCAL_INSTALL_POLICY.md`.

Current evidence: clean/populated archives byte-identical and independently commit-bound to candidate; adversarial alias/extraction and source-input suites passed; structural-only versus commit-bound behavior explicitly checked.

## Local-install leakage and qualified native identity

Private .local/native build/install namespaces and root artifacts are excluded from portable source. Exact records/evidence/source/makefile/binary hashes, protected native tags and live GPU/toolchain identity are checked by production discovery; pure JSON parsing cache confers no qualification authority. Native launch uses fixed trusted paths, shell:false and bounded supervisor handshakes/termination.

Source: `candy-runtime/src/capabilities/motifQualification.js`, `candy-runtime/src/capabilities/qualificationJson.js`, `candy-runtime/src/backends/nativeProcessRunner.js`.

Current evidence: 18 qualified inputs retained exactly; both production backends AVAILABLE with expected fingerprints; portable explicit STATIC/INCREMENTAL requests fail BACKEND_UNAVAILABLE; CPU/projection substitutes rejected; 64 genuine native jobs across smoke, cross-check, browser and soak; no rebuild/substitution/fallback.

## Stale job/result authority and restart/recovery

Exact graph/update/session/request/job/result bindings and epochs gate result acceptance. Analysis carries no Apply authority. Owned roots use a kernel lease and restricted marker/regular-file cleanup; persisted files are not adopted as fresh session authority. Default retention/count/byte budgets remain enforced.

Source: `src/candy/motifAnalysisController.js`, `src/candy/motifResultRegistry.js`, `src/candy/motifWorkflow.js`, `candy-runtime/src/jobs/jobManager.js`, `candy-runtime/src/artifacts/ownedRoot.js`.

Current evidence: separate browser Analyze/Apply, all-bin parity, stale approval disabled after abrupt restart; 40 native S1 jobs/520 uploads, max 32 jobs and 512 artifacts, completed workspaces zero; clean/abrupt recovery rejects old auth/artifact/job/result handles and cleans owned orphans.

## Credentials and secrets

No credential candidates from the bounded common-key/private-key scan of all 885 release members. No generated pairing credential or private native state enters the archive. Logs omit bearer headers; transient browser pairing file removed on shutdown. This pattern scan is supporting evidence, not an exhaustive secret-detection guarantee.

Source: `scripts/package-portable-source.py`, `scripts/verify-portable-archive.py`, `candy-runtime/src/auth/sessionAuth.js`.

Current evidence: archive independent forbidden-member checks issueCount 0; all 885 files scanned for common credential/private-key formats; 0 matches; fresh production npm audit 0 in source and extracted product.

## Limits

Local operator filesystem and qualification-record authority remain trust boundaries. Native workloads stayed within the previously qualified S1 envelope. No cloud/public-CI GPU or broader-scale assurance is claimed.

Source hashes, surface-by-surface observations and supporting scan details are retained in the companion JSON. Historical Scope 6E findings, NON-PASS records, interrupted tooling and accepted exception records remain unchanged.
