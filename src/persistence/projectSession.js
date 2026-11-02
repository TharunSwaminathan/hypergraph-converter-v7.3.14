import { StorageFault } from "./storageSafety.js";
import { isProjectId } from "./projectSchema.js";
import { stableStringify } from "../graph/graphFingerprint.js";

// One tab shares a serialized local writer lineage. Local chat-only commits may
// advance the CAS revision without changing workspace bytes, and vice versa.
// Revisions from another tab are never added to this lineage by retry/rebase.
export function createProjectSession(store, reviewedProject = null) {
  const owners = new Map(); let tail = Promise.resolve();
  const reviews = new WeakMap();
  if (reviewedProject) {
    const { projectId, revision } = reviewedProject;
    if (!isProjectId(projectId) || !Number.isSafeInteger(revision) || revision < 1) throw new StorageFault("CORRUPT", "Reviewed project identity is invalid.", true);
    owners.set(projectId, { revision, first: revision, userWrites: 0, reviewed: true });
  }
  const adopt = value => {
    const m = value?.manifest ?? value;
    if (m?.projectId && (!owners.has(m.projectId) || !owners.get(m.projectId).reviewed && !owners.get(m.projectId).userWrites)) owners.set(m.projectId, { revision: m.revision, first: m.revision, userWrites: 0 });
    return value;
  };
  function enqueue(fn) { const operation = tail.then(fn); tail = operation.catch(() => {}); return operation; }
  function acknowledge(owner, projectId, receipt) {
    if (owner.reviewed && (receipt.projectId !== projectId || !Number.isSafeInteger(receipt.revision) || receipt.revision !== owner.revision + 1)) {
      owner.invalid = true;
      throw new StorageFault("CORRUPT", "Writer acknowledgement is invalid. Reload before writing.", true);
    }
    owner.revision = receipt.revision; owner.userWrites++;
  }
  function write(method, projectId, expected, ...args) {
    return enqueue(async () => {
      const owner = owners.get(projectId);
      const strict = method === "publishMigration";
      if (owner?.invalid || owner?.reviewed && strict && expected !== owner.revision || !strict && (!owner || !Number.isSafeInteger(expected) || expected < owner.first || expected > owner.revision)) throw new StorageFault("CONFLICT", "This writer does not own the current project lineage. Reload before saving.", true);
      const receipt = await store[method](projectId, strict ? expected : owner.revision, ...args);
      if (!receipt.ok || !receipt.saved) return receipt;
      const current = owner ?? { first: expected, userWrites: 0 };
      if (current.reviewed) acknowledge(current, projectId, receipt);
      else { if (!Number.isSafeInteger(receipt.revision)) return receipt; current.revision = receipt.revision; if (!strict) current.userWrites++; }
      owners.set(projectId, current); return receipt;
    });
  }
  return Object.freeze({ ...store,
    captureDestructive(projectId, category, command = null) {
      return enqueue(() => {
        const owner = owners.get(projectId);
        if (!owner?.reviewed || owner.invalid || !["workspace", "memory", "history"].includes(category)) throw new StorageFault("CONFLICT", "Reload and review this project before clearing saved data.", true);
        // No durable read may silently rebase the active UI's authority.
        const token = Object.freeze({ projectId, revision: owner.revision });
        reviews.set(token, { owner, projectId, category, command: category === "history" ? stableStringify(command) : null }); return token;
      });
    },
    async clearReviewed(token, category, command, isCurrent = () => true) {
      const review = reviews.get(token); reviews.delete(token);
      if (!review || review.category !== category || category === "history" && review.command !== stableStringify(command)) throw new StorageFault("ABANDONED", "Confirmation is invalid or already used. Nothing was cleared.", true);
      return enqueue(async () => {
        const owner = owners.get(review.projectId);
        const check = () => { if (!isCurrent() || owner !== review.owner || owner.invalid) throw new StorageFault("ABANDONED", "Project review changed. Nothing was cleared.", true); };
        check();
        if (category === "history" && owner.revision !== token.revision) throw new StorageFault("CONFLICT", "History changed after review. Review again before deleting.", true);
        const durable = await store.readProject(review.projectId); check();
        if (durable.deleted || durable.revision !== owner.revision) throw new StorageFault("CONFLICT", "Saved data changed outside this writer. Reload and review before clearing.", true);
        // Only acknowledged writes in this serialized owner may advance the
        // reviewed token. Native CAS still enforces this revision transactionally.
        const receipt = category === "workspace" ? await store.deleteWorkspace(review.projectId, owner.revision, isCurrent) : category === "history" ? await store.mutateAnalysisHistory(review.projectId, owner.revision, command, isCurrent) : await store.saveMemory(review.projectId, owner.revision, command, isCurrent);
        if (!receipt.ok || !receipt.saved) throw new StorageFault("ABORTED", "Saved data was not cleared.");
        acknowledge(owner, review.projectId, receipt); return receipt;
      });
    },
    async importReviewed(token, stage, isCurrent = () => true) {
      const review = reviews.get(token); reviews.delete(token);
      if (!review || review.category !== "workspace") throw new StorageFault("ABANDONED", "Import confirmation is invalid or already used.", true);
      return enqueue(async () => {
        const owner = owners.get(review.projectId);
        const current = () => isCurrent() && owner === review.owner && !owner.invalid && owner.revision === token.revision;
        if (!current()) throw new StorageFault("CONFLICT", "Saved workspace changed after import review. Review again.", true);
        const receipt = await store.importWorkspace(stage, { targetId: review.projectId, expectedRevision: token.revision, isCurrent: current });
        acknowledge(owner, review.projectId, receipt);
        // This mount still contains pre-import data. Queued saves may not
        // overwrite imported bytes; normal Resume creates a new owner.
        owner.invalid = true;
        return receipt;
      });
    },
    defaultProject: async () => adopt(await store.defaultProject()),
    load: async id => adopt(await store.load(id)),
    readWorkspace: async (...args) => adopt(await store.readWorkspace(...args)),
    createProject: async (...args) => adopt(await store.createProject(...args)),
    saveThread: (...args) => write("saveThread", ...args),
    publishMigration: (...args) => write("publishMigration", ...args),
    saveWorkspace: (...args) => write("saveWorkspace", ...args),
    saveMemory: (...args) => write("saveMemory", ...args),
    mutateAnalysisHistory: (...args) => write("mutateAnalysisHistory", ...args),
    deleteProject: (...args) => write("deleteProject", ...args),
    reattachSource: (...args) => write("reattachSource", ...args),
    discardWorkspaceOrphans: (...args) => write("discardWorkspaceOrphans", ...args),
  });
}
