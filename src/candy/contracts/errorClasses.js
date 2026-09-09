import { CANDY_SCHEMA_VERSIONS } from "./schemaVersions.js";

export const CANDY_ERROR_CODES = Object.freeze({
  INVALID_GRAPH_TYPE: "INVALID_GRAPH_TYPE",
  INVALID_GRAPH_SCHEMA: "INVALID_GRAPH_SCHEMA",
  UNSUPPORTED_WEIGHT_MODEL: "UNSUPPORTED_WEIGHT_MODEL",
  INVALID_VERTEX: "INVALID_VERTEX",
  INVALID_UPDATE_BATCH: "INVALID_UPDATE_BATCH",
  STALE_GRAPH_VERSION: "STALE_GRAPH_VERSION",
  STALE_PROPERTY_STATE: "STALE_PROPERTY_STATE",
  BACKEND_UNAVAILABLE: "BACKEND_UNAVAILABLE",
  BUILD_MISSING: "BUILD_MISSING",
  RESOURCE_LIMIT: "RESOURCE_LIMIT",
  PROCESS_TIMEOUT: "PROCESS_TIMEOUT",
  PROCESS_CRASH: "PROCESS_CRASH",
  OUTPUT_PARSE_FAILURE: "OUTPUT_PARSE_FAILURE",
  ALGORITHM_FAILURE: "ALGORITHM_FAILURE",
  RESULT_VALIDATION_FAILURE: "RESULT_VALIDATION_FAILURE",
  JOB_CANCELLED: "JOB_CANCELLED",
});

const ERROR_TRAITS = Object.freeze({
  INVALID_GRAPH_TYPE: [true, false],
  INVALID_GRAPH_SCHEMA: [true, false],
  UNSUPPORTED_WEIGHT_MODEL: [true, false],
  INVALID_VERTEX: [true, false],
  INVALID_UPDATE_BATCH: [true, false],
  STALE_GRAPH_VERSION: [true, false],
  STALE_PROPERTY_STATE: [true, false],
  BACKEND_UNAVAILABLE: [false, true],
  BUILD_MISSING: [false, false],
  RESOURCE_LIMIT: [true, true],
  PROCESS_TIMEOUT: [true, true],
  PROCESS_CRASH: [false, true],
  OUTPUT_PARSE_FAILURE: [false, false],
  ALGORITHM_FAILURE: [false, false],
  RESULT_VALIDATION_FAILURE: [false, false],
  JOB_CANCELLED: [true, true],
});

export class CandyContractError extends Error {
  constructor(code, message, details = {}) {
    if (!Object.hasOwn(ERROR_TRAITS, code)) {
      throw new TypeError(`Unknown CANDY error code: ${String(code)}`);
    }
    super(message);
    this.name = "CandyContractError";
    this.code = code;
    this.details = Object.freeze({ ...details });
    [this.userCorrectable, this.retryable] = ERROR_TRAITS[code];
  }

  toJSON() {
    return {
      schemaVersion: CANDY_SCHEMA_VERSIONS.ALGORITHM_ERROR,
      classification: this.code,
      message: this.message,
      userCorrectable: this.userCorrectable,
      retryable: this.retryable,
      details: this.details,
    };
  }
}

export function failCandy(code, message, details) {
  throw new CandyContractError(code, message, details);
}

export function isCandyContractError(error, code) {
  return error instanceof CandyContractError && (code == null || error.code === code);
}
