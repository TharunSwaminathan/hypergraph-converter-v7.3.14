import { useLayoutEffect, useRef, useState } from "react";
import "./AnalysisHistoryPanel.css";

const QUERY_LIMIT = 80;
const BACKENDS = ["CPU", "CUDA_STATIC", "CUDA_INCREMENTAL"];
const ORIGINS = [["LOCAL", "Local"], ["IMPORTED", "Imported / unverified"]];

function visibleHistory(records, query, backend, origin) {
  const needle = query.slice(0, QUERY_LIMIT).trim().toLowerCase();
  return records.filter(record =>
    (!needle || record.label.toLowerCase().includes(needle)) &&
    (!backend || record.execution.backend === backend) &&
    (!origin || record.provenance.origin === origin)
  ).reverse();
}

export default function AnalysisHistoryPanel(props) {
  return <ProjectHistoryPanel key={props.history.projectId ?? ""} {...props} />;
}

function ProjectHistoryPanel({ history, confirm, onRerun, nativeReady = false }) {
  const [selectedId, setSelectedId] = useState(null), [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [backend, setBackend] = useState("");
  const [origin, setOrigin] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const searchInput = useRef(null);
  const focusedResult = useRef(null);
  const rows = visibleHistory(history.records, query, backend, origin);
  const selected = rows.find(record => record.recordId === selectedId);
  const ready = history.status === "ready";
  const total = history.records.length;
  const loaded = hasLoaded || ready || total > 0;
  if (loaded && !hasLoaded) setHasLoaded(true);
  // Clear before commit so even an immediately widened filter cannot revive an old selection.
  if (selectedId !== null && !selected) setSelectedId(null);

  useLayoutEffect(() => {
    const previous = focusedResult.current;
    if (!previous || previous.isConnected) return;
    focusedResult.current = null;
    const doc = previous.ownerDocument;
    const search = searchInput.current;
    if (search?.getClientRects().length && doc.activeElement === doc.body && !doc.querySelector("dialog[open]")) {
      search.focus();
    }
  });

  function resetFilters() {
    setQuery("");
    setBackend("");
    setOrigin("");
  }

  async function remove(command) {
    setError("");
    try {
      const review = await history.coordinator.review(command);
      if (!await confirm({ title: command.kind === "clear" ? "Clear project analysis history?" : "Delete historical result?", detail: "Delete only the reviewed project's historical analysis evidence. Current source, graph, Assistant memory, model preferences and other projects are retained. Completion replay protection remains." })) return;
      await history.coordinator.commitReview(review);
    } catch (e) { setError(e.message); }
  }
  async function rerun(record) { setError(""); try { await onRerun(record); } catch (e) { setError(e.message); } }
  return <section className="analysis-history" aria-label="Analysis history" data-history-status={history.status} data-history-count={total} data-history-project={history.projectId ?? ""}
    onFocus={event => {
      focusedResult.current = event.target.closest(".analysis-history__list, article") ? event.target : null;
    }}
    onBlur={event => {
      if (event.relatedTarget) focusedResult.current = null;
    }}>
    <h3>Analysis history</h3>
    <p>Saved results are historical evidence. Inspecting them does not restore actions or replace the current graph or live result.</p>
    <p role="status" aria-live="polite">{history.message}</p>
    {error && <p role="alert">{error}</p>}
    <div className="analysis-history__filters">
      <label>Search analysis labels
        <input ref={searchInput} type="search" maxLength={QUERY_LIMIT} value={query}
          onChange={event => setQuery(event.currentTarget.value.slice(0, QUERY_LIMIT))}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) event.preventDefault();
          }} />
      </label>
      <label>Backend
        <select value={backend} onChange={event => {
          const value = event.currentTarget.value;
          setBackend(BACKENDS.includes(value) ? value : "");
        }}>
          <option value="">All</option>
          {BACKENDS.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>Origin
        <select value={origin} onChange={event => {
          const value = event.currentTarget.value;
          setOrigin(ORIGINS.some(([key]) => key === value) ? value : "");
        }}>
          <option value="">All</option>
          {ORIGINS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <button className="hg-btn" type="button" onClick={resetFilters}>Reset filters</button>
    </div>
    {loaded && !ready && <p>Previously loaded history snapshot.</p>}
    <p role="status" aria-live="polite" aria-atomic="true" className="analysis-history__count">
      {loaded && `Showing ${rows.length} of ${total} results`}
    </p>
    {ready && total === 0 && <p>No completed analyses have been archived in this project.</p>}
    {ready && total > 0 && rows.length === 0 && <p>No analysis results match these filters.</p>}
    <ul className="analysis-history__list">{rows.map(r => <li key={r.recordId}><button type="button" className="hg-btn" aria-pressed={selectedId === r.recordId} onClick={() => setSelectedId(r.recordId)}>{r.label} · {r.completedAt} · {r.execution.backend}</button></li>)}</ul>
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
