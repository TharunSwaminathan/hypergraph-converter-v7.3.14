import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve,join } from "node:path";
const exec=promisify(execFile);
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const node="/home/tharu/.nvm/versions/node/v22.23.1/bin/node";
const wsl=path=>`/mnt/${path[0].toLowerCase()}${path.slice(2).replaceAll("\\","/")}`;
const kinds=["native","memcheck","racecheck","initcheck","synccheck"];
for(const [scope,mode,harness,expected] of [["4b1","static","run-hypergraph-motif-cuda-qualification.mjs",487],["4b2","incremental","run-hypergraph-motif-cuda-incremental-qualification.mjs",405]]) {
  const paths=kinds.map(kind=>join(root,"artifacts",`candy-scope${scope}-cuda-${mode}-${kind}-qualification.json`));
  const backups=await Promise.all(paths.map(path=>readFile(path)));
  try {
    const {stdout}=await exec("wsl.exe",["-d","Ubuntu","--exec",node,wsl(join(root,"candy-runtime","test",harness))],{shell:false,windowsHide:true,timeout:600000,maxBuffer:16384});
    const fresh=JSON.parse(await readFile(paths[0],"utf8"));
    assert.equal(fresh.status,"NATIVE_QUALIFICATION_PASS");assert.equal(fresh.passed,expected);assert.equal(fresh.failed,0);
    await writeFile(join(root,"artifacts",`candy-scope4c-${scope}-native-regression.json`),JSON.stringify({schemaVersion:"candy.scope4c-native-regression/1",status:"PASS",historicalEvidenceRestored:true,harnessUnchanged:true,executionEnvironment:"Ubuntu_WSL_native_harness_not_Runtime_E2E",qualification:fresh},null,2)+"\n");
    console.log(stdout.trim());
  } finally {for(let i=0;i<paths.length;i++)await writeFile(paths[i],backups[i]);}
  for(let i=0;i<paths.length;i++)assert.ok((await readFile(paths[i])).equals(backups[i]),"Historical evidence bytes changed");
}
