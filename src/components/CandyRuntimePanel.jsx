import { useState } from "react";
import { presentCandyCapabilities } from "../candy/runtimeCapabilityPresentation.js";
import { HYPERGRAPH_3EDGE_MOTIF_TAXONOMY } from "../candy/hypergraphMotifs/taxonomy.js";

export default function CandyRuntimePanel({ candy, actions, busy = false, onNotice = () => {}, onSubmitMotif = () => {} }) {
  const [credential, setCredential] = useState("");
  const presentation = presentCandyCapabilities(candy);
  const staticCapability=candy?.capabilities?.find(cap=>cap.backend === "CUDA_STATIC");
  const incrementalCapability=candy?.graphType === "DynamicHypergraph" && candy?.pendingUpdateContext && candy?.capabilities?.find(cap=>cap.backend === "CUDA_INCREMENTAL");
  const selected=candy?.selectedJob;
  const result=candy?.selectedMotifResult;
  const observe=async operation=>{const response=await operation();onNotice(response.ok?"CANDY job observation updated.":response.error,response.ok?"status":"warning");};
  if (!candy?.featureEnabled) return (
    <details className="agent-candy-runtime">
      <summary>CANDY Runtime Companion <span>browser-only mode</span></summary>
      <p>Native CANDY integration is disabled. The existing Studio remains fully functional. Set <code>VITE_CANDY_RUNTIME_ENABLED=true</code> at build time to enable local companion discovery.</p>
    </details>
  );
  const discover = async () => {
    if (credential.trim()) actions.pairCandyRuntime(credential.trim());
    const result = await actions.discoverCandyRuntime();
    onNotice(result.ok ? `CANDY companion discovered (${result.discovered.status}).${result.intersection.status === "ready" ? "" : ` ${result.intersection.reason}`}` : result.error, result.ok ? "status" : "warning");
    setCredential("");
  };
  return (
    <details className="agent-candy-runtime" open>
      <summary>CANDY Runtime Companion <span>{candy.status}</span></summary>
      <p>Optional authenticated loopback execution for qualified SSSP and CUDA hypergraph 3-edge motif analysis. CUDA is advertised only when its exact local qualification record, binary and GPU match.</p>
      <dl className="agent-model__details">
        <div><dt>Endpoint</dt><dd>{candy.baseUrl}</dd></div>
        <div><dt>Runtime</dt><dd>{candy.runtimeVersion ?? "not discovered"}</dd></div>
        <div><dt>Pairing</dt><dd>{candy.authorized ? "paired for this browser session" : "not paired"}</dd></div>
        <div><dt>Runtime capability readiness</dt><dd>{candy.runtimeCapabilityStatus ?? (presentation.qualifiedBackends.length ? "ready" : "unavailable")}</dd></div>
        <div><dt>Active graph capability</dt><dd>{candy.capabilityStatus}</dd></div>
        <div><dt>Runtime-qualified backends</dt><dd>{presentation.qualifiedBackends.join(", ") || "none"}</dd></div>
        <div><dt>Executable for active graph</dt><dd>{presentation.executableBackends.join(", ") || "none"}</dd></div>
        <div><dt>Runtime-qualified CUDA devices</dt><dd>{presentation.cudaDevices.map(device => `${device.id}: ${device.name} (${device.computeCapability}, ${device.qualifiedArchitecture})`).join("; ") || "none qualified"}</dd></div>
        <div><dt>Active graph type</dt><dd>{candy.graphType ?? "none (no committed graph)"}</dd></div>
      </dl>
      <label>Session pairing credential
        <input type="password" autoComplete="off" value={credential} onChange={event => setCredential(event.target.value)} placeholder="Not saved to chat or persistent memory" />
      </label>
      <div className="agent-file-actions">
        <button type="button" disabled={busy} onClick={discover}>Pair and discover</button>
        <button type="button" disabled={busy || !candy.authorized} onClick={() => { actions.pairCandyRuntime(""); onNotice("CANDY pairing cleared for this browser session.", "status"); }}>Clear pairing</button>
      </div>
      {candy.lastError && <p className="agent-candy-runtime__error"><strong>{candy.lastError.classification}:</strong> {candy.lastError.message}</p>}
      {candy.authorized && candy.capabilityReason && <p role="status">{candy.capabilityReason}</p>}
      {candy.graphType === "Hypergraph" && <p>No SSSP tool is exposed for this graph. The companion will not implicitly project a hypergraph.</p>}
      <p>CUDA SSSP supports INCREMENTAL and COMPARE. Motif STATIC uses CUDA_STATIC; motif INCREMENTAL uses CUDA_INCREMENTAL and requires an authoritative DynamicHypergraph with a pending qualified update. Analysis never applies an update or selects a fallback.</p>
      <p>Motif analysis uses the committed graph. Batch previews require a separate commit before they become analysis input.</p>
      <div className="agent-file-actions">
        <button type="button" disabled={busy || !staticCapability || !candy.authorized} onClick={()=>onSubmitMotif({mode:"STATIC",backend:"CUDA_STATIC",deviceId:staticCapability.devices[0].id,timeoutMs:5000})}>Count 3-edge motifs with CUDA</button>
        <button type="button" disabled={busy || !incrementalCapability || !candy.authorized} onClick={()=>onSubmitMotif({mode:"INCREMENTAL",backend:"CUDA_INCREMENTAL",deviceId:incrementalCapability.devices[0].id,timeoutMs:5000,updateContextId:candy.pendingUpdateContext.updateId})}>Analyze pending motif delta</button>
      </div>
      {!incrementalCapability && <p>Incremental motif analysis is unavailable for this workspace: an authoritative DynamicHypergraph and qualified pending update are required.</p>}
      {selected && <div className="agent-file-actions">
        <button type="button" disabled={busy} onClick={()=>observe(()=>actions.getCandyJobStatus(selected.jobId))}>Refresh job status</button>
        <button type="button" disabled={busy || ["completed","failed","cancelled"].includes(selected.status)} onClick={()=>observe(()=>actions.cancelCandyJob(selected.jobId))}>Cancel job</button>
        <button type="button" disabled={busy || selected.status !== "completed"} onClick={()=>observe(()=>actions.openCandyResult(selected.jobId))}>Open validated result</button>
      </div>}
      {selected?.errorClassification && <p role="status">{selected.errorClassification}</p>}
      {result && <div aria-label="Validated motif result">
        <p>{result.mode === "STATIC" ? "Connected triples" : "Signed total delta (delta only)"}: <strong>{result.native.totalConnectedTriples ?? result.native.deltaTotalConnectedTriples}</strong> · {result.backend} · graph {result.inputGraphRef.graphId} version {result.inputGraphRef.graphVersion}</p>
        <p>Device {result.native.cuda.deviceIndex}: {result.native.cuda.deviceName} · kernel {result.native.cuda.kernelMilliseconds} ms</p>
        {result.mode === "INCREMENTAL" && <p>Update {result.updateRef.updateId} · output version {result.native.outputGraphRef.graphVersion} · affected edges {result.native.oldAffectedEdgeCount} → {result.native.newAffectedEdgeCount} · candidates {result.native.oldCandidateCount} → {result.native.newCandidateCount}. The workspace was not changed.</p>}
        <details><summary>All 30 stable motif {result.mode === "STATIC" ? "counts" : "signed deltas"}</summary>
          <table><thead><tr><th>Class ID</th><th>Group</th><th>{result.mode === "STATIC" ? "Count" : "Delta"}</th></tr></thead><tbody>{HYPERGRAPH_3EDGE_MOTIF_TAXONOMY.entries.map(entry=><tr key={entry.motifId}><td>{entry.motifId}</td><td>{entry.shape}</td><td>{(result.native.counts ?? result.native.deltaCounts)[entry.motifId-1]}</td></tr>)}</tbody></table>
        </details>
        {result.mode === "INCREMENTAL" && <p>Nonzero signed deltas: {result.native.deltaCounts.map((count,index)=>count?`${index+1}: ${count>0?"+":""}${count}`:null).filter(Boolean).join(", ") || "none"}</p>}
      </div>}
      {candy.selectedJob && <dl className="agent-model__details"><div><dt>Selected job</dt><dd>{candy.selectedJob.jobId}</dd></div><div><dt>Status</dt><dd>{candy.selectedJob.status}</dd></div><div><dt>Validation</dt><dd>{candy.selectedJob.validationStatus || "pending"}</dd></div></dl>}
    </details>
  );
}
