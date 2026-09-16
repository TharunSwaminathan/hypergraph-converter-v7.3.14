# CANDY Scope 3 Phase S3C final adversarial audit

## Result

**PASS.** Open Critical: 0. Open High: 0.

## Authorization and spoofing review

`LOCAL_CUDA` is advertised only from an authenticated companion after an ignored machine-local attestation matches the exact ELF, CUDA source, Makefile, `sm_120`, nvcc 13.4.59, and GPU identity/capability. Binary presence, a portable manifest, malformed metadata, stale hashes, source/build changes, wrong toolchain, wrong device, public browser declarations, invalid fingerprints, unsupported execution environments, and incomplete device metadata do not activate CUDA. Focused UI cases A-E cover no graph, Hypergraph, OrdinaryGraph seam, absent companion, and spoofed CUDA.

The model/action set remains the active-graph intersection. Runtime display metadata is separate and cannot create execution authority. Hypergraph returns `INVALID_GRAPH_TYPE` before artifact/job/process/GPU work; projection is never implicit. Explicit CUDA never falls back to OpenMP. CUDA forbids `threads`, requires a discovered `deviceId`, supports INCREMENTAL/COMPARE only, always confirms, and binds the backend/device/timeout/graph/update/property identity.

Native selection is fixed, `shell:false` is used, and browser/model input cannot select executables, paths, CUDA flags, architecture, kernels, launch geometry, or environment variables. Native stdout/stderr and full vectors do not enter the prompt; model observations remain bounded.

## Runtime truth

The authenticated companion completed the truthful lifecycle and passed repeated status, idempotent cancellation, timeout, result validation, Hypergraph rejection, and orphan-process checks. In-GPU cancellation was not forced because the job finishes too quickly; no stronger claim is made.

The first live qwen attempt safely failed on OpenMP `threads` plus missing CUDA `deviceId`. A later fresh attempt safely failed on invalid `deviceId`/`timeoutMs`. No rejected proposal executed. Narrow prompt and zero-temperature hardening produced a final 4-call pass with two typed CUDA submissions, existing status/cancel actions, deterministic unavailable/Hypergraph/explanation bypasses, zero fallbacks, and no shell/path/kernel controls.

## Browser finding

S3C-M01 was a real Medium truthfulness defect: graph-filtered capabilities were used for display, hiding qualified runtime backends when no compatible graph was active. It did not expose an incompatible action—the executable/model set was already empty—but it obscured runtime qualification state. The panel now separates runtime-qualified from active-graph-executable capabilities. Real Mode A, Mode B/no graph, Mode B/Hypergraph, and reload checks passed with a clean console.

## Final gates

The final full source gate passed 240/240 test files, lint, production build, GitHub build, production dependency audit (0 vulnerabilities), and diff check. Both builds transformed 241 modules and emitted only the pre-existing large-chunk advisory. No dependency or later-scope addition occurred.
