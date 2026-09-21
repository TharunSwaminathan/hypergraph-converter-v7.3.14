import { startCandyRuntime } from "../src/server.js";
const runtime = await startCandyRuntime({port:0});
process.send?.({port:runtime.port,pairingToken:runtime.pairingToken,pid:process.pid,platform:process.platform});
const close = async () => { await runtime.close(); process.exit(0); };
process.on("message", message => { if (message === "close") close().catch(() => process.exit(1)); });
process.on("SIGTERM", () => close().catch(() => process.exit(1)));
