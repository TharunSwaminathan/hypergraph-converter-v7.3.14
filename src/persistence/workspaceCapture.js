import { boundedCopy, StorageFault } from "./storageSafety.js";
import { WORKSPACE_LIMITS } from "./storageBudget.js";

// Registry entries retain existing Blob/string owners, not extra graph copies.
// A changed editor value receives a new key; a graph retains its input owners
// even when another file/editor later replaces the current workspace input.
export function createWorkspaceSourceRegistry() {
  const entries = new Map(); let sequence = 0;
  return { get(slot, value, name, kind = "editor", originalId = "") {
    const old = entries.get(slot);
    if (old?.value === value) return old.source;
    // Input keys are not durable object/project identities. Missing secure
    // crypto must not crash deterministic editing; actual publication still
    // requires secure UUIDs and Web Crypto and fails explicitly without them.
    let key; try { key = globalThis.crypto?.randomUUID?.(); } catch { /* unavailable storage capability */ }
    const source = { key: key ?? `volatile-input-${++sequence}`, name, kind, originalId, mediaType: typeof value === "string" ? "text/plain;charset=utf-8" : value?.type ?? "", bytes: typeof value === "string" ? new Blob([value]) : value };
    entries.delete(slot); entries.set(slot, { value, source });
    if (entries.size > 160) entries.delete(entries.keys().next().value);
    return source;
  } };
}
export function captureWorkspaceInputs(registry, { fmt, texts, nv, sv, tv, customCode, customCodeVersion, customFiles, manualUploads = {}, batches, activeBatchId, graphBinding }) {
  const sources = new Map(), add = source => { sources.set(source.key, source); return source.key; };
  const file = (f, slot) => add(registry.get(slot, f.sourceBlob ?? f.text, f.name, f.sourceBlob ? "upload" : "editor", f.id ?? ""));
  const editors = [];
  for (const [slot, text] of Object.entries({ ...Object.fromEntries(Object.entries(texts).map(([key, value]) => [`text:${key}`, value])), nv, sv, tv })) {
    if (text) editors.push({ slot, key: add(registry.get(slot, text, slot + ".txt")) });
  }
  const batchMetadata = batches.map(batch => ({ id: batch.id, label: batch.label, version: batch.version, parseMode: batch.parseMode, formatId: batch.detectedFormat?.formatId ?? "unknown",
    keys: batch.files.map(f => file(f, "file:" + f.id)) }));
  const customKeys = customFiles.map((f, index) => file(f, "custom:" + (f.id ?? `${f.name}:${index}`)));
  const manual = Object.entries(manualUploads).map(([slot, f]) => ({ slot, key: file(f, "manual:" + slot) }));
  const parserKey = add(registry.get("parser", customCode, "parser.js", "parser"));
  for (const source of graphBinding?.sources ?? []) add(source);
  return { sources: [...sources.values()], graphSourceKeys: graphBinding?.sources.map(s => s.key) ?? [], mapping: graphBinding?.mapping ?? {},
    parser: graphBinding?.parser ?? "deterministic-editor", transform: graphBinding?.transform ?? "workspace-checkpoint",
    metadata: { schemaVersion: 1, fmt, editors, batches: batchMetadata, activeBatchId, customKeys, manual, parserKey, parserVersion: customCodeVersion } };
}
export function decodeWorkspaceInputs(restored) {
  const m = boundedCopy(restored.metadata, { bytes: WORKSPACE_LIMITS.derivedBytes, depth: 16, nodes: 20000, array: 1000, string: 60000 });
  const expected = ["schemaVersion", "fmt", "editors", "batches", "activeBatchId", "customKeys", "manual", "parserKey", "parserVersion"].sort().join();
  const bad = () => { throw new StorageFault("CORRUPT", "Stored application workspace metadata is incompatible; restore is read-only.", true); };
  if (m?.schemaVersion !== 1 || Object.keys(m).sort().join() !== expected || typeof m.fmt !== "string" || !Array.isArray(m.editors) || !Array.isArray(m.batches)
    || !Array.isArray(m.customKeys) || !Array.isArray(m.manual) || !Number.isSafeInteger(m.parserVersion) || m.parserVersion < 0) bad();
  const byKey = new Map(restored.sources.map(s => [s.provenance.sourceKey, s]));
  const source = key => { const s = byKey.get(key); if (!s || !s.available) bad(); return s; };
  const decoded = key => new TextDecoder().decode(source(key).bytes);
  const file = key => { const s = source(key), text = decoded(key); return { id: s.provenance.originalId || key, name: s.provenance.name, type: s.provenance.mediaType,
    text, size: s.byteLength, sourceBlob: new Blob([s.bytes], { type: s.provenance.mediaType }), extension: s.provenance.name.split('.').pop().toLowerCase(), requiresReupload: false }; };
  const editors = {};
  for (const row of m.editors) { if (!row || typeof row.slot !== "string" || !/^(text:[a-z0-9_]+|nv|sv|tv)$/.test(row.slot) || Object.hasOwn(editors, row.slot)) bad(); editors[row.slot] = decoded(row.key); }
  const ids = new Set();
  const batches = m.batches.map(batch => {
    if (!batch || typeof batch.id !== "string" || batch.id.length > 160 || ids.has(batch.id) || typeof batch.label !== "string" || batch.label.length > 240 || !Number.isSafeInteger(batch.version)
      || batch.version < 1 || !Array.isArray(batch.keys) || typeof batch.formatId !== "string" || batch.formatId.length > 80 || !["together", "separate", "unknown"].includes(batch.parseMode)) bad();
    ids.add(batch.id); return { ...batch, files: batch.keys.map(file) };
  });
  if (m.activeBatchId !== null && !ids.has(m.activeBatchId)) bad();
  const manualUploads = {};
  for (const row of m.manual) { if (!row || typeof row.slot !== "string" || !/^(text:[a-z0-9_]+|nv|sv|tv)$/.test(row.slot) || Object.hasOwn(manualUploads, row.slot)) bad(); manualUploads[row.slot] = file(row.key); }
  const graphSources = restored.root.graph?.provenance.sources.map(ref => restored.sources.find(s => s.objectId === ref.objectId)) ?? [];
  return { fmt: m.fmt, editors, batches, activeBatchId: m.activeBatchId, manualUploads, customFiles: m.customKeys.map(file), customCode: decoded(m.parserKey), customCodeVersion: m.parserVersion,
    graphBinding: restored.partial ? null : { sources: graphSources.map(s => ({ key: s.provenance.sourceKey, name: s.provenance.name, kind: s.provenance.kind, mediaType: s.provenance.mediaType, originalId: s.provenance.originalId, bytes: new Blob([s.bytes]) })),
      parser: restored.root.graph?.provenance.parser ?? "restored", mapping: restored.mapping, transform: "restored-checkpoint" } };
}
