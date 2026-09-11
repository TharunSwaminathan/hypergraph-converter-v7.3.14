import assert from "node:assert/strict";
import { startCandyRuntime } from "../candy-runtime/src/server.js";

await assert.rejects(startCandyRuntime({ host: "0.0.0.0", port: 0 }), /only to 127\.0\.0\.1/);

const runtime = await startCandyRuntime({ port: 0, backendAvailable: true, pairingToken: "scope2-test-token-abcdefghijklmnopqrstuvwxyz" });
const base = `http://127.0.0.1:${runtime.port}`;
const allowedOrigin = "http://localhost:5173";

try {
  const health = await fetch(`${base}/v1/health`);
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.runtimeStatus, "ready");
  assert.equal(JSON.stringify(healthBody).includes(runtime.pairingToken), false);
  assert.equal(JSON.stringify(healthBody).includes("Users"), false);

  const missing = await fetch(`${base}/v1/capabilities`, { headers: { Origin: allowedOrigin } });
  assert.equal(missing.status, 401);
  const wrong = await fetch(`${base}/v1/capabilities`, { headers: { Origin: allowedOrigin, Authorization: "Bearer wrong-token-that-is-long-enough-value" } });
  assert.equal(wrong.status, 401);
  const wrongOrigin = await fetch(`${base}/v1/capabilities`, { headers: { Origin: "https://evil.example", Authorization: `Bearer ${runtime.pairingToken}` } });
  assert.equal(wrongOrigin.status, 403);
  const malformedOrigin = await fetch(`${base}/v1/capabilities`, { headers: { Origin: "http://localhost:5173.evil.example", Authorization: `Bearer ${runtime.pairingToken}` } });
  assert.equal(malformedOrigin.status, 403);

  const capabilities = await fetch(`${base}/v1/capabilities`, { headers: { Origin: allowedOrigin, Authorization: `Bearer ${runtime.pairingToken}` } });
  assert.equal(capabilities.status, 200);
  assert.equal(capabilities.headers.get("access-control-allow-origin"), allowedOrigin);
  const body = await capabilities.json();
  assert.equal(body.schemaVersion, "candy.capabilities/1");
  assert.deepEqual(body.capabilities.map(item => item.algorithm), ["SSSP"]);
  assert.equal(JSON.stringify(body).includes("CUDA"), false);
  assert.equal(JSON.stringify(body).includes("ESCHER"), false);

  const preflight = await fetch(`${base}/v1/jobs`, { method: "OPTIONS", headers: { Origin: allowedOrigin, "Access-Control-Request-Private-Network": "true" } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-private-network"), "true");

  const unknownSchema = await fetch(`${base}/v1/artifacts`, {
    method: "POST",
    headers: { Origin: allowedOrigin, Authorization: `Bearer ${runtime.pairingToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ schemaVersion: "candy.artifact-upload/999", mediaType: "application/json", contentEncoding: "utf8", content: "{}" }),
  });
  assert.equal(unknownSchema.status, 400);

  const unavailable = await startCandyRuntime({ port: 0, backendAvailable: false, pairingToken: "scope2-test-token-unavailable-abcdefghijkl" });
  try {
    const response = await fetch(`http://127.0.0.1:${unavailable.port}/v1/capabilities`, { headers: { Authorization: `Bearer ${unavailable.pairingToken}` } });
    assert.deepEqual((await response.json()).capabilities, []);
  } finally { await unavailable.close(); }

  const bounded = await startCandyRuntime({ port: 0, backendAvailable: false, pairingToken: "scope2-test-token-bounded-abcdefghijklmnop", limits: { requestBytes: 256, artifactBytes: 10 } });
  try {
    const boundedBase = `http://127.0.0.1:${bounded.port}`;
    const authHeaders = { Authorization: `Bearer ${bounded.pairingToken}`, "Content-Type": "application/json" };
    const oversizedRequest = await fetch(`${boundedBase}/v1/artifacts`, { method: "POST", headers: authHeaders, body: JSON.stringify({ schemaVersion: "candy.artifact-upload/1", mediaType: "application/json", contentEncoding: "utf8", content: "x".repeat(500) }) });
    assert.equal(oversizedRequest.status, 413);
    const oversizedArtifact = await fetch(`${boundedBase}/v1/artifacts`, { method: "POST", headers: authHeaders, body: JSON.stringify({ schemaVersion: "candy.artifact-upload/1", mediaType: "application/json", contentEncoding: "utf8", content: "12345678901" }) });
    assert.equal(oversizedArtifact.status, 413);
  } finally { await bounded.close(); }
} finally {
  await runtime.close();
}

console.log("CANDY Scope 2 C1 runtime/auth/origin/capability qualification passed.");
