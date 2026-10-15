import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

// A poll count is not a time budget: Windows/Node timer cadence can change
// how much preparation time the same number of polls actually permits.
export async function waitForJobStatus(readStatus, jobId, {
  timeoutMs,
  statuses = [...TERMINAL],
  pollIntervalMs = 10,
} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1
    || !Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 1) {
    throw new TypeError("Job polling requires a finite positive deadline and interval.");
  }
  const started = performance.now();
  const controller = new AbortController();
  let polls = 0;
  let last = null;
  const diagnostic = () => new Error(`Job ${jobId} did not reach ${statuses.join("/")} within ${timeoutMs} ms; elapsed=${Math.round(performance.now() - started)} ms; polls=${polls}; lastStatus=${last?.status ?? "none"}; lifecycle=${JSON.stringify(last?.lifecycle ?? [])}; error=${JSON.stringify(last?.error ?? null)}`);
  let rejectDeadline;
  const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
  const timer = setTimeout(() => {
    const error = diagnostic();
    rejectDeadline(error);
    controller.abort(error);
  }, timeoutMs);
  try {
    while (true) {
      if (performance.now() - started >= timeoutMs) throw diagnostic();
      polls += 1;
      last = await Promise.race([readStatus(jobId, { signal: controller.signal }), deadline]);
      if (performance.now() - started >= timeoutMs) throw diagnostic();
      if (statuses.includes(last.status)) return last;
      if (TERMINAL.has(last.status)) {
        throw new Error(`Job ${jobId} reached unexpected terminal ${last.status}: ${JSON.stringify(last.error ?? null)}`);
      }
      await Promise.race([
        delay(Math.min(pollIntervalMs, Math.max(1, timeoutMs - (performance.now() - started))), undefined, { signal: controller.signal }),
        deadline,
      ]);
    }
  } finally {
    clearTimeout(timer);
    // Also stop an outstanding status read if the monotonic check won a race
    // with the deadline timer. Normal success has already consumed its read.
    controller.abort();
  }
}
