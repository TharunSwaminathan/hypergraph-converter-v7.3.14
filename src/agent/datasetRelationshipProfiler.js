export const RELATIONSHIP_PROFILE_LIMITS = Object.freeze({
  maxColumnsPerFile: 12,
  maxColumnPairs: 300,
  maxCompositeWidth: 3,
});

function compatible(left, right) {
  if (!left || !right) return false;
  if (left.inferredType === "empty" || right.inferredType === "empty") return false;
  if (left.inferredType === right.inferredType) return true;
  const numeric = new Set(["integer", "number"]);
  if (numeric.has(left.inferredType) && numeric.has(right.inferredType)) return true;
  return left.idLike && right.idLike;
}

function columnScore(left, right) {
  let score = 0;
  if (left.name.toLowerCase() === right.name.toLowerCase()) score += 4;
  if (left.idLike && right.idLike) score += 2;
  if (compatible(left, right)) score += 2;
  score += Math.min(left.uniquenessRatio, right.uniquenessRatio);
  return score;
}

function sampleSet(column) {
  return new Set((column.sampleValues ?? []).map(value => String(value)));
}

function evidenceForPair(leftFile, leftColumn, rightFile, rightColumn, index) {
  const leftValues = sampleSet(leftColumn);
  const rightValues = sampleSet(rightColumn);
  const overlap = [...leftValues].filter(value => rightValues.has(value));
  const leftCoverage = leftValues.size ? overlap.length / leftValues.size : 0;
  const rightCoverage = rightValues.size ? overlap.length / rightValues.size : 0;
  const likelyCardinality = leftColumn.uniquenessRatio >= 0.98 && rightColumn.uniquenessRatio >= 0.98
    ? "one_to_one"
    : leftColumn.uniquenessRatio < rightColumn.uniquenessRatio
      ? "many_to_one"
      : rightColumn.uniquenessRatio < leftColumn.uniquenessRatio ? "one_to_many" : "many_to_many";
  const sameName = leftColumn.name.toLowerCase() === rightColumn.name.toLowerCase();
  const confidence = Math.min(0.99, (Math.max(leftCoverage, rightCoverage) * 0.65) + (sameName ? 0.2 : 0) + (compatible(leftColumn, rightColumn) ? 0.1 : 0));
  return {
    id: `rel-${index}`,
    leftFile: leftFile.fileName,
    leftColumns: [leftColumn.name],
    rightFile: rightFile.fileName,
    rightColumns: [rightColumn.name],
    typeCompatibility: compatible(leftColumn, rightColumn),
    leftDistinct: leftColumn.distinctCount,
    rightDistinct: rightColumn.distinctCount,
    overlapCount: overlap.length,
    leftCoverage,
    rightCoverage,
    exact: leftFile.rowCountExact && rightFile.rowCountExact && leftColumn.distinctCountExact && rightColumn.distinctCountExact,
    likelyCardinality,
    confidence,
    reason: sameName
      ? `Shared column name ${leftColumn.name} has bounded sample overlap.`
      : `${leftFile.fileName}.${leftColumn.name} and ${rightFile.fileName}.${rightColumn.name} have compatible ID-like values.`,
  };
}

function shortlistColumns(file, limit) {
  return (file.columns ?? [])
    .filter(column => column.nonNullCount > 0 && (column.idLike || column.uniquenessRatio >= 0.5))
    .sort((left, right) => {
      const rightScore = (right.idLike ? 3 : 0) + right.uniquenessRatio + Math.min(right.distinctCount ?? 0, 12) / 100;
      const leftScore = (left.idLike ? 3 : 0) + left.uniquenessRatio + Math.min(left.distinctCount ?? 0, 12) / 100;
      return rightScore - leftScore || left.name.localeCompare(right.name);
    })
    .slice(0, limit);
}

export function profileDatasetRelationships(datasetProfile, limits = RELATIONSHIP_PROFILE_LIMITS) {
  const files = datasetProfile?.files ?? [];
  const candidates = [];
  const compositeCandidates = [];
  for (let leftIndex = 0; leftIndex < files.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < files.length; rightIndex += 1) {
      const leftFile = files[leftIndex];
      const rightFile = files[rightIndex];
      const leftColumns = shortlistColumns(leftFile, limits.maxColumnsPerFile);
      const rightColumns = shortlistColumns(rightFile, limits.maxColumnsPerFile);
      for (const leftColumn of leftColumns) {
        for (const rightColumn of rightColumns) {
          if (!compatible(leftColumn, rightColumn)) continue;
          const score = columnScore(leftColumn, rightColumn);
          if (score >= 4) candidates.push({ leftFile, leftColumn, rightFile, rightColumn, score });
        }
      }
      for (const leftKey of (leftFile.candidateKeys ?? []).filter(key => (key.columns ?? []).length > 1 && key.columns.length <= limits.maxCompositeWidth)) {
        for (const rightKey of (rightFile.candidateKeys ?? []).filter(key => (key.columns ?? []).length === leftKey.columns.length)) {
          const sameColumns = leftKey.columns.every(column => rightKey.columns.includes(column));
          if (!sameColumns) continue;
          compositeCandidates.push({
            id: `rel-composite-${compositeCandidates.length + 1}`,
            leftFile: leftFile.fileName,
            leftColumns: leftKey.columns,
            rightFile: rightFile.fileName,
            rightColumns: rightKey.columns,
            typeCompatibility: true,
            leftDistinct: null,
            rightDistinct: null,
            overlapCount: null,
            leftCoverage: 0.5,
            rightCoverage: 0.5,
            exact: leftFile.rowCountExact && rightFile.rowCountExact && leftKey.exact && rightKey.exact,
            likelyCardinality: leftKey.uniquenessRatio < rightKey.uniquenessRatio ? "many_to_one" : "unknown",
            confidence: 0.72,
            reason: `Composite key candidate ${(leftKey.columns ?? []).join(" + ")} appears in both files.`,
          });
        }
      }
    }
  }
  const pairEvidence = candidates
    .sort((left, right) => right.score - left.score)
    .slice(0, limits.maxColumnPairs)
    .map((candidate, index) => evidenceForPair(candidate.leftFile, candidate.leftColumn, candidate.rightFile, candidate.rightColumn, index + 1))
    .filter(evidence => evidence.confidence >= 0.25 || evidence.leftCoverage > 0 || evidence.rightCoverage > 0);
  return [...pairEvidence, ...compositeCandidates].slice(0, limits.maxColumnPairs);
}
