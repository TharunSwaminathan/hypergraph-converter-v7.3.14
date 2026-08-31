export const DERIVED_STATUS = Object.freeze({
  NOT_REQUESTED: "not_requested",
  COMPUTED: "computed",
  OVER_BUDGET: "over_budget",
  RESOURCE_LIMITED: "over_budget",
  INVALID_INPUT: "invalid_input",
  ERROR: "error",
  FAILED: "error",
});

function withoutDiscriminatorOverrides(details) {
  const safeDetails = { ...(details ?? {}) };
  delete safeDetails.type;
  delete safeDetails.status;
  delete safeDetails.value;
  return safeDetails;
}

export function computedDerived(type, value, details = {}) {
  if (value === null || value === undefined) {
    throw new TypeError(`A computed ${type ?? "derived"} result must contain a present value.`);
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError(`A computed ${type ?? "derived"} numeric result must be finite.`);
  }
  return {
    type,
    status: DERIVED_STATUS.COMPUTED,
    value,
    ...withoutDiscriminatorOverrides(details),
    reason: details.reason ?? null,
  };
}

export function resourceLimitedDerived(type, details = {}) {
  return {
    type,
    status: DERIVED_STATUS.OVER_BUDGET,
    value: null,
    estimate: details.estimate ?? null,
    limits: details.limits ?? null,
    ...withoutDiscriminatorOverrides(details),
    reason: details.reason ?? "resource limit reached",
  };
}

export function notRequestedDerived(type, details = {}) {
  return {
    type,
    status: DERIVED_STATUS.NOT_REQUESTED,
    value: null,
    estimate: details.estimate ?? null,
    limits: details.limits ?? null,
    ...withoutDiscriminatorOverrides(details),
    reason: details.reason ?? "not requested",
  };
}

export function invalidInputDerived(type, details = {}) {
  return {
    type,
    status: DERIVED_STATUS.INVALID_INPUT,
    value: null,
    estimate: details.estimate ?? null,
    limits: details.limits ?? null,
    ...withoutDiscriminatorOverrides(details),
    reason: details.reason ?? "invalid input",
  };
}

export function failedDerived(type, details = {}) {
  return {
    type,
    status: DERIVED_STATUS.ERROR,
    value: null,
    estimate: details.estimate ?? null,
    limits: details.limits ?? null,
    ...withoutDiscriminatorOverrides(details),
    reason: details.reason ?? "computation failed",
  };
}
