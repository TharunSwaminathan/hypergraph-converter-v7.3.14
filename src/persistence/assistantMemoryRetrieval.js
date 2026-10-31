import { boundedCopy } from "./storageSafety.js";
import { MEMORY_LIMITS as L, MEMORY_TYPES, MEMORY_PROVENANCE } from "./assistantMemorySchema.js";
import { isProjectId } from "./projectSchema.js";

// Contradictions are explicit topic/type collisions, not guessed semantic NLP.
export function inspectMemories(envelope, binding = null) {
  const records = envelope?.records ?? [];
  return records.map(r => {
    const conflicts = r.status === "ACTIVE" ? records.filter(p => p.status === "ACTIVE" && p.memoryType === r.memoryType && p.topic === r.topic && p.memoryId !== r.memoryId && p.contentDigest !== r.contentDigest).map(p => p.memoryId) : [];
    const stale = r.sourceRefs.length > 0 && (!binding || r.sourceRefs[0].workspaceDigest !== binding.workspaceDigest || r.sourceRefs[0].graphFingerprint !== binding.graphFingerprint || JSON.stringify(r.sourceRefs[0].sourceDigests) !== JSON.stringify(binding.sourceDigests) || r.provenance === "WORKSPACE_DERIVED" && r.content !== binding.verifiedContent);
    return { ...r, retrievalStatus: r.status !== "ACTIVE" ? r.status : stale ? "STALE" : conflicts.length ? "CONFLICT" : "ACTIVE", conflicts };
  });
}
export function retrieveMemories(envelope, binding = null) {
  const inspected = inspectMemories(envelope, binding), candidates = inspected.filter(r => r.retrievalStatus === "ACTIVE");
  candidates.sort((a, b) => b.importance - a.importance || (a.provenance === "USER_EXPLICIT" ? 0 : 1) - (b.provenance === "USER_EXPLICIT" ? 0 : 1) || b.revision - a.revision || a.memoryId.localeCompare(b.memoryId, "en"));
  const items = [], counts = new Map(); let chars = 0;
  for (const r of candidates) {
    const item = { memoryId: r.memoryId, projectId: r.projectId, type: r.memoryType, topic: r.topic, provenance: r.provenance, confidence: r.confidence, content: r.content };
    const size = JSON.stringify(item).length;
    if (items.length >= L.retrieved || (counts.get(r.memoryType) ?? 0) >= L.perType || chars + size > L.contextChars) continue;
    chars += size; counts.set(r.memoryType, (counts.get(r.memoryType) ?? 0) + 1); items.push(item);
  }
  return { authority: "untrusted_context_only", projectId: envelope?.projectId ?? null, items, excluded: inspected.length - items.length, conflicts: inspected.filter(r => r.retrievalStatus === "CONFLICT").length, stale: inspected.filter(r => r.retrievalStatus === "STALE").length, budgetChars: L.contextChars };
}
// Defensive boundary: normalize only the bounded recall view, never raw records.
export function normalizeMemoryContext(input) {
  try {
    const v = boundedCopy(input, { bytes: 32000, depth: 4, nodes: 130, array: L.retrieved, string: L.contentChars });
    if (!v || !isProjectId(v.projectId) || !Array.isArray(v.items) || v.items.length > L.retrieved) return null;
    const items = v.items.map(r => ({ memoryId: r.memoryId, projectId: r.projectId, type: r.type, topic: r.topic, provenance: r.provenance, confidence: r.confidence, content: r.content }));
    if (items.some(r => !isProjectId(r.memoryId) || r.projectId !== v.projectId || !MEMORY_TYPES.includes(r.type) || !MEMORY_PROVENANCE.includes(r.provenance) || typeof r.content !== "string" || r.content.length > L.contentChars || typeof r.topic !== "string" || r.topic.length > 80 || !["USER_STATED", "DETERMINISTIC", "UNVERIFIED"].includes(r.confidence)) || items.reduce((n,r) => n + JSON.stringify(r).length, 0) > L.contextChars) return null;
    return { authority: "untrusted_context_only", projectId: v.projectId, items, excluded: Number.isSafeInteger(v.excluded) ? v.excluded : 0, conflicts: Number.isSafeInteger(v.conflicts) ? v.conflicts : 0, stale: Number.isSafeInteger(v.stale) ? v.stale : 0 };
  } catch { return null; }
}
