import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { intersectCandyCapabilities } from "../src/candy/capabilityDiscovery.js";
import { presentCandyCapabilities } from "../src/candy/runtimeCapabilityPresentation.js";

const openmp = {
  capability: "RUN_SSSP", algorithm: "SSSP", algorithmVersion: "scope1-openmp-sssp/1", backend: "LOCAL_OPENMP",
  adapterVersion: "candy.csr-adapter/1", graphTypes: ["OrdinaryGraph", "DynamicOrdinaryGraph", "ProjectedOrdinaryGraph"], modes: ["STATIC", "INCREMENTAL", "COMPARE"],
};
const cuda = {
  capability: "RUN_SSSP", algorithm: "SSSP", algorithmVersion: "scope3-cuda-sssp/1", backend: "LOCAL_CUDA",
  adapterVersion: "candy.cuda-adapter/1", graphTypes: ["OrdinaryGraph", "DynamicOrdinaryGraph", "ProjectedOrdinaryGraph"], modes: ["INCREMENTAL", "COMPARE"],
  nativeBuildFingerprint: `sha256:${"a".repeat(64)}`, executionEnvironment: "WSL2_CUDA",
  qualification: { schemaVersion: "candy.cuda-qualified-build/1", status: "exact_local_attestation" },
  devices: [{ id: 0, name: "Qualified Test GPU", computeCapability: "12.0", qualifiedArchitecture: "sm_120", memoryMiB: 8151 }],
};
const declaration = { schemaVersion: "candy.capabilities/1", capabilities: [openmp, cuda] };
const discovered = intersectCandyCapabilities(declaration, { authorized: true });

// Case A: a qualified runtime is visible while no graph is executable.
const noGraph = intersectCandyCapabilities(declaration, { authorized: true, graphType: "__NO_ACTIVE_GRAPH__" });
assert.deepEqual(presentCandyCapabilities({ runtimeCapabilities: discovered.capabilities, capabilities: noGraph.capabilities }), {
  qualifiedBackends: ["LOCAL_OPENMP", "LOCAL_CUDA"], executableBackends: [], cudaDevices: [cuda.devices[0]],
});

// Case B: Hypergraph keeps runtime truth but exposes no SSSP action.
const hypergraph = intersectCandyCapabilities(declaration, { authorized: true, graphType: "Hypergraph" });
assert.deepEqual(hypergraph.capabilities, []);
assert.deepEqual(presentCandyCapabilities({ runtimeCapabilities: discovered.capabilities, capabilities: hypergraph.capabilities }).qualifiedBackends, ["LOCAL_OPENMP", "LOCAL_CUDA"]);

// Case C: the deterministic OrdinaryGraph seam exposes only compatible qualified backends.
const ordinary = intersectCandyCapabilities(declaration, { authorized: true, graphType: "OrdinaryGraph" });
assert.deepEqual(ordinary.capabilities.map(item => item.backend), ["LOCAL_OPENMP", "LOCAL_CUDA"]);

// Case D: an absent companion cannot fabricate runtime or executable authority.
assert.deepEqual(presentCandyCapabilities({ runtimeCapabilities: [], capabilities: [] }), { qualifiedBackends: [], executableBackends: [], cudaDevices: [] });

// Case E: a browser declaration cannot self-assert CUDA qualification.
for (const spoof of [
  { ...cuda, qualification: undefined },
  { ...cuda, nativeBuildFingerprint: "present" },
  { ...cuda, executionEnvironment: "BROWSER_CUDA" },
  { ...cuda, adapterVersion: "candy.cuda-adapter/999" },
  { ...cuda, devices: [{ ...cuda.devices[0], id: "0" }] },
]) {
  const rejected = intersectCandyCapabilities({ schemaVersion: "candy.capabilities/1", capabilities: [spoof] }, { authorized: true, graphType: "OrdinaryGraph" });
  assert.deepEqual(rejected.capabilities, []);
}

const panel = await readFile(new URL("../src/components/CandyRuntimePanel.jsx", import.meta.url), "utf8");
assert.match(panel, /Runtime-qualified backends/);
assert.match(panel, /Executable for active graph/);
console.log("CANDY Scope 3 runtime-qualified versus active-graph-executable UI truthfulness cases A-E passed.");
