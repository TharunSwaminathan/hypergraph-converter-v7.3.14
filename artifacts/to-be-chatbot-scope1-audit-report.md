# To-Be Chatbot Scope 1 audit report

Date: 2026-09-07  
Baseline: `3ae0054d2bf9069e0f1804906cc37f3af415d2d1` (`hypergraph-converter-studio` 7.3.14)  
Authorized boundary: Phase 1 Stages 1–3 plus Phase 2 independent audit/correctives only.

## Result

Scope 1 passes its applicable qualification gate. There are no open Critical, High, or Medium Scope 1 findings. Two Low conservative-workflow limitations remain documented below. Scope 2 / ReAct work was not started.

The attached Custom Parser pack is represented verbatim in `tests/fixtures/scope1-parser-pack.json`. Examples 01, 02, 03, 04, 05, 06, and 08 are approved selective few-shots; dataset 07 is excluded from generation prompts and retained as held-out evaluation data.

## Architecture delivered

### Persistent thread/workspace

- `threadStateSchema.js` defines schema v1 and an explicit data projection.
- `threadStore.js` owns IndexedDB database `hypergraph-chat-threads`, object store `threads`, and create/load/list/save/atomic-append/delete operations.
- `usePersistentThread.js` integrates the default `main` thread at the existing chat-state boundary.
- Bounds: 80 messages, 6,000 characters per message, 2,000-character summary, 1,000,000-character record.
- Persisted workspace data is reference-only: batch ID, filenames/sizes, grouping, detected format, parser source/version/status, up to three draft lineages, and unavailable graph identity/version references.
- File bytes, graph contents, model configuration, action cards, confirmation state, approval state, and execution authority are never restored.
- Restored files are marked `requiresReupload`; parser/draft source is historical and `requires_review`; graph `available` is forced false; `pendingAction` is forced null; message actions are stripped.
- A real subsequent upload supersedes stale recovery references. Storage failures are visible and do not disable the unsaved session.

### Deterministic trigger matrix

| Condition | Deterministic outcome |
|---|---|
| No files, explicit request | `needs_files` |
| Confident known built-in format | Existing built-in route (`builtin`) |
| Ambiguous potentially supported input | `clarify_format` |
| Unsupported/unknown single input | `specialist`, one together group |
| Explicit positive generate/create/write/build parser request | `specialist`, even when a built-in format exists |
| Multi-file custom input, grouping unknown | Exact deterministic together/separate question |
| Multi-file, together confirmed | One specialist group over the complete input set |
| Multi-file, separate confirmed | One independent specialist group per input file/child dataset |
| Existing pending action | `blocked` until resolved |
| README/expected-output sidecars | Excluded from parser input groups |
| Explain/inspect/quoted/negated/hypothetical wording | No specialist mutation transition |

### Specialist lifecycle

`idle/clarify/awaiting_grouping -> analyzing -> generating -> static_validation -> awaiting_clarification | ready_for_review -> awaiting_run_confirmation -> existing confirmation -> running_and_validating -> repair_needed | awaiting_apply_confirmation -> existing apply confirmation -> completed`, with bounded `failed` and `stale` exits.

The specialist accepts no runner or graph-commit capability. It emits only schema-, AST-, filename-, and safety-validated source. It makes at most three total model generation/repair attempts per lineage. Draft adoption opens the existing Custom Parser Studio. The existing `runCustom` Worker path remains execution owner, and the existing `applyCustomResult` path remains graph-commit owner.

The specialist-only request adapter accepts narrow complete positive forms such as `Run custom parser` and `Apply parser result`, checks existing positive authorization scopes, and stages the existing confirmation copy/dispatcher. It neither executes nor confirms. Generated source also has an authoritative runner-side specialist binding check, so stale or unbound source cannot run even after confirmation.

## Prompt/template integration

- Approved template version: `custom-parser-template-v1`.
- Seven verbatim supplied examples are indexed deterministically; selection normally returns one to three examples based on dataset traits.
- Held-out folder 07 is absent from the example registry and system prompt.
- Prompt limit is 30,000 characters; file count is 1–10; samples, profiles, relationship evidence, user intent, previous source, and repair errors are individually bounded.
- System content contains policy/template/examples only. Filenames, cells, comments, headers, metadata, relationships, and parser errors are serialized into the user message as untrusted data.
- Conversation and summary policies now state that authoritative workspace state overrides stale text and that intentions/confirmations may not be rewritten as completed history.

## Phase 2 corrective findings

### Critical

None.

### High — all fixed

1. Emitted Worker source was invalid in a real browser because nested source strings were not safely serialized and strict-mode `eval` was used as a formal parameter. The function body is now JSON-serialized and the invalid formal removed; the existing scanner/resource limits remain unchanged.
2. `Run custom parser` was consumed as read-only by the older broad router, making the approved specialist confirmation transition unreachable. A specialist-only exact positive adapter now stages the existing confirmation path before broad routing.
3. Worker completion could publish a result/error after source, files, batch version, mapping revision, or parse mode changed. Execution snapshots now discard stale completions.
4. Separate-mode child adoption could lose specialist lineage. Adoption now transfers the same bounded lineage to the created child batch.
5. Failed specialist generation could be reported as overall success. Failure now short-circuits truthfully.
6. The assistant composer could remain busy after the model coordinator settled. Committed coordinator/specialist state now reconciles busy state.
7. Repair could consume an unrelated parser error or changed source. Repair now requires the installed lineage's exact source/binding and its own non-empty runtime error.
8. Concurrent message appends used a read/write split. `saveMessage` now performs the read-normalize-append-write in one IndexedDB transaction.
9. A later custom-format upload could clear the old specialist binding while retaining generated source. Confirmation readiness and the existing runner now require a current `specialist-*` batch binding.

### Medium — all fixed

- Custom-result verification could race React state and report a false failure; bounded result-ID polling now verifies the committed state.
- A generated parser returning zero hyperedges could leave a misleading preview; it now clears the result and records failure.
- Restored missing-file references could survive a real replacement upload; the recovery projection now yields permanently to current workspace state.
- Repair relationship evidence omitted exact participating columns; bounded exact column evidence is now included.
- Specialist UI status did not reflect run/apply lifecycle; states and controls now reflect the installed parser result.
- Repeated restoration could rewrite bounded message IDs; original bounded IDs are retained.
- A late IndexedDB success after `onblocked` could leave a handle open; it is closed.

### Remaining Low

1. Whole-thread snapshot saves are serialized within one app instance, but two simultaneously open dashboard tabs remain last-writer-wins for whole-state saves. The store's atomic `saveMessage` API is safe; no cross-tab merge protocol was added in Scope 1.
2. Editing generated source by hand intentionally detaches it from automatic model-repair ownership. It can still be reviewed and run through confirmation, but automatic repair requires reopening/regenerating the tracked draft. This is fail-closed and avoids repairing an ambiguous lineage.

## Adversarial evidence

- Read-only/negation cases passed: explain, quoted text, hypothetical, `do not run`, `don't apply`, `keep workspace unchanged`, and `show me the parser, don't execute it` do not stage specialist actions.
- Prompt/data injection in filenames, delimited cells, headers, relationship metadata, and parser errors remains only in the serialized user-data message and never enters system policy.
- Malformed JSON, Markdown-fenced JSON, extra schema fields, invented filenames, multiple top-level statements, prohibited APIs, repair exhaustion, and stale generation are rejected.
- Existing parser timeout/file/input/output/resource limits and prohibited-API tests pass unchanged.
- All known input-format trigger preservation cases pass; README and expected-output sidecars do not become parser inputs.

## Real-browser qualification

Native browser page:

- IndexedDB round-trip, `requiresReupload`, no approval/active graph restoration, concurrent atomic append, create/list/delete: PASS.
- All seven supplied snippets executed through the production disposable Worker and normalized: PASS (01=6, 02=4, 03=4, 04=12, 05=6, 06=8, 08=4 hyperedges).
- Held-out 07 absent from generation examples: PASS.
- Controlled-response 07 draft passed validation and the production Worker: 4 hyperedges, 12 incidences, metadata preserved. This is workflow evidence only, not live-model quality evidence.

Production App with isolated test-only controlled Ollama transport:

- Generation settles without a stuck composer: PASS.
- Generated Studio draft cannot run from the direct Studio button: PASS.
- Exact run request stages existing confirmation: PASS.
- Run Cancel makes no change: PASS.
- Run Confirm executes once and yields a 4-hyperedge preview without graph application: PASS.
- Apply request stages a separate existing confirmation: PASS.
- Apply Cancel makes no change: PASS.
- Apply Confirm creates graph version 1 with one committed history event: 4 hyperedges, 13 vertices, 14 incidences: PASS.
- Reload with a staged apply restores history/reupload references but no confirmation, approval, file bytes, active batch, or graph: PASS.
- Browser console warnings/errors for both pages: none.

Live Ollama held-out 07: **NOT EXECUTED**. `ollama` was not on PATH and `curl --noproxy '*' http://127.0.0.1:11434/api/tags` failed to connect (exit 7). No source change was made to disguise the unavailable environment, and the controlled response is not claimed as live-model generation quality.

## Qualification commands and results

- `npm run test`: PASS, 225/225 test files, 95.0 s on the final post-corrective rerun (an earlier attempt stopped at 132/225 only because Python was absent from shell PATH; rerun with bundled Python/Node passed).
- `npm run lint`: PASS, zero errors/warnings after test-harness cleanup.
- `npm run build`: PASS, 219 modules, 225 ms; pre-existing large-chunk advisory remains.
- `npm run build:github`: PASS, 219 modules, 241 ms; pre-existing large-chunk advisory remains.
- `npm audit`: one pre-existing High development-only `browserslist <=4.28.6` advisory. No dependency change was authorized; this is not production or Scope 1 runtime code.
- `npm audit --omit=dev`: PASS, 0 vulnerabilities.
- `git diff --check`: PASS (line-ending notices only, no whitespace errors).

## Exact changed/new file manifest

Modified tracked files:

- `src/App.jsx`
- `src/agent/modelPromptBuilder.js`
- `src/agent/uploadPolicy.js`
- `src/components/AgentChatPanel.jsx`
- `src/utils/customParser.js`
- `tests/agent-chat-panel-dom-v7-3-13.test.mjs` (pre-existing Corrective B working-tree change preserved)
- `tests/postqualification-correctiveB-ui-contract.test.mjs` (pre-existing Corrective B rewrite preserved; one stale label assertion corrected during qualification)

New Scope 1 implementation files:

- `src/agent/customParserSpecialist.js`
- `src/agent/customParserTriggerPolicy.js`
- `src/agent/prompts/customParserFewShots.js`
- `src/agent/prompts/customParserSpecialistPrompt.js`
- `src/agent/prompts/customParserTemplate.js`
- `src/agent/prompts/threadMemoryPrompt.js`
- `src/components/CustomParserSpecialistPanel.jsx`
- `src/hooks/useCustomParserSpecialist.js`
- `src/persistence/threadStateSchema.js`
- `src/persistence/threadStore.js`
- `src/persistence/usePersistentThread.js`

New tests/fixtures:

- `tests/fixtures/scope1-native/edge_list.weird`
- `tests/fixtures/scope1-parser-pack.json`
- `tests/scope1-app.html`
- `tests/scope1-app.jsx`
- `tests/scope1-browser.html`
- `tests/scope1-browser.js`
- `tests/scope1-persistence-trigger-specialist.test.mjs`
- `tests/scope1-specialist-lifecycle.test.mjs`
- `tests/scope1-worker-emission.test.mjs`

New evidence files:

- `artifacts/scope1-continuation-checkpoint.md`
- `artifacts/to-be-chatbot-scope1-baseline.md`
- `artifacts/to-be-chatbot-scope1-audit-report.md`
- `artifacts/to-be-chatbot-scope1-issue-register.json`

## Protected boundaries

No React/Vite/package upgrade was made. No graph algorithms, graph identity/contracts, mapping-first workflow, deterministic NLU authority, export pipeline, visualization implementation, local-model provider, or bridge was rewritten. The only Worker change is the narrow emitted-source construction correction required for actual browser execution; its scanner and resource limits were preserved.

## Diff stat

Tracked `git diff --stat`: 7 files changed, 358 insertions, 25 deletions. A temporary-index calculation that also includes all 24 untracked Scope 1 files reports: 31 files changed, 1,561 insertions, 25 deletions.

## Hard stop

Scope 2 / ReAct work was not started.
