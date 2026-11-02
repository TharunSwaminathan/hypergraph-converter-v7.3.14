# Scope 8C readiness and scope-definition audit

Decision: **Standalone Analysis History Portability** is the recommended single primary Scope8C. Independent history storage already supports history-only saved/Resume state, but current full-workspace export refuses a missing root (src/persistence/projectStore.js:423). This is a useful foundational persistence/portability capability gap, not a newly discovered product security failure. Minimal truthful history category and retention disclosure supports that objective. No confirmed high-safety prerequisite superseded it.

## Baseline and audit integrity

Initial pin UTC: 2026-11-02T03:31:46Z. Worktree `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.15-scope8c`, branch `candy-integration-scope8c-readiness`. HEAD, local main, origin/main, origin/readiness and peeled predecessor tag all `4237de4c768daa98f81536423e9bf6ff787f09ce`. Live origin main/readiness/tag matched. Annotated predecessor tag object `20f100a0469a1919abdc21f333ec970843c45998`. Initial tracked/staged modifications: none; initial unrelated untracked audit files: none. Raw identity pins all1437 tracked physical files (SHA256/bytes/mtime), all local refs and live remote main/readiness/all tags. Final protection check is in final-inventory.json and work/final-protection.json; no ref fetch/update or source rewrite is needed.

The main checkout's unrelated old untracked Scope6 tooling was not touched. The 8B failed candidate remains historical NON-PASS; no existing qualification evidence or tag is altered. This audit verifies identity, not predecessor qualification execution. No product/test source modifications, implementation, staging, commit, tag, merge, main update, Scope8D, services, browser/model/native execution, builds, test execution or automated scan occurred.

## Gap selection and ranking

**11 confirmed capability/UX/operability/documentation gap families: 0 Critical / 0 High / 1 Medium / 10 Low.** These are product-priority classifications; deferred feature wishes are explicitly not defects. Confirmed security vulnerabilities from this scoped source review:0; this is not a whole-product zero-vulnerability certification. G01 is primary, G02 supporting UI. G03 retains intentional replay/retention policy; G10 preserves fail-closed corruption handling. No corruption or exploitable admission failure was demonstrated.

| Rank | Gap | Priority | Disposition |
| --- | --- | --- | --- |
| 1 | G01 Standalone history portability | Medium | 8C primary |
| 2 | G02 History lifecycle visibility/disclosure | Low | 8C supporting UX |
| 3 | G03 Retention occupancy and management | Low | deferred except explicit limits disclosure |
| 4 | G06 Richer inspection/filter/search | Low | deferred |
| 5 | G07 Deterministic rerun comparison/link | Low | deferred |
| 6 | G10 Corrupt-history salvage workflow | Low | deferred |
| 7 | G05 Editable notes/labels | Low | deferred |
| 8 | G04 History pinning/favorites | Low | deferred |
| 9 | G08 Cross-revision result comparison | Low | deferred |
| 10 | G09 Additional analysis families in history | Low | deferred |
| 11 | G11 Startup/native documentation discrepancies | Low | deferred |

The JSON register records current/desired behavior, exact supporting source/tests, all seven requested impact dimensions, future blockers, closure and seven ranking criteria for every gap. Correctness/safety comes before attractiveness; portable data escape has high dependency/user value with a bounded testable extension. Pinning, notes, comparisons and more families would require larger schema/authority/retention decisions. A currently rejected corrupt envelope does not justify weakening validation for salvage.

## Proposed contract at a glance

Preferred future branch `candy-integration-scope8c-history-portability`; separate future worktree `hypergraph-converter-v7.3.15-scope8c-history-portability`. Retain readiness branch evidence-only. Proposed boundary is6 product files +6 test/fixtures +1 doc, exactly13 expected paths in proposed-scope.md. Existing algorithms, history schema/coordinator, full workspace codec, memory/model, Runtime/native/CUDA, workflows, launchers and package verifier remain protected dependencies.

Independent new bounded canonical history-only wirev1; **no DB migration** (v5), history schema1 or workspacev1/v2/v3 changes. Import new project only, private staging, fresh local owner, rebased IMPORTED/unverified records, atomic oncomplete receipt, shared caps and duplicate lineage protection. Never restores Apply, destructive review, graph/parser/native/CUDA/model authority or automatic rerun. No source/graph/memory/chat/model/credential transfer. History can contain sensitive result labels, disclosed before explicit export.

Qualification plan covers A-Z, full/focused source/extracted suites, production/Pages/relative builds, zero-vulnerability production audit, exact frozen blobs, candidate-bound CI/complete merge-tree equality, fresh commit-bound reproducible package and independent hashes, manual scoped security and protected history. Baseline discovery is312 test files; **none executed by readiness**. Native browser matrix:36 planned groups, including isolated profiles/file handoff/restart, CAS/destructive races, quotas/versionchange, Resume and authority counters; doubles and injected faults separately labelled.

Actual qwen3:8b **required in future implementation qualification**: project switching/Resume touches restored context; imported project cannot inherit A memory/history instructions, A recall remains intact on return, fresh model verification and durable OFF respected. **LIVE CUDA EXECUTION NOT REQUIRED / NOT CLAIMED**. Automated security seal: **NOT RUN / NOT CLAIMED**.

## Evidence inventory and deferred work

Seven additive untracked audit outputs: this report, current-state.md, gap-register.json, proposed-scope.md, threat-model.md, qualification-plan.md and final-inventory.json, all prefixed `artifacts/candy-scope8c-`. Supporting tools/raw pins and independent review stay under `artifacts/candy-scope8c-work/**`. Inventory provides exact paths, bytes, physical SHA256 and canonical Git blob identities; self-hash is retained in separate work/final-evidence-receipt.json to avoid recursive inventory hashing. They are audit evidence, not a candidate source receipt.

Deferred: pinning/favorites, editable notes, richer search/inspection, retention management, deterministic semantic/rerun and cross-revision comparison, new analysis families, corrupt-history salvage and independent docs maintenance. Cloud sync/cross-user authority/credentials/automatic execution are not justified immediate work. Implementation and its eventual exact-SHA qualification have not begun.

READY TO FREEZE SCOPE 8C IMPLEMENTATION CONTRACT
