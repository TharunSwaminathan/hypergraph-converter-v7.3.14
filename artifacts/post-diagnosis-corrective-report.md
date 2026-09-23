# Hypergraph Converter Studio v7.3.14 — post-diagnosis corrective report

Final decision: **PASS**.

All product and security corrective findings D01–D16 are closed. The complete final application suite passed 253/253 test files, lint, the production build, the GitHub Pages build, production dependency audit with zero vulnerabilities, and `git diff --check`. Live qwen3:8b produced two consecutive 13/13 final-valid GraphMutationDraft matrices, and the completed browser workflow passed.

The previously blocked native gate is now closed by the fresh current-tree artifact `post-diagnosis-corrective-live-runtime-requalification.json`, produced by running `candy-runtime/test/run-scope4c-live-qualification.mjs` from normal host Windows PowerShell. Host WSL 2.7.11.0 ran Ubuntu under WSL2 with Node v22.23.1; CUDA execution saw the NVIDIA GeForce RTX 5060 through driver/runtime 13.4. The artifact records `LIVE_RUNTIME_QUALIFICATION_PASS`, seven completed oracle-parity jobs (three STATIC CUDA and four INCREMENTAL CUDA), successful kernel launches and synchronization, authenticated Runtime lifecycle, graph/update binding, result validation, intentional stale/adversarial rejection, a real native timeout, repeated cancellation, and unchanged workspace state. Its 21 failure rows exactly match the harness's expected negative cases; no unexpected native failure is hidden by the summary.

The earlier `Wsl/EnumerateDistros/Service/E_ACCESSDENIED` was specific to the Codex sandbox, not a host WSL/CUDA product failure. No CUDA result was fabricated, historical Scope 4C qualification evidence was not overwritten, and both protected native directories remain unchanged.

## D01–D16 authoritative closure

| Issue | Pre-change reproduction | Root cause | Change made | Permanent tests | Live verification | Security effect | Final state |
|---|---|---|---|---|---|---|---|
| D01 | qwen3:8b failed 9/13 families after repair. | Shared schema required irrelevant fields rejected by the validator. | Exact compact 13-operation schema; aligned planner/prompt; fail-closed validator retained. | Schema-closure and planner tests. | Two consecutive 13/13 final-valid matrices; every family first-attempt valid; no commit. | Model output remains data behind deterministic validation/confirmation. | CLOSED |
| D02 | Invalid first response plus repair timeout exposed only timeout. | Terminal catch replaced prior validation evidence. | Bounded per-attempt validation and terminal failure evidence retained. | Planner invalid-first/repair-failure regressions. | Supplemental control preserves both causes. | Improves audit trail without accepting invalid data. | CLOSED |
| D03 | Timeout and cancellation both became unknown_network_error. | Primitive AbortSignal reasons were not normalized. | Distinct timeout and explicit-cancel classifications. | Fetch-faithful cancellation tests. | Live timeout/cancel controls pass. | Correct provenance; no authority expansion. | CLOSED |
| D04 | “Full” diagnostics stopped after direct success and refreshed connection. | Full/current/reconnect semantics were coupled. | Read-only full mode separated and made comprehensive. | Local-model diagnostic source/behavior tests. | All advertised rows run while connection is preserved. | Read-only probes cannot gain runtime-control authority. | CLOSED |
| D05 | Bridge probe displayed active direct endpoint. | UI formatted active config, not probe result. | Probe transport/endpoint stored and rendered. | Opposite-transport display matrix. | Direct/bridge isolated probes display correctly and preserve active transport. | Accurate endpoint attribution. | CLOSED |
| D06 | Later probes erased earlier rows; export omitted failure evidence. | Snapshot replacement and static-only export. | Bounded sequential evidence plus redacted rich export. | Sequential/history/export tests. | Browser probe sequence and copy/export pass. | Secrets, prompts, uploads, and parser source excluded. | CLOSED |
| D07 | Connect could not recover a disabled assistant. | Visible action was a test-only enabled-state operation. | Explicit Enable -> Connect recovery; diagnostics remain read-only. | Disabled lifecycle/runtime-control tests. | Disabled -> Enable -> Connect -> Reconnect -> Disconnect passes. | Preserves explicit user intent. | CLOSED |
| D08 | One triangle in Statistics was summarized as too large. | All null values mapped to budget-exceeded. | Truthful not-requested/unavailable/too-large states. | Summary/UI semantics tests. | Small graph summary agrees with Statistics. | No authority impact. | CLOSED |
| D09 | No-file/zero-edge parser showed green success and enabled Apply. | UI gated on result existence, not valid nonempty semantics. | Warning/error states; Apply requires valid nonempty result. | Parser/UI semantics tests. | Empty states disabled; valid one-edge result applied to 1H/2V. | Invalid parser output does not appear executable. | CLOSED |
| D10 | `ImportExpression` passed the AST guard. | Walker only handled import-shaped calls. | Dynamic-import forms rejected before Worker creation. | Parser sandbox and scope guards. | Parse-only adversarial probes reject without execution. | Final scan found no residual parser-import finding. | CLOSED |
| D11 | A local endpoint could redirect a POST/body to a second hop. | Only initial URL was validated and redirects followed by default. | `redirect: error` across direct, bridge upstream, and launcher identity paths. | Local-client, bridge 307, and launcher tests. | Loopback 307 fixture confirms no second-hop body. | Final scan found no redirect/locality finding. | CLOSED |
| D12 | Missing required interpretation fields plus extras returned ok. | Hand validator defaulted values and did not close schema. | Recursive strict schema then semantic validation. | Dataset structured-contract closure matrix. | Valid inference succeeds; unknown field rejected. | Extra/prototype-shaped fields fail closed. | CLOSED |
| D13 | Missing required mapping fields plus extras returned ok. | Reference checks did not enforce closed schema. | Required/additionalProperties/type/enum validation before reference checks. | Dataset structured-contract closure matrix. | Valid mapping succeeds; unknown field rejected. | Undeclared patch fields cannot reach mapping authority. | CLOSED |
| D14 | Two same-name files passed, then name-keyed profile lookup collapsed one. | Upload identity and downstream filename identity differed. | Unicode-normalized, case-folded batch-name collision rejection. | Upload-policy duplicate/case tests. | Duplicate `.edge` browser selection rejected; valid upload works. | Removes ambiguous cross-file authority. | CLOSED |
| D15 | Windows UI copied a POSIX-only origin command. | One syntax served every shell. | Distinct labeled PowerShell, cmd, and POSIX commands. | Command-generation tests. | Browser copy controls pass. | No credential interpolation; less unsafe manual rewriting. | CLOSED |
| D16 | Ambient runtimes/fixed 5173 and any HTTP 200 were assumed. | Missing identity/preflight/port-origin handshake. | Executable cross-platform preflight, bridge identity, real Vite origin, wildcard rejection, documented prerequisites, validated custom bridge-port propagation. | Launcher-preflight and connection-manager tests. | Default browser lifecycle plus custom 9123/invalid fallback executable tests pass. | Fixed-loopback URLs and exact origins retained; no private Runtime path embedded. | CLOSED |

The machine-readable closure record is `post-diagnosis-corrective-issue-closure.json`.

## Final qualification

- Baseline and current HEAD: `4a2ca6ca535a4f8d78f6f6d0b61150b6fe9c0302`.
- Branch: `post-diagnosis-full-corrective`.
- Protected tag `post-scope4c-chatbot-ui-corrective-qualified` still peels to baseline HEAD.
- Protected tag `candy-integration-scope4c-runtime-integration-qualified` still peels to `faeca1053f95a61bfe03ac88295c563d32f91969`.
- Tests: 253/253 files passed in 115.9 seconds.
- Lint: passed.
- Production build: passed (257 modules); Vite emitted only its existing large-chunk advisory.
- GitHub Pages build: passed (257 modules); same advisory.
- `npm audit --omit=dev`: zero vulnerabilities.
- `git diff --check`: passed.
- Dependency manifest/lockfile delta: none.
- Protected native-source delta: none.
- Security scan `e2e2375e-d19f-4dee-ae06-399421393e50`: complete coverage, 32/32 rows closed, zero findings/deferred/open questions.
- Live model: Ollama 0.34.2, qwen3:8b, two consecutive 13/13 final-valid matrices, every final family first-attempt valid, no graph commit.
- Browser: completed workflow passes, including upload collision, parser empty/valid states, mapping strictness, graph truthfulness, confirmation safety, assistant lifecycle, diagnostics, and bridge selection.
- Host Runtime/CUDA: passed seven live current-tree parity cases, including STATIC and INCREMENTAL CUDA, plus 21 expected adversarial/lifecycle rejection cases.

All implementation and evidence remain uncommitted. No tag, commit, branch history, or protected qualification artifact was moved or rewritten.
