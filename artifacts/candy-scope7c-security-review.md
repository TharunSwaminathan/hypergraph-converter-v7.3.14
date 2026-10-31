# Scope 7C substantive security review

**PASS — zero validated unresolved Critical/High findings in the complete production delta.** Automated Codex Security seal NOT RUN / NOT CLAIMED. This is a manual source/data-flow review supported by new adversarial tests, the unchanged 7A/7B suites, the complete 298-file suite and native browser evidence. It is not an automated certification or a claim that arbitrary future model text is safe.

| Surface | Reviewed control and evidence |
|---|---|
| Stored instruction/role escalation, approval replay | Separate bounded user-role JSON context, static untrusted-data system contract; memory excluded from action planners, confirmation, pending action and Runtime channels. Hostile text cannot mutate the graph. |
| Unsafe HTML/Markdown | React text escaping; native App hostile img text creates no element. No new HTML/Markdown interpreter. |
| Project/path confusion and cross-project leakage | UUID ownership, exact collection/record/source-link project IDs, project-keyed reads, A/B/A retrieval, foreign-ID rejection; no filesystem paths or executable payload fields. |
| Memory poisoning/provenance spoofing | User/inferred/imported categories remain distinct; workspace/system facts generated deterministically rather than caller text. Verified root/source/graph/content linkage suppresses stale derived claims. Hashes detect corruption, not a malicious same-origin rewrite or cryptographic human origin. |
| Prototype pollution, unsafe deserialization, corrupted/future records | Bounded plain-data validation before field access, strict shapes/enums/IDs, content and envelope hashes; future/corrupt/oversized records rejected intact. Accessor test proves the getter is not invoked. |
| Supersession cycles and contradictory claims | Backward creation-revision link to an owned superseded/forgotten predecessor; cycles/missing links rejected. Explicit type/topic conflict groups excluded instead of model reconciliation. General semantic contradiction detection is not claimed. |
| Stale-tab/forget resurrection, concurrent create/supersede | Shared local writer lineage, global project CAS, exact prior envelope compare, native multi-tab rejection. No timestamp-only overwrite or foreign-tab rebase. |
| Project deletion and late callbacks | Memory/project/thread transaction and existing tombstones; crypto-paused deletion wins, obsolete owner cannot publish a receipt into a new project. Already submitted transactions may finish for the old project. |
| Quota, rollback and premature acknowledgement | Atomic memory/project publication, completion-only receipt; native request → transaction complete → visible acknowledgement; native abort and injected quota retain old collection. |
| Credential persistence | Explicit-only writes; content and topic filters reject obvious credential formats/assignments and transient approvals. Natural memory commands intercepted before chat persistence. Heuristics are not universal secret detection. No authentication headers, service credentials or native secrets are stored by memory code. |
| Retrieval flooding/unbounded growth | 2,000 characters / 8,000 UTF8 bytes each, 100 retained / 32 active / 256 KiB project, 8 retrieved / 2 per category / 6,000 serialized item chars. Whole-record omission is counted; graph/source objects are never evicted to make memory fit. |
| Migration and historical artifacts | Additive database v2→v3 store creation only; current valid 7B graph/root retained, v2 clients fail closed after upgrade. Existing qualified source/evidence and refs verified unchanged. |

No cloud dependency, automatic extraction, auto-reconnect, analytical result archive, automatic continuation or native/CUDA changes were added. No new dependency or package/workflow policy change. Production audit: zero. Full-install non-production advisory output is retained; it is not relabeled a production finding waiver.

Development receipts remain under candy-scope7c-work: initial startup migration/recall ordering failures were corrected and the final frozen source passed; cross-realm and native-abort harness adjustments retain original failures. The drive-alias duplicate-React attempt and package-root policy rejection remain recorded. Final gates use the canonical physical path and unchanged package policy. No historical NON-PASS evidence was rewritten.
