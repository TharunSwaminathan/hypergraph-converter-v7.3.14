import { stableStringify } from "../graph/graphFingerprint.js";
import { createLocalStorageAdapter, browserLocalStorage } from "../persistence/localStorageAdapter.js";
import { boundedCopy, parseBoundedJSON, StorageFault, utf8Bytes } from "../persistence/storageSafety.js";

export const PARSER_PROFILE_STORAGE_KEY = "hypergraph_converter_parser_profiles_v7_3";
export const LEGACY_PARSER_PROFILE_STORAGE_KEY = "hypergraph_converter_parser_profiles_v7_2";

let profileCounter = 0;

export function createParserProfileFromMapping({
  name = "",
  mappingSpec = null,
  parserCode = "",
  activeBatch = null,
} = {}) {
  const files = activeBatch?.files ?? [];
  const signatures = files.map(file => ({
    name: file.name,
    extension: file.extension ?? extensionOf(file.name),
    sizeBucket: bucketSize(file.size ?? file.text?.length ?? 0),
    headerFingerprint: activeBatch?.datasetProfile?.files?.find(profile => profile.fileName === file.name)?.headerFingerprint ?? null,
    headers: activeBatch?.datasetProfile?.files?.find(profile => profile.fileName === file.name)?.columns?.map(column => column.name) ?? [],
    role: mappingSpec?.files?.find(mapped => mapped.fileName === file.name)?.role ?? activeBatch?.fileSummaries?.find(summary => summary.name === file.name)?.role ?? "unknown",
  }));
  return {
    id: createProfileId(),
    schemaVersion: 3,
    name: String(name || mappingSpec?.datasetType || activeBatch?.label || "Parser profile").trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    datasetType: mappingSpec?.datasetType ?? "unknown",
    fileRoles: mappingSpec?.files ?? activeBatch?.fileSummaries ?? [],
    fileSignatures: signatures,
    relationshipSignature: relationshipSignature(activeBatch?.relationshipEvidence ?? []),
    mappingSpec,
    parserCode,
    fingerprint: profileFingerprint({ mappingSpec, parserCode, signatures }),
  };
}

export const PARSER_PROFILE_PROJECT_KEY = "hypergraph-studio.parser-profiles.v1";
export const PROFILE_LIMITS = Object.freeze({ bytes: 2 * 1024 * 1024, depth: 14, nodes: 20000, array: 1000, string: 60000 });
const profileAdapters = new WeakMap();
export function validateStoredProfiles(input) {
  const value = boundedCopy(input, PROFILE_LIMITS);
  if (!Array.isArray(value) && value?.schema && value.schema !== "hypergraph-parser-profiles-v7.3") throw new StorageFault("INCOMPATIBLE", "Parser profile document version is incompatible.", true);
  const profiles = Array.isArray(value) ? value : value?.profiles;
  if (!Array.isArray(profiles) || profiles.length > 100) throw new StorageFault("LIMIT", "At most 100 bounded parser profiles are supported.", true);
  const ids = new Set();
  return profiles.map(profile => {
    if (![2, 3].includes(profile?.schemaVersion ?? 2)) throw new StorageFault("INCOMPATIBLE", "Parser profile version is incompatible; original data is preserved.", true);
    if (!isParserProfile(profile) || typeof profile.id !== "string" || profile.id.length > 160 || typeof profile.name !== "string" || profile.name.length > 240
      || profile.parserCode.length > 60000 || utf8Bytes(profile.parserCode) > 240000 || ids.has(profile.id)) throw new StorageFault("CORRUPT", "Parser profile identity/code is invalid or exceeds bounds.", true);
    ids.add(profile.id);
    const { parserCode, ...metadata } = profile;
    const safe = boundedCopy(metadata, { bytes: 128 * 1024, depth: 12, nodes: 5000, array: 1000, string: 8192 });
    for (const key of ["fileRoles", "fileSignatures", "relationshipSignature"]) {
      if (Object.hasOwn(safe, key) && !Array.isArray(safe[key])) throw new StorageFault("CORRUPT", "Parser profile collections must be arrays.", true);
    }
    if (safe.mappingSpec !== undefined && safe.mappingSpec !== null && (typeof safe.mappingSpec !== "object" || Array.isArray(safe.mappingSpec))) throw new StorageFault("CORRUPT", "Parser mapping metadata must be an object.", true);
    for (const key of ["createdAt", "updatedAt"]) {
      if (Object.hasOwn(safe, key) && (typeof safe[key] !== "string" || safe[key].length > 32 || Number.isNaN(Date.parse(safe[key])))) throw new StorageFault("CORRUPT", "Parser profile timestamps are invalid.", true);
    }
    const allowed = ["id", "schemaVersion", "name", "createdAt", "updatedAt", "datasetType", "fileRoles", "fileSignatures", "relationshipSignature", "mappingSpec", "fingerprint"];
    if (Object.keys(safe).some(key => !allowed.includes(key))) throw new StorageFault("CORRUPT", "Parser profile contains unsupported fields.", true);
    return migrateProfile({ ...safe, parserCode });
  });
}
function profileAdapter(storage = browserLocalStorage()) {
  if (storage && profileAdapters.has(storage)) return profileAdapters.get(storage);
  const adapter = createLocalStorageAdapter({ key: PARSER_PROFILE_PROJECT_KEY, legacyKeys: [PARSER_PROFILE_STORAGE_KEY, LEGACY_PARSER_PROFILE_STORAGE_KEY], limits: PROFILE_LIMITS,
    validate: validateStoredProfiles, legacyVersion: value => (Array.isArray(value) ? value : value?.profiles)?.[0]?.schemaVersion ?? 2, storage });
  if (storage) profileAdapters.set(storage, adapter);
  return adapter;
}
export function loadParserProfilesReceipt(storage) { return profileAdapter(storage).load([]); }
export function loadParserProfiles(storage) { return loadParserProfilesReceipt(storage).value; }
export function saveParserProfiles(profiles, storage) {
  const result = profileAdapter(storage).save(profiles);
  if (!result.ok) throw new StorageFault(result.code, result.error, result.status === "read_only");
  return result.value;
}
export function clearStoredParserProfiles(storage) { return profileAdapter(storage).clear(); }

export function upsertParserProfile(profile, profiles = [], storage = browserLocalStorage()) {
  const nextProfile = { ...profile, updatedAt: new Date().toISOString() };
  const without = profiles.filter(item => item.id !== nextProfile.id);
  return saveParserProfiles([nextProfile, ...without], storage);
}

export function deleteParserProfile(profileId, profiles = [], storage = browserLocalStorage()) {
  return saveParserProfiles(profiles.filter(profile => profile.id !== profileId), storage);
}

export function exportParserProfiles(profiles = []) {
  return JSON.stringify({
    schema: "hypergraph-parser-profiles-v7.3",
    exportedAt: new Date().toISOString(),
    profiles: validateStoredProfiles(profiles),
  }, null, 2);
}

export function importParserProfiles(text, existingProfiles = [], storage = browserLocalStorage()) {
  const incoming = validateStoredProfiles(parseBoundedJSON(text, PROFILE_LIMITS));
  const byId = new Map(existingProfiles.map(profile => [profile.id, profile]));
  for (const profile of incoming) {
    if (!isParserProfile(profile)) continue;
    byId.set(profile.id, { ...migrateProfile(profile), updatedAt: new Date().toISOString() });
  }
  return saveParserProfiles([...byId.values()], storage);
}

export function matchParserProfiles(files = [], profiles = []) {
  const activeExtensions = new Set((files ?? []).map(file => file.extension ?? extensionOf(file.name)).filter(Boolean));
  const activeNames = new Set((files ?? []).map(file => String(file.name ?? "").toLowerCase()));
  const activeHeaders = new Set((files ?? []).flatMap(file => file.headers ?? file.columns?.map?.(column => column.name) ?? []));
  return (profiles ?? []).map(profile => {
    const profileExtensions = new Set((profile.fileSignatures ?? []).map(item => item.extension).filter(Boolean));
    const profileNames = new Set((profile.fileSignatures ?? []).map(item => String(item.name ?? "").toLowerCase()));
    const profileHeaders = new Set((profile.fileSignatures ?? []).flatMap(item => item.headers ?? []));
    const extensionMatches = [...activeExtensions].filter(ext => profileExtensions.has(ext)).length;
    const nameMatches = [...activeNames].filter(name => profileNames.has(name)).length;
    const headerMatches = [...activeHeaders].filter(header => profileHeaders.has(header)).length;
    const roleMatches = new Set((profile.fileSignatures ?? []).map(item => item.role).filter(Boolean)).size;
    const score = extensionMatches + nameMatches * 2 + Math.min(headerMatches, 12) * 0.4 + Math.min(roleMatches, 4) * 0.25;
    return { profile, score, reason: `${nameMatches} filename match${nameMatches === 1 ? "" : "es"}, ${extensionMatches} extension match${extensionMatches === 1 ? "" : "es"}, ${headerMatches} structural header match${headerMatches === 1 ? "" : "es"}` };
  }).filter(match => match.score > 0).sort((a, b) => b.score - a.score || a.profile.name.localeCompare(b.profile.name));
}

export function isParserProfile(value) {
  return Boolean(value && typeof value === "object" && value.id && value.name && typeof value.parserCode === "string");
}

function createProfileId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return `parser-profile-${cryptoApi.randomUUID()}`;
  profileCounter += 1;
  return `parser-profile-${Date.now().toString(36)}-${profileCounter.toString(36)}`;
}

function extensionOf(name = "") {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? `.${match[1]}` : "";
}

function bucketSize(size) {
  const n = Number(size) || 0;
  if (n < 1024) return "<1KB";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${Math.round(n / (1024 * 1024))}MB`;
}

function profileFingerprint(payload) {
  return stableStringify(payload).length.toString(36) + "-" + stableStringify(payload).slice(0, 120).length.toString(36);
}

function relationshipSignature(evidence = []) {
  return (evidence ?? []).slice(0, 12).map(item => [
    item.leftColumns?.join("+"),
    item.rightColumns?.join("+"),
    item.likelyCardinality,
  ].filter(Boolean).join("->"));
}

function migrateProfile(profile) {
  return {
    schemaVersion: profile.schemaVersion ?? 2,
    relationshipSignature: profile.relationshipSignature ?? [],
    ...profile,
  };
}
