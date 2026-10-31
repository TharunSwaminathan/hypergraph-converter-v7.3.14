# Scope 8A manual security review

Baseline: `1d4c3b0659e39ae015f8e85888a1f0f68b14cecf`.
Final immutable proposed-source snapshot: `7194025eaa319fad20dc1daa0b948d875f5d735b1711b4f26d444ba6b8f42a99`.
Qualification level: **PRE-COMMIT / PROPOSED-SOURCE QUALIFICATION**.

Scoped manual review: PASS. Unresolved Critical: **0**; High: **0**; Medium: **0**. Automated Codex Security seal: **NOT RUN / NOT CLAIMED**. This is a sequential source-backed review of the Scope 8A delta, not an automated repository scan or an independent delegated assessment. Final execution receipts are in the associated test, browser and corruption/security evidence.

## Boundary and attack paths

Untrusted selected bytes enter `stagePortableWorkspace` in `src/persistence/workspacePortability.js`. Blob size is checked before reading; byte inputs are copied. Magic rejects compressed/foreign containers without inflation or extraction. Bounded JSON, canonical serialization, exact allowed fields, version checks, UUID object paths, unique names, aggregate budgets and exact base64 decoding precede staging. Manifest integrity alone is insufficient: every actual payload is hashed against its verified header, and the existing project/root/graph/source/memory validators check semantic relationships. Current and historical checkpoints use their respective graph/source identities. Hashes provide integrity, not sender authentication.

Staging is a private WeakMap, with only a frozen bounded review handle exposed. Publication preparation copies buffers and resets model intent; mutating a prepared result cannot alter a subsequent publication. Imported IDs/revisions are data provenance, never local writer authority. `projectStore.importWorkspace` mints a local UUID by default, enforces project budgets and duplicate lineage (including tombstones), rejects stale revisions and changed preferences/model records, and writes all categories in a single transaction. Full duplicate lineage is refused rather than evicted. A missing/corrupt original default pointer cannot be silently repaired. Project B remains intact.

Replacement is separately confirmed for the named destination and archive in `WorkspaceExperience`; `projectSession.importReviewed` consumes a one-use owner review and exact local revision. Active project/mount predicates are checked through publication. The replaced owner is invalidated after acknowledgement, fencing pre-import queued saves. Native completion, not object-request success, resolves the receipt. Failure to discover a successfully committed import is reported as committed/reload-needed, never as preservation of the old destination. Abort/quota tests and native browser kills cover both sides of commit.

Only active memory is imported, with local project identity, bounded retrieval, `IMPORTED`/`UNVERIFIED` provenance and no resurrection of forgotten/superseded records. Instruction-like text remains untrusted context, never a role, confirmation or action. Source-reference validity is recomputed against the new root; stale historical references remain stale. Actual qwen3:8b qualification captures the real request and verifies only the permitted imported project memory reaches its untrusted context block.

Portable model metadata is a strict selection/provider/approved credential-free loopback preference. Connectivity proof, callbacks and reconnect intent are excluded. A new installation receives Auto Reconnect OFF and UNKNOWN connectivity; existing global intent, including an explicitly forgotten profile, is retained with CAS. Import/Resume does not connect. The real request follows explicit opt-in and fresh runtime/model verification.

Chat, leases, authorization, pending actions and runtime/process state are not exported. Replacement starts with authority-free chat. Normal Resume clears prior Apply/parser results and pending state in unchanged `src/App.jsx`; it never executes parser code, CUDA, Apply, delete or graph replacement. Imported parser source remains data requiring review/Run/Apply. No cloud fallback or process launcher was added. UI strings use React text rendering; archive labels/paths never become filesystem extraction paths.

## Resource and compatibility findings closed before final qualification

1. **Medium availability:** applying a memory-only secret regex to large source text could backtrack on long whitespace. A bounded child diagnostic timed out (`candy-scope8a-work/secret-scan-whitespace-red.json`). Screening now collapses whitespace only in its temporary scanning copy; raw exported bytes remain exact. The full eight-MiB whitespace regression exercises the fix.
2. **Medium availability:** repeated application metadata references could amplify Blob allocation. A test-only counter observed 1001 allocations from a one-KiB source with 1000 repeated references (`candy-scope8a-work/reference-expansion-red.json`); projecting an eight-MiB source gives over eight GiB of requested copies. No actual out-of-memory attack was run. Each checkpoint now checks at most 156 references and 64 MiB of expansion before materialization; both limits have adversarial regressions.
3. The grouped base64 admission regex overflowed on a valid eight-MiB input. Flat character admission plus exact length/decode/re-encode comparison replaces it; the boundary regression passes without weakening canonical encoding.
4. Historical graph validation initially used current-source references. It now validates against each checkpoint's own graph, with multiple-checkpoint/binary coverage.
5. Qualified saved editor/manual modes `v2h` and `h2h` were rejected by the baseline's letters-only slot regex. The baseline red diagnostic is retained (`candy-scope8a-work/format-compatibility-baseline-red.json`). The exact two-regex change admits digits, preserving the slot structure; all fourteen existing input modes round-trip, including AI Prompt as data without execution. No conversion algorithm changed.

These are closed corrections, not accepted exceptions. Preliminary snapshots and failed harness runs remain retained. The final snapshot alone determines readiness.

## Limits and residual assumptions

The uncompressed format bounds encoded bytes (48 MiB), total decoded object bytes (32 MiB), objects (156), source/graph bytes (8 MiB each), derived bytes (256 KiB), sources (24), checkpoints (5), reference count/expansion and the qualified memory/project/application budgets. Compressed inputs are rejected, not expanded. No automatic signature/trust assertion, cloud synchronization or arbitrary filesystem import is provided.

Recognizable credentials in payloads/metadata are refused, not redacted. No browser-private credentials are read or exported. Arbitrary secrets disguised in user data cannot be identified with certainty; the UI explicitly asks users to review source contents before sharing. A same-origin script or compromised operator already has browser storage access and lies outside this file boundary.

Native evidence uses isolated Windows Chrome profiles and actual IndexedDB, plus guarded test-only timing hooks and actual owned-process kills. It does not claim physical power removal, disk exhaustion or all-browser/platform crash reliability. Mock quota/abort/held-completion tests are labeled separately. Production assets are checked for absence of test guard hooks.

Production `npm audit --omit=dev` must report zero. The unchanged baseline installation also reports eight development dependency advisories (six moderate, two high); those are recorded separately and are not represented as a zero-advisory full dependency audit. No package or lockfile changed.

The final candidate commit, exact-SHA package provenance, remote CI and post-commit qualification remain deferred. No staging, commit, push, tag, main change, automated security invocation or Scope 8B implementation is part of this review.

Final UI continuity review: separate-project import now uses the qualified Cancel-first unsaved-edit review before publication. The final native browser case verifies that cancelling retains uncommitted source text, the selected project and durable root. A guarded write-failure injection creates that unsaved state; the real application and native IndexedDB remain in use. The earlier V5 manual review and threat-model documents remain preliminary evidence and are not the final source identity.
