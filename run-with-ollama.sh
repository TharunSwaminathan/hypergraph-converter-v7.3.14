#!/usr/bin/env bash
# User-invoked quick start. Ollama and model weights remain outside this project.
set -u

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
MODEL_NAME="${MODEL_NAME:-qwen3:8b}"
HYPERGRAPH_BRIDGE_PORT="${HYPERGRAPH_BRIDGE_PORT:-8787}"
VITE_HYPERGRAPH_BRIDGE_PORT="${HYPERGRAPH_BRIDGE_PORT}"
BRIDGE_HEALTH_URL="http://127.0.0.1:${HYPERGRAPH_BRIDGE_PORT}/health"
BRIDGE_OLLAMA_URL="http://127.0.0.1:${HYPERGRAPH_BRIDGE_PORT}/ollama"
BRIDGE_LOG="${TMPDIR:-/tmp}/hypergraph-local-runtime-bridge.log"
BRIDGE_STARTED_PID=""

for required_command in node npm ollama; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    echo "${required_command} was not found. Install it, reopen this terminal, and try again."
    [ "${required_command}" != "ollama" ] || echo "Then run ./setup-ollama-model.sh. See MODEL_SETUP.md for details."
    exit 1
  fi
done

if [ -n "${FRONTEND_PORT:-}" ]; then
  REQUESTED_FRONTEND_PORT="${FRONTEND_PORT}"
  FRONTEND_PORT="$(node scripts/launcher-preflight.mjs find-frontend-port "${REQUESTED_FRONTEND_PORT}" 1)" || {
    echo "Frontend port ${REQUESTED_FRONTEND_PORT} is unavailable. No other listener was terminated."
    exit 1
  }
else
  FRONTEND_PORT="$(node scripts/launcher-preflight.mjs find-frontend-port 5173 1)" || {
    echo "Canonical frontend port 5173 is occupied. No silent fallback to 5174. Close the conflict yourself or explicitly choose FRONTEND_PORT."
    exit 1
  }
fi
FRONTEND_HOST="127.0.0.1"
DASHBOARD_URL="http://${FRONTEND_HOST}:${FRONTEND_PORT}"
echo "Frontend origin: ${DASHBOARD_URL}"
if [ "${FRONTEND_PORT}" != "5173" ]; then
  echo "WARNING: Noncanonical origin. Browser persistence is separate; no saved data is relocated. Cross-origin export/import support is deferred beyond Scope 7A."
fi
HYPERGRAPH_FRONTEND_ORIGIN="${DASHBOARD_URL}"
HYPERGRAPH_BRIDGE_ORIGINS="http://127.0.0.1:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT}"
export FRONTEND_PORT HYPERGRAPH_BRIDGE_PORT VITE_HYPERGRAPH_BRIDGE_PORT HYPERGRAPH_FRONTEND_ORIGIN HYPERGRAPH_BRIDGE_ORIGINS

bridge_status() {
  node scripts/launcher-preflight.mjs bridge-status "${BRIDGE_HEALTH_URL}"
}

cleanup_bridge() {
  if [ -n "${BRIDGE_STARTED_PID}" ]; then
    kill "${BRIDGE_STARTED_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup_bridge EXIT INT TERM

echo "Verifying the Ollama server..."
if ! ollama list >/dev/null 2>&1; then
  OLLAMA_LOG="${TMPDIR:-/tmp}/hypergraph-ollama-server.log"
  echo "Ollama is not responding. Starting ollama serve in the background..."
  ollama serve >"${OLLAMA_LOG}" 2>&1 &
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    ollama list >/dev/null 2>&1 && break
    sleep 1
  done
  if ! ollama list >/dev/null 2>&1; then
    echo "Could not start or reach Ollama at http://127.0.0.1:11434. Review ${OLLAMA_LOG}, start Ollama manually, and try again."
    exit 1
  fi
fi
echo "Ollama is responding."

if ! ollama show "${MODEL_NAME}" >/dev/null 2>&1; then
  echo "The model ${MODEL_NAME} is not installed."
  if [ -t 0 ]; then read -r -p "Pull it now? [Y/n]: " PULL_MODEL; else PULL_MODEL="n"; fi
  if [[ "${PULL_MODEL:-y}" =~ ^[Nn]$ ]]; then
    echo "No model was pulled. Run ./setup-ollama-model.sh when ready."
    exit 1
  fi
  ollama pull "${MODEL_NAME}" || {
    echo "The model pull failed. Check disk space and network access, then review MODEL_SETUP.md."
    exit 1
  }
fi

BRIDGE_STATUS="$(bridge_status)"
if [ "${BRIDGE_STATUS}" = "occupied" ]; then
  echo "Bridge port ${HYPERGRAPH_BRIDGE_PORT} is occupied by a service that is not the Hypergraph Ollama bridge."
  echo "Stop that service or set HYPERGRAPH_BRIDGE_PORT to a free loopback port, then try again."
  exit 1
fi
if [ "${BRIDGE_STATUS}" = "invalid" ]; then
  echo "The bridge health URL is invalid: ${BRIDGE_HEALTH_URL}"
  exit 1
fi
if [ "${BRIDGE_STATUS}" != "ready" ]; then
  echo "Starting the verified local runtime bridge in the background..."
  bash ./run-local-runtime-bridge.sh >"${BRIDGE_LOG}" 2>&1 &
  BRIDGE_STARTED_PID="$!"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    BRIDGE_STATUS="$(bridge_status)"
    [ "${BRIDGE_STATUS}" = "ready" ] && break
    if [ "${BRIDGE_STATUS}" = "occupied" ]; then
      echo "A different service claimed bridge port ${HYPERGRAPH_BRIDGE_PORT} while the bridge was starting."
      exit 1
    fi
  done
  if [ "${BRIDGE_STATUS}" != "ready" ]; then
    echo "The Hypergraph bridge did not become healthy at ${BRIDGE_HEALTH_URL}. Review ${BRIDGE_LOG}."
    exit 1
  fi
fi
echo "Hypergraph bridge identity verified at ${BRIDGE_HEALTH_URL}."

if [ ! -d node_modules ]; then
  echo "Installing dashboard dependencies..."
  npm install || {
    echo "npm install failed. Review the npm error above, restore registry access if needed, and retry."
    exit 1
  }
fi

echo
echo "Dashboard URL: ${DASHBOARD_URL}"
echo "Ollama URL: http://127.0.0.1:11434"
echo "Bridge URL: ${BRIDGE_OLLAMA_URL}"
echo "Bridge origins: ${HYPERGRAPH_BRIDGE_ORIGINS}"
echo "Runtime: Ollama"
echo "Model: ${MODEL_NAME}"
echo
npm run dev -- --host "${FRONTEND_HOST}" --port "${FRONTEND_PORT}" --strictPort
