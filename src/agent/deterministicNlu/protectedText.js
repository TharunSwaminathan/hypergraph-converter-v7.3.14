const QUOTES = new Set(['"', "'", "`"]);

function isWordChar(ch) {
  return /[A-Za-z0-9_]/.test(ch ?? "");
}

function isApostropheInsideWord(text, index) {
  return text[index] === "'" && isWordChar(text[index - 1]) && isWordChar(text[index + 1]);
}

export function scanProtectedSpans(text = "") {
  const raw = String(text ?? "");
  const spans = [];
  let index = 0;
  while (index < raw.length) {
    const quote = raw[index];
    if (!QUOTES.has(quote) || isApostropheInsideWord(raw, index)) {
      index += 1;
      continue;
    }
    const start = index;
    index += 1;
    while (index < raw.length) {
      if (raw[index] === "\\" && index + 1 < raw.length) {
        index += 2;
        continue;
      }
      if (raw[index] === quote && !isApostropheInsideWord(raw, index)) {
        index += 1;
        spans.push({
          id: `q${spans.length}`,
          start,
          end: index,
          quote,
          text: raw.slice(start, index),
          value: raw.slice(start + 1, index - 1),
        });
        break;
      }
      index += 1;
    }
  }
  return spans;
}

export function maskProtectedText(text = "", spans = scanProtectedSpans(text)) {
  const raw = String(text ?? "");
  let cursor = 0;
  let masked = "";
  const placeholders = [];
  spans.forEach((span, index) => {
    const placeholder = `__PROTECTED_${index}__`;
    masked += raw.slice(cursor, span.start);
    masked += placeholder;
    cursor = span.end;
    placeholders.push({ placeholder, span });
  });
  masked += raw.slice(cursor);
  return { masked, placeholders };
}

export function restoreProtectedText(text = "", placeholders = []) {
  let restored = String(text ?? "");
  placeholders.forEach(({ placeholder, span }) => {
    restored = restored.replaceAll(placeholder, span.text);
  });
  return restored;
}
