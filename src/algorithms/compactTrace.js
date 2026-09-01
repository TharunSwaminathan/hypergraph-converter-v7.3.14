const TRACE_METADATA = Symbol("hypergraph.compactTrace");

/**
 * Array-compatible, one-step-cached trace facade.
 *
 * Numeric properties are enumerable accessors so existing callers, JSON
 * serialization and deep equality continue to observe an ordinary steps
 * array. Only the most recently requested full step is retained.
 */
export function createCompactTraceSteps({ length, materialize, iterate = null, storage = {} }) {
  if (!Number.isInteger(length) || length < 0) throw new TypeError("Trace length must be a non-negative integer.");
  if (length === 0) return [];

  const steps = [];
  let cachedIndex = -1;
  let cachedStep = null;
  const getStep = index => {
    if (!Number.isInteger(index) || index < 0 || index >= length) return undefined;
    if (cachedIndex !== index) {
      cachedStep = materialize(index);
      cachedIndex = index;
    }
    return cachedStep;
  };

  for (let index = 0; index < length; index += 1) {
    Object.defineProperty(steps, index, {
      enumerable: true,
      configurable: false,
      get: () => getStep(index),
    });
  }
  Object.defineProperty(steps, TRACE_METADATA, {
    enumerable: false,
    configurable: false,
    value: Object.freeze({
      compact: true,
      length,
      storage: Object.freeze({ ...storage }),
      getStep,
      iterate,
      get cachedFullSteps() { return cachedIndex < 0 ? 0 : 1; },
    }),
  });
  if (iterate) {
    Object.defineProperty(steps, "reduce", {
      enumerable: false,
      configurable: false,
      value(callback, ...initialValue) {
        if (typeof callback !== "function") throw new TypeError("Trace reducer must be a function.");
        let initialized = initialValue.length > 0;
        let accumulator = initialValue[0];
        iterate((step, index) => {
          if (!initialized) {
            accumulator = step;
            initialized = true;
          } else {
            accumulator = callback(accumulator, step, index, steps);
          }
        });
        if (!initialized) throw new TypeError("Reduce of empty trace with no initial value.");
        return accumulator;
      },
    });
  }
  return steps;
}

export function materializeTraceStep(steps, index) {
  const metadata = steps?.[TRACE_METADATA];
  return metadata ? metadata.getStep(index) : steps?.[index];
}

export function getTraceStorageSummary(steps) {
  const metadata = steps?.[TRACE_METADATA];
  if (!metadata) {
    return {
      compact: false,
      stepCount: steps?.length ?? 0,
      cachedFullSteps: steps?.length ?? 0,
      ...countEagerReferences(steps ?? []),
    };
  }
  return {
    compact: true,
    stepCount: metadata.length,
    cachedFullSteps: metadata.cachedFullSteps,
    ...metadata.storage,
  };
}

function countEagerReferences(steps) {
  let visitedReferences = 0;
  let frontierReferences = 0;
  let newlyDiscoveredReferences = 0;
  for (const step of steps) {
    visitedReferences += step?.visited?.length ?? 0;
    frontierReferences += step?.frontier?.length ?? 0;
    newlyDiscoveredReferences += step?.newlyDiscovered?.length ?? 0;
  }
  return { visitedReferences, frontierReferences, newlyDiscoveredReferences };
}
