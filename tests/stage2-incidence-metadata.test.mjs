import assert from "node:assert/strict";
import { expIncidence } from "../src/utils/mappings.js";
import { normalizeParsedHyperedges, parseIncidence } from "../src/utils/parsers.js";
import { IncidenceConflict } from "./fixtures/v7.3.14/stage0-regression-fixtures.mjs";

// HG713-C07: missing metadata is not a conflict, but two different explicit
// values for one hyperedge are. Diagnostics identify both rows and the field.
assert.throws(
  () => parseIncidence(IncidenceConflict.weight),
  /Incidence row 3: hyperedge "h1" weight .* conflicts with .* row 2/,
);
assert.throws(
  () => parseIncidence(IncidenceConflict.time),
  /Incidence row 3: hyperedge "h1" time .* conflicts with .* row 2/,
);

assert.deepEqual(parseIncidence("hyperedge_id,vertex_id,time,weight\nh1,a,,\nh1,b,t1,2")[0], {
  id: "h1", vertices: ["a", "b"], time: "t1", weight: 2,
});
assert.deepEqual(parseIncidence("hyperedge_id,vertex_id,time,weight\nh1,a,t1,2\nh1,b,,")[0], {
  id: "h1", vertices: ["a", "b"], time: "t1", weight: 2,
});
assert.deepEqual(parseIncidence("hyperedge_id,vertex_id,time,weight\nh1,a,t1,0\nh1,b,t1,0")[0], {
  id: "h1", vertices: ["a", "b"], time: "t1", weight: 0,
});
assert.throws(
  () => parseIncidence("hyperedge_id,vertex_id,time,weight\nh1,a,t1,1\nh1,b,t1,2"),
  /weight 2 conflicts with explicit weight 1 first supplied on row 2/,
);
assert.throws(
  () => parseIncidence("hyperedge_id,vertex_id,time,weight\nh1,a,t1,3\nh1,b,t1,1"),
  /weight 1 conflicts with explicit weight 3 first supplied on row 2/,
);
assert.equal(
  parseIncidence("hyperedge_id,vertex_id,time,weight\nh1,a,t1,2\nh1,b,t1,2.0")[0].weight,
  2,
);
assert.deepEqual(parseIncidence("h1,a,,\nh1,b,t1,2")[0], {
  id: "h1", vertices: ["a", "b"], time: "t1", weight: 2,
});
assert.throws(
  () => parseIncidence("h1,a,t1,2\nh1,b,t2,2"),
  /Incidence row 2: hyperedge "h1" time "t2" conflicts with explicit time "t1" first supplied on row 1/,
);

// S2-N01 also applies to RFC-quoted incidence identifiers. Export/import must
// preserve delimiters, quotes, newlines, Unicode, and significant whitespace.
const source = [{
  id: "  edge,one  ",
  vertices: ["  vertex one  ", 'quote"vertex', "line 1\nline 2", "日本語", "🎉"],
  time: "  time value  ",
  weight: 0,
}];
const reparsed = parseIncidence(expIncidence(source));
assert.equal(reparsed[0].id, source[0].id);
assert.deepEqual(reparsed[0].vertices, source[0].vertices);
assert.equal(reparsed[0].time, source[0].time);
assert.equal(reparsed[0].weight, 0);
const canonical = normalizeParsedHyperedges("incidence", reparsed).hyperedges[0];
assert.equal(canonical.id, source[0].id);
assert.deepEqual(canonical.vertices, source[0].vertices);
assert.equal(canonical.time, source[0].time);

console.log("v7.3.14 Stage 2 incidence metadata regressions passed.");
