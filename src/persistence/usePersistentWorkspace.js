import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { initializeProjectThread } from "./storageMigration.js";
import { restoreWorkspace, sourceGraphSummary } from "./workspaceRestore.js";
import { fault, StorageFault } from "./storageSafety.js";

export function usePersistentWorkspace({ session, input, graph, onRestore, restore = restoreWorkspace }) {
  const [receipt, setReceipt] = useState({ state: "loading", unsaved: false, message: "Validating saved workspace data…" });
  const [ready, setReady] = useState(false);
  const [retryTick, setRetryTick] = useState(0), [openAttempt, setOpenAttempt] = useState(0);
  const apply = useRef(onRestore); useLayoutEffect(() => { apply.current = onRestore; }, [onRestore]);
  const owner = useRef(null), initial = useRef({ input, graph }), changed = useRef(false), skipHydration = useRef(false);
  useLayoutEffect(() => { if (!owner.current?.ready && (initial.current.input !== input || initial.current.graph !== graph)) changed.current = true; }, [input, graph]);
  useEffect(() => {
    const state = { active: true, ready: false, running: false, latest: null, projectId: null, revision: null, failed: false };
    owner.current = state;
    const error = value => {
      const failure = fault(value); state.failed = true;
      if (state.active) setReceipt({ state: failure.readOnly ? "read_only" : "error", unsaved: true, code: failure.code, message: failure.message });
      if (state.projectId && ["MISSING_SOURCE", "CORRUPT_SOURCE", "INCOMPATIBLE", "CORRUPT", "CORRUPT_GRAPH", "INCOMPLETE"].includes(failure.code)) {
        void session.quarantine("workspace:" + state.projectId, failure).catch(() => {});
        if (["MISSING_SOURCE", "CORRUPT_SOURCE"].includes(failure.code)) void session.readWorkspace(state.projectId).then(bundle => {
          if (state.active) setReceipt(current => ({ ...current, recoverySources: bundle.root.sources.map(h => ({ objectId: h.objectId, name: h.provenance.name, byteLength: h.byteLength, sha256: h.sha256 })) }));
        }).catch(() => {});
      }
    };
    const unsubscribe = session.subscribe(error);
    (session.workspaceProject ? session.workspaceProject().then(manifest => ({ manifest })) : initializeProjectThread(session)).then(async ({ manifest }) => {
      state.projectId = manifest.projectId; state.revision = manifest.revision;
      const restored = await restore(session, manifest.projectId, () => state.active && !changed.current);
      if (!state.active || state.failed) return;
      if (changed.current) throw new StorageFault("CONFLICT", "Workspace changed before restore completed. Reload to review saved data; local edits are not overwritten.", true);
      if (restored.available) apply.current(restored);
      state.revision = restored.manifest.revision; state.ready = !restored.partial; state.failed = Boolean(restored.partial); skipHydration.current = true;
      setReady(true);
      setReceipt({ state: restored.partial ? "read_only" : restored.available ? "committed" : "clean", partial: Boolean(restored.partial), sourceRestored: restored.available, graphRestored: Boolean(restored.graph), sourceCount: restored.sources.filter(s => s.provenance.kind !== "parser").length, unsaved: false, revision: state.revision, updatedAt: restored.root?.updatedAt ?? restored.manifest.updatedAt, provenanceSummary: sourceGraphSummary(restored.root), message: restored.partial ? "Sources restored; saved graph unavailable. Original saved data is preserved and remains read-only." : restored.available ? `Workspace restored from verified bytes at project revision ${state.revision}.` : "No durable workspace data yet. New data will be saved within the browser storage budget." });
    }).catch(error);
    return () => { state.active = false; state.latest = null; unsubscribe(); };
  }, [session, openAttempt, restore]);
  useLayoutEffect(() => {
    const state = owner.current;
    if (!state?.active) return;
    if (skipHydration.current) { skipHydration.current = false; return; }
    if (state.failed) { setReceipt(value => value.unsaved ? value : { ...value, unsaved: true }); return; }
    if (!state.ready) return;
    state.latest = { ...input, graph };
    setReceipt({ state: "queued", unsaved: true, message: "Workspace changes are not committed yet." });
    async function drain() {
      if (state.running) return;
      state.running = true;
      let writing = null;
      try {
        while (state.active && state.latest && !state.failed) {
          const pending = state.latest; state.latest = null;
          writing = pending;
          setReceipt({ state: "writing", unsaved: true, message: "Validating and saving workspace bytes…" });
          const saved = await session.saveWorkspace(state.projectId, state.revision, pending);
          if (!state.active || state.failed) return;
          state.revision = saved.revision;
          writing = null;
          setReceipt({ state: state.latest ? "queued" : "committed", unsaved: Boolean(state.latest), revision: saved.revision, updatedAt: saved.manifest?.updatedAt, provenanceSummary: sourceGraphSummary(saved.workspace),
            message: state.latest ? "More workspace changes are pending." : `Workspace committed at project revision ${saved.revision}.` });
        }
      } catch (value) { state.latest ??= writing; const failure = fault(value); state.failed = true; if (state.active) setReceipt({ state: failure.readOnly ? "read_only" : "error", unsaved: true, code: failure.code, message: failure.message }); }
      finally { state.running = false; }
    }
    void drain();
  }, [input, graph, ready, session, retryTick]);
  useEffect(() => {
    if (!receipt.unsaved) return;
    const warn = event => { event.preventDefault(); event.returnValue = ""; };
    globalThis.addEventListener?.("beforeunload", warn); return () => globalThis.removeEventListener?.("beforeunload", warn);
  }, [receipt.unsaved]);
  async function reattach(objectId, file) {
    const state = owner.current;
    if (!state?.active || !state.projectId) return;
    try {
      const bundle = await session.readWorkspace(state.projectId);
      const saved = await session.reattachSource(state.projectId, bundle.manifest.revision, objectId, file);
      if (!state.active) return;
      if (!saved.ok) { setReceipt(current => ({ ...current, code: saved.status, message: "Changed or unsupported source was not attached. The saved graph/provenance was preserved." })); return; }
      const restored = await restoreWorkspace(session, state.projectId, () => state.active);
      if (!state.active) return;
      apply.current(restored); state.revision = restored.manifest.revision; state.failed = false; state.ready = true; skipHydration.current = true;
      setReady(true); setReceipt({ state: "committed", unsaved: false, revision: state.revision, message: "Exact source bytes reattached and workspace validated. No parser or mutation was executed." });
    } catch (value) { if (state.active) setReceipt(current => ({ ...current, code: fault(value).code, message: fault(value).message })); }
  }
  async function retry() {
    const state = owner.current;
    if (!state?.active || !["UNAVAILABLE", "QUOTA", "ABORTED"].includes(receipt.code)) return false;
    try { await session.retry(); if (!state.active) return false; state.failed = false; if (state.ready) setRetryTick(value => value + 1); else setOpenAttempt(value => value + 1); return true; }
    catch { return false; }
  }
  return { ...receipt, reattach, retry };
}
