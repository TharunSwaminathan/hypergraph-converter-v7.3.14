# Scope 7F final manual security review

Baseline: `1d4c3b0659e39ae015f8e85888a1f0f68b14cecf`.
Result: PASS within the requested crash-recovery/persistence review scope.
Unresolved Critical: **0**. High: **0**. Medium: **0**.
Automated security seal: **NOT RUN / NOT CLAIMED**. Codex Security was not invoked.

| Threat / invariant | Evidence and result |
| --- | --- |
| Crash-recovery confused deputy; foreign project adoption | Native project identities/digests verified after every process restart; independent B retained during A failures and both renderer crashes. Mounted Start Fresh creates a separate project and retains A. PASS. |
| Replayed mutation authority; stored prompt injection | Mounted actual-app restart retains data while `pendingAction` remains null; unsent destructive request not published or executed. Thread schema projects actions to empty arrays and pending authority to null. Real qwen receives only bounded `untrusted_context_only` recall. Focused 7A/7C/7E authority/poisoned-data tests rerun. PASS. |
| Transaction rollback / acknowledgement confusion | `projectStore.transaction` resolves only on native `tx.oncomplete`. `usePersistentWorkspace`, memory coordinator and storage coordinator await it before successful receipts. Native before-root/during-root crashes roll back; post-complete/pre-receipt kill restores the whole new root; mounted UI quota never claims Saved and prior root survives. Acknowledged native/UI roots survive. PASS. |
| Orphan object activation | Valid unreferenced object injected into native store stays orphaned across restart and never changes authoritative root. Next normal publication applies unchanged retention policy. PASS. |
| Stale root resurrection; stale writer/delete | Native session/strict CAS reject surviving old tab's save and destructive review after another tab crashes. Mid-publication renderer crash aborts; surviving current owner can commit. Frozen pre-confirmation operation never replays. Sticky conflict survives process restart. PASS. |
| Revision rollback / future revision / corrupted ownership metadata | Existing project/root/object validators retain exact schema, ownership, monotonic CAS and root/publication checks; focused 7B and corrective 7E future revision, bad receipt, digest and foreign ownership tests rerun. Actual native source/graph digests revalidated after restart. PASS. |
| Prototype pollution / oversized / malformed records | Unchanged `boundedCopy`, bounded schemas and hash validation reject unsafe keys, accessors, exotic objects, corrupt/future/oversized input; committed security regressions rerun. Native missing current graph yields read-only partial recovery; older retained graph checkpoint verifies. No fabricated full recovery. PASS. |
| Stale model callbacks / secret persistence / origin widening | Unchanged generation cancellation and fresh profile/probe checks; focused 7D late callbacks/manual OFF pass. Actual service outage exhausts four attempts without false Connected. Actual service restart re-probes and real qwen request succeeds. Credential-free local endpoint/schema allowlists and origin policy unchanged. PASS. |
| Test hook exposure | All interruption tooling, prototype wrappers and guarded test page exist only in untracked `artifacts/candy-scope7f-work/**`, never production modules. Fresh commit-bound archive matches qualified Scope 7E archive byte-for-byte and contains no Scope 7F hook/tooling. PASS. |

No product, schema, algorithms, native/CUDA, Runtime, workflow, package policy or model behavior was changed. No automated security seal is inferred from manual review or test success. Findings would be blocked if a Medium threatened persistence correctness; none was found in this review.

Limitations: no machine power removal, OS crash or full physical disk/quota exhaustion. Process/renderer crashes, actual service stop/restart, injected native abort/quota, orphan and missing-object cases are explicitly separated. Default browser IndexedDB commit/durability semantics are preserved; this report makes no device power-loss/fsync guarantee.
