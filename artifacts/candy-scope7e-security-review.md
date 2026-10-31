# Scope7E manual security review

PRE-COMMIT / PROPOSED-SOURCE QUALIFICATION

Baseline: `6bf0f3614987559f93f5c0b7a26d24d976a82ecb`. Source digest: `cb148f605b7d61dac028e57b9d370a8361b62c061af7418c7035efd8e9b3bb15`.

PASS: unresolved product-review Critical=0; High=0. Automated security seal: **NOT RUN / NOT CLAIMED**. No Codex Security scan was invoked. Review covers the exact21 product/test/doc paths, their callers/contracts, retained regression suites and guarded native evidence; it is not a formal or repository-wide automated seal.

| Review area | Evidence and conclusion |
|---|---|
| Cross-project restore/clear leakage | Captured UUID per mounted writer; exact UUID/ object prefix deletion; A/B/A native isolation and untouched Alpha after Beta deletion. |
| Persisted UI/action authority | Preferences allow only safe fields; scene replacement initializes fresh controllers; pending action/null and unsent command tests pass; existing7A–7D authority tests unchanged. |
| Stored prompt injection / memory escalation | Existing bounded7C retrieval treats restored observations as untrusted context; no new prompt or execution/compiler path; actual restored memory delivery and retained adversarial tests pass. |
| Unsafe names / HTML/script injection | Bounded names render through React text/options, no HTML sink; malicious img label remains text in mounted regression. |
| Prototype pollution / malformed preferences | boundedCopy rejects getters/unsafe prototypes/depth/size/extra fields; exact schemas and enums; native store CAS and no semantic guessing. |
| Future-schema downgrade / poisoned startup | Future records remain unchanged/read-only, auto resume OFF, including empty default plus other projects; temporary fresh cannot write project data. |
| Original migration quarantine | Original default project guard remains read-only; scoped fresh projects skip copying old legacy thread and do not inherit its quarantine. |
| Cross-tab overwrite / stale confirmation | Native two-App save/delete rejection; captured revision checked atomically, stale callback generation/key guards, foreign markers do not rebase ownership. |
| Queued preference intent | Local writes serialized; rename computes latest preferences; reload/fresh wait requested writes; gated OFF/naming/reload regression prevents stale full-record overwrite. |
| Destructive category scope | Strict captured project/revision confirmation; workspace clears only source/graph/checkpoints and workspace chat refs; memory/model/other projects preserved. Global model forget remains7D. |
| Partial graph/source safety | Strict restore default unchanged; source-only branch revalidates root/source/derived bytes and publication, never exposes graph or reseals root, keeps owner read-only. Missing source fails closed. |
| Credential leakage / endpoint rendering | New preference shape has no tokens, credentials or arbitrary endpoints; model profile/FSM/loopback validator unchanged; labels render as text; no cloud route or process execution. |
| Automatic mutation / model authority | No parsing/transformation/generation on resume; fresh runtime probe required before Connected; manual model OFF survives restarts; bounded outage recovery uses existing7D state. |
| Malformed/oversized metadata DoS | Existing source/graph/project/application budgets and project80 cap preserved; preference20KB/depth/node caps and16-event diagnostics; bounded failures preserve previous data. |
| False durability / retry loop | Store resolves only on transaction complete; delayed completion, quota and abort doubles reject false Saved; real stale writes show reload; no correctness dependence on unload. |
| Source/graph stale presentation | Compare verified byte digests, not ephemeral IDs; changed input leaves exact graph unchanged and stale; identical bytes under new IDs do not falsely stale it. |
| Protected execution/history boundary | All pre-existing test, Runtime/native/CUDA, agent policy, package/verifier/launcher/workflow and historical evidence files unchanged; retained complete regression suites PASS. |

The unchanged baseline development dependency install still reports8 advisories (6 moderate,2 high); production-only audit is0. Those toolchain advisories are recorded separately and this product-change review does not claim to remove them.

Historical reports/tags remain immutable. No private saved source/graph bytes, Assistant memory records, model connection preferences, secrets or local native qualification state are included in the portable archive. Only synthetic guarded profiles were modified for faults. Physical power loss, forced interruption, integrated restart soak and final commit-bound/remote CI qualification remain deferred.
