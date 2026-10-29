import assert from 'node:assert/strict';
import { loadLocalModelConfigReceipt, saveLocalModelConfig, clearStoredModelSettings, LOCAL_MODEL_STORAGE_KEY, MODEL_SETTINGS_PROJECT_KEY, DEFAULT_LOCAL_MODEL_CONFIG } from '../src/agent/localModelSettings.js';
import { loadParserProfilesReceipt, saveParserProfiles, clearStoredParserProfiles, PARSER_PROFILE_STORAGE_KEY, LEGACY_PARSER_PROFILE_STORAGE_KEY, PARSER_PROFILE_PROJECT_KEY, importParserProfiles } from '../src/agent/parserProfiles.js';
import { mapStorage } from './fixtures/candy-scope7a-storage.mjs';

const base = { ...DEFAULT_LOCAL_MODEL_CONFIG };
const modelLegacy = JSON.stringify({ provider: 'ollama-bridge', model: 'qwen3:8b', activeTransport: 'bridge', activeBaseUrl: 'http://127.0.0.1:8787/ollama' });
const settings = mapStorage([[LOCAL_MODEL_STORAGE_KEY, modelLegacy]]);
const migrated = loadLocalModelConfigReceipt(settings);
assert.equal(migrated.ok, true); assert.equal(migrated.saved, true);
assert.equal(migrated.migrationLineage[0].sourceVersion, 0); assert.equal(settings.getItem(LOCAL_MODEL_STORAGE_KEY), modelLegacy);
assert.equal(migrated.value.lastSuccessfulTransport, 'bridge');
assert.equal(Object.hasOwn(migrated.value, 'connected'), false);
const broken = { getItem() { throw new DOMException('denied', 'SecurityError'); }, setItem() { throw new DOMException('quota', 'QuotaExceededError'); } };
assert.equal(loadLocalModelConfigReceipt(broken).ok, false);
assert.equal(saveLocalModelConfig(base, broken).saved, false);
const quota = mapStorage(); quota.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
assert.equal(saveLocalModelConfig(base, quota).code, 'QUOTA');
for (const [key, raw] of [[LOCAL_MODEL_STORAGE_KEY, '{bad'], [LOCAL_MODEL_STORAGE_KEY, JSON.stringify({ settingsVersion: 99 })], [MODEL_SETTINGS_PROJECT_KEY, JSON.stringify({ schemaVersion: 99 })]]) {
  const storage = mapStorage([[key, raw]]);
  assert.equal(loadLocalModelConfigReceipt(storage).ok, false);
  assert.equal(saveLocalModelConfig(base, storage).ok, false);
  assert.equal(storage.getItem(key), raw);
  assert.ok(storage.getItem(`${MODEL_SETTINGS_PROJECT_KEY}.quarantine`));
}
const invalidSettings = { ...base, migrationNotice: 'x'.repeat(17000) };
assert.equal(saveLocalModelConfig(invalidSettings, settings).ok, false);
assert.equal(clearStoredModelSettings(settings).ok, true);
assert.equal(settings.getItem(LOCAL_MODEL_STORAGE_KEY), null);
assert.equal(saveLocalModelConfig(base, settings).code, 'DELETED');

const profile = { id: 'p', name: 'Parser', schemaVersion: 3, parserCode: 'async function parseHypergraph(){return []}', mappingSpec: { files: [] } };
const old = JSON.stringify([profile]);
const profiles = mapStorage([[LEGACY_PARSER_PROFILE_STORAGE_KEY, old]]);
const loaded = loadParserProfilesReceipt(profiles);
assert.equal(loaded.ok, true); assert.equal(loaded.value.length, 1);
assert.equal(loaded.migrationLineage[0].source, LEGACY_PARSER_PROFILE_STORAGE_KEY);
assert.equal(profiles.getItem(LEGACY_PARSER_PROFILE_STORAGE_KEY), old);
saveParserProfiles([], profiles);
assert.equal(loadParserProfilesReceipt(profiles).value.length, 0);
assert.equal(profiles.getItem(LEGACY_PARSER_PROFILE_STORAGE_KEY), old);
for (const invalid of [{ ...profile, schemaVersion: 99 }, { ...profile, parserCode: 'x'.repeat(60001) }, { ...profile, name: 'x'.repeat(241) }, { ...profile, mappingSpec: { text: 'x'.repeat(8193) } }]) {
  assert.throws(() => saveParserProfiles([invalid], mapStorage()));
}
assert.throws(() => saveParserProfiles(Array.from({ length: 101 }, (_, i) => ({ ...profile, id: String(i) })), mapStorage()));
assert.throws(() => saveParserProfiles([profile], quota), { code: 'QUOTA' });
assert.throws(() => importParserProfiles('x'.repeat(2 * 1024 * 1024 + 1), [], mapStorage()), { code: 'LIMIT' });
const futureRaw = JSON.stringify([{ ...profile, schemaVersion: 999 }]), future = mapStorage([[PARSER_PROFILE_STORAGE_KEY, futureRaw]]);
assert.equal(loadParserProfilesReceipt(future).status, 'read_only');
assert.throws(() => saveParserProfiles([], future), { code: 'INCOMPATIBLE' });
assert.equal(future.getItem(PARSER_PROFILE_STORAGE_KEY), futureRaw);
assert.equal(clearStoredParserProfiles(profiles).ok, true);
assert.equal(profiles.getItem(LEGACY_PARSER_PROFILE_STORAGE_KEY), null);
assert.equal(profiles.getItem(PARSER_PROFILE_STORAGE_KEY), null);
assert.equal(JSON.parse(profiles.getItem(PARSER_PROFILE_PROJECT_KEY)).deleted, true);
assert.throws(() => saveParserProfiles([profile], profiles), { code: 'DELETED' });
console.log('Scope 7A R12/R14/R17/R18/R39/R40/R45/R54 and P07/P08/P09: bounded adapters, non-destructive migration, future-schema quarantine and explicit failure/deletion receipts PASS (storage doubles).');
