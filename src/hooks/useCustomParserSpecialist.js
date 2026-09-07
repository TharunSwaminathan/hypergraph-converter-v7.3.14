import { useEffect, useRef, useState } from "react";
import { customParserTriggerPolicy, parserInputFiles } from "../agent/customParserTriggerPolicy.js";
import { generateSpecialistDraft, specialistBinding } from "../agent/customParserSpecialist.js";

export function useCustomParserSpecialist({ batch, requestModel, installDraft, runtimeError = "", parserBinding, parserCode, running, resultId }) {
  const [jobs, setJobs] = useState([]);
  const [working, setWorking] = useState(false);
  const current = useRef({ batch, requestModel, installDraft, runtimeError, parserBinding, parserCode });
  // Handlers consult the latest render, including edits during model requests.
  useEffect(() => { current.current = { batch, requestModel, installDraft, runtimeError, parserBinding, parserCode }; }, [batch, requestModel, installDraft, runtimeError, parserBinding, parserCode]);
  const lock = useRef(false);
  const policy = customParserTriggerPolicy({ batch, uploadEvent: true });
  const visibleJobs = jobs.filter(j => j.batchId === batch?.id);

  async function generate(query = "Generate custom parser", repairId = null) {
    if (lock.current) return { ok: false, error: "The parser specialist is already working." };
    const snapshot = current.current.batch;
    const trigger = customParserTriggerPolicy({ batch: snapshot, query });
    if (trigger.kind !== "specialist") return { ok: false, error: trigger.reason ?? "Choose a dataset and confirm its grouping first." };
    const input = parserInputFiles(snapshot);
    const existing = repairId ? jobs.find(j => j.id === repairId) : null;
    if (repairId && (!existing || existing.batchId !== snapshot.id)) return { ok: false, error: "That parser lineage is unavailable." };
    if (existing && (current.current.parserBinding?.modelRunId !== existing.id || current.current.parserCode !== existing.code || !current.current.runtimeError)) return { ok: false, error: "Repair requires the current draft's own runtime error; review and run this draft first." };
    const groups = existing ? [existing.files.map(f => f.id)] : trigger.groups;
    lock.current = true; setWorking(true);
    try {
      for (const ids of groups) {
        const files = input.filter(f => ids.includes(f.id));
        const binding = specialistBinding(snapshot, files);
        if (existing && existing.binding !== binding) return { ok: false, error: "Dataset changed; start a fresh parser request." };
        const id = existing?.id ?? `specialist-${globalThis.crypto.randomUUID()}`;
        const job = { id, batchId: snapshot.id, files, binding, status: "analyzing", attempts: existing?.attempts ?? 0, code: existing?.code ?? "" };
        const update = patch => setJobs(values => [...values.filter(v => v.id !== id), { ...job, ...patch }].slice(-50));
        update({});
        try {
          const result = await generateSpecialistDraft({
            files, batch: snapshot, userIntent: query, previous: existing,
            runtimeError: existing ? current.current.runtimeError : "",
            generate: request => current.current.requestModel(request),
            isCurrent: () => specialistBinding(current.current.batch, parserInputFiles(current.current.batch).filter(f => ids.includes(f.id))) === binding,
            onState: update,
          });
          update(result);
          if (!result.ok) return { ...result, error: result.error ?? "Parser generation failed. Review the validation evidence." };
        } catch (error) { update({ status: "failed", error: error.message, attempts: existing?.attempts ?? 0 }); return { ok: false, error: error.message }; }
      }
      return { ok: true, message: "Parser specialist finished. Review each draft; running and applying remain separate confirmations." };
    } finally { lock.current = false; setWorking(false); }
  }

  function adopt(id) {
    if (lock.current) return { ok: false, error: "Wait for parser generation to finish." };
    const job = jobs.find(j => j.id === id);
    const files = parserInputFiles(current.current.batch).filter(f => job?.files.some(source => source.id === f.id));
    if (!job || job.status !== "ready_for_review" || job.binding !== specialistBinding(current.current.batch, files)) return { ok: false, error: "This draft is stale or not validated. Generate a current draft first." };
    const result = current.current.installDraft(job, files);
    if (result.ok && result.batch) setJobs(values => values.map(value => value.id === id ? { ...value, batchId: result.batch.id, binding: specialistBinding(result.batch, files) } : value));
    return result;
  }
  return { policy, jobs: visibleJobs.map(({ files, ...job }) => {
    const installed = parserBinding?.modelRunId === job.id && parserCode === job.code;
    const status = installed && job.status === "ready_for_review"
      ? running ? "running_and_validating" : runtimeError ? "repair_needed" : resultId ? batch?.parserStatus === "applied" ? "completed" : "awaiting_apply_confirmation" : "awaiting_run_confirmation"
      : job.status;
    return { ...job, status, error: installed ? runtimeError || job.error : job.error, fileNames: files.map(f => f.name) };
  }), working, generate, adopt };
}
