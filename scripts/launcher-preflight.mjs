#!/usr/bin/env node
import net from "node:net";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function integer(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

export function canBindLoopback(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => server.close(() => resolve(true)));
  });
}

export async function findAvailableLoopbackPort(startPort = 5173, attempts = 20) {
  const start = integer(startPort, 5173);
  const count = Math.max(1, Math.min(100, integer(attempts, 20)));
  for (let port = start; port < start + count && port <= 65535; port += 1) {
    if (await canBindLoopback(port)) return port;
  }
  return null;
}

function canConnect(host, port, timeoutMs = 750) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    const finish = value => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

export async function inspectBridgeHealth(urlValue, { timeoutMs = 2000 } = {}) {
  let url;
  try {
    url = new URL(urlValue);
  } catch {
    return { status: "invalid", service: null };
  }
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  if (!await canConnect(url.hostname, port)) return { status: "free", service: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("bridge_health_timeout"), timeoutMs);
  try {
    const response = await fetch(url, { method: "GET", redirect: "error", signal: controller.signal });
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* An unrelated responder may not return JSON. */ }
    if (response.status === 200 && data?.service === "hypergraph-ollama-bridge") {
      return { status: "ready", service: data.service, data };
    }
    return { status: "occupied", service: data?.service ?? null, httpStatus: response.status };
  } catch {
    return { status: "occupied", service: null };
  } finally {
    clearTimeout(timer);
  }
}

async function main(argv) {
  const [command, ...args] = argv;
  if (command === "find-frontend-port") {
    const port = await findAvailableLoopbackPort(args[0], args[1]);
    if (!port) process.exitCode = 2;
    else process.stdout.write(String(port));
    return;
  }
  if (command === "bridge-status") {
    const result = await inspectBridgeHealth(args[0] || "http://127.0.0.1:8787/health");
    process.stdout.write(result.status);
    if (result.status === "invalid") process.exitCode = 2;
    return;
  }
  process.stderr.write("Usage: node scripts/launcher-preflight.mjs find-frontend-port [start] [attempts] | bridge-status [health-url]\n");
  process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main(process.argv.slice(2));
}
