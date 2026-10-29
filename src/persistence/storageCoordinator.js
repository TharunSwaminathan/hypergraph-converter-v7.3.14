import { normalizeThreadRecord } from "./threadStateSchema.js";
import { fault } from "./storageSafety.js";

const content = record => JSON.stringify({ messages: record.messages, summary: record.summary, workspace: record.workspace });
export function createStorageCoordinator({ store, projectId, revision, record = null }) {
  let active = true, epoch = 0, running = false, latest = null, failed = false, sequence = 0;
  let committedContent = record ? content(record) : null;
  let snapshot = Object.freeze({ state: record ? "clean" : "dirty", projectId, committedRevision: revision, sequence: 0, committedSequence: 0, unsaved: !record, error: "", code: null });
  const listeners = new Set();
  const waiters = new Set();
  const finishWaiters = () => { if (!running && (!latest || failed || !active)) { for (const resolve of waiters) resolve(snapshot); waiters.clear(); } };
  const publish = patch => { snapshot = Object.freeze({ ...snapshot, ...patch }); if (active) for (const listener of listeners) listener(); };
  function errorState(error) {
    const value = fault(error); failed = true;
    publish({ state: value.code === "CONFLICT" ? "conflict" : value.readOnly ? "read_only" : "error", error: value.message, code: value.code });
  }
  async function drain() {
    if (running || !active || failed) return;
    running = true;
    const generation = epoch;
    try {
      while (active && generation === epoch && latest && !failed) {
        const pending = latest; latest = null;
        publish({ state: "writing", unsaved: true });
        try {
          // Store resolves only after transaction.oncomplete, never request success.
          const receipt = await store.saveThread(projectId, snapshot.committedRevision, pending.value);
          if (!active || generation !== epoch) return;
          committedContent = pending.content;
          publish({ state: latest ? "queued" : "committed", committedRevision: receipt.revision, committedSequence: pending.sequence,
            unsaved: Boolean(latest), code: null, error: "" });
        } catch (error) {
          if (!active || generation !== epoch) return;
          latest ??= pending; errorState(error);
        }
      }
    } finally { running = false; finishWaiters(); }
  }
  const unsubscribe = store.subscribe?.(error => { if (active) { epoch++; errorState(error); } });
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    enqueue(value) {
      if (!active) return false;
      try {
        const safe = normalizeThreadRecord({ ...value, schemaVersion: value.schemaVersion ?? 1 });
        const signature = content(safe);
        if (!running && !latest && signature === committedContent) return true;
        latest = { value: safe, content: signature, sequence: ++sequence };
        publish({ state: failed ? snapshot.state : "dirty", sequence, unsaved: true });
        if (!failed) { publish({ state: "queued" }); void drain(); }
        return true;
      } catch (error) { publish({ unsaved: true }); errorState(error); return false; }
    },
    async retry() {
      if (!active || ["CONFLICT", "DELETED", "VERSION_CHANGED", "INCOMPATIBLE", "CORRUPT", "LIMIT"].includes(snapshot.code)) return false;
      try { await store.retry(); failed = false; publish({ state: "queued", code: null, error: "" }); await drain(); return !failed; }
      catch (error) { errorState(error); return false; }
    },
    async flush() {
      await drain();
      if (!running && (!latest || failed || !active)) return snapshot;
      return new Promise(resolve => waiters.add(resolve));
    },
    dispose() {
      active = false; epoch++; latest = null; unsubscribe?.(); listeners.clear();
      // No false acknowledgement: an unsaved disposed owner remains unsaved.
      snapshot = Object.freeze({ ...snapshot, state: snapshot.unsaved ? "abandoned" : snapshot.state });
      for (const resolve of waiters) resolve(snapshot); waiters.clear();
    },
  });
}

export function storageStatusText(receipt) {
  if (!receipt) return "Opening project storage. This session is not saved yet.";
  if (receipt.state === "committed" || receipt.state === "clean") return `Chat committed to browser storage at project revision ${receipt.committedRevision}. This is not a backup or a physical power-loss guarantee.`;
  if (receipt.error) return `${receipt.error} Local changes are not saved. Original records are preserved.`;
  return "Chat has unsaved changes. Waiting for the browser storage transaction to complete.";
}
