const CLAUSE_CONNECTORS = new Set(["but", "except", "then", "instead", "while"]);
const SOFT_CONNECTORS = new Set(["and", "also"]);

function polarityFor(tokens) {
  const text = tokens.map(token => token.normalized).join(" ");
  return /\b(do not|does not|did not|cannot|not|never|without)\b/.test(text) ? "negative" : "positive";
}

function connectorForToken(token, previous = null) {
  const value = token?.normalized;
  if (CLAUSE_CONNECTORS.has(value)) return value;
  if (SOFT_CONNECTORS.has(value) && previous?.type === "punctuation") return value;
  return null;
}

export function parseClauses(text = "", tokens = []) {
  const clauses = [];
  let startIndex = 0;
  let connectorFromPrevious = null;
  const pushClause = endIndex => {
    const slice = tokens.slice(startIndex, endIndex);
    if (!slice.length) return;
    clauses.push({
      id: `clause-${clauses.length + 1}`,
      text: String(text).slice(slice[0].start, slice.at(-1).end).trim(),
      tokenStart: startIndex,
      tokenEnd: endIndex,
      connectorFromPrevious,
      polarity: polarityFor(slice),
      scopeHints: [],
      inheritedSubject: null,
    });
    connectorFromPrevious = null;
  };
  for (let i = 0; i < tokens.length && clauses.length < 20; i += 1) {
    const token = tokens[i];
    const previous = tokens[i - 1];
    const connector = connectorForToken(token, previous);
    if (token.type === "punctuation" && /[.;!?]/.test(token.text)) {
      pushClause(i);
      startIndex = i + 1;
      continue;
    }
    if (connector && i > startIndex) {
      pushClause(i);
      connectorFromPrevious = connector;
      startIndex = i + 1;
    } else if (connector && i === startIndex) {
      connectorFromPrevious = connector;
      startIndex = i + 1;
    }
  }
  pushClause(tokens.length);
  for (let i = 1; i < clauses.length; i += 1) {
    const previous = clauses[i - 1];
    const current = clauses[i];
    if (/^(and|also)$/.test(current.connectorFromPrevious ?? "") && /^(use|set|make|treat|mark)\b/i.test(previous.text) && !/^(use|set|make|treat|mark)\b/i.test(current.text)) {
      current.inheritedSubject = previous.text.match(/^(use|set|make|treat|mark)\b/i)?.[1]?.toLowerCase() ?? null;
    }
  }
  return clauses;
}
