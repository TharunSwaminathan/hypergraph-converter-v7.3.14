import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const bridgePath = resolve("local-runtime-bridge.js");

async function waitForExit(child) {
  const [code] = await once(child, "exit");
  return code;
}

{
  const child = spawn(process.execPath, [bridgePath], {
    env: { ...process.env, HYPERGRAPH_BRIDGE_MAX_BODY_BYTES: "not-a-number", HYPERGRAPH_BRIDGE_PORT: "18788" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const code = await waitForExit(child);
  assert.notEqual(code, 0, "invalid body-limit configuration must fail startup instead of disabling the cap");
}

let upstreamHits = 0;
const upstream = http.createServer((req, res) => {
  upstreamHits += 1;
  if (req.url === "/api/tags") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ models: [{ name: "qwen3:8b" }] }));
    return;
  }
  req.resume();
  req.on("end", () => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
});
upstream.listen(0, "127.0.0.1");
await once(upstream, "listening");
const upstreamPort = upstream.address().port;

const bridgePort = 18787;
const bridge = spawn(process.execPath, [bridgePath], {
  env: {
    ...process.env,
    OLLAMA_BASE_URL: `http://127.0.0.1:${upstreamPort}`,
    HYPERGRAPH_BRIDGE_PORT: String(bridgePort),
    HYPERGRAPH_BRIDGE_MAX_BODY_BYTES: "16",
    HYPERGRAPH_BRIDGE_MAX_RESPONSE_BYTES: "2048",
    HYPERGRAPH_BRIDGE_UPSTREAM_TIMEOUT_MS: "5000",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(() => rejectReady(new Error("bridge did not start")), 5000);
    bridge.stdout.on("data", chunk => {
      if (String(chunk).includes("listening")) {
        clearTimeout(timer);
        resolveReady();
      }
    });
    bridge.on("exit", code => rejectReady(new Error(`bridge exited early with ${code}`)));
  });

  const health = await fetch(`http://127.0.0.1:${bridgePort}/health`);
  assert.equal(health.status, 200);
  const healthJson = await health.json();
  assert.equal(healthJson.limits.maxBodyBytes, 16);

  const tags = await fetch(`http://127.0.0.1:${bridgePort}/ollama/api/tags`);
  assert.equal(tags.status, 200);
  assert.deepEqual((await tags.json()).models[0].name, "qwen3:8b");
  assert.equal(upstreamHits, 1);

  const oversized = await fetch(`http://127.0.0.1:${bridgePort}/ollama/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "x".repeat(100) }),
  });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error, "request_body_too_large");
  assert.equal(upstreamHits, 1, "over-limit request must not be forwarded upstream");
} finally {
  bridge.kill();
  upstream.close();
}

console.log("v7.3.12 bridge limit tests passed.");
