import { T } from "../theme.js";

export function Pill({ label, sub, active, onClick, color }) {
  const c = color ?? T.accent;
  return (
    <button onClick={onClick} style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid", textAlign: "left", borderColor: active ? c : T.border, background: active ? c + "18" : "transparent", color: active ? c : T.textDim, fontSize: 14, fontWeight: active ? 700 : 400, cursor: "pointer", transition: "all .15s" }}>
      <div style={{ fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: active ? c + "99" : T.textFaint, marginTop: 2 }}>{sub}</div>}
    </button>
  );
}
export function StatCard({ label, value, color }) {
  return (
    <div style={{ padding: "16px 20px", background: T.surface, border: "1px solid " + T.border, borderRadius: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize: 11, color: T.textFaint, textTransform: "uppercase", letterSpacing: .8, marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
    </div>
  );
}
export function MappingBox({ title, color, text, rows, cols }) {
  const visibleRows = rows.slice(0, 500);
  const hiddenCount = Math.max(0, rows.length - visibleRows.length);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color, marginBottom: 8, fontFamily: "monospace" }}>{title}</div>
      <div style={{ border: "1px solid " + T.border, borderRadius: 10, overflow: "hidden", flex: 1 }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 220 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "monospace" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr>{cols.map(c => (<th key={c} style={{ textAlign: "left", padding: "8px 12px", background: T.card, color: T.textDim, fontWeight: 600, fontSize: 11, letterSpacing: .5, textTransform: "uppercase", borderBottom: "1px solid " + T.border, whiteSpace: "nowrap" }}>{c}</th>))}</tr>
            </thead>
            <tbody>{visibleRows.map((row, i) => (<tr key={i} style={{ background: i % 2 ? T.card : T.surface }}>{row.map((cell, j) => (<td key={j} style={{ padding: "7px 12px", color: j === 0 ? color : T.text, fontWeight: j === 0 ? 700 : 400, borderBottom: "1px solid " + T.border + "44", maxWidth: 300, wordBreak: "break-all", lineHeight: 1.5 }}>{cell}</td>))}</tr>))}</tbody>
          </table>
          {hiddenCount > 0 && <div style={{ padding: "8px 12px", fontSize: 12, color: T.textFaint, background: T.surface }}>Showing first {visibleRows.length.toLocaleString()} rows. {hiddenCount.toLocaleString()} additional rows are available via export.</div>}
        </div>
        <div style={{ borderTop: "1px solid " + T.border, padding: "10px 12px", background: T.card }}>
          <pre style={{ margin: 0, fontSize: 12, fontFamily: "monospace", color, whiteSpace: "pre-wrap", maxHeight: 60, overflowY: "auto", lineHeight: 1.6 }}>{text.slice(0, 300)}{text.length > 300 ? "\n..." : ""}</pre>
        </div>
      </div>
    </div>
  );
}
