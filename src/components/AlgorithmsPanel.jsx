import { T, PALETTE } from "../theme.js";
import { Pill, StatCard } from "./ui.jsx";
import BarChart from "./BarChart.jsx";

const smallCaps = { fontSize: 11, color: T.textFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 600 };
const monoChip = { padding: "4px 10px", borderRadius: 14, fontSize: 12, fontFamily: "monospace" };

function ConnectedComponentsResult({ result }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <StatCard label="Components" value={result.count} color={T.accent} />
        <StatCard label="Largest" value={result.components[0]?.size ?? 0} color={T.teal} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
        {result.components.map(c => (
          <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.card }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: c.color, marginTop: 3, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "monospace" }}>Component {c.id + 1} · {c.size} vertex{c.size !== 1 ? "es" : ""}</div>
              <div style={{ fontSize: 12, color: T.textDim, fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.6, marginTop: 2 }}>{c.vertices.join(", ")}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TraversalResult({ algo, result }) {
  const step = result.steps?.[algo.animation.stepIndex];
  const visitedSoFar = step ? step.visited : result.visitOrder;
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <StatCard label="Start" value={result.startVertex} color={T.accent} />
        <StatCard label="Reached" value={result.reached} color={T.teal} />
        <StatCard label="Total vertices" value={result.total} color={T.textDim} />
      </div>
      <div style={smallCaps}>
        Visit order {algo.animation.supported ? `(step ${Math.min(algo.animation.stepIndex + 1, visitedSoFar.length)} of ${result.visitOrder.length})` : ""}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 260, overflowY: "auto" }}>
        {result.visitOrder.map((v, i) => {
          const reached = visitedSoFar.includes(v);
          const isCurrent = step ? step.current === v : false;
          return (
            <div key={v} style={{
              ...monoChip,
              border: "1px solid " + (isCurrent ? T.amber : reached ? T.accent : T.border),
              background: isCurrent ? T.amberLt : reached ? T.accentLt : "transparent",
              color: isCurrent ? T.amber : reached ? T.accent : T.textFaint,
              fontWeight: reached ? 700 : 400,
            }}>
              {i + 1}. {v}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShortestPathResult({ algo, result }) {
  const step = result.steps?.[algo.animation.stepIndex];
  const finalizedSoFar = step ? step.visited : [...result.distances.keys()];
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <StatCard label="Start" value={result.startVertex} color={T.accent} />
        <StatCard label="Target" value={result.targetVertex ?? "-"} color={T.teal} />
        <StatCard label="Distance" value={result.reachable ? result.distances.get(result.targetVertex) : "unreachable"} color={result.reachable ? T.green : T.rose} />
        <StatCard label="Hops" value={result.path.length ? result.path.length - 1 : "-"} color={T.textDim} />
      </div>

      {result.warnings.length > 0 && (
        <div style={{ marginBottom: 14, padding: "10px 14px", background: T.amberLt, border: "1px solid " + T.amber + "55", borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: T.amber, fontWeight: 600, marginBottom: 4 }}>Weight warnings</div>
          {result.warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: T.amber, lineHeight: 1.6 }}>Warning: {w}</div>)}
        </div>
      )}

      {result.path.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div style={smallCaps}>Shortest path</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {result.path.map((v, i) => (
              <div key={v} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ padding: "5px 12px", borderRadius: 14, fontSize: 12, fontFamily: "monospace", fontWeight: 700, border: "1px solid " + T.accent, background: T.accentLt, color: T.accent }}>{v}</div>
                {i < result.path.length - 1 && <span style={{ color: T.textFaint }}>→</span>}
              </div>
            ))}
          </div>
        </div>
      ) : result.targetVertex != null && (
        <div style={{ color: T.rose, fontSize: 13, marginBottom: 16 }}>No path exists from {result.startVertex} to {result.targetVertex}.</div>
      )}

      <div style={smallCaps}>Search order (step {Math.min(algo.animation.stepIndex + 1, Math.max(algo.animation.totalSteps, 1))} of {algo.animation.totalSteps})</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 220, overflowY: "auto" }}>
        {[...result.distances.entries()].sort((a, b) => a[1] - b[1]).map(([v, d]) => {
          const finalized = finalizedSoFar.includes(v);
          const isCurrent = step ? step.current === v : false;
          const onPath = result.path.includes(v);
          return (
            <div key={v} style={{
              ...monoChip,
              border: "1px solid " + (isCurrent ? T.amber : onPath ? T.accent : finalized ? T.teal : T.border),
              background: isCurrent ? T.amberLt : onPath ? T.accentLt : finalized ? T.tealLt : "transparent",
              color: isCurrent ? T.amber : onPath ? T.accent : finalized ? T.teal : T.textFaint,
              fontWeight: finalized ? 700 : 400,
            }}>
              {v} <span style={{ opacity: 0.7 }}>({d})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DegreeDistributionResult({ result }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard label="Vertices" value={result.totalVertices} color={T.accent} />
        <StatCard label="Min degree" value={result.min} color={T.textDim} />
        <StatCard label="Max degree" value={result.max} color={T.amber} />
        <StatCard label="Avg degree" value={result.avg} color={T.teal} />
      </div>
      <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <BarChart data={result.degrees} color={T.teal} label="Degree distribution (hyperedges per vertex)" />
      </div>
      <div style={smallCaps}>Vertices by degree, highest first</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
        {result.entries.map(({ vertex, degree }) => (
          <div key={vertex} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", borderRadius: 8, background: T.card, fontFamily: "monospace", fontSize: 13 }}>
            <span style={{ color: T.text, fontWeight: 600 }}>{vertex}</span>
            <span style={{ color: T.teal, fontWeight: 700 }}>{degree}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KCoreResult({ result }) {
  if (result.status === "over_budget") {
    return (
      <div style={{ padding: "12px 14px", background: T.amberLt, border: "1px solid " + T.amber + "55", borderRadius: 9 }}>
        <div style={{ color: T.amber, fontSize: 13, fontWeight: 700, marginBottom: 5 }}>K-core not computed — resource limit reached</div>
        <div style={{ color: T.textDim, fontSize: 12, lineHeight: 1.55 }}>{result.reason}</div>
        <div style={{ color: T.textFaint, fontSize: 11, marginTop: 6, fontFamily: "monospace" }}>Exceeded resource: {result.exceededResource}</div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard label="Degeneracy" value={result.degeneracy} color={T.accent} />
        <StatCard label="Vertices" value={result.coreness.size} color={T.textDim} />
        <StatCard label="K-shell groups" value={result.cores.length} color={T.teal} />
      </div>
      <div style={smallCaps}>Exact coreness groups (k-shells), highest first</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
        {result.cores.map(core => {
          const color = PALETTE[Math.min(core.k, PALETTE.length - 1)];
          return (
            <div key={core.k} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.card }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: color, marginTop: 3, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "monospace" }}>coreness {core.k} shell · {core.size} vertex{core.size !== 1 ? "es" : ""}</div>
                <div style={{ fontSize: 12, color: T.textDim, fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.6, marginTop: 2 }}>{core.vertices.join(", ")}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultsPanel({ algo }) {
  const { algorithmId, result, error } = algo;
  if (error) return <div style={{ fontSize: 13, color: T.rose, padding: "12px 0" }}>Warning: {error}</div>;
  if (!result) return <div style={{ color: T.textFaint, fontSize: 13, textAlign: "center", padding: "28px 0" }}>Choose an algorithm and click Run.</div>;

  switch (algorithmId) {
    case "connected_components": return <ConnectedComponentsResult result={result} />;
    case "bfs":
    case "dfs": return <TraversalResult algo={algo} result={result} />;
    case "shortest_path": return <ShortestPathResult algo={algo} result={result} />;
    case "degree_distribution": return <DegreeDistributionResult result={result} />;
    case "k_core": return <KCoreResult result={result} />;
    default: return null;
  }
}

export default function AlgorithmsPanel({ algo }) {
  const { algorithms, algorithm, algorithmId, selectAlgorithm, vertices, startVertex, setStartVertex, targetVertex, setTargetVertex, run, animation } = algo;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 4, height: 22, background: T.accent, borderRadius: 2 }} />
        <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Algorithms</span>
      </div>

      <div style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 14, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 12, color: T.textFaint, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10, fontWeight: 700 }}>Choose an algorithm</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {algorithms.map(a => (
            <Pill key={a.id} label={a.label} sub={a.sub} active={algorithmId === a.id} onClick={() => selectAlgorithm(a.id)} color={T.accent} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
          {algorithm?.needsStartVertex && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.textDim }}>
              Start vertex
              <select value={startVertex ?? ""} onChange={e => setStartVertex(e.target.value)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid " + T.border, fontSize: 13, fontFamily: "monospace", background: T.surface, color: T.text, outline: "none" }}>
                {vertices.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          )}
          {algorithm?.needsTargetVertex && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.textDim }}>
              Target vertex
              <select value={targetVertex ?? ""} onChange={e => setTargetVertex(e.target.value)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid " + T.border, fontSize: 13, fontFamily: "monospace", background: T.surface, color: T.text, outline: "none" }}>
                {vertices.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          )}
          <button onClick={run} style={{ padding: "9px 24px", borderRadius: 8, background: T.accent, border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Run
          </button>

          {animation.supported && algo.result && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
              <button onClick={animation.stepBack} disabled={animation.stepIndex === 0} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid " + T.border, background: "transparent", color: T.textDim, fontSize: 13, cursor: animation.stepIndex === 0 ? "not-allowed" : "pointer" }}>step back</button>
              {animation.isPlaying ? (
                <button onClick={animation.pause} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid " + T.amber, background: T.amberLt, color: T.amber, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Pause</button>
              ) : (
                <button onClick={animation.play} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid " + T.green, background: T.greenLt, color: T.green, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Animate</button>
              )}
              <button onClick={animation.stepForward} disabled={animation.stepIndex >= animation.totalSteps - 1} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid " + T.border, background: "transparent", color: T.textDim, fontSize: 13, cursor: animation.stepIndex >= animation.totalSteps - 1 ? "not-allowed" : "pointer" }}>step forward</button>
            </div>
          )}
        </div>

        <ResultsPanel algo={algo} />
      </div>
    </div>
  );
}
