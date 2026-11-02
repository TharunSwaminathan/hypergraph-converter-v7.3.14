import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createAnalysisHistoryCoordinator } from "./analysisHistoryCoordinator.js";
import { analysisInputDigest } from "./analysisHistorySchema.js";
function historyOwner(initial) { let stale = initial; return Object.freeze({ isCurrent: () => !stale, setStale: value => { stale = value; } }); }

export function useAnalysisHistory({ session, ready, stale = false, hyperedges }) {
  const [owner] = useState(() => historyOwner(stale)); useLayoutEffect(() => { owner.setStale(stale); }, [owner, stale]);
  const [coordinator] = useState(() => createAnalysisHistoryCoordinator(session, { isCurrent: owner.isCurrent }));
  const snapshot = useSyncExternalStore(coordinator.subscribe, coordinator.getSnapshot, coordinator.getSnapshot);
  const [digestedInput, setDigestedInput] = useState(null);
  useEffect(() => { coordinator.activate(); return () => coordinator.dispose(); }, [coordinator]);
  useEffect(() => { if (ready) void coordinator.initialize().catch(() => {}); }, [coordinator, ready]);
  useEffect(() => { let active = true; void analysisInputDigest(hyperedges ?? []).then(value => { if (active) setDigestedInput({ input: hyperedges, value }); }, () => { if (active) setDigestedInput(null); }); return () => { active = false; }; }, [hyperedges]);
  const complete = useCallback(event => coordinator.complete(event), [coordinator]);
  return { ...snapshot, complete, inputDigest: digestedInput?.input === hyperedges ? digestedInput.value : null, coordinator };
}
