import { T } from "../theme.js";
import { HYPERGRAPH_3EDGE_MOTIF_TAXONOMY } from "../candy/hypergraphMotifs/taxonomy.js";

const GROUPS = ["OPEN_WEDGE", "CLOSED_TRIANGLE"];

export default function CandyMotifResult({ result, compact = false }) {
  if (!result?.native) return null;
  const incremental = result.mode === "INCREMENTAL";
  const values = incremental ? result.native.deltaCounts : result.native.counts;
  const total = incremental ? result.native.deltaTotalConnectedTriples : result.native.totalConnectedTriples;
  const graphRef = result.inputGraphRef ?? result.native.inputGraphRef;
  const backend = result.backend ?? result.native.backend;
  const cuda = result.native.cuda ?? {};

  return (
    <div aria-label={incremental ? "Validated hypergraph motif delta" : "Validated hypergraph motif result"} style={{ marginTop: 14, border: "1px solid " + T.border, borderRadius: 10, padding: compact ? 12 : 16, background: T.surface }}>
      <div style={{ fontSize: 12, color: T.textFaint, textTransform: "uppercase", letterSpacing: .7, fontWeight: 700 }}>{incremental ? "Motif change (delta only)" : "Validated static result"}</div>
      <p style={{ margin: "8px 0", color: T.text }}>
        {incremental ? "Signed total connected 3-edge motif delta" : "Total connected 3-edge motifs"}: <strong>{Number(total ?? 0).toLocaleString()}</strong>
      </p>
      <p style={{ margin: "6px 0", fontSize: 12, color: T.textDim }}>
        Backend <strong>{backend}</strong> · graph <code>{graphRef?.graphId ?? "unknown"}</code> version <strong>{graphRef?.graphVersion ?? "unknown"}</strong>
      </p>
      <p style={{ margin: "6px 0", fontSize: 12, color: T.textDim }}>
        Device {cuda.deviceIndex ?? "?"}: {cuda.deviceName ?? "qualified CUDA device"}{cuda.compiledArchitecture ? ` · ${cuda.compiledArchitecture}` : ""}
      </p>
      {incremental && <p style={{ margin: "8px 0", fontSize: 12, color: T.amber }}>
        This is a signed delta for update <code>{result.updateRef?.updateId ?? "unknown"}</code>. It is not a fabricated full count, and the update was not applied.
      </p>}
      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, color: T.accent }}>All 30 stable motif {incremental ? "signed deltas" : "class counts"}</summary>
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr><th style={cellStyle}>Class ID</th><th style={cellStyle}>Structural group</th><th style={cellStyle}>{incremental ? "Delta" : "Count"}</th></tr></thead>
            {GROUPS.map(group => <tbody key={group}>
              <tr><th colSpan={3} style={{ ...cellStyle, textAlign: "left", background: T.card, color: group === "OPEN_WEDGE" ? T.teal : T.purple }}>{group}</th></tr>
              {HYPERGRAPH_3EDGE_MOTIF_TAXONOMY.entries.filter(entry => entry.shape === group).map(entry => <tr key={entry.motifId}>
                <td style={cellStyle}>{entry.motifId}</td><td style={cellStyle}>{entry.shape}</td><td style={cellStyle}>{values?.[entry.motifId - 1] ?? 0}</td>
              </tr>)}
            </tbody>)}
          </table>
        </div>
      </details>
    </div>
  );
}

const cellStyle = { borderBottom: "1px solid " + T.border, padding: "6px 8px", textAlign: "right" };
