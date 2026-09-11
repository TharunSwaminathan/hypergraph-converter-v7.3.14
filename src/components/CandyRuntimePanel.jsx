import { useState } from "react";

export default function CandyRuntimePanel({ candy, actions, busy = false, onNotice = () => {} }) {
  const [credential, setCredential] = useState("");
  if (!candy?.featureEnabled) return (
    <details className="agent-candy-runtime">
      <summary>CANDY Runtime Companion <span>browser-only mode</span></summary>
      <p>Native CANDY integration is disabled. The existing Studio remains fully functional. Set <code>VITE_CANDY_RUNTIME_ENABLED=true</code> at build time to enable local companion discovery.</p>
    </details>
  );
  const discover = async () => {
    if (credential.trim()) actions.pairCandyRuntime(credential.trim());
    const result = await actions.discoverCandyRuntime();
    onNotice(result.ok ? `CANDY companion discovered (${result.intersection.status}).` : result.error, result.ok ? "status" : "warning");
    setCredential("");
  };
  return (
    <details className="agent-candy-runtime" open>
      <summary>CANDY Runtime Companion <span>{candy.status}</span></summary>
      <p>Optional authenticated loopback execution for qualified OpenMP SSSP. CORS is not used as authentication.</p>
      <dl className="agent-model__details">
        <div><dt>Endpoint</dt><dd>{candy.baseUrl}</dd></div>
        <div><dt>Runtime</dt><dd>{candy.runtimeVersion ?? "not discovered"}</dd></div>
        <div><dt>Pairing</dt><dd>{candy.authorized ? "paired for this browser session" : "not paired"}</dd></div>
        <div><dt>Capabilities</dt><dd>{candy.capabilityStatus}</dd></div>
        <div><dt>Active graph type</dt><dd>{candy.graphType ?? "unknown"}</dd></div>
      </dl>
      <label>Session pairing credential
        <input type="password" autoComplete="off" value={credential} onChange={event => setCredential(event.target.value)} placeholder="Not saved to chat or persistent memory" />
      </label>
      <div className="agent-file-actions">
        <button type="button" disabled={busy} onClick={discover}>Pair and discover</button>
        <button type="button" disabled={busy || !candy.authorized} onClick={() => { actions.pairCandyRuntime(""); onNotice("CANDY pairing cleared for this browser session.", "status"); }}>Clear pairing</button>
      </div>
      {candy.lastError && <p className="agent-candy-runtime__error"><strong>{candy.lastError.classification}:</strong> {candy.lastError.message}</p>}
      {candy.graphType === "Hypergraph" && <p>No SSSP tool is exposed for this graph. The companion will not implicitly project a hypergraph.</p>}
      {candy.selectedJob && <dl className="agent-model__details"><div><dt>Selected job</dt><dd>{candy.selectedJob.jobId}</dd></div><div><dt>Status</dt><dd>{candy.selectedJob.status}</dd></div><div><dt>Validation</dt><dd>{candy.selectedJob.validationStatus || "pending"}</dd></div></dl>}
    </details>
  );
}
