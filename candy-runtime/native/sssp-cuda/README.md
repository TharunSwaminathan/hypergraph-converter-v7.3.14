# CANDY CUDA incremental SSSP candidate

This directory contains an isolated, clean-room CUDA candidate for incremental single-source shortest paths. It is not an active Studio backend and is not advertised by the CANDY Runtime Companion.

Current environment status: an RTX 5060 is visible, but no CUDA Toolkit, `nvcc`, or Compute Sanitizer is installed in Windows or WSL. Consequently this source has not been compiled or executed and must not be described as qualified.

## Intended native boundary

```text
candy-sssp-cuda --request <server-owned-request-path>
```

The request uses `CANDY_SSSP_CUDA_REQUEST_V1` and requires:

- `backend LOCAL_CUDA`;
- `mode INCREMENTAL` or `COMPARE` only;
- an ordinary graph type and exact graph/version identity;
- a validated projected-graph provenance artifact ID when applicable;
- a validated integer `cuda_device`;
- deterministic CSR arrays;
- prior distance/parent state;
- explicit delete-then-insert updates.

There is no CUDA `STATIC` mode. The candidate uses the prior property state, invalidates predecessor subtrees affected by deletions, and relaxes the updated graph on the selected GPU. A host Dijkstra pass is used only as an independent correctness oracle after GPU computation. It is never labelled CUDA static execution.

## Trusted build configuration

`CUDA_ARCH` is mandatory and has no default:

```bash
make CUDA_ARCH=sm_120
```

The example above is appropriate only after confirming the actual device/toolkit supports that target. Architecture, compiler flags, device ID, grid size, and block size are never browser/model-supplied.

## Qualification gate

Before runtime integration, all of the following remain required:

1. Compile with a compatible CUDA Toolkit.
2. Run the Scope 1 fixture corpus and seed `0x5eed1234` stress corpus.
3. Require exact distance equality against OpenMP incremental and an independent static oracle.
4. Validate both parent trees semantically.
5. Exercise invalid-device, no-device, memory-preflight, allocation, launch, synchronization, malformed-output, timeout, and cancellation cases.
6. Run Compute Sanitizer memcheck and racecheck when available.
7. Produce a trusted executable hash/manifest.
8. Only then add `LOCAL_CUDA` to capability discovery and the existing typed `SUBMIT_CANDY_JOB` backend enum.

No generated binary, object, PTX, cubin, fatbin, request, or result file belongs in source control.
