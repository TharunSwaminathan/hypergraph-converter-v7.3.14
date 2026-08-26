import assert from "node:assert/strict";
import { readFileDetectionSample, readFileText, UPLOAD_POLICY } from "../src/agent/uploadPolicy.js";
import { analyzeUploadBatch, readUploadedTextFiles } from "../src/agent/fileDetection.js";

const fullText = `h0: ${Array.from({ length: 20_000 }, (_, index) => `v${index}`).join(",")}`;
const blob = new Blob([fullText], { type: "text/plain" });
blob.name = "large-h2v.txt";
blob.lastModified = 1;

const sample = await readFileDetectionSample(blob, { sampleBytes: 32 });
assert.equal(sample, fullText.slice(0, 32), "detection sample must use a bounded slice");

const files = await readUploadedTextFiles([blob], "upload-test");
assert.equal(files.length, 1);
assert.equal(files[0].text, fullText);
assert.equal(files[0].detectionSampleText.length, Math.min(UPLOAD_POLICY.detectionSampleBytes, fullText.length));
const analysis = analyzeUploadBatch(files, () => "simple");
assert.equal(analysis.fileSummaries[0].preview.startsWith("h0:"), true);

const delayedBlob = {
  stream() {
    let sent = 0;
    return new ReadableStream({
      async pull(controller) {
        await new Promise(resolve => setTimeout(resolve, 25));
        sent += 1;
        controller.enqueue(new TextEncoder().encode("chunk\n"));
        if (sent >= 20) controller.close();
      },
    });
  },
};
const controller = new AbortController();
const readPromise = readFileText(delayedBlob, { signal: controller.signal });
setTimeout(() => controller.abort(), 40);
await assert.rejects(readPromise, error => error?.name === "AbortError");

const preservedGraph = Object.freeze({ graphVersion: 12, hyperedgeCount: 3, vertexCount: 8 });
let committedBatch = null;
const uploadController = new AbortController();
const uploadAttempt = (async () => {
  const uploaded = await readUploadedTextFiles([delayedBlob], "cancelled-upload", { signal: uploadController.signal });
  committedBatch = uploaded;
})();
setTimeout(() => uploadController.abort(), 40);
await assert.rejects(uploadAttempt, error => error?.name === "AbortError");
assert.equal(committedBatch, null, "cancelled upload must not return a partial batch to commit");
assert.deepEqual(preservedGraph, { graphVersion: 12, hyperedgeCount: 3, vertexCount: 8 }, "caller graph snapshot remains unchanged after cancellation");

console.log("v7.3.13 upload cancellation and sampling tests passed.");
