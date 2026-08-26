#!/usr/bin/env bash
set -u

MODEL_NAME="${MODEL_NAME:-qwen3:8b}"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"

fail() {
  echo "FAIL: $1"
  exit 1
}

echo "Hypergraph Converter Studio local model smoke test"
echo "Model: ${MODEL_NAME}"
echo "Ollama: ${OLLAMA_BASE_URL}"

command -v ollama >/dev/null 2>&1 || fail "ollama command was not found"
command -v curl >/dev/null 2>&1 || fail "curl command was not found"
command -v node >/dev/null 2>&1 || fail "node command was not found; install Node.js to parse the Ollama JSON envelope"

ollama list >/dev/null 2>&1 || fail "ollama list failed; start Ollama first"
curl --fail --silent --show-error "${OLLAMA_BASE_URL}/api/tags" >/dev/null || fail "Ollama /api/tags did not respond"
ollama show "${MODEL_NAME}" >/dev/null 2>&1 || fail "model ${MODEL_NAME} is not installed; run: ollama pull ${MODEL_NAME}"

REQUEST_BODY=$(cat <<JSON
{
  "model": "${MODEL_NAME}",
  "messages": [
    { "role": "system", "content": "Return only this JSON object: {\"status\":\"ok\"}" },
    { "role": "user", "content": "Return the JSON health response." }
  ],
  "stream": false,
  "think": false,
  "format": {
    "type": "object",
    "properties": {
      "status": { "type": "string", "enum": ["ok"] }
    },
    "required": ["status"],
    "additionalProperties": false
  },
  "options": { "temperature": 0.1 }
}
JSON
)

RESPONSE=$(curl --fail --silent --show-error \
  -H "Content-Type: application/json" \
  -d "${REQUEST_BODY}" \
  "${OLLAMA_BASE_URL}/api/chat") || fail "structured /api/chat health request failed"

INNER_STATUS=$(printf '%s' "${RESPONSE}" | node -e '
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { raw += chunk; });
process.stdin.on("end", () => {
  try {
    const outer = JSON.parse(raw);
    const content = outer && outer.message && outer.message.content;
    if (typeof content !== "string" || !content.trim()) {
      console.error("Ollama response did not include message.content");
      process.exit(2);
    }
    const inner = JSON.parse(content);
    if (inner && inner.status === "ok") {
      console.log("ok");
      return;
    }
    console.error("message.content JSON did not contain status ok");
    process.exit(3);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
});
') || fail "model did not return nested structured status JSON"

[ "${INNER_STATUS}" = "ok" ] || fail "model did not return status ok"

echo "PASS: ${MODEL_NAME} completed a tiny non-streaming structured generation."
