import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
assert.equal(packageJson.name, "hypergraph-converter-studio");
assert.equal(packageJson.version, "7.3.13");

for (const file of [
  "src/agent/deterministicNlu/compileDeterministicAction.js",
  "src/agent/deterministicNlu/semanticConfidence.js",
  "tests/fixtures/deterministic-nlu/semantic-corpus.mjs",
  "tests/helpers/evaluateDeterministicNluCorpus.mjs",
  "tests/helpers/nluCorpusIntegrity.mjs",
  "docs/V7_3_3_IMPLEMENTATION.md",
  "docs/V7_3_3_TEST_REPORT.md",
]) {
  assert.equal(existsSync(file), true, `${file} must exist`);
}

const packageScript = packageJson.scripts.test;
const usesNodeTestRunner = /scripts\/run-node-tests\.mjs|scripts\\run-node-tests\.mjs/.test(packageScript);
for (const testName of [
  "deterministic-nlu-corpus-integrity.test.mjs",
  "deterministic-nlu-semantic-evaluation.test.mjs",
  "deterministic-nlu-quality-metrics.test.mjs",
  "deterministic-nlu-authoritative-routing.test.mjs",
  "deterministic-nlu-false-mutation.test.mjs",
  "deterministic-nlu-template-diversity.test.mjs",
  "deterministic-nlu-legacy-adapters.test.mjs",
]) {
  if (usesNodeTestRunner) {
    assert.equal(existsSync(`tests/${testName}`), true, `${testName} must be discoverable by scripts/run-node-tests.mjs`);
  } else {
    assert.match(packageScript, new RegExp(testName.replaceAll(".", "\\.")), `${testName} must be in npm test`);
  }
}

const docs = await readFile("README.md", "utf8");
assert.match(docs, /v7\.3\.3/i);
assert.match(docs, /authoritative compiler/i);

console.log("v7.3.3 regression tests passed.");
