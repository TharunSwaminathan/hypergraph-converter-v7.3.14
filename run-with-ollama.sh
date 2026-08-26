#!/usr/bin/env bash
# User-invoked quick start. Ollama and model weights remain outside this project.
set -u

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
MODEL_NAME="${MODEL_NAME:-qwen3:8b}"
BRIDGE_HEALTH_URL="${BRIDGE_HEALTH_URL:-http://127.0.0.1:8787/health}"
BRIDGE_OLLAMA_URL="${BRIDGE_OLLAMA_URL:-http://127.0.0.1:8787/ollama}"
BRIDGE_LOG="${TMPDIR:-/tmp}/hypergraph-local-runtime-bridge.log"
BRIDGE_STARTED_PID=""

bridge_ready() {
  command -v curl >/dev/null 2>&1 && curl -fsS "${BRIDGE_HEALTH_URL}" >/dev/null 2>&1
}

cleanup_bridge() {
  if [ -n "${BRIDGE_STARTED_PID}" ]; then
    kill "${BRIDGE_STARTED_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup_bridge EXIT INT TERM

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama was not found."
  echo "Install Ollama separately, then run ./setup-ollama-model.sh."
  echo "See MODEL_SETUP.md for details."
  exit 1
fi

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
    echo "Could not start or reach Ollama at http://localhost:11434."
    echo "Review ${OLLAMA_LOG}, start Ollama manually, and try again."
    exit 1
  fi
else
  echo "Ollama is already responding."
fi

if ! ollama show "${MODEL_NAME}" >/dev/null 2>&1; then
  echo "The model ${MODEL_NAME} is not installed."
  if [ -t 0 ]; then
    read -r -p "Pull it now? [Y/n]: " PULL_MODEL
  else
    PULL_MODEL="n"
  fi
  if [[ "${PULL_MODEL:-y}" =~ ^[Nn]$ ]]; then
    echo "No model was pulled. Run ./setup-ollama-model.sh when ready."
    exit 1
  fi
  ollama pull "${MODEL_NAME}" || {
    echo "The model pull failed. Review MODEL_SETUP.md and try again."
    exit 1
  }
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found. Install Node.js and npm, then try again."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install Node.js, then try again."
  exit 1
fi

echo "Checking the local runtime bridge..."
if bridge_ready; then
  echo "Local runtime bridge is already responding at ${BRIDGE_HEALTH_URL}."
else
  echo "Starting the local runtime bridge in the background..."
  bash ./run-local-runtime-bridge.sh >"${BRIDGE_LOG}" 2>&1 &
  BRIDGE_STARTED_PID="$!"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    bridge_ready && break
    sleep 1
  done
  if bridge_ready; then
    echo "Local runtime bridge is responding at ${BRIDGE_HEALTH_URL}."
  else
    echo "Warning: the bridge did not become reachable at ${BRIDGE_HEALTH_URL}."
    echo "Direct Ollama is still available at http://localhost:11434. Review ${BRIDGE_LOG} if GitHub Pages bridge mode is needed."
  fi
fi

if [ ! -d node_modules ]; then
  echo "Installing dashboard dependencies..."
  npm install || exit 1
fi

echo
echo "Ollama: OK"
echo "Model: ${MODEL_NAME}"
if bridge_ready; then
  echo "Bridge: OK"
else
  echo "Bridge: WARNING - direct Ollama fallback is available if browser policy allows it"
fi
echo "Bridge health: ${BRIDGE_HEALTH_URL}"
echo "Bridge endpoint: ${BRIDGE_OLLAMA_URL}"
echo "Dashboard: http://localhost:5173"
echo "Ollama URL: http://localhost:11434"
echo "Runtime: Ollama"
echo
npm run dev -- --host 0.0.0.0
