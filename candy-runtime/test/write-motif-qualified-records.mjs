// Local operator action; records are ignored and never include credentials.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { MOTIF_ALGORITHM, MOTIF_TAXONOMY } from "../../src/candy/contracts/runtimeMotif.js";
import { MOTIF_SPECS, MOTIF_RECORD_SCHEMA, motifRecordPath, motifEvidencePaths, sha256, verifyQualifiedMotifBackend, inspectMotifQualificationEnvironment } from "../src/capabilities/motifQualification.js";

const runtimeRoot = resolve(fileURLToPath(new URL("../",import.meta.url)));
const root = resolve(runtimeRoot,"..");
const environment = await inspectMotifQualificationEnvironment();
if (environment.nvccVersion !== "13.4.59" || environment.device?.computeCapability !== "12.0") throw new Error("Qualified CUDA environment is unavailable");
await mkdir(join(runtimeRoot,".local"),{recursive:true,mode:0o700});
for (const [backend,spec] of Object.entries(MOTIF_SPECS)) {
  const nativeRoot = join(runtimeRoot,"native",spec.directory);
  const evidence = {};
  for (const path of motifEvidencePaths(spec)) evidence[path] = sha256(await readFile(join(root,path)));
  const record = {
    schemaVersion: MOTIF_RECORD_SCHEMA, backend, algorithm: MOTIF_ALGORITHM, taxonomyVersion: MOTIF_TAXONOMY,
    binarySha256: sha256(await readFile(join(nativeRoot,"build",spec.binary))),
    sourceSha256: sha256(await readFile(join(nativeRoot,"src","main.cu"))),
    makefileSha256: sha256(await readFile(join(nativeRoot,"Makefile"))), qualifiedCommit: spec.commit,
    architecture: "sm_120", nvccVersion: environment.nvccVersion, runtimeVersion: environment.runtimeVersion, runtimePackageVersion: environment.runtimePackageVersion, device: environment.device, evidence,
  };
  await writeFile(motifRecordPath(runtimeRoot,backend),JSON.stringify(record,null,2)+"\n",{mode:0o600});
  const verified = await verifyQualifiedMotifBackend({runtimeRoot},backend);
  if (!verified.available) throw new Error(`${backend}: generated operator record failed exact verification`);
  console.log(`${backend}: AVAILABLE (${verified.fingerprint})`);
}
