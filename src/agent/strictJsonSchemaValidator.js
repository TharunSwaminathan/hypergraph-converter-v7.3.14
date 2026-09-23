function typeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

function formatPath(path, key) {
  return /^\d+$/.test(String(key)) ? `${path}[${key}]` : `${path}.${key}`;
}

export function validateStrictJsonSchema(value, schema, { path = "draft" } = {}) {
  const errors = [];
  function visit(current, rule, currentPath) {
    if (!rule || !Object.keys(rule).length) return;
    const allowedTypes = Array.isArray(rule.type) ? rule.type : rule.type ? [rule.type] : [];
    if (allowedTypes.length && !allowedTypes.some(type => typeMatches(current, type))) {
      errors.push(`${currentPath} must be ${allowedTypes.join(" or ")}.`);
      return;
    }
    if (rule.enum && !rule.enum.some(item => Object.is(item, current))) {
      errors.push(`${currentPath} is not an allowed value.`);
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, rule.items, formatPath(currentPath, index)));
      return;
    }
    if (current === null || typeof current !== "object") return;
    const properties = rule.properties ?? {};
    for (const key of rule.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(current, key)) errors.push(`${formatPath(currentPath, key)} is required.`);
    }
    if (rule.additionalProperties === false) {
      for (const key of Object.keys(current)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) errors.push(`${formatPath(currentPath, key)} is not allowed.`);
      }
    }
    for (const [key, childRule] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(current, key)) visit(current[key], childRule, formatPath(currentPath, key));
    }
  }
  visit(value, schema, path);
  return { ok: errors.length === 0, errors };
}
