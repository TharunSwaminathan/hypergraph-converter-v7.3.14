import { historyCompletionRecord } from "./analysisHistorySchema.js";
import { StorageFault, fault } from "./storageSafety.js";

export function createAnalysisHistoryCoordinator(session, { isCurrent = () => true } = {}) {
  let active = true, initialized = null, projectId = null;
  let snapshot = Object.freeze({ status: "loading", records: [], message: "Checking analysis history…", publicationRevision: null });
  const listeners = new Set(), pending = new Map();
  const current = () => active && isCurrent();
  const emit = patch => { if (active) { snapshot = Object.freeze({ ...snapshot, ...patch }); for (const fn of listeners) fn(); } };
  async function reload() {
    const data = await session.readAnalysisHistory(projectId);
    if (!current()) throw new StorageFault("ABANDONED", "Historical view owner changed.", true);
    emit({ records: data.envelope?.records ?? [], status: "ready", message: "Historical results are read-only evidence. Nothing runs automatically." });
    return data;
  }
  function initialize() {
    initialized ??= session.defaultProject().then(async p => { projectId = p.projectId; emit({ projectId }); return reload(); }).catch(error => { const e = fault(error); emit({ status: "error", code: e.code, message: "Analysis history unavailable. " + e.message }); throw e; });
    return initialized;
  }
  async function complete(event) {
    if (!active) return { saved: false, abandoned: true };
    if (!isCurrent()) { emit({ status: "error", code: "CONFLICT", message: "Analysis completed. History was not saved because this project changed in another owner. Reload first." }); return { saved: false, abandoned: true }; }
    if (pending.has(event.operationId)) return pending.get(event.operationId);
    const operation = (async () => {
      let committed = null;
      try {
        await initialize();
        if (!current() || event.context.projectId !== projectId) throw new StorageFault("ABANDONED", "Completed analysis belongs to an obsolete project.", true);
        emit({ status: "writing", code: null, message: "Analysis completed. Saving historical result…" });
        const record = await historyCompletionRecord({ ...event, projectId, ...event.context });
        if (!current()) throw new StorageFault("ABANDONED", "Analysis owner changed while history was prepared.", true);
        const p = await session.defaultProject();
        const receipt = await session.mutateAnalysisHistory(projectId, p.revision, { kind: "append", record }, current);
        committed = receipt;
        if (!current()) return receipt;
        await reload();
        emit({ status: "ready", message: receipt.duplicate ? "This completed analysis was already archived." : "Analysis completed. History persisted.", ...(receipt.saved ? { publicationRevision: receipt.revision } : {}) });
        return receipt;
      } catch (error) {
        const e = fault(error);
        if (committed?.saved || committed?.duplicate) { emit({ status: "error", code: e.code, publicationRevision: committed.revision ?? snapshot.publicationRevision, message: "History persisted. Reload the historical view; discovery was interrupted." }); return committed; }
        emit({ status: "error", code: e.code, message: "Analysis completed. History was not saved. " + e.message });
        return { ok: false, saved: false, code: e.code };
      }
    })();
    pending.set(event.operationId, operation);
    if (pending.size > 64) pending.delete(pending.keys().next().value);
    return operation;
  }
  return Object.freeze({
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => snapshot, initialize, complete, reload,
    async review(command) { await initialize(); if (!current()) throw new StorageFault("ABANDONED", "History owner changed.", true); const token = await session.captureDestructive(projectId, "history", command); return Object.freeze({ token, command: Object.freeze({ ...command }) }); },
    async commitReview(review) {
      if (!current()) throw new StorageFault("ABANDONED", "History owner changed.", true);
      let committed = null;
      try { const receipt = await session.clearReviewed(review.token, "history", review.command, current); committed = receipt; if (current()) { await reload(); emit({ publicationRevision: receipt.revision, message: "Historical result deletion committed. Workspace and memory are retained." }); } return receipt; }
      catch (error) { const e = fault(error); if (committed?.saved) { emit({ status: "error", publicationRevision: committed.revision, message: "History deletion committed. Reload to refresh its view." }); return committed; } emit({ status: "error", code: e.code, message: "Nothing was deleted. Reload and review history again. " + e.message }); throw e; }
    },
    activate() { active = true; }, dispose() { active = false; listeners.clear(); pending.clear(); },
  });
}
