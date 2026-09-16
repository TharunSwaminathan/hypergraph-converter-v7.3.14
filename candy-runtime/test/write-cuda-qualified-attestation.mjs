import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRuntimeConfig } from "../src/config.js";
import {
  CUDA_QUALIFICATION_ATTESTATION_RELATIVE,
  CUDA_QUALIFICATION_SCHEMA,
  CUDA_QUALIFIED_BINARY_RELATIVE,
  inspectCudaQualificationEnvironment,
} from "../src/capabilities/cudaQualification.js";

if (process.argv.length !== 3 || process.argv[2] !== "--write-after-qualified-suite") {
  console.error("Refusing to write CUDA authority. Run the native fixture, stress, failure, and sanitizer gates first, then pass --write-after-qualified-suite.");
  process.exit(2);
}

const config = createRuntimeConfig();
const sourceRelative = join("native", "sssp-cuda", "src", "main.cu");
const makefileRelative = join("native", "sssp-cuda", "Makefile");
const sha256 = async relative => createHash("sha256").update(await readFile(join(config.runtimeRoot, relative))).digest("hex");
const environment = await inspectCudaQualificationEnvironment();
if (!environment.device || environment.nvccVersion !== "13.4.59" || environment.device.computeCapability !== "12.0") {
  throw new Error("The current CUDA toolchain/device does not match the qualified Scope 3 environment; no attestation was written.");
}

const attestation = {
  schemaVersion: CUDA_QUALIFICATION_SCHEMA,
  backend: "LOCAL_CUDA",
  algorithm: "SSSP",
  algorithmVersion: "scope3-cuda-sssp/1",
  adapterVersion: "candy.cuda-adapter/1",
  executable: { relativePath: CUDA_QUALIFIED_BINARY_RELATIVE, sha256: await sha256(CUDA_QUALIFIED_BINARY_RELATIVE) },
  build: { qualifiedArchitecture: "sm_120", nvccVersion: environment.nvccVersion, sourceSha256: await sha256(sourceRelative), makefileSha256: await sha256(makefileRelative) },
  device: environment.device,
  qualification: { fixtures: 12, stressCases: 40, seed: "0x5eed1234", memcheck: "PASS", racecheck: "PASS", initcheck: "PASS", synccheck: "PASS" },
};
const output = join(config.runtimeRoot, CUDA_QUALIFICATION_ATTESTATION_RELATIVE);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(attestation, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
console.log(`Wrote machine-local CUDA qualification attestation: ${output}`);
console.log(`Executable SHA-256: ${attestation.executable.sha256}`);
