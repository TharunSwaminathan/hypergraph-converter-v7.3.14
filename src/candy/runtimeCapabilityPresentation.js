export function presentCandyCapabilities(candy = {}) {
  const runtime = Array.isArray(candy.runtimeCapabilities) ? candy.runtimeCapabilities : [];
  const executable = Array.isArray(candy.capabilities) ? candy.capabilities : [];
  return Object.freeze({
    qualifiedBackends: Object.freeze(runtime.map(item => item.backend)),
    executableBackends: Object.freeze(executable.map(item => item.backend)),
    cudaDevices: Object.freeze(runtime.flatMap(item => item.backend === "LOCAL_CUDA" ? item.devices ?? [] : [])),
  });
}
