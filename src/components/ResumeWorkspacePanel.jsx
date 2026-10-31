import { useEffect, useState } from "react";
import { projectLabel } from "../persistence/resumePreferenceSchema.js";
import { persistenceStatusText } from "../persistence/workspaceResumeCoordinator.js";
import "./ResumeWorkspacePanel.css";

const titles = { NO_SAVED_WORKSPACE: "Your workspace is ready", RESTORE_AVAILABLE: "Pick up where you left off", RESTORING: "Opening your workspace…", RESTORED: "Workspace ready", PARTIALLY_RESTORED: "Workspace partly restored", STALE: "Saved workspace changed", RECOVERY_REQUIRED: "Saved data needs attention", FRESH_SESSION: "Fresh workspace" };
const modelNames = { loading: "Waiting for workspace and memory", configured: "Configured · not connected", connecting: "Checking Ollama…", reconnecting: "Reconnecting to Ollama…", connected: "Connected", disconnected: "Disconnected", unavailable: "Ollama unavailable", failed: "Connection needs attention", model_unavailable: "Remembered model unavailable" };
export default function ResumeWorkspacePanel({ snapshot: s, actions, onForgetModel, children }) {
  const [name, setName] = useState("");
  useEffect(() => { setName(s.selectedId ? projectLabel(s.preferences, s.selectedId) : ""); }, [s.selectedId, s.preferences]);
  const current = s.live, available = s.available, active = Boolean(s.active), ready = current && current.workspace.state !== "loading";
  const sources = current ? current.workspace.partial ? "Verified sources restored · read-only" : ["error", "read_only"].includes(current.workspace.state) ? "Unavailable · original saved data preserved" : current.workspace.unsaved ? "Local edits · not saved" : current.sourceCount ? "Available" : "No source data" : available?.workspaceError ? "Unavailable · saved data preserved" : available?.sourceCount ? "Available" : "No saved source";
  const graph = current ? current.workspace.partial ? "Unavailable · recovery required" : ["error", "read_only"].includes(current.workspace.state) ? "Unavailable · verify saved source and graph" : current.graphStale ? "Previous inputs · regenerate to update" : current.graphHasData ? current.workspace.unsaved ? "Local graph · not saved" : "Available" : "Empty · generate from source when needed" : available?.graphAvailable ? available.graphEmpty ? "Saved empty graph" : "Available" : "Not available · regeneration or recovery required";
  const memory = current ? current.memoryStatus === "loading" ? "Checking…" : current.memoryStatus === "error" ? "Unavailable · original data preserved" : "Available · " + current.memoryCount + (current.memoryCount === 1 ? " active memory" : " active memories") : available?.memoryAvailable ? "Available · " + available.memoryCount + (available.memoryCount === 1 ? " active memory" : " active memories") : "Unavailable";
  const model = current?.model ?? available?.model, autoReconnect = current?.autoReconnect ?? available?.autoReconnect;
  return <section className="workspace-resume" aria-label="Workspace and saved data" data-resume-state={s.state}>
    <div className="workspace-resume__heading"><div><p className="workspace-resume__eyebrow">LOCAL WORKSPACE</p><h2 tabIndex={-1}>{titles[s.state] ?? "Workspace status"}</h2></div><span className="workspace-resume__badge">{active ? s.active.projectId ? "Browser saved project" : "Temporary · not saved" : "Saved data stays on this browser"}</span></div>
    <p role="status" className="workspace-resume__status">{s.message}</p>
    <div className="workspace-resume__toolbar">
      <label>Saved workspace<select aria-label="Saved workspace" value={s.selectedId ?? ""} disabled={s.state === "RESTORING"} onChange={event => void actions.choose(event.target.value)}>{!s.projects.length && <option value="">No saved projects available</option>}{s.projects.map(p => <option key={p.projectId} value={p.projectId}>{projectLabel(s.preferences, p.projectId)}</option>)}</select></label>
      {!active && <button className="hg-btn workspace-resume__primary" type="button" disabled={!s.selectedId || s.state === "RESTORING"} onClick={() => void actions.resume()}>Resume workspace</button>}
      <button className="hg-btn" type="button" disabled={s.state === "RESTORING"} onClick={() => void actions.fresh()}>Start fresh session</button>
      <button className="hg-btn" type="button" onClick={() => void actions.reload()}>Reload saved data</button>
    </div>
    <p className="workspace-resume__hint">Start fresh creates a separate project. Previous saved source, graphs and memories stay intact. Resume never continues pending actions.</p>
    <dl className="workspace-resume__categories"><div><dt>Source</dt><dd>{sources}</dd></div><div><dt>Graph</dt><dd>{graph}</dd></div><div><dt>Assistant memory</dt><dd>{memory}{(current?.staleMemoryCount ?? available?.staleMemoryCount) > 0 && " · some context is stale"}</dd></div><div><dt>Local model</dt><dd>{model ? model + " · " : available?.modelProfileError || current?.modelState === "failed" ? "Profile unavailable · " : "No profile · "}{active ? modelNames[current?.modelState] ?? "Checking…" : "Resume to verify connection"}{model && <small>Auto reconnect {autoReconnect ? "ON" : "OFF"}</small>}</dd></div></dl>
    {active && <p className="workspace-resume__durability" role="status" data-durability={s.foreignChange ? "stale" : current?.workspace.state ?? "loading"}>{s.foreignChange ? "Saved project changed elsewhere. Reload before saving." : s.active.projectId ? persistenceStatusText(current?.workspace) : "Temporary session. Changes are not saved."}</p>}
    <details className="workspace-resume__settings"><summary>Startup, display preferences and saved data</summary>
      <label className="workspace-resume__checkbox"><input aria-label="Resume previous workspace automatically" type="checkbox" checked={s.preferences.autoResume} disabled={Boolean(s.preferenceError)} onChange={event => void actions.setAuto(event.target.checked)} />Resume previous workspace automatically</label>
      <p>This is separate from Auto reconnect in Assistant Settings. Display view, layout and preview limit are remembered; graph selections and approvals are not.</p>
      {s.preferenceError && <p role="alert">{s.preferenceError}</p>}
      {s.selectedId && <div className="workspace-resume__toolbar"><label>Workspace name<input aria-label="Workspace name" maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label><button className="hg-btn" type="button" disabled={!name.trim() || Boolean(s.preferenceError)} onClick={() => void actions.rename(name)}>Save name</button></div>}
      {(current?.workspace.updatedAt ?? available?.updatedAt) && <p>Last saved: <time dateTime={current?.workspace.updatedAt ?? available.updatedAt}>{new Date(current?.workspace.updatedAt ?? available.updatedAt).toLocaleString()}</time></p>}
      <div className="workspace-resume__toolbar workspace-resume__danger"><button className="hg-btn" type="button" disabled={!active || !ready || s.foreignChange || !s.active.projectId} onClick={() => void actions.deleteWorkspace()}>Delete saved workspace…</button><button className="hg-btn" type="button" disabled={!active || !ready || s.foreignChange || !s.active.projectId} onClick={() => void actions.clearMemory()}>Clear this project’s memory…</button><button className="hg-btn" type="button" disabled={!onForgetModel} onClick={() => void onForgetModel()}>Forget model connection…</button></div>
      <p>Workspace deletion removes this project’s saved source, graph and checkpoints. Memory, chat and other projects are retained. Model connection belongs to all projects. Each clear action requires confirmation.</p>
      {s.unavailableProjects > 0 && <p role="alert">Some saved projects have invalid metadata and are preserved for recovery.</p>}
    </details>
    {children}
  </section>;
}
