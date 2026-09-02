import { useEffect, useMemo, useState } from "react";
import { createDerivedRequestCoordinator } from "../derived/derivedRequestCoordinator.js";
import { runDerivedWorkerRequest } from "../derived/derivedWorkerClient.js";
import {
  cancelledDerived,
  computingDerived,
  failedDerived,
  notRequestedDerived,
} from "../utils/derivedResults.js";
import { stableStringify } from "../derived/derivedProductCache.js";

export function useAsyncDerivedProduct({
  enabled,
  graphVersion,
  graphIdentity,
  operationType,
  options = {},
  hyperedges,
  cache = null,
  channel = operationType,
  executor = runDerivedWorkerRequest,
}) {
  const [coordinator] = useState(createDerivedRequestCoordinator);
  const optionsKey = stableStringify(options);
  const stableOptions = useMemo(() => ({ ...options }), [optionsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [state, setState] = useState(() => ({
    graphVersion,
    graphIdentity,
    result: notRequestedDerived(operationType),
  }));
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    coordinator.activateGraph(graphVersion, graphIdentity);
    cache?.activateGraph(graphVersion, graphIdentity);
    if (!enabled || !hyperedges) {
      coordinator.cancel(channel, "not_requested");
      setState({ graphVersion, graphIdentity, result: notRequestedDerived(operationType) });
      return undefined;
    }

    const cached = cache?.peek(operationType, stableOptions);
    if (cached !== undefined) {
      setState({ graphVersion, graphIdentity, result: cached });
      return undefined;
    }

    setState({ graphVersion, graphIdentity, result: computingDerived(operationType, { graphVersion }) });
    let mounted = true;
    const handle = coordinator.request({
      channel,
      graphVersion,
      graphIdentity,
      operationType,
      options: stableOptions,
      execute: (metadata, signal) => executor(metadata, hyperedges, signal),
    });
    handle.promise.then(outcome => {
      if (!mounted) return;
      if (outcome.status === "completed") {
        cache?.setCompleteForGraph(
          outcome.metadata.graphVersion,
          graphIdentity,
          operationType,
          stableOptions,
          outcome.value,
        );
        setState({ graphVersion, graphIdentity, result: outcome.value });
      } else if (outcome.status === "failed") {
        setState({ graphVersion, graphIdentity, result: failedDerived(operationType, { reason: outcome.reason, error: outcome.error }) });
      } else if (outcome.status === "cancelled") {
        setState({ graphVersion, graphIdentity, result: cancelledDerived(operationType, { reason: outcome.reason }) });
      }
    });
    return () => {
      mounted = false;
      handle.cancel("component_cleanup");
    };
  }, [cache, channel, coordinator, enabled, executor, graphIdentity, graphVersion, hyperedges, operationType, retryToken, stableOptions]);

  const stateMatchesCurrentGraph = Object.is(state.graphVersion, graphVersion)
    && Object.is(state.graphIdentity, graphIdentity);
  const result = !enabled
    ? notRequestedDerived(operationType)
    : stateMatchesCurrentGraph
      ? state.result
      : computingDerived(operationType, { graphVersion });

  return Object.freeze({
    result,
    cancel(reason = "user_cancelled") { return coordinator.cancel(channel, reason); },
    restart() { setRetryToken(token => token + 1); },
    coordinator,
  });
}
