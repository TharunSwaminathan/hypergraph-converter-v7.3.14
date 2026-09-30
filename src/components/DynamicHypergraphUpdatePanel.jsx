import { useRef, useState } from "react";
import { T } from "../theme.js";
import { getConfirmationCopy } from "../agent/confirmationPolicy.js";
import CandyMotifResult from "./CandyMotifResult.jsx";

export default function DynamicHypergraphUpdatePanel({ graphType, graphVersion, pending, controls, candy,
  batchText, previewActive, onPreview, onEdit }) {
  const [approval, setApproval] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const selector = pending && { updateId: pending.updateId, revision: pending.revision };
  const validated = graphType === "DynamicHypergraph" && pending?.status === "VALIDATED";
  const analysisBusy = ["STAGED", "RUNNING"].includes(candy?.analysisStatus);
  const available = candy?.incrementalAvailability;
  // Presentation never grants authority: live owners recheck every approval.
  const approvalCurrent = approval && pending?.updateId === approval.updateId && pending?.revision === approval.revision
    && (approval.kind !== "analysis" || candy?.runtimeSessionId === approval.session)
    && (approval.kind !== "apply" || controls.isApplyCurrent(approval.token))
    && pending.status === "VALIDATED";

  async function run(operation) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await operation(); } catch (error) { setNotice(error.message); setApproval(null); }
    finally { lock.current = false; setBusy(false); }
  }
  function cancel() {
    if (approval?.kind === "apply") controls.cancelApply(approval.token);
    setApproval(null);
  }
  function request(kind) {
    cancel();
    const result = kind === "apply" ? controls.requestApply(selector) : controls.requestAnalysis(selector);
    if (!result.ok) throw new Error(result.error ?? "Confirmation unavailable.");
    setApproval({ kind, token: result.confirmation, argumentsValue: result.argumentsValue,
      updateId: pending.updateId, revision: pending.revision, session: candy?.runtimeSessionId });
    setNotice("No action has run. Review the separate confirmation below.");
  }
  const copy = getConfirmationCopy(approval?.kind === "apply" ? "apply_pending_hypergraph_update" : "run_candy_expensive_compute");
  return <section aria-label="Dynamic Hypergraph pending update" style={{ marginTop: 18, padding: 20, border: `1px solid ${T.border}`, borderRadius: 12, background: T.card }}>
    <h3 style={{ marginTop: 0 }}>Dynamic Hypergraph Update</h3>
    <p>Author Batch Updates commands above, stage a proposal, inspect its preview, then optionally analyze or Apply. Each action is independent.</p>
    <dl className="agent-model__details">
      <div><dt>Graph type</dt><dd>{graphType}</dd></div>
      <div><dt>Pending status</dt><dd>{pending?.status ?? "NONE"}</dd></div>
      <div><dt>Update</dt><dd>{pending ? `${pending.updateId.slice(0, 20)}… · revision ${pending.revision}` : "none"}</dd></div>
      <div><dt>Version</dt><dd>{pending ? `${pending.baseGraphVersion} → ${pending.nextGraphVersion} (proposed)` : `${graphVersion} (committed)`}</dd></div>
      <div><dt>Operations</dt><dd>{pending?.operationCount ?? 0}</dd></div>
      <div><dt>Motif impact</dt><dd>{pending?.motifImpact ?? "not validated"}</dd></div>
      <div><dt>Validation / analysis preflight</dt><dd>{pending?.status ?? "not staged"} · {available?.ready ? "CUDA_INCREMENTAL available" : available?.reason ?? "unavailable"}</dd></div>
      <div><dt>Analysis</dt><dd>{candy?.analysisStatus ?? "NONE"}</dd></div>
      <div><dt>Current pending delta result</dt><dd>{pending?.resultCurrent ? "yes" : "no"}</dd></div>
    </dl>
    {graphType !== "DynamicHypergraph" && <p role="status">Select DynamicHypergraph in the committed graph card to stage pending updates. Current motif counts still use STATIC.</p>}
    {pending?.status === "STALE" && <p role="alert">Graph changed, changed type, or was replaced ({pending.staleReason}). This proposal cannot run or Apply. Discard it, or explicitly re-stage commands against the current graph to create fresh authority.</p>}
    {pending?.motifImpact === "NONE" && <p>No motif-relevant incidence change. Apply is available independently; no delta computation is needed.</p>}
    {validated && !available?.ready && <p role="status">{available?.message}</p>}
    <div className="agent-file-actions">
      <button type="button" disabled={busy || graphType !== "DynamicHypergraph" || !batchText.trim()} onClick={() => run(async () => {
        cancel(); const result = await controls.stageBatch(batchText); setNotice(result.noOp ? "No graph change; no pending authority created." : "Pending update staged. Committed graph and version are unchanged.");
      })}>{pending ? "Re-stage edited commands" : "Stage pending update"}</button>
      <button type="button" disabled={busy || !validated} onClick={() => onPreview(!previewActive)}>{previewActive ? "Show committed preview" : "Inspect pending preview"}</button>
      <button type="button" disabled={busy || !pending} onClick={onEdit}>Edit commands</button>
      <button type="button" disabled={busy || !pending} onClick={() => run(() => { cancel(); controls.discard(selector); onPreview(false); setNotice("Pending update discarded. Committed graph and version are unchanged."); })}>Discard pending update</button>
      <button type="button" disabled={busy || !validated || !available?.ready || analysisBusy} onClick={() => run(() => request("analysis"))}>Analyze motif delta</button>
      <button type="button" disabled={busy || !validated} onClick={() => run(() => request("apply"))}>Apply pending update</button>
    </div>
    <p style={{ fontSize: 12 }}>Preview uses the existing graph renderer and its render budget. Deleted edges are comparison overlays; the view is non-authoritative. Staging and editing never commit. Opening this panel starts no action.</p>
    {approval && <div role="group" aria-label="Pending update confirmation" style={{ padding: 14, border: `1px solid ${T.amber}` }}>
      <strong>{approval.kind === "analysis" ? "Analyze motif delta?" : copy.title}</strong>
      <p>{approval.kind === "analysis" ? "Run the exact CUDA_INCREMENTAL computational action for this pending revision. The graph will not be changed or applied." : copy.message}</p>
      <p>Revision {approval.revision} · {pending?.baseGraphVersion} → {pending?.nextGraphVersion}</p>
      {!approvalCurrent && <p role="alert">Confirmation is stale because the update, graph or Runtime session changed. Request a fresh confirmation.</p>}
      <button type="button" disabled={busy || !approvalCurrent} onClick={() => run(async () => {
        const chosen = approval; setApproval(null);
        const result = chosen.kind === "apply" ? await controls.confirmApply(chosen.token) : await controls.confirmAnalysis(chosen.argumentsValue, chosen.token);
        if (!result.ok) throw new Error(result.error ?? "Action rejected; request a fresh confirmation.");
        if (chosen.kind === "apply") onPreview(false);
        setNotice(chosen.kind === "apply" ? `Applied once. Committed graph version ${result.graphState.graphVersion}. No Runtime job was created.` : "Analysis submitted. Graph has not been applied. Refresh job status and open its validated result below.");
      })}>{approval.kind === "apply" ? "Confirm Apply only" : "Confirm analysis only"}</button>
      <button type="button" disabled={busy} onClick={cancel}>Cancel confirmation</button>
    </div>}
    <p role="status" aria-live="polite">{notice}</p>
    {candy?.selectedJob?.mode === "INCREMENTAL" && <div className="agent-file-actions">
      <button type="button" disabled={busy} onClick={() => run(async () => { const result = await controls.refreshAnalysis(candy.selectedJob.jobId); if (!result.ok) throw new Error(result.error); setNotice(`Analysis job: ${result.job.status}`); })}>Refresh analysis status</button>
      <button type="button" disabled={busy || candy.selectedJob.status !== "completed"} onClick={() => run(async () => { const result = await controls.openAnalysisResult(candy.selectedJob.jobId); if (!result.ok) throw new Error(result.error); setNotice("Validated delta describes the proposed pending transition. Graph has not been applied."); })}>Open signed delta result</button>
      <button type="button" disabled={busy || ["completed", "failed", "cancelled"].includes(candy.selectedJob.status)} onClick={() => run(async () => { cancel(); const result = await controls.cancelAnalysis(candy.selectedJob.jobId); if (!result.ok) throw new Error(result.error); setNotice("Analysis cancelled. Graph unchanged."); })}>Cancel analysis</button>
    </div>}
    {pending?.resultCurrent && <CandyMotifResult result={candy.selectedMotifResult} />}
    {["STALE", "FAILED", "CANCELLED"].includes(candy?.analysisStatus) && <p role="status">Analysis {candy.analysisStatus.toLowerCase()}. {candy.lastError?.message} Old results are not current. Request a fresh analysis when available.</p>}
  </section>;
}
