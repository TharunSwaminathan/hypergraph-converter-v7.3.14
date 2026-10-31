import { createProjectSession } from "./projectSession.js";
import { StorageFault } from "./storageSafety.js";

// Selection is captured per mounted owner. Another tab's selection never
// redirects this writer or its project memory. Legacy migration remains owned
// by the original default project, before the startup chooser is presented.
export function createResumeProjectSession(store, projectId, legacyOwner = false, reviewedRevision = null) {
  const project = async () => { const p = await store.readProject(projectId); if (legacyOwner && await store.recovery()) throw new StorageFault("QUARANTINED", "Original project needs legacy recovery. Saved records are preserved read-only.", true); if (p.deleted) throw new StorageFault("DELETED", "Saved project was deleted. Reload before saving.", true); return p; };
  const session = createProjectSession({ ...store, scopeProjectId: projectId, defaultProject: project, workspaceProject: () => session.defaultProject(),
    initializeCurrentProject: async () => { await session.defaultProject(); return session.load(projectId); }, close: async () => {} }, reviewedRevision === null ? null : { projectId, revision: reviewedRevision });
  return session;
}
export function createUnsavedSession(store) {
  return createProjectSession({ ...store, scopeProjectId: null,
    defaultProject: async () => { throw new StorageFault("UNAVAILABLE", "Temporary session. Changes are not saved."); }, close: async () => {} });
}
