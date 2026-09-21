export function presentCandyCapabilities(candy = {}) {
  const runtime = Array.isArray(candy.runtimeCapabilities) ? candy.runtimeCapabilities : [];
  const executable = Array.isArray(candy.capabilities) ? candy.capabilities : [];
  const cudaDevices = [];
  const physicalDevices = new Set();
  for (const capability of runtime) {
    if (!["LOCAL_CUDA","CUDA_STATIC","CUDA_INCREMENTAL"].includes(capability.backend)) continue;
    for (const device of capability.devices ?? []) {
      const identity = JSON.stringify([device.id, device.name, device.computeCapability, device.qualifiedArchitecture, device.memoryMiB]);
      if (physicalDevices.has(identity)) continue;
      physicalDevices.add(identity);
      cudaDevices.push(device);
    }
  }
  return Object.freeze({
    qualifiedBackends: Object.freeze(runtime.map(item => item.backend)),
    executableBackends: Object.freeze(executable.map(item => item.backend)),
    cudaDevices: Object.freeze(cudaDevices),
  });
}
