import { useCallback, useEffect, useRef, useState } from "react";
import { createProjectStore } from "../persistence/projectStore.js";
import { createWorkspaceResumeCoordinator } from "../persistence/workspaceResumeCoordinator.js";
import { DEFAULT_RESUME_PREFERENCES } from "../persistence/resumePreferenceSchema.js";
import ResumeWorkspacePanel from "./ResumeWorkspacePanel.jsx";

function Confirmation({ value, close }) {
  const ref = useRef(null), cancel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement, dialog = ref.current;
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute("open", "");
    cancel.current?.focus();
    return () => { if (dialog.open) dialog.close?.(); if (previous?.isConnected) previous.focus?.(); };
  }, []);
  function keyboard(event) {
    if (event.key === "Escape") { event.preventDefault(); close(false); }
    if (event.key === "Tab") { const nodes = [...ref.current.querySelectorAll("button")]; if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1).focus(); } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0].focus(); } }
  }
  return <dialog ref={ref} className="workspace-confirm" aria-labelledby="persistence-confirm-title" aria-describedby="persistence-confirm-detail" onCancel={event => { event.preventDefault(); close(false); }} onKeyDown={keyboard}><h2 id="persistence-confirm-title">{value.title}</h2><p id="persistence-confirm-detail">{value.detail}</p><div className="workspace-confirm__actions"><button className="hg-btn" type="button" ref={cancel} onClick={() => close(false)}>Cancel</button><button className="hg-btn" type="button" onClick={() => close(true)}>Confirm</button></div></dialog>;
}
export default function WorkspaceExperience({ component: Scene }) {
  const [store] = useState(createProjectStore), [snapshot, setSnapshot] = useState({ state: "RESTORING", preferences: DEFAULT_RESUME_PREFERENCES, projects: [], message: "Checking saved workspaces…" });
  const actor = useRef(null), mount = useRef(0), pending = useRef(null), [confirmation, setConfirmation] = useState(null), [error, setError] = useState("");
  const close = useCallback(value => { const p = pending.current; pending.current = null; setConfirmation(null); p?.resolve(value); }, []);
  useEffect(() => {
    const generations = mount, generation = ++generations.current;
    const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("hypergraph-studio.workspace-resume.v1") : null;
    const coordinator = createWorkspaceResumeCoordinator({ store, channel }); actor.current = coordinator;
    const off = coordinator.subscribe(setSnapshot); setSnapshot(coordinator.getSnapshot()); void coordinator.initialize();
    return () => { off(); coordinator.dispose(); if (actor.current === coordinator) actor.current = null; pending.current?.resolve(false); pending.current = null; queueMicrotask(() => { if (generations.current === generation) void store.close(); }); };
  }, [store]);
  useEffect(() => { if (pending.current && pending.current.key !== snapshot.active?.key) close(false); }, [snapshot.active?.key, close]);
  const confirm = useCallback(value => { pending.current?.resolve(false); return new Promise(resolve => { pending.current = { resolve, key: actor.current?.getSnapshot().active?.key }; setConfirmation(value); }); }, []);
  const report = useCallback((key, value) => actor.current?.report(key, value), []);
  async function run(fn) { setError(""); try { return await fn(); } catch (e) { setError(["CONFLICT", "DELETED", "ABANDONED"].includes(e.code) ? "Saved data changed. Nothing was cleared or overwritten. Reload before trying again." : "This change could not be saved. Previous saved data is preserved."); return { ok: false, error: e.message }; } }
  async function navigate(fn) {
    if (actor.current?.getSnapshot().live?.workspace.unsaved && !await confirm({ title: "Leave unsaved changes?", detail: "Local changes may not be saved. Switching projects discards pending actions and uncommitted edits; existing saved projects remain intact." })) return;
    close(false); return run(fn);
  }
  async function clearCategory(category, command) {
    const coordinator = actor.current, token = await coordinator.capture(), label = coordinator.label(token.projectId);
    const accepted = await confirm({ title: category === "workspace" ? "Delete saved workspace?" : "Forget project memory?", detail: category === "workspace" ? `Delete saved source, graph and checkpoints for “${label}”. This project's Assistant memory, chat, other projects and application preferences are retained.` : `Forget the selected memory in “${label}”. This does not erase existing chat quotes. Source, graph, other projects and model preferences are retained.` });
    if (!accepted) return { ok: false, cancelled: true };
    const receipt = await coordinator.clear(token, category, command); setError(""); return receipt;
  }
  const mutateMemory = async (command, original) => ["clear", "forget", "forgetType", "supersede"].includes(command.kind) ? clearCategory("memory", command) : original(command);
  const actions = { choose: id => navigate(() => actor.current.choose(id)), resume: () => run(() => actor.current.resume()), fresh: () => navigate(() => actor.current.fresh()), reload: () => navigate(() => actor.current.reload()),
    setAuto: value => run(() => actor.current.setAutoResume(value)), rename: name => run(() => actor.current.rename(name)), deleteWorkspace: () => run(() => clearCategory("workspace")), clearMemory: () => run(() => clearCategory("memory", { kind: "clear" })) };
  function panel(onForgetModel) { return <><ResumeWorkspacePanel snapshot={snapshot} actions={actions} onForgetModel={onForgetModel} />{error && <p role="alert">{error}</p>}</>; }
  const onVisualization = useCallback(value => { const coordinator = actor.current; if (coordinator) void coordinator.setVisualization(value).catch(() => setError("Display preferences were not saved. Reload startup settings to review changes.")); }, []);
  return <>{snapshot.active ? <Scene key={snapshot.active.key} experience={{ active: snapshot.active, session: snapshot.active.session, preferences: snapshot.preferences, externalStale: Boolean(snapshot.foreignChange), report, panel, confirm, mutateMemory, onVisualization }} /> : <main className="workspace-startup"><h1>Hypergraph Converter Studio</h1><p>Your work stays in this browser. Choose what to open.</p>{panel(null)}</main>}{confirmation && <Confirmation value={confirmation} close={close} />}</>;
}
