export function resolveDiscourseReferences(text = "", context = {}) {
  const raw = String(text ?? "").toLowerCase();
  const references = [];
  if (/\b(run|show|apply|open)\s+it\b/.test(raw)) {
    const workflow = context.parserWorkflow ?? {};
    const candidates = [];
    if (workflow.parserStatus === "inserted" || workflow.parserStatus === "generated") candidates.push("custom_parser");
    if (workflow.resultStatus === "preview") candidates.push("parser_result");
    if (workflow.planStatus === "generated") candidates.push("transformation_plan");
    references.push({
      type: "pronoun",
      surface: "it",
      candidates,
      resolved: candidates.length === 1 ? candidates[0] : null,
      ambiguous: candidates.length > 1,
    });
  }
  if (/\b(that|that one|the last change)\b/.test(raw)) {
    references.push({
      type: "recent_reference",
      surface: "that",
      resolved: context.recentVerifiedActions?.[0]?.id ?? null,
      ambiguous: false,
    });
  }
  if (/\bthe selected hyperedge\b/.test(raw)) {
    references.push({
      type: "selection",
      surface: "the selected hyperedge",
      resolved: context.graph?.selectedEntity?.type === "hyperedge" ? context.graph.selectedEntity.id : null,
      ambiguous: false,
    });
  }
  return references;
}
