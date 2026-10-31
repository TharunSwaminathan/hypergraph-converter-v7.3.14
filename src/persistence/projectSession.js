import { StorageFault } from "./storageSafety.js";

// One tab shares a serialized local writer lineage. Local chat-only commits may
// advance the CAS revision without changing workspace bytes, and vice versa.
// Revisions from another tab are never added to this lineage by retry/rebase.
export function createProjectSession(store) {
  const owners = new Map(); let tail = Promise.resolve();
  const adopt = value => {
    const m = value?.manifest ?? value;
    if (m?.projectId && (!owners.has(m.projectId) || !owners.get(m.projectId).userWrites)) owners.set(m.projectId, { revision: m.revision, first: m.revision, userWrites: 0 });
    return value;
  };
  function write(method, projectId, expected, ...args) {
    const operation = tail.then(async () => {
      const owner = owners.get(projectId);
      const strict = method === "publishMigration";
      if (!strict && (!owner || !Number.isSafeInteger(expected) || expected < owner.first || expected > owner.revision)) throw new StorageFault("CONFLICT", "This writer does not own the current project lineage. Reload before saving.", true);
      const receipt = await store[method](projectId, strict ? expected : owner.revision, ...args);
      if (!receipt.ok || !receipt.saved || !Number.isSafeInteger(receipt.revision)) return receipt;
      const current = owner ?? { first: expected, userWrites: 0 };
      current.revision = receipt.revision;
      if (!strict) current.userWrites++;
      owners.set(projectId, current); return receipt;
    });
    tail = operation.catch(() => {}); return operation;
  }
  return Object.freeze({ ...store,
    defaultProject: async () => adopt(await store.defaultProject()),
    load: async id => adopt(await store.load(id)),
    readWorkspace: async (...args) => adopt(await store.readWorkspace(...args)),
    createProject: async (...args) => adopt(await store.createProject(...args)),
    saveThread: (...args) => write("saveThread", ...args),
    publishMigration: (...args) => write("publishMigration", ...args),
    saveWorkspace: (...args) => write("saveWorkspace", ...args),
    saveMemory: (...args) => write("saveMemory", ...args),
    deleteProject: (...args) => write("deleteProject", ...args),
    reattachSource: (...args) => write("reattachSource", ...args),
    discardWorkspaceOrphans: (...args) => write("discardWorkspaceOrphans", ...args),
  });
}
