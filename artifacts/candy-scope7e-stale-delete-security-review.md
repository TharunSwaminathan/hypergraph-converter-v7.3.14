# Stale-delete corrective integrity review

PRE-COMMIT / PROPOSED-SOURCE QUALIFICATION

Failed parent `d3eeb5049941ee606b378a8345e41f1d0fbd7636`; exact proposed source digest `b25486cac28f042ab69053f2f233fd5b5d8ce485473681a9057867786405d012`. Manual review PASS: unresolved Critical0, High0, Medium0 for this corrective. **S7E-EXACT-SHA-001 is CLOSED in the proposed delta by executable evidence.** The historical failed commit and its NON-PASS evidence remain unchanged; closure is not claimed on that old commit. Automated security seal **NOT RUN / NOT CLAIMED**; no Codex Security scan invoked.

| Area | Evidence / contract |
|---|---|
| Confused-deputy / stale revision adoption | A reviewed session is pinned to validated discovery revision. Reads and UI reports cannot advance its authority; only validated acknowledgements from its serialized writer do. |
| Foreign-writer advancement / notification loss | Preparation never reads/adopts durable revision. Confirmation re-reads authoritative manifest, rejects mismatch, then leaves native CAS as final transactional enforcement. Native missing-notification regression passes. |
| Same-owner acknowledgement | Project id, safe revision and exact +1 progression are checked. Owner queue permits acknowledged local chat/workspace/memory writes; same-owner confirmation progression passes without a permanent false conflict. |
| Cross-project deletion | Opaque review is tied to session owner, project, category and active-scene key. Existing exact UUID-prefix storage deletion remains unchanged; native B checksum survives A conflict and A deletion. |
| Replayed / double / substituted confirmation | WeakMap-backed object-identity reviews are consumed once before async work. Forged copies, wrong categories and concurrent/replayed calls reject; one successful deletion maximum. |
| Stale asynchronous callbacks | Active generation is checked around authoritative reads and at store deletion request/thread callbacks; atomic abort rolls back queued mutations. Scope switch/disposal tests pass. |
| Malformed persisted lineage / rollback / prototypes | No new persisted ownership data or schema. Existing bounded project validation remains authoritative; rollback/future-manifest tests preserve root. Seed and acknowledgement checks reject unsafe numeric/identity progression. |
| No timestamp or notification authority | No timestamps participate in authorization. BroadcastChannel remains advisory; sticky conflict/reload state prevents silent rebase or destructive auto-retry. |
| Existing execution/memory/model boundaries | Existing7A–7D assertions and all305 tests retained. No Apply/delete/graph replacement/CUDA/parser execution resumes automatically. No model protocol, credential, cloud, native or package-policy change. |

A freshly rerun verified raw failed-parent transactional fixture still reproduces old revision adoption/deletion. The frozen corrective passes12 grouped regressions and10 new native cases, including the exact old-UI7/new-durable8 confirmation scenario, plus unchanged52-case browser coverage. Same-owner source/graph/chat progression and reviewed deletion remain usable.

The baseline8 development dependency advisories (6 moderate,2 high) remain unchanged and are separate from product-review findings; production-only audits are0 in source and extraction. No broad automated seal or physical interruption guarantee is asserted. Commit-bound package production, candidate-bound remote CI and final exact-SHA closure await a reviewed child commit.
