import { StorageFault } from "./storageSafety.js";
import { inspectMemories, retrieveMemories } from "./assistantMemoryRetrieval.js";
import { verifiedMemoryBinding } from "./assistantMemoryStore.js";

export function createMemoryCoordinator(store, projectId, workspaceIsCurrent = () => true) {
  let active = true, revision = null, envelope = null, tail = Promise.resolve();
  const current = () => { if (!active) throw new StorageFault("ABANDONED", "Project memory owner is no longer active.", true); };
  async function snapshot() {
    current(); const bundle = await store.readMemory(projectId);
    let binding = workspaceIsCurrent() ? await verifiedMemoryBinding(store, projectId) : null;
    const latest = await store.readMemory(projectId); current();
    if (bundle.envelope?.sha256 !== latest.envelope?.sha256) throw new StorageFault("CONFLICT", "Memory changed during retrieval; retry inspection.", true);
    // Chat-only revisions do not invalidate recall. Recheck the relevant root,
    // while writes still retain the strict shared project CAS lineage.
    if (binding) { const latestRoot = (await store.readWorkspace(projectId)).root; if (!workspaceIsCurrent() || latestRoot?.sha256 !== binding.workspaceDigest) binding = null; }
    current();
    return { ...latest, records: inspectMemories(latest.envelope, binding), context: retrieveMemories(latest.envelope ?? { projectId, records: [] }, binding) };
  }
  return Object.freeze({
    async initialize() { const result = await snapshot(); current(); revision = result.manifest.revision; envelope = result.envelope; return result; },
    inspect: snapshot,
    async context() { return (await snapshot()).context; },
    mutate(command) {
      const operation = tail.then(async () => {
        current(); if (revision === null) throw new StorageFault("UNAVAILABLE", "Memory is not ready.");
        const receipt = await store.saveMemory(projectId, revision, command, () => active);
        current(); revision = receipt.revision; envelope = receipt.envelope;
        return { ...receipt, records: inspectMemories(envelope) };
      });
      tail = operation.catch(() => {}); return operation;
    },
    dispose() { active = false; envelope = null; },
  });
}
export function parseMemoryCommand(query) {
  const natural = /^remember that\s+([\s\S]+)$/i.exec(query.trim());
  if (natural) return { kind: "remember", memoryType: "USER_DECISION", topic: "general", content: natural[1], provenance: "USER_EXPLICIT" };
  if (/^(?:list|inspect|show) (?:project )?memories[.!]?$/i.test(query.trim())) return { kind: "list" };
  const forget = /^forget memory ([0-9a-f-]{36})[.!]?$/i.exec(query.trim());
  return forget ? { kind: "forget", memoryId: forget[1] } : null;
}
