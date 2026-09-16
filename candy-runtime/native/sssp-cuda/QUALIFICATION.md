# CUDA SSSP local qualification authority

`LOCAL_CUDA` is fail-closed. A binary in `build/` is not sufficient for capability discovery.

After the native fixture, fixed-seed stress, failure-injection, and applicable Compute Sanitizer suites pass on the target machine, an operator may run:

```text
node candy-runtime/test/write-cuda-qualified-attestation.mjs --write-after-qualified-suite
```

This creates `candy-runtime/.local/cuda-qualified-build.json`. The `.local` directory is ignored because the record binds one exact, non-reproducible linked ELF to the current CUDA source, Makefile, CUDA 13.4.59 compiler, and qualified GPU. It is machine-local runtime authority, not portable source or release metadata.

At startup, the companion advertises `LOCAL_CUDA` only if every binding still matches. Rebuilding the ELF, changing source/build inputs, changing the toolchain, changing the GPU, deleting the attestation, or copying the project to another machine disables CUDA until the complete qualification is rerun and a new local attestation is written.
