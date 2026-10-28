import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { request as httpRequest } from "node:http";
import { writeFile } from "node:fs/promises";
import { startCandyRuntime } from "../candy-runtime/src/server.js";
import { createCandyClient } from "../src/candy/client.js";
import { createArtifactPresenceCache } from "../src/candy/artifactPresence.js";

const report = { status: "RUNNING", positiveRoutes: [], negativeRoutes: [], reuse: {}, cleanShutdown: false };
const runtime = await startCandyRuntime({ port: 0 });
let isolated;
const baseUrl = `http://127.0.0.1:${runtime.port}`;
const requests = [];
const client = createCandyClient({ baseUrl, token: runtime.pairingToken, fetchImpl: async (url, options) => {
  const response = await fetch(url, options);
  requests.push({ method: options.method, path: new URL(url).pathname, status: response.status });
  return response;
} });
const uploadCount = () => requests.filter(value => value.method === "POST" && value.path === "/v1/artifacts").length;
const raw = (path, { token = runtime.pairingToken, origin = "http://localhost:5173", method = "GET" } = {}) => new Promise((resolve, reject) => {
  // A raw HTTP path preserves adversarial spellings that URL/fetch may normalize.
  const req = httpRequest({ hostname: runtime.host, port: runtime.port, path, method, headers: {
    Origin: origin, ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
  } }, response => {
    const chunks = [];
    response.on("data", chunk => chunks.push(chunk));
    response.on("end", () => {
      try { resolve({ path, method, status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }); }
      catch (error) { reject(error); }
    });
  });
  req.setTimeout(5000, () => req.destroy(new Error("Artifact route response exceeded its bound.")));
  req.on("error", reject); req.end();
});

try {
  const text = '{"scope6e":"fresh artifact metadata"}';
  const artifact = await client.uploadArtifact({ bytes: text, mediaType: "application/json" });
  assert.equal(artifact.id, `sha256:${createHash("sha256").update(text).digest("hex")}`);
  report.artifact = artifact;

  const literal = await raw(`/v1/artifacts/${artifact.id}/metadata`);
  report.positiveRoutes.push(literal);
  assert.equal(literal.status, 200); assert.deepEqual(literal.body, artifact);
  // This is the exact V5 regression: baseline fails here after a successful fresh upload.
  const metadata = await client.getArtifactMetadata(artifact.id);
  report.clientMetadata = metadata;
  assert.deepEqual(metadata, artifact);
  for (const separator of ["%3A", "%3a"]) {
    const response = await raw(`/v1/artifacts/sha256${separator}${artifact.id.slice(7)}/metadata`);
    report.positiveRoutes.push(response);
    assert.equal(response.status, 200); assert.deepEqual(response.body, artifact);
  }

  const digest = artifact.id.slice(7);
  const invalidIds = [
    `sha256:${digest.slice(1)}`, `sha256:${digest}0`, `sha256:${"g".repeat(64)}`,
    `sha256:${"A".repeat(64)}`, `SHA256:${digest}`, `sha512:${digest}`,
    `sha256%253A${digest}`, `sha256%25${digest}`, `sha256%3${digest}`,
    `sha256%GG${digest}`, `sha256%${digest}`, `sha256:%`,
    `%73ha256%3A${digest}`, `sha256%3A%61${digest.slice(1)}`,
    `sha256:${digest}%2Fother`, `sha256:${digest}%2fother`,
    `sha256:${digest}%5Cother`, `sha256:${digest}%5cother`,
    `sha256:${digest}%252Fother`, `sha256:${digest}%255Cother`,
    `sha256:${digest}/other`, `sha256:${digest}\\other`,
    "sha256:../secret", "sha256:..%2F..%2Fsecret", "sha256:%2e%2e%2fsecret",
    `sha256:${digest}?ignored`, `sha256:${digest}#ignored`,
    `sha256:${digest}%3Fignored`, `sha256:${digest}%23ignored`,
    `sha256:${digest}%00`, `sha256:${digest}%20`,
  ];
  const invalidPaths = invalidIds.map(id => `/v1/artifacts/${id}/metadata`);
  invalidPaths.push(`/v1/artifacts/${artifact.id}/metadata/extra`, `/v1/artifacts/${artifact.id}/metadata?query=1`,
    `/v1/artifacts/${artifact.id}/metadata#fragment`, `/v1/artifacts/${artifact.id}/metadata/`,
    `/v1/artifacts//${artifact.id}/metadata`);
  for (const path of invalidPaths) {
    const response = await raw(path); report.negativeRoutes.push(response);
    assert.equal(response.status, 404, path);
    assert.equal(response.body.message, "Unknown runtime route.", path);
  }
  await assert.rejects(client.getArtifactMetadata(`${artifact.id}/extra`), error => error.details.httpStatus === 404);
  await assert.rejects(client.getArtifactMetadata(`${artifact.id}?query`), error => error.details.httpStatus === 404);
  await assert.rejects(client.getArtifactMetadata(`${artifact.id}#fragment`), error => error.details.httpStatus === 404);
  const absent = await raw(`/v1/artifacts/sha256%3A${"0".repeat(64)}/metadata`);
  assert.equal(absent.status, 404); assert.equal(absent.body.message, "Artifact is unknown or expired.");
  report.absentCanonicalId = absent;

  for (const path of [`/v1/artifacts/${artifact.id}/metadata`, `/v1/artifacts/sha256%3A${digest}/metadata`]) {
    assert.equal((await raw(path, { token: null })).status, 401);
    assert.equal((await raw(path, { token: "wrong-session" })).status, 401);
    assert.equal((await raw(path, { origin: "http://unapproved.invalid" })).status, 403);
    for (const method of ["POST", "DELETE"]) assert.equal((await raw(path, { method })).status, 404);
  }
  report.authenticationAndMethodControls = "PASS";

  const cache = createArtifactPresenceCache();
  const inputText = '{"scope6e":"reuse a still-present artifact"}';
  const id = `sha256:${createHash("sha256").update(inputText).digest("hex")}`;
  const input = { text: inputText, id, mediaType: "application/json", runtimeSessionId: runtime.jobs.runtimeSessionId };
  const countBefore = uploadCount();
  await cache.upload(client, input, () => {});
  const first = uploadCount(); assert.equal(first, countBefore + 1);
  const cached = await cache.upload(client, input, () => {});
  assert.equal(cached.id, id); assert.equal(uploadCount(), first, "Present metadata must avoid a false-eviction reupload.");
  // Evict only this real disposable test artifact through the actual store.
  await runtime.artifactStore.evict(id);
  const restored = await cache.upload(client, input, () => {});
  assert.equal(restored.id, id); assert.equal(uploadCount(), first + 1, "Real absence must trigger exactly one upload.");
  report.reuse = { presentDetectedWithoutUpload: true, genuineEvictionReuploadedOnce: true };
  for (const [name, token, origin, expected] of [
    ["unauthorized", "wrong-session", "http://localhost:5173", 401],
    ["unapproved-origin", runtime.pairingToken, "http://unapproved.invalid", 403],
  ]) {
    let writes = 0;
    const rejectedClient = createCandyClient({ baseUrl, token, fetchImpl: async (url, options) => {
      if (options.method === "POST") writes++;
      return fetch(url, { ...options, headers: { ...options.headers, Origin: origin } });
    } });
    await assert.rejects(cache.upload(rejectedClient, input, () => {}), error => error.details.httpStatus === expected);
    assert.equal(writes, 0, `${name} must not be mistaken for an evicted artifact.`);
  }
  report.reuse.authorityFailuresPropagatedWithoutUpload = true;

  isolated = await startCandyRuntime({ port: 0 });
  const otherClient = createCandyClient({ baseUrl: `http://127.0.0.1:${isolated.port}`, token: isolated.pairingToken });
  await assert.rejects(otherClient.getArtifactMetadata(artifact.id), error => error.details.httpStatus === 404 && /unknown or expired/.test(error.message));
  const wrongSession = createCandyClient({ baseUrl, token: isolated.pairingToken });
  await assert.rejects(wrongSession.getArtifactMetadata(artifact.id), error => error.classification === "UNAUTHORIZED");
  report.ownershipIsolation = "PASS";
  assert.deepEqual(await client.getArtifactMetadata(artifact.id), artifact, "Rejected aliases must not mutate the canonical artifact.");
  report.status = "PASS";
} catch (error) {
  report.status = "NON-PASS";
  report.error = { name: error.name, message: error.message, classification: error.classification, details: error.details };
  throw error;
} finally {
  await isolated?.close(); await runtime.close(); report.cleanShutdown = true;
  report.requests = requests;
  if (process.env.CANDY_ARTIFACT_ROUTE_REPORT) await writeFile(process.env.CANDY_ARTIFACT_ROUTE_REPORT, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
}
console.log(`Scope6E real Runtime/client artifact metadata, presence reuse, isolation and ${report.negativeRoutes.length} adversarial raw routes passed.`);
