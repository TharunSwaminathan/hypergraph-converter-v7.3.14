import assert from "node:assert/strict";
import { fetchJson } from "../src/agent/localModelClient.js";

const originalFetch = globalThis.fetch;

try {
  const controller = new AbortController();
  globalThis.fetch = async (_url, options) => {
    await new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
      setTimeout(resolve, 1000);
    });
    return new Response("{}", { status: 200 });
  };
  const pending = fetchJson("http://localhost:11434/api/chat", { signal: controller.signal }, 10000);
  controller.abort();
  await assert.rejects(pending, error => {
    assert.equal(error.classification, "request_aborted");
    return true;
  });

  globalThis.fetch = async (_url, options) => {
    await new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    });
  };
  await assert.rejects(
    fetchJson("http://localhost:11434/api/chat", {}, 1),
    error => {
      assert.equal(error.classification, "model_generation_timeout");
      return true;
    },
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log("local model cancellation tests passed.");
