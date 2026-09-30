# CANDY Scope 5D targeted security review

Result: **PASS**. Final frozen source review is complete: 18 changed production files, seven supporting test/fixture changes, zero reportable findings and zero unresolved High.

Applied skill: [security-diff-scan](C:/Users/tharu/.codex/plugins/cache/openai-curated-remote/codex-security/0.1.31/skills/security-diff-scan/SKILL.md). No repository SECURITY.md was resolved. The supplied Scope 5 threat model was preserved exactly (SHA-256 ef6bbf480db34573a2e8b19e1aaada25090c794e25dc8466bc4b0f472534766a).

Final scan: `ae750a68-1c9c-4a3a-bea9-fa02825727c9`
Snapshot: `codex-security-snapshot/v1:sha256:1058802432100fa872a65ddefec3f756d615f83dc9dc740c06ed7ddca017c2cd`
Completed UTC: 2026-09-30T14:54:11.316437Z
Canonical report: [report.md](C:/Users/tharu/.codex/state/plugins/codex-security/scans/hypergraph-converter-v7.3.14/adad84847dac54261f3036dc488c35ed4caef3e7_20260930T145119Z_gm2smd1y/report.md)
Final reviewed production bytes: [final-source-hashes.json](C:/Users/tharu/.codex/state/plugins/codex-security/scans/hypergraph-converter-v7.3.14/adad84847dac54261f3036dc488c35ed4caef3e7_20260930T145119Z_gm2smd1y/artifacts/02_discovery/final-source-hashes.json)

## Coverage

- UI/Assistant confirmation bypass: distinct owned tokens and exact final qualified-owner checks; generic DynamicHypergraph mutation paths blocked.
- Model-crafted authority: closed empty staging schema / bounded ID+revision selectors; original user query planned and positively authorized by the application. No trusted Runtime/update body, path, digest, artifact or credential accepted.
- Stale selector/observation replay: exact current pending match plus state-version re-observation and Scope 5B base/digest/ledger checks.
- Token crossing/substitution/reentry: object identity, separate action types, consume-before-await, owner validation and UI/Assistant duplicate guards.
- Competing panels, rendering and navigation: one private pending owner; old dynamic Batch commit controls suppressed; navigation only selects/scrolls. No automatic lifecycle action.
- XSS/leakage: changed labels/notices render as escaped React text or canvas text; model observations remain bounded. No credential/artifact bytes/native path added.
- Stale delta: live result registry/session/application binding controls currentness; stale result not presented as current.
- Persistence/fallback: no new authority persistence, CPU fallback, STATIC fallback for incremental, or implicit projection.
- Availability: authoring character/operation/incidence bounds plus existing qualified adapters/preflight; unchanged Runtime rechecks remain authoritative.

All production files in the implementation inventory received review. Qualified pending owner, motif analysis owner, registry, preflight, confirmation and persistence consumers were traced where needed. Two read-only source workers divided App/control and Assistant/planner review; parent reviewed remaining surfaces and every test/fixture change.

## Corrective review

The preserved earlier scan `4e4fe4bb-55cd-4a16-b685-e3f96c51a911` discovered a compound Undo exemption. A real typed compound plan could begin with Undo and then edit; generic confirmation remained, but the required pending lifecycle could be skipped. Both final guards now exempt only exactly one Undo operation. Real compiler/source regression and independent final rechecks close this candidate; no unrequested mutation or native capability gain was established.

The earlier status-only Apply approval comparison was also strengthened. Final approval records session and analysis job/status; new analysis staging and all App cancellation routes revoke older Apply approval. Old-token cancellation/new-job tests pass, and a fresh independent Apply remains available. Confirmation consumption linearizes Apply before its qualified digest derivation; cancellation after explicit Apply confirmation is not reuse of a staged token.

The earlier scan was retained with its original snapshot warning. The final immutable follow-up scan above verified all 18 reviewed SHA-256 production bytes, had no source edits during review, and sealed with **no warnings**.

## Evidence and limits

Final full suite: 263/263 files. Focused mounted UI/Assistant and real owner tests: 3/3. Exact selector/token crossing/copy/replay, edit staleness, discard during gated upload, Apply after result, and reentry checks pass. Earlier 5A/5B/5C and 4C regressions remain green.

No new live Runtime/CUDA qualification; existing test fixtures use a test-only oracle. Mixed Undo regression uses the actual compiler plus both final source guard assertions, not a dedicated mounted App mixed-commit test. Broad multi-tab/recovery and final live qualification remain Scope 5E/5F. Native Runtime source, package manifests and historical evidence/tags unchanged.

Daybreak access advisory: not_granted, programs none; [enrollment](https://chatgpt.com/cyber). It did not gate this review.

Measured final follow-up usage: 660,940 total rollout tokens (657,855 input, 645,632 cached input, 3,085 output; 1 thread). Tool-reported rollout usage is not claimed as isolated fresh scan tokens. Earlier corrective review usage is retained in its canonical record.

