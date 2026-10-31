import { APP_NAMESPACE, isProjectId } from "./projectSchema.js";
import { boundedCopy, StorageFault } from "./storageSafety.js";

export const RESUME_PREFERENCE_ID = "workspace-resume";
export const DEFAULT_RESUME_PREFERENCES = Object.freeze({ autoResume: true, selectedProjectId: null, labels: [], visualization: Object.freeze({ view: "hypergraph", layout: "force", limit: 50 }) });
export function validateResumePreferences(input) {
  const p = boundedCopy(input, { bytes: 20000, depth: 4, nodes: 400, array: 80, string: 160 });
  if (p?.schemaVersion !== 1) throw new StorageFault("INCOMPATIBLE", "Startup preferences need a compatible application. Original settings are preserved.", true);
  if (Object.keys(p).sort().join() !== "appNamespace,autoResume,id,labels,revision,schemaVersion,selectedProjectId,visualization" || p.id !== RESUME_PREFERENCE_ID || p.appNamespace !== APP_NAMESPACE || !Number.isSafeInteger(p.revision) || p.revision < 1 || typeof p.autoResume !== "boolean" || !(p.selectedProjectId === null || isProjectId(p.selectedProjectId)) || !Array.isArray(p.labels)) throw new StorageFault("CORRUPT", "Startup preferences are invalid. Original settings are preserved.", true);
  const ids = new Set();
  for (const label of p.labels) {
    if (!label || Object.keys(label).sort().join() !== "name,projectId" || !isProjectId(label.projectId) || ids.has(label.projectId) || typeof label.name !== "string" || !label.name.trim() || label.name.length > 80 || [...label.name].some(char => char.codePointAt(0) < 32 || char.codePointAt(0) === 127)) throw new StorageFault("CORRUPT", "Workspace labels are invalid.", true);
    ids.add(label.projectId);
  }
  const v = p.visualization;
  if (!v || Object.keys(v).sort().join() !== "layout,limit,view" || !["hypergraph", "linegraph"].includes(v.view) || !["force", "circular", "grid"].includes(v.layout) || !Number.isSafeInteger(v.limit) || v.limit < 1 || v.limit > 10000) throw new StorageFault("CORRUPT", "Display preferences are invalid.", true);
  return p;
}
export function resumePreferences(revision, values) {
  if (values.schemaVersion !== undefined && values.schemaVersion !== 1) throw new StorageFault("INCOMPATIBLE", "Startup preference schema is unsupported.", true);
  return validateResumePreferences({ ...values, id: RESUME_PREFERENCE_ID, appNamespace: APP_NAMESPACE, schemaVersion: 1, revision });
}
export function projectLabel(preferences, projectId) { return preferences.labels.find(row => row.projectId === projectId)?.name ?? "Workspace " + projectId.slice(0, 8); }
export function namedProject(preferences, projectId, name) { return { ...preferences, labels: [...preferences.labels.filter(row => row.projectId !== projectId), { projectId, name: name.trim() }] }; }
