import { useEffect, useRef, useState } from "react";
import { stageAnalysisHistory, discardAnalysisHistoryStage } from "../persistence/analysisHistoryPortability.js";
import { createDownloadLifecycle } from "../utils/downloadLifecycle.js";

export default function AnalysisHistoryPortabilityPanel({ projectId, onExport, onImport }) {
  const [state, setState] = useState({ status: "idle", message: "Transfer retained historical results without source, graph or memory." }), [preview, setPreview] = useState(null);
  const generation = useRef(0), live = useRef(false), stage = useRef(null), picker = useRef(null), [downloads] = useState(createDownloadLifecycle);
  const busy = ["validating", "exporting", "importing"].includes(state.status);
  useEffect(() => {
    const operations = generation, stages = stage, inputs = picker;
    live.current = true;
    return () => { live.current = false; operations.current++; discardAnalysisHistoryStage(stages.current); stages.current = null; inputs.current?.remove(); downloads.dispose(); };
  }, [downloads]);
  function cancel() {
    generation.current++; discardAnalysisHistoryStage(stage.current); stage.current = null; picker.current?.remove(); picker.current = null; setPreview(null);
    setState({ status: "idle", message: "History import cancelled. Nothing was changed." });
  }
  async function selected(file, token) {
    setState({ status: "validating", message: "Validating bounded historical data…" });
    try {
      const value = await stageAnalysisHistory(file);
      if (!live.current || token !== generation.current) { discardAnalysisHistoryStage(value); return; }
      stage.current = value; setPreview(value); setState({ status: "ready", message: "Review imported/unverified history before creating a new project." });
    } catch (e) { if (live.current && token === generation.current) setState({ status: e.code ?? "rejected", message: "History import rejected. " + e.message }); }
  }
  function choose() {
    const token = ++generation.current;
    discardAnalysisHistoryStage(stage.current); stage.current = null; setPreview(null); picker.current?.remove();
    const input = document.createElement("input"); input.type = "file"; input.hidden = true; input.accept = ".candy-analysis-history"; input.setAttribute("aria-label", "Standalone analysis history file");
    const remove = () => { input.remove(); if (picker.current === input) picker.current = null; };
    input.addEventListener("change", () => { const file = input.files?.[0]; remove(); if (file && live.current && token === generation.current) void selected(file, token); }, { once: true });
    input.addEventListener("cancel", remove, { once: true });
    picker.current = input; document.body.append(input); input.click();
  }
  async function exporting() {
    const token = ++generation.current;
    discardAnalysisHistoryStage(stage.current); stage.current = null; setPreview(null);
    setState({ status: "exporting", message: "Verifying retained history for explicit download…" });
    try {
      const file = await onExport();
      if (!live.current || token !== generation.current) return;
      downloads.download(file.filename, file.bytes, "application/vnd.candy.analysis-history");
      setState({ status: "exported", message: "History download ready. Only verified retained results were included." });
    } catch (e) { if (live.current && token === generation.current) setState({ status: e.code ?? "rejected", message: "History export unavailable. " + e.message }); }
  }
  async function importing() {
    if (!stage.current) return;
    const token = ++generation.current, reviewed = stage.current;
    setState({ status: "importing", message: "Confirm creation of a separate history-only project…" });
    try {
      const receipt = await onImport(reviewed);
      if (!live.current || token !== generation.current) return;
      if (receipt.cancelled) { setState({ status: "ready", message: "Import cancelled. Nothing was changed." }); return; }
      discardAnalysisHistoryStage(reviewed); stage.current = null; setPreview(null);
      setState({ status: "committed", message: receipt.discoveryFailed ? "History saved but discovery failed. Reload saved projects; import was committed." : "History committed. Resume available; no actions were restored." });
    } catch (e) {
      if (!live.current || token !== generation.current) return;
      discardAnalysisHistoryStage(reviewed); stage.current = null; setPreview(null);
      setState({ status: e.code ?? "rejected", message: "History import rejected. " + e.message + " Select the file again to review." });
    }
  }
  return <section className="workspace-portability" aria-label="Standalone analysis history portability" data-history-portability-state={state.status}>
    <h3>Standalone analysis history</h3>
    <p>Historical outcomes may contain sensitive user, result or vertex text. Review before sharing; files are not anonymous or guaranteed secret-free. Source, graph, memory, chat and model settings are excluded.</p>
    <div className="workspace-resume__toolbar"><button className="hg-btn" type="button" disabled={!projectId || busy} onClick={() => void exporting()}>Download analysis history</button><button className="hg-btn" type="button" disabled={busy} onClick={choose}>Choose history file</button></div>
    <p role="status" aria-live="polite">{state.message}</p>
    {preview && <div aria-label="History import preview"><p>{preview.name} · {preview.recordCount} retained results · Claimed backends: {preview.backends.join(", ")} · IMPORTED / unverified. No source or graph is included. Hashes do not authenticate execution or authorship.</p><div className="workspace-resume__toolbar"><button className="hg-btn" type="button" disabled={busy} onClick={cancel}>Cancel history import</button><button className="hg-btn" type="button" disabled={busy} onClick={() => void importing()}>Import history as new project…</button></div></div>}
  </section>;
}
