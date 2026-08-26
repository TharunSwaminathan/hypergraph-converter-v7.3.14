#!/usr/bin/env bash
set -u

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

echo "Starting Hypergraph local runtime bridge..."
echo
echo "Default bridge URL: http://127.0.0.1:8787"
echo "Ollama bridge URL: http://127.0.0.1:8787/ollama"
echo
echo "Edit local-runtime-bridge.js or set HYPERGRAPH_BRIDGE_ORIGINS to allow another GitHub Pages origin."
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install Node.js, then run this script again."
  exit 1
fi

exec node local-runtime-bridge.js
