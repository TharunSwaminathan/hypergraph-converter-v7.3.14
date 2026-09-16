# CANDY Scope 3 Phase S3A audit

> Final reconciliation: this report preserves the original environment-gated S3A audit point. The blocker was later resolved without changing S3A's graph-type or no-fallback conclusions; the protected blocked checkpoint remains at `81491e4a04b4d33adb3ebd0679cbe196ce109288`, and final Scope 3 qualification is recorded in the implementation and S3B/S3C reports.

## Result

**PASS_FOR_UNQUALIFIED_PREPARATION.** The permanent graph-type boundary and explicit-backend no-fallback rule are enforced while `LOCAL_CUDA` remains absent from production request and capability registries. Open Critical: 0. Open High: 0.

## Environment gate

The qualification host exposes an NVIDIA GeForce RTX 5060 to Windows and WSL2 (driver 616.92, 8151 MiB, compute capability 12.0). Neither environment has `nvcc`; no CUDA toolkit directory or Compute Sanitizer is present. No driver/toolkit installation or system change was attempted. Runtime qualification is therefore blocked.

## Compatibility map

| Concern | Existing qualified OpenMP | Isolated CUDA candidate | Production change |
| --- | --- | --- | --- |
| Product/action | `SSSP` / `SUBMIT_CANDY_JOB` | Same intended product; no new action | Unchanged |
| Graph types | Ordinary, DynamicOrdinary, validated ProjectedOrdinary | Same types; rejects Hypergraph first | Validation precedence hardened |
| Modes | STATIC, INCREMENTAL, COMPARE | INCREMENTAL, COMPARE only | CUDA not registered |
| Resources | bounded `threads`, `timeoutMs` | candidate parses trusted integer `cuda_device`; launch geometry is backend-owned | OpenMP schema unchanged |
| Artifact/job/status/result | Scope 2 contracts | Future adapter must reuse them after qualification | Unchanged |
| Capability discovery | Qualified `LOCAL_OPENMP` only | Must require runtime, device, executable fingerprint, and qualification manifest | Unchanged |
| Confirmation | Existing OpenMP binding | Future CUDA binding must include backend/device | Not implemented or weakened |

Unchanged modules include the companion server, capability registry, job manager, artifact store, native process runner, frontend capability intersection, request policy, result observation, ReAct tool registry, and confirmation policy.

## Adversarial review

- No CUDA `STATIC` capability is exposed.
- No device, architecture flag, kernel, executable path, or environment value is accepted from browser/model actions.
- Explicit CUDA never falls back to OpenMP.
- Hypergraph and DynamicHypergraph requests return `INVALID_GRAPH_TYPE` before backend availability; no artifact, native launch, allocation, projection, or model invention occurs.
- No unqualified device/backend appears in capability discovery.
- The existing no-preference route continues to delegate to the qualified deterministic default.

## Correctives

Closed S3A-H01 and S3A-H02 (High) and S3A-M01 (Medium, including the required “Use the GPU for this shortest-path update” wording). Focused S3A tests pass; Scope 1 Phase A and all five Scope 2 test files also pass.
