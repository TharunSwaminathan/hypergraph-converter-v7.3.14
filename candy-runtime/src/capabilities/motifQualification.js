import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, lstat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { MOTIF_ALGORITHM, MOTIF_TAXONOMY } from "../../../src/candy/contracts/runtimeMotif.js";
import { qualificationJsonCache } from "./qualificationJson.js";

const exec = promisify(execFile);
export async function inspectMotifQualificationEnvironment() {
  const probe = async (path, args = []) => (await exec(process.platform === "win32" ? "wsl.exe" : path, process.platform === "win32" ? ["-d", "Ubuntu", "--exec", path, ...args] : args, {shell:false,windowsHide:true,timeout:5000,maxBuffer:16384})).stdout;
  const [gpu, compiler, installed] = await Promise.all([
    probe(process.platform === "win32" ? "/usr/lib/wsl/lib/nvidia-smi" : "/usr/bin/nvidia-smi", ["--query-gpu=index,name,memory.total,compute_cap", "--format=csv,noheader,nounits", "--id=0"]),
    probe("/usr/local/cuda-13.4/bin/nvcc", ["--version"]),
    probe("/usr/bin/cat", ["/usr/local/cuda-13.4/version.json"]),
  ]);
  const parts = /^(\d+)\s*,\s*(.+?)\s*,\s*(\d+)\s*,\s*([0-9.]+)$/.exec(gpu.trim().split(/\r?\n/)[0]);
  const runtime = JSON.parse(installed).cuda_cudart?.version;
  if (!parts || runtime !== "13.4.49") throw new Error("Unavailable qualified CUDA device/runtime");
  return {device:{id:Number(parts[1]),name:parts[2],memoryMiB:Number(parts[3]),computeCapability:parts[4]},nvccVersion:/V([0-9.]+)/.exec(compiler)?.[1] ?? null,runtimeVersion:13040,runtimePackageVersion:runtime};
}
export const MOTIF_RECORD_SCHEMA = "candy.motif-qualified-build/1";
export const MOTIF_SPECS = Object.freeze({
  CUDA_STATIC: { directory: "hypergraph-motif-cuda", binary: "candy-hypergraph-motif-cuda", scope: "4b1", tag: "candy-integration-scope4b1-cuda-static-qualified", commit: "a27eb1246e342097de448408ffa0a4775545c4ae", cases: 487, failures: 69 },
  CUDA_INCREMENTAL: { directory: "hypergraph-motif-cuda-incremental-scope6d-tranche1-f3fa7dc3", binary: "candy-hypergraph-motif-cuda-incremental", scope: "6d-tranche1", tag: "candy-integration-scope6d-tranche1-native-qualified", commit: "f3fa7dc3d0c1ac3ef927b080da79b004ce93f0f0", cases: 405, failures: 104 },
});
export const motifRecordPath = (runtimeRoot, backend) => join(runtimeRoot, ".local", backend === "CUDA_INCREMENTAL" ? "cuda_incremental-scope6d-tranche1-f3fa7dc3-qualified-build.json" : `${backend.toLowerCase()}-qualified-build.json`);
export const motifEvidencePaths = spec => ["native", "memcheck", "racecheck", "initcheck", "synccheck"].map(kind => `artifacts/candy-scope${spec.scope}-cuda-${spec.scope === "4b1" ? "static" : "incremental"}-${kind}-qualification.json`);
export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const exact = (v, keys) => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v,k));
async function regularBytes(path, max = 16 * 1024 * 1024) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > max) throw new Error("Not a bounded regular qualified file");
  return readFile(path);
}
export async function verifyQualifiedMotifBackend(config, backend, round = null) {
  const spec = MOTIF_SPECS[backend];
  if (!spec) return { available: false, reason: "unknown_motif_backend" };
  // Only in-process test configuration can inject discovery, never HTTP/model input.
  if (config.motifBackendDiscovery) return Object.freeze({ ...(config.motifBackendDiscovery[backend] ?? { available: false }) });
  try {
    const recordBytes = await regularBytes(motifRecordPath(config.runtimeRoot, backend), 32 * 1024);
    if (backend === "CUDA_INCREMENTAL" && sha256(recordBytes) !== "065ba1a42fcf8b641104f67c26661364ca4aa293d2489cd4a8146a97e03b312f") throw new Error("Unapproved incremental record");
    const record = qualificationJsonCache.parse(recordBytes);
    if (!exact(record, ["schemaVersion", "backend", "algorithm", "taxonomyVersion", "binarySha256", "sourceSha256", "makefileSha256", "qualifiedCommit", "architecture", "nvccVersion", "runtimeVersion", "runtimePackageVersion", "device", "evidence"])
      || record.schemaVersion !== MOTIF_RECORD_SCHEMA || record.backend !== backend || record.algorithm !== MOTIF_ALGORITHM || record.taxonomyVersion !== MOTIF_TAXONOMY
      || record.qualifiedCommit !== spec.commit || record.architecture !== "sm_120" || record.nvccVersion !== "13.4.59" || record.runtimeVersion !== 13040 || record.runtimePackageVersion !== "13.4.49") throw new Error("Invalid record");
    const nativeRoot = join(config.runtimeRoot, "native", spec.directory);
    const path = join(nativeRoot, "build", spec.binary);
    for (const [file, hash] of [[path, record.binarySha256], [join(nativeRoot,"src","main.cu"),record.sourceSha256], [join(nativeRoot,"Makefile"),record.makefileSha256]]) {
      if (!/^[a-f0-9]{64}$/.test(hash) || sha256(await regularBytes(file)) !== hash) throw new Error("Stale file");
    }
    const root = resolve(config.runtimeRoot, "..");
    const evidencePaths = motifEvidencePaths(spec);
    if (!exact(record.evidence, evidencePaths)) throw new Error("Invalid evidence binding");
    for (const file of evidencePaths) {
      const bytes = await regularBytes(join(root,file));
      if (sha256(bytes) !== record.evidence[file]) throw new Error("Stale evidence");
      const evidence = qualificationJsonCache.parse(bytes);
      if (evidence.status !== "NATIVE_QUALIFICATION_PASS" || evidence.failed !== 0 || evidence.binarySha256 !== record.binarySha256) throw new Error("Unqualified evidence");
      if (file.includes("-native-") && (evidence.cases.length !== spec.cases || evidence.failures.length !== spec.failures)) throw new Error("Incomplete native evidence");
      if (file.includes("-native-") && evidence.device?.runtimeVersion !== record.runtimeVersion) throw new Error("Runtime evidence mismatch");
      if (!file.includes("-native-") && evidence.cases.length !== (spec.scope === "4b1" ? 3 : 6)) throw new Error("Incomplete sanitizer evidence");
    }
    const { stdout } = await exec("git", ["rev-parse", `${spec.tag}^{}`], { cwd: root, shell: false, windowsHide: true, timeout: 5000, maxBuffer: 1024 });
    if (stdout.trim() !== spec.commit) throw new Error("Qualification tag mismatch");
    const { device, nvccVersion } = await (round ? round.environment() : inspectMotifQualificationEnvironment());
    if (!exact(record.device,["id","name","computeCapability","memoryMiB"]) || !device || record.device.id !== 0
      || device.id !== record.device.id || device.name !== record.device.name || device.computeCapability !== "12.0"
      || device.computeCapability !== record.device.computeCapability || device.memoryMiB !== record.device.memoryMiB || nvccVersion !== record.nvccVersion) throw new Error("Device/toolchain mismatch");
    return Object.freeze({ available: true, path, fingerprint: `sha256:${record.binarySha256}`, executionEnvironment: process.platform === "win32" ? "WSL2_CUDA" : "LINUX_CUDA", qualification: Object.freeze({ schemaVersion: MOTIF_RECORD_SCHEMA, status: "exact_local_operator_record" }), device: Object.freeze({ ...device, qualifiedArchitecture: record.architecture }) });
  } catch { return { available: false, reason: "motif_qualification_unavailable_or_stale" }; }
}
