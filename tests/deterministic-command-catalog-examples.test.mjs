import assert from "node:assert/strict";
import { allCatalogExamples } from "../src/agent/deterministicNlu/commandCatalog.js";
import {
  compileCatalogExample,
  compareExpectedExample,
} from "./helpers/deterministicCommandCatalogTestHelpers.mjs";

const failures = [];
let checked = 0;

for (const { entry, example } of allCatalogExamples({ includePanelOnly: false })) {
  const compiled = await compileCatalogExample(example);
  failures.push(...compareExpectedExample({ entry, example, compiled }));
  checked += 1;
}

assert.equal(failures.length, 0, `catalog example mismatches:\n${JSON.stringify(failures, null, 2)}`);
assert.ok(checked >= 80, "expected at least 80 executable command examples");

console.log(`deterministic command catalog example tests passed (${checked} examples).`);
