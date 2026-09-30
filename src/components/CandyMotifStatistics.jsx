import { T } from "../theme.js";
import { motifStatisticsAvailability } from "../candy/motifStatisticsAvailability.js";
import CandyMotifResult from "./CandyMotifResult.jsx";

export default function CandyMotifStatistics({ candy, onRequestStaticMotif, requestPending = false }) {
  const availability = motifStatisticsAvailability(candy);
  const result = candy?.selectedMotifResult;
  const resultGraphRef = result?.inputGraphRef ?? result?.native?.inputGraphRef;
  const resultIsCurrent = Boolean(result)
    && (!Object.hasOwn(candy, "resultEvidence") || Boolean(candy.resultEvidence))
    && resultGraphRef?.graphId === candy?.graphId
    && Number(resultGraphRef?.graphVersion) === Number(candy?.graphVersion);

  const requestStatic = () => {
    if (!availability.ready || requestPending) return;
    onRequestStaticMotif?.({
      mode: "STATIC",
      backend: "CUDA_STATIC",
      deviceId: availability.capability.devices[0].id,
      timeoutMs: 5000,
    });
  };

  return (
    <section aria-labelledby="hypergraph-motif-statistics-title" style={{ marginTop: 18, background: T.surface, border: "1px solid " + T.border, borderRadius: 12, padding: 18, boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", gap: 16, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ maxWidth: 720 }}>
          <h3 id="hypergraph-motif-statistics-title" style={{ margin: 0, color: T.text, fontSize: 17 }}>Hypergraph 3-Edge Motifs</h3>
          <p style={{ margin: "7px 0", color: T.textDim, fontSize: 13 }}>Independent CANDY product: 30 structural motif classes, grouped into 6 OPEN_WEDGE and 24 CLOSED_TRIANGLE classes.</p>
          <p style={{ margin: "7px 0", color: T.textFaint, fontSize: 12 }}><strong>Distinct from Line-Graph Triangles.</strong> This section uses the qualified authenticated Runtime and never projects the graph, selects CPU fallback, or applies an update.</p>
        </div>
        <button type="button" disabled={!availability.ready || requestPending} onClick={requestStatic} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid " + (availability.ready ? T.accent : T.border), background: availability.ready ? T.accentLt : T.card, color: availability.ready ? T.accent : T.textFaint, fontWeight: 700, cursor: availability.ready && !requestPending ? "pointer" : "not-allowed" }}>
          {requestPending ? "Request staged…" : "Compute 3-edge motifs"}
        </button>
      </div>
      <p role="status" style={{ margin: "10px 0 0", color: availability.ready ? T.teal : T.textDim, fontSize: 12 }}>{availability.reason ? availability.reason + ": " : ""}{availability.message}</p>
      {result && !resultIsCurrent && <p role="status" style={{ color: T.amber, fontSize: 12 }}>A previous motif result was cleared from this view because it does not match the active graph identity/version.</p>}
      {resultIsCurrent && <CandyMotifResult result={result} compact />}
    </section>
  );
}
