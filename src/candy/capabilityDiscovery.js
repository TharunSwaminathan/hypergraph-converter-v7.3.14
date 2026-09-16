import { SSSP_ACCEPTED_GRAPH_TYPES } from "./contracts/graphTypes.js";

const FRONTEND_CAPABILITIES = Object.freeze([
  Object.freeze({
    capability: "RUN_SSSP",
    algorithm: "SSSP",
    algorithmVersion: "scope1-openmp-sssp/1",
    backend: "LOCAL_OPENMP",
    graphTypes: SSSP_ACCEPTED_GRAPH_TYPES,
    modes: Object.freeze(["STATIC", "INCREMENTAL", "COMPARE"]),
    adapterVersion: "candy.csr-adapter/1",
  }),
  Object.freeze({
    capability: "RUN_SSSP",
    algorithm: "SSSP",
    algorithmVersion: "scope3-cuda-sssp/1",
    backend: "LOCAL_CUDA",
    graphTypes: SSSP_ACCEPTED_GRAPH_TYPES,
    modes: Object.freeze(["INCREMENTAL", "COMPARE"]),
    adapterVersion: "candy.cuda-adapter/1",
  }),
]);

const SHA256_FINGERPRINT = /^sha256:[a-f0-9]{64}$/;
const CUDA_EXECUTION_ENVIRONMENTS = new Set(["WSL2_CUDA", "LINUX_CUDA"]);

function validatedCudaDevices(remote) {
  if (remote.adapterVersion !== "candy.cuda-adapter/1"
    || !SHA256_FINGERPRINT.test(remote.nativeBuildFingerprint ?? "")
    || !CUDA_EXECUTION_ENVIRONMENTS.has(remote.executionEnvironment)
    || remote.qualification?.schemaVersion !== "candy.cuda-qualified-build/1"
    || remote.qualification?.status !== "exact_local_attestation"
    || !Array.isArray(remote.devices)
    || remote.devices.length < 1
    || remote.devices.length > 8) return null;
  const devices = remote.devices.map(device => {
    if (!Number.isInteger(device?.id) || device.id < 0 || device.id > 255
      || typeof device.name !== "string" || !device.name.trim() || device.name.length > 160
      || !/^\d+\.\d+$/.test(device.computeCapability ?? "")
      || !/^sm_\d+$/.test(device.qualifiedArchitecture ?? "")
      || !Number.isInteger(device.memoryMiB) || device.memoryMiB < 1) return null;
    return Object.freeze({ id: device.id, name: device.name, computeCapability: device.computeCapability, qualifiedArchitecture: device.qualifiedArchitecture, memoryMiB: device.memoryMiB });
  });
  return devices.every(Boolean) ? Object.freeze(devices) : null;
}

export function intersectCandyCapabilities(runtimeDeclaration, { authorized = false, graphType = null } = {}) {
  if (!runtimeDeclaration || runtimeDeclaration.schemaVersion !== "candy.capabilities/1" || !Array.isArray(runtimeDeclaration.capabilities)) {
    return Object.freeze({ status: "incompatible", capabilities: [], reason: "Runtime capability schema is unsupported." });
  }
  if (!authorized) return Object.freeze({ status: "unauthorized", capabilities: [], reason: "Pairing is required." });
  const accepted = [];
  for (const remote of runtimeDeclaration.capabilities) {
    const local = FRONTEND_CAPABILITIES.find(item => item.capability === remote?.capability && item.backend === remote?.backend);
    if (!local || remote.algorithm !== local.algorithm || remote.algorithmVersion !== local.algorithmVersion || remote.backend !== local.backend || remote.adapterVersion !== local.adapterVersion) continue;
    const graphTypes = local.graphTypes.filter(value => remote.graphTypes?.includes(value));
    const modes = local.modes.filter(value => remote.modes?.includes(value));
    if (!graphTypes.length || !modes.length) continue;
    if (graphType && !graphTypes.includes(graphType)) continue;
    const devices = local.backend === "LOCAL_CUDA" ? validatedCudaDevices(remote) : undefined;
    if (local.backend === "LOCAL_CUDA" && !devices) continue;
    accepted.push(Object.freeze({ capability: remote.capability, algorithm: local.algorithm, algorithmVersion: local.algorithmVersion, backend: local.backend, graphTypes: Object.freeze(graphTypes), modes: Object.freeze(modes), limits: Object.freeze({ ...(remote.limits ?? {}) }), ...(devices ? { devices: Object.freeze(devices) } : {}) }));
  }
  return Object.freeze({ status: accepted.length ? "ready" : "unavailable", capabilities: Object.freeze(accepted), reason: accepted.length ? null : "No qualified capability matches the active graph and frontend schemas." });
}

export function frontendCandyCapabilities() {
  return FRONTEND_CAPABILITIES;
}
