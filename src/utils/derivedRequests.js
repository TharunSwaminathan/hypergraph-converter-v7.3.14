const H2H_EXPORTS = new Set(["h2h_txt", "all_txt", "full_json"]);
const V2V_EXPORTS = new Set(["canonical", "clique"]);
const H2V_EXPORTS = new Set(["h2v_txt", "full_json", "all_txt"]);
const V2H_EXPORTS = new Set(["v2h_txt", "full_json", "all_txt"]);
const CSR_EXPORTS = new Set(["csr_json", "csr_csv"]);

export function shouldRequestH2H({ activeSection = "mappings", selectedMappingId = "h2v", expId = "h2v_txt" } = {}) {
  return (activeSection === "mappings" && selectedMappingId === "h2h")
    || (activeSection === "export" && H2H_EXPORTS.has(expId));
}

export function shouldRequestV2V({ activeSection = "mappings", selectedMappingId = "h2v", expId = "h2v_txt" } = {}) {
  return (activeSection === "mappings" && selectedMappingId === "v2v")
    || (activeSection === "export" && V2V_EXPORTS.has(expId));
}

export function shouldRequestH2V({ activeSection = "mappings", selectedMappingId = "h2v", expId = "h2v_txt" } = {}) {
  return (activeSection === "mappings" && selectedMappingId === "h2v")
    || (activeSection === "export" && H2V_EXPORTS.has(expId));
}

export function shouldRequestV2H({ activeSection = "mappings", selectedMappingId = "h2v", expId = "h2v_txt" } = {}) {
  return (activeSection === "mappings" && selectedMappingId === "v2h")
    || (activeSection === "export" && V2H_EXPORTS.has(expId));
}

export function shouldRequestCSR({ activeSection = "mappings", expId = "h2v_txt" } = {}) {
  return activeSection === "export" && CSR_EXPORTS.has(expId);
}

export function shouldRequestMatrix({ activeSection = "mappings", expId = "h2v_txt" } = {}) {
  return activeSection === "export" && expId === "matrix";
}
