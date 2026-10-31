import { validateWorkspaceData } from "./workspaceObjectSchema.js";
import { StorageFault } from "./storageSafety.js";

export function sourceGraphSummary(root) {
  return root ? { sources: root.sources.map(s => ({ key: s.provenance.sourceKey, digest: s.sha256 })), graphSources: root.graph?.provenance.sources.map(s => s.sha256) ?? [] } : null;
}
export function sourceGraphOutOfDate(summary, activeKeys) {
  if (!summary?.graphSources.length || !activeKeys.length) return false;
  const current = activeKeys.map(key => summary.sources.find(s => s.key === key)?.digest);
  // A newly hydrated in-memory key is not evidence of changed bytes.
  return current.every(Boolean) && current.some(digest => !summary.graphSources.includes(digest));
}

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

// Explicit read-only partial restore: preserve the original root and every
// byte. Only verified sources/derived metadata are exposed; never synthesize
// a missing graph or grant a partial owner permission to overwrite it.
export async function restoreWorkspaceCategories(store, projectId, isCurrent = () => true) {
  try { return await restoreWorkspace(store, projectId, isCurrent); }
  catch (error) {
    if (!["CORRUPT_GRAPH", "INCOMPLETE", "CORRUPT"].includes(error.code)) throw error;
    const bundle = await store.readWorkspace(projectId);
    const partial = await validateWorkspaceData(bundle, { sourceOnly: true });
    const latest = await store.readWorkspace(projectId);
    if (!isCurrent() || latest.root?.sha256 !== partial.root.sha256) throw new StorageFault("CONFLICT", "Saved data changed during partial restore. Reload first.", true);
    return { ...partial, partial: true, graph: null, categoryIssue: error.code };
  }
}
