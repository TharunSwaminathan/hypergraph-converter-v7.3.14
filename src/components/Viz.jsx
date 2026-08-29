import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { T, PALETTE } from "../theme.js";
import { vcmp } from "../utils/parsers.js";
import { buildV2VBounded, DERIVED_STATUS } from "../utils/mappings.js";
import {
  createGraphIdentifierMap,
  getGraphIdentifierValue,
  graphIdentifiersEqual,
} from "../utils/graphIdentifiers.js";
import {
  buildPreviewTopology,
  chooseForceStrategy,
  createInitialNodePositions,
  FORCE_CONSTANTS,
  reheatForceState,
  stepHypergraphForce,
} from "../visualization/hypergraphLayout.js";
import { computeHyperedgeBounds, hitHyperedgeRing, hitNode } from "../visualization/previewGeometry.js";
import { buildVisualCoMembershipOverlay, selectLineGraphVisualEdges } from "../visualization/previewRenderBudget.js";
import {
  computeCanvasBackingSize,
  createPreviewRafScheduler,
  hyperedgeMetadata,
  resolvePreviewSearch,
  shouldDisplayWeight,
} from "../visualization/previewRuntime.js";

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
  const canvasRef = useRef(null); const containerRef = useRef(null); const stateRef = useRef(null);
  const schedulerRef = useRef(null); const requestDrawRef = useRef(() => false);
  const lastResetSignalRef = useRef(resetSignal);
  const lastReheatSignalRef = useRef(reheatSignal);
  const lastExportPngSignalRef = useRef(exportPngSignal);
  const [info, setInfo] = useState(null);
  const [selHE, setSelHE] = useState(null); const [selV, setSelV] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 520 });
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
  const topology = useMemo(() => buildPreviewTopology(he), [he]);
  const verts = topology.vertices;
  // Exact analytical projection belongs only to Line Graph mode.
  const v2vProjection = useMemo(() => viewMode === "linegraph" ? buildV2VBounded(he) : { status: DERIVED_STATUS.NOT_REQUESTED, edges: [], reason: "Hypergraph view does not require V2V clique edges." }, [he, viewMode]);
  const lineGraphVisual = useMemo(() => selectLineGraphVisualEdges(
    v2vProjection.status === DERIVED_STATUS.COMPUTED ? v2vProjection.edges : [],
  ), [v2vProjection]);
  const coMembershipVisual = useMemo(() => buildVisualCoMembershipOverlay(he), [he]);
  const visualEdges = viewMode === "linegraph" ? lineGraphVisual.edges : coMembershipVisual.edges;
  const searchHit = useMemo(() => resolvePreviewSearch(verts, search), [search, verts]);
  const forceStrategy = useMemo(() => chooseForceStrategy(verts.length), [verts.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = rectangle => {
      const width = Math.max(1, rectangle?.width || container.offsetWidth || 800);
      const height = Math.max(1, rectangle?.height || 520);
      setCanvasSize(current => current.width === width && current.height === height ? current : { width, height });
    };
    update(container.getBoundingClientRect());
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(entries => update(entries[0]?.contentRect));
      observer.observe(container);
      return () => observer.disconnect();
    }
    const onResize = () => update(container.getBoundingClientRect());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const sizing = computeCanvasBackingSize(canvasSize.width, canvasSize.height, window.devicePixelRatio || 1);
    const W = sizing.cssWidth, H = sizing.cssHeight;
    if (canvas.width !== sizing.backingWidth) canvas.width = sizing.backingWidth;
    if (canvas.height !== sizing.backingHeight) canvas.height = sizing.backingHeight;
    canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Merge into the existing simulation rather than rebuilding it from
    // scratch on every data change. A batch update (add/remove a vertex or
    // hyperedge) should nudge the existing visualization, not replace it:
    // vertices that were already on the canvas keep their position, and
    // the user's current pan/zoom is left alone. A full re-init only
    // happens on first mount or when the person explicitly picks a
    // different layout.
    const prev = stateRef.current;
    const isFreshLayout = !prev || prev.layoutKind !== layout || !(prev.nodes instanceof Map);
    const graphChanged = prev?.graph !== he;
    const placed = createInitialNodePositions(verts, W, H, layout);
    const nodes = isFreshLayout ? placed : createGraphIdentifierMap();
    if (!isFreshLayout) {
      verts.forEach(v => {
        nodes.set(v, getGraphIdentifierValue(prev.nodes, v) ?? getGraphIdentifierValue(placed, v));
      });
    }

    stateRef.current = {
      nodes,
      transform: prev?.transform ?? { x: 0, y: 0, s: 1 },
      drag: null,
      pan: null,
      alpha: isFreshLayout
        ? (layout === "force" ? 1 : 0)
        : graphChanged && layout === "force" ? Math.max(prev.alpha, 0.3) : prev.alpha,
      layoutKind: layout,
      graph: he,
      forceDiagnostics: prev?.forceDiagnostics ?? { strategy: forceStrategy, repulsionWork: 0, attractionWork: 0 },
    };

    function draw() {
      if (!stateRef.current) return false;
      const s = stateRef.current, t = s.transform, ns = s.nodes;
      let forceActive = false;
      if (layout === "force" && s.alpha > FORCE_CONSTANTS.settledAlpha) {
        const result = stepHypergraphForce({ nodes: ns, topology, width: W, height: H, alpha: s.alpha, dragId: s.drag?.id ?? null });
        s.alpha = result.alpha;
        s.forceDiagnostics = result;
        forceActive = result.active;
      }

      ctx.setTransform(sizing.dpr, 0, 0, sizing.dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.save(); ctx.translate(t.x, t.y); ctx.scale(t.s, t.s);

      const selHeObj = selHE != null ? he.find(h => graphIdentifiersEqual(h.id, selHE)) : null;
      const hiVerts = new Set((selHeObj ? selHeObj.vertices : (selV != null ? [selV] : searchHit != null ? [searchHit] : [])).map(String));
      const hiHEs = selV != null ? new Set(he.filter(h => h.vertices.map(String).includes(String(selV))).map(h => String(h.id)))
        : searchHit != null ? new Set(he.filter(h => h.vertices.map(String).includes(String(searchHit))).map(h => String(h.id)))
          : selHE != null ? new Set([String(selHE)]) : new Set();
      const anySelect = selHE != null || selV != null || searchHit != null;

      if (viewMode === "hypergraph") {
        he.forEach((h, i) => {
          const pts = h.vertices.map(v => getGraphIdentifierValue(ns, v)).filter(Boolean);
          const bounds = computeHyperedgeBounds(pts); if (!bounds) return;
          const color = PALETTE[i % PALETTE.length];
          const selected = hiHEs.has(String(h.id)), dimmed = anySelect && !selected;
          ctx.beginPath(); ctx.ellipse(bounds.cx, bounds.cy, bounds.rx, bounds.ry, 0, 0, 2 * Math.PI);
          ctx.fillStyle = color + (dimmed ? "08" : selected ? "22" : "12"); ctx.fill();
          ctx.strokeStyle = color + (dimmed ? "22" : selected ? "EE" : "66");
          ctx.lineWidth = selected ? 2.5 : 1.5; ctx.setLineDash(selected ? [] : [6, 4]); ctx.stroke(); ctx.setLineDash([]);
          ctx.save(); ctx.font = selected ? "bold 12px system-ui" : "11px system-ui";
          ctx.fillStyle = color + (dimmed ? "44" : selected ? "FF" : "BB"); ctx.textAlign = "center";
          ctx.fillText(String(h.id) + (h.time != null ? " [t=" + h.time + "]" : ""), bounds.cx, bounds.cy - bounds.ry + 16); ctx.restore();
        });
      }

      // Visual relations are deliberately separate from incidence-native Force topology.
      visualEdges.forEach(({ u, v }) => {
        const a = getGraphIdentifierValue(ns, u), b = getGraphIdentifierValue(ns, v); if (!a || !b) return;
        const hi = hiVerts.has(String(u)) && hiVerts.has(String(v)), dim = anySelect && !hi;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = hi ? "rgba(79,62,232,0.85)" : "rgba(60,60,100," + (dim ? "0.05" : viewMode === "linegraph" ? "0.4" : "0.18") + ")";
        ctx.lineWidth = hi ? 2.5 : viewMode === "linegraph" ? 1.5 : 1; ctx.stroke();
      });

      // Algorithm traversal edges (BFS/DFS tree), drawn on top when present.
      if (algoHighlight?.edgesUsed?.length) {
        algoHighlight.edgesUsed.forEach(({ from, to }) => {
          const a = getGraphIdentifierValue(ns, from), b = getGraphIdentifierValue(ns, to); if (!a || !b) return;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = T.green; ctx.lineWidth = 2.5; ctx.stroke();
        });
      }

      // Draw nodes
      ns.forEach(n => {
        const isDrag = s.drag?.id === n.id;
        const isHi = hiVerts.has(String(n.id)) || graphIdentifiersEqual(selV, n.id) || graphIdentifiersEqual(searchHit, n.id);
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
      return forceActive || Boolean(s.drag) || Boolean(s.pan);
    }
    const scheduler = createPreviewRafScheduler({ requestFrame: requestAnimationFrame, cancelFrame: cancelAnimationFrame, drawFrame: draw });
    schedulerRef.current = scheduler;
    requestDrawRef.current = scheduler.request;
    scheduler.request();
    return () => {
      scheduler.dispose();
      if (schedulerRef.current === scheduler) schedulerRef.current = null;
      if (requestDrawRef.current === scheduler.request) requestDrawRef.current = () => false;
    };
  }, [he, verts, topology, visualEdges, selHE, selV, searchHit, layout, viewMode, algoHighlight, componentColors, canvasSize, forceStrategy]);

  function toWorld(cx, cy) { const t = stateRef.current?.transform || { x: 0, y: 0, s: 1 }; return { wx: (cx - t.x) / t.s, wy: (cy - t.y) / t.s }; }
  function getXY(e) { const r = canvasRef.current.getBoundingClientRect(); const src = e.touches ? e.touches[0] : e; return { cx: src.clientX - r.left, cy: src.clientY - r.top }; }
  const onDown = useCallback(e => {
    e.preventDefault(); const s = stateRef.current; if (!s) return;
    const { cx, cy } = getXY(e); const { wx, wy } = toWorld(cx, cy);
    const nodeHit = hitNode(s.nodes, wx, wy, { zoom: s.transform.s });
    if (nodeHit) {
      s.drag = { id: nodeHit.id }; s.alpha = Math.max(s.alpha, 0.3);
      setSelV(value => graphIdentifiersEqual(value, nodeHit.id) ? null : nodeHit.id); setSelHE(null);
    } else if (viewMode === "hypergraph") {
      const ringHit = hitHyperedgeRing(he, s.nodes, wx, wy, { zoom: s.transform.s });
      if (ringHit) {
        setSelHE(value => graphIdentifiersEqual(value, ringHit.hyperedge.id) ? null : ringHit.hyperedge.id); setSelV(null);
      } else {
        s.pan = { cx, cy, tx: s.transform.x, ty: s.transform.y }; setSelV(null); setSelHE(null);
      }
    } else {
      s.pan = { cx, cy, tx: s.transform.x, ty: s.transform.y }; setSelV(null); setSelHE(null);
    }
    requestDrawRef.current();
  }, [he, viewMode]);
  const onMove = useCallback(e => {
    e.preventDefault(); const s = stateRef.current; if (!s) return;
    const { cx, cy } = getXY(e);
    if (s.drag) { const { wx, wy } = toWorld(cx, cy); const n = getGraphIdentifierValue(s.nodes, s.drag.id); if (n) { n.x = wx; n.y = wy; n.vx = 0; n.vy = 0; } requestDrawRef.current(); }
    else if (s.pan) { s.transform.x = s.pan.tx + (cx - s.pan.cx); s.transform.y = s.pan.ty + (cy - s.pan.cy); requestDrawRef.current(); }
    else {
      const { wx, wy } = toWorld(cx, cy); const nodeHit = hitNode(s.nodes, wx, wy, { zoom: s.transform.s });
      if (nodeHit) { const inHEs = he.filter(h => h.vertices.map(String).includes(String(nodeHit.id))); setInfo({ x: cx, y: cy, title: String(nodeHit.id), lines: ["degree: " + inHEs.length, "in: " + (inHEs.map(h => h.id).join(", ") || "none")] }); }
      else if (viewMode === "hypergraph") {
        const ringHit = hitHyperedgeRing(he, s.nodes, wx, wy, { zoom: s.transform.s });
        if (ringHit) { const entries = hyperedgeMetadata(ringHit.hyperedge); setInfo({ x: cx, y: cy, title: ringHit.hyperedge.id, lines: entries.map(([key, value]) => `${key}: ${value}`) }); }
        else setInfo(null);
      } else setInfo(null);
    }
  }, [he, viewMode]);
  const onUp = useCallback(() => { const s = stateRef.current; if (s) { s.drag = null; s.pan = null; requestDrawRef.current(); } }, []);
  const onWheel = useCallback(e => { e.preventDefault(); const s = stateRef.current; if (!s) return; const r = canvasRef.current.getBoundingClientRect(); const cx = e.clientX - r.left, cy = e.clientY - r.top; const ns2 = Math.min(8, Math.max(0.1, s.transform.s * Math.exp(-e.deltaY * 0.001))); s.transform.x = cx - (cx - s.transform.x) * (ns2 / s.transform.s); s.transform.y = cy - (cy - s.transform.y) * (ns2 / s.transform.s); s.transform.s = ns2; setZoom(Math.round(ns2 * 100)); requestDrawRef.current(); }, []);
  useEffect(() => { const c = canvasRef.current; if (!c) return; c.addEventListener("wheel", onWheel, { passive: false }); return () => c.removeEventListener("wheel", onWheel); }, [onWheel]);
  const reset = useCallback(() => { const s = stateRef.current; if (s) { s.transform = { x: 0, y: 0, s: 1 }; if (layout === "force") s.alpha = 0.8; } setZoom(100); setSelHE(null); setSelV(null); requestDrawRef.current(); }, [layout]);
  const reheat = useCallback(() => { if (layout !== "force") return; if (reheatForceState(stateRef.current)) requestDrawRef.current(); }, [layout]);
  function downloadPNG() { const c = canvasRef.current; if (!c) return; const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "hypergraph.png"; a.click(); }
  useEffect(() => {
    if (resetSignal === lastResetSignalRef.current) return;
    lastResetSignalRef.current = resetSignal;
    reset();
  }, [resetSignal, reset]);
  useEffect(() => {
    if (reheatSignal === lastReheatSignalRef.current) return;
    lastReheatSignalRef.current = reheatSignal;
    reheat();
  }, [reheatSignal, reheat]);
  useEffect(() => {
    if (exportPngSignal === lastExportPngSignalRef.current) return;
    lastExportPngSignalRef.current = exportPngSignal;
    downloadPNG();
  }, [exportPngSignal]);
  const selInfo = useMemo(() => {
    if (selHE != null) { const h = he.find(x => graphIdentifiersEqual(x.id, selHE)); if (!h) return null; return { type: "hyperedge", id: h.id, attrs: hyperedgeMetadata(h) }; }
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
          <button onClick={reheat} disabled={layout !== "force"} title={layout === "force" ? `Restart ${forceStrategy.forceMode} Force simulation` : "Reheat is available only for Force layout"} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid " + T.border, background: "transparent", color: layout === "force" ? T.textDim : T.textFaint, fontSize: 13, cursor: layout === "force" ? "pointer" : "not-allowed" }}>reheat</button>
          <button onClick={downloadPNG} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid " + T.border, background: "transparent", color: T.accent, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>↓ PNG</button>
        </div>
      </div>
      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <input value={search} onChange={e => setSearchValue(e.target.value)} placeholder="Search vertex…" style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid " + (searchHit != null ? T.accent : T.border), fontSize: 13, fontFamily: "monospace", outline: "none", width: 220, background: searchHit != null ? T.accentLt : T.surface, color: T.text }} />
        {search && <button onClick={() => setSearchValue("")} style={{ fontSize: 12, color: T.textDim, background: "none", border: "none", cursor: "pointer" }}>✕</button>}
        {searchHit != null && <span style={{ fontSize: 12, color: T.accent, fontWeight: 600 }}>Found: {String(searchHit)}</span>}
        <span style={{ fontSize: 12, color: T.textFaint, marginLeft: "auto" }}>scroll=zoom · drag canvas=pan · drag node=move · click=select</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 12 }}>
        <div ref={containerRef} style={{ position: "relative", minWidth: 0, minHeight: 520, borderRadius: 14, overflow: "hidden", border: "1px solid " + T.border, background: "#FFFFFF", boxShadow: "0 4px 16px rgba(0,0,0,0.07)" }}>
          <canvas ref={canvasRef} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => { onUp(); setInfo(null); }} onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp} style={{ width: "100%", height: canvasSize.height, display: "block", cursor: "crosshair" }} />
          {info && (<div style={{ position: "absolute", left: Math.min(info.x + 16, 400), top: Math.max(0, info.y - 12), background: "rgba(255,255,255,0.97)", border: "1px solid " + T.border, borderRadius: 10, padding: "10px 16px", pointerEvents: "none", fontSize: 13, fontFamily: "monospace", color: T.text, zIndex: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", whiteSpace: "nowrap" }}><div style={{ fontWeight: 700, color: T.accent, marginBottom: 5 }}>{info.title}</div>{info.lines.map((l, i) => <div key={i} style={{ color: T.textDim, lineHeight: 1.8 }}>{l}</div>)}</div>)}
          {viewMode === "linegraph" && v2vProjection.status === DERIVED_STATUS.OVER_BUDGET && (
            <div style={{ position: "absolute", left: 16, top: 16, right: 16, background: "rgba(255,255,255,0.96)", border: "1px solid " + T.amber + "66", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: T.textDim, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
              <strong style={{ color: T.amber }}>Line Graph not computed.</strong> {v2vProjection.reason}
            </div>
          )}
          {viewMode === "linegraph" && v2vProjection.status === DERIVED_STATUS.COMPUTED && !lineGraphVisual.complete && (
            <div role="status" style={{ position: "absolute", left: 16, top: 16, right: 16, background: "rgba(255,255,255,0.96)", border: "1px solid " + T.amber + "66", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: T.textDim }}>
              <strong style={{ color: T.amber }}>Line Graph computed exactly.</strong> Previewing {lineGraphVisual.renderedEdgeCount.toLocaleString()} of {lineGraphVisual.analyticalEdgeCount.toLocaleString()} edges using deterministic LOD; exports remain exact.
            </div>
          )}
          {viewMode === "hypergraph" && !coMembershipVisual.complete && (
            <div role="status" style={{ position: "absolute", left: 16, top: 16, right: 16, background: "rgba(255,255,255,0.94)", border: "1px solid " + T.border, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: T.textDim }}>
              Previewing {coMembershipVisual.usage.renderedVisualRelations.toLocaleString()} of {coMembershipVisual.usage.totalCandidateRelations.toLocaleString()} candidate co-membership links. This deterministic visual sample is not the analytical Line Graph.
            </div>
          )}
          {layout === "force" && (
            <div style={{ position: "absolute", left: 16, bottom: 12, background: "rgba(255,255,255,0.96)", border: "1px solid " + T.border, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: T.textDim }}>
              Force: {forceStrategy.forceMode} repulsion · incidence-centroid topology
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
            {he.map((h, i) => { const selected = graphIdentifiersEqual(selHE, h.id); return (<div key={h.id} onClick={() => { setSelHE(value => graphIdentifiersEqual(value, h.id) ? null : h.id); setSelV(null); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 3, background: selected ? T.accentLt : "transparent", border: "1px solid " + (selected ? T.accent + "55" : "transparent"), transition: "all .12s" }}><div style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: PALETTE[i % PALETTE.length] }} /><span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: selected ? T.accent : T.text }}>{h.id}</span>{h.time != null && <span style={{ fontSize: 10, color: T.teal }}>t{h.time}</span>}{shouldDisplayWeight(h.weight) && <span style={{ fontSize: 10, color: T.amber }}>w{h.weight}</span>}<span style={{ fontSize: 12, color: T.textDim, marginLeft: "auto", fontFamily: "monospace" }}>{h.vertices.length}v</span></div>); })}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[...verts].sort(vcmp).map(v => { const active = graphIdentifiersEqual(selV, v) || (selHE != null && he.find(h => graphIdentifiersEqual(h.id, selHE))?.vertices.map(String).includes(String(v))) || graphIdentifiersEqual(searchHit, v); return (<div key={String(v)} onClick={() => { setSelV(x => graphIdentifiersEqual(x, v) ? null : v); setSelHE(null); }} style={{ padding: "4px 12px", borderRadius: 16, cursor: "pointer", border: "1px solid " + (active ? T.accent : T.border), background: active ? T.accentLt : "transparent", fontSize: 13, fontFamily: "monospace", color: active ? T.accent : T.textDim, transition: "all .12s", fontWeight: active ? 700 : 400 }}>{String(v)}</div>); })}
      </div>
    </div>
  );
}

