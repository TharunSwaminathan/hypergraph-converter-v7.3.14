import { useEffect, useRef, useState } from "react";
import { stagePortableWorkspace, PORTABLE_LIMITS } from "../persistence/workspacePortability.js";
import { createDownloadLifecycle } from "../utils/downloadLifecycle.js";

export default function WorkspacePortabilityPanel({ projectId, canReplace, onExport, onImport }) {
  const [state, setState] = useState({ status: "idle", message: "Export saved source, graph and project memory, or import a portable workspace file." });
  const [stage, setStage] = useState(null), operation = useRef(0), picker = useRef(null), live = useRef(false);
  const [downloads] = useState(createDownloadLifecycle);
  useEffect(() => { const operations = operation, inputs = picker; live.current = true; return () => { live.current = false; operations.current++; inputs.current?.remove(); downloads.dispose(); }; }, [downloads]);
  const busy = ["validating", "importing", "exporting"].includes(state.status);
  async function selected(file) {
    const token = ++operation.current; setStage(null); setState({ status: "validating", message: "Validating archive…" });
    try {
      const prepared = await stagePortableWorkspace(file);
      if (!live.current || operation.current !== token) return;
      setStage(prepared); setState({ status: "ready", message: `Ready to import “${prepared.name}”: ${prepared.payloadCount} verified payloads, ${prepared.memoryCount} active memories.${prepared.migratedFrom ? " Older format migrated to the current schema." : ""}` });
    } catch (e) { if (live.current && operation.current === token) setState({ status: "rejected", message: "Import rejected. " + e.message }); }
  }
  function choose() {
    picker.current?.remove(); const input = document.createElement("input");
    input.type = "file"; input.accept = ".candy-workspace"; input.hidden = true; input.setAttribute("aria-label", "Portable workspace file");
    input.addEventListener("change", () => { const file = input.files?.[0]; input.remove(); if (picker.current === input) picker.current = null; if (file) void selected(file); }, { once: true });
    input.addEventListener("cancel", () => { input.remove(); if (picker.current === input) picker.current = null; }, { once: true });
    picker.current = input; document.body.append(input); input.click();
  }
  async function exporting() {
    const token = ++operation.current; setState({ status: "exporting", message: "Validating saved data for export…" });
    try {
      const file = await onExport(); if (!live.current || token !== operation.current) return;
      downloads.download(file.filename, file.bytes, "application/vnd.candy.workspace");
      setState({ status: "exported", message: "Workspace export ready. Saved bytes were verified; pending edits are not included." });
    } catch (e) { if (live.current && token === operation.current) setState({ status: "rejected", message: "Export unavailable. " + e.message }); }
  }
  async function importing(replace) {
    if (!stage) return; const token = ++operation.current;
    setState({ status: "importing", message: replace ? "Review replacement before importing…" : "Publishing validated workspace…" });
    try {
      const receipt = await onImport(stage, replace);
      if (!live.current || token !== operation.current) return;
      if (receipt.cancelled) setState({ status: "ready", message: "Replacement cancelled. Existing saved data is unchanged." });
      else { setStage(null); setState({ status: "complete", message: "Import complete. Resume to open validated data. Pending actions were not imported." }); }
    } catch (e) { if (live.current && token === operation.current) setState({ status: e.code === "CONFLICT" || e.code === "DUPLICATE" ? "conflict" : "rejected", message: (e.code === "CONFLICT" || e.code === "DUPLICATE" ? "Existing workspace conflict. " : "Import rejected. ") + e.message }); }
  }
  return <section className="workspace-portability" aria-label="Workspace portability" data-portability-state={state.status}>
    <h3>Workspace portability</h3><div className="workspace-resume__toolbar"><button className="hg-btn" type="button" disabled={!projectId || busy} onClick={() => void exporting()}>Export workspace</button><button className="hg-btn" type="button" disabled={busy} onClick={choose}>Import workspace</button></div>
    <p role="status" aria-live="polite">{state.message}</p>
    {stage && !busy && <div className="workspace-resume__toolbar"><button className="hg-btn workspace-resume__primary" type="button" onClick={() => void importing(false)}>Import as separate workspace</button><button className="hg-btn" type="button" disabled={!canReplace} onClick={() => void importing(true)}>Replace selected workspace…</button><button className="hg-btn" type="button" onClick={() => { operation.current++; setStage(null); setState({ status: "idle", message: "Import cancelled. Nothing was changed." }); }}>Cancel import</button></div>}
    <p className="workspace-resume__hint">Includes saved source files, graph and project memory. Review source contents before sharing. Maximum {PORTABLE_LIMITS.containerBytes / 1024 / 1024} MiB, uncompressed. Import creates a separate project unless you confirm replacement. Memory is untrusted context; parser code needs review. Imported model selection starts with Auto reconnect OFF; existing model preferences are retained.</p>
  </section>;
}
