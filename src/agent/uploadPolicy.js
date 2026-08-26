export const UPLOAD_POLICY = Object.freeze({
  maxFiles: 50,
  maxSingleFileBytes: 10 * 1024 * 1024,
  maxAggregateBytes: 50 * 1024 * 1024,
  readConcurrency: 3,
  detectionSampleBytes: 128 * 1024,
});

export function validateSelectedFiles(files, policy = UPLOAD_POLICY) {
  const list = [...(files ?? [])];
  if (list.length > policy.maxFiles) {
    throw new Error(`Upload limit exceeded: at most ${policy.maxFiles} files may be selected.`);
  }
  let aggregate = 0;
  for (const file of list) {
    const size = Number(file?.size ?? 0);
    if (size > policy.maxSingleFileBytes) {
      throw new Error(`Upload limit exceeded: ${file?.name ?? "file"} is ${size.toLocaleString()} bytes; max single-file size is ${policy.maxSingleFileBytes.toLocaleString()} bytes.`);
    }
    aggregate += size;
    if (aggregate > policy.maxAggregateBytes) {
      throw new Error(`Upload limit exceeded: selected files total ${aggregate.toLocaleString()} bytes; max aggregate size is ${policy.maxAggregateBytes.toLocaleString()} bytes.`);
    }
  }
  return list;
}

export async function mapWithConcurrency(items, limit, worker, { signal } = {}) {
  const list = [...(items ?? [])];
  const concurrency = Math.max(1, Math.floor(Number(limit) || 1));
  const out = new Array(list.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < list.length) {
      if (signal?.aborted) throw Object.assign(new Error("Upload cancelled."), { name: "AbortError" });
      const index = nextIndex;
      nextIndex += 1;
      out[index] = await worker(list[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, run));
  return out;
}

function abortError() {
  return Object.assign(new Error("Upload cancelled."), { name: "AbortError" });
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function sliceBlob(file, start, end) {
  if (typeof file?.slice === "function") return file.slice(start, end);
  return file;
}

async function readBlobStreamAsText(blob, { signal } = {}) {
  throwIfAborted(signal);
  if (!blob?.stream || typeof TextDecoder === "undefined") return null;
  const reader = blob.stream().getReader();
  const decoder = new TextDecoder();
  let text = "";
  const abort = () => {
    try { reader.cancel(abortError()); } catch {
      // The stream may already be closed.
    }
  };
  signal?.addEventListener?.("abort", abort, { once: true });
  try {
    while (true) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    throwIfAborted(signal);
    return text;
  } finally {
    signal?.removeEventListener?.("abort", abort);
    try { reader.releaseLock?.(); } catch {
      // Some polyfills do not support releaseLock after cancellation.
    }
  }
}

export function readFileText(file, { signal } = {}) {
  if (signal?.aborted) return Promise.reject(abortError());
  if (typeof file?.stream === "function") return readBlobStreamAsText(file, { signal });
  if (typeof file?.text === "function") {
    return file.text().then(text => {
      throwIfAborted(signal);
      return text;
    });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => {
      try { reader.abort(); } catch {
        // Some FileReader implementations throw if aborting after completion.
      }
      reject(abortError());
    };
    signal?.addEventListener?.("abort", abort, { once: true });
    reader.onload = event => {
      signal?.removeEventListener?.("abort", abort);
      if (signal?.aborted) {
        reject(abortError());
        return;
      }
      resolve(event.target.result);
    };
    reader.onerror = () => {
      signal?.removeEventListener?.("abort", abort);
      reject(reader.error ?? new Error("File read failed."));
    };
    reader.readAsText(file);
  });
}

export function readFileDetectionSample(file, { signal, sampleBytes = UPLOAD_POLICY.detectionSampleBytes } = {}) {
  const size = Math.max(0, Math.floor(Number(sampleBytes) || 0));
  const sample = sliceBlob(file, 0, size);
  return readFileText(sample, { signal });
}
