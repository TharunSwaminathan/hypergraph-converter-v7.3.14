export const HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1 = "candy.hypergraph-3edge-motif-taxonomy/1";

export const MOTIF_REGION_NAMES = Object.freeze([
  "A_ONLY",
  "B_ONLY",
  "C_ONLY",
  "AB_ONLY",
  "BC_ONLY",
  "CA_ONLY",
  "ABC",
]);

export const MOTIF_SHAPES = Object.freeze({
  CLOSED_TRIANGLE: "CLOSED_TRIANGLE",
  OPEN_WEDGE: "OPEN_WEDGE",
});

const REGION_MEMBERS = Object.freeze([
  Object.freeze([0]),
  Object.freeze([1]),
  Object.freeze([2]),
  Object.freeze([0, 1]),
  Object.freeze([1, 2]),
  Object.freeze([0, 2]),
  Object.freeze([0, 1, 2]),
]);

export const S3_HYPEREDGE_PERMUTATIONS = Object.freeze([
  Object.freeze([0, 1, 2]),
  Object.freeze([0, 2, 1]),
  Object.freeze([1, 0, 2]),
  Object.freeze([1, 2, 0]),
  Object.freeze([2, 0, 1]),
  Object.freeze([2, 1, 0]),
]);

function regionIndexForMembers(members) {
  const key = [...members].sort((left, right) => left - right).join(",");
  return REGION_MEMBERS.findIndex(region => region.join(",") === key);
}

export function signatureToMask(signature) {
  if (!Array.isArray(signature) || signature.length !== MOTIF_REGION_NAMES.length) {
    throw new TypeError("A motif signature must contain exactly seven presence values.");
  }
  let mask = 0;
  for (let index = 0; index < signature.length; index += 1) {
    if (signature[index] !== 0 && signature[index] !== 1 && signature[index] !== false && signature[index] !== true) {
      throw new TypeError("Motif signature values must be boolean or 0/1.");
    }
    if (signature[index]) mask |= (1 << index);
  }
  return mask;
}

export function maskToSignature(mask) {
  if (!Number.isInteger(mask) || mask < 0 || mask >= (1 << MOTIF_REGION_NAMES.length)) {
    throw new TypeError("A motif signature mask must be an integer from 0 to 127.");
  }
  return Object.freeze(MOTIF_REGION_NAMES.map((_, index) => (mask >> index) & 1));
}

export function permuteSignatureMask(mask, permutation) {
  maskToSignature(mask);
  if (!S3_HYPEREDGE_PERMUTATIONS.some(candidate => candidate.every((value, index) => value === permutation?.[index]))) {
    throw new TypeError("permutation must be one of the six permutations of A/B/C.");
  }
  let permutedMask = 0;
  for (let regionIndex = 0; regionIndex < REGION_MEMBERS.length; regionIndex += 1) {
    if (((mask >> regionIndex) & 1) === 0) continue;
    const permutedMembers = REGION_MEMBERS[regionIndex].map(member => permutation[member]);
    const targetIndex = regionIndexForMembers(permutedMembers);
    permutedMask |= (1 << targetIndex);
  }
  return permutedMask;
}

export function signatureIntersectionCount(mask) {
  const bit = index => (mask >> index) & 1;
  return Number(Boolean(bit(3) || bit(6)))
    + Number(Boolean(bit(4) || bit(6)))
    + Number(Boolean(bit(5) || bit(6)));
}

export function isConnectedThreeHyperedgeSignature(mask) {
  const signature = maskToSignature(mask);
  const [a, b, c, ab, bc, ca, abc] = signature;
  const nonemptyA = Boolean(a || ab || ca || abc);
  const nonemptyB = Boolean(b || ab || bc || abc);
  const nonemptyC = Boolean(c || bc || ca || abc);
  return nonemptyA && nonemptyB && nonemptyC && signatureIntersectionCount(mask) >= 2;
}

export function canonicalizeSignatureMask(mask) {
  if (!isConnectedThreeHyperedgeSignature(mask)) return null;
  return Math.min(...S3_HYPEREDGE_PERMUTATIONS.map(permutation => permuteSignatureMask(mask, permutation)));
}

function describeMotif(mask, shape) {
  const signature = maskToSignature(mask);
  const present = MOTIF_REGION_NAMES.filter((_, index) => signature[index]);
  const shapeText = shape === MOTIF_SHAPES.CLOSED_TRIANGLE ? "closed intersection triangle" : "connected open wedge";
  return `${shapeText}; present regions: ${present.join(", ")}`;
}

export function deriveHypergraphThreeEdgeMotifTaxonomy() {
  const connectedMasks = [];
  for (let mask = 0; mask < (1 << MOTIF_REGION_NAMES.length); mask += 1) {
    if (isConnectedThreeHyperedgeSignature(mask)) connectedMasks.push(mask);
  }
  const canonicalMasks = [...new Set(connectedMasks.map(canonicalizeSignatureMask))]
    .sort((left, right) => left - right);
  const entries = canonicalMasks.map((canonicalMask, index) => {
    const orbit = [...new Set(S3_HYPEREDGE_PERMUTATIONS.map(permutation => permuteSignatureMask(canonicalMask, permutation)))]
      .sort((left, right) => left - right);
    const shape = signatureIntersectionCount(canonicalMask) === 3
      ? MOTIF_SHAPES.CLOSED_TRIANGLE
      : MOTIF_SHAPES.OPEN_WEDGE;
    return Object.freeze({
      motifId: index + 1,
      canonicalMask,
      canonicalSignature: maskToSignature(canonicalMask),
      orbit: Object.freeze(orbit),
      orbitSize: orbit.length,
      shape,
      description: describeMotif(canonicalMask, shape),
    });
  });
  return Object.freeze({
    taxonomyVersion: HYPERGRAPH_3EDGE_MOTIF_TAXONOMY_V1,
    regionOrder: MOTIF_REGION_NAMES,
    labeledConnectedSignatureCount: connectedMasks.length,
    orbitCount: entries.length,
    entries: Object.freeze(entries),
  });
}

export const HYPERGRAPH_3EDGE_MOTIF_TAXONOMY = deriveHypergraphThreeEdgeMotifTaxonomy();

const ENTRY_BY_MASK = new Map();
for (const entry of HYPERGRAPH_3EDGE_MOTIF_TAXONOMY.entries) {
  for (const mask of entry.orbit) ENTRY_BY_MASK.set(mask, entry);
}

export function classifyMotifSignature(signatureOrMask) {
  const mask = Array.isArray(signatureOrMask) ? signatureToMask(signatureOrMask) : signatureOrMask;
  maskToSignature(mask);
  return ENTRY_BY_MASK.get(mask) ?? null;
}
