import { T, inputSt } from "../theme.js";

// Batch updates are edits to the graph that's already on screen, not a new
// input format. They are previewed first, then explicitly committed or
// discarded, so the committed graph and the temporary overlay stay separate.
export default function AdvancedOptionsPanel({
  batchText,
  setBatchText,
  batchPreviewActive,
  onPreviewBatch,
  onCommitBatch,
  onDiscardBatch,
  batchParsedCount,
  batchUnknownCount,
  batchWarnings,
  hasGraph,
  exampleText,
}) {
  const disabled = !hasGraph || batchParsedCount === 0;
  return (
    <div style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 14, padding: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ width: 4, height: 22, background: T.amber, borderRadius: 2 }} />
        <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Advanced Options</span>
        <span style={{ fontSize: 12, color: T.textFaint, fontFamily: "monospace" }}>batch updates</span>
      </div>
      <div style={{ fontSize: 13, color: T.textDim, marginBottom: 16, lineHeight: 1.6 }}>
        Edit the graph that's already loaded above. Preview shows a temporary overlay; Commit writes it to the graph, and Discard returns to the committed graph.
      </div>

      <div style={{ fontSize: 13, color: T.textDim, marginBottom: 10, padding: "10px 14px", background: T.card, borderRadius: 8, border: "1px solid " + T.border, lineHeight: 1.8 }}>
        <strong>Supported commands</strong><br />
        <code>ADD_HYPEREDGE h5: A, B, C</code> · <code>REMOVE_HYPEREDGE h2</code><br />
        <code>ADD_VERTEX h1: D</code> · <code>REMOVE_VERTEX h3: A</code><br />
        <code>UPDATE_WEIGHT h4: 2.5</code> · <code>UPDATE_TIME h4: 2027</code> · <code>SET_ATTR h1: priority=high</code><br />
        {!hasGraph && <span style={{ color: T.amber }}>Convert a base dataset first, then preview or commit batch changes.</span>}
      </div>

      <textarea
        rows={7}
        value={batchText}
        onChange={e => setBatchText(e.target.value)}
        placeholder={exampleText}
        style={inputSt}
      />

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onPreviewBatch}
          disabled={disabled || batchPreviewActive}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid " + T.border, background: batchPreviewActive ? T.card : T.accent, color: batchPreviewActive ? T.textFaint : "#fff", fontWeight: 700, fontSize: 13, cursor: disabled || batchPreviewActive ? "not-allowed" : "pointer" }}
        >
          Preview Batch Changes
        </button>
        <button
          type="button"
          onClick={onCommitBatch}
          disabled={disabled}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid " + T.amber + "55", background: T.amberLt, color: T.amber, fontWeight: 700, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer" }}
        >
          Commit Batch Changes
        </button>
        <button
          type="button"
          onClick={onDiscardBatch}
          disabled={!batchPreviewActive}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid " + T.border, background: "transparent", color: batchPreviewActive ? T.textDim : T.textFaint, fontWeight: 600, fontSize: 13, cursor: batchPreviewActive ? "pointer" : "not-allowed" }}
        >
          Discard Preview
        </button>
        <span style={{ fontSize: 13, color: batchPreviewActive ? T.amber : T.textDim, fontWeight: batchPreviewActive ? 700 : 400 }}>
          {batchPreviewActive ? "Preview active — conversational graph edits are paused until commit/discard." : "No batch preview active."}
        </span>
        {batchParsedCount > 0 && (
          <span style={{ fontSize: 13, color: T.textDim }}>
            {batchParsedCount} command{batchParsedCount !== 1 ? "s" : ""} parsed
            {batchUnknownCount > 0 ? <span style={{ color: T.amber }}> · {batchUnknownCount} unknown</span> : ""}
          </span>
        )}
      </div>

      {batchWarnings.length > 0 && batchPreviewActive && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: T.amberLt, border: "1px solid " + T.amber + "55", borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: T.amber, fontWeight: 600, marginBottom: 6 }}>Batch preview warnings</div>
          {batchWarnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: T.amber, lineHeight: 1.6 }}>⚠ {w}</div>)}
        </div>
      )}
    </div>
  );
}
