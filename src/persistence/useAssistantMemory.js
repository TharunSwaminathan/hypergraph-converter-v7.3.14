import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createMemoryCoordinator } from "./assistantMemoryCoordinator.js";
import { StorageFault } from "./storageSafety.js";

export function useAssistantMemory({ session, projectId = null, workspaceCurrent = false, workspaceReady = true }) {
  const [snapshot, setSnapshot] = useState({ status: "loading", records: [], message: "Loading project memory…" });
  const owner = useRef(null), currentWorkspace = useRef(workspaceCurrent);
  useLayoutEffect(() => { currentWorkspace.current = workspaceCurrent; }, [workspaceCurrent]);
  useEffect(() => {
    let live = true, coordinator;
    setSnapshot({ status: "loading", records: [], message: "Loading project memory…" });
    if (!workspaceReady) return () => { live = false; };
    Promise.resolve(projectId ? { projectId } : session.defaultProject()).then(async p => {
      if (!live) return;
      coordinator = createMemoryCoordinator(session, p.projectId, () => currentWorkspace.current); owner.current = coordinator;
      const result = await coordinator.initialize();
      if (live) setSnapshot({ ...result, projectId: p.projectId, status: "ready", message: "Project memory is available independently of model connection." });
    }).catch(error => { if (live) setSnapshot({ status: "error", records: [], message: error.message }); });
    return () => { live = false; coordinator?.dispose(); if (owner.current === coordinator) owner.current = null; };
  }, [session, projectId, workspaceReady]);
  async function inspect() {
    const coordinator = owner.current;
    if (!coordinator) throw new StorageFault("UNAVAILABLE", "Memory is not ready.");
    const value = await coordinator.inspect();
    if (owner.current !== coordinator) throw new StorageFault("ABANDONED", "Project changed while inspecting memory.", true);
    setSnapshot({ ...value, projectId: value.manifest.projectId, status: "ready", message: "Memory inspected; this does not grant action authority." }); return value;
  }
  async function mutate(command) {
    const coordinator = owner.current;
    if (!coordinator) throw new StorageFault("UNAVAILABLE", "Memory is not ready.");
    setSnapshot(value => ({ ...value, status: "saving", message: "Memory is not committed yet…" }));
    try {
      const receipt = await coordinator.mutate(command);
      if (owner.current !== coordinator) throw new StorageFault("ABANDONED", "Project changed; no receipt published into the new project.", true);
      setSnapshot(value => ({ ...value, status: "ready", records: receipt.records, message: `Memory committed at project revision ${receipt.revision}.` }));
      return receipt;
    } catch (error) { if (owner.current === coordinator) setSnapshot(value => ({ ...value, status: "error", message: error.message })); throw error; }
  }
  return { ...snapshot, inspect, mutate, async context() { const coordinator = owner.current; if (!coordinator) return null; const value = await coordinator.context(); return owner.current === coordinator ? value : null; } };
}
