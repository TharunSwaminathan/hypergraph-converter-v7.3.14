# To-Be Chatbot Live Ollama Validation

## Overall result

**PASS WITH MODEL-QUALITY LIMITATIONS**

Application safety passed. The held-out Dataset 07 parser-generation case did not succeed within the existing three-attempt bound. Its failures stayed fail-closed: no valid preview was accepted, no graph was applied, and no graph commit occurred.

## Validation identity

- Branch: `scope2-react`
- Starting qualified commit: `cdaa0b3798bfe14de0e19ca55404bc94facc8bb9` (`to-be-chatbot-final-qualified`)
- Protected Scope 1 commit: `3464a12ab6d420cbaca12e5bf387172f2ac8e379` (`to-be-chatbot-scope1-qualified`)
- Ollama endpoint: `http://127.0.0.1:11434`
- Ollama version: `0.33.3`
- Model: `qwen3:8b`
- Model digest: `500a1f067a9f782620b40bee6f7b0c89e17ae61f686b92c24933e4ca4b2b8b41`
- Digest prefix: `500a1f067a9f`
- Model size: 5,225,388,164 bytes
- Quantization: `Q4_K_M`

The validation used the real Ollama HTTP transport and the installed model. No controlled model response, cloud model, API key, MCP service, or remote endpoint was substituted for the reported live generations.

## Live conversational results

### Basic chat and deterministic routing

The live model correctly explained the difference between an ordinary graph and a hypergraph without inventing workspace state or actions. The deterministic command `Show graph stats` remained on the deterministic fast path and made zero ReAct model calls.

Five representative read-only or negated parser queries stopped read-only with zero actions and zero confirmations:

- `Explain what Run custom parser does, but do not run anything.`
- `For documentation only, explain Apply parser result.`
- `Read this literally: Run custom parser.`
- `What would happen if I ran the parser?`
- `Keep workspace unchanged...`

The representative native UI query also caused no action and no confirmation. Its answer was conservative, although less explanatory than ideal when no active batch was present.

### ReAct orchestration

The first live ReAct response proposed an allowlisted action but used `"userMessage": ""`. The unchanged strict validator rejected it. A second reproduction produced the same result. The retained prompt correction now explicitly requires the JSON literal `null` for `PROPOSE_ACTION`; the next real response complied and validated.

The next multi-step run executed `SET_GRAPH_LAYOUT` and authoritatively re-observed state, but the model then supplied an intuitive, unsupported `graphId` argument to `OPEN_GRAPH_PREVIEW`. The unchanged action validator rejected it. The retained prompt correction exposes a bounded `allowedActionArgumentKeys` map derived from the authoritative capability registry. It does not relax action validation or permit arbitrary arguments.

After both corrections, the real loop completed in three model iterations:

1. `SET_GRAPH_LAYOUT` with `{ "layout": "grid" }`
2. `OPEN_GRAPH_PREVIEW` with `{}`
3. `SHOW_RESULT_SUMMARY` with `{}`

Each action was followed by authoritative re-observation. The passing run used no fallback and stayed within the unchanged eight-iteration cap; the maximum observed live path was three steps. Across the live ReAct and confirmation exercises there were approximately ten real model invocations: seven accepted responses, two empty-string `userMessage` rejections, and one invented-argument rejection. There were no malformed-JSON responses and no invented-action acceptances.

### Fallback behavior

A controlled model-unavailable check used the production orchestration loop. It made one failed model call, returned the bounded deterministic fallback, executed no action, and left state unchanged. Ollama was subsequently confirmed reachable again.

## Custom Parser Specialist results

### Single-file Dataset 08

- Generation status: `ready_for_review`
- Generation attempts: 1
- Repair attempts: 0
- Static/schema/safety validation: passed
- Selected few-shots: Dataset 08 and Dataset 01
- Disposable production Worker execution: passed
- Result: 4 hyperedges, 13 vertices, 14 incidences
- Graph applied: no

This was a successful first-attempt single-file parser case.

### Multi-file Dataset 02

Before generation, unresolved grouping produced the exact deterministic question, `Do all of these files belong to one graph dataset, or should they be treated as separate graph datasets?`, with zero model calls.

For the explicit together-mode run:

- Attempt 1: syntax failure, `Unexpected token ','`
- Attempt 2: bounded repair passed static/schema/safety validation
- Final generation status: `ready_for_review`
- Repair attempts: 1

This case demonstrated the bounded generation/repair workflow. No attempt bound was increased.

### Held-out Dataset 07

Dataset 07 remained excluded from the parser-generation few-shot library. The library continued to contain only Datasets 01–06 and 08; no Dataset 07 filename or schema example was added.

- Attempt 1: generated draft passed static/schema/safety checks, then the disposable production Worker rejected the output because CSV header rows were treated as data and produced a non-serializable `undefined` value at `result.canonicalHyperedges[0].attributes.domain`.
- Attempt 2 (repair 1): static validation passed, but Worker execution failed with `by is not defined` after the repair introduced `const hyperedgesText = by,...`.
- Attempt 3 (repair 2): the `byName` reference was repaired, but the header-row defect remained; Worker execution again rejected the same non-serializable `undefined` metadata value.
- Final status: exhausted/failed after 3 total attempts and 2 repair attempts.
- Accepted preview: no
- Graph application: no
- Graph commit: no

This is a held-out model-quality limitation, not a successful parser-generation result. The application correctly preserved its Worker sandbox, schema checks, safety checks, and three-attempt bound.

## Run/apply confirmation evidence

Real `qwen3:8b` responses proposed `RUN_CUSTOM_PARSER` and `APPLY_CUSTOM_RESULT` with valid empty argument objects. In each live harness case, the production ReAct controller staged exactly one confirmation and executed zero actions before confirmation.

The final native browser upload/click-through sequence could not be completed because the browser-automation sandbox rejected file attachment from both the temporary and workspace paths. Production code was not altered to bypass that restriction. Therefore, this report does not claim that the four native browser Cancel/Confirm click paths executed during this continuation.

The existing qualified deterministic and DOM suites provide the retained confirmation evidence: explicit run/apply requests stage confirmation; read-only, quoted, negated, and workspace-preservation forms do not; cancellation clears a staged action without commit; confirmation performs the staged mutation once and clears it; and failed confirmation staging fails closed. The live model-specific contribution was confirmation proposal and staging before execution, not the sandbox-blocked file-upload click-through.

## Retained source corrections

1. `src/agent/prompts/reactOrchestratorPrompt.js`
   - Requires `userMessage: null` for `PROPOSE_ACTION`.
   - Supplies bounded per-action argument-key contracts generated from `REACT_CAPABILITY_DEFINITIONS` for currently available capabilities only.
   - Keeps the existing strict step and action validators unchanged.

2. `tests/scope2-react-core.test.mjs`
   - Confirms empty-string `userMessage` remains rejected.
   - Confirms an invented `graphId` for `OPEN_GRAPH_PREVIEW` remains rejected.
   - Confirms the prompt states the null and empty-object requirements.
   - Confirms the bounded key map derives the expected empty and non-empty contracts.

No dependency, cloud, MCP, database, capability, confirmation-policy, or iteration-limit change was made.

## Temporary validation cleanup

The following temporary files were removed after their evidence was captured:

- `.live-edge-list.weird`
- `artifacts/live-confirmation-runner.mjs`
- `artifacts/live-heldout-repair.mjs`
- `artifacts/live-ollama-runner.mjs`
- `artifacts/live-react-multistep.mjs`
- `artifacts/live-react-repro.mjs`
- `live-worker-validation.html`
- `live-worker-validation.js`
- temporary extracted/upload fixture content within the repository

No local absolute paths, browser automation helpers, debug logs, temporary fixtures, or test-only production hooks are retained.

## Qualification results

Focused suites passed:

- Scope 2 ReAct core
- Scope 2 ReAct integration
- Scope 2 ReAct adversarial
- Scope 1 persistence/trigger/specialist
- Scope 1 Worker emission/lifecycle
- parser sandbox
- Custom Parser workflow v7.3

Full gates:

- `npm run test`: **PASS**, 228/228 test files (99.1 seconds). The first invocation stopped at 132/228 because `python3` was absent from `PATH`; rerunning with the repository's bundled Python runtime on `PATH` completed successfully. This was an environment issue, not a product/test failure.
- `npm run lint`: **PASS**
- `npm run build`: **PASS**, Vite 8.0.16, 228 modules transformed; existing bundle-size warning only.
- `npm run build:github`: **PASS**, 228 modules transformed; existing bundle-size warning only.
- `npm audit --omit=dev`: **PASS**, 0 vulnerabilities. The sandboxed registry request initially failed; the permitted read-only retry completed successfully.
- `git diff --check`: **PASS** (line-ending conversion notices only; no whitespace errors).

## Final assessment

**Application safety: PASSED.** Deterministic precedence, read-only/negation handling, strict schema and argument validation, bounded ReAct execution, authoritative re-observation, confirmation staging, Worker isolation, and no-commit-on-failure behavior remained intact.

**Held-out model quality: LIMITED.** Dataset 07 failed within the three-attempt bound. The appropriate next improvement would be model/prompt-quality research evaluated against additional held-out data, not weakening runtime safety or adding Dataset 07 to the few-shots.

The qualified commits and tags were not rewritten or moved. This post-qualification tree is intentionally left uncommitted for user review.
