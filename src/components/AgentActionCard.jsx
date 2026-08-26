export default function AgentActionCard({ action, busy, onConfirm, onCancel }) {
  const preview = action.preview;
  const operations = action.plan?.operations ?? [];
  return (
    <div className="agent-confirmation" role="alert">
      <div className="agent-confirmation__eyebrow">Confirmation required</div>
      <div className="agent-confirmation__title">{action.title}</div>
      <div className="agent-confirmation__message">{action.message}</div>
      {preview && (
        <div className="agent-confirmation__preview">
          <div><strong>Preview:</strong> {preview.graphChanged === false ? "no graph-content change" : `${preview.before?.hyperedges ?? "?"} → ${preview.after?.hyperedges ?? "?"} hyperedges`}</div>
          {preview.after && <div>{preview.after.vertices} vertices · {preview.after.incidences} incidences after this action</div>}
          {operations.length > 0 && <div className="agent-confirmation__ops">{operations.slice(0, 6).map(op => op.type).join(", ")}{operations.length > 6 ? "…" : ""}</div>}
          {preview.warnings?.length > 0 && <div className="agent-confirmation__warning">{preview.warnings.slice(0, 3).join(" ")}</div>}
        </div>
      )}
      <div className="agent-confirmation__actions">
        <button type="button" className="agent-button agent-button--danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : "Confirm"}
        </button>
        <button type="button" className="agent-button agent-button--ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
