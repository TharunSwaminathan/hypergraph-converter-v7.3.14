import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = await readFile(join(root, "scripts/package-portable-source.py"), "utf8");

assert.match(script, /relative_to\(root\)/);
assert.match(script, /\.as_posix\(\)/);
assert.match(script, /"\\\\" in arcname/);
assert.match(script, /backslash_entries/);
assert.match(script, /sorted\(root\.rglob\("\*"\)\)/);

console.log("portable zip path tests passed.");
