export function canonicalizeDatasetMappingPatch(value = {}) {
  const draft = value.draft ?? value;
  return canonicalizeOperations(draft.operations ?? []);
}

export function canonicalizeGraphMutationPlan(value = {}) {
  const plan = value.plan ?? value;
  return canonicalizeOperations(plan.operations ?? []);
}

export function canonicalizeParserWorkflowOperations(value = {}) {
  return canonicalizeOperations(value.operations ?? (Array.isArray(value) ? value : []));
}

export function canonicalizeDashboardControlIntent(value = {}) {
  const intent = value.canonicalIntent ?? value.intent ?? null;
  const slots = sortObject(value.slots ?? {});
  return intent ? [{ type: intent, slots }] : [];
}

export function canonicalizeOperations(operations = []) {
  return operations.map(operation => sortObject(operation));
}

export function exactCanonicalOperationMatch(actual = [], expected = []) {
  return JSON.stringify(canonicalizeOperations(actual)) === JSON.stringify(canonicalizeOperations(expected));
}

export function partialCanonicalOperationMatch(actual = [], expected = []) {
  return expected.every(expectedOperation => actual.some(operation => contains(operation, expectedOperation)));
}

function contains(actual, expected) {
  if (Array.isArray(expected)) {
    return Array.isArray(actual)
      && expected.length === actual.length
      && expected.every((item, index) => contains(actual[index], item));
  }
  if (expected && typeof expected === "object") {
    return Boolean(actual) && Object.entries(expected).every(([key, value]) => contains(actual[key], value));
  }
  return Object.is(actual, expected);
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["requestId", "timestamp", "createdAt", "updatedAt", "planId", "planHash", "elapsedMs"].includes(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, sortObject(item)]),
  );
}
