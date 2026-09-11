import { SSSP_ACCEPTED_GRAPH_TYPES } from "./contracts/graphTypes.js";

const FRONTEND_CAPABILITIES = Object.freeze({
  RUN_SSSP: Object.freeze({
    algorithm: "SSSP",
    algorithmVersion: "scope1-openmp-sssp/1",
    backend: "LOCAL_OPENMP",
    graphTypes: SSSP_ACCEPTED_GRAPH_TYPES,
    modes: Object.freeze(["STATIC", "INCREMENTAL", "COMPARE"]),
  }),
});

export function intersectCandyCapabilities(runtimeDeclaration, { authorized = false, graphType = null } = {}) {
  if (!runtimeDeclaration || runtimeDeclaration.schemaVersion !== "candy.capabilities/1" || !Array.isArray(runtimeDeclaration.capabilities)) {
    return Object.freeze({ status: "incompatible", capabilities: [], reason: "Runtime capability schema is unsupported." });
  }
  if (!authorized) return Object.freeze({ status: "unauthorized", capabilities: [], reason: "Pairing is required." });
  const accepted = [];
  for (const remote of runtimeDeclaration.capabilities) {
    const local = FRONTEND_CAPABILITIES[remote?.capability];
    if (!local || remote.algorithm !== local.algorithm || remote.algorithmVersion !== local.algorithmVersion || remote.backend !== local.backend) continue;
    const graphTypes = local.graphTypes.filter(value => remote.graphTypes?.includes(value));
    const modes = local.modes.filter(value => remote.modes?.includes(value));
    if (!graphTypes.length || !modes.length) continue;
    if (graphType && !graphTypes.includes(graphType)) continue;
    accepted.push(Object.freeze({ capability: remote.capability, algorithm: local.algorithm, algorithmVersion: local.algorithmVersion, backend: local.backend, graphTypes: Object.freeze(graphTypes), modes: Object.freeze(modes), limits: Object.freeze({ ...(remote.limits ?? {}) }) }));
  }
  return Object.freeze({ status: accepted.length ? "ready" : "unavailable", capabilities: Object.freeze(accepted), reason: accepted.length ? null : "No qualified capability matches the active graph and frontend schemas." });
}

export function frontendCandyCapabilities() {
  return FRONTEND_CAPABILITIES;
}
