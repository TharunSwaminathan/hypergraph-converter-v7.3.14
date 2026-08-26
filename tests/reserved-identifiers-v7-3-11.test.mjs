import assert from "node:assert/strict";
import {
  parseV2HText, parseH2HText, parseSimple, parseJSON, parseIncidence, parseCSVFmt,
} from "../src/utils/parsers.js";
import { buildV2H, buildH2H, buildV2V, computeStats, countTriads, validateHes } from "../src/utils/mappings.js";

// V7310-D07: identifiers matching JS Object.prototype member names must
// behave as ordinary strings everywhere a plain object was previously used
// as an untrusted-key map. None of these should throw, silently drop the
// identifier, or leak prototype behavior.
const RESERVED_NAMES = ["__proto__", "prototype", "constructor", "toString", "hasOwnProperty", "valueOf", "then", "length", "name"];

for (const reserved of RESERVED_NAMES) {
  const hes = [
    { id: "h0", vertices: [reserved, "A"], time: null, weight: 1, attributes: {} },
    { id: "h1", vertices: ["A", "B"], time: null, weight: 1, attributes: {} },
  ];

  // Mapping builders must not throw and must include the reserved name.
  assert.doesNotThrow(() => buildV2H(hes), `buildV2H must not throw for vertex "${reserved}"`);
  const v2h = buildV2H(hes);
  assert.ok(v2h.some(e => e.vid === reserved), `buildV2H must include vertex "${reserved}"`);
  assert.deepEqual(v2h.find(e => e.vid === reserved).hyperedges, ["h0"]);

  assert.doesNotThrow(() => buildH2H(hes), `buildH2H must not throw for vertex "${reserved}"`);
  const h2h = buildH2H(hes);
  assert.equal(h2h.length, 2, `buildH2H must still return one entry per hyperedge for vertex "${reserved}"`);

  assert.doesNotThrow(() => buildV2V(hes), `buildV2V must not throw for vertex "${reserved}"`);

  assert.doesNotThrow(() => computeStats(hes), `computeStats must not throw for vertex "${reserved}"`);
  const stats = computeStats(hes);
  assert.equal(stats.V, 3, `computeStats must count the reserved-name vertex distinctly for "${reserved}"`);

  assert.doesNotThrow(() => countTriads(hes), `countTriads must not throw for vertex "${reserved}"`);
  assert.doesNotThrow(() => validateHes(hes), `validateHes must not throw for vertex "${reserved}"`);

  // Hyperedge IDs matching reserved names must round-trip too.
  const hesReservedId = [{ id: reserved, vertices: ["A", "B"], time: null, weight: 1, attributes: {} }];
  assert.doesNotThrow(() => buildV2H(hesReservedId), `buildV2H must not throw for hyperedge id "${reserved}"`);
  const v2hById = buildV2H(hesReservedId);
  assert.ok(v2hById.every(e => e.hyperedges.includes(reserved)), `buildV2H must reference hyperedge id "${reserved}"`);
}

// v2h/h2h text parsers must round-trip reserved names as hyperedge IDs.
{
  const v2hText = "A: __proto__, constructor\nB: __proto__";
  assert.doesNotThrow(() => parseV2HText(v2hText));
  const parsed = parseV2HText(v2hText);
  const ids = parsed.map(h => h.id).sort();
  assert.deepEqual(ids, ["__proto__", "constructor"].sort());
  const protoEdge = parsed.find(h => h.id === "__proto__");
  assert.deepEqual(protoEdge.vertices.sort(), ["A", "B"]);
}
{
  const h2hText = "h__proto__: hconstructor[shared: A]\nhconstructor: h__proto__[shared: A]";
  assert.doesNotThrow(() => parseH2HText(h2hText));
  const parsed = parseH2HText(h2hText);
  const ids = parsed.map(h => h.id).sort();
  assert.deepEqual(ids, ["h__proto__", "hconstructor"].sort());
}

// Simple/JSON/incidence/CSV parsers must also accept reserved names as
// vertex or hyperedge identifiers without crashing.
assert.doesNotThrow(() => parseSimple("__proto__: A, B\nh1: A, constructor"));
assert.doesNotThrow(() => parseJSON(JSON.stringify([{ id: "__proto__", vertices: ["constructor", "toString"] }])));
assert.doesNotThrow(() => parseIncidence("hyperedge_id,vertex_id\n__proto__,constructor\n__proto__,toString"));
assert.doesNotThrow(() => parseCSVFmt("__proto__, constructor, toString"));

console.log(`v7.3.11 prototype-sensitive identifier safety passed (${RESERVED_NAMES.length} reserved names x multiple builders/parsers).`);
