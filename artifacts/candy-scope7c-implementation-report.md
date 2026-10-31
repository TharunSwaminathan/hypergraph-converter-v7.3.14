# Scope 7C implementation and pre-commit boundary review

**READY TO CREATE SCOPE 7C PERSISTENT ASSISTANT MEMORY CANDIDATE COMMIT**

**PRE-COMMIT / PROPOSED-SOURCE QUALIFICATION**. No commit or staging has occurred. Baseline/HEAD `b41791766c6042504a8b9fdaa7e677526e7c4fc7`; branch `candy-integration-scope7c-assistant-memory`. Initially clean HEAD, index, live origin branch and peeled 7B tag matched the required baseline before edits. Main, origin branch and all historical qualification tags remain unchanged.

Source digest: `7e7ff0abd407eb8fa43c01f771ec9f54997bfc02085210e35d58c604fed3c8c4` over 1,333 immutable tracked/proposed file paths and physical SHA256 values. The exact proposed product delta is 19 paths (13 new, 6 modified), +565 / -8 lines. Eight additive review reports bring the proposed commit boundary to 27 paths. Temporary work tooling is excluded.

## Implemented behavior

Project-owned envelope/record schema, bounded plain-data and digest validation, explicit provenance/certainty, deterministic workspace facts, CAS mutation APIs, atomic completion receipts, supersession, conservative type/topic conflicts, forget-one/category/clear and project deletion integration. All operations use the existing serialized local project writer without foreign-tab rebase.

The App loads memory after workspace restore/migration completes, retains explicit user context even when derived workspace context is unavailable, and exposes minimal typed remember/inspect/replace/forget controls plus deterministic Assistant commands. Conversation requests receive separate normalized untrusted context. Memory does not enter action planners, Apply, parser execution, Runtime auth or model reconnect. No cloud API or hidden model state is required.

## Qualification

| Gate | Proposed source | Git-free extraction |
|---|---|---|
| Clean npm ci | PASS | PASS |
| Complete suite | 298/298 PASS | 298/298 PASS |
| Focused 7A / 7B / 7C | 4/4; 3/3; 3/3 PASS | 4/4; 3/3; 3/3 PASS |
| Lint / production / Pages / relative builds | PASS | PASS |
| Production vulnerabilities | 0 | 0 |

Frozen-source actual Chrome/App/native IndexedDB: 21/21 cases PASS in a fresh guarded profile, including refresh and graceful process close/reopen. Real manually connected local qwen3:8b accepts a request carrying restored project memory; disconnect retains memory. No automatic reconnect was added. Project A/B/A selection is an API surface, not a polished project-switch UI. Quota fault injection is distinguished from native abort/transaction/version/multitab behavior. No user stored workspace/profile was accessed. Physical restart/power-loss qualification remains 7F.

Substantive complete production-delta security review PASS: zero validated unresolved Critical/High; automated security seal NOT RUN / NOT CLAIMED. No production dependency vulnerabilities. Non-production install advisory observations remain in logs; dependencies were not changed.

Clean/populated snapshot archives are byte-identical: SHA256 `7ac9ad4f1bab108a8f3b5665ce629539a27204de5f6e3a9339f9352991b8b684`, 1,868,498 bytes, 981 entries (925 files / 56 directories). All archive bytes match the frozen physical source inventory, including all 19 corrective paths. The old qualified archive was independently reverified against baseline Git, and read-only Git attribute normalization proves exactly the 19 reviewed canonical blobs differ (Windows checkout CRLF differs physically from old committed LF). Private synthetic memory/credentials/native local state are excluded. All 23 relative-build output files match across frozen and extracted source.

These packages are explicitly proposed-source snapshots, not commit-bound candidate provenance. Exact candidate-SHA package production, commit-bound verification, remote CI and final exact-SHA qualification are DEFERRED until human boundary review and candidate creation. No package/verifier policy was weakened.

## Limits and gap status

Explicit deterministic memory only; no general semantic contradiction detector, automatic extraction, global personal memory or semantic/vector search. Provenance labels are application metadata, not cryptographic human attestations; digest integrity is not malicious same-origin protection. Secret filters are conservative heuristics. Memory retention is bounded; a full retained history requires explicit clear. Corrupt/future collections remain read-only/preserved rather than guessed repair. Forgetting memory does not erase independent chat/model quotes or physical disk remnants.

Native performance measured 32 records, list, bounded retrieval and restart load; detailed actual timings are in retrieval-results.json. Limits are 2,000 chars/8,000 UTF8 bytes each, 100 retained/32 active/256 KiB per project and 8 retrieved/2 per category/6,000 serialized item chars. No arbitrary-scale, browser quota or fsync promise.

S7-09 and S7-10 CLOSED within the deliberate project-memory scope. Remaining 7D model reconnect (S7-12/18), historical motif archive (S7-14), 7E polished Resume/preferences (S7-17) and 7F physical/integrated matrix remain deferred/partial. Full archive portability remains partial. Detailed per-gap statuses are in gap-closure.json; prior 7B evidence is preserved.

## Preserved boundaries and evidence history

1314 prior tracked files, including 408 historical artifact files, retain physical hashes and mtimes. All 37 historical tag objects are unchanged; live main and Scope 7C origin remain at the baseline. Runtime/native/CUDA, graph algorithms, authentication, package manifests, producer/verifier and workflow bytes are unchanged. No staging, commit, tag, product push or main update. No Scope 7D.

Development failures remain under candy-scope7c-work. The startup revision/recall race was fixed before the final freeze; cross-realm, native-abort and async-settings harness failures were corrected without weakening product guards. The drive-alias duplicate-React suite failure was retained and canonical physical-path qualification passed. A baseline-package output inside its source root was rejected by unchanged policy; the prior qualified archive was then reverified independently. No prior NON-PASS evidence was overwritten.

## Exact proposed commit inventory

- `artifacts/candy-scope7c-browser-results.json`
- `artifacts/candy-scope7c-final-inventory.json`
- `artifacts/candy-scope7c-gap-closure.json`
- `artifacts/candy-scope7c-implementation-report.md`
- `artifacts/candy-scope7c-memory-schema.json`
- `artifacts/candy-scope7c-retrieval-results.json`
- `artifacts/candy-scope7c-security-review.md`
- `artifacts/candy-scope7c-test-results.json`
- `docs/CANDY_SCOPE7C_ASSISTANT_MEMORY.md`
- `src/App.jsx`
- `src/agent/modelPromptBuilder.js`
- `src/components/AgentChatPanel.jsx`
- `src/components/AssistantMemoryPanel.jsx`
- `src/persistence/assistantMemoryCoordinator.js`
- `src/persistence/assistantMemoryRetrieval.js`
- `src/persistence/assistantMemorySafety.js`
- `src/persistence/assistantMemorySchema.js`
- `src/persistence/assistantMemoryStore.js`
- `src/persistence/projectSchema.js`
- `src/persistence/projectSession.js`
- `src/persistence/projectStore.js`
- `src/persistence/useAssistantMemory.js`
- `tests/candy-scope7c-memory.test.mjs`
- `tests/candy-scope7c-mounted.test.mjs`
- `tests/candy-scope7c-security-retrieval.test.mjs`
- `tests/fixtures/candy-scope7c-browser.html`
- `tests/fixtures/candy-scope7c-browser.mjs`

All eight reports identify the pre-commit state. Exact byte hashes for all 27 proposed paths, including reports, are recorded in the separate work/proposed-commit-manifest.json; the source/test/doc Git blob IDs are also recorded in final-inventory.json. No work/** file is proposed for commit.
