#!/usr/bin/env node
// Cross-platform launcher dispatcher.
//
//   npm run start:ollama      (Studio + Ollama bridge)
//   npm run setup:model       (pull the local model)
//   npm run check:runtime     (diagnose Node / Ollama / bridge)
//   npm run bridge            (bridge only)
//
// It does not re-implement any launcher logic. It only picks the platform's existing
// script: .bat (or .ps1) on Windows, .sh everywhere else, and runs it with inherited
// stdio so prompts, Ctrl+C and exit codes behave exactly as when run directly.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export const LAUNCHERS = Object.freeze({
  ollama: "run-with-ollama",
  "setup-model": "setup-ollama-model",
  "check-runtime": "check-local-model-runtime",
  bridge: "run-local-runtime-bridge",
  dev: "run-dev",
  preview: "run-preview",
  build: "run-build",
  "clean-install": "clean-install",
});

/** Returns { command, args, options } for a launcher name on a platform, or null. */
export function resolveLauncher(name, platform = process.platform, exists = existsSync) {
  const base = LAUNCHERS[name];
  if (!base) return null;
  if (platform === "win32") {
    const bat = join(root, `${base}.bat`);
    if (exists(bat)) return { command: `"${bat}"`, args: [], options: { shell: true } };
    const ps1 = join(root, `${base}.ps1`);
    if (exists(ps1)) {
      return { command: "powershell.exe", args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1], options: {} };
    }
    return null;
  }
  const sh = join(root, `${base}.sh`);
  return exists(sh) ? { command: "bash", args: [sh], options: {} } : null;
}

function main(argv) {
  const [name] = argv;
  const plan = name ? resolveLauncher(name) : null;
  if (!plan) {
    console.error(`Usage: node scripts/launch.mjs <${Object.keys(LAUNCHERS).join("|")}>`);
    process.exit(name ? 1 : 2);
  }
  // Let the launcher own Ctrl+C so its own cleanup (stopping the bridge it started) runs.
  process.on("SIGINT", () => {});
  process.on("SIGTERM", () => {});
  const child = spawn(plan.command, plan.args, { cwd: root, stdio: "inherit", env: process.env, ...plan.options });
  child.on("error", error => {
    console.error(`Could not start the launcher: ${error.message}`);
    process.exit(1);
  });
  child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
