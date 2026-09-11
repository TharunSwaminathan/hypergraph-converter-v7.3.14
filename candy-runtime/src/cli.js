import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startCandyRuntime } from "./server.js";

const runtime = await startCandyRuntime();
const pairingFile = join(tmpdir(), `candy-runtime-pairing-${process.pid}.txt`);
await writeFile(pairingFile, runtime.pairingToken, { encoding: "utf8", mode: 0o600 });
console.log(`CANDY Runtime Companion listening on http://${runtime.host}:${runtime.port}.`);
console.log(`Pairing credential written to the current user's temporary directory as candy-runtime-pairing-${process.pid}.txt.`);
console.log("The credential is session-only; it is not logged by the service.");

async function stop() {
  await runtime.close();
  await unlink(pairingFile).catch(() => {});
  process.exit(0);
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
