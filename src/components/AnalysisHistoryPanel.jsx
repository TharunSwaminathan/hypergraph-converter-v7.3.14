import { useState } from "react";
import "./AnalysisHistoryPanel.css";

export default function AnalysisHistoryPanel({ history, confirm, onRerun, nativeReady = false }) {
  const [selectedId, setSelectedId] = useState(null), [error, setError] = useState("");
  const selected = history.records.find(x => x.recordId === selectedId);
  async function remove(command) {
    setError("");
    try {
      const review = await history.coordinator.review(command);
      if (!await confirm({ title: command.kind === "clear" ? "Clear project analysis history?" : "Delete historical result?", detail: "Delete only the reviewed project's historical analysis evidence. Current source, graph, Assistant memory, model preferences and other projects are retained. Completion replay protection remains." })) return;
      await history.coordinator.commitReview(review);
    } catch (e) { setError(e.message); }
  }
  async function rerun(record) { setError(""); try { await onRerun(record); } catch (e) { setError(e.message); } }
  return <section className="analysis-history" aria-label="Analysis history" data-history-status={history.status} data-history-count={history.records.length} data-history-project={history.projectId ?? ""}>
    <h3>Analysis history</h3>
    <p>Saved results are historical evidence. Inspecting them does not restore actions or replace the current graph or live result.</p>
    <p role="status" aria-live="polite">{history.message}</p>
    {error && <p role="alert">{error}</p>}
    {!history.records.length && <p>No completed analyses have been archived in this project.</p>}
    <ul className="analysis-history__list">{[...history.records].reverse().map(r => <li key={r.recordId}><button type="button" className="hg-btn" aria-pressed={selectedId === r.recordId} onClick={() => setSelectedId(r.recordId)}>{r.label} · {r.completedAt} · {r.execution.backend}</button></li>)}</ul>
    {selected && <article aria-label="Historical analysis result">
      <h4>{selected.label} — historical result</h4>
      <p>Completed {selected.completedAt} · Backend {selected.execution.backend} · Graph version {selected.input.graphVersion}{selected.input.preview ? " · Uncommitted/preview input" : ""}</p>
      <p>{history.inputDigest === selected.input.contentSha256 ? "Input bytes match the current analysis input. This remains a historical result." : "Historical input differs from the current input, or current equivalence is unavailable."}</p>
      <p>{selected.provenance.origin === "IMPORTED" ? "Imported evidence — execution origin is unverified." : "Recorded from a local completed analysis."}</p>
      <details><summary>Parameters and provenance</summary><pre>{JSON.stringify({ parameters: selected.parameters, input: selected.input, execution: selected.execution, provenance: selected.provenance, projectRevisionAtCapture: selected.projectRevisionAtCapture, resultSha256: selected.resultSha256 }, null, 2)}</pre></details>
      <pre aria-label="Historical outcome">{JSON.stringify(selected.payload.data, null, 2)}</pre>
      {selected.execution.backend !== "CUDA_INCREMENTAL" && <button className="hg-btn" type="button" disabled={!onRerun || history.inputDigest !== selected.input.contentSha256 || selected.execution.backend !== "CPU" && !nativeReady} onClick={() => void rerun(selected)}>{selected.execution.backend === "CPU" ? "Rerun on matching current input" : "Review a new native run"}</button>}
      {selected.execution.backend === "CUDA_INCREMENTAL" && <p>To rerun a delta, recreate and review a current pending update. Historical update authority is never restored.</p>}
      <button className="hg-btn" type="button" disabled={!confirm} onClick={() => void remove({ kind: "delete", recordId: selected.recordId, recordSha256: selected.sha256 })}>Delete historical result…</button>
    </article>}
    <button className="hg-btn" type="button" disabled={!confirm || !history.records.length || history.status === "writing"} onClick={() => void remove({ kind: "clear" })}>Clear project analysis history…</button>
    <p className="analysis-history__note">Up to 24 results and 2 MiB per project; older results are evicted first. Replay protection covers 512 completed operations per project, then saving new history stops. Animation traces and pending operations are not archived. No analysis runs on Resume.</p>
  </section>;
}
