import { useState } from "react";

function statusClass(status) {
  if (status === "ok" || status === "connected") return "agent-runtime-diag__status--ok";
  if (status === "warning" || status === "connecting") return "agent-runtime-diag__status--warning";
  if (status === "failed" || status === "error") return "agent-runtime-diag__status--failed";
  return "agent-runtime-diag__status--idle";
}

function Field({ label, value }) {
  return (
    <div className="agent-runtime-diag__field">
      <span>{label}</span>
      <strong title={String(value ?? "")}>{value || "—"}</strong>
    </div>
  );
}

function StatusRow({ label, item }) {
  const status = item?.status ?? "not_tested";
  return (
    <div className="agent-runtime-diag__status-row">
      <span>{label}</span>
      <strong className={statusClass(status)}>{status.replaceAll("_", " ")}</strong>
      <em title={item?.message ?? ""}>{item?.message ?? "Not tested."}</em>
    </div>
  );
}

export default function LocalRuntimeDiagnosticsPanel({
  localModel,
  agentActions,
  busy,
  pendingAction,
  onNotice,
}) {
  const [showHelp, setShowHelp] = useState(false);
  const diagnostics = localModel?.diagnostics ?? {};
  const deployment = diagnostics.deploymentInfo ?? {};
  const commands = diagnostics.commands ?? {};
  const lastProbe = localModel?.lastProbe ?? null;
  const disabled = busy || Boolean(pendingAction) || localModel?.diagnosticsBusy;

  async function run(mode, label) {
    const result = await agentActions.runLocalRuntimeDiagnostics(mode);
    const text = result.ok
      ? `${label}: ${result.message}`
      : `${label} failed: ${result.suggestedFix || result.error || result.message || "See diagnostics."}`;
    onNotice?.(text, result.ok ? "status" : "error");
  }

  async function copy(kind) {
    const result = await agentActions.copyRuntimeDiagnosticCommand(kind);
    if (result.ok) onNotice?.(result.message, "status");
    else onNotice?.(`${result.error}${result.text ? `\n\n${result.text}` : ""}`, "warning");
  }

  function showSetupHelp() {
    const result = agentActions.getGitHubPagesRuntimeHelp();
    setShowHelp(current => !current);
    onNotice?.(result.message || "Open README.md for GitHub Pages + local Ollama setup.", "status");
  }

  return (
    <div className="agent-runtime-diag" aria-label="Local Runtime Diagnostics">
      <div className="agent-runtime-diag__header">
        <div>
          <span className="agent-runtime-diag__title">Local Runtime Diagnostics</span>
          <span className={`agent-runtime-diag__pill ${statusClass(diagnostics.overallStatus)}`}>
            {diagnostics.overallStatus?.replaceAll("_", " ") || "not tested"}
          </span>
        </div>
        <span>{diagnostics.ranAt ? new Date(diagnostics.ranAt).toLocaleTimeString() : "not run yet"}</span>
      </div>

      <div className="agent-runtime-diag__grid">
        <Field label="Runtime" value="Ollama" />
        <Field label="Model" value={diagnostics.selectedModel ?? localModel?.config?.model} />
        <Field label="Status" value={localModel?.status ?? "disconnected"} />
        <Field label="Connection method" value={diagnostics.activeTransportLabel ?? "None"} />
        <Field label="Active endpoint" value={diagnostics.activeEndpoint ?? localModel?.config?.activeBaseUrl} />
        <Field label="Current page origin" value={deployment.origin} />
        <Field label="Protocol" value={deployment.protocol} />
        <Field label="Hostname" value={deployment.hostname} />
        <Field label="Deployment mode" value={deployment.mode} />
      </div>

      <div className="agent-runtime-diag__statuses">
        <StatusRow label="Direct Ollama" item={diagnostics.directRuntimeReachability} />
        <StatusRow label="Local bridge" item={diagnostics.bridgeReachability} />
        <StatusRow label="Model listing" item={diagnostics.modelListingStatus} />
        <StatusRow label="Structured generation" item={diagnostics.generationStatus} />
        <StatusRow label="Graph planner" item={diagnostics.plannerReadiness} />
      </div>

      <div className="agent-runtime-diag__result">
        <span>Last connection error classification</span>
        <strong>{diagnostics.lastConnectionErrorClassification || "—"}</strong>
      </div>
      <div className="agent-runtime-diag__fix">
        <span>Suggested fix</span>
        <p>{diagnostics.suggestedFix || deployment.message || "Run diagnostics to get an actionable fix."}</p>
      </div>

      {lastProbe && (
        <div className="agent-runtime-diag__fix" aria-label="Last isolated runtime probe">
          <span>Last isolated probe · {lastProbe.mode?.replaceAll("-", " ") || "runtime probe"}</span>
          <p>
            <strong className={statusClass(lastProbe.overallStatus)}>{lastProbe.overallStatus?.replaceAll("_", " ")}</strong>
            {` · ${lastProbe.activeTransportLabel || lastProbe.mode || "probe"} · ${lastProbe.baseUrl || lastProbe.activeEndpoint || "unknown endpoint"}`}
            {lastProbe.summary ? ` — ${lastProbe.summary}` : ""}
          </p>
          <small>This probe is read-only and does not change the selected model, active connection method, active endpoint, or connection status.</small>
        </div>
      )}

      <div className="agent-runtime-diag__actions">
        <button type="button" onClick={() => run("current", "Full diagnostics")} disabled={disabled}>Run full diagnostics</button>
        <button type="button" onClick={() => run("current", "Reconnect")} disabled={disabled}>Reconnect</button>
        <button type="button" onClick={() => run("direct-ollama", "Direct Ollama probe")} disabled={disabled}>Test direct Ollama</button>
        <button type="button" onClick={() => run("bridge", "Local bridge probe")} disabled={disabled}>Test local bridge</button>
        <button type="button" onClick={() => run("generation", "Simple generation test")} disabled={disabled || localModel?.config?.enabled === false}>Test simple generation</button>
        <button type="button" onClick={() => run("graph-planner", "Graph planner readiness")} disabled={disabled || localModel?.config?.enabled === false}>Test graph planner</button>
      </div>

      <div className="agent-runtime-diag__actions agent-runtime-diag__actions--secondary">
        <button type="button" onClick={() => copy("browserFetch")} disabled={disabled || !commands.browserFetch}>Copy browser fetch test</button>
        <button type="button" onClick={() => copy("powershellCurl")} disabled={disabled || !commands.powershellCurl}>Copy PowerShell curl test</button>
        <button type="button" onClick={() => copy("wslCurl")} disabled={disabled || !commands.wslCurl}>Copy WSL curl test</button>
        <button type="button" onClick={() => copy("ollamaOrigins")} disabled={disabled || !commands.ollamaOrigins}>Copy Ollama origin setup command</button>
        <button type="button" onClick={() => copy("diagnosticReport")} disabled={disabled || !commands.diagnosticReport}>Copy diagnostic report</button>
        <button type="button" onClick={showSetupHelp} disabled={disabled}>Show GitHub Pages setup help</button>
      </div>

      {showHelp && (
        <pre className="agent-runtime-diag__help">{commands.githubPagesSetupHelp || commands.diagnosticReport}</pre>
      )}
    </div>
  );
}

