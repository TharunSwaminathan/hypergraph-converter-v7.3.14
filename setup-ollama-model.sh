#!/usr/bin/env bash
# User-invoked setup helper. It never runs automatically with the dashboard.
set -u

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
MODEL_NAME="${MODEL_NAME:-qwen3:8b}"

echo "Checking Ollama..."
if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama was not found."
  echo "Install Ollama first, then run this script again."
  echo "See MODEL_SETUP.md for details."
  exit 1
fi

echo "Checking local model: ${MODEL_NAME}"
if ollama show "${MODEL_NAME}" >/dev/null 2>&1; then
  echo "The model is already available locally."
else
  echo "Pulling local model: ${MODEL_NAME}"
  if ! ollama pull "${MODEL_NAME}"; then
    echo "The model pull failed. Confirm that the Ollama server is running and review MODEL_SETUP.md."
    exit 1
  fi
fi

echo
echo "Done. In the dashboard use:"
echo "Model: ${MODEL_NAME}"
echo "Runtime: Ollama"
echo "Connection: click Connect; the app tries direct Ollama and the local bridge automatically."
