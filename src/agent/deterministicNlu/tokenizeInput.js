const CONNECTORS = new Set([
  "and",
  "also",
  "then",
  "but",
  "except",
  "instead",
  "only",
  "just",
  "while",
]);

function spanAt(spans, index) {
  return spans.find(span => span.start === index);
}

function tokenType(surface, normalized) {
  if (/^[0-9]+(?:\.[0-9]+)?$/.test(surface)) return "number";
  if (/^[^\s"'`]+\.(?:csv|tsv|json|txt|mtx|mm|edgelist)$/i.test(surface)) return "filename";
  if (CONNECTORS.has(normalized)) return "connector";
  if (/^[,.;:!?()[\]{}-]+$/.test(surface)) return "punctuation";
  if (/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(surface)) return "identifier";
  return "word";
}

export function tokenizeInput(text = "", protectedSpans = []) {
  const raw = String(text ?? "");
  const tokens = [];
  let index = 0;
  while (index < raw.length && tokens.length < 1000) {
    const protectedSpan = spanAt(protectedSpans, index);
    if (protectedSpan) {
      tokens.push({
        text: protectedSpan.text,
        normalized: protectedSpan.value.toLowerCase(),
        start: protectedSpan.start,
        end: protectedSpan.end,
        type: "quoted",
        protected: true,
      });
      index = protectedSpan.end;
      continue;
    }
    const ch = raw[index];
    if (/\s/.test(ch)) {
      index += 1;
      continue;
    }
    const remaining = raw.slice(index);
    const filenameMatch = remaining.match(/^[A-Za-z0-9_.\\/:-]+\.(?:csv|tsv|json|txt|mtx|mm|edgelist)(?=$|\s|[,.!?;:()[\]{}])/i);
    if (filenameMatch) {
      const surface = filenameMatch[0];
      tokens.push({
        text: surface,
        normalized: surface.toLowerCase(),
        start: index,
        end: index + surface.length,
        type: "filename",
        protected: false,
      });
      index += surface.length;
      continue;
    }
    const numberMatch = remaining.match(/^[0-9]+(?:\.[0-9]+)?(?=$|\s|[,.!?;:()[\]{}])/);
    if (numberMatch) {
      const surface = numberMatch[0];
      tokens.push({
        text: surface,
        normalized: surface,
        start: index,
        end: index + surface.length,
        type: "number",
        protected: false,
      });
      index += surface.length;
      continue;
    }
    if (/[,.!?;:()[\]{}]/.test(ch)) {
      tokens.push({ text: ch, normalized: ch, start: index, end: index + 1, type: "punctuation", protected: false });
      index += 1;
      continue;
    }
    const start = index;
    while (index < raw.length && !/\s|[,.!?;:()[\]{}]/.test(raw[index])) index += 1;
    const surface = raw.slice(start, index);
    const normalized = surface.toLowerCase().replace(/^["'`]+|["'`]+$/g, "");
    tokens.push({
      text: surface,
      normalized,
      start,
      end: index,
      type: tokenType(surface, normalized),
      protected: false,
    });
  }
  return tokens;
}
