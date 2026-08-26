export function buildAmbiguities({ references = [], entities = [], context = {} } = {}) {
  const ambiguities = [];
  for (const reference of references) {
    if (reference.ambiguous) {
      ambiguities.push({
        type: "ambiguous_reference",
        surface: reference.surface,
        candidates: reference.candidates ?? [],
        question: `What should "${reference.surface}" refer to: ${(reference.candidates ?? []).join(", ")}?`,
      });
    }
    if (reference.type === "pronoun" && !reference.resolved && !reference.ambiguous) {
      ambiguities.push({
        type: "unresolved_reference",
        surface: reference.surface,
        candidates: [],
        question: `What should "${reference.surface}" refer to?`,
      });
    }
  }
  const fileMentions = entities.filter(entity => entity.type === "file");
  const uniqueFiles = new Set(fileMentions.map(entity => entity.fileName));
  if ((context.fileNames ?? []).length > 1 && /other file/i.test(context.rawText ?? "") && uniqueFiles.size === 0) {
    ambiguities.push({
      type: "ambiguous_file_reference",
      surface: "other file",
      candidates: context.fileNames.slice(0, 10),
      question: `Which file do you mean by "the other file": ${(context.fileNames ?? []).slice(0, 10).join(", ")}?`,
    });
  }
  return ambiguities;
}
