import { generateWithLocalModel } from "./localModelClient.js";
import { buildModelRepairRequest } from "./modelPromptBuilder.js";
import { validateLocalModelResponse } from "./modelResponseValidator.js";

export const MAX_MODEL_RETRIES = 2;

function failureStatus(validation) {
  if (!validation?.data) return "invalid_json";
  if ((validation.errors ?? []).some(error => /parserCode|JavaScript|unsafe|markdown|HTML|parseHypergraph/i.test(error))) {
    return "invalid_parser_code";
  }
  return "invalid_schema";
}

export function rawResponsePreview(rawResponse, limit = 4000) {
  const text = String(rawResponse ?? "");
  return text.length > limit ? `${text.slice(0, limit)}\n… [truncated]` : text;
}

export async function generateValidatedModelResponse({
  config,
  request,
  expectedTask,
  expectedParseMode,
  activeFileNames,
  maxRetries = MAX_MODEL_RETRIES,
  generate = generateWithLocalModel,
  validate = validateLocalModelResponse,
}) {
  let currentRequest = request;
  let lastValidation = null;
  let lastRawResponse = "";
  const attempts = [];

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const rawResponse = await generate(config, currentRequest);
    const validation = validate(rawResponse, {
      expectedTask,
      expectedParseMode,
      activeFileNames,
    });
    const status = validation.ok ? "valid" : failureStatus(validation);
    attempts.push({
      attempt: attempt + 1,
      task: expectedTask,
      status,
      validationErrors: validation.errors ?? [],
      rawResponsePreview: rawResponsePreview(rawResponse),
      repaired: attempt > 0,
    });
    lastValidation = validation;
    lastRawResponse = rawResponse;
    if (validation.ok) {
      return {
        ok: true,
        data: validation.data,
        validation,
        attempts,
        rawResponse,
        repairAttempts: attempt,
        request: currentRequest,
      };
    }
    if (attempt < maxRetries) {
      currentRequest = buildModelRepairRequest(request, {
        task: expectedTask,
        rawResponse,
        validationErrors: validation.errors ?? [],
        failureStatus: status,
        repairAttempt: attempt + 1,
      });
    }
  }

  return {
    ok: false,
    data: lastValidation?.data ?? null,
    validation: lastValidation,
    attempts,
    rawResponse: lastRawResponse,
    repairAttempts: maxRetries,
    request: currentRequest,
    error: `${lastValidation?.message ? `${lastValidation.message}\n` : ""}The local model could not produce a valid ${expectedTask === "generate_custom_parser" ? "parser" : "response"} after ${maxRetries} repair attempts. I did not insert or run parser code.`,
  };
}

