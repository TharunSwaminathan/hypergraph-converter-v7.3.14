import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = await readFile(join(root, "scripts/package-portable-source.py"), "utf8");

assert.match(script, /relative_to\(root\)/);
assert.match(script, /\.as_posix\(\)/);
assert.match(script, /"\\\\" in arcname/);
assert.match(script, /backslash_entries/);
assert.match(script, /def source_sort_key\(path: Path, root: Path\) -> str:/);
assert.match(script, /return path\.relative_to\(root\)\.as_posix\(\)/);
assert.match(script, /sorted\(root\.rglob\("\*"\), key=lambda path: source_sort_key\(path, root\)\)/);
assert.doesNotMatch(script, /for path in sorted\(root\.rglob\("\*"\)\)\s*if/);
assert.match(script, /for arcname in sorted\(directory_names\):/);

const mixedNames = [
  ".gitignore",
  "DO_NOT_REGRESS.md",
  "MODEL_SETUP.md",
  "README.md",
  "check-local-model-runtime.ps1",
  "check-local-model-runtime.sh",
  "clean-install.bat",
];
const canonicalExpected = [
  ".gitignore",
  "DO_NOT_REGRESS.md",
  "MODEL_SETUP.md",
  "README.md",
  "check-local-model-runtime.ps1",
  "check-local-model-runtime.sh",
  "clean-install.bat",
];

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
    // Try the next legitimate Python 3 command.
  }
}
assert.ok(python, "portable archive ordering tests require a Python 3 interpreter");

const flavorProbeScript = `
import json
from pathlib import PurePosixPath, PureWindowsPath
names = ${JSON.stringify(mixedNames)}
print(json.dumps({
    "posix": [path.as_posix() for path in sorted(PurePosixPath(name) for name in names)],
    "windows": [path.as_posix() for path in sorted(PureWindowsPath(name) for name in names)],
}))
`;
const flavorOrders = JSON.parse(execFileSync(
  python.command,
  [...python.prefix, "-c", flavorProbeScript],
  { encoding: "utf8" },
));

assert.deepEqual(flavorOrders.posix, canonicalExpected);
assert.notDeepEqual(
  flavorOrders.windows,
  canonicalExpected,
  "concrete Path ordering is path-flavor dependent and must not define ZIP order",
);

const normalizedRelativePosix = (path, root) => path
  .slice(root.length)
  .replace(/^[/\\]+/, "")
  .replaceAll("\\", "/");
const posixRoot = "/release/hypergraph-converter";
const windowsRoot = "C:\\release\\hypergraph-converter";
const posixRepresentations = mixedNames.map(name => `${posixRoot}/${name}`);
const windowsRepresentations = mixedNames.map(name => `${windowsRoot}\\${name}`);
const canonicalSort = (paths, representedRoot) => [...paths]
  .sort((left, right) => {
    const leftKey = normalizedRelativePosix(left, representedRoot);
    const rightKey = normalizedRelativePosix(right, representedRoot);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  })
  .map(path => normalizedRelativePosix(path, representedRoot));

assert.deepEqual(canonicalSort(posixRepresentations, posixRoot), canonicalExpected);
assert.deepEqual(canonicalSort(windowsRepresentations, windowsRoot), canonicalExpected);

console.log("portable zip canonical cross-platform ordering tests passed.");
