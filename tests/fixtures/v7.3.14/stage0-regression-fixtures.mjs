const hyperedge = (id, vertices, extra = {}) => ({
  id,
  vertices,
  time: extra.time ?? null,
  weight: extra.weight ?? 1,
  attributes: extra.attributes ?? {},
});

export const STAGE0_FIXTURE_NAMES = Object.freeze([
  "TinyBasic",
  "WhitespaceRows",
  "CSVQuoted",
  "ZeroID",
  "PrototypeIDs",
  "LiteralNullID",
  "WeightZero",
  "DuplicateHyperedgeID",
  "DuplicateOverlap",
  "OneHugeEdge1K",
  "OneHugeEdge5K",
  "ManySingletons2001",
  "IncidenceConflict",
  "CSRInvalidIds",
  "MalformedH2H",
  "MalformedAdjacency",
  "LargeSparse",
  "DenseProjection",
  "ExpectedProtoID",
]);

export const TinyBasic = Object.freeze([
  hyperedge("h0", ["a", "b", "c"]),
  hyperedge("h1", ["c", "d"]),
]);

export const WhitespaceRows = Object.freeze({
  text: "1 2 3\n2 4\n1 3 4 5",
  expected: [
    hyperedge("h0", [1, 2, 3]),
    hyperedge("h1", [2, 4]),
    hyperedge("h2", [1, 3, 4, 5]),
  ],
});

export const CSVQuoted = Object.freeze({
  text: '"Smith, John","He said ""hi""","line 1\nline 2"\r\nplain,tail,0',
  expectedRows: [
    ["Smith, John", 'He said "hi"', "line 1\nline 2"],
    ["plain", "tail", "0"],
  ],
});

export const ZeroID = Object.freeze([
  hyperedge("h0", [0, "0", "control"]),
]);

export const PrototypeIDs = Object.freeze([
  hyperedge("__proto__", ["__proto__", "constructor", "toString"]),
  hyperedge("constructor", ["toString", "ordinary"]),
]);

export const LiteralNullID = Object.freeze([
  hyperedge("h-null", ["null", "ordinary"]),
]);

export const WeightZero = Object.freeze([
  hyperedge("h-zero", ["a", "b"], { time: 0, weight: 0 }),
]);

export const DuplicateHyperedgeID = Object.freeze([
  hyperedge("duplicate", ["a"]),
  hyperedge("duplicate", ["b"]),
]);

export function DuplicateOverlap({ hyperedgeCount = 200, vertexCount = 46 } = {}) {
  const vertices = Array.from({ length: vertexCount }, (_, index) => `v${index}`);
  return Array.from({ length: hyperedgeCount }, (_, index) => hyperedge(`h${index}`, [...vertices]));
}

export function OneHugeEdge(size) {
  return [hyperedge("huge", Array.from({ length: size }, (_, index) => `v${index}`))];
}

export const OneHugeEdge1K = () => OneHugeEdge(1_000);
export const OneHugeEdge5K = () => OneHugeEdge(5_000);

export function ManySingletons(count = 2_001) {
  return Array.from({ length: count }, (_, index) => hyperedge(`h${index}`, [`v${index}`]));
}

export const ManySingletons2001 = () => ManySingletons(2_001);

export const IncidenceConflict = Object.freeze({
  weight: "hyperedge_id,vertex_id,time,weight\r\nh1,a,t1,2\r\nh1,b,t1,3",
  time: "hyperedge_id,vertex_id,time,weight\r\nh1,a,t1,2\r\nh1,b,t2,2",
});

export const CSRInvalidIds = Object.freeze({
  vertexObject: {
    vertexIds: [{ x: 1 }],
    hyperedgeIds: ["h1"],
    h2vCSR: { offsets: [0, 1], indices: [0] },
  },
  hyperedgeArray: {
    vertexIds: ["a"],
    hyperedgeIds: [["h1"]],
    h2vCSR: { offsets: [0, 1], indices: [0] },
  },
});

export const MalformedH2H = Object.freeze([
  "h1: garbage",
  "h1: h2[shared: a] trailing garbage",
  "h1: h2[shared: a] h3[shared:]",
]);

export const MalformedAdjacency = Object.freeze([
  "A B C",
  "A: B: C",
]);

export function LargeSparse({ hyperedgeCount = 10_000 } = {}) {
  return Array.from({ length: hyperedgeCount }, (_, index) => hyperedge(`h${index}`, [`v${index}`, `v${index + 1}`]));
}

export function DenseProjection({ vertexCount = 632 } = {}) {
  return OneHugeEdge(vertexCount);
}

export const ExpectedProtoID = Object.freeze({
  text: "__proto__: a b",
  actual: [hyperedge("__proto__", ["a", "b"])],
});

export const Stage0Fixtures = Object.freeze({
  TinyBasic,
  WhitespaceRows,
  CSVQuoted,
  ZeroID,
  PrototypeIDs,
  LiteralNullID,
  WeightZero,
  DuplicateHyperedgeID,
  DuplicateOverlap,
  OneHugeEdge1K,
  OneHugeEdge5K,
  ManySingletons2001,
  IncidenceConflict,
  CSRInvalidIds,
  MalformedH2H,
  MalformedAdjacency,
  LargeSparse,
  DenseProjection,
  ExpectedProtoID,
});
