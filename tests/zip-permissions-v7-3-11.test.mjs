import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// V7310-D19: run the actual packaging script against the real project and
// inspect the resulting ZIP's permission bits — a genuine runtime/behavioral
// check, not a source-string match (see V7310-D20 on why that distinction
// matters).

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const scriptPath = join(root, "scripts/package-portable-source.py");

const pythonCandidates = [
  process.env.PYTHON ? { command: process.env.PYTHON, prefix: [] } : null,
  { command: "python3", prefix: [] },
  { command: "python", prefix: [] },
  { command: "py", prefix: ["-3"] },
].filter(Boolean);
let python = null;
for (const candidate of pythonCandidates) {
  try {
    execFileSync(candidate.command, [...candidate.prefix, "--version"], { stdio: "ignore" });
    python = candidate;
    break;
  } catch {
    // Try the next legitimate Python launcher.
  }
}
if (!python) {
  console.log("v7.3.14 ZIP permission test SKIPPED: no Python 3 interpreter was found via PYTHON, python3, python, or py -3.");
  process.exit(0);
}

const tmpDir = mkdtempSync(join(tmpdir(), "portable-zip-test-"));
const outputZip = join(tmpDir, "output-portable.zip");

try {
  execFileSync(python.command, [...python.prefix, scriptPath, "--output", outputZip], { cwd: root, stdio: "pipe" });
  assert.ok(existsSync(outputZip), "the packaging script must produce an output ZIP");

  // Inspect the real archive's permission bits using Python's own zipfile
  // module (authoritative for how external_attr is packed), asserting the
  // exact policy from the D19 patch.
  const inspectorScript = `
import json, zipfile, sys
with zipfile.ZipFile(sys.argv[1]) as zf:
    bad = []
    modes = {}
    executables = []
    non_unix = []
    for zi in zf.infolist():
        mode = (zi.external_attr >> 16) & 0o7777
        modes[oct(mode)] = modes.get(oct(mode), 0) + 1
        if zi.create_system != 3:
            non_unix.append([zi.filename, zi.create_system])
        if mode & 0o022:
            bad.append([zi.filename, oct(mode)])
        if mode == 0o755 and not zi.filename.endswith("/"):
            executables.append(zi.filename)
    names = zf.namelist()
    print(json.dumps({
        "modes": modes,
        "worldOrGroupWritable": bad,
        "executableFiles": executables,
        "nonUnixEntries": non_unix,
        "entryCount": len(names),
    }))
`;
  const result = execFileSync(python.command, [...python.prefix, "-c", inspectorScript, outputZip], { encoding: "utf8" });
  const report = JSON.parse(result);

  assert.deepEqual(report.worldOrGroupWritable, [], `no ZIP entry may be group- or world-writable: ${JSON.stringify(report.worldOrGroupWritable)}`);
  assert.deepEqual(report.nonUnixEntries, [], `every ZIP entry must use Unix create_system metadata: ${JSON.stringify(report.nonUnixEntries)}`);
  const modeKeys = Object.keys(report.modes);
  assert.ok(modeKeys.every(m => m === "0o644" || m === "0o755"), `only 0644 (regular files) and 0755 (executable scripts) should appear; found: ${modeKeys.join(", ")}`);
  assert.ok(report.executableFiles.some(f => f.endsWith(".sh")), "at least one .sh launcher script must be marked executable (0755)");
  assert.ok(report.executableFiles.every(f => f.endsWith(".sh") || f.endsWith(".bat") || f.endsWith(".ps1")), "only .sh/.bat/.ps1 launcher scripts should be marked executable");
  assert.ok(report.entryCount > 100, "the release archive should contain the full project, not a truncated subset");

  console.log(`v7.3.14 ZIP permission normalization passed (${report.entryCount} entries, modes: ${modeKeys.join(", ")}).`);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
