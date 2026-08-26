import { stableStringify } from "../graph/graphFingerprint.js";

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

export function loadParserProfiles(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(PARSER_PROFILE_STORAGE_KEY) ?? storage?.getItem?.(LEGACY_PARSER_PROFILE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const profiles = Array.isArray(parsed) ? parsed : parsed.profiles;
    return Array.isArray(profiles) ? profiles.filter(isParserProfile).map(migrateProfile) : [];
  } catch {
    return [];
  }
}

export function saveParserProfiles(profiles, storage = globalThis.localStorage) {
  const safeProfiles = (profiles ?? []).filter(isParserProfile).slice(0, 100);
  storage?.setItem?.(PARSER_PROFILE_STORAGE_KEY, JSON.stringify(safeProfiles, null, 2));
  return safeProfiles;
}

export function upsertParserProfile(profile, profiles = [], storage = globalThis.localStorage) {
  const nextProfile = { ...profile, updatedAt: new Date().toISOString() };
  const without = profiles.filter(item => item.id !== nextProfile.id);
  return saveParserProfiles([nextProfile, ...without], storage);
}

export function deleteParserProfile(profileId, profiles = [], storage = globalThis.localStorage) {
  return saveParserProfiles(profiles.filter(profile => profile.id !== profileId), storage);
}

export function exportParserProfiles(profiles = []) {
  return JSON.stringify({
    schema: "hypergraph-parser-profiles-v7.3",
    exportedAt: new Date().toISOString(),
    profiles: (profiles ?? []).filter(isParserProfile).map(migrateProfile),
  }, null, 2);
}

export function importParserProfiles(text, existingProfiles = [], storage = globalThis.localStorage) {
  const data = JSON.parse(String(text ?? ""));
  const incoming = Array.isArray(data) ? data : data.profiles;
  if (!Array.isArray(incoming)) throw new Error("Parser profile import must contain a profiles array.");
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
