import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile("src/App.jsx", "utf8");
assert.match(app, /precompiledPlan/);
assert.match(app, /semanticConfidence\?\.level === "high"/);
assert.match(app, /canUseModelPlanner[\s\S]*semanticConfidence\?\.level !== "high"/);
assert.match(app, /graphRecompiled:\s*false/);

console.log("deterministic NLU graph deterministic-first tests passed.");
