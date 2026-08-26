import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const bridgePath = resolve("local-runtime-bridge.js");

function waitForBridge(child) {
  return new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(() => rejectReady(new Error("bridge did not start")), 5000);
    child.stdout.on("data", chunk => {
      if (String(chunk).includes("listening")) {
        clearTimeout(timer);
        resolveReady();
      }
    });
    child.on("exit", code => rejectReady(new Error(`bridge exited early with ${code}`)));
  });
}

let chatHit = false;
const upstream = http.createServer((req, res) => {
  if (req.url === "/api/chat" && req.method === "POST") {
    chatHit = true;
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      res.write('{"message":{"content":"first"},"done":false}\n');
      setTimeout(() => {
        res.end('{"message":{"content":"second"},"done":true}\n');
      }, 400);
    });
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

upstream.listen(0, "127.0.0.1");
await once(upstream, "listening");
const upstreamPort = upstream.address().port;

const bridgePort = 18789;
const bridge = spawn(process.execPath, [bridgePath], {
  env: {
    ...process.env,
    OLLAMA_BASE_URL: `http://127.0.0.1:${upstreamPort}`,
    HYPERGRAPH_BRIDGE_PORT: String(bridgePort),
    HYPERGRAPH_BRIDGE_MAX_BODY_BYTES: "4096",
    HYPERGRAPH_BRIDGE_MAX_RESPONSE_BYTES: "4096",
    HYPERGRAPH_BRIDGE_UPSTREAM_TIMEOUT_MS: "5000",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitForBridge(bridge);
  const start = Date.now();
  const response = await fetch(`http://127.0.0.1:${bridgePort}/ollama/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "qwen3:8b", messages: [{ role: "user", content: "hello" }] }),
  });
  assert.equal(response.status, 200);
  assert.equal(chatHit, true);
  const reader = response.body.getReader();
  const first = await reader.read();
  const firstByteMs = Date.now() - start;
  assert.equal(first.done, false, "the first streamed chunk should be available before the upstream response ends");
  assert.ok(firstByteMs < 300, `first chunk should arrive promptly, saw ${firstByteMs}ms`);
  let body = new TextDecoder().decode(first.value);
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    body += new TextDecoder().decode(chunk.value);
  }
  const totalMs = Date.now() - start;
  assert.ok(totalMs >= 350, `test upstream intentionally delays final chunk; saw ${totalMs}ms`);
  assert.match(body, /first/);
  assert.match(body, /second/);
} finally {
  bridge.kill();
  upstream.close();
}

console.log("v7.3.13 bridge streaming test passed.");
