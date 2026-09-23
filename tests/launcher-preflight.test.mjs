import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  canBindLoopback,
  findAvailableLoopbackPort,
  inspectBridgeHealth,
} from "../scripts/launcher-preflight.mjs";

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

async function close(server) {
  await new Promise((resolveClose, rejectClose) => {
    server.close(error => error ? rejectClose(error) : resolveClose());
    server.closeAllConnections?.();
  });
}

const readyServer = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "hypergraph-ollama-bridge" }));
});
const readyPort = await listen(readyServer);
assert.deepEqual(
  await inspectBridgeHealth(`http://127.0.0.1:${readyPort}/health`),
  { status: "ready", service: "hypergraph-ollama-bridge", data: { ok: true, service: "hypergraph-ollama-bridge" } },
);

const unrelatedServer = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "some-other-service" }));
});
const unrelatedPort = await listen(unrelatedServer);
const unrelated = await inspectBridgeHealth(`http://127.0.0.1:${unrelatedPort}/health`);
assert.equal(unrelated.status, "occupied", "generic HTTP 200 must not count as bridge health");
assert.equal(unrelated.service, "some-other-service");

const rawSockets = new Set();
const rawServer = net.createServer(socket => {
  rawSockets.add(socket);
  socket.on("close", () => rawSockets.delete(socket));
  socket.on("error", () => {});
  socket.end("not http");
});
const rawPort = await listen(rawServer);
assert.equal((await inspectBridgeHealth(`http://127.0.0.1:${rawPort}/health`)).status, "occupied");

const occupiedPort = readyPort;
assert.equal(await canBindLoopback(occupiedPort), false);
const selectedPort = await findAvailableLoopbackPort(occupiedPort, 2);
assert.equal(selectedPort, occupiedPort + 1, "port selection should advance past an occupied frontend port");
assert.equal(await canBindLoopback(selectedPort), true);

const freeProbe = net.createServer();
const freePort = await listen(freeProbe);
await close(freeProbe);
assert.equal((await inspectBridgeHealth(`http://127.0.0.1:${freePort}/health`)).status, "free");
assert.equal((await inspectBridgeHealth("not a url")).status, "invalid");

for (const socket of rawSockets) socket.destroy();
await close(rawServer);
await close(unrelatedServer);
await close(readyServer);

const files = {
  windows: await readFile(resolve("run-with-ollama.bat"), "utf8"),
  posix: await readFile(resolve("run-with-ollama.sh"), "utf8"),
  windowsBridge: await readFile(resolve("run-local-runtime-bridge.bat"), "utf8"),
  posixBridge: await readFile(resolve("run-local-runtime-bridge.sh"), "utf8"),
  bridge: await readFile(resolve("local-runtime-bridge.js"), "utf8"),
};
for (const [name, source] of Object.entries(files)) {
  assert.doesNotMatch(source, /HYPERGRAPH_BRIDGE_ORIGINS[^\r\n]*=\*/i, `${name} must not configure a wildcard bridge origin`);
}
for (const source of [files.windows, files.posix]) {
  assert.match(source, /launcher-preflight\.mjs find-frontend-port/);
  assert.match(source, /launcher-preflight\.mjs bridge-status/);
  assert.match(source, /--strictPort/);
  assert.match(source, /HYPERGRAPH_BRIDGE_ORIGINS/);
}
assert.match(files.windows, /VITE_HYPERGRAPH_BRIDGE_PORT=%HYPERGRAPH_BRIDGE_PORT%/);
assert.match(files.posix, /VITE_HYPERGRAPH_BRIDGE_PORT=.*HYPERGRAPH_BRIDGE_PORT/);
assert.doesNotMatch(files.windows, /Dashboard URL: http:\/\/localhost:5173/);
assert.doesNotMatch(files.posix, /Dashboard: http:\/\/localhost:5173/);
assert.match(files.bridge, /wildcards and blank values are not allowed/);
assert.match(files.bridge, /url\.origin/);

const allowedOrigin = "http://127.0.0.1:5199";
const exactOriginBridge = spawn(process.execPath, [resolve("local-runtime-bridge.js")], {
  env: {
    ...process.env,
    HYPERGRAPH_BRIDGE_PORT: String(freePort),
    HYPERGRAPH_BRIDGE_ORIGINS: allowedOrigin,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
await new Promise((resolveReady, rejectReady) => {
  const timer = setTimeout(() => rejectReady(new Error("exact-origin bridge did not start")), 5000);
  exactOriginBridge.stdout.on("data", chunk => {
    if (String(chunk).includes("listening")) {
      clearTimeout(timer);
      resolveReady();
    }
  });
  exactOriginBridge.once("exit", code => rejectReady(new Error(`exact-origin bridge exited early with ${code}`)));
});
const allowedHealth = await fetch(`http://127.0.0.1:${freePort}/health`, { headers: { Origin: allowedOrigin } });
assert.equal(allowedHealth.status, 200);
assert.equal(allowedHealth.headers.get("access-control-allow-origin"), allowedOrigin);
const deniedHealth = await fetch(`http://127.0.0.1:${freePort}/health`, { headers: { Origin: `${allowedOrigin}.evil.example` } });
assert.equal(deniedHealth.status, 403, "origin prefix lookalikes must be rejected");
exactOriginBridge.kill();
await once(exactOriginBridge, "exit");

const invalidOriginBridge = spawn(process.execPath, [resolve("local-runtime-bridge.js")], {
  env: {
    ...process.env,
    HYPERGRAPH_BRIDGE_PORT: String(freePort),
    HYPERGRAPH_BRIDGE_ORIGINS: "*",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
const [invalidExit] = await once(invalidOriginBridge, "exit");
assert.notEqual(invalidExit, 0, "wildcard bridge origins must fail closed at startup");

console.log("Launcher port/origin preflight and bridge identity tests passed.");
