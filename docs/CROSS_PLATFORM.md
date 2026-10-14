# Running on macOS, Linux and Windows

Hypergraph Converter Studio is a static React/Vite app plus two *optional*, user-started local helpers (the Ollama bridge and the CANDY runtime companion). Everything the browser app does works on any OS with a modern browser. This document covers the local tooling.

## Requirements

| Tool | Version | Needed for |
| --- | --- | --- |
| Node.js | 20.19+ or 22.12+ (`.nvmrc` pins 22) | everything (dev server, build, tests) |
| npm | ships with Node | everything |
| Ollama | any recent release | optional local AI assistant only |
| Python 3 | 3.8+ | only `npm test` / the portable-archive packager |

macOS: `brew install node` (or the installer from nodejs.org). With Ollama: `brew install ollama`, or install the Ollama app from ollama.com.

## Launch matrix

| Task | macOS / Linux | Windows | Any OS |
| --- | --- | --- | --- |
| Development server | `./run-dev.sh` | `run-dev.bat` | `npm install && npm run dev` |
| Production build | `./run-build.sh` | `run-build.bat` | `npm run build` |
| Production preview | `./run-preview.sh` | `run-preview.bat` | `npm run build && npm run preview` |
| Studio + Ollama assistant | `./run-with-ollama.sh` | `run-with-ollama.bat` | `npm run start:ollama` |
| Pull the local model | `./setup-ollama-model.sh` | `setup-ollama-model.bat` | `npm run setup:model` |
| Diagnose the local runtime | `./check-local-model-runtime.sh` | `check-local-model-runtime.ps1` | `npm run check:runtime` |
| Bridge only | `./run-local-runtime-bridge.sh` | `run-local-runtime-bridge.bat` | `npm run bridge` |
| Clean reinstall | `./clean-install.sh` | `clean-install.bat` | `rm -rf node_modules && npm ci` |

The `npm run …` entries are thin wrappers (`scripts/launch.mjs`) that run the platform's own launcher; they add no behaviour of their own.

### macOS: double-click launchers

`run-with-ollama.command`, `run-dev.command`, `run-preview.command` and `setup-ollama-model.command` open in Terminal when double-clicked in Finder.

Because macOS quarantines files downloaded from the internet, the first launch may say the file "cannot be opened". Either right-click it → **Open** → **Open**, or clear the quarantine flag once:

```bash
xattr -dr com.apple.quarantine /path/to/hypergraph-converter
```

If a script reports `Permission denied`, restore the executable bit (a ZIP made on Windows or a copy through some cloud drives drops it):

```bash
chmod +x *.sh *.command
```

### Differences from the `.bat` launchers

* `run-dev.sh` and `run-preview.sh` bind to `127.0.0.1` by default; the `.bat` files bind to `0.0.0.0` (visible to your whole network). Use `HOST=0.0.0.0 ./run-dev.sh` if you want that.
* `clean-install.sh` keeps `package-lock.json` and runs `npm ci`; `clean-install.bat` deletes the lockfile and regenerates it, which drops the native binaries for the other operating systems from the lockfile.
* The new scripts check the Node.js version first and stop with a readable message if it is too old.

## Ollama on macOS

1. Start Ollama (menu-bar app, or `ollama serve`).
2. `./setup-ollama-model.sh` (pulls `qwen3:8b`; override with `MODEL_NAME=...`).
3. `./run-with-ollama.sh` – starts the verified local bridge and the dev server and prints the Dashboard URL.

The bridge lets the page reach Ollama without browser CORS configuration. If you use the hosted GitHub Pages site instead and want it to talk to Ollama directly, allow its origin (macOS app):

```bash
launchctl setenv OLLAMA_ORIGINS "https://<your-user>.github.io,http://127.0.0.1:5173"
```

then quit and reopen Ollama. `configure-ollama-origins.example.sh` prints the exact commands for macOS, Linux and Windows without changing anything.

## CANDY runtime companion

The optional native companion (`npm run candy:runtime`) starts on every platform, but its qualified native backends are Linux binaries: Windows reaches them through WSL2, Linux runs them directly. On macOS no native backend is qualified, so capability discovery reports none and the app stays fully usable in browser-only mode (`Hypergraph + SSSP` already fails closed by design). Nothing about CANDY is enabled unless you build with `VITE_CANDY_RUNTIME_ENABLED=true`.

## Hosting on GitHub Pages

The repository ships `.github/workflows/deploy-pages.yml`.

1. Push the project to a GitHub repository whose default branch is `main`.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push to `main` (or run the workflow manually). The site appears at `https://<owner>.github.io/<repo>/`.

The workflow builds with `VITE_BASE_PATH=/<repo-name>/`, so it works under any repository name. Manual alternatives:

```bash
npm run build:github      # base path /hypergraph-converter/
npm run build:relative    # base path ./  (works from any sub-folder of a static host)
VITE_BASE_PATH=/my-repo/ npm run build
```

GitHub Pages is static hosting: it cannot start Ollama or the bridge. The hosted page can only use a local runtime that you start yourself on the machine running the browser (see `MODEL_SETUP.md`).

`.github/workflows/ci.yml` builds, lints and tests on Ubuntu and additionally builds/tests on macOS and Windows (informational until the first green run).

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `bad interpreter: /usr/bin/env bash^M` or `$'\r': command not found` | A script was saved with Windows line endings. This release ships LF scripts and a `.gitattributes` that keeps them LF; after copying scripts from Windows run `sed -i '' 's/\r$//' *.sh` (macOS) or `sed -i 's/\r$//' *.sh` (Linux). |
| `Permission denied` | `chmod +x *.sh *.command` |
| `Unsupported engine` / Vite refuses to start | Node.js is too old: install 20.19+ or 22.12+. |
| Port 5173 or 8787 busy | The launcher picks a free frontend port automatically; for the bridge set `HYPERGRAPH_BRIDGE_PORT`. |
| `localhost` does not connect | Use `127.0.0.1`; on macOS `localhost` may resolve to IPv6 first. All launchers print 127.0.0.1 URLs. |

## Verification status of this release

Built and exercised on Linux (Node 22): build, lint, the full Node test suite, launcher dispatch, ZIP permission policy, and a fresh-extraction `npm ci`. The macOS code paths use only POSIX/bash-3.2-compatible constructs (macOS ships bash 3.2) and were checked statically; they have not been run on physical Apple hardware, and the Windows `.bat` files are unchanged from v7.3.14.
