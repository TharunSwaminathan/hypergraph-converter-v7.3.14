const H2H_EXPORTS = new Set(["h2h_txt", "all_txt", "full_json"]);
const V2V_EXPORTS = new Set(["canonical", "clique"]);

export function shouldRequestH2H({ activeSection = "mappings", selectedMappingId = "h2v", expId = "h2v_txt" } = {}) {
  return (activeSection === "mappings" && selectedMappingId === "h2h")
    || (activeSection === "export" && H2H_EXPORTS.has(expId));
}

export function shouldRequestV2V({ activeSection = "mappings", selectedMappingId = "h2v", expId = "h2v_txt" } = {}) {
  return (activeSection === "mappings" && selectedMappingId === "v2v")
    || (activeSection === "export" && V2V_EXPORTS.has(expId));
}
