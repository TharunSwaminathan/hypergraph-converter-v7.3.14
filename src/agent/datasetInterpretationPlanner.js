import { generateWithLocalModel, classifyLocalModelError } from "./localModelClient.js";
import { LOCAL_MODEL_TASK_TIMEOUTS } from "./localModelSettings.js";
import { buildDatasetInterpretationPrompt } from "./prompts/datasetInterpretationPrompt.js";
import { validateDatasetInterpretationDraft } from "./datasetInterpretationDraftValidator.js";

export async function planDatasetInterpretation({
  config,
  datasetProfile,
  relationshipEvidence = [],
  groupingDraft = null,
  userIntent = "",
  generate = generateWithLocalModel,
  signal = null,
  timeoutMs = LOCAL_MODEL_TASK_TIMEOUTS.dataset_interpretation_total,
  onMetrics = null,
} = {}) {
  const request = buildDatasetInterpretationPrompt({ datasetProfile, relationshipEvidence, groupingDraft, userIntent });
  try {
    const rawResponse = await generate(config, request, { signal, timeoutMs, onMetrics });
    const validation = validateDatasetInterpretationDraft(rawResponse, { datasetProfile, relationshipEvidence });
    if (!validation.ok) return { ok: false, request, rawResponse, validation, error: validation.message };
    return { ok: true, request, rawResponse, draft: validation.draft, validation };
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
