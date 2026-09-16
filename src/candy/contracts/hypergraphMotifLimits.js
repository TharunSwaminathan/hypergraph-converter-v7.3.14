import { CANDY_ERROR_CODES, failCandy } from "./errorClasses.js";

// Optional limits are qualification controls, not authority to raise ceilings.
export function resolveHypergraphLimits(overrides, ceilings) {
  if (overrides == null) return ceilings;
  if (typeof overrides !== "object" || Array.isArray(overrides)
    || Object.getPrototypeOf(overrides) !== Object.prototype) {
    failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Limits must be a plain object.");
  }
  const result = { ...ceilings };
  for (const key of Object.keys(overrides)) {
    if (!Object.hasOwn(ceilings, key) || !Number.isSafeInteger(overrides[key])
      || overrides[key] < 0 || overrides[key] > ceilings[key]) {
      failCandy(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Limits may only tighten known hard ceilings.");
    }
    result[key] = overrides[key];
  }
  return Object.freeze(result);
}
