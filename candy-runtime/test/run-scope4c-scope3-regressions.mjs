import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
const exec=promisify(execFile);
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const record=join(root,"candy-runtime",".local","cuda-qualified-build.json");
let previous;try{previous=await readFile(record);}catch(error){if(error.code!=="ENOENT")throw error;}
const report={schemaVersion:"candy.scope4c-scope3-regression/1",status:"RUNNING",cases:[]};
async function harness(name,environment={}) {
  const started=Date.now();
  const {stdout}=await exec(process.execPath,[join(root,"candy-runtime","test",name)],{cwd:root,shell:false,windowsHide:true,timeout:600000,maxBuffer:4*1024*1024,env:{...process.env,...environment}});
  const output=JSON.parse(stdout.slice(stdout.indexOf("{")));
  assert.equal(output.result,"PASS");
  report.cases.push({harness:name,environment,durationMs:Date.now()-started,qualification:output});
  console.log(`${name}${environment.CANDY_CUDA_SANITIZER_TOOL?` (${environment.CANDY_CUDA_SANITIZER_TOOL})`:""}: PASS`);
}
try {
  await harness("run-native-qualification.mjs");
  await harness("run-cuda-native-qualification.mjs");
  await harness("run-cuda-failure-qualification.mjs");
  for(const tool of ["memcheck","racecheck","initcheck","synccheck"])await harness("run-cuda-native-qualification.mjs",{CANDY_CUDA_SANITIZER_TOOL:tool});
  await exec(process.execPath,[join(root,"candy-runtime","test","write-cuda-qualified-attestation.mjs"),"--write-after-qualified-suite"],{cwd:root,shell:false,windowsHide:true,timeout:30000,maxBuffer:16384});
  const attestation=JSON.parse(await readFile(record,"utf8"));report.qualifiedAttestation={schemaVersion:attestation.schemaVersion,executable:attestation.executable,build:attestation.build,device:attestation.device,qualification:attestation.qualification};
  await harness("run-companion-cuda-qualification.mjs");
  report.status="SCOPE3_REGRESSION_PASS";
}catch(error){report.status="SCOPE3_REGRESSION_FAIL";report.error=error.stack;process.exitCode=1;console.error(error.message);}
finally{if(previous)await writeFile(record,previous);else await rm(record,{force:true});report.operatorRecordRestoredToPriorState=true;await writeFile(join(root,"artifacts","candy-scope4c-scope3-regression.json"),JSON.stringify(report,null,2)+"\n");console.log(report.status);}
