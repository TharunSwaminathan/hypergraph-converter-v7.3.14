import { validateWorkspaceData } from "./workspaceObjectSchema.js";
import { StorageFault } from "./storageSafety.js";

// Hashing occurs outside IDB transactions. Recheck publication/ownership before
// returning any available graph, and let the UI owner reject obsolete callbacks.
export async function restoreWorkspace(store, projectId, isCurrent = () => true, checkpointId = null) {
  const bundle = await store.readWorkspace(projectId, checkpointId);
  if (!bundle.root) return { manifest: bundle.manifest, available: false, status: "MISSING_SOURCE", requiresReupload: true, graph: null, sources: [] };
  const result = await validateWorkspaceData(bundle), latest = await store.readWorkspace(projectId);
  if (!isCurrent()) throw new StorageFault("ABANDONED", "Obsolete workspace owner cannot publish restored data.", true);
  if (latest.root?.sha256 !== result.root.sha256) throw new StorageFault("CONFLICT", "Workspace changed during restoration; reload before publishing.", true);
  return result;
}
