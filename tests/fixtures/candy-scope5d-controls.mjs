import { harness } from "./candy-scope5-runtime.mjs";
import { createDynamicUpdateControls } from "../../src/graph/dynamicUpdateControls.js";
import { motifPreflight } from "../../src/candy/motifPreflight.js";

export async function controlsHarness() {
  const h = await harness();
  const getCandy = () => {
    const snapshot = h.analysis.getSnapshot(), result = h.analysis.currentResult()?.result ?? null;
    const pending = h.pending.getCurrent();
    return { state: { ...h.runtime, analysisStatus: snapshot.status, selectedJob: snapshot.job,
      selectedMotifResult: result, resultEvidence: h.analysis.currentResult(), lastError: snapshot.lastError,
      incrementalAvailability: motifPreflight({ graph: h.graph, pendingUpdate: pending, runtime: h.runtime,
        argumentsValue: { mode: "INCREMENTAL", backend: "CUDA_INCREMENTAL", deviceId: 0, timeoutMs: 5000, updateContextId: pending?.updateId } }) },
    actions: { stageMotifAnalysis: h.analysis.stage, submitFromAssistant: h.analysis.submit,
      getJobStatus: h.analysis.getJobStatus, openResult: h.analysis.openResult, cancelJob: h.analysis.cancelJob } };
  };
  const controls = createDynamicUpdateControls({ pendingController: h.pending, getGraphState: () => h.graph, getCandy });
  return { h, controls, getCandy, selector: () => ({ updateId: h.pending.getCurrent().updateId, revision: h.pending.getCurrent().revision }) };
}
