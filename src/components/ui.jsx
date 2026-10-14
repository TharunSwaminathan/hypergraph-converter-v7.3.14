import { T } from "../theme.js";

// Presentation only: styling lives in src/studio.css (.hg-pill, .hg-stat, .hg-mapping, .hg-table).

export function Pill({ label, sub, active, onClick, color }) {
  const c = color ?? T.accent;
  return (
    <button type="button" onClick={onClick} aria-pressed={Boolean(active)} className={"hg-pill" + (active ? " is-active" : "")} style={{ "--pill-color": c }}>
      <span className="hg-pill__label">{label}</span>
      {sub && <span className="hg-pill__sub">{sub}</span>}
    </button>
  );
}
export function StatCard({ label, value, color }) {
  // Numbers stay neutral; only yes/no flags carry the semantic colour passed by the caller.
  const flag = value === "yes" || value === "no";
  return (
    <div className="hg-stat">
      <div className="hg-stat__label">{label}</div>
      <div className="hg-stat__value" style={flag ? { color } : undefined}>{value}</div>
    </div>
  );
}
export function MappingBox({ title, color, text, rows, totalRows = rows.length, cols }) {
  const visibleRows = rows;
  const hiddenCount = Math.max(0, totalRows - visibleRows.length);
  return (
    <div className="hg-mapping">
      <div className="hg-mapping__title" style={{ color }}>{title}</div>
      <div className="hg-mapping__frame">
        <div className="hg-mapping__scroll">
          <table className="hg-table">
            <thead>
              <tr>{cols.map(c => (<th key={c}>{c}</th>))}</tr>
            </thead>
            <tbody>{visibleRows.map((row, i) => (<tr key={i}>{row.map((cell, j) => (<td key={j} className={j === 0 ? "hg-table__key" : undefined} style={j === 0 ? { color } : undefined}>{cell}</td>))}</tr>))}</tbody>
          </table>
          {hiddenCount > 0 && <div className="hg-mapping__more">Showing first {visibleRows.length.toLocaleString()} rows. {hiddenCount.toLocaleString()} additional rows are available via export.</div>}
        </div>
        <pre className="hg-mapping__text">{text.slice(0, 300)}{text.length > 300 ? "\n..." : ""}</pre>
      </div>
    </div>
  );
}
