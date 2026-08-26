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

let python;
try {
  execFileSync("python3", ["--version"], { stdio: "ignore" });
  python = "python3";
} catch {
  console.log("v7.3.11 ZIP permission test SKIPPED: python3 not available in this environment.");
  process.exit(0);
}

const tmpDir = mkdtempSync(join(tmpdir(), "portable-zip-test-"));
const outputZip = join(tmpDir, "output-portable.zip");

try {
  execFileSync(python, [scriptPath, "--output", outputZip], { cwd: root, stdio: "pipe" });
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
    for zi in zf.infolist():
        mode = (zi.external_attr >> 16) & 0o7777
        modes[oct(mode)] = modes.get(oct(mode), 0) + 1
        if mode & 0o022:
            bad.append([zi.filename, oct(mode)])
        if mode == 0o755 and not zi.filename.endswith("/"):
            executables.append(zi.filename)
    names = zf.namelist()
    print(json.dumps({
        "modes": modes,
        "worldOrGroupWritable": bad,
        "executableFiles": executables,
        "entryCount": len(names),
    }))
`;
  const result = execFileSync(python, ["-c", inspectorScript, outputZip], { encoding: "utf8" });
  const report = JSON.parse(result);

  assert.deepEqual(report.worldOrGroupWritable, [], `no ZIP entry may be group- or world-writable: ${JSON.stringify(report.worldOrGroupWritable)}`);
  const modeKeys = Object.keys(report.modes);
  assert.ok(modeKeys.every(m => m === "0o644" || m === "0o755"), `only 0644 (regular files) and 0755 (executable scripts) should appear; found: ${modeKeys.join(", ")}`);
  assert.ok(report.executableFiles.some(f => f.endsWith(".sh")), "at least one .sh launcher script must be marked executable (0755)");
  assert.ok(report.executableFiles.every(f => f.endsWith(".sh") || f.endsWith(".bat") || f.endsWith(".ps1")), "only .sh/.bat/.ps1 launcher scripts should be marked executable");
  assert.ok(report.entryCount > 100, "the release archive should contain the full project, not a truncated subset");

  console.log(`v7.3.11 ZIP permission normalization passed (${report.entryCount} entries, modes: ${modeKeys.join(", ")}).`);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
