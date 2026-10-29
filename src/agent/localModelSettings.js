import { createLocalStorageAdapter, browserLocalStorage } from "../persistence/localStorageAdapter.js";
import { boundedCopy, StorageFault } from "../persistence/storageSafety.js";

export const RECOMMENDED_OLLAMA_MODEL = "qwen3:8b";
export const LEGACY_RECOMMENDED_OLLAMA_MODEL = "qwen2.5-coder:1.5b";
export const DEFAULT_LOCAL_MODEL_TIMEOUT_MS = 120000;
export const LEGACY_DEFAULT_LOCAL_MODEL_TIMEOUT_MS = 60000;
export const DEFAULT_LOCAL_MODEL_TEMPERATURE = 0.1;
export const LOCAL_MODEL_SETTINGS_VERSION = 3;
export const LOCAL_MODEL_KEEP_ALIVE = "10m";
export const LOCAL_MODEL_TASK_TIMEOUTS = Object.freeze({
  health_check: 30000,
  graph_mutation_planner_total: 60000,
  graph_mutation_planner_first_attempt: 45000,
  graph_mutation_planner_repair_minimum: 10000,
  action_planner: 60000,
  conversation: 120000,
  mapping: 120000,
  dataset_interpretation_total: 90000,
  mapping_patch_total: 60000,
  mapping_refinement_total: 90000,
  custom_parser: 120000,
  summarization: 45000,
});
export const GRAPH_MUTATION_PLANNER_NUM_PREDICT = 768;

export const DEFAULT_LOCAL_MODEL_CONFIG = {
  enabled: true,
  runtime: "ollama",
  model: RECOMMENDED_OLLAMA_MODEL,
  timeoutMs: DEFAULT_LOCAL_MODEL_TIMEOUT_MS,
  temperature: DEFAULT_LOCAL_MODEL_TEMPERATURE,
  maxPreviewFiles: 10,
  maxPreviewLinesPerFile: 50,
  transportPreference: "auto",
  lastSuccessfulTransport: null,
  activeTransport: null,
  activeBaseUrl: "",
  migrationNotice: "",
  migrationNoticeSeen: false,
  settingsVersion: LOCAL_MODEL_SETTINGS_VERSION,
};

export const LOCAL_MODEL_DISABLED_MESSAGE = "Local assistant disconnected. Deterministic dashboard controls remain available; start Ollama and click Connect when you want local-model help.";
export const LEGACY_PROVIDER_MIGRATION_NOTICE = "This release now uses Ollama only. Legacy local-server settings were replaced with automatic Ollama connection settings.";
export const LOCAL_MODEL_STORAGE_KEY = "hypergraph-local-model-settings";

const REMOVED_PROVIDERS = new Set(["llama-cpp", "llama-cpp-bridge", "openai-compatible-local"]);
const KNOWN_LEGACY_PROVIDERS = new Set(["none", "ollama", "ollama-bridge", ...REMOVED_PROVIDERS]);
const VALID_TRANSPORTS = new Set(["direct", "bridge"]);

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boolValue(value, fallback) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function normalizeTransport(value) {
  return VALID_TRANSPORTS.has(value) ? value : null;
}


export function validateLocalModelName(value) {
  const model = String(value ?? "").trim();
  if (!model) return { ok: false, model: "", error: "A model name is required." };
  if (model.length > 128) return { ok: false, model, error: "The model name is too long." };
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*(?::[A-Za-z0-9._-]+)?$/.test(model)) {
    return { ok: false, model, error: "Use an Ollama model name such as qwen3:8b. Spaces and command characters are not allowed." };
  }
  return { ok: true, model, error: "" };
}

export function isEmptyOrPlaceholderModel(model) {
  const normalized = String(model ?? "").trim().toLowerCase();
  return !normalized || ["user-selected local model", "model name", "your model"].includes(normalized);
}

function normalizeModel(rawModel) {
  const model = String(rawModel ?? "").trim();
  if (isEmptyOrPlaceholderModel(model)) return RECOMMENDED_OLLAMA_MODEL;
  if (model.toLowerCase() === LEGACY_RECOMMENDED_OLLAMA_MODEL.toLowerCase()) return RECOMMENDED_OLLAMA_MODEL;
  const validation = validateLocalModelName(model);
  return validation.ok ? validation.model : RECOMMENDED_OLLAMA_MODEL;
}

function legacyTransportFromProvider(provider, baseUrl) {
  if (provider === "ollama-bridge") return "bridge";
  if (provider === "ollama") return "direct";
  const url = String(baseUrl ?? "").toLowerCase();
  if (url.includes("127.0.0.1:8787") || url.includes("localhost:8787")) return "bridge";
  if (url.includes("11434")) return "direct";
  return null;
}

export function normalizeLocalModelConfig(stored = null) {
  if (!stored || typeof stored !== "object") {
    return {
      config: { ...DEFAULT_LOCAL_MODEL_CONFIG },
      migrated: false,
      migrationReason: "",
    };
  }

  const storedVersion = Number(stored.settingsVersion ?? 0);
  const legacyProvider = typeof stored.provider === "string" ? stored.provider : null;
  const hasProviderField = Object.prototype.hasOwnProperty.call(stored, "provider");
  const removedProvider = REMOVED_PROVIDERS.has(legacyProvider);
  const unknownProvider = hasProviderField && !KNOWN_LEGACY_PROVIDERS.has(legacyProvider);
  const legacyDisabled = legacyProvider === "none";
  const versionMigrated = storedVersion !== LOCAL_MODEL_SETTINGS_VERSION;

  let migrated = versionMigrated || hasProviderField;
  let migrationReason = versionMigrated ? "settings version updated" : "";
  let migrationNotice = String(stored.migrationNotice ?? "");
  if (removedProvider || unknownProvider) {
    migrationNotice = LEGACY_PROVIDER_MIGRATION_NOTICE;
    migrationReason = "legacy provider migrated to Ollama";
    migrated = true;
  }

  const rawModel = removedProvider || unknownProvider ? RECOMMENDED_OLLAMA_MODEL : stored.model;
  const legacyModelSelected = String(rawModel ?? "").trim().toLowerCase() === LEGACY_RECOMMENDED_OLLAMA_MODEL.toLowerCase();
  const model = normalizeModel(rawModel);
  if (legacyModelSelected || model !== String(stored.model ?? "").trim()) {
    migrated = true;
    migrationReason = migrationReason || "model normalized";
  }

  const storedTimeout = stored.timeoutMs;
  let timeoutMs = finiteNumber(storedTimeout, DEFAULT_LOCAL_MODEL_TIMEOUT_MS);
  if (storedVersion < 3 && Number(storedTimeout) === LEGACY_DEFAULT_LOCAL_MODEL_TIMEOUT_MS && legacyModelSelected) {
    timeoutMs = DEFAULT_LOCAL_MODEL_TIMEOUT_MS;
    migrated = true;
    migrationReason = migrationReason || "legacy timeout migrated";
  }

  const lastSuccessfulTransport = normalizeTransport(stored.lastSuccessfulTransport)
    ?? legacyTransportFromProvider(legacyProvider, stored.baseUrl);

  const enabled = hasProviderField
    ? !legacyDisabled
    : boolValue(stored.enabled, DEFAULT_LOCAL_MODEL_CONFIG.enabled);

  const config = {
    enabled,
    runtime: "ollama",
    model,
    timeoutMs,
    temperature: finiteNumber(stored.temperature, DEFAULT_LOCAL_MODEL_TEMPERATURE),
    maxPreviewFiles: finiteNumber(stored.maxPreviewFiles, DEFAULT_LOCAL_MODEL_CONFIG.maxPreviewFiles),
    maxPreviewLinesPerFile: finiteNumber(stored.maxPreviewLinesPerFile, DEFAULT_LOCAL_MODEL_CONFIG.maxPreviewLinesPerFile),
    transportPreference: "auto",
    lastSuccessfulTransport,
    activeTransport: normalizeTransport(stored.activeTransport),
    activeBaseUrl: typeof stored.activeBaseUrl === "string" ? stored.activeBaseUrl : "",
    migrationNotice,
    migrationNoticeSeen: boolValue(stored.migrationNoticeSeen, false),
    settingsVersion: LOCAL_MODEL_SETTINGS_VERSION,
  };

  return { config, migrated, migrationReason };
}

export const MODEL_SETTINGS_PROJECT_KEY = "hypergraph-studio.settings.v1";
export const MODEL_SETTINGS_LIMITS = Object.freeze({ bytes: 16 * 1024, depth: 3, nodes: 80, array: 8, string: 1024 });
const settingsAdapters = new WeakMap();
function settingsVersion(value) {
  const version = value?.settingsVersion ?? 0;
  if (![0, 1, 2, 3].includes(version)) throw new StorageFault("INCOMPATIBLE", "Model settings version is incompatible; original data is preserved.", true);
  return version;
}
export function validateStoredModelSettings(input) {
  const value = boundedCopy(input, MODEL_SETTINGS_LIMITS);
  if (!value || Array.isArray(value) || typeof value !== "object") throw new StorageFault("CORRUPT", "Model settings must be an object.", true);
  settingsVersion(value);
  for (const key of ["timeoutMs", "temperature", "maxPreviewFiles", "maxPreviewLinesPerFile"]) {
    if (Object.hasOwn(value, key) && (typeof value[key] !== "number" || !Number.isFinite(value[key]))) throw new StorageFault("CORRUPT", "Model settings numeric fields are invalid.", true);
  }
  for (const key of ["model", "activeBaseUrl", "migrationNotice"]) {
    if (Object.hasOwn(value, key) && typeof value[key] !== "string") throw new StorageFault("CORRUPT", "Model settings text fields are invalid.", true);
  }
  if (Object.hasOwn(value, "enabled") && typeof value.enabled !== "boolean") throw new StorageFault("CORRUPT", "Model enabled preference must be boolean.", true);
  const config = normalizeLocalModelConfig(value).config;
  if (config.timeoutMs < 1000 || config.timeoutMs > 120000 || config.temperature < 0 || config.temperature > 1
    || !Number.isInteger(config.maxPreviewFiles) || config.maxPreviewFiles < 1 || config.maxPreviewFiles > 50
    || !Number.isInteger(config.maxPreviewLinesPerFile) || config.maxPreviewLinesPerFile < 1 || config.maxPreviewLinesPerFile > 500
    || config.activeBaseUrl.length > 512 || config.migrationNotice.length > 1024) throw new StorageFault("LIMIT", "Model settings exceed supported bounds.", true);
  return config;
}
function settingsAdapter(storage = browserLocalStorage()) {
  if (storage && settingsAdapters.has(storage)) return settingsAdapters.get(storage);
  const adapter = createLocalStorageAdapter({ key: MODEL_SETTINGS_PROJECT_KEY, legacyKeys: [LOCAL_MODEL_STORAGE_KEY], limits: MODEL_SETTINGS_LIMITS,
    validate: validateStoredModelSettings, legacyVersion: settingsVersion, storage });
  if (storage) settingsAdapters.set(storage, adapter);
  return adapter;
}
export function loadLocalModelConfigReceipt(storage) { return settingsAdapter(storage).load({ ...DEFAULT_LOCAL_MODEL_CONFIG }); }
export function loadLocalModelConfig(storage) { return loadLocalModelConfigReceipt(storage).value; }
export function saveLocalModelConfig(config, storage) { return settingsAdapter(storage).save(config); }
export function clearStoredModelSettings(storage) { return settingsAdapter(storage).clear(); }
