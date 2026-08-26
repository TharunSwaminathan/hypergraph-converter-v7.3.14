// Spread-based `Math.min(...arr)` / `Math.max(...arr)` push every element of
// `arr` onto the JS call stack as individual arguments. For graph-derived
// arrays (degree lists, per-column numeric values, hyperedge cardinalities,
// ...) that can grow into the hundreds of thousands or millions, this throws
// `RangeError: Maximum call stack size exceeded` well before the array is
// actually too large to process. These are safe, one-pass replacements.
//
// (V7310-D04)

/**
 * One-pass minimum over an array (or any iterable) of numbers.
 * @param {Iterable<number>} values
 * @returns {number} the minimum value, or +Infinity for an empty input —
 *   callers that need a different empty-array convention (0, null, ...)
 *   should check length/emptiness themselves before calling.
 */
export function arrayMin(values) {
  let min = Infinity;
  for (const value of values) {
    if (value < min) min = value;
  }
  return min;
}

/**
 * One-pass maximum over an array (or any iterable) of numbers.
 * @param {Iterable<number>} values
 * @returns {number} the maximum value, or -Infinity for an empty input.
 */
export function arrayMax(values) {
  let max = -Infinity;
  for (const value of values) {
    if (value > max) max = value;
  }
  return max;
}

/**
 * One-pass [min, max] over an array (or any iterable) of numbers — avoids
 * iterating the input twice when both are needed.
 * @param {Iterable<number>} values
 * @returns {[number, number]} [min, max], or [Infinity, -Infinity] for an
 *   empty input.
 */
export function arrayMinMax(values) {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
}
