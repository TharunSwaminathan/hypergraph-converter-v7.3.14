#!/usr/bin/env node
import http from "node:http";
import { once } from "node:events";
import { URL } from "node:url";

export function readBoundedPositiveIntegerEnv(name, defaultValue, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === "") return defaultValue;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}; received ${JSON.stringify(raw)}.`);
  }
  return value;
}

const BRIDGE_HOST = process.env.HYPERGRAPH_BRIDGE_HOST || "127.0.0.1";
const BRIDGE_PORT = readBoundedPositiveIntegerEnv("HYPERGRAPH_BRIDGE_PORT", 8787, { min: 1, max: 65535 });
const MAX_BODY_BYTES = readBoundedPositiveIntegerEnv("HYPERGRAPH_BRIDGE_MAX_BODY_BYTES", 5 * 1024 * 1024, { min: 1, max: 50 * 1024 * 1024 });
const UPSTREAM_TIMEOUT_MS = readBoundedPositiveIntegerEnv("HYPERGRAPH_BRIDGE_UPSTREAM_TIMEOUT_MS", 60_000, { min: 100, max: 10 * 60_000 });
const MAX_RESPONSE_BYTES = readBoundedPositiveIntegerEnv("HYPERGRAPH_BRIDGE_MAX_RESPONSE_BYTES", 25 * 1024 * 1024, { min: 1024, max: 250 * 1024 * 1024 });
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";

// Edit this list or set HYPERGRAPH_BRIDGE_ORIGINS to a comma-separated list.
export const ALLOWED_ORIGINS = (process.env.HYPERGRAPH_BRIDGE_ORIGINS
  ? process.env.HYPERGRAPH_BRIDGE_ORIGINS.split(",")
  : [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://hypergraphproject.github.io",
  ])
  .map(origin => origin.trim())
  .filter(Boolean);

const ROUTES = new Map([
  ["GET /ollama/api/tags", { path: "/api/tags" }],
  ["POST /ollama/api/chat", { path: "/api/chat" }],
]);

function normalizeHost(hostname) {
  return String(hostname ?? "").toLowerCase().replace(/^\[|\]$/g, "");
}

function isPrivateIpv4(hostname) {
  const parts = normalizeHost(hostname).split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

function isAllowedOllamaTarget(baseUrl) {
  try {
    const url = new URL(baseUrl);
    const host = normalizeHost(url.hostname);
    return ["http:", "https:"].includes(url.protocol)
      && !url.username
      && !url.password
      && (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1" || isPrivateIpv4(host));
  } catch {
    return false;
  }
}

if (!isAllowedOllamaTarget(OLLAMA_BASE_URL)) {
  console.error(`[bridge] Refusing public or invalid Ollama target: ${OLLAMA_BASE_URL}`);
  process.exit(1);
}

function corsHeaders(origin, requestHeaders = "") {
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": requestHeaders || "content-type",
    "Access-Control-Max-Age": "600",
    "Access-Control-Allow-Private-Network": "true",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function sendJson(res, status, data, extraHeaders = {}) {
  if (res.writableEnded || res.destroyed) return;
  if (res.headersSent) {
    if (!res.writableEnded) res.end();
    return;
  }
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function limitError(message) {
  return Object.assign(new Error(message), { code: "LIMIT_EXCEEDED" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(limitError(`Request body exceeds ${MAX_BODY_BYTES} bytes.`));
        req.pause();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function targetUrl(route) {
  const base = new URL(OLLAMA_BASE_URL);
  base.pathname = route.path;
  base.search = "";
  return base.toString();
}

async function streamResponseWithCap(response, res, cors, controller) {
  res.writeHead(response.status, {
    ...cors,
    "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
  });
  const reader = response.body?.getReader?.();
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_RESPONSE_BYTES) throw limitError(`Upstream response exceeds ${MAX_RESPONSE_BYTES} bytes.`);
    res.end(buffer);
    return { ok: true, bytes: buffer.length };
  }
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      size += chunk.length;
      if (size > MAX_RESPONSE_BYTES) {
        controller.abort();
        res.destroy();
        return { ok: false, bytes: size, limitExceeded: true, streamStarted: true };
      }
      if (!res.write(chunk)) await once(res, "drain");
    }
    res.end();
    return { ok: true, bytes: size };
  } finally {
    reader.releaseLock?.();
  }
}

async function proxyRequest(req, res, route, cors) {
  let body;
  try {
    body = req.method === "POST" ? await readBody(req) : undefined;
  } catch (error) {
    if (error?.code === "LIMIT_EXCEEDED") {
      sendJson(res, 413, { ok: false, error: "request_body_too_large", message: error.message }, cors);
      return;
    }
    throw error;
  }

  const url = targetUrl(route);
  console.log(`[bridge] ${new Date().toISOString()} ${req.method} ${new URL(req.url, "http://bridge.local").pathname} -> ollama${route.path}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const clientClosed = () => { if (!res.writableEnded) controller.abort(); };
  req.on("aborted", clientClosed);
  res.on("close", clientClosed);
  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
        Accept: "application/json",
      },
      body,
      signal: controller.signal,
    });
    const streamed = await streamResponseWithCap(response, res, cors, controller);
    if (streamed.limitExceeded) console.warn(`[bridge] upstream response exceeded ${MAX_RESPONSE_BYTES} bytes after streaming began; downstream connection was closed.`);
  } catch (error) {
    if (res.writableEnded) return;
    if (error?.code === "LIMIT_EXCEEDED") {
      sendJson(res, 502, {
        ok: false,
        error: "bridge_upstream_response_too_large",
        message: error.message,
      }, cors);
      return;
    }
    const aborted = controller.signal.aborted;
    sendJson(res, 502, {
      ok: false,
      error: aborted ? "bridge_upstream_timeout_or_client_disconnect" : "bridge_runtime_unreachable",
      message: aborted
        ? `The bridge aborted the upstream request after ${UPSTREAM_TIMEOUT_MS}ms or because the client disconnected.`
        : `The bridge is running, but it could not reach Ollama at ${OLLAMA_BASE_URL}.`,
      detail: error instanceof Error ? error.message : String(error),
    }, cors);
  } finally {
    clearTimeout(timeout);
    req.off("aborted", clientClosed);
    res.off("close", clientClosed);
  }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  const cors = corsHeaders(origin, req.headers["access-control-request-headers"]);
  const originAllowed = !origin || ALLOWED_ORIGINS.includes(origin);
  const parsed = new URL(req.url, "http://bridge.local");

  if (req.method === "OPTIONS") {
    if (!originAllowed) {
      sendJson(res, 403, { ok: false, error: "origin_not_allowed", allowedOrigins: ALLOWED_ORIGINS }, cors);
      return;
    }
    res.writeHead(204, cors);
    res.end();
    return;
  }

  if (!originAllowed) {
    sendJson(res, 403, { ok: false, error: "origin_not_allowed", allowedOrigins: ALLOWED_ORIGINS }, cors);
    return;
  }

  if (req.method === "GET" && parsed.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "hypergraph-ollama-bridge",
      bind: `${BRIDGE_HOST}:${BRIDGE_PORT}`,
      ollamaBaseUrl: OLLAMA_BASE_URL,
      allowedOrigins: ALLOWED_ORIGINS,
      allowedRoutes: ["/health", "/ollama/api/tags", "/ollama/api/chat"],
      limits: {
        maxBodyBytes: MAX_BODY_BYTES,
        upstreamTimeoutMs: UPSTREAM_TIMEOUT_MS,
        maxResponseBytes: MAX_RESPONSE_BYTES,
      },
    }, cors);
    return;
  }

  const route = ROUTES.get(`${req.method} ${parsed.pathname}`);
  if (!route) {
    sendJson(res, 404, {
      ok: false,
      error: "path_not_allowed",
      message: "This bridge only forwards known Ollama endpoints.",
    }, cors);
    return;
  }

  try {
    await proxyRequest(req, res, route, cors);
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: "bridge_request_failed",
      message: error instanceof Error ? error.message : String(error),
    }, cors);
  }
});

server.listen(BRIDGE_PORT, BRIDGE_HOST, () => {
  console.log(`[bridge] Hypergraph Ollama bridge listening on http://${BRIDGE_HOST}:${BRIDGE_PORT}`);
  console.log(`[bridge] Ollama target: ${OLLAMA_BASE_URL}`);
  console.log(`[bridge] Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`[bridge] Limits: body=${MAX_BODY_BYTES} bytes, upstreamTimeout=${UPSTREAM_TIMEOUT_MS}ms, response=${MAX_RESPONSE_BYTES} bytes`);
  console.log("[bridge] Endpoints: /health, /ollama/api/tags, /ollama/api/chat");
  console.log("[bridge] Prompt/request bodies are forwarded in memory only and are not logged or stored.");
});
