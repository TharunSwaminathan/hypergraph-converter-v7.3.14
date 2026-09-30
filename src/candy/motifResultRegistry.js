import { validateBrowserMotifResult } from "./motifWorkflow.js";
import { motifAuthorityKey } from "./motifPreflight.js";

export function createMotifResultRegistry() {
  let evidence = null, epoch = 0;
  return Object.freeze({
    clear() { epoch++; evidence = null; },
    getCurrent({ applicationBinding, runtimeSessionId }) {
      return evidence && evidence.runtimeSessionId === runtimeSessionId
        && motifAuthorityKey(evidence.applicationBinding) === motifAuthorityKey(applicationBinding) ? evidence : null;
    },
    async accept(result, binding, isCurrent = () => true) {
      const generation = ++epoch;
      const check = () => {
        if (generation !== epoch || !isCurrent()) throw Object.assign(new Error("Result authority is stale or abandoned."), {code:"STALE_GRAPH_VERSION"});
      };
      check();
      if (!binding?.applicationBinding || !binding.jobId || !binding.nativeRequestDigest)
        throw Object.assign(new Error("Exact application/result authority is required."), {code:"RESULT_VALIDATION_FAILURE"});
      const immutableResult = structuredClone(result);
      await validateBrowserMotifResult(immutableResult, binding); check();
      evidence = deepFreeze({ schemaVersion:"candy.application-motif-result/1",
        runtimeSessionId:binding.runtimeSessionId, jobId:binding.jobId, requestId:binding.requestId,
        algorithm:binding.algorithm, taxonomyVersion:binding.taxonomyVersion, backend:binding.backend,
        mode:binding.mode, deviceId:binding.deviceId, applicationBinding:{...binding.applicationBinding},
        graphArtifactId:binding.graphArtifactId, updateArtifactId:binding.updateRef?.artifactId ?? null,
        resultArtifactId:immutableResult.resultArtifactRef.id, resultDigest:immutableResult.resultArtifactRef.id,
        nativeRequestDigest:binding.nativeRequestDigest, interpretation:immutableResult.interpretation,
        result:immutableResult, workspaceMutated:false, applyAuthority:false,
      });
      return evidence;
    },
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
