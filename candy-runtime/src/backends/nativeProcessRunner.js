import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { CANDY_ERROR_CODES, CandyContractError } from "../../../src/candy/contracts/errorClasses.js";

const toWslPath = value => `/mnt/${value[0].toLowerCase()}${value.slice(2).replaceAll("\\", "/")}`;

export class NativeProcessRunner {
  constructor({ runtimeRoot, stdoutBytes, stderrBytes }) {
    this.runtimeRoot = runtimeRoot;
    this.stdoutBytes = stdoutBytes;
    this.stderrBytes = stderrBytes;
  }

  async trustedExecutable() {
    const path = join(this.runtimeRoot, "native", "sssp-openmp", "build", "candy-sssp-openmp");
    try {
      await access(path, constants.R_OK);
    } catch {
      throw new CandyContractError(CANDY_ERROR_CODES.BUILD_MISSING, "The qualified OpenMP SSSP binary is not built.");
    }
    const fingerprint = `sha256:${createHash("sha256").update(await readFile(path)).digest("hex")}`;
    return { path, fingerprint };
  }

  async run({ requestPath, timeoutMs, signal }) {
    const executable = await this.trustedExecutable();
    const windows = process.platform === "win32";
    const command = windows ? "wsl.exe" : executable.path;
    const args = windows ? [toWslPath(executable.path), "--request", toWslPath(requestPath)] : ["--request", requestPath];
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { shell: false, cwd: dirname(requestPath), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = Buffer.alloc(0);
      let stderr = Buffer.alloc(0);
      let settled = false;
      let exited = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        callback(value);
      };
      const terminate = () => {
        if (!exited) child.kill();
        setTimeout(() => { if (!exited) child.kill("SIGKILL"); }, 500).unref();
      };
      const onAbort = () => {
        terminate();
        finish(reject, new CandyContractError(CANDY_ERROR_CODES.JOB_CANCELLED, "CANDY job was cancelled."));
      };
      const timer = setTimeout(() => {
        terminate();
        finish(reject, new CandyContractError(CANDY_ERROR_CODES.PROCESS_TIMEOUT, "Native SSSP exceeded its deterministic timeout."));
      }, timeoutMs);
      signal?.addEventListener("abort", onAbort, { once: true });
      const append = (current, chunk, limit) => {
        if (current.length + chunk.length > limit) {
          terminate();
          finish(reject, new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Native process output exceeded its configured bound."));
          return current;
        }
        return Buffer.concat([current, chunk]);
      };
      child.stdout.on("data", chunk => { stdout = append(stdout, chunk, this.stdoutBytes); });
      child.stderr.on("data", chunk => { stderr = append(stderr, chunk, this.stderrBytes); });
      child.on("error", () => finish(reject, new CandyContractError(CANDY_ERROR_CODES.BACKEND_UNAVAILABLE, "The qualified native execution environment is unavailable.")));
      child.on("close", code => {
        exited = true;
        if (signal?.aborted) return onAbort();
        finish(resolve, { stdout: stdout.toString("utf8"), stderr: stderr.toString("utf8"), exitCode: code, fingerprint: executable.fingerprint });
      });
    });
  }
}
