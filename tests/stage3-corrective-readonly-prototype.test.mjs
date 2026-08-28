import assert from "node:assert/strict";
import {
  buildIncidenceIndex,
  getHyperedgeVertexIds,
  getIncidentHyperedgeIds,
  hasHyperedge,
  hasVertex,
} from "../src/graph/incidenceIndex.js";

const canonicalHyperedges = [{
  id: "h",
  vertices: ["a", "b"],
  time: 0,
  weight: 0,
  attributes: { source: "canonical" },
}];

const freshIndex = () => buildIncidenceIndex(canonicalHyperedges);
const assertQueriesWork = index => {
  assert.equal(hasHyperedge(index, "h"), true);
  assert.equal(hasVertex(index, "a"), true);
  assert.deepEqual(getIncidentHyperedgeIds(index, "a"), ["h"]);
  assert.deepEqual(getHyperedgeVertexIds(index, "h"), ["a", "b"]);
};
const assertReadOnlyError = operation => assert.throws(
  operation,
  error => error instanceof TypeError && /read-only/i.test(error.message),
);

for (const mapName of ["hyperedgesById", "vertexToHyperedges", "hyperedgeToVertices"]) {
  for (const mutatePrototype of [Object.setPrototypeOf, Reflect.setPrototypeOf]) {
    const index = freshIndex();
    const collection = index[mapName];
    assert.strictEqual(Object.getPrototypeOf(collection), Map.prototype);
    assertReadOnlyError(() => mutatePrototype(collection, null));
    assert.strictEqual(Object.getPrototypeOf(collection), Map.prototype);
    assertQueriesWork(index);
  }
}

for (const [mapName, id] of [["vertexToHyperedges", "a"], ["hyperedgeToVertices", "h"]]) {
  for (const mutatePrototype of [Object.setPrototypeOf, Reflect.setPrototypeOf]) {
    const index = freshIndex();
    const collection = index[mapName].get(id);
    assert.strictEqual(Object.getPrototypeOf(collection), Set.prototype);
    assertReadOnlyError(() => mutatePrototype(collection, null));
    assert.strictEqual(Object.getPrototypeOf(collection), Set.prototype);
    assertQueriesWork(index);
  }
}

const mutatorIndex = freshIndex();
for (const map of [mutatorIndex.hyperedgesById, mutatorIndex.vertexToHyperedges, mutatorIndex.hyperedgeToVertices]) {
  assertReadOnlyError(() => map.set("new", new Set()));
  assertReadOnlyError(() => map.delete("h"));
  assertReadOnlyError(() => map.clear());
  assertReadOnlyError(() => Object.defineProperty(map, "extra", { value: true }));
  assertReadOnlyError(() => Reflect.defineProperty(map, "extra", { value: true }));
  assertReadOnlyError(() => { map.extra = true; });
  assertReadOnlyError(() => { delete map.extra; });
  assert.throws(() => Map.prototype.set.call(map, "new", new Set()), TypeError);
  assertReadOnlyError(() => map.forEach((_value, _key, callbackMap) => callbackMap.set("new", new Set())));
}

for (const set of [mutatorIndex.vertexToHyperedges.get("a"), mutatorIndex.hyperedgeToVertices.get("h")]) {
  assertReadOnlyError(() => set.add("new"));
  assertReadOnlyError(() => set.delete("h"));
  assertReadOnlyError(() => set.clear());
  assertReadOnlyError(() => Object.defineProperty(set, "extra", { value: true }));
  assertReadOnlyError(() => Reflect.defineProperty(set, "extra", { value: true }));
  assertReadOnlyError(() => { set.extra = true; });
  assertReadOnlyError(() => { delete set.extra; });
  assert.throws(() => Set.prototype.add.call(set, "new"), TypeError);
  assertReadOnlyError(() => set.forEach((_value, _key, callbackSet) => callbackSet.add("new")));
}

assertQueriesWork(mutatorIndex);
assert.strictEqual(
  mutatorIndex.hyperedgesById.get("h"),
  canonicalHyperedges[0],
  "the derived collection topology is read-only without cloning or freezing canonical source records",
);

console.log("v7.3.14 Stage 3 corrective read-only prototype hardening passed.");
