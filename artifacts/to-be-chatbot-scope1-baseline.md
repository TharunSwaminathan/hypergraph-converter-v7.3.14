# Scope 1 baseline

- Current HEAD: `3ae0054d2bf9069e0f1804906cc37f3af415d2d1`.
- Package: 7.3.14. Supplied archive matches 474 source/test/package entries after line-ending normalization.
- Pre-existing edits: `tests/agent-chat-panel-dom-v7-3-13.test.mjs`, `tests/postqualification-correctiveB-ui-contract.test.mjs` (239 insertions, 11 deletions). These are unfinished Corrective B tests, preserved as the implementation baseline.
- Baseline lint/build/GitHub build pass. Existing chunk warning remains.
- Initial full test attempt passed 132/222 files then stopped because Python was absent from PATH (`portable-zip-paths`). Bundled Python is available; reruns will set PYTHON explicitly.
- Known baseline test defect: Corrective B source assertion expects Custom Parser Studio, while the actual selector label is Custom Parser. Correct this assertion narrowly when qualifying the current feature.
- Production npm audit: zero vulnerabilities. Full audit: development advisories; no dependency changes authorized.
- Source inspection: App owns canonical graph, upload batches, parser source/result and local model coordinator; AgentChatPanel owns messages, pending confirmations and bounded conversation memory. readUploadedTextFiles and fileDetection own upload validation/detection. customParser.js owns AST checks, disposable worker and normalized output. Existing mapping-first generation remains preserved.
- Relevant preservation tests: upload-policy, upload-cancellation, custom-parser-workflow, parser-sandbox, parser-validation, parser-binding/continuation, AgentChatPanel DOM lifecycle, Stage 8 authorization and Stage 10 negation corpora, DO_NOT_REGRESS suite.
- Narrow interfaces: persistence hook at chat state boundary; deterministic policy plus additive specialist controller; existing coordinator for model calls; explicit draft adoption into Studio; existing run/apply confirmation pipeline.
- Authorized scope: Phase 1 and Phase 2, Stages 1–3 only. No Scope 2, ReAct loop, package/dependency upgrade or graph/algorithm/Preview rewrite.
