import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { COMMAND_CATALOG, CATALOG_CURRENT_VERSION } from "../src/agent/deterministicNlu/commandCatalog.js";
import { ACTION_INTENT_REGISTRY_VERSION, PUBLIC_ACTION_INTENTS } from "../src/agent/actionIntentRegistry.js";

const pkg = JSON.parse((await readFile(new URL("../package.json", import.meta.url), "utf8")).replace(/^\uFEFF/, ""));
assert.equal(pkg.name, "hypergraph-converter-studio");
assert.equal(pkg.version, "7.3.13");
assert.equal(CATALOG_CURRENT_VERSION, "7.3.13");
assert.equal(ACTION_INTENT_REGISTRY_VERSION, "7.3.13");
assert.ok(COMMAND_CATALOG.length >= 90);
assert.ok(PUBLIC_ACTION_INTENTS.length >= 20);

const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
assert.match(readme, /v7\.3\.8|Deterministic Help Safety/i);

console.log("v7.3.9 regression tests passed.");
