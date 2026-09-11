import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { CAPABILITY_SCHEMA_VERSION } from "../config.js";

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
  return Object.freeze({
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
    capabilities: native.available ? [Object.freeze({ ...QUALIFIED_SSSP_CAPABILITY, nativeBuildFingerprint: native.buildFingerprint, executionEnvironment: native.executionEnvironment, limits: config.limits })] : [],
  });
}
