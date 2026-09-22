export function motifStatisticsAvailability(candy = {}) {
  if (!candy.featureEnabled) return { ready: false, capability: null, message: "The optional CANDY Runtime is disabled. Browser statistics remain available; no CPU fallback is used." };
  if (!candy.graphType) return { ready: false, capability: null, message: "Convert a Hypergraph before computing Runtime motifs." };
  if (!["Hypergraph", "DynamicHypergraph"].includes(candy.graphType)) return { ready: false, capability: null, message: `Hypergraph 3-edge motifs require a Hypergraph or DynamicHypergraph, not ${candy.graphType}. No implicit projection is performed.` };
  if (!candy.authorized) return { ready: false, capability: null, message: "Pair and discover the authenticated CANDY Runtime before computing motifs." };
  const capability = candy.capabilities?.find(item => item.backend === "CUDA_STATIC" && item.modes?.includes("STATIC"));
  if (!capability?.devices?.length) return { ready: false, capability: null, message: "CUDA_STATIC is not qualified for the active graph. No CPU or alternate-backend fallback is selected." };
  return { ready: true, capability, message: "CUDA_STATIC is qualified for the active graph. Computation starts only after explicit confirmation in Hypergraph Assistant." };
}
