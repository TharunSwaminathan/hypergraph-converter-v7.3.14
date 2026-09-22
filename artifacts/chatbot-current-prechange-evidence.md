# Post-Scope-4C chatbot/UI corrective pre-change evidence

Date: 2026-09-21

## Verified starting state

- Repository: `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14`
- Branch: `post-scope4c-chatbot-ui-corrective`
- HEAD: `faeca1053f95a61bfe03ac88295c563d32f91969`
- Protected tag: `candy-integration-scope4c-runtime-integration-qualified` dereferenced to the same commit.
- Working tree before this corrective review: clean; no tracked modifications and no untracked files.
- No repository `AGENTS.md` was present.

The baseline, branch, working tree, current source, and targeted tests were inspected before any edit.

## Confirmed defects before editing

| ID | Severity | Reproduction/evidence | Classification |
|---|---:|---|---|
| CHAT-UI-001 | Medium | Hypergraph Assistant -> Workspace had no local upload control even though the addendum explicitly required `Upload files`. The composer-level upload control was correctly absent. | Missing required UI path; shared upload implementation already existed. |
| CHAT-TEST-002 | Medium | `tests/agent-chat-panel-dom-v7-3-13.test.mjs` asserted the obsolete invariant that no Assistant-visible upload input existed. | Test contradicted the newer Workspace-upload requirement. |
| CHAT-NLU-003 | Medium | `For the manual, explain Apply parser result.` and `Write instructions showing how I would run the parser.` both collapsed to substantially the same generic parser-workflow boilerplate. `Describe the delete-edge command without changing anything.` did not reliably resolve to command Help. | Safe but not sufficiently responsive read-only behavior. |
| CHAT-AUTH-004 | Medium | The documentation-form `For the manual, explain Apply parser result.` was classified as positively authorizing a state-changing action, although downstream gates prevented execution. | Authorization classification was inconsistent with the read-only speech act. |

## Pre-change test state

The existing targeted test set passed before editing; the confirmed defects were uncovered by requirement/behavior inspection rather than existing red tests. Fourteen targeted test files passed. This is why new/updated regression assertions were required.

## Scope decision

The corrective work was limited to:

1. adding Workspace upload through the existing `agentActions.uploadAgentFiles` authority;
2. replacing the obsolete DOM invariant with the precise composer-vs-Workspace invariant;
3. making the three named documentation examples deterministic, differentiated, specific, and read-only;
4. allowing current live-qualification output paths to be selected without overwriting historical evidence.

No new CANDY algorithm, ESCHER source, motif taxonomy, preview feature, or native CUDA implementation was added.

## Authorized continuation: remaining handwritten UI requirements

The user subsequently authorized closing items #5, #9, and #10 without changing the qualified native implementations. Before production edits, the current UI and targeted tests were inspected and the following gaps were reconfirmed:

| ID | Severity | Reproduction/evidence | Classification |
|---|---:|---|---|
| CHAT-PREVIEW-005 | Medium | Graph Preview rendered fixed 10/25/50/100/200 controls only. No bounded custom numeric control existed. | Authorized missing UI requirement. Existing capability accepts only integer limits from 1 through 10,000. |
| CHAT-PREVIEW-006 | Medium | Vertex search existed, but there was no explicit hyperedge search/filter or not-found/reset behavior. | Authorized missing read-only Preview requirement. |
| CHAT-STATS-007 | Medium | Statistics showed browser-derived metrics and separately labeled Line-Graph Triangles, but had no Hypergraph 3-Edge Motifs section or entry to the already-qualified CANDY STATIC workflow. | Authorized missing integration; native algorithm and Runtime transport already existed. |
| CHAT-STATS-008 | Medium | Deterministic Statistics guidance did not explicitly distinguish browser metrics, Line-Graph Triangles, and optional Runtime-computed 30-class motifs. | Truthfulness/answer-quality gap associated with the new Statistics integration. |
| CHAT-NAV-009 | Medium | Live browser qualification after the initial continuation changes showed that `Show the triads.` compiled to the intended `show_stats` plan, but `AgentChatPanel` classified that legacy plan kind as an unknown side effect and refused it with “did not execute the state-changing dashboard action.” | Integrated authorization bridge omitted the existing `show_stats` navigation plan even though the deterministic authorization contract positively authorized its `navigation` scope. |

Pre-change targeted regression run: 22/22 tests passed across six Stage 5 Preview suites, Stage 6 Statistics/Algorithms DOM, CANDY Scope 3 UI truthfulness, CANDY Scope 4C contracts, and deterministic dashboard routing. The run confirmed the gaps were missing behavior, not existing red tests.

## Final corrective disposition

All nine confirmed defects are resolved. The continuation added focused automated coverage and live evidence for custom sizing, vertex/hyperedge search, product naming, qualified/unavailable motif states, exact Assistant confirmation staging, current-graph result binding, and `Show the triads.` navigation without mutation or Runtime execution. The final qualification decision is **PASS**; this document preserves the pre-change facts rather than rewriting them as if the defects never existed.
