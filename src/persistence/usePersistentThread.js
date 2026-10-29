import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createProjectStore } from "./projectStore.js";
import { initializeProjectThread } from "./storageMigration.js";
import { createStorageCoordinator, storageStatusText } from "./storageCoordinator.js";
import { workspaceReferences } from "./threadStateSchema.js";

export function usePersistentThread({ messages, setMessages, memory, setMemory, agentState }) {
  const [store] = useState(() => createProjectStore());
  const [status, setStatus] = useState("loading");
  const [receipt, setReceipt] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [restoredWorkspace, setRestoredWorkspace] = useState(null);
  const [error, setError] = useState("");
  const writer = useRef(null), generation = useRef(0), sawCurrentWorkspace = useRef(false);
  useEffect(() => {
    const generations = generation;
    const owner = ++generation.current;
    if (attempt) { setStatus("loading"); setError(""); }
    let live = true, coordinator, unsubscribe;
    const unsubscribeStore = store.subscribe(value => {
      if (!live) return;
      setError(value.message); setStatus(value.readOnly ? "read_only" : "unavailable");
    });
    initializeProjectThread(store).then(({ manifest, record }) => {
      if (!live) return;
      if (record) {
        if (record.messages.length) setMessages(record.messages);
        setMemory(current => ({ ...current, summary: record.summary, recentTurns: [], activeBatchId: null, activeBatchVersion: null }));
        setRestoredWorkspace(record.workspace);
      }
      coordinator = createStorageCoordinator({ store, projectId: manifest.projectId, revision: manifest.revision, record });
      writer.current = coordinator;
      const update = () => { if (live) setReceipt(coordinator.getSnapshot()); };
      unsubscribe = coordinator.subscribe(update); update(); setError(""); setStatus("ready");
    }).catch(value => { if (live) { setError(value.message); setStatus(value.readOnly ? "read_only" : "unavailable"); } });
    return () => {
      live = false; unsubscribe?.(); unsubscribeStore(); coordinator?.dispose();
      if (writer.current === coordinator) writer.current = null;
      // StrictMode's immediate remount retains its connection. An actual
      // unmount closes it; old callbacks cannot publish into a new owner.
      queueMicrotask(() => { if (generations.current === owner) void store.close(); });
    };
  }, [setMessages, setMemory, store, attempt]);

  const snapshot = JSON.stringify(workspaceReferences(agentState));
  useLayoutEffect(() => {
    if (status !== "ready" || !writer.current) return;
    const workspace = JSON.parse(snapshot);
    if (workspace.files.length) sawCurrentWorkspace.current = true;
    writer.current.enqueue({ id: "main", schemaVersion: 1, messages: messages.slice(-80), summary: memory.summary,
      workspace: !sawCurrentWorkspace.current && restoredWorkspace?.requiresReupload ? restoredWorkspace : workspace });
  }, [messages, memory.summary, snapshot, status, restoredWorkspace]);

  useEffect(() => {
    if (!receipt?.unsaved || !globalThis.addEventListener) return;
    const warn = event => { event.preventDefault(); event.returnValue = ""; };
    globalThis.addEventListener("beforeunload", warn);
    return () => globalThis.removeEventListener("beforeunload", warn);
  }, [receipt?.unsaved]);
  return { status, receipt, error: error || receipt?.error || "", message: error || storageStatusText(receipt), restoredWorkspace,
    retryStorage: () => writer.current ? writer.current.retry() : setAttempt(value => value + 1), forgetWorkspace: () => setRestoredWorkspace(null) };
}
