export const EXTERNAL_AI_PROMPT_ROUTE_NOTES = `AI Prompt route rules:
- The AI Prompt route only prepares a prompt for manual copy/paste into an external assistant.
- The route does not call OpenAI, Gemini, Claude, or any backend API.
- GENERATE_EXTERNAL_LLM_PROMPT may copy or prepare the existing prompt, but it must not send data anywhere.
- If the user asks for an always-on hosted model, explain that GitHub Pages is static hosting and cannot run Ollama; the user must start the local Ollama runtime separately.`;

export const AI_PROMPT_TARGETS = {
  h2v_txt: {
    label: "H2V text",
    instruction: "Produce H2V / Hyperedge-to-Vertex text. Each output line must name one hyperedge, followed by a colon, then the deduplicated vertices it contains. Preserve time/weight metadata inline when it is present.",
    pasteHint: "Paste the returned H2V text into the H2V / Simple input route.",
  },
  v2h_txt: {
    label: "V2H text",
    instruction: "Produce V2H / Vertex-to-Hyperedge text. Each output line must name one vertex, followed by a colon, then the hyperedges containing that vertex.",
    pasteHint: "Paste the returned V2H text into the V2H input route.",
  },
  h2h_txt: {
    label: "H2H text",
    instruction: "Produce H2H projection text. Each output line must name one hyperedge and list neighboring hyperedges that share at least one vertex, including shared vertices when possible.",
    pasteHint: "Paste the returned H2H text into the H2H Projection input route.",
  },
  canonical: {
    label: "canonical hypergraph JSON",
    instruction: "Produce canonical hypergraph JSON with metadata and canonicalHyperedges.",
    pasteHint: "Paste the returned JSON into the JSON input route.",
  },
  incidence: {
    label: "Incidence CSV",
    instruction: "Produce incidence CSV with one membership per row and this header: hyperedge_id,vertex_id,time,weight. Use blank time when missing and weight 1 by default.",
    pasteHint: "Paste the returned CSV into the Incidence Edge List route.",
  },
  bipartite: {
    label: "bipartite edge-list CSV",
    instruction: "Produce bipartite edge-list CSV with source,target rows where source is a vertex node and target is a hyperedge node. Prefix labels if needed to avoid vertex/hyperedge collisions.",
    pasteHint: "Review the returned bipartite CSV as an export-style representation.",
  },
  clique: {
    label: "clique/pairwise graph edge-list CSV",
    instruction: "Produce clique/pairwise graph edge-list CSV with source,target,weight rows by expanding every hyperedge into all unordered vertex pairs.",
    pasteHint: "Review the returned pairwise graph edge list before using it as a graph edge-list input.",
  },
  matrix: {
    label: "incidence matrix CSV",
    instruction: "Produce an incidence matrix CSV whose first column is vertex and whose remaining columns are hyperedge IDs with 1/0 membership values.",
    pasteHint: "Review the returned matrix CSV as an export-style representation.",
  },
  csr_json: {
    label: "CSR JSON",
    instruction: "Produce CSR JSON with vertexIds, hyperedgeIds, optional hyperedgeTimes/hyperedgeWeights, and h2vCSR.offsets plus h2vCSR.indices arrays. Indices must refer to positions in vertexIds.",
    pasteHint: "Paste the returned CSR JSON into the CSR JSON input route.",
  },
  csr_csv: {
    label: "CSR CSV",
    instruction: "Produce CSR CSV with labeled rows: vertexIds, hyperedgeIds, rowOffsets, columnIndices, optional hyperedgeTimes, and optional hyperedgeWeights.",
    pasteHint: "Paste the returned CSV into the CSR / CSC CSV input route.",
  },
  full_json: {
    label: "Full JSON",
    instruction: "Produce a full JSON object containing metadata, canonical hyperedges, and if you can derive them safely, H2V/V2H/H2H-style mappings. Do not invent graph facts.",
    pasteHint: "Review the returned JSON before using the canonical hyperedges in the JSON input route.",
  },
  all_txt: {
    label: "plain-text mappings",
    instruction: "Produce plain-text H2V, V2H, and H2H sections separated by clear headings. Do not include markdown fences.",
    pasteHint: "Review the returned mapping text manually.",
  },
};

export function getAiPromptTarget(targetExportId = "canonical") {
  return AI_PROMPT_TARGETS[targetExportId] ?? AI_PROMPT_TARGETS.canonical;
}

export function isAiPromptTargetId(targetExportId) {
  return Object.prototype.hasOwnProperty.call(AI_PROMPT_TARGETS, targetExportId);
}

export function buildExternalAiPrompt(text, {
  targetExportId = "canonical",
  targetLabel = "",
} = {}) {
  const target = getAiPromptTarget(targetExportId);
  const label = targetLabel || target.label;
  const schemaBlock = targetExportId === "canonical" ? `
Required output schema:
{
  "metadata": { "source": "AI normalized input", "inputTypeDetected": "freeform text", "vertexType": "...", "hyperedgeType": "..." },
  "canonicalHyperedges": [
    { "id": "unique id", "vertices": ["v1","v2"], "time": null, "weight": 1, "attributes": {} }
  ]
}` : "";

  return `You are a graph and hypergraph data normalization assistant.
Convert the user's input into ${label}. Return ONLY the requested output. No markdown. No code fences.

Target output:
${target.instruction}
${schemaBlock}

Rules:
- Preserve all entities and memberships.
- Do not invent data, IDs, times, weights, columns, or relationships.
- Deduplicate vertices per hyperedge.
- Use null or a blank field for missing time, and weight 1 by default when weight is missing.
- If the input is ambiguous, return a short JSON object with "questionsForUser" instead of guessing.

${target.pasteHint}

User input:
"""
${text}
"""`.trim();
}
