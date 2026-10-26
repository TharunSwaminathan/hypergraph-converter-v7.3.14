import assert from "node:assert/strict";
import { readFile, mkdtemp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createBenchmarkFixture, requireQualifiedBenchmarkFixture, FIXTURE_SEEDS } from "../scripts/benchmarks/scope6a-fixtures.mjs";
import { packCudaMotifRequest } from "../candy-runtime/test/hypergraph-motif-cuda-contract.mjs";

for(const family of ["S1","S2","S3"])for(const seed of FIXTURE_SEEDS) {
  const a=createBenchmarkFixture(family,seed),b=createBenchmarkFixture(family,seed);
  assert.deepEqual(a,b);assert.equal(a.manifest.jsonBytes,Buffer.byteLength(JSON.stringify(a.graph)));
  assert.equal(a.manifest.nativeBytes,Buffer.byteLength(packCudaMotifRequest(requireQualifiedBenchmarkFixture(a)).text));
  assert.equal(a.manifest.I,a.manifest.E*a.manifest.cardinality.max);assert.ok(a.manifest.membershipWork<=5000000);
}
assert.notEqual(createBenchmarkFixture("S1",731406).manifest.jsonSha256,createBenchmarkFixture("S1",731407).manifest.jsonSha256);
const big=createBenchmarkFixture("B1");let calls=0;
const submit=fixture=>{requireQualifiedBenchmarkFixture(fixture);calls++;};
assert.throws(()=>submit(big),/cannot enter/);assert.equal(calls,0);assert.equal(big.manifest.E,10000);assert.equal(big.manifest.nativeBytes,null);
assert.throws(()=>createBenchmarkFixture("B2"),RangeError);assert.throws(()=>createBenchmarkFixture("N"),RangeError);

const ci=await readFile(new URL("../.github/workflows/cpu-release-gates.yml",import.meta.url),"utf8");
for(const gate of ["npm ci","npm test","npm run lint","npm run build","npm run build:github","npm audit --omit=dev","qualify-scope6a-package.py","UNAVAILABLE/SKIPPED"])assert.ok(ci.includes(gate));
assert.doesNotMatch(ci,/pull_request_target|workflow_run|self-hosted|secrets\.|write-all/);
assert.match(ci,/persist-credentials: false/);assert.match(ci,/contents: read/);
const actions=[...ci.matchAll(/uses: ([\w/-]+)@([a-f0-9]{40})/g)];assert.equal(actions.length,2);
const docs=await readFile(new URL("../docs/CANDY_SCOPE6A_RELEASE_CONTRACT.md",import.meta.url),"utf8");
for(const identity of ["b24c4e32100d2e7c05b13df3c8f6f9e279fd8828","f8343ae195e37885726c396733dd6f5b9468f0fb","54dd4d3edb73681f51bf8bb69b9708778a46a502","bf0240a54fb6ac8284bd9ac371306511158a1a2e"])assert.ok(docs.includes(identity));
assert.match(docs,/LF/);assert.match(docs,/CRLF/);assert.match(docs,/publisher authenticity/);
// Real Python producer/verifier, populated ignored private material, and actual
// extracted verifier. Nothing is injected into native capability discovery.
const workspace=await mkdtemp(join(tmpdir(),"candy-scope6a-package-test-")),output=join(workspace,"report.json");
// Git-backed self-tests retain the helper's committed-release default. Only
// intentionally Git-free extracted self-tests explicitly opt into snapshots.
const snapshot = !existsSync(join(process.cwd(), ".git"));
const sourceArgs = snapshot ? ["--source-mode", "snapshot"] : [];
const python = process.env.PYTHON || (process.platform==="win32"?"python":"python3");
execFileSync(python,["scripts/qualify-scope6a-package.py",...sourceArgs,"--output",output,"--node",process.execPath],{cwd:process.cwd(),windowsHide:true,timeout:60000,env:{...process.env,PYTHONDONTWRITEBYTECODE:"1"}});
const report=JSON.parse(await readFile(output,"utf8"));assert.equal(report.status,"PASS");assert.equal(report.identicalBytes,true);
assert.equal(report.cases.length,3);assert.ok(report.cuda.every(value=>value.available===false));
const expectedCommit = snapshot ? null : execFileSync("git", ["rev-parse", "HEAD"], {encoding:"utf8",windowsHide:true}).trim();
for (const {integrity} of report.cases) {
  assert.equal(integrity.verificationLevel, snapshot ? "structural-only" : "commit-bound");
  assert.equal(integrity.sourceCommit, expectedCommit);
}
// An extracted tree must still fail closed when its caller omits the opt-in.
const noGitOutput = join(workspace, "no-git-default.json");
const noGit = spawnSync(python,["scripts/qualify-scope6a-package.py","--root",report.extractedRoot,"--output",noGitOutput,"--node",process.execPath],{cwd:process.cwd(),windowsHide:true,timeout:60000,encoding:"utf8",env:{...process.env,PYTHONDONTWRITEBYTECODE:"1"}});
assert.equal(noGit.status, 1);
assert.match(noGit.stderr, /Committed source requires usable Git metadata/);
assert.equal(existsSync(noGitOutput), false);
console.log("Scope 6A deterministic fixtures, native lane refusal, CPU CI contract, provenance and actual/clean/populated/extracted archive checks passed.");
