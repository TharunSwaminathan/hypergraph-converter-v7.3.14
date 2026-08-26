import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALGORITHM_REGISTRY, getAlgorithm } from "../algorithms/registry.js";
import { getAllVertices } from "../algorithms/graphModel.js";
import { PALETTE } from "../theme.js";

const ANIMATION_STEP_MS = 500;

/**
 * Runs the selected algorithm against `hyperedges` and exposes:
 *  - controls for the AlgorithmsPanel (select algorithm, pick start/target
 *    vertex, run, animate)
 *  - `highlight` / `componentColors`, ready to hand straight to <Viz>
 *
 * @param {Array} hyperedges
 */
export function useAlgorithms(hyperedges) {
  const [algorithmId, setAlgorithmId] = useState(ALGORITHM_REGISTRY[0].id);
  const [requestedStartVertex, setRequestedStartVertex] = useState(null);
  const [requestedTargetVertex, setRequestedTargetVertex] = useState(null);
  const [runToken, setRunToken] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef(null);

  const vertices = useMemo(() => getAllVertices(hyperedges ?? []), [hyperedges]);
  const algorithm = getAlgorithm(algorithmId);

  // The effective start/target vertex is derived at render time instead of
  // synced via an effect: if the user's choice is no longer in the graph,
  // fall back to a sensible default. No setState-in-effect needed.
  const startVertex = useMemo(() => {
    if (requestedStartVertex != null && vertices.includes(String(requestedStartVertex))) return requestedStartVertex;
    return vertices[0] ?? null;
  }, [requestedStartVertex, vertices]);

  const targetVertex = useMemo(() => {
    if (!algorithm?.needsTargetVertex) return null;
    if (requestedTargetVertex != null && vertices.includes(String(requestedTargetVertex))) return requestedTargetVertex;
    // Default to a different vertex than the start when possible, so a
    // fresh Dijkstra run has a non-trivial target selected out of the box.
    return vertices.find(v => v !== startVertex) ?? vertices[0] ?? null;
  }, [algorithm, requestedTargetVertex, vertices, startVertex]);

  const stopAnimation = useCallback(() => {
    setIsPlaying(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const selectAlgorithm = useCallback((id) => {
    stopAnimation();
    setAlgorithmId(id);
    setRunToken(0);
    setStepIndex(0);
  }, [stopAnimation]);

  const run = useCallback(() => {
    stopAnimation();
    setStepIndex(0);
    setRunToken(t => t + 1);
  }, [stopAnimation]);

  // The result recomputes automatically whenever the graph, algorithm, or
  // start/target vertex changes — as long as the user has run at least
  // once (runToken > 0). This keeps results fresh without an effect.
  const { result, error } = useMemo(() => {
    if (runToken === 0) return { result: null, error: "" };
    if (!hyperedges?.length) return { result: null, error: "" };
    if (algorithm?.needsStartVertex && startVertex == null) return { result: null, error: "Pick a start vertex first." };
    if (algorithm?.needsTargetVertex && targetVertex == null) return { result: null, error: "Pick a target vertex first." };
    try {
      return { result: algorithm.run(hyperedges, { startVertex, targetVertex }), error: "" };
    } catch (e) {
      return { result: null, error: e.message || "Algorithm failed to run." };
    }
  }, [runToken, hyperedges, algorithm, startVertex, targetVertex]);

  const totalSteps = result?.steps?.length ?? 0;

  const play = useCallback(() => {
    if (!algorithm?.supportsAnimation || !result?.steps?.length) return;
    if (stepIndex >= totalSteps - 1) setStepIndex(0);
    setIsPlaying(true);
  }, [algorithm, result, stepIndex, totalSteps]);

  const pause = useCallback(() => stopAnimation(), [stopAnimation]);
  const stepForward = useCallback(() => setStepIndex(i => Math.min(i + 1, totalSteps - 1)), [totalSteps]);
  const stepBack = useCallback(() => setStepIndex(i => Math.max(i - 1, 0)), []);

  // The interval timer is an external system (setInterval), so driving it
  // from an effect — and having *that* effect's cleanup be the only place
  // that clears it — is the correct use of useEffect here, not an
  // anti-pattern: it isn't synchronizing React state to itself, it's
  // subscribing to a ticking clock and reacting to its callback.
  useEffect(() => {
    if (!isPlaying) return undefined;
    timerRef.current = setInterval(() => {
      setStepIndex(i => {
        if (i >= totalSteps - 1) { stopAnimation(); return i; }
        return i + 1;
      });
    }, ANIMATION_STEP_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, totalSteps, stopAnimation]);

  const highlight = useMemo(() => {
    if (!result || !algorithm?.supportsAnimation) return null;
    const step = result.steps?.[Math.min(stepIndex, totalSteps - 1)];
    if (!step) return null;
    return {
      visitedVertices: new Set(step.visited),
      frontierVertices: new Set(step.frontier),
      currentVertex: step.current,
      edgesUsed: result.edgesUsed.filter(e => step.visited.includes(e.to)),
    };
  }, [result, algorithm, stepIndex, totalSteps]);

  const componentColors = useMemo(() => {
    if (!result) return null;
    if (algorithmId === "connected_components") {
      const map = new Map();
      for (const [vertex, componentId] of result.vertexToComponent ?? []) {
        map.set(vertex, result.components[componentId]?.color);
      }
      return map;
    }
    if (algorithmId === "k_core") {
      const map = new Map();
      for (const [vertex, k] of result.coreness ?? []) {
        map.set(vertex, PALETTE[Math.min(k, PALETTE.length - 1)]);
      }
      return map;
    }
    return null;
  }, [result, algorithmId]);

  return {
    algorithms: ALGORITHM_REGISTRY,
    algorithm,
    algorithmId,
    selectAlgorithm,
    vertices,
    startVertex,
    setStartVertex: setRequestedStartVertex,
    targetVertex,
    setTargetVertex: setRequestedTargetVertex,
    run,
    result,
    error,
    highlight,
    componentColors,
    animation: {
      supported: Boolean(algorithm?.supportsAnimation),
      isPlaying,
      stepIndex: Math.min(stepIndex, Math.max(totalSteps - 1, 0)),
      totalSteps,
      play,
      pause,
      stepForward,
      stepBack,
    },
  };
}
