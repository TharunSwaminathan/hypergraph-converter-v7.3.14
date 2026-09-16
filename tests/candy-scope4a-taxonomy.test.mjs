import assert from "node:assert/strict";
import {
  classifyMotifSignature,
  deriveHypergraphThreeEdgeMotifTaxonomy,
  HYPERGRAPH_3EDGE_MOTIF_TAXONOMY,
  MOTIF_SHAPES,
  S3_HYPEREDGE_PERMUTATIONS,
  permuteSignatureMask,
} from "../src/candy/hypergraphMotifs/taxonomy.js";

// Independent test derivation: enumerate all labeled seven-region signatures,
// filter by connected intersection graph, then partition under S3.
const independentRegionMembers = [[0], [1], [2], [0, 1], [1, 2], [0, 2], [0, 1, 2]];
const independentPermute = (mask, permutation) => {
  let result = 0;
  independentRegionMembers.forEach((members, sourceIndex) => {
    if (((mask >> sourceIndex) & 1) === 0) return;
    const target = members.map(member => permutation[member]).sort((a, b) => a - b).join(",");
    const targetIndex = independentRegionMembers.findIndex(region => region.join(",") === target);
    result |= (1 << targetIndex);
  });
  return result;
};
const independentConnected = mask => {
  const bit = index => (mask >> index) & 1;
  const nonempty = [
    bit(0) || bit(3) || bit(5) || bit(6),
    bit(1) || bit(3) || bit(4) || bit(6),
    bit(2) || bit(4) || bit(5) || bit(6),
  ];
  const pairCount = Number(Boolean(bit(3) || bit(6)))
    + Number(Boolean(bit(4) || bit(6)))
    + Number(Boolean(bit(5) || bit(6)));
  return nonempty.every(Boolean) && pairCount >= 2;
};
const independentlyConnectedMasks = [...Array(128).keys()].filter(independentConnected);
const independentOrbits = new Map();
for (const mask of independentlyConnectedMasks) {
  const representative = Math.min(...S3_HYPEREDGE_PERMUTATIONS.map(permutation => independentPermute(mask, permutation)));
  if (!independentOrbits.has(representative)) independentOrbits.set(representative, new Set());
  independentOrbits.get(representative).add(mask);
}

const derived = deriveHypergraphThreeEdgeMotifTaxonomy();
assert.equal(derived.labeledConnectedSignatureCount, independentlyConnectedMasks.length);
assert.equal(derived.orbitCount, independentOrbits.size);
assert.equal(derived.entries.length, 30);
assert.equal(derived.labeledConnectedSignatureCount, 96);
assert.equal(derived.entries.filter(entry => entry.shape === MOTIF_SHAPES.CLOSED_TRIANGLE).length, 24);
assert.equal(derived.entries.filter(entry => entry.shape === MOTIF_SHAPES.OPEN_WEDGE).length, 6);
assert.deepEqual(derived, HYPERGRAPH_3EDGE_MOTIF_TAXONOMY);

const coveredMasks = new Set();
for (const entry of derived.entries) {
  assert.equal(entry.motifId >= 1 && entry.motifId <= 30, true);
  assert.equal(entry.orbitSize, entry.orbit.length);
  assert.equal(entry.canonicalMask, Math.min(...entry.orbit));
  assert.deepEqual(entry.orbit, [...independentOrbits.get(entry.canonicalMask)].sort((a, b) => a - b));
  for (const mask of entry.orbit) {
    assert.equal(coveredMasks.has(mask), false, `mask ${mask} belongs to exactly one class`);
    coveredMasks.add(mask);
    assert.equal(classifyMotifSignature(mask)?.motifId, entry.motifId);
    for (const permutation of S3_HYPEREDGE_PERMUTATIONS) {
      assert.equal(classifyMotifSignature(permuteSignatureMask(mask, permutation))?.motifId, entry.motifId);
    }
  }
}
assert.deepEqual([...coveredMasks].sort((a, b) => a - b), independentlyConnectedMasks);
for (const mask of [...Array(128).keys()].filter(mask => !independentConnected(mask))) {
  assert.equal(classifyMotifSignature(mask), null);
}

console.log("Scope 4A-R taxonomy derivation tests passed.");
