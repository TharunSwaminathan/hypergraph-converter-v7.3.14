# Scope 8B diff-check corrective qualification

NON-PASS — SCOPE 8B DIFF-CHECK CORRECTIVE BLOCKED

**PRE-COMMIT / PROPOSED-SOURCE QUALIFICATION**. Failed candidate `2d5ae411dfe3dcff73dde18ab0197d22b8cf2fe6` remains immutable and **NON-PASS for promotion**, even though its GitHub CI jobs passed as reported by the user. This corrective does not retroactively qualify that SHA. PR #19 was observed closed, Draft and unmerged, with one commit and36 paths, head equal to the failed candidate and base equal to qualified Scope8A `f1e040e90764eac925d04c78d734a884dc4cd6cc`.

## Reproduction and one-byte correction

The user reported that `git diff --cached --check` emitted:

```
tests/candy-scope8b-adversarial.test.mjs:78: new blank line at EOF.
```

PowerShell then threw `STOP: staged diff check failed.` The user reports execution was manually continued and the candidate committed/pushed. This report preserves that event and the old evidence without changing their claims in place.

The same exact Git whitespace diagnostic was independently reproduced **without staging** with:

```
git diff --check f1e040e90764eac925d04c78d734a884dc4cd6cc 2d5ae411dfe3dcff73dde18ab0197d22b8cf2fe6
```

Exit code:2; exact stdout matches the reported file, line and message. No current-index `--cached` failure is fabricated: the real index is empty. Both the corrective-only `git diff --check HEAD` and the corrected cumulative `git diff --check f1e040e90764eac925d04c78d734a884dc4cd6cc` returned0.

The existing working-tree correction was present at task start and was verified rather than replaced. Canonical Git bytes change from11,554 to11,553 by removal of exactly one terminal LF; all preceding bytes, including the final statement, are identical, and one final newline remains. Before SHA256:`f3bdc0233af933b5d3112c959bda8969bb237c039ab08cca01151a7629bafc8a`; after:`6fc0a1c014387e1f2b7bef9ddeb4f2ec89a0c32a2053c7d34ddd90128804dd88`. Corrected Git blob:`f946068c0facaae7d9a5f542e8a65416209d35be`. Physical checkout hashes/line endings are separately recorded in the inventory.

The earlier working-tree diff check covered tracked modifications while the newly added adversarial test was still untracked. The proposed-source inventory did include its bytes, but the gate did not exercise the future added-file EOF condition. This additive corrective explicitly checks the cumulative Scope8B diff, validates untracked corrective evidence with Git's no-index whitespace checker and rejects multiple final newlines. It does not rewrite the old report or represent the old failed candidate as PASS.

## Parent, boundary and frozen source

Qualified Scope8A → failed Scope8B candidate → **proposed corrective child**. Parent of the future child must be `2d5ae411dfe3dcff73dde18ab0197d22b8cf2fe6`. No child SHA has been minted. Branch:`candy-integration-scope8b-analysis-history`; HEAD/origin branch remain the failed candidate. Main remains qualified Scope8A.

The child review boundary is exactly:

- `tests/candy-scope8b-adversarial.test.mjs` — remove one blank EOF line; no executable changes.
- `artifacts/candy-scope8b-diffcheck-corrective-report.md` — additive evidence.
- `artifacts/candy-scope8b-diffcheck-corrective-inventory.json` — additive inventory.
- `artifacts/candy-scope8b-diffcheck-corrective-results.json` — additive results.

Cumulative Scope8B boundary from Scope8A:39 paths, consisting of the same25 product/test/doc paths and11 untouched historical evidence paths, plus3 new corrective evidence paths. Frozen executable-source qualification covers all1,431 committed files plus the one-byte test correction; snapshot SHA256:`4e8d9c41644bb00eac2a8fa4f2f07eee681b94643705be9e795a9569399a6a37`. All1,430 other committed blobs are byte-identical. The three final evidence files are additive data written after gate execution and excluded from the source ZIP by unchanged policy; their identities are frozen separately. Full39-path hashes and Git blobs are in the inventory/external boundary receipt. Temporary tooling/raw proof remains under `artifacts/candy-scope8b-work/**` and is excluded.

## Fresh qualification

|Gate|Frozen corrected source|Fresh Git-free extraction|
|---|---|---|
|Clean npm ci|PASS|PASS|
|Full discovered test files|312/312 PASS|312/312 PASS|
|7A/7B/7C/7D/7E/8A/8B focused files|4/4,3/3,3/3,3/3,4/4,3/3,4/4 PASS|4/4,3/3,3/3,3/3,4/4,3/3,4/4 PASS|
|Lint|PASS|PASS|
|Production/Pages/relative builds|PASS/PASS/PASS|PASS/PASS/PASS|
|Production audit|0 vulnerabilities|0 vulnerabilities|

Fresh native Chrome/actual IndexedDB groups:23/46 completed and passed. Native run status: native-additional PASS, native-history BLOCKED, native-8a NOT RUN. Actual qwen3:8b continuity: **BLOCKED — required existing local Ollama/qwen3:8b service unavailable; no earlier evidence substituted**. Earlier proposed-source and failed-candidate CI/browser/model evidence is not substituted for fresh corrective execution. Detailed case names, source binding, process-stop receipts and actual-model request records are linked by SHA256 in results.

Fault-injected write failures and crypto delays remain explicitly labeled. Browser kills and transaction boundaries are actual native events. STATIC/INCREMENTAL motif observer tests use declared transport/result doubles; no fresh live GPU qualification is claimed. All guarded browser fixtures/fault hooks remain absent from final production assets. The full test runner creates three ordinary untracked NLU report outputs under extracted artifacts; all974 extracted archive payload files remained unchanged. Those generated test reports are not package members or product modifications.

## Archive

SHA256:`603cd970ec9d1fb22e8a24afccb0707934e140ea486b586c48d85cb51a455d0d`. Bytes:2,039,924. Entries:1030 (974 files,56 directories). Clean/populated packages are byte-identical. Unchanged producer uses explicit snapshot mode; unchanged verifier reports structural-only. Independent verification matches exact frozen inventory/payload SHA256, permissions, safe paths, CRC and extracted bytes. No commit-bound provenance is claimed. The corrected archive uses a distinct corrective project-root name; archive identity is not inferred from earlier proposed ZIPs.

## Security and protected history

Manual scoped security review:PASS; unresolved Critical0/High0/Medium0. The correction removes no assertion, changes no executable token and introduces no attack surface. Product source, dependency declarations/locks, workflow, Runtime authentication, STATIC/INCREMENTAL and no-fallback/no-implicit-projection boundaries, model reconnect/memory rules, parser/Run/Apply and package policy are unchanged. Fresh suites re-exercise the full strict history corruption/CAS/replay/authority/portability checks. Automated Security seal:**NOT RUN / NOT CLAIMED**.

Protected history:PASS. Failed candidate, all local and live remote branch/main/tag identities, v7.3.15 and Scope7/8A tags remain unchanged. All1,431 tracked physical files retain their task-start SHA256/mtime (the requested correction was already present then), including the11 prior Scope8B evidence files. The failed candidate is still a direct child of Scope8A and is not amended/rebased/replaced. No existing PASS/NON-PASS evidence was edited. No staging, commit, push, tag, merge or main modification occurred; no Scope8C work was started.

## Decision boundary

The first remaining blocker is current actual local Ollama/qwen3:8b availability. Native/model-dependent closure is incomplete and no promotion readiness is issued. Product-source correction and independent repository gates passed, but the mandatory actual-model/native gates were not waived. No commit may be created on the strength of this NON-PASS record.

Hard stop before staging/commit/tag/main promotion.
