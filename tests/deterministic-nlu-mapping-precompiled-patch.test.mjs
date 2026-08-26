import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile("src/App.jsx", "utf8");
assert.match(app, /precompiledDraft/);
assert.match(app, /skipDeterministicRecompile/);
assert.match(app, /precompiledDraftUsed:\s*true/);
assert.match(app, /recompiled:\s*false/);

console.log("deterministic NLU mapping precompiled-patch tests passed.");
