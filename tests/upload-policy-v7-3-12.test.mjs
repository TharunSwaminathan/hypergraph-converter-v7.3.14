import assert from "node:assert/strict";
import {
  isAcceptedUploadFileName,
  mapWithConcurrency,
  readFileText,
  UPLOAD_ACCEPT_ATTRIBUTE,
  UPLOAD_POLICY,
  validateSelectedFiles,
} from "../src/agent/uploadPolicy.js";

function file(name, size, text = "x") {
  return { name, size, text: async () => text, type: "text/plain", lastModified: 1 };
}

assert.throws(() => validateSelectedFiles(Array.from({ length: UPLOAD_POLICY.maxFiles + 1 }, (_, i) => file(`f${i}.txt`, 1))), /at most/);
assert.throws(() => validateSelectedFiles([file("huge.txt", UPLOAD_POLICY.maxSingleFileBytes + 1)]), /max single-file size/);
assert.throws(() => validateSelectedFiles([
  file("a.txt", UPLOAD_POLICY.maxSingleFileBytes),
  file("b.txt", UPLOAD_POLICY.maxSingleFileBytes),
  file("c.txt", UPLOAD_POLICY.maxSingleFileBytes),
  file("d.txt", UPLOAD_POLICY.maxSingleFileBytes),
  file("e.txt", UPLOAD_POLICY.maxSingleFileBytes),
  file("b.txt", 1),
]), /max aggregate size/);
assert.equal(validateSelectedFiles([file("ok.txt", 10)]).length, 1);
for (const name of ["graph.edge", "graph.EDGE", "graph.EdGe", "graph.edges"]) {
  assert.equal(isAcceptedUploadFileName(name), true, `${name} must be accepted by the shared extension policy`);
  assert.equal(validateSelectedFiles([file(name, 10)]).length, 1);
}
assert.equal(isAcceptedUploadFileName("graph.edg"), false);
assert.throws(() => validateSelectedFiles([file("graph.edg", 10)]), /Unsupported upload extension/);
assert.match(UPLOAD_ACCEPT_ATTRIBUTE, /\.edge(?:,|$)/);
assert.match(UPLOAD_ACCEPT_ATTRIBUTE, /\.edges(?:,|$)/);
assert.deepEqual(
  {
    maxFiles: UPLOAD_POLICY.maxFiles,
    maxSingleFileBytes: UPLOAD_POLICY.maxSingleFileBytes,
    maxAggregateBytes: UPLOAD_POLICY.maxAggregateBytes,
  },
  { maxFiles: 50, maxSingleFileBytes: 10 * 1024 * 1024, maxAggregateBytes: 50 * 1024 * 1024 },
);
assert.equal(await readFileText(file("ok.txt", 1, "hello")), "hello");

let active = 0;
let peak = 0;
const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async value => {
  active += 1;
  peak = Math.max(peak, active);
  await new Promise(resolve => setTimeout(resolve, 5));
  active -= 1;
  return value * 2;
});
assert.deepEqual(result, [2, 4, 6, 8, 10]);
assert.ok(peak <= 2, `expected bounded concurrency <= 2, saw ${peak}`);

const controller = new AbortController();
controller.abort();
await assert.rejects(() => mapWithConcurrency([1], 1, async value => value, { signal: controller.signal }), /Upload cancelled/);

console.log("v7.3.12 upload policy tests passed.");
