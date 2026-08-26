#!/usr/bin/env bash
set -u

MODEL_NAME="${MODEL_NAME:-qwen3:8b}"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
BRIDGE_HEALTH_URL="${BRIDGE_HEALTH_URL:-http://127.0.0.1:8787/health}"
BRIDGE_OLLAMA_URL="${BRIDGE_OLLAMA_URL:-http://127.0.0.1:8787/ollama}"

check() {
  local label="$1"
  shift
  echo
  echo "== ${label} =="
  if "$@"; then
    echo "OK: ${label}"
  else
    echo "WARN: ${label} failed"
  fi
}

health_json() {
  printf '{"model":"%s","messages":[{"role":"system","content":"Return only this JSON object: {\\"status\\":\\"ok\\"}"},{"role":"user","content":"health"}],"stream":false,"think":false,"format":{"type":"object","properties":{"status":{"type":"string","enum":["ok"]}},"required":["status"],"additionalProperties":false},"options":{"temperature":0.1}}' "${MODEL_NAME}"
}

check "node command exists" command -v node
check "npm command exists" command -v npm
check "ollama command exists" command -v ollama
check "ollama list works" ollama list
check "curl Ollama tags" curl --fail --silent --show-error "${OLLAMA_BASE_URL}/api/tags"
check "model ${MODEL_NAME} is present" ollama show "${MODEL_NAME}"
check "direct tiny structured generation" curl --fail --silent --show-error -H "Content-Type: application/json" -d "$(health_json)" "${OLLAMA_BASE_URL}/api/chat"

echo
echo "== bridge health if running =="
if curl --fail --silent --show-error "${BRIDGE_HEALTH_URL}"; then
  echo
  echo "OK: bridge health responded"
else
  echo "INFO: bridge is not running or not reachable at ${BRIDGE_HEALTH_URL}"
fi

echo
echo "== bridged Ollama tags if bridge is running =="
if curl --fail --silent --show-error "${BRIDGE_OLLAMA_URL}/api/tags"; then
  echo
  echo "OK: bridged Ollama tags responded"
else
  echo "INFO: bridged Ollama tags are not reachable at ${BRIDGE_OLLAMA_URL}/api/tags"
fi

echo
echo "If Windows Chrome opens the GitHub Pages site, also run check-local-model-runtime.ps1 from Windows PowerShell."
