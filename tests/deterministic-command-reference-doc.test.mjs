import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateCommandReferenceMarkdown } from "../src/agent/deterministicNlu/commandCatalogFormatter.js";

const checkedIn = await readFile(new URL("../docs/DETERMINISTIC_COMMAND_REFERENCE.md", import.meta.url), "utf8");
const generated = generateCommandReferenceMarkdown();

function assertCurrentReference(actual, expected) {
  const normalizeEol = text => text.replace(/\r\n/g, "\n");
  assert.equal(normalizeEol(actual), normalizeEol(expected), "docs/DETERMINISTIC_COMMAND_REFERENCE.md is stale; run scripts/generate-deterministic-command-reference.mjs");
}

assertCurrentReference(checkedIn, generated);
assert.match(checkedIn, /Generated from `src\/agent\/deterministicNlu\/commandCatalog\.js`\./);
assert.match(checkedIn, /Do not edit manually\./);

const lf = generated.replace(/\r\n/g, "\n");
const crlf = lf.replace(/\n/g, "\r\n");
assertCurrentReference(lf, lf);
assertCurrentReference(crlf, lf);
assertCurrentReference(lf, crlf);
assertCurrentReference(crlf, crlf);

const mutations = [
  lf.replace("# Deterministic Command Reference", "# Changed Command Reference"),
  lf.slice(1),
  `${lf}Extra content\n`,
  lf.slice(0, -1),
  lf.replace("Do not edit manually.", "Do not  edit manually."),
  lf.replace("Do not edit manually.", "Do not edit manually. "),
  lf.replace(/\n/, "\r"),
];
for (const mutated of mutations) {
  assert.notEqual(mutated, lf, "regression must change the reference");
  assert.throws(() => assertCurrentReference(mutated, lf), assert.AssertionError);
  assert.throws(() => assertCurrentReference(crlf, mutated), assert.AssertionError);
}

console.log("deterministic command reference drift test passed (4 EOL pairs; 14 stale-content rejections).");
