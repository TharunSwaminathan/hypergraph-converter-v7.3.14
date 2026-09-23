# Post-qualification diagnosis environment

Recorded 2026-09-22, Windows, America/Chicago. Repository: `C:\Users\tharu\OneDrive\Documents\Candi\hypergraph-converter-v7.3.14`. Branch `post-corrective-deep-diagnosis`; HEAD `4a2ca6ca535a4f8d78f6f6d0b61150b6fe9c0302`; protected tag `post-scope4c-chatbot-ui-corrective-qualified` peels to HEAD. The earlier protected `candy-integration-scope4c-runtime-integration-qualified` tag peels to `faeca1053f95a61bfe03ac88295c563d32f91969`. Initial tree was clean. At final inspection only new untracked files in `artifacts/` existed; no tracked diff or history mutation.

## Runtime and qualification

| Component | Observed state |
|---|---|
| Node | Bundled `node.exe` at `C:\Users\tharu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`; ambient PATH did not initially resolve npm, Ollama CLI, or Python. |
| Python | Bundled Python available only after explicit PATH prepend; first suite run stopped at 151/249 from missing Python 3 prerequisite. |
| Test suite | Rerun with bundled Node and Python: 249/249 test files passed, 104.3 s, on unchanged source. |
| Ollama | Loopback HTTP `127.0.0.1:11434` version 0.34.2. Tags include `qwen3:8b` and `gemma4:26b`; live matrix used `qwen3:8b`. |
| Bridge | `127.0.0.1:8787` health identified `hypergraph-ollama-bridge`; upstream `127.0.0.1:11434`; allowed UI origins include `127.0.0.1` and `localhost` on 5173 and 5178. Routes limited to health, tags, chat. Body limit 5 MiB, upstream timeout 60 s, response limit 25 MiB. Allowed origin returned ACAO; untrusted origin 403; unlisted route 404. |
| Browser | Vite served `http://127.0.0.1:5178/` with HTTP 200. IAB live UI used for graph, preview, statistics, assistant, diagnostics, Custom Parser, and batch-preview checks. |
| GPU | NVIDIA GeForce RTX 5060, driver 617.14, 8151 MiB reported by `nvidia-smi`. |
| Native CANDY | `VITE_CANDY_RUNTIME_ENABLED` false, browser-only UI. Runtime Companion on 8791 refused connection, `nvcc` absent. No qualified native source changed. WSL status returned `Wsl/EnumerateDistros/Service/E_ACCESSDENIED`, so WSL/CUDA launch and native motifs could not be live-tested. |
| Graph mutation | `MAX_REACT_STEPS` remains 8 at `src/agent/reactOrchestratorConfig.js:1`. The live model probe used an in-memory diagnostic graph and never invoked graph commit. Browser staged mutation was canceled. |

Services were already running or locally started for diagnosis; the user's now-running Ollama was not stopped. Process ownership could not be inspected via CIM in this sandbox, so no process was killed.

## Live resource observations

The 13 graph-mutation operation families required two model attempts each. Their mean wall time on the latest run was 9.00 s (range 6.84–11.46 s); summed Ollama output tokens 6,720 and prompt-evaluation tokens 20,140 across 26 attempts. Nine families remained invalid after repair (ten on the preceding run). This is small-sample local latency, not a benchmark of other hardware or models. Latest direct and bridge tiny structured health calls succeeded in 4.49 s and 103 ms respectively; a preceding warm direct call took 186 ms and an earlier cold direct call about 49.5 s, showing readiness checks are load-state sensitive. The narrow experimental schema yielded 6/6 valid responses over two families, but is not production-equivalent.

## Boundaries and incomplete live coverage

- The browser file chooser could not be driven by the available automation after two attempts. The audited fixture exists in `artifacts/`, but no live upload occurred. Upload/batch conclusions therefore combine source, tests, and no-file browser observations; they do not claim full uploaded-dataset UI coverage.
- The Runtime Companion/CUDA and WSL launchers were unavailable in this environment. CANDY class contracts and browser-only presentation were inspected; native end-to-end results were not fabricated.
- The Codex Security preflight passed 2/2; architecture and selected baseline files were reviewed. An exhaustive 1,074-file repository-wide security validation was not completed. The two security candidates in the issue register have explicit preconditions and no external exploit was run.
- No destructive graph action, parser execution with dynamic import, external redirect, commit, tag move, or production-source edit was performed.
