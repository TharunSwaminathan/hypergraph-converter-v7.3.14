import { CANDY_ERROR_CODES, CandyContractError } from "../../../src/candy/contracts/errorClasses.js";

export function writeJson(response, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...headers,
  });
  response.end(body);
}

export function structuredError(error) {
  if (error instanceof CandyContractError) return error.toJSON();
  return {
    schemaVersion: "candy.algorithm-error/1",
    classification: "ALGORITHM_FAILURE",
    message: "The local runtime rejected the operation.",
    userCorrectable: false,
    retryable: false,
    details: {},
  };
}

export function statusForError(error) {
  if (!(error instanceof CandyContractError)) return 500;
  if (error.code === CANDY_ERROR_CODES.RESOURCE_LIMIT) return 413;
  if ([CANDY_ERROR_CODES.BACKEND_UNAVAILABLE, CANDY_ERROR_CODES.BUILD_MISSING].includes(error.code)) return 503;
  return 400;
}

export async function readJsonBody(request, maxBytes) {
  const declared = Number(request.headers["content-length"] ?? 0);
  if (declared > maxBytes) throw new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Request body exceeds the configured limit.");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) {
      request.destroy();
      throw new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Request body exceeds the configured limit.");
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Request body must be valid JSON.");
  }
}

export function corsHeaders(origin, allowedOrigins) {
  if (!origin || !allowedOrigins.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-private-network": "true",
    vary: "Origin",
  };
}
