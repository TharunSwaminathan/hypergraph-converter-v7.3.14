import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateCommandReferenceMarkdown } from "../src/agent/deterministicNlu/commandCatalogFormatter.js";

const checkedIn = await readFile(new URL("../docs/DETERMINISTIC_COMMAND_REFERENCE.md", import.meta.url), "utf8");
const generated = generateCommandReferenceMarkdown();

assert.equal(checkedIn, generated, "docs/DETERMINISTIC_COMMAND_REFERENCE.md is stale; run scripts/generate-deterministic-command-reference.mjs");
assert.match(checkedIn, /Generated from `src\/agent\/deterministicNlu\/commandCatalog\.js`\./);
assert.match(checkedIn, /Do not edit manually\./);

console.log("deterministic command reference drift test passed.");
