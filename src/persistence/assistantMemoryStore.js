import { restoreWorkspace } from "./workspaceRestore.js";

// Only verified 7B bytes establish source/graph linkage. Callers cannot supply it.
export async function verifiedMemoryBinding(store, projectId) {
  try {
    const fact = await verifiedWorkspaceMemory(store, projectId);
    return fact ? { ...fact.binding, verifiedContent: fact.content } : null;
  } catch { return null; }
}
export async function verifiedWorkspaceMemory(store, projectId) {
  const workspace = await restoreWorkspace(store, projectId);
  if (!workspace.available) return null;
  return { binding: { projectId, workspaceDigest: workspace.root.sha256, graphFingerprint: workspace.graph?.graphFingerprint ?? null, sourceDigests: workspace.root.sources.map(s => s.sha256) }, content: `Verified saved workspace: ${workspace.root.sources.length} source objects; ${Array.isArray(workspace.graph?.hyperedges) ? workspace.graph.hyperedges.length + " hyperedges" : "graph cardinality unavailable"}; graph fingerprint ${workspace.graph?.graphFingerprint ?? "unavailable"}.` };
}
