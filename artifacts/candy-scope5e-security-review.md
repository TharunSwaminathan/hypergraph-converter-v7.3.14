# CANDY Scope 5E targeted security review

**Result: PASS.** Final completed scan `13ce71de-772e-46c3-8944-ef2c8bb567c4`, sealed `2026-09-30T15:42:43.876246Z`, has complete coverage of all 12 changed production surfaces, zero findings, no deferred surfaces and zero unresolved High. This is a targeted local diff review, not a repository-wide or deployment security qualification.

The review used the Codex Security security-diff-scan workflow and retained the supplied `artifacts/candy-scope5-security-threat-model.md` unchanged. Root review covered persistence/schema/store/queue; independent read-only reviewers covered App/UI/confirmation/pending and analysis/registry/Runtime paths. Final hashes were rechecked against both reviewers' receipts. All five added tests/fixture and supporting authority/persistence consumers were inspected.

| Threat | Evidence/control | Review outcome |
|---|---|---|
| Persisted graph/update/approval/job/result revival | Explicit schema projection; graph unavailable; actions empty; pendingAction null; fresh volatile owners; raw hostile storage tests | No reachable grant path found |
| localStorage/sessionStorage injection | No new localStorage authority route; pairing credential is only an auth hint; new owner unauthorized until explicit authenticated discovery; denied/injected storage tests | No automatic authority grant |
| Malicious/stale IndexedDB fields | Read and write normalization, schema/record bound, allowlisted references; executable extras dropped | No authority revival |
| Cross-tab spoofing | Independent workspace/controller authority; no BroadcastChannel/storage-event receiver; other-context approvals/results rejected | No receive-to-execute route |
| Reload confirmation/update/result replay | Fresh owner/ledger/registry and unavailable graph; 11 lifecycle recovery states | Rejected |
| Runtime-session replay | Fresh discovery/session, exact binding and epochs; reconnect/session race regressions | Old approval/binding/result stale |
| Same content/new identity | Graph version/identity and update identity/revision remain exact; identical-content tests | Old authority cannot become current |
| Concurrent Apply | Consume-before-await, exact rederivation, live final checks, active session, one aggregate; shared controls test | At most one commit |
| Concurrent Analyze | One current owner, owned one-shot approval, submission/currentness epochs | One current binding |
| Cancellation/late promise | Synchronous local invalidation, best-effort remote cancel, read epoch and registry epoch; dispose/activate tests | No resurrection |
| Unbounded history | Ledger/confirmation caps, single result/job binding, thread quota, coalesced save queue | Bounded policy retained/hardened |
| Secret/artifact leakage | No new model selector/observation/export/thread fields for token, artifact executable selectors or trusted bodies; existing pairing storage remains same-origin credential trust boundary | No new leakage route found |
| Historical model claims | Messages descriptive, actions removed, current observations/owned confirmation required | Claims cannot substitute for authority |
| CPU/STATIC/backend fallback or projection | Unchanged exact qualification/submission policy; full earlier Runtime/contract tests pass | No regression found |

Existing same-origin trusted-script access to the pairing token is an explicit assumption of the existing integration, not removed by Scope 5E. Hostile application script/XSS, Runtime host security and Windows artifact ACL qualification are outside this changed-source review. The review does not claim these deployment assumptions are newly proven.

No reportable candidates survived review, so no vulnerability-specific attack-path or dynamic exploit-validation artifact is applicable. Passing adversarial/race tests provide corroborating evidence; a zero-finding review is not proof of absence of every possible defect.

Final reviewed target: `18fa9aebd7c91b22c7415519a56ec160a88d2956` with uncommitted Scope 5E source/tests. Snapshot digest: `codex-security-snapshot/v1:sha256:9d379d5cf8c614fe591774ad9c161e7776a070df32860fbfe8bad1c9407188f1`. Twelve production hashes and five supporting test/fixture hashes are recorded in the test/qualification evidence.

Canonical sealed artifact directory: `C:\Users\tharu\.codex\state\plugins\codex-security\scans\hypergraph-converter-v7.3.14\18fa9aebd7c91b22c7415519a56ec160a88d2956_20260930T153447Z_xzero9b7`.

| Canonical artifact | SHA-256 |
|---|---|
| `findings.json` | `d67557677e737034fc793575b899c522bac0ad0ced336f78eba30b371357b6f2` |
| `coverage.json` | `af2fb4f4df0a2cda08e84812603ef07416f2087d52626fd2178973c4d178c15f` |
| `artifacts/02_discovery/final-source-hashes.json` | `81bc7b4c3e00e9234cb1feed71060c1a5beb031346c3eac23fb28fabf50de298` |
| `artifacts/02_discovery/review-receipts.md` | `155465bb901f562489f65c6b8e7dcf3d004ede765ead7868429102fde7856c04` |

The original scan `b4ae9aaa-3ce3-4769-96e8-8d2717c8455d` is preserved as completed historical evidence. A failed attempt to seal an incomplete draft was reported and resumed; its later sealed coverage retained an interim pending-worker marker despite completed receipts. It is not used as the complete qualification record. The final follow-up independently reverified the unchanged source, recorded 12 complete surfaces without deferred work and read back the sealed canonical coverage before issuing this result.

Preflight completed with all three capability checks passing; no configuration change was needed. Daybreak access was not granted, an advisory already surfaced during the review; source/test review still completed. The follow-up canonical scan reports no finalization warnings.

Scope 5E test/build/audit gates pass, with 267/267 full test files and 14/14 focused Scope 5 files. Both native directories, Runtime production, manifests, earlier evidence/design and qualified tags have zero delta. No real CUDA execution or Scope 5F live qualification was performed.

Limitations: IndexedDB and independent tab contexts are exercised using transactional storage/controller test doubles, not two visible real browser windows. Actual React persistence and Runtime hooks mount/remount under happy-dom and Vite; this is not a real browser crash/durability test. New direct transition tests cover replacement/clear/type/normal mutation. Parser/custom parser/undo/pending Apply are supported by the common App commit trace and passing earlier Scope 5A/5B/5D/full regressions; no new mounted App matrix is claimed. No real CUDA job or final live application qualification was performed in Scope 5E.

The four repository evidence files were authored after sealing the reviewed source/test snapshot; they contain reports only. Final source/test hashes were checked for drift after evidence creation.
