# CANDY Scope 3 Phase S3B final audit

## Result

**PASS.** The original environment blocker is preserved in commit/tag `81491e4` / `candy-integration-scope3-cuda-env-blocked` and is now closed for this qualification host. Open Critical: 0. Open High: 0.

## Native evidence

The independently authored CUDA candidate built for `sm_120` on CUDA 13.4 / nvcc 13.4.59 and an RTX 5060 (compute capability 12.0). The first candidate compile required no implementation correction. Final native execution passed 12 fixture families, 40 fixed-seed stress cases (`0x5eed1234`), exact CUDA/OpenMP/reference distance parity, parent-tree validation, zero-weight/equal-cost cases, and an 18-case adversarial failure matrix.

Memory preflight, bounded output, invalid-device handling, checked allocation, kernel launch, synchronization, nonconvergence, comparison mismatch, stale state, malformed input, weight-model, resource-limit, and graph-type failures were truthful. Memcheck reported zero real production errors; racecheck reported zero applicable hazards; initcheck and synccheck passed where applicable. The qualification-only invalid-launch misuse is intentionally excluded from production-candidate sanitizer failure accounting.

## Findings and correctives

- S3B-B01 preserved the original missing-toolkit environment blocker and was closed only after CUDA 13.4, nvcc, and Compute Sanitizer became available and native qualification completed.
- S3B-H01 corrected the qualification oracle's zero-weight parent-cycle construction; candidate correctness remained independently checked.
- S3B-H02 corrected stale graph-version error taxonomy in the candidate.
- S3B-M01 made sanitizer qualification parse JSON from the tool-compatible output stream without trusting arbitrary text.
- S3B-M02 recognized the racecheck-specific clean footer while continuing to fail on hazards/errors.

## Build identity

Candidate source SHA-256: `e854c2643a27292267ae84a19ebf325ccd7cca47d2d2ef319c8cd32d4a042086`. Makefile SHA-256: `3eadaff386e8c579f53ea7bf0f0a394135c2b455de771cb221594dfe32e29f62`. The qualified local ELF observed for the final run was `7670cf1fadfe5c44aa7abeeb0121fdba0fb5cde7357c07e9ae85b6adb02a07bf`. Clean links were not byte-reproducible, so the ELF fingerprint is machine-local qualification state rather than portable repository authority.

No MOSP product, Pareto logic, general GPU execution, CUDA STATIC claim, projection workflow, or later phase was added.
