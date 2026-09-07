export const THREAD_SCHEMA_VERSION = 1;
export const THREAD_LIMITS = Object.freeze({ messages: 80, messageChars: 6000, summaryChars: 2000, recordChars: 1000000 });
const text = (v, n = 200) => typeof v === "string" ? v.slice(0, n) : "";

// Explicit projections prevent persisted objects from reviving executable UI
// actions, approval tokens, model settings, or application-owned state.
export function workspaceReferences(state = {}) {
  return {
    activeBatchId: text(state.activeBatchId),
    files: (state.agentFiles ?? []).slice(0, 50).map(f => ({ id: text(f.id), name: text(f.name), size: Number(f.size) || 0, requiresReupload: true })),
    parseMode: ["together", "separate"].includes(state.activeBatch?.parseMode) ? state.activeBatch.parseMode : "unknown",
    detectedFormat: text(state.agentDetection?.formatId),
    parser: { version: Number(state.customCodeVersion) || 0, source: text(state.customCodeSource), code: text(state.customCode, 60000), status: "requires_review", resultId: text(state.customResultId), historicalStatus: text(state.activeBatch?.parserStatus) },
    graph: { id: text(state.graphId), version: Number(state.graphVersion) || 0, fingerprint: text(state.graphFingerprint), available: false },
    workflow: { status: text(state.specialist?.status), attempts: Number(state.specialist?.attempts) || 0, requiresReview: true,
      drafts: (state.specialist?.jobs ?? []).slice(-3).map(job => ({ id: text(job.id), code: text(job.code, 60000), fileNames: (job.fileNames ?? []).slice(0, 50).map(n => text(n, 240)), attempts: Number(job.attempts) || 0, status: "requires_review" })),
    },
    requiresReupload: Boolean(state.agentFiles?.length),
    pendingAction: null,
  };
}

export function normalizeThreadRecord(record) {
  if (!record || typeof record !== "object" || ![0, 1].includes(record.schemaVersion)) throw new Error("Unsupported or corrupt thread schema.");
  if (JSON.stringify(record).length > THREAD_LIMITS.recordChars) throw new Error("Stored thread exceeds the bounded record limit.");
  const workspace = record.workspace && typeof record.workspace === "object" ? record.workspace : {};
  return {
    schemaVersion: THREAD_SCHEMA_VERSION,
    id: text(record.id) || "main",
    updatedAt: text(record.updatedAt),
    messages: (Array.isArray(record.messages) ? record.messages : []).slice(-THREAD_LIMITS.messages).filter(m => m && ["user", "agent"].includes(m.role)).map((m, i) => ({ id: text(m.id, 80) || `restored-${i}`, role: m.role, text: text(m.text, THREAD_LIMITS.messageChars), tone: "", actions: [] })),
    summary: text(record.summary, THREAD_LIMITS.summaryChars),
    workspace: workspaceReferences({
      activeBatchId: workspace.activeBatchId,
      agentFiles: Array.isArray(workspace.files) ? workspace.files : [],
      activeBatch: { parseMode: workspace.parseMode, parserStatus: workspace.parser?.historicalStatus },
      agentDetection: { formatId: workspace.detectedFormat },
      customCodeVersion: workspace.parser?.version,
      customCodeSource: workspace.parser?.source,
      customCode: workspace.parser?.code,
      customResultId: workspace.parser?.resultId,
      graphId: workspace.graph?.id,
      graphVersion: workspace.graph?.version,
      graphFingerprint: workspace.graph?.fingerprint,
      specialist: { ...workspace.workflow, jobs: Array.isArray(workspace.workflow?.drafts) ? workspace.workflow.drafts : [] },
    }),
    pendingAction: null,
  };
}
