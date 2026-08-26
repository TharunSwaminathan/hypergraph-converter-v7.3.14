const OPAQUE_TOKEN = /^[a-z]{3,}[0-9]+$/i;
const VALID_SHORT_ID = /^(?:h|v|p|a|f|g)\d+$/i;
const FAKE_FAMILY = /(?:^|\.)(?:action|question|case|variant)?\.?\d{1,4}$/i;

export function normalizeUtterance(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function templateSkeleton(text = "") {
  return normalizeUtterance(text)
    .replace(/\b(?:please|kindly|could you|can you|would you|will you|for me|right now|now)\b/g, "<polite>")
    .replace(/\b[\w .-]+\.(?:csv|json|tsv|txt|mtx)\b/g, "<file>")
    .replace(/\b(?:author_id|paper_id|vertex_id|hyperedge_id|node_id|group_id|missing_id|title|year|venue|position|institution|score|weight|time|label|ignore|key|edge|group|run|apply|remove)\b/g, "<column>")
    .replace(/\bh\d[\w.:-]*\b/g, "<hyperedge>")
    .replace(/\b(?:vertex|node)\s+[\w.:-]+\b/g, "<vertex>")
    .replace(/\b(?:alice|bob|carol|charlie|dana|apollo|artemis)\b/g, "<name>")
    .replace(/"[^"]+"|'[^']+'|`[^`]+`/g, "<quoted>")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "<date>")
    .replace(/\b\d+(?:\.\d+)?\b/g, "<number>")
    .replace(/\b[a-z]{3,}\d+\b/g, "<opaque>")
    .replace(/[.,;:!?()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function clauseSkeleton(text = "") {
  const normalized = templateSkeleton(text);
  const connectors = [...normalizeUtterance(text).matchAll(/\b(and|but|instead|except|only|then|while|before|after|without|rather than)\b/g)].map(match => match[1]);
  const verbs = [...normalizeUtterance(text).matchAll(/\b(set|use|make|treat|mark|map|connect|link|keep|preserve|ignore|move|group|split|filter|add|include|remove|take|detach|rename|clear|undo|generate|create|run|apply|show|open|switch|export|explain)\b/g)].map(match => match[1]);
  return `${verbs.join(">")}|${connectors.join(">")}|${normalized}`;
}

export function tokenSet(text = "") {
  return new Set(templateSkeleton(text).split(/[^a-z0-9_<>.-]+/i).filter(Boolean));
}

export function jaccard(leftText, rightText) {
  const left = tokenSet(leftText);
  const right = tokenSet(rightText);
  if (!left.size && !right.size) return 1;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / new Set([...left, ...right]).size;
}

export function inspectCorpusIntegrity(fixtures, { maxFamilyShare = 0.05, maxSkeletonShare = 0.05 } = {}) {
  const ids = new Set();
  const normalized = new Map();
  const skeletons = new Map();
  const clauseSkeletons = new Map();
  const errors = [];
  const opaqueSuffixViolations = [];
  const fakeFamilyViolations = [];
  const groundTruthViolations = [];
  const categoryDomainViolations = [];
  const categoryCounts = {};
  const familyCounts = {};
  const familyByCategory = {};

  for (const fixture of fixtures) {
    const category = fixture.category ?? "core_regressions";
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    if (!fixture.id) errors.push("Fixture is missing id.");
    if (fixture.id && ids.has(fixture.id)) errors.push(`Duplicate fixture id ${fixture.id}.`);
    ids.add(fixture.id);
    if (!fixture.family) errors.push(`${fixture.id} is missing family.`);
    if (fixture.family && FAKE_FAMILY.test(fixture.family)) fakeFamilyViolations.push({ id: fixture.id, family: fixture.family });
    if (!fixture.context && !fixture.contextFixture) errors.push(`${fixture.id} is missing context.`);
    if (!fixture.expected) errors.push(`${fixture.id} is missing expected semantics.`);
    if (!fixture.text?.trim()) errors.push(`${fixture.id} has empty text.`);
    const norm = normalizeUtterance(fixture.text);
    if (normalized.has(norm)) errors.push(`Duplicate normalized utterance: ${fixture.id} and ${normalized.get(norm)}.`);
    normalized.set(norm, fixture.id);
    const skeleton = templateSkeleton(fixture.text);
    if (!skeletons.has(skeleton)) skeletons.set(skeleton, []);
    skeletons.get(skeleton).push(fixture.id);
    const clause = clauseSkeleton(fixture.text);
    if (!clauseSkeletons.has(clause)) clauseSkeletons.set(clause, []);
    clauseSkeletons.get(clause).push(fixture.id);

    const tokens = norm.match(/\b[a-z]+\d+\b/g) ?? [];
    const suspicious = tokens.filter(token => OPAQUE_TOKEN.test(token) && !VALID_SHORT_ID.test(token));
    const trailingOpaque = /\b(?:for|with|about|during|under)\s+([a-z]{3,}\d+)\s*[.!?]?$/i.exec(norm);
    if (suspicious.length || trailingOpaque) {
      opaqueSuffixViolations.push({ id: fixture.id, tokens: [...new Set([...suspicious, ...(trailingOpaque ? [trailingOpaque[1]] : [])])] });
    }

    if (fixture.category !== "core_regressions") {
      if (fixture.groundTruth?.reviewed !== true && fixture.expected?.groundTruth?.reviewed !== true) {
        groundTruthViolations.push({ id: fixture.id, reason: "missing reviewed ground truth" });
      }
      const expectedDomain = fixture.expected?.domain;
      const expectedByCategory = expectedDomainForCategory(category);
      if (expectedByCategory && expectedDomain && expectedDomain !== expectedByCategory && !fixture.groundTruth?.rationale) {
        categoryDomainViolations.push({ id: fixture.id, category, expectedDomain, expectedByCategory });
      }
    }

    if (fixture.family) {
      familyCounts[fixture.family] = (familyCounts[fixture.family] ?? 0) + 1;
      const key = `${category}::${fixture.family}`;
      familyByCategory[key] = (familyByCategory[key] ?? 0) + 1;
    }
  }

  const repeatedSkeletons = [...skeletons.entries()].filter(([, members]) => members.length > 1);
  const repeatedClauseSkeletons = [...clauseSkeletons.entries()].filter(([, members]) => members.length > 1);
  const dominatingSkeletons = repeatedClauseSkeletons.filter(([, members]) => {
    const category = fixtureCategory(fixtures, members[0]);
    return members.length / Math.max(1, categoryCounts[category] ?? fixtures.length) > maxSkeletonShare;
  });
  const dominatingFamilies = Object.entries(familyByCategory).filter(([key, count]) => {
    const category = key.split("::")[0];
    return count / Math.max(1, categoryCounts[category]) > maxFamilyShare;
  }).map(([key, count]) => ({ category: key.split("::")[0], family: key.split("::")[1], count }));

  const highSimilarityClusters = [];
  for (let i = 0; i < fixtures.length; i += 1) {
    for (let j = i + 1; j < fixtures.length; j += 1) {
      if ((fixtures[i].category ?? "core_regressions") !== (fixtures[j].category ?? "core_regressions")) continue;
      const score = jaccard(fixtures[i].text, fixtures[j].text);
      if (score >= 0.94) highSimilarityClusters.push({ ids: [fixtures[i].id, fixtures[j].id], score: Number(score.toFixed(3)) });
    }
  }

  for (const item of opaqueSuffixViolations) errors.push(`${item.id} contains opaque synthetic token(s): ${item.tokens.join(", ")}.`);
  for (const item of fakeFamilyViolations) errors.push(`${item.id} uses a numeric/fake family label: ${item.family}.`);
  for (const item of groundTruthViolations) errors.push(`${item.id} ${item.reason}.`);
  for (const item of categoryDomainViolations) errors.push(`${item.id} category ${item.category} conflicts with expected domain ${item.expectedDomain}.`);
  for (const item of dominatingFamilies) errors.push(`${item.category}/${item.family} exceeds ${Math.round(maxFamilyShare * 100)}% of its category.`);
  for (const [, members] of dominatingSkeletons) errors.push(`Clause skeleton dominates category: ${members.slice(0, 8).join(", ")}.`);

  return {
    ok: errors.length === 0,
    errors,
    literalUnique: new Set(fixtures.map(fixture => String(fixture.text))).size,
    normalizedUnique: normalized.size,
    substantiveSkeletonUnique: skeletons.size,
    clauseSkeletonUnique: clauseSkeletons.size,
    uniqueCount: normalized.size,
    semanticFamilyCount: Object.keys(familyCounts).length,
    familyCounts,
    categoryCounts,
    duplicateNormalizedUtterances: fixtures.length - normalized.size,
    repeatedSkeletons,
    repeatedClauseSkeletons,
    dominatingSkeletons,
    dominatingFamilies,
    highSimilarityClusters,
    opaqueSuffixViolations,
    fakeFamilyViolations,
    groundTruthViolations,
    categoryDomainViolations,
  };
}

function expectedDomainForCategory(category) {
  if (category.startsWith("dataset_mapping")) return "dataset_mapping";
  if (category.startsWith("dataset_grouping")) return "dataset_grouping";
  if (category.startsWith("graph_mutation")) return "graph_mutation";
  if (category === "parser_workflow") return "parser_workflow";
  if (category === "dashboard_control") return "dashboard_control";
  return null;
}

function fixtureCategory(fixtures, id) {
  return fixtures.find(fixture => fixture.id === id)?.category ?? "core_regressions";
}
