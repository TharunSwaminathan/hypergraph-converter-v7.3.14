import { spawn, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { CANDY_ERROR_CODES, CandyContractError } from "../../../src/candy/contracts/errorClasses.js";
import { verifyQualifiedCudaBackend } from "../capabilities/cudaQualification.js";
import { verifyQualifiedMotifBackend } from "../capabilities/motifQualification.js";

const toWslPath = value => `/mnt/${value[0].toLowerCase()}${value.slice(2).replaceAll("\\", "/")}`;

export class NativeProcessRunner {
  constructor({ runtimeRoot, stdoutBytes, stderrBytes, cudaBackendDiscovery, motifBackendDiscovery }) {
    this.runtimeRoot = runtimeRoot;
    this.stdoutBytes = stdoutBytes;
    this.stderrBytes = stderrBytes;
    this.cudaBackendDiscovery = cudaBackendDiscovery;
    this.motifBackendDiscovery = motifBackendDiscovery;
  }

  async trustedExecutable(backend) {
    if (["CUDA_STATIC", "CUDA_INCREMENTAL"].includes(backend)) {
      const qualified = await verifyQualifiedMotifBackend({ runtimeRoot: this.runtimeRoot, motifBackendDiscovery: this.motifBackendDiscovery }, backend);
      if (!qualified.available || !qualified.path) throw new CandyContractError(CANDY_ERROR_CODES.BACKEND_UNAVAILABLE, "The exact qualified motif backend is unavailable or stale.");
      return qualified;
    }
    if (backend === "LOCAL_CUDA") {
      const qualified = await verifyQualifiedCudaBackend({ runtimeRoot: this.runtimeRoot, cudaBackendDiscovery: this.cudaBackendDiscovery });
      if (!qualified.available || !qualified.path) throw new CandyContractError(CANDY_ERROR_CODES.BACKEND_UNAVAILABLE, "The exact qualified CUDA SSSP executable/device is unavailable.");
      return { path: qualified.path, fingerprint: qualified.fingerprint };
    }
    if (backend !== "LOCAL_OPENMP") throw new CandyContractError(CANDY_ERROR_CODES.BACKEND_UNAVAILABLE, "The requested native backend is unavailable.");
    const path = join(this.runtimeRoot, "native", "sssp-openmp", "build", "candy-sssp-openmp");
    try {
      await access(path, constants.R_OK);
    } catch {
      throw new CandyContractError(CANDY_ERROR_CODES.BUILD_MISSING, "The qualified OpenMP SSSP binary is not built.");
    }
    const fingerprint = `sha256:${createHash("sha256").update(await readFile(path)).digest("hex")}`;
    return { path, fingerprint };
  }

  async run({ backend, requestPath, timeoutMs, signal, deviceId }) {
    if (signal?.aborted) throw new CandyContractError(CANDY_ERROR_CODES.JOB_CANCELLED, "CANDY job was cancelled before spawning.");
    const executable = await this.trustedExecutable(backend);
    if (["CUDA_STATIC", "CUDA_INCREMENTAL"].includes(backend) && executable.device?.id !== deviceId) throw new CandyContractError(CANDY_ERROR_CODES.BACKEND_UNAVAILABLE, "The selected motif device is not qualified.");
    if (signal?.aborted) throw new CandyContractError(CANDY_ERROR_CODES.JOB_CANCELLED, "CANDY job was cancelled during discovery.");
    const windows = process.platform === "win32";
    const supervisor = join(this.runtimeRoot, "src", "backends", "nativeSupervisor.sh");
    const command = windows ? "wsl.exe" : "/usr/bin/setsid";
    const args = windows ? ["-d", "Ubuntu", "--exec", "/usr/bin/setsid", "--wait", "/bin/bash", toWslPath(supervisor), toWslPath(executable.path), toWslPath(requestPath)] : ["--wait", "/bin/bash", supervisor, executable.path, requestPath];
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { shell: false, cwd: dirname(requestPath), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = Buffer.alloc(0);
      let stderr = Buffer.alloc(0);
      let settled = false;
      let exited = false;
      let processGroup = null;
      let handshake = Buffer.alloc(0);
      let terminalError = null;
      let killTimer;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(killTimer);
        signal?.removeEventListener("abort", onAbort);
        callback(value);
      };
      let terminating = false;
      const terminate = () => {
        if (exited || terminating) return;
        terminating = true;
        // No native executable can start until the parent acknowledges its PID.
        // Closing stdin before that acknowledgment makes even late WSL startup safe.
        child.stdin.destroy();
        if (!processGroup) { child.kill(); return; }
        if (windows) {
          const killGroup = remaining => execFile("wsl.exe", ["-d", "Ubuntu", "--exec", "/usr/bin/kill", "--signal", "KILL", "--", `-${processGroup}`], { shell: false, windowsHide: true, timeout: 5000, maxBuffer: 1024 }, error => { if (error && remaining && !exited) killGroup(remaining - 1); });
          killGroup(1);
        } else {
          try { process.kill(-processGroup, "SIGKILL"); } catch { /* Already exited. */ }
        }
      };
      const onAbort = () => {
        terminalError ??= new CandyContractError(CANDY_ERROR_CODES.JOB_CANCELLED, "CANDY job was cancelled.");
        terminate();
      };
      const timer = setTimeout(() => {
        terminalError ??= new CandyContractError(CANDY_ERROR_CODES.PROCESS_TIMEOUT, "Native process exceeded its deterministic timeout.");
        terminate();
      }, timeoutMs);
      // Bound a broken WSL startup independently; a native child can only start
      // after the supervisor's first line identifies its killable process group.
      killTimer = setTimeout(() => { terminalError ??= new CandyContractError(CANDY_ERROR_CODES.BACKEND_UNAVAILABLE, "Native supervisor did not finish within its cleanup bound."); terminate(); child.kill(); finish(reject, terminalError); }, timeoutMs + 15000);
      signal?.addEventListener("abort", onAbort, { once: true });
      child.stdin.on("error", () => { /* WSL may exit before the acknowledgment. */ });
      if (signal?.aborted) onAbort();
      const append = (current, chunk, limit) => {
        if (current.length + chunk.length > limit) {
          terminalError ??= new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Native process output exceeded its configured bound.");
          terminate();
          return current;
        }
        return Buffer.concat([current, chunk]);
      };
      child.stdout.on("data", chunk => {
        if (!processGroup) {
          handshake = append(handshake, chunk, this.stdoutBytes);
          const newline = handshake.indexOf(10);
          if (newline < 0) return;
          const match = /^CANDY_PROCESS_GROUP:([1-9][0-9]{0,9})$/.exec(handshake.subarray(0,newline).toString("ascii"));
          if (!match) { terminalError ??= new CandyContractError(CANDY_ERROR_CODES.OUTPUT_PARSE_FAILURE, "Invalid native supervisor handshake."); child.kill(); return; }
          processGroup = Number(match[1]);
          stdout = append(stdout, handshake.subarray(newline+1), this.stdoutBytes);
          handshake = Buffer.alloc(0);
          if (terminalError || signal?.aborted) { terminating = false; terminate(); }
          else child.stdin.end("CANDY_EXECUTE\n");
        } else stdout = append(stdout, chunk, this.stdoutBytes);
      });
      child.stderr.on("data", chunk => { stderr = append(stderr, chunk, this.stderrBytes); });
      child.on("error", () => finish(reject, new CandyContractError(CANDY_ERROR_CODES.BACKEND_UNAVAILABLE, "The qualified native execution environment is unavailable.")));
      child.on("close", code => {
        exited = true;
        if (signal?.aborted) terminalError ??= new CandyContractError(CANDY_ERROR_CODES.JOB_CANCELLED, "CANDY job was cancelled.");
        if (terminalError) return finish(reject, terminalError);
        if (!processGroup) return finish(reject, new CandyContractError(CANDY_ERROR_CODES.BACKEND_UNAVAILABLE, "Native supervisor failed before execution."));
        finish(resolve, { stdout: stdout.toString("utf8"), stderr: stderr.toString("utf8"), exitCode: code, fingerprint: executable.fingerprint });
      });
    });
  }
}
