import { generateWithLocalModel, classifyLocalModelError } from "./localModelClient.js";
import { LOCAL_MODEL_TASK_TIMEOUTS } from "./localModelSettings.js";
import { applyDatasetMappingPatch } from "./datasetMappingPatchApplier.js";
import { validateDatasetMappingPatchDraft } from "./datasetMappingPatchValidator.js";
import { buildDatasetMappingPatchPrompt } from "./prompts/datasetMappingPatchPrompt.js";

function headersByFile(datasetProfile = {}) {
  return Object.fromEntries((datasetProfile.files ?? []).map(file => [file.fileName, (file.columns ?? []).map(column => column.name)]));
}

export async function planDatasetMappingPatch({
  config,
  mappingSpec,
  datasetProfile,
  relationshipEvidence = [],
  userIntent = "",
  history = [],
  generate = generateWithLocalModel,
  signal = null,
  timeoutMs = LOCAL_MODEL_TASK_TIMEOUTS.mapping_patch_total,
  onMetrics = null,
} = {}) {
  const request = buildDatasetMappingPatchPrompt({ mappingSpec, datasetProfile, relationshipEvidence, userIntent });
  try {
    let rawResponse = await generate(config, request, { signal, timeoutMs, onMetrics });
    let validation = validateDatasetMappingPatchDraft(rawResponse, {
      fileNames: (datasetProfile.files ?? []).map(file => file.fileName),
      headersByFile: headersByFile(datasetProfile),
      groupIds: (mappingSpec.groups ?? []).map(group => group.id),
    });
    let repairAttempts = 0;
    const attempts = [{ task: "plan_dataset_mapping_patch", attempt: 0, status: validation.ok ? "valid" : "invalid_mapping_patch" }];
    if (!validation.ok) {
      const repairRequest = {
        ...request,
        messages: [
          ...request.messages,
          { role: "assistant", content: String(rawResponse).slice(0, 3000) },
          {
            role: "user",
            content: [
              "The previous typed DatasetMappingPatch was rejected by deterministic validation.",
              "Return one corrected JSON object only.",
              "Use only exact active file names, exact profiled columns, and supported schema fields.",
              "Validation errors:",
              ...validation.errors.slice(0, 12).map(error => `- ${error}`),
            ].join("\n"),
          },
        ],
        promptChars: request.promptChars + String(rawResponse).slice(0, 3000).length + validation.errors.join("\n").length,
      };
      rawResponse = await generate(config, repairRequest, { signal, timeoutMs, onMetrics });
      validation = validateDatasetMappingPatchDraft(rawResponse, {
        fileNames: (datasetProfile.files ?? []).map(file => file.fileName),
        headersByFile: headersByFile(datasetProfile),
        groupIds: (mappingSpec.groups ?? []).map(group => group.id),
      });
      repairAttempts = 1;
      attempts.push({ task: "plan_dataset_mapping_patch_repair", attempt: 1, status: validation.ok ? "valid" : "invalid_mapping_patch" });
    }
    if (!validation.ok) return { ok: false, request, rawResponse, validation, attempts, repairAttempts, error: validation.errors.join(" ") };
    if (validation.draft.classification !== "patch") {
      return { ok: true, request, rawResponse, draft: validation.draft, applied: null, clarification: validation.draft.clarificationQuestion ?? "", attempts, repairAttempts };
    }
    const applied = applyDatasetMappingPatch(mappingSpec, validation.draft, {
      fileProfiles: datasetProfile.files ?? [],
      source: "local_model_patch",
      history,
    });
    if (!applied.ok) return { ok: false, request, rawResponse, draft: validation.draft, validation: applied.validation, attempts, repairAttempts, error: applied.errors.join(" ") };
    return { ok: true, request, rawResponse, draft: validation.draft, applied, attempts, repairAttempts };
  } catch (error) {
    return {
      ok: false,
      request,
      classification: classifyLocalModelError(error),
      aborted: error?.classification === "request_aborted" || error?.name === "AbortError",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
