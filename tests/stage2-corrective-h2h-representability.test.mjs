import assert from "node:assert/strict";
import { buildH2H, expH2H } from "../src/utils/mappings.js";
import { parseH2HText } from "../src/utils/parsers.js";

const edge = (id, vertices = ["shared"]) => ({ id, vertices, time: null, weight: 1 });

// S2-N03: this is the exact backward-compatible hyperedge-ID subset supported
// by the unescaped H2H grammar. These values must still round-trip.
const representableIds = [
  "plain",
  "internal space",
  "edge,comma",
  "edge]bracket",
  '"literal-quote"',
  "__proto__",
  "null",
];
const representableText = expH2H(buildH2H(representableIds.map(id => edge(id))));
const representableRoundTrip = parseH2HText(representableText);
assert.deepEqual(representableRoundTrip.map(item => item.id).sort(), [...representableIds].sort());

// Unrepresentable identifiers must fail closed at export instead of silently
// producing text that imports as a different graph.
for (const id of ["edge:colon", "edge[bracket", " leading", "trailing ", "line\nbreak", "#comment-like"]) {
  const text = expH2H(buildH2H([edge(id), edge("other")]));
  assert.match(text, /^# H2H export not generated\./, `guard ${JSON.stringify(id)}`);
  assert.match(text, /unrepresentable hyperedge identifier/i);
}

// Shared-vertex tokens use a narrower unescaped comma/whitespace list grammar.
for (const vertex of ["shared,comma", "shared space", "ends]", "007", "Infinity", "line\nbreak"]) {
  const text = expH2H(buildH2H([edge("h1", [vertex]), edge("h2", [vertex])]));
  assert.match(text, /^# H2H export not generated\./, `shared guard ${JSON.stringify(vertex)}`);
  assert.match(text, /unrepresentable shared-vertex identifier/i);
}

const representableShared = ["v:1", "left[open", '"quoted"', "__proto__", "null", "0"];
for (const vertex of representableShared) {
  const text = expH2H(buildH2H([edge("h1", [vertex]), edge("h2", [vertex])]));
  assert.doesNotMatch(text, /^# H2H export not generated\./);
  const parsed = parseH2HText(text);
  assert.ok(parsed.every(item => item.vertices.map(String).includes(vertex)));
}

console.log("v7.3.14 Stage 2 corrective H2H representability guard passed.");
