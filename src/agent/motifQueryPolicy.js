// Analysis-specific routing; it never authorizes projection or graph mutation.
export function motifQueryPolicy(query, observation = {}) {
  const text=String(query??"");
  if (!/\bmotifs?\b/i.test(text)) return {matched:false};
  const denied=/\b(do not|don't|never|without|not asking|for reference|documentation|pretend|quoted|says|said)\b/i.test(text) || /["“”`]/.test(text);
  const requested=!denied && (/\b(count|run|compute|calculate|analy[sz]e)\b/i.test(text) || /^\s*how\s+do\b[\s\S]*\bmotif\s+counts?\b[\s\S]*\bchange\b/i.test(text));
  if (!requested) return {matched:true,requested:false};
  if (/\bproject(?:ion)?\b/i.test(text)) return {matched:true,requested:true,ok:false,classification:"INVALID_GRAPH_TYPE",message:"Projection requires a separate explicit action and consent. Motif analysis accepts the authoritative hypergraph; no projection was performed."};
  const mode=/\bincremental\b|\bcounts?\b[\s\S]*\bchange\b/i.test(text)?"INCREMENTAL":"STATIC";
  const type=observation.graph?.graphType??observation.candy?.graphType;
  if (!["Hypergraph","DynamicHypergraph"].includes(type) || observation.graph?.available === false || mode === "INCREMENTAL" && type !== "DynamicHypergraph") return {matched:true,requested:true,ok:false,classification:"INVALID_GRAPH_TYPE",message:"CUDA motif counting requires an authoritative Hypergraph or DynamicHypergraph. Incremental analysis requires DynamicHypergraph; no implicit projection or STATIC fallback was performed."};
  if (mode === "INCREMENTAL" && !observation.candy?.pendingUpdateContext) return {matched:true,requested:true,ok:false,classification:"INVALID_UPDATE_BATCH",message:"No authoritative pending qualified update is available. Incremental motif analysis cannot run and no update was applied."};
  const backend=mode === "STATIC"?"CUDA_STATIC":"CUDA_INCREMENTAL";
  if (!observation.candy?.featureEnabled || !observation.candy?.authorized || !observation.candy?.capabilities?.some(cap=>cap.backend===backend)) return {matched:true,requested:true,ok:false,classification:"BACKEND_UNAVAILABLE",message:"The exact requested CUDA motif backend is unavailable. No CPU or other CUDA mode was selected."};
  return {matched:true,requested:true,ok:true,mode,backend};
}
