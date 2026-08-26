export function resolveNegations(clauses = []) {
  return clauses
    .map(clause => {
      const text = clause.text.toLowerCase();
      const negated = [];
      if (/\bdo not\b|\bdon't\b|\bnever\b|\bcannot\b|\bnot\b/.test(text)) negated.push("explicit_not");
      if (/\bexcept\b/.test(text)) negated.push("except_scope");
      if (/\bbut not\b/.test(text)) negated.push("but_not_scope");
      if (/\bwithout\b/.test(text)) negated.push("without_scope");
      if (!negated.length) return null;
      return {
        clauseId: clause.id,
        text: clause.text,
        markers: negated,
        scope: /\brun\b|\bexecute\b/.test(text) ? "parser_run" : /\bgraph\b/.test(text) ? "graph" : "local_clause",
      };
    })
    .filter(Boolean);
}

export function hasNegatedRun(clauses = []) {
  return clauses.some(clause => clause.polarity === "negative" && /\b(run|execute|test)\b/i.test(clause.text));
}

export function hasNegatedTerm(text = "", term = "") {
  const escaped = String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b(?:do not|not|never|without)\\b[^.;\\n]{0,80}\\b${escaped}\\b`, "i").test(String(text ?? ""));
}
