import { buildH2HBounded, buildV2VBounded, expMatrixResult } from "../utils/mappings.js";

export const DERIVED_OPERATIONS = Object.freeze({
  H2H: "h2h",
  V2V: "v2v",
  LINE_GRAPH: "line_graph",
  MATRIX: "matrix",
});

export function executeDerivedOperation(operationType, hyperedges, options = {}) {
  switch (operationType) {
    case DERIVED_OPERATIONS.H2H:
      return buildH2HBounded(hyperedges, options);
    case DERIVED_OPERATIONS.V2V:
    case DERIVED_OPERATIONS.LINE_GRAPH:
      return buildV2VBounded(hyperedges, options);
    case DERIVED_OPERATIONS.MATRIX:
      return expMatrixResult(hyperedges, options);
    default:
      throw new Error(`Unsupported derived operation: ${operationType}`);
  }
}
