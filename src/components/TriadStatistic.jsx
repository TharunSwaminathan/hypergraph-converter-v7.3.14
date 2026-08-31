import { T } from "../theme.js";
import { DERIVED_STATUS } from "../utils/derivedResults.js";

/** The user-visible numeric/status renderer used by the Stats triad card. */
export default function TriadStatistic({ result }) {
  const computed = result?.status === DERIVED_STATUS.COMPUTED && Number.isFinite(result?.value);
  return computed
    ? <div data-derived-status="computed" style={{ fontSize: 32, fontWeight: 800, color: T.amber, fontFamily: "monospace", marginBottom: 4 }}>{result.value.toLocaleString()}</div>
    : <div data-derived-status={result?.status ?? "invalid"} style={{ fontSize: 13, color: T.textDim, marginBottom: 4 }}>Not computed — {result?.reason ?? "invalid numeric result"}</div>;
}
