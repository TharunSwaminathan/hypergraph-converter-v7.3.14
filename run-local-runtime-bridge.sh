#!/usr/bin/env bash
set -u

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install a supported Node.js release, reopen this terminal, and run this script again."
  exit 1
fi

HYPERGRAPH_BRIDGE_PORT="${HYPERGRAPH_BRIDGE_PORT:-8787}"
BRIDGE_HEALTH_URL="http://127.0.0.1:${HYPERGRAPH_BRIDGE_PORT}/health"
if [ -z "${HYPERGRAPH_BRIDGE_ORIGINS:-}" ]; then
  if [ -n "${HYPERGRAPH_FRONTEND_ORIGIN:-}" ]; then
    HYPERGRAPH_BRIDGE_ORIGINS="${HYPERGRAPH_FRONTEND_ORIGIN}"
  elif [ -n "${FRONTEND_PORT:-}" ]; then
    HYPERGRAPH_BRIDGE_ORIGINS="http://127.0.0.1:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT}"
  else
    echo "No exact frontend origin was supplied."
    echo "Set HYPERGRAPH_BRIDGE_ORIGINS to a comma-separated list of exact origins, for example http://127.0.0.1:5173."
    exit 1
  fi
fi
export HYPERGRAPH_BRIDGE_PORT HYPERGRAPH_BRIDGE_ORIGINS

BRIDGE_STATUS="$(node scripts/launcher-preflight.mjs bridge-status "${BRIDGE_HEALTH_URL}")"
if [ "${BRIDGE_STATUS}" = "ready" ]; then
  echo "The verified Hypergraph bridge is already running at ${BRIDGE_HEALTH_URL}."
  exit 0
fi
if [ "${BRIDGE_STATUS}" = "occupied" ]; then
  echo "Bridge port ${HYPERGRAPH_BRIDGE_PORT} is occupied by a service that is not the Hypergraph Ollama bridge."
  echo "Stop that service or set HYPERGRAPH_BRIDGE_PORT to a free loopback port."
  exit 1
fi
if [ "${BRIDGE_STATUS}" = "invalid" ]; then
  echo "The bridge health URL is invalid: ${BRIDGE_HEALTH_URL}"
  exit 1
fi

echo "Starting Hypergraph local runtime bridge at http://127.0.0.1:${HYPERGRAPH_BRIDGE_PORT}"
echo "Allowed frontend origins: ${HYPERGRAPH_BRIDGE_ORIGINS}"
echo "Ollama bridge URL: http://127.0.0.1:${HYPERGRAPH_BRIDGE_PORT}/ollama"
echo
exec node local-runtime-bridge.js
