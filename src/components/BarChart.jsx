import { T } from "../theme.js";
import { arrayMinMax } from "../utils/numeric.js";

export default function BarChart({ data, color, label }) {
  if (!data?.length) return null;
  const [mn, mx] = arrayMinMax(data);
  const bins = Math.min(20, mx - mn + 1);
  const bw = Math.ceil((mx - mn + 1) / bins), buckets = Array(bins).fill(0);
  data.forEach(v => { const i = Math.min(Math.floor((v - mn) / bw), bins - 1); buckets[i]++; });
  const maxV = Math.max(...buckets);
  return (
    <div>
      <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 6, textTransform: "uppercase", letterSpacing: .6, fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 72 }}>
        {buckets.map((v, i) => (<div key={i} title={(mn + i * bw) + (bw > 1 ? "–" + (mn + i * bw + bw - 1) : "") + " : " + v} style={{ flex: 1, background: color + "BB", borderRadius: "2px 2px 0 0", height: Math.max(2, (v / maxV) * 72) }} />))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.textFaint, marginTop: 2 }}><span>{mn}</span><span>{mx}</span></div>
    </div>
  );
}
