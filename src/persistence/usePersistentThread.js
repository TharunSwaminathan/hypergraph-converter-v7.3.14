import { useEffect, useRef, useState } from "react";
import { createThreadStore } from "./threadStore.js";
import { workspaceReferences } from "./threadStateSchema.js";
import { createThreadSaveQueue } from "./threadSaveQueue.js";

export function usePersistentThread({ messages, setMessages, memory, setMemory, agentState }) {
  const [store] = useState(() => createThreadStore());
  const [status, setStatus] = useState("loading");
  const [restoredWorkspace, setRestoredWorkspace] = useState(null);
  const [error, setError] = useState("");
  const restored = useRef(false);
  const [queue] = useState(() => createThreadSaveQueue(value => store.saveThreadState(value),
    () => setError(""), err => setError(`Thread was not saved: ${err.message}`)));
  const sawCurrentWorkspace = useRef(false);
  useEffect(() => {
    let live = true;
    queue.activate();
    store.loadThread().then(record => {
      if (!live) return;
      if (record) {
        if (record.messages.length) setMessages(record.messages);
        setMemory(current => ({ ...current, summary: record.summary, recentTurns: [], activeBatchId: null, activeBatchVersion: null }));
        setRestoredWorkspace(record.workspace);
      }
      restored.current = true;
      setStatus("ready");
    }).catch(err => { if (live) { setError(err.message); setStatus("unavailable"); } });
    return () => { live = false; queue.dispose(); };
  }, [setMessages, setMemory, store, queue]);

  const snapshot = JSON.stringify(workspaceReferences(agentState));
  useEffect(() => {
    if (status !== "ready" || !restored.current) return;
    const workspace = JSON.parse(snapshot);
    if (workspace.files.length) sawCurrentWorkspace.current = true;
    // Retain missing-file recovery references until a real upload replaces them.
    const value = { id: "main", messages, summary: memory.summary, workspace: !sawCurrentWorkspace.current && restoredWorkspace?.requiresReupload ? restoredWorkspace : workspace };
    queue.enqueue(value);
  }, [messages, memory.summary, snapshot, status, restoredWorkspace, queue]);
  return { status, error, restoredWorkspace, forgetWorkspace: () => setRestoredWorkspace(null) };
}
