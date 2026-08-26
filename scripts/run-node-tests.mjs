import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const testDir = join(root, "tests");
const filter = process.argv.find(arg => arg.startsWith("--match="))?.slice("--match=".length) ?? "";

const files = (await readdir(testDir))
  .filter(name => name.endsWith(".test.mjs"))
  .filter(name => !filter || name.includes(filter))
  .sort((a, b) => a.localeCompare(b))
  .map(name => join("tests", name));

if (!files.length) {
  console.error(filter ? `No tests matched ${JSON.stringify(filter)}.` : "No .test.mjs files found.");
  process.exit(1);
}

let passed = 0;
const startedAt = Date.now();

for (const file of files) {
  const result = await runNodeTest(file);
  if (result !== 0) {
    console.error(`\nTest failed: ${file}`);
    console.error(`Passed before failure: ${passed}/${files.length}`);
    process.exit(result || 1);
  }
  passed += 1;
}

const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`\nNode test suite passed: ${passed}/${files.length} files in ${seconds}s.`);

function runNodeTest(file) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [file], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", code => resolve(code ?? 1));
    child.on("error", error => {
      console.error(error);
      resolve(1);
    });
  });
}
