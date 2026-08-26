import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { T, PALETTE } from "../theme.js";
import { vcmp } from "../utils/parsers.js";
import { arrayMax } from "../utils/numeric.js";
import { buildV2VBounded, DERIVED_STATUS } from "../utils/mappings.js";

export default function Viz({
  hyperedges,
  vizLimit,
  setVizLimit,
  algoHighlight,
  componentColors,
  controlledViewMode,
  onViewModeChange,
  controlledLayout,
  onLayoutChange,
  controlledSearch,
  onSearchChange,
  resetSignal = 0,
  reheatSignal = 0,
  exportPngSignal = 0,
  onSelectionChange,
}) {
  const canvasRef = useRef(null); const stateRef = useRef(null); const animRef = useRef(null);
  const lastResetSignalRef = useRef(resetSignal);
  const lastReheatSignalRef = useRef(reheatSignal);
  const lastExportPngSignalRef = useRef(exportPngSignal);
  const [info, setInfo] = useState(null);
  const [selHE, setSelHE] = useState(null); const [selV, setSelV] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [internalSearch, setInternalSearch] = useState("");
  const [internalLayout, setInternalLayout] = useState("force");
  const [internalViewMode, setInternalViewMode] = useState("hypergraph"); // "hypergraph" | "linegraph"
  const search = controlledSearch ?? internalSearch;
  const layout = controlledLayout ?? internalLayout;
  const viewMode = controlledViewMode ?? internalViewMode;
  const setSearchValue = useCallback(value => {
    if (controlledSearch === undefined) setInternalSearch(value);
    onSearchChange?.(value);
  }, [controlledSearch, onSearchChange]);
  const setLayoutValue = useCallback(value => {
    if (controlledLayout === undefined) setInternalLayout(value);
    onLayoutChange?.(value);
  }, [controlledLayout, onLayoutChange]);
  const setViewModeValue = useCallback(value => {
    if (controlledViewMode === undefined) setInternalViewMode(value);
    onViewModeChange?.(value);
  }, [controlledViewMode, onViewModeChange]);

  const he = useMemo(() => hyperedges.slice(0, vizLimit), [hyperedges, vizLimit]);
  const verts = useMemo(() => [...new Set(he.flatMap(h => h.vertices))], [he]);
  // v2v edges for line graph mode
  const v2vProjection = useMemo(() => viewMode === "linegraph" ? buildV2VBounded(he) : { status: DERIVED_STATUS.NOT_REQUESTED, edges: [], reason: "Hypergraph view does not require V2V clique edges." }, [he, viewMode]);
  const v2vEdges = useMemo(() => v2vProjection.status === DERIVED_STATUS.COMPUTED ? v2vProjection.edges.map(edge => ({ u: edge.src, v: edge.dst })) : [], [v2vProjection]);
  const searchHit = useMemo(() => { if (!search.trim()) return null; const q = search.trim().toLowerCase(); return verts.find(v => String(v).toLowerCase() === q) || verts.find(v => String(v).toLowerCase().includes(q)) || null; }, [search, verts]);

  const initPos = useCallback((W, H) => {
    const nodes = {};
    if (layout === "circular") {
      verts.forEach((v, i) => { const a = (i / verts.length) * 2 * Math.PI - Math.PI / 2, r = Math.min(W, H) * 0.44; nodes[v] = { id: v, x: W / 2 + r * Math.cos(a), y: H / 2 + r * Math.sin(a), vx: 0, vy: 0 }; });
    } else if (layout === "grid") {
      // Proper grid layout: sqrt(n) columns
      const cols = Math.max(2, Math.ceil(Math.sqrt(verts.length)));
      const rows = Math.ceil(verts.length / cols);
      const cw = (W - 80) / cols, rh = (H - 80) / rows;
      verts.forEach((v, i) => { const col = i % cols, row = Math.floor(i / cols); nodes[v] = { id: v, x: 40 + cw * col + cw / 2, y: 40 + rh * row + rh / 2, vx: 0, vy: 0 }; });
    } else {
      // force — start on a circle with jitter
      verts.forEach((v, i) => { const a = (i / verts.length) * 2 * Math.PI, r = Math.min(W, H) * 0.42; nodes[v] = { id: v, x: W / 2 + r * Math.cos(a) + (Math.random() - .5) * 60, y: H / 2 + r * Math.sin(a) + (Math.random() - .5) * 60, vx: 0, vy: 0 }; });
    }
    return nodes;
  }, [layout, verts]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const DPR = window.devicePixelRatio || 1, W = canvas.offsetWidth, H = 520;
    canvas.width = W * DPR; canvas.height = H * DPR; canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d"); ctx.scale(DPR, DPR);
    // Merge into the existing simulation rather than rebuilding it from
    // scratch on every data change. A batch update (add/remove a vertex or
    // hyperedge) should nudge the existing visualization, not replace it:
    // vertices that were already on the canvas keep their position, and
    // the user's current pan/zoom is left alone. A full re-init only
    // happens on first mount or when the person explicitly picks a
    // different layout.
    const prev = stateRef.current;
    const isFreshLayout = !prev || prev.layoutKind !== layout;
    const placed = initPos(W, H); // candidate positions, used only for vertices with no prior position
    const nodes = isFreshLayout ? placed : {};
    if (!isFreshLayout) {
      verts.forEach(v => { nodes[v] = prev.nodes[v] ?? placed[v]; });
    }

    stateRef.current = {
      nodes,
      transform: prev?.transform ?? { x: 0, y: 0, s: 1 },
      drag: null,
      pan: null,
      // A brand-new layout gets the full force reheat; merging new/removed
      // vertices into an existing layout only needs a gentle simmer so new
      // nodes settle in without violently reshuffling everything else.
      alpha: isFreshLayout ? (layout === "force" ? 1.0 : 0.0) : (layout === "force" ? 0.3 : 0.0),
      layoutKind: layout,
    };
    let live = true;

    function draw() {
      if (!live || !stateRef.current) return;
      const s = stateRef.current, t = s.transform, ns = s.nodes;
      // Force simulation (only in force layout)
      if (s.alpha > 0.001 && layout === "force" && verts.length <= 700) {
        const A = s.alpha, arr = Object.values(ns);
        for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) { const a = arr[i], b = arr[j]; const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy || 1, d = Math.sqrt(d2), f = 4000 / d2 * A; a.vx -= f * dx / d; a.vy -= f * dy / d; b.vx += f * dx / d; b.vy += f * dy / d; }
        v2vEdges.forEach(({ u, v }) => { const a = ns[u], b = ns[v]; if (!a || !b) return; const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, f = (d - 90) * 0.03 * A; a.vx += f * dx / d; a.vy += f * dy / d; b.vx -= f * dx / d; b.vy -= f * dy / d; });
        arr.forEach(n => { if (s.drag?.id === n.id) return; n.vx += (W / 2 - n.x) * 0.005 * A; n.vy += (H / 2 - n.y) * 0.005 * A; n.vx *= 0.75; n.vy *= 0.75; n.x += n.vx; n.y += n.vy; n.x = Math.max(24, Math.min(W - 24, n.x)); n.y = Math.max(24, Math.min(H - 24, n.y)); });
        s.alpha *= 0.993;
      }

      ctx.clearRect(0, 0, W, H);
      ctx.save(); ctx.translate(t.x, t.y); ctx.scale(t.s, t.s);

      const selHeObj = selHE != null ? he.find(h => h.id === selHE) : null;
      const hiVerts = new Set((selHeObj ? selHeObj.vertices : (selV != null ? [selV] : searchHit != null ? [searchHit] : [])).map(String));
      const hiHEs = selV != null ? new Set(he.filter(h => h.vertices.map(String).includes(String(selV))).map(h => h.id))
        : searchHit != null ? new Set(he.filter(h => h.vertices.map(String).includes(String(searchHit))).map(h => h.id))
          : selHE != null ? new Set([selHE]) : new Set();
      const anySelect = selHE != null || selV != null || searchHit != null;

      if (viewMode === "hypergraph") {
        // Draw hyperedge ellipses
        he.forEach((h, i) => {
          const pts = h.vertices.map(v => ns[v]).filter(Boolean); if (!pts.length) return;
          const color = PALETTE[i % PALETTE.length];
          const selected = hiHEs.has(h.id), dimmed = anySelect && !selected;
          const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
          const rx = Math.max(28, arrayMax(pts.map(p => Math.abs(p.x - cx))) + 28);
          const ry = Math.max(28, arrayMax(pts.map(p => Math.abs(p.y - cy))) + 28);
          ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
          ctx.fillStyle = color + (dimmed ? "08" : selected ? "22" : "12"); ctx.fill();
          ctx.strokeStyle = color + (dimmed ? "22" : selected ? "EE" : "66");
          ctx.lineWidth = selected ? 2.5 : 1.5; ctx.setLineDash(selected ? [] : [6, 4]); ctx.stroke(); ctx.setLineDash([]);
          ctx.save(); ctx.font = selected ? "bold 12px system-ui" : "11px system-ui";
          ctx.fillStyle = color + (dimmed ? "44" : selected ? "FF" : "BB"); ctx.textAlign = "center";
          ctx.fillText(h.id + (h.time != null ? " [t=" + h.time + "]" : ""), cx, cy - ry + 16); ctx.restore();
        });
      }

      // Draw edges (always shown; in linegraph mode this IS the graph)
      v2vEdges.forEach(({ u, v }) => {
        const a = ns[u], b = ns[v]; if (!a || !b) return;
        const hi = hiVerts.has(String(u)) && hiVerts.has(String(v)), dim = anySelect && !hi;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = hi ? "rgba(79,62,232,0.85)" : "rgba(60,60,100," + (dim ? "0.05" : viewMode === "linegraph" ? "0.4" : "0.18") + ")";
        ctx.lineWidth = hi ? 2.5 : viewMode === "linegraph" ? 1.5 : 1; ctx.stroke();
      });

      // Algorithm traversal edges (BFS/DFS tree), drawn on top when present.
      if (algoHighlight?.edgesUsed?.length) {
        algoHighlight.edgesUsed.forEach(({ from, to }) => {
          const a = ns[from], b = ns[to]; if (!a || !b) return;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = T.green; ctx.lineWidth = 2.5; ctx.stroke();
        });
      }

      // Draw nodes
      Object.values(ns).forEach(n => {
        const isDrag = s.drag?.id === n.id;
        const isHi = hiVerts.has(String(n.id)) || String(selV) === String(n.id) || String(searchHit) === String(n.id);
        const dim = anySelect && !isHi;
        const r = isHi ? 13 : isDrag ? 14 : 8;
        const vid = String(n.id);
        const compColor = componentColors?.get ? componentColors.get(vid) : undefined;
        const isVisited = algoHighlight?.visitedVertices?.has(vid);
        const isFrontier = algoHighlight?.frontierVertices?.has(vid);
        const isCurrent = algoHighlight?.currentVertex === vid;
        if (isHi) { ctx.beginPath(); ctx.arc(n.x, n.y, r + 7, 0, 2 * Math.PI); ctx.fillStyle = "rgba(79,62,232,0.12)"; ctx.fill(); }
        if (isCurrent) { ctx.beginPath(); ctx.arc(n.x, n.y, r + 10, 0, 2 * Math.PI); ctx.strokeStyle = T.amber; ctx.lineWidth = 3; ctx.stroke(); }
        else if (isFrontier) { ctx.beginPath(); ctx.arc(n.x, n.y, r + 8, 0, 2 * Math.PI); ctx.strokeStyle = T.amber + "AA"; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); }
        else if (isVisited) { ctx.beginPath(); ctx.arc(n.x, n.y, r + 6, 0, 2 * Math.PI); ctx.strokeStyle = T.green + "AA"; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = compColor ? compColor : isDrag ? T.accent : isHi ? T.accent : dim ? "#C8C8DC" : "#5A56C0"; ctx.fill();
        ctx.strokeStyle = isHi ? "rgba(79,62,232,0.9)" : "rgba(80,80,160," + (dim ? "0.2" : "0.5") + ")";
        ctx.lineWidth = isHi ? 2.5 : 1.5; ctx.stroke();
        if (isHi || !dim) { ctx.font = isHi ? "bold 11px monospace" : "10px monospace"; ctx.fillStyle = isHi ? T.accent : "#444"; ctx.textAlign = "center"; ctx.fillText(String(n.id), n.x, n.y - (r + 10)); }
      });

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
    return () => { live = false; cancelAnimationFrame(animRef.current); };
  }, [he, verts, v2vEdges, selHE, selV, searchHit, layout, viewMode, initPos, algoHighlight, componentColors]);

  function toWorld(cx, cy) { const t = stateRef.current?.transform || { x: 0, y: 0, s: 1 }; return { wx: (cx - t.x) / t.s, wy: (cy - t.y) / t.s }; }
  function hitNode(wx, wy) { const s = stateRef.current; if (!s) return null; let best = null, bd = Infinity; Object.values(s.nodes).forEach(n => { const d = Math.hypot(n.x - wx, n.y - wy); if (d < 18 / s.transform.s && d < bd) { bd = d; best = n; } }); return best; }
  function getXY(e) { const r = canvasRef.current.getBoundingClientRect(); const src = e.touches ? e.touches[0] : e; return { cx: src.clientX - r.left, cy: src.clientY - r.top }; }
  const onDown = useCallback(e => { e.preventDefault(); const s = stateRef.current; if (!s) return; const { cx, cy } = getXY(e); const { wx, wy } = toWorld(cx, cy); const hit = hitNode(wx, wy); if (hit) { s.drag = { id: hit.id }; s.alpha = Math.max(s.alpha, 0.3); setSelV(v => String(v) === String(hit.id) ? null : hit.id); setSelHE(null); } else { s.pan = { cx, cy, tx: s.transform.x, ty: s.transform.y }; setSelV(null); setSelHE(null); } }, []);
  const onMove = useCallback(e => {
    e.preventDefault(); const s = stateRef.current; if (!s) return;
    const { cx, cy } = getXY(e);
    if (s.drag) { const { wx, wy } = toWorld(cx, cy); const n = s.nodes[s.drag.id]; if (n) { n.x = wx; n.y = wy; n.vx = 0; n.vy = 0; } }
    else if (s.pan) { s.transform.x = s.pan.tx + (cx - s.pan.cx); s.transform.y = s.pan.ty + (cy - s.pan.cy); }
    else {
      const { wx, wy } = toWorld(cx, cy); const hit = hitNode(wx, wy);
      if (hit) { const inHEs = he.filter(h => h.vertices.map(String).includes(String(hit.id))); setInfo({ x: cx, y: cy, title: String(hit.id), lines: ["degree: " + inHEs.length, "in: " + (inHEs.map(h => h.id).join(", ") || "none")] }); }
      else if (viewMode === "hypergraph") {
        let found = null, minR = Infinity;
        he.forEach(h => { const pts = h.vertices.map(v => stateRef.current?.nodes[v]).filter(Boolean); if (!pts.length) return; const cx2 = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy2 = pts.reduce((s, p) => s + p.y, 0) / pts.length; const rx = Math.max(28, arrayMax(pts.map(p => Math.abs(p.x - cx2))) + 28), ry = Math.max(28, arrayMax(pts.map(p => Math.abs(p.y - cy2))) + 28); const ex = (wx - cx2) / rx, ey = (wy - cy2) / ry; if (ex * ex + ey * ey <= 1 && rx + ry < minR) { minR = rx + ry; found = h; } });
        if (found) { const ls = ["cardinality: " + found.vertices.length, "vertices: " + found.vertices.join(", ")]; if (found.time != null) ls.push("time: " + found.time); if (found.weight && found.weight !== 1) ls.push("weight: " + found.weight); setInfo({ x: cx, y: cy, title: found.id, lines: ls }); }
        else setInfo(null);
      } else setInfo(null);
    }
  }, [he, viewMode]);
  const onUp = useCallback(() => { const s = stateRef.current; if (s) { s.drag = null; s.pan = null; } }, []);
  const onWheel = useCallback(e => { e.preventDefault(); const s = stateRef.current; if (!s) return; const r = canvasRef.current.getBoundingClientRect(); const cx = e.clientX - r.left, cy = e.clientY - r.top; const ns2 = Math.min(8, Math.max(0.1, s.transform.s * Math.exp(-e.deltaY * 0.001))); s.transform.x = cx - (cx - s.transform.x) * (ns2 / s.transform.s); s.transform.y = cy - (cy - s.transform.y) * (ns2 / s.transform.s); s.transform.s = ns2; setZoom(Math.round(ns2 * 100)); }, []);
  useEffect(() => { const c = canvasRef.current; if (!c) return; c.addEventListener("wheel", onWheel, { passive: false }); return () => c.removeEventListener("wheel", onWheel); }, [onWheel]);
  function reset() { const s = stateRef.current; if (s) { s.transform = { x: 0, y: 0, s: 1 }; s.alpha = 0.8; } setZoom(100); setSelHE(null); setSelV(null); }
  function reheat() { const s = stateRef.current; if (s) s.alpha = 1.0; }
  function downloadPNG() { const c = canvasRef.current; if (!c) return; const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "hypergraph.png"; a.click(); }
  useEffect(() => {
    if (resetSignal === lastResetSignalRef.current) return;
    lastResetSignalRef.current = resetSignal;
    reset();
  }, [resetSignal]);
  useEffect(() => {
    if (reheatSignal === lastReheatSignalRef.current) return;
    lastReheatSignalRef.current = reheatSignal;
    reheat();
  }, [reheatSignal]);
  useEffect(() => {
    if (exportPngSignal === lastExportPngSignalRef.current) return;
    lastExportPngSignalRef.current = exportPngSignal;
    downloadPNG();
  }, [exportPngSignal]);
  const selInfo = useMemo(() => {
    if (selHE != null) { const h = he.find(x => x.id === selHE); if (!h) return null; const attrs = [["vertices", h.vertices.join(", ")], ["cardinality", String(h.vertices.length)]]; if (h.time != null) attrs.push(["time", String(h.time)]); if (h.weight && h.weight !== 1) attrs.push(["weight", String(h.weight)]); return { type: "hyperedge", id: h.id, attrs }; }
    if (selV != null) { const inHEs = he.filter(h => h.vertices.map(String).includes(String(selV))); return { type: "vertex", id: String(selV), attrs: [["degree", String(inHEs.length)], ["in", inHEs.map(h => h.id).join(", ") || "none"]] }; }
    return null;
  }, [selHE, selV, he]);

  useEffect(() => {
    onSelectionChange?.(selInfo ? { type: selInfo.type, id: String(selInfo.id) } : null);
  }, [onSelectionChange, selInfo]);

  const btnBase = (active, color = T.teal) => ({ padding: "4px 10px", borderRadius: 7, fontSize: 12, fontWeight: active ? 700 : 400, border: "1px solid " + (active ? color : T.border), background: active ? color + "18" : "transparent", color: active ? color : T.textDim, cursor: "pointer" });

  return (
    <div>
      {/* Toolbar row 1 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 4, height: 22, background: T.accent, borderRadius: 2 }} />
          <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Graph Preview</span>
        </div>
        {/* View mode */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: T.textDim }}>view</span>
          {[["hypergraph", "Hypergraph"], ["linegraph", "Line Graph"]].map(([id, label]) => (
            <button key={id} onClick={() => setViewModeValue(id)} style={btnBase(viewMode === id, T.accent)}>{label}</button>
          ))}
        </div>
        {/* Layout */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: T.textDim }}>layout</span>
          {[["force", "Force"], ["circular", "Circular"], ["grid", "Grid"]].map(([id, label]) => (
            <button key={id} onClick={() => setLayoutValue(id)} style={btnBase(layout === id, T.teal)}>{label}</button>
          ))}
        </div>
        {/* Show N */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: T.textDim }}>show</span>
          {[10, 25, 50, 100, 200].map(n => (
            <button key={n} onClick={() => setVizLimit(n)} style={{ padding: "4px 11px", borderRadius: 7, fontSize: 13, fontWeight: vizLimit === n ? 700 : 400, border: "1px solid " + (vizLimit === n ? T.accent : T.border), background: vizLimit === n ? T.accentLt : "transparent", color: vizLimit === n ? T.accent : T.textDim, cursor: "pointer" }}>{n}</button>
          ))}
          <span style={{ fontSize: 13, color: T.textFaint }}>of {hyperedges.length}</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: T.textFaint, fontFamily: "monospace" }}>{zoom}%</span>
          <button onClick={reset} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid " + T.border, background: "transparent", color: T.textDim, fontSize: 13, cursor: "pointer" }}>reset</button>
          <button onClick={reheat} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid " + T.border, background: "transparent", color: T.textDim, fontSize: 13, cursor: "pointer" }}>reheat</button>
          <button onClick={downloadPNG} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid " + T.border, background: "transparent", color: T.accent, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>↓ PNG</button>
        </div>
      </div>
      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <input value={search} onChange={e => setSearchValue(e.target.value)} placeholder="Search vertex…" style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid " + (searchHit ? T.accent : T.border), fontSize: 13, fontFamily: "monospace", outline: "none", width: 220, background: searchHit ? T.accentLt : T.surface, color: T.text }} />
        {search && <button onClick={() => setSearchValue("")} style={{ fontSize: 12, color: T.textDim, background: "none", border: "none", cursor: "pointer" }}>✕</button>}
        {searchHit && <span style={{ fontSize: 12, color: T.accent, fontWeight: 600 }}>Found: {String(searchHit)}</span>}
        <span style={{ fontSize: 12, color: T.textFaint, marginLeft: "auto" }}>scroll=zoom · drag canvas=pan · drag node=move · click=select</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 12 }}>
        <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid " + T.border, background: "#FFFFFF", boxShadow: "0 4px 16px rgba(0,0,0,0.07)" }}>
          <canvas ref={canvasRef} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => { onUp(); setInfo(null); }} onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp} style={{ width: "100%", height: 520, display: "block", cursor: "crosshair" }} />
          {info && (<div style={{ position: "absolute", left: Math.min(info.x + 16, 400), top: Math.max(0, info.y - 12), background: "rgba(255,255,255,0.97)", border: "1px solid " + T.border, borderRadius: 10, padding: "10px 16px", pointerEvents: "none", fontSize: 13, fontFamily: "monospace", color: T.text, zIndex: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", whiteSpace: "nowrap" }}><div style={{ fontWeight: 700, color: T.accent, marginBottom: 5 }}>{info.title}</div>{info.lines.map((l, i) => <div key={i} style={{ color: T.textDim, lineHeight: 1.8 }}>{l}</div>)}</div>)}
          {viewMode === "linegraph" && v2vProjection.status === DERIVED_STATUS.OVER_BUDGET && (
            <div style={{ position: "absolute", left: 16, top: 16, right: 16, background: "rgba(255,255,255,0.96)", border: "1px solid " + T.amber + "66", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: T.textDim, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
              <strong style={{ color: T.amber }}>Line Graph not computed.</strong> {v2vProjection.reason}
            </div>
          )}
          {layout === "force" && verts.length > 700 && (
            <div style={{ position: "absolute", left: 16, bottom: 12, background: "rgba(255,255,255,0.96)", border: "1px solid " + T.border, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: T.textDim }}>
              Force layout paused for {verts.length.toLocaleString()} vertices. Use Grid or Circular for this size.
            </div>
          )}
          <div style={{ position: "absolute", bottom: 12, right: 16, fontSize: 11, color: T.textFaint, fontFamily: "monospace", userSelect: "none" }}>
            {viewMode === "hypergraph" ? "rings=hyperedges · dots=vertices" : "edges=co-membership · dots=vertices"}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", minHeight: 100 }}>
            {selInfo ? (<><div style={{ fontSize: 11, color: T.textFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>Selected</div><div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 17, color: selInfo.type === "hyperedge" ? T.accent : T.teal, marginBottom: 10 }}>{selInfo.id}</div>{selInfo.attrs.map(([k, v]) => (<div key={k} style={{ marginBottom: 9 }}><div style={{ fontSize: 11, color: T.textFaint, textTransform: "uppercase", letterSpacing: .7, marginBottom: 2, fontWeight: 600 }}>{k}</div><div style={{ fontSize: 13, color: T.text, fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.6 }}>{v}</div></div>))}<button onClick={() => { setSelHE(null); setSelV(null); }} style={{ marginTop: 4, fontSize: 12, color: T.textDim, background: "none", border: "1px solid " + T.border, borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>clear ×</button></>) : (<div style={{ color: T.textFaint, fontSize: 13, textAlign: "center", padding: "20px 0", lineHeight: 1.8 }}>Click a node or<br />ring to inspect</div>)}
          </div>
          <div style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 12, padding: 10, flex: 1, overflowY: "auto", maxHeight: 380, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 11, color: T.textFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 600, padding: "0 4px" }}>Hyperedges ({he.length})</div>
            {he.map((h, i) => (<div key={h.id} onClick={() => { setSelHE(v => v === h.id ? null : h.id); setSelV(null); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 3, background: selHE === h.id ? T.accentLt : "transparent", border: "1px solid " + (selHE === h.id ? T.accent + "55" : "transparent"), transition: "all .12s" }}><div style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: PALETTE[i % PALETTE.length] }} /><span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: selHE === h.id ? T.accent : T.text }}>{h.id}</span>{h.time != null && <span style={{ fontSize: 10, color: T.teal }}>t{h.time}</span>}{h.weight && h.weight !== 1 && <span style={{ fontSize: 10, color: T.amber }}>w{h.weight}</span>}<span style={{ fontSize: 12, color: T.textDim, marginLeft: "auto", fontFamily: "monospace" }}>{h.vertices.length}v</span></div>))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[...verts].sort(vcmp).map(v => { const active = String(selV) === String(v) || (selHE != null && he.find(h => h.id === selHE)?.vertices.map(String).includes(String(v))) || String(searchHit) === String(v); return (<div key={String(v)} onClick={() => { setSelV(x => String(x) === String(v) ? null : v); setSelHE(null); }} style={{ padding: "4px 12px", borderRadius: 16, cursor: "pointer", border: "1px solid " + (active ? T.accent : T.border), background: active ? T.accentLt : "transparent", fontSize: 13, fontFamily: "monospace", color: active ? T.accent : T.textDim, transition: "all .12s", fontWeight: active ? 700 : 400 }}>{String(v)}</div>); })}
      </div>
    </div>
  );
}

