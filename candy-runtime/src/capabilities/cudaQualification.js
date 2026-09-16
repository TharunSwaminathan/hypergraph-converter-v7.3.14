import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, normalize } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SCHEMA = "candy.cuda-qualified-build/1";
const BINARY_RELATIVE = join("native", "sssp-cuda", "build", "candy-sssp-cuda");
const MANIFEST_RELATIVE = join(".local", "cuda-qualified-build.json");
const SOURCE_RELATIVE = join("native", "sssp-cuda", "src", "main.cu");
const MAKEFILE_RELATIVE = join("native", "sssp-cuda", "Makefile");
const NVCC_PATH = "/usr/local/cuda-13.4/bin/nvcc";
const NVCC_VERSION = "13.4.59";
const HEX = /^[a-f0-9]{64}$/;

export const CUDA_QUALIFICATION_SCHEMA = SCHEMA;
export const CUDA_QUALIFICATION_ATTESTATION_RELATIVE = MANIFEST_RELATIVE;
export const CUDA_QUALIFIED_BINARY_RELATIVE = BINARY_RELATIVE;

function exactKeys(value, required) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === required.length
    && required.every(key => Object.hasOwn(value, key));
}

function validateManifest(value) {
  if (!exactKeys(value, ["schemaVersion", "backend", "algorithm", "algorithmVersion", "adapterVersion", "executable", "build", "device", "qualification"])) return null;
  if (value.schemaVersion !== SCHEMA || value.backend !== "LOCAL_CUDA" || value.algorithm !== "SSSP" || value.algorithmVersion !== "scope3-cuda-sssp/1" || value.adapterVersion !== "candy.cuda-adapter/1") return null;
  if (!exactKeys(value.executable, ["relativePath", "sha256"]) || normalize(value.executable.relativePath) !== normalize(BINARY_RELATIVE) || !HEX.test(value.executable.sha256)) return null;
  if (!exactKeys(value.build, ["qualifiedArchitecture", "nvccVersion", "sourceSha256", "makefileSha256"]) || value.build.qualifiedArchitecture !== "sm_120" || value.build.nvccVersion !== NVCC_VERSION || !HEX.test(value.build.sourceSha256) || !HEX.test(value.build.makefileSha256)) return null;
  if (!exactKeys(value.device, ["id", "name", "computeCapability", "memoryMiB"]) || !Number.isInteger(value.device.id) || value.device.id < 0 || value.device.id > 255 || typeof value.device.name !== "string" || value.device.computeCapability !== "12.0" || !Number.isInteger(value.device.memoryMiB) || value.device.memoryMiB < 1) return null;
  if (!exactKeys(value.qualification, ["fixtures", "stressCases", "seed", "memcheck", "racecheck", "initcheck", "synccheck"]) || value.qualification.fixtures !== 12 || value.qualification.stressCases !== 40 || value.qualification.seed !== "0x5eed1234" || ["memcheck", "racecheck", "initcheck", "synccheck"].some(key => value.qualification[key] !== "PASS")) return null;
  return value;
}

function parseDeviceLine(stdout) {
  const line = String(stdout).trim().split(/\r?\n/)[0] ?? "";
  const match = /^(\d+)\s*,\s*(.+?)\s*,\s*(\d+)\s*,\s*([0-9]+(?:\.[0-9]+)?)$/.exec(line);
  if (!match) return null;
  return { id: Number(match[1]), name: match[2].slice(0, 160), memoryMiB: Number(match[3]), computeCapability: match[4] };
}

async function probeCudaDevice() {
  const args = ["--query-gpu=index,name,memory.total,compute_cap", "--format=csv,noheader,nounits", "--id=0"];
  const command = process.platform === "win32" ? "wsl.exe" : "nvidia-smi";
  const commandArgs = process.platform === "win32" ? ["/usr/lib/wsl/lib/nvidia-smi", ...args] : args;
  const { stdout } = await execFileAsync(command, commandArgs, { timeout: 5_000, maxBuffer: 16 * 1024, windowsHide: true, shell: false });
  return parseDeviceLine(stdout);
}

async function probeNvccVersion() {
  const command = process.platform === "win32" ? "wsl.exe" : NVCC_PATH;
  const args = process.platform === "win32" ? ["-e", NVCC_PATH, "--version"] : ["--version"];
  const { stdout } = await execFileAsync(command, args, { timeout: 5_000, maxBuffer: 16 * 1024, windowsHide: true, shell: false });
  const match = /\bV([0-9]+\.[0-9]+\.[0-9]+)\b/.exec(stdout);
  return match?.[1] ?? null;
}

export async function inspectCudaQualificationEnvironment() {
  const [device, nvccVersion] = await Promise.all([probeCudaDevice(), probeNvccVersion()]);
  return { device, nvccVersion };
}

export async function verifyQualifiedCudaBackend(config) {
  if (config.cudaBackendDiscovery) return Object.freeze({ ...config.cudaBackendDiscovery });
  const manifestPath = join(config.runtimeRoot, MANIFEST_RELATIVE);
  const binaryPath = join(config.runtimeRoot, BINARY_RELATIVE);
  try {
    const manifest = validateManifest(JSON.parse(await readFile(manifestPath, "utf8")));
    if (!manifest) return { available: false, reason: "qualification_manifest_invalid" };
    await access(binaryPath, constants.R_OK);
    const executableHash = createHash("sha256").update(await readFile(binaryPath)).digest("hex");
    if (executableHash !== manifest.executable.sha256) return { available: false, reason: "executable_fingerprint_mismatch" };
    const sourceHash = createHash("sha256").update(await readFile(join(config.runtimeRoot, SOURCE_RELATIVE))).digest("hex");
    const makefileHash = createHash("sha256").update(await readFile(join(config.runtimeRoot, MAKEFILE_RELATIVE))).digest("hex");
    if (sourceHash !== manifest.build.sourceSha256 || makefileHash !== manifest.build.makefileSha256) return { available: false, reason: "qualified_source_mismatch" };
    const { device, nvccVersion } = await inspectCudaQualificationEnvironment();
    if (nvccVersion !== manifest.build.nvccVersion) return { available: false, reason: "qualified_toolchain_mismatch" };
    if (!device || device.id !== manifest.device.id || device.name !== manifest.device.name || device.computeCapability !== manifest.device.computeCapability || device.memoryMiB !== manifest.device.memoryMiB) return { available: false, reason: "qualified_device_mismatch" };
    return Object.freeze({
      available: true,
      path: binaryPath,
      fingerprint: `sha256:${executableHash}`,
      executionEnvironment: process.platform === "win32" ? "WSL2_CUDA" : "LINUX_CUDA",
      adapterVersion: manifest.adapterVersion,
      qualification: Object.freeze({ schemaVersion: SCHEMA, status: "exact_local_attestation" }),
      device: Object.freeze({ ...device, qualifiedArchitecture: manifest.build.qualifiedArchitecture }),
    });
  } catch {
    return { available: false, reason: "cuda_qualification_unavailable" };
  }
}
