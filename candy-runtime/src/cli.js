import { unlink, writeFile, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { startCandyRuntime } from "./server.js";

const rootKey=createHash("sha256").update(import.meta.url).digest("hex").slice(0,16);
const artifactRoot=join(tmpdir(),`candy-runtime-owned-${rootKey}`);
const runtime = await startCandyRuntime({artifactRoot});
const pairingFile = join(tmpdir(), `candy-runtime-pairing-${rootKey}.txt`);
try {
  try { const info=await lstat(pairingFile);if(!info.isFile() || info.isSymbolicLink() || info.size>512)throw Error("Invalid stale pairing file; operator cleanup required.");await unlink(pairingFile); }
  catch(error){if(error.code!=="ENOENT")throw error;}
  await writeFile(pairingFile, runtime.pairingToken, { encoding: "utf8", mode: 0o600,flag:"wx" });
}catch(error){await runtime.close();throw error;}
console.log(`CANDY Runtime Companion listening on http://${runtime.host}:${runtime.port}.`);
console.log(`Pairing credential written to the current user's temporary directory as ${basename(pairingFile)}.`);
console.log("The credential is session-only; it is not logged by the service.");

async function stop() {
  await runtime.close();
  await unlink(pairingFile);
  process.exit(0);
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
