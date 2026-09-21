# Scope4C final qualification report

1. **Overall:** PASS — all qualification/application gates passed; security sealed with complete coverage.

2. **Branch:** candy-integration-scope4c-runtime-integration

3. **Starting/current HEAD:** 1df4890e8bc80be44a5324727c00fde8cbbc01c6

4. **Scope4B2 qualified tag:** febf3ec1aa97917f7fc989511078ec8013817bf8

5. **Scope4B1 qualified tag:** a27eb1246e342097de448408ffa0a4775545c4ae

6. **Protected historical tags:** All seven peeled commits unchanged; see delta audit.

7. **Exact changed-file manifest:** candy-scope4c-changed-file-manifest.json includes the complete tracked delta + all nonignored untracked paths, byte lengths and SHA256; self-digest omitted to avoid recursive hashing.

8. **Architecture:** Initial preimplementation audit in candy-scope4c-architecture.md; optional authenticated Runtime owns immutable artifacts and fixed native execution. Browser owns committed incidence.

9. **Capability identifiers:** RUN_HYPERGRAPH_3EDGE_MOTIFS / scope4c-qualified-motif/1 / CUDA_STATIC or CUDA_INCREMENTAL; taxonomy remains candy.hypergraph-3edge-motif-taxonomy/1 (exact exported taxonomy is preserved).

10. **Readiness/attestation:** Independent per-backend unsigned ignored operator record, fixed binary/source/Makefile hashes, protected qualification commit, five evidence hashes, actual GPU/nvcc/cudart probes. Missing/stale prerequisites fail closed.

11. **STATIC flow:** Committed immutable incidence artifact + graph snapshot + bounded selector -> CUDA_STATIC fixed executable -> frozen transport validator -> immutable result.

12. **INCREMENTAL flow:** OLD DynamicHypergraph + immutable qualified DELETE_THEN_INSERT update -> CUDA_INCREMENTAL; no property-count state or absolute reconstruction.

13. **NEW authority:** Only unchanged qualified incremental packer derives NEW, affected sets and candidates from OLD+update. HTTP/model schemas reject caller NEW/native/candidates.

14. **Native source freeze:** Zero Git changes anywhere under candy-runtime/native; tracked native and qualified harness/evidence byte hashes compared with baseline in delta audit.

15. **CPU fallback:** None introduced. CPU oracle is correctness/reference qualification evidence; accepted production counts come from validated native CUDA output.

16. **Incremental STATIC fallback:** Absent: exact INCREMENTAL/CUDA_INCREMENTAL pairing is mandatory.

17. **Graph types:** STATIC Hypergraph/DynamicHypergraph; INCREMENTAL authoritative DynamicHypergraph plus pending update; ordinary/projected types rejected.

18. **Projection:** No implicit projection; explicit projection request rejected before model/native execution in motif workflow.

19. **Auth/origin:** Loopback bind, random existing bearer pairing, exact Origin allowlist; missing/wrong bearer and wrong Origin fail. Credential never recorded. Origin-absent native clients require bearer.

20. **Artifacts:** SHA256 immutable graph/update/result bytes; private server paths, exclusive creation, reread hash/length checks, serialized 512-artifact/64MiB retention quotas.

21. **Job lifecycle:** UUID/session binding; serial motif queue; bounded retained jobs; terminal motif status after temp-request cleanup; close stops reservation and drains cancellation.

22. **Timeout:** Real native 1ms job -> PROCESS_TIMEOUT and no result; real Linux process fixture timeout kills group with no observed orphan.

23. **Cancellation:** Actual CUDA job repeated cancellation and queued/running process-fixture repeated cancellation passed, no accepted result; running motif reports cancelling until cleanup.

24. **Orphans:** Actual Linux fixture cancellation/timeout/shutdown and Scope3 native Runtime checks found no orphan. Host WSL failure limitation stated below.

25. **Readiness matrix:** 33 cases passed, including separate backend file/record/evidence/compiler/runtime/device faults and labeled controlled no-GPU/WSL probes.

26. **Stale/replay:** Strict graph/update/request/runtime-session/artifact SHA bindings; browser cross-session/graph/request/result substitutions rejected; current context checked across async uploads.

27. **Workspace mutation:** Read-only production flow; committed hes payload; no motif apply/commit action, no model fallback mutation. All live graph fixtures unchanged.

28. **Browser Mode A:** Full legacy/feature-disabled/browser suites passed; Runtime Node/process/WSL code excluded from browser imports.

29. **Browser Mode B:** User manually verified existing session paired, Runtime+active graph ready, STATIC enabled/completed on RTX5060. Job b1b92d39-c801-4bda-b9bd-32ba97452a21, result sha256:10e70abd0987df05c4bc0dbce81b330ccfc0873339a2cc434aa2f0e7e606be63; INC correctly unavailable. Discovery verification separately used mounted production React plus real HTTP. No refresh or Pair and discover click required. Later Graph none / Saved workspace requires re-upload is expected graph-dependent unavailability and does not invalidate pairing or the completed result.

30. **Result presentation:** STATIC 30 stable class counts/connected total; INCREMENTAL signed deltas and OLD/NEW/update metadata, delta-only, no graph application. Runtime-qualified CUDA devices deduplicate only an exact physical-device tuple across backend rows; qualified/executable backend authority remains per backend.

31. **Orchestrator additions:** SUBMIT_CANDY_MOTIF_JOB bounded selector only; generic status/cancel/open/discovery reused; every compute action requires current observation and explicit CUDA confirmation.

32. **Strict schema:** 12 meaningful Scope4C contract subtests passed, including graph/backend/type/taxonomy/bounds/injection/stale/replay/legacy OpenMP claims.

33. **Routing:** Known invalid graph/pending/backend/projection requests rejected with zero model/native calls; malformed selectors bounded to eight reobserved steps, no workspace fallback.

34. **Live Ollama:** qwen3:8b, Ollama 0.34.2, model digest 500a1f067a9f782620b40bee6f7b0c89e17ae61f686b92c24933e4ca4b2b8b41; only installed model qualified.

35. **Live STATIC Ollama:** Real qwen proposal stages one exact confirmation, zero job before qualification-authorized execution; actual CUDA result validated by browser workflow.

36. **Live INCREMENTAL Ollama:** Real qwen analysis proposal for authoritative pending DynamicHypergraph update; exact confirmation then actual CUDA_INCREMENTAL delta result, workspace unchanged.

37. **Invalid graph Ollama:** OrdinaryGraph and Hypergraph incremental cases reject deterministically without contacting model.

38. **Unavailable backend Ollama:** Rejects deterministically with zero model/native calls and no fallback. Labeled synthetic malformed first step followed by real qwen schema recovery also passed.

39. **Runtime process evidence:** Fresh Windows Node HTTP server PID 25092; 7 accepted actual CUDA parity cases, 21 HTTP/native rejection cases; private pairing IPC excluded from evidence.

40. **Windows->WSL:** shell:false fixed argv: wsl.exe -d Ubuntu --exec /usr/bin/setsid --wait /bin/bash <fixed supervisor> <fixed backend binary> <server request>; PID acknowledgment gates native execution. Default Ubuntu/WSL2 confirmed.

41. **GPU:** NVIDIA GeForce RTX 5060, CC12.0, sm_120, nvcc13.4.59, runtime13040/cudart13.4.49. Native launch and synchronization succeeded.

42. **STATIC E2E:** Actual Windows Runtime/client HTTP -> Ubuntu native -> RTX open/closed/multiclass parity; separate manual visible browser STATIC success.

43. **INCREMENTAL E2E:** Actual Windows Runtime/client HTTP -> Ubuntu native -> RTX deletion/insertion/replacement/anchor signed delta parity. Current Studio has no authoritative DynamicHypergraph caller.

44. **Anchor E2E:** Qualified over-subtraction counterexample delete passed on CUDA_INCREMENTAL, exact OLD/NEW oracle delta and native digest validation.

45. **Scope4B1 regression:** 487 fresh parity and 69 failure cases passed; native/qualified harnesses untouched, historical evidence restored byte-for-byte.

46. **Scope4B2 regression:** 405 fresh parity and 104 failure cases passed, all 30 classes and create/destroy/anchor/stress/chain checks retained; native harness untouched.

47. **Scope4A-R regression:** 4 complete taxonomy/oracle-delta/contracts/adversarial files passed within final 247-file run; qualified 30 classes unchanged.

48. **Scope3 SSSP:** Unchanged OpenMP/CUDA 12-fixture + 40-stress native parity, CUDA failures, all four freshly rerun sanitizer tools and authenticated CUDA Runtime lifecycle passed. Explicit OpenMP STATIC/INC/cancel passed; prior ignored SSSP CUDA record state restored.

49. **Chatbot regression:** 26 matching legacy chat/agent/React/Ollama/parser/routing/confirmation files passed as subsets of full suite; exact filenames in browser-chatbot-regression.json.

50. **Security scan ID:** 8f05dfe9-6287-42e1-aa11-113f9e16908d

51. **Security snapshot:** codex-security-snapshot/v1:sha256:d5c8f5299b37bb654cc929232ba8d0cd81cfe39e8cb3eab203a526da2f22d073 (tool launch snapshot; final source SHA/late inventory reconciliation explicitly retained in sealed coverage, not a claimed final-tree snapshot digest).

52. **Security reconciliation:** Tool inventory read all pages; complete Git-delta union adds omitted .mjs tests/drivers, Markdown docs and .gitattributes. Final reviewed source SHA hashes verified; canonical generated copies are tool outputs, not circular review inputs.

53. **Sealed coverage:** Complete; generated canonical scan-manifest.json/findings.json/coverage.json/report.md copied unchanged.

54. **Deferred/open questions:** 0 / 0; no skipped executable source.

55. **Findings:** Critical0 / High0 / Medium0 / Low0; no remaining reportable candidates.

56. **Full tests:** 247/247 files PASS.

57. **Lint:** PASS

58. **Production build:** PASS

59. **GitHub build:** PASS

60. **Production dependency audit:** PASS; npm audit --omit=dev, no dependency updates. Exact audit metadata in application-gates.json.

61. **Whitespace:** git diff --check PASS.

62. **Dependency changes:** None; package manifests/lock unchanged.

63. **Debris cleanup:** Qualification child servers and copied readiness/process fixtures removed; ELF/build/.local records are ignored and absent from changed manifest. Existing paired Runtime and preview remain available intentionally.

64. **Known limitations:** Current Studio commits Hypergraph only; incremental UI remains unavailable without an authoritative DynamicHypergraph plus qualified pending update. Runtime/fixture incremental E2E is qualified. Visible Mode B verification is manual user evidence bound to an authenticated completed Runtime job. Production React panel/hook discovery was separately verified with real HTTP; no automated visible-browser claim. Local ignored qualification records establish operator-controlled consistency and are unsigned. Private host directories/Windows ACLs and configured Ollama endpoint are trusted operator prerequisites. Queued/running/shutdown process control uses an actual slow Linux process fixture. Real CUDA job timeout/cancellation were also tested; no claim that a long-running GPU kernel was forcibly interrupted. Severe host/WSL failure preventing Linux kill cannot guarantee remote orphan cleanup. Only qwen3:8b installed model was qualified. Schema recovery uses a labeled synthetic malformed first proposal followed by a real qwen response. Native parity suites were rerun fresh. Frozen historical sanitizer evidence was hash-verified for motifs; all four Scope3 SSSP sanitizer suites were freshly rerun. No motif native source/harness changes. Existing paired Runtime and local preview intentionally remain available to the user; qualification child servers and temporary fixtures were closed/removed.

65. **Final Git status:** Modified/untracked integration files only; exact final porcelain and paths in manifest. HEAD/branch/protected peeled tags unchanged.

66. **Git mutation prohibition:** No commit, tag, push, merge, reset, amend or history rewrite performed. All changes remain uncommitted for review.

67. **Qualification tags:** All seven protected tags verified unchanged. HARD STOP after this report.
