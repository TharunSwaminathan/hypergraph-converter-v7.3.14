import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { CAPABILITY_SCHEMA_VERSION } from "../config.js";
import { verifyQualifiedCudaBackend } from "./cudaQualification.js";
import { verifyQualifiedMotifBackend, MOTIF_SPECS } from "./motifQualification.js";
import { MOTIF_ALGORITHM, MOTIF_TAXONOMY } from "../../../src/candy/contracts/runtimeMotif.js";

export const QUALIFIED_SSSP_CAPABILITY = Object.freeze({
  capability: "RUN_SSSP",
  algorithm: "SSSP",
  algorithmVersion: "scope1-openmp-sssp/1",
  backend: "LOCAL_OPENMP",
  graphTypes: Object.freeze(["OrdinaryGraph", "DynamicOrdinaryGraph", "ProjectedOrdinaryGraph"]),
  modes: Object.freeze(["STATIC", "INCREMENTAL", "COMPARE"]),
  weightModel: Object.freeze({ kind: "nonnegative_integer", objectives: 1, nativeMax: 2_147_483_647 }),
  adapterVersion: "candy.csr-adapter/1",
});

export const QUALIFIED_CUDA_SSSP_CAPABILITY = Object.freeze({
  capability: "RUN_SSSP",
  algorithm: "SSSP",
  algorithmVersion: "scope3-cuda-sssp/1",
  backend: "LOCAL_CUDA",
  graphTypes: Object.freeze(["OrdinaryGraph", "DynamicOrdinaryGraph", "ProjectedOrdinaryGraph"]),
  modes: Object.freeze(["INCREMENTAL", "COMPARE"]),
  weightModel: Object.freeze({ kind: "nonnegative_integer", objectives: 1, nativeMax: 2_147_483_647 }),
  adapterVersion: "candy.cuda-adapter/1",
});

export async function discoverNativeBackend(config) {
  if (typeof config.backendAvailable === "boolean") {
    return { available: config.backendAvailable, executionEnvironment: process.platform === "win32" ? "WSL2_LINUX" : "LINUX", buildFingerprint: config.backendAvailable ? "injected-qualified-backend" : null };
  }
  const binary = join(config.runtimeRoot, "native", "sssp-openmp", "build", "candy-sssp-openmp");
  try {
    await access(binary, constants.R_OK);
    const bytes = await readFile(binary);
    return {
      available: true,
      executionEnvironment: process.platform === "win32" ? "WSL2_LINUX" : "LINUX",
      buildFingerprint: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    };
  } catch {
    return { available: false, executionEnvironment: process.platform === "win32" ? "WSL2_LINUX" : "LINUX", buildFingerprint: null };
  }
}

export async function buildCapabilityDeclaration(config) {
  const native = await discoverNativeBackend(config);
  const cuda = await verifyQualifiedCudaBackend(config);
  const capabilities = [];
  if (native.available) capabilities.push(Object.freeze({ ...QUALIFIED_SSSP_CAPABILITY, nativeBuildFingerprint: native.buildFingerprint, executionEnvironment: native.executionEnvironment, limits: config.limits }));
  if (cuda.available) capabilities.push(Object.freeze({
    ...QUALIFIED_CUDA_SSSP_CAPABILITY,
    nativeBuildFingerprint: cuda.fingerprint,
    executionEnvironment: cuda.executionEnvironment,
    qualification: cuda.qualification,
    devices: Object.freeze([cuda.device]),
    limits: Object.freeze({ maxVertices: config.limits.maxCudaVertices, maxEdges: config.limits.maxEdges, maxUpdates: config.limits.maxUpdates, timeoutMs: 86_400_000 }),
  }));
  const motifReadiness = [];
  // Existing in-process SSSP qualification injects a complete discovery fixture.
  // Preserve that fixture contract; motif tests must inject motif discovery too.
  // Production CLI configuration never supplies either trusted override.
  const motifDiscoveryEnabled = typeof config.backendAvailable !== "boolean" || Boolean(config.motifBackendDiscovery);
  for (const backend of motifDiscoveryEnabled ? Object.keys(MOTIF_SPECS) : []) {
    const qualified = await verifyQualifiedMotifBackend(config, backend);
    const mode = backend === "CUDA_STATIC" ? "STATIC" : "INCREMENTAL";
    motifReadiness.push(Object.freeze({ backend, mode, status: qualified.available ? "AVAILABLE" : "UNAVAILABLE", reason: qualified.available ? null : qualified.reason }));
    if (qualified.available) capabilities.push(Object.freeze({
      capability: "RUN_HYPERGRAPH_3EDGE_MOTIFS", algorithm: MOTIF_ALGORITHM,
      algorithmVersion: "scope4c-qualified-motif/1", taxonomyVersion: MOTIF_TAXONOMY,
      backend, graphTypes: Object.freeze(mode === "STATIC" ? ["Hypergraph", "DynamicHypergraph"] : ["DynamicHypergraph"]),
      modes: Object.freeze([mode]), adapterVersion: "candy.qualified-motif-transport/1",
      nativeBuildFingerprint: qualified.fingerprint, executionEnvironment: qualified.executionEnvironment,
      qualification: qualified.qualification, devices: Object.freeze([qualified.device]),
      limits: Object.freeze({ maxHyperedges: 256, maxIncidences: 100000, maxAggregateWork: 5000000, timeoutMs: 60000, concurrentJobs: 1 }),
    }));
  }
  return Object.freeze({
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
    capabilities: Object.freeze(capabilities),
    ...(motifDiscoveryEnabled ? { motifReadiness: Object.freeze(motifReadiness) } : {}),
  });
}
