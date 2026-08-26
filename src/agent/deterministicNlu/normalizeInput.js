import { maskProtectedText, scanProtectedSpans } from "./protectedText.js";

const CONTRACTIONS = [
  [/\bcan[’']t\b/gi, "cannot"],
  [/\bwon[’']t\b/gi, "will not"],
  [/\bdon[’']t\b/gi, "do not"],
  [/\bdoesn[’']t\b/gi, "does not"],
  [/\bdidn[’']t\b/gi, "did not"],
  [/\bisn[’']t\b/gi, "is not"],
  [/\baren[’']t\b/gi, "are not"],
  [/\bwasn[’']t\b/gi, "was not"],
  [/\bweren[’']t\b/gi, "were not"],
  [/\bi[’']d\b/gi, "i would"],
  [/\bi[’']ll\b/gi, "i will"],
  [/\bit[’']s\b/gi, "it is"],
  [/\bthat[’']s\b/gi, "that is"],
];

const FILLER_PATTERNS = [
  /\bplease\b/gi,
  /\bcould you\b/gi,
  /\bwould you\b/gi,
  /\bcan you\b/gi,
  /\bi want you to\b/gi,
  /\bgo ahead and\b/gi,
  /\bfor me\b/gi,
  /\bthis time\b/gi,
];

export function normalizeInput(text = "", {
  maxChars = 5000,
} = {}) {
  const fullText = String(text ?? "");
  const rawText = fullText.slice(0, maxChars);
  const protectedSpans = scanProtectedSpans(fullText);
  const activeProtectedSpans = protectedSpans.filter(span => span.start < rawText.length && span.end <= rawText.length);
  const { masked, placeholders } = maskProtectedText(rawText, activeProtectedSpans);
  let normalized = masked
    .replace(/\r\n?/g, "\n")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, " -- ")
    .replace(/\u00a0/g, " ");
  for (const [pattern, replacement] of CONTRACTIONS) normalized = normalized.replace(pattern, replacement);
  normalized = normalized.replace(/[ \t]+/g, " ").replace(/[ ]*\n[ ]*/g, "\n").trim();
  const modifiers = [];
  let comparisonText = normalized;
  for (const pattern of FILLER_PATTERNS) {
    if (pattern.test(comparisonText)) modifiers.push(pattern.source.replace(/\\b/g, "").replace(/\\/g, ""));
    pattern.lastIndex = 0;
    comparisonText = comparisonText.replace(pattern, " ");
  }
  comparisonText = comparisonText.replace(/\s+/g, " ").trim().toLowerCase();
  placeholders.forEach(({ placeholder, span }) => {
    normalized = normalized.replaceAll(placeholder, span.text);
    comparisonText = comparisonText.replaceAll(placeholder.toLowerCase(), span.value.toLowerCase());
  });
  return {
    rawText,
    normalizedText: normalized,
    comparisonText,
    protectedSpans,
    modifiers,
    truncated: fullText.length > maxChars,
  };
}
