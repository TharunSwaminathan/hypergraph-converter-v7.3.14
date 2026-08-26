import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const bridgePath = resolve("local-runtime-bridge.js");

function readJsonBody(req) {
  return new Promise(resolveBody => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        resolveBody({});
      }
    });
  });
}

let clientDisconnectObserved = false;
const upstream = http.createServer(async (req, res) => {
  if (req.url === "/api/tags") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ models: [{ name: "qwen3:8b" }] }));
    return;
  }
  const body = await readJsonBody(req);
  if (body.mode === "timeout") {
    return;
  }
  if (body.mode === "upstream-error") {
    req.socket.destroy();
    return;
  }
  if (body.mode === "oversized") {
    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    res.write(`${"x".repeat(700)}\n`);
    res.end(`${"y".repeat(700)}\n`);
    return;
  }
  if (body.mode === "client-disconnect") {
    res.on("close", () => {
      clientDisconnectObserved = true;
    });
    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    res.write('{"message":{"content":"first"},"done":false}\n');
    setTimeout(() => {
      if (!res.destroyed) res.end('{"message":{"content":"late"},"done":true}\n');
    }, 500);
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
});

upstream.listen(0, "127.0.0.1");
await once(upstream, "listening");
const upstreamPort = upstream.address().port;

const bridgePort = 18790;
const logs = [];
let bridgeExit = null;
const bridge = spawn(process.execPath, [bridgePath], {
  env: {
    ...process.env,
    OLLAMA_BASE_URL: `http://127.0.0.1:${upstreamPort}`,
    HYPERGRAPH_BRIDGE_PORT: String(bridgePort),
    HYPERGRAPH_BRIDGE_MAX_BODY_BYTES: "4096",
    HYPERGRAPH_BRIDGE_MAX_RESPONSE_BYTES: "1024",
    HYPERGRAPH_BRIDGE_UPSTREAM_TIMEOUT_MS: "100",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
bridge.stdout.on("data", chunk => logs.push(String(chunk)));
bridge.stderr.on("data", chunk => logs.push(String(chunk)));
bridge.on("exit", code => {
  bridgeExit = code;
});

async function waitForBridge() {
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
}

async function chat(mode, extra = {}) {
  return fetch(`http://127.0.0.1:${bridgePort}/ollama/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, model: "qwen3:8b", prompt: extra.prompt ?? "hello" }),
  });
}

try {
  await waitForBridge();
  const normal = await fetch(`http://127.0.0.1:${bridgePort}/ollama/api/tags`);
  assert.equal(normal.status, 200);
  assert.deepEqual((await normal.json()).models[0].name, "qwen3:8b");

  const timeout = await chat("timeout");
  assert.equal(timeout.status, 502);
  assert.equal((await timeout.json()).error, "bridge_upstream_timeout_or_client_disconnect");

  const upstreamError = await chat("upstream-error");
  assert.equal(upstreamError.status, 502);
  assert.equal((await upstreamError.json()).error, "bridge_runtime_unreachable");

  try {
    const oversized = await chat("oversized");
    assert.equal(oversized.status, 200, "headers may already be streamed before the bridge detects a response cap breach");
    await assert.rejects(() => oversized.text(), /terminated|aborted|other side closed|premature/i);
  } catch (error) {
    assert.match(String(error?.cause?.message ?? error?.message ?? error), /terminated|aborted|other side closed|premature|fetch failed/i);
  }

  await new Promise((resolveClient, rejectClient) => {
    const req = http.request({
      host: "127.0.0.1",
      port: bridgePort,
      path: "/ollama/api/chat",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, res => {
      res.once("data", () => {
        req.destroy();
        resolveClient();
      });
    });
    req.on("error", error => {
      if (error.code === "ECONNRESET") resolveClient();
      else rejectClient(error);
    });
    req.end(JSON.stringify({ mode: "client-disconnect", prompt: "SECRET_PROMPT_DO_NOT_LOG" }));
  });
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(clientDisconnectObserved, true, "upstream should observe the bridge/client disconnect");

  let stillHealthy;
  try {
    stillHealthy = await fetch(`http://127.0.0.1:${bridgePort}/health`);
  } catch (error) {
    assert.fail(`bridge should still be reachable after error-path probes; exit=${bridgeExit}; error=${error?.message}; logs=${logs.join("")}`);
  }
  assert.equal(stillHealthy.status, 200, "bridge should survive client disconnect and stream cap errors");
  assert.equal(logs.join("").includes("SECRET_PROMPT_DO_NOT_LOG"), false, "bridge logs must not include full prompt bodies");
} finally {
  bridge.kill();
  upstream.close();
}

console.log("v7.3.13 bridge robustness tests passed.");
