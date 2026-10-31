import { initializeProjectThread } from "./storageMigration.js";
import { createProjectSession } from "./projectSession.js";
import { createResumeProjectSession, createUnsavedSession } from "./resumeProjectSession.js";
import { restoreWorkspaceCategories } from "./workspaceRestore.js";
import { createMemoryCoordinator } from "./assistantMemoryCoordinator.js";
import { DEFAULT_RESUME_PREFERENCES, projectLabel, namedProject } from "./resumePreferenceSchema.js";
import { StorageFault, fault } from "./storageSafety.js";

export function persistenceStatusText(receipt) {
  if (!receipt || receipt.state === "loading") return "Checking saved workspace…";
  if (receipt.partial) return "Sources restored. Saved graph needs recovery; changes are not saved.";
  if (["queued", "writing", "dirty"].includes(receipt.state)) return "Saving…";
  if (receipt.code === "CONFLICT" || receipt.state === "conflict") return "Saved data changed in another tab. Reload before saving.";
  if (receipt.unsaved || ["error", "read_only", "unavailable"].includes(receipt.state)) return "Save unavailable. Local changes are not saved; previous saved data is preserved.";
  return receipt.state === "clean" ? "Ready. No workspace changes to save." : "Saved";
}
export function deriveResumeState(live, fresh = false) {
  if (!live || live.workspace.state === "loading" || live.memoryStatus === "loading") return "RESTORING";
  if (live.workspace.code === "CONFLICT") return "STALE";
  if (live.workspace.partial || live.memoryStatus === "error") return "PARTIALLY_RESTORED";
  if (["error", "read_only"].includes(live.workspace.state)) return "RECOVERY_REQUIRED";
  if (fresh && live.workspace.state === "clean") return "FRESH_SESSION";
  return "RESTORED";
}
export async function inspectResumeProject(store, id) {
  const start = performance.now(), manifest = await store.readProject(id);
  if (manifest.deleted) throw new StorageFault("DELETED", "This saved project was deleted.", true);
  const timings = {}, measured = async (key, fn) => { const t = performance.now(); try { return await fn(); } finally { timings[key] = performance.now() - t; } };
  const results = await Promise.allSettled([
    measured("workspaceSourceGraphValidationMs", () => restoreWorkspaceCategories(store, id)),
    measured("memoryValidationMs", async () => { const memory = createMemoryCoordinator(store, id); try { return await memory.initialize(); } finally { memory.dispose(); } }),
    measured("modelProfileLoadMs", () => store.readConnectionProfile()), measured("chatLoadMs", () => store.load(id)),
  ]);
  const workspace = results[0].status === "fulfilled" ? results[0].value : null, memory = results[1].status === "fulfilled" ? results[1].value : null;
  const profile = results[2].status === "fulfilled" ? results[2].value.profile : null;
  return { projectId: id, revision: manifest.revision, updatedAt: workspace?.root?.updatedAt ?? manifest.updatedAt,
    saved: Boolean(workspace?.available || results[0].status === "rejected" || memory?.records.length || results[3].status === "fulfilled" && results[3].value.record?.messages.length),
    workspaceAvailable: Boolean(workspace?.available), partial: Boolean(workspace?.partial), workspaceError: results[0].status === "rejected" ? fault(results[0].reason).code : null,
    sourceCount: workspace?.sources.filter(s => s.provenance.kind !== "parser").length ?? 0, graphAvailable: Boolean(workspace?.graph), graphEmpty: !workspace?.graph?.hyperedges?.length,
    memoryAvailable: Boolean(memory), memoryCount: memory?.records.filter(row => row.status === "ACTIVE").length ?? 0, staleMemoryCount: memory?.records.filter(row => row.retrievalStatus === "STALE").length ?? 0,
    profileAvailable: Boolean(profile), model: profile?.selectedModel ?? null, autoReconnect: profile?.autoReconnectEnabled ?? false, modelProfileError: results[2].status === "rejected",
    timings: { ...timings, ...workspace?.validationTimings, discoveryMs: performance.now() - start } };
}
export function createWorkspaceResumeCoordinator({ store, channel = null }) {
  let live = true, generation = 0, serial = Promise.resolve(), initialized = null, defaultId = null, sequence = 0;
  let snapshot = { state: "RESTORING", preferences: { revision: 0, ...DEFAULT_RESUME_PREFERENCES }, preferenceError: "", projects: [], selectedId: null, available: null, active: null, live: null, message: "Checking saved workspaces…", diagnostics: [] };
  const owner = globalThis.crypto?.randomUUID?.(), listeners = new Set(), current = token => live && token === generation;
  function emit(patch) { if (!live) return; const marker = { state: patch.state ?? snapshot.state, event: patch.event ?? (patch.live ? "category-update" : patch.preferences ? "preferences-validated" : patch.available ? "discovery-result" : "state-change"), code: patch.code ?? patch.available?.workspaceError ?? patch.live?.workspace.code ?? null, modelState: patch.live?.modelState ?? null }; snapshot = { ...snapshot, ...patch, diagnostics: [...snapshot.diagnostics, marker].slice(-16) }; for (const fn of listeners) fn(snapshot); }
  function announce(kind, projectId = snapshot.active?.projectId) { channel?.postMessage({ kind, projectId, owner }); }
  async function preference(patch) {
    const run = serial.then(async () => {
      try {
        if (!live || snapshot.preferenceError) throw new StorageFault("CONFLICT", "Startup preferences are read-only. Reload to review them.", true);
        const values = typeof patch === "function" ? patch(snapshot.preferences) : { ...snapshot.preferences, ...patch };
        const saved = await store.saveResumePreferences(snapshot.preferences.revision, values);
        if (live) { emit({ preferences: saved, message: "Preferences saved." }); announce("preferences"); } return saved;
      } catch (error) { emit({ event: "preference-write-rejected", code: fault(error).code }); throw error; }
    }); serial = run.catch(() => {}); return run;
  }
  async function inspect(id, token) { const value = await inspectResumeProject(store, id); if (!current(token)) throw new StorageFault("ABANDONED", "Obsolete restore ignored.", true); return value; }
  async function open(id, fresh = false) {
    const token = ++generation; emit({ state: "RESTORING", active: null, live: null, foreignChange: false, message: "Validating selected workspace…" });
    try {
      const value = await inspect(id, token);
      if (snapshot.preferences.selectedProjectId !== id && !(snapshot.preferences.selectedProjectId === null && id === defaultId) && !snapshot.preferenceError) await preference({ selectedProjectId: id });
      if (!current(token)) return false;
      const active = { projectId: id, key: id + ":" + ++sequence, session: createResumeProjectSession(store, id, id === defaultId), fresh };
      emit({ selectedId: id, available: value, active, state: "RESTORING", message: fresh ? "Fresh project created separately. Previous saved projects are retained." : "Restoring validated project data…" }); return true;
    } catch (error) { if (current(token)) emit({ state: "RECOVERY_REQUIRED", active: null, message: "Saved data needs recovery. Original data is preserved. Retry or start a temporary fresh session.", code: fault(error).code }); return false; }
  }
  async function initialize() {
    const token = ++generation; emit({ state: "RESTORING", active: null, live: null, foreignChange: false, message: "Checking saved workspaces…" });
    try {
      await serial; if (!current(token)) return;
      const settings = await store.readResumePreferences().then(value => ({ value }), error => ({ error }));
      if (!current(token)) return;
      emit(settings.error ? { preferenceError: "Startup preferences are unavailable. Original settings are preserved; automatic resume is off.", preferences: { revision: 0, ...DEFAULT_RESUME_PREFERENCES, autoResume: false } } : { preferences: settings.value, preferenceError: "" });
      // The original qualified one-time legacy migration remains global.
      // New project sessions never copy the legacy thread into other projects.
      initialized ??= initializeProjectThread(createProjectSession(store));
      const defaultProject = await initialized.catch(() => store.defaultProject().then(manifest => ({ manifest })));
      const rows = await store.listProjects(); if (!current(token)) return;
      defaultId = defaultProject.manifest.projectId;
      const projects = rows.filter(row => row.manifest && !row.manifest.deleted).map(row => row.manifest), id = snapshot.preferences.selectedProjectId ?? defaultProject.manifest.projectId;
      emit({ projects, selectedId: id, storageAvailable: true, unavailableProjects: rows.filter(row => row.unavailable).length });
      const value = await inspect(id, token);
      emit({ available: value, state: value.saved ? "RESTORE_AVAILABLE" : "NO_SAVED_WORKSPACE", message: value.saved ? "Saved workspace is available. Resume when you are ready." : "No saved workspace data yet." });
      if (!snapshot.preferenceError && (snapshot.preferences.autoResume || !value.saved)) await open(id, !value.saved);
    } catch (error) { if (current(token)) emit({ state: "RECOVERY_REQUIRED", code: fault(error).code, message: "Saved data is unavailable. Original records are preserved. Retry or start a temporary fresh session." }); }
  }
  if (channel) channel.onmessage = event => {
    const v = event.data;
    if (!v || v.owner === owner || !["preferences", "workspace", "memory", "deleted-workspace"].includes(v.kind)) return;
    if (v.kind === "preferences") { emit({ preferenceError: "Startup preferences changed in another tab. Reload to review them." }); return; }
    if (v.projectId === snapshot.active?.projectId) emit({ state: "STALE", foreignChange: true, message: "This saved project changed in another tab. Reload before saving or deleting." });
  };
  return Object.freeze({
    getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, initialize,
    async choose(id) { const token = ++generation; try { const value = await inspect(id, token); emit({ selectedId: id, available: value, state: "RESTORE_AVAILABLE", active: null, live: null, foreignChange: false, message: "Selected saved project. Choose Resume to open it." }); return true; } catch (error) { if (current(token)) emit({ state: "RECOVERY_REQUIRED", message: "Selected project needs recovery. Its data is preserved.", code: fault(error).code }); return false; } },
    resume: () => open(snapshot.selectedId), reload: () => { initialized = null; return initialize(); },
    async fresh(name) {
      await serial;
      if (snapshot.preferenceError || snapshot.state === "RECOVERY_REQUIRED" && !snapshot.storageAvailable) {
        ++generation; emit({ state: "FRESH_SESSION", active: { projectId: null, key: "temporary:" + ++sequence, session: createUnsavedSession(store), fresh: true }, live: null, foreignChange: false, message: "Temporary fresh session. Nothing is saved or erased; original saved projects remain intact." }); return true;
      }
      const created = await store.createFreshProject(snapshot.preferences.revision, snapshot.preferences, name || "Untitled workspace");
      emit({ preferences: created.preferences, projects: [...snapshot.projects, created.project] }); announce("preferences"); return open(created.project.projectId, true);
    },
    setAutoResume: value => preference({ autoResume: value }),
    setVisualization: value => JSON.stringify(value) === JSON.stringify(snapshot.preferences.visualization) ? Promise.resolve() : preference({ visualization: value }),
    rename(name) { const id = snapshot.selectedId; return preference(values => namedProject(values, id, name)); },
    report(key, value) {
      if (snapshot.active?.key !== key) return;
      const previous = snapshot.live;
      const state = !snapshot.active.projectId ? "FRESH_SESSION" : snapshot.foreignChange ? "STALE" : deriveResumeState(value, snapshot.active.fresh);
      emit({ live: value, state, message: snapshot.foreignChange ? "Saved project changed in another tab. Reload before saving." : value.workspace.partial ? "Verified sources restored. Saved graph needs recovery and is preserved read-only." : value.workspace.state === "loading" ? "Restoring validated project data…" : !snapshot.active.projectId ? "Temporary session. Original saved projects are retained; local changes are not saved." : state === "RECOVERY_REQUIRED" ? "Saved workspace needs recovery. Other safe categories remain available; originals are preserved." : "Project data is available. Pending actions are never resumed." });
      if (value.workspace.state === "committed" && value.workspace.revision !== previous?.workspace.revision) announce("workspace");
    },
    async capture() {
      if (!snapshot.active?.projectId || snapshot.foreignChange) throw new StorageFault("CONFLICT", "Reload the current project before clearing saved data.", true);
      const active = snapshot.active, project = await store.readProject(active.projectId);
      if (snapshot.active?.key !== active.key) throw new StorageFault("ABANDONED", "Project changed before confirmation. Nothing was cleared.", true);
      return { projectId: project.projectId, revision: project.revision, key: active.key };
    },
    async clear(token, category, command = { kind: "clear" }) {
      try {
        if (token.key !== snapshot.active?.key || token.projectId !== snapshot.active?.projectId) throw new StorageFault("ABANDONED", "Project changed. Nothing was cleared.", true);
        const receipt = category === "workspace" ? await store.deleteWorkspace(token.projectId, token.revision) : await store.saveMemory(token.projectId, token.revision, command);
        emit({ event: category === "workspace" ? "workspace-clear-committed" : "memory-clear-committed" });
        announce(category === "workspace" ? "deleted-workspace" : "memory", token.projectId);
        if (token.key === snapshot.active?.key) await open(token.projectId);
        return receipt;
      } catch (error) { emit({ event: category === "workspace" ? "workspace-clear-rejected" : "memory-clear-rejected", code: fault(error).code }); throw error; }
    },
    label: id => projectLabel(snapshot.preferences, id),
    dispose() { live = false; generation++; listeners.clear(); channel?.close(); },
  });
}
