import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../candy-runtime/native/sssp-cuda/src/main.cu", import.meta.url), "utf8");
const makefile = await readFile(new URL("../candy-runtime/native/sssp-cuda/Makefile", import.meta.url), "utf8");
const provenance = await readFile(new URL("../candy-runtime/native/upstream/MOSP-CUDA-PROVENANCE.md", import.meta.url), "utf8");
const capabilities = await readFile(new URL("../candy-runtime/src/capabilities/capabilityRegistry.js", import.meta.url), "utf8");

assert.match(source, /argc != 3/);
assert.match(source, /--request/);
assert.match(source, /CANDY_SSSP_CUDA_REQUEST_V1/);
assert.match(source, /backend != "LOCAL_CUDA"/);
assert.match(source, /mode != "INCREMENTAL" && request\.mode != "COMPARE"/);
assert.match(source, /CUDA STATIC is not implemented/);
assert.match(source, /INVALID_GRAPH_TYPE/);
assert.match(source, /no projection was performed/);
assert.match(source, /cudaGetDeviceCount/);
assert.match(source, /cudaSetDevice/);
assert.match(source, /cudaGetDeviceProperties/);
assert.match(source, /cudaMemGetInfo/);
assert.match(source, /checked_bytes/);
assert.match(source, /cudaMalloc/);
assert.match(source, /cudaMemcpy/);
assert.match(source, /cudaMemset/);
assert.match(source, /cudaGetLastError/);
assert.match(source, /cudaDeviceSynchronize/);
assert.match(source, /cudaFree/);
assert.match(source, /atomicMin\s*\(/);
assert.match(source, /atomic(?:Add|Exch)\s*\(/);
assert.match(source, /RESULT_VALIDATION_FAILURE/);
assert.match(source, /gpu\.distances != reference/);
assert.match(source, /static_reference/);
assert.match(source, /parent_tree/);
assert.match(source, /CANDY_TEST_FORCE_MEMORY_REFUSAL/);
assert.match(source, /CANDY_TEST_FORCE_LAUNCH_FAILURE/);
assert.doesNotMatch(source, /system\s*\(|popen\s*\(|exec\s*\(/);
assert.doesNotMatch(source, /MOSP|Pareto|CombinedGraph/);

assert.match(makefile, /CUDA_ARCH \?=\s*$/m);
assert.match(makefile, /CUDA_ARCH is required/);
assert.doesNotMatch(makefile, /sm_70|sm_80|sm_86|sm_120/);
assert.match(makefile, /-arch=\$\(CUDA_ARCH\)/);
assert.match(provenance, /290C2670B5C037BBCF595E5058250A6097D99DBCC8DF714E9CE932E62C26EDCF/);
assert.match(provenance, /No `LICENSE`/);
assert.match(provenance, /independently authored/);
assert.doesNotMatch(capabilities, /LOCAL_CUDA/);

console.log("CANDY Scope 3 S3B isolated CUDA source/provenance static gate passed; runtime qualification remains environment-blocked.");
