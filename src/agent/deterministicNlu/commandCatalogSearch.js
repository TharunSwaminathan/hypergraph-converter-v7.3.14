import { COMMAND_CATALOG } from "./commandCatalog.js";
import { COMMAND_CATEGORY_LABELS } from "./commandCatalogSchema.js";

const normalizedIndex = new WeakMap();
const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "for",
  "with",
  "can",
  "could",
  "you",
  "i",
  "do",
  "does",
  "how",
  "what",
  "which",
  "show",
  "me",
  "please",
]);

export function normalizeCatalogSearchText(value = "") {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9_.:-]+/g, " ").trim().replace(/\s+/g, " ");
}

export function catalogSearchText(entry) {
  if (normalizedIndex.has(entry)) return normalizedIndex.get(entry);
  const fields = [
    entry.id,
    entry.title,
    entry.summary,
    entry.domain,
    entry.intent,
    entry.typedKind,
    entry.category,
    COMMAND_CATEGORY_LABELS[entry.category],
    entry.availability,
    entry.sideEffect,
    entry.confirmation,
    entry.modelPolicy,
    ...(entry.operationTypes ?? []),
    ...(entry.patterns ?? []),
    ...(entry.requiredContext ?? []),
    ...(entry.ambiguityNotes ?? []),
    ...(entry.identifierNotes ?? []),
    ...(entry.examples ?? []).map(example => example.text),
  ];
  const value = normalizeCatalogSearchText(fields.flat().filter(Boolean).join(" "));
  normalizedIndex.set(entry, value);
  return value;
}

export function searchCommandCatalog({
  query = "",
  category = "all",
  availability = "all",
  sideEffect = "all",
  confirmation = "all",
  modelPolicy = "all",
  limit = 80,
} = {}) {
  const terms = normalizeCatalogSearchText(query)
    .split(" ")
    .filter(term => term && !SEARCH_STOP_WORDS.has(term));
  const results = [];
  for (const entry of COMMAND_CATALOG) {
    if (category !== "all" && entry.category !== category) continue;
    if (availability !== "all" && entry.availability !== availability) continue;
    if (sideEffect !== "all" && entry.sideEffect !== sideEffect) continue;
    if (confirmation !== "all" && entry.confirmation !== confirmation) continue;
    if (modelPolicy !== "all" && entry.modelPolicy !== modelPolicy) continue;
    const haystack = catalogSearchText(entry);
    if (!terms.every(term => haystack.includes(term))) continue;
    results.push({ entry, score: scoreEntry(entry, terms, haystack) });
  }
  results.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
  return results.slice(0, limit).map(result => result.entry);
}

export function findCatalogEntriesForHelpQuery(query = "", limit = 6) {
  return searchCommandCatalog({ query, limit }).filter(entry => entry.availability !== "panel_only");
}

function scoreEntry(entry, terms, haystack) {
  if (!terms.length) return entry.availability === "chat_command" ? 6 : 4;
  const title = normalizeCatalogSearchText(entry.title);
  const examples = normalizeCatalogSearchText((entry.examples ?? []).map(example => example.text).join(" "));
  const patterns = normalizeCatalogSearchText((entry.patterns ?? []).join(" "));
  const intent = normalizeCatalogSearchText(entry.intent ?? "");
  const queryText = terms.join(" ");
  let score = 0;
  if (title === queryText) score += 60;
  if ((entry.patterns ?? []).some(pattern => normalizeCatalogSearchText(pattern) === queryText)) score += 55;
  if (intent === queryText.replace(/\s+/g, "_")) score += 45;
  if ((entry.examples ?? []).some(example => normalizeCatalogSearchText(example.text) === queryText)) score += 40;
  for (const term of terms) {
    if (title.includes(term)) score += 8;
    if (intent.includes(term)) score += 7;
    if (patterns.includes(term)) score += 5;
    if (examples.includes(term)) score += 4;
    if (haystack.includes(term)) score += 1;
  }
  if (entry.availability === "chat_command") score += 2;
  if (entry.sideEffect === "read_only") score += 0.5;
  return score;
}
