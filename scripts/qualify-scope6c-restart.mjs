import { readFile,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCandyClient } from '../src/candy/client.js';
import { submitMotifWorkflow } from '../src/candy/motifWorkflow.js';
import { createBenchmarkFixture } from './benchmarks/scope6a-fixtures.mjs';
const pid=Number(process.argv.find(a=>a.startsWith('--pid='))?.slice(6));
if(!pid || pid===process.pid)throw Error('Explicit owned CLI PID required');
const pairingFile=process.argv.find(a=>a.startsWith('--pairing-file='))?.slice(15);
const oldToken=(await readFile(pairingFile,'utf8')).trim(),baseUrl='http://127.0.0.1:8791';
const client=createCandyClient({baseUrl,token:oldToken});
const declaration=await client.capabilities();
const accepted=await submitMotifWorkflow({client,graphValue:createBenchmarkFixture('S2').graph,argumentsValue:{mode:'STATIC',backend:'CUDA_STATIC',deviceId:0,timeoutMs:60000},runtimeSessionId:declaration.runtimeSessionId});
let status;
for(let i=0;i<1000;i++){status=await client.getJob(accepted.job.jobId);if(status.status==='running')break;assert.ok(!['failed','completed','cancelled'].includes(status.status));await new Promise(r=>setTimeout(r,2));}
assert.equal(status.status,'running');process.kill(pid,'SIGKILL');
const report={schemaVersion:'candy.scope6c-restart-recovery/1',oldPid:pid,oldSession:declaration.runtimeSessionId,oldActiveJob:status,qualification:'Actual production Runtime and authentic qualified job; running status observed before abrupt termination. Native process/kernel start is not asserted at the kill instant.',oldCredentialHash:createHash('sha256').update(oldToken).digest('hex'),cases:[]};
await assert.rejects(client.getJob(status.jobId));report.cases.push({case:'request-during-absence',status:'PASS'});
console.log('READY_FOR_FRESH_CLI_RESTART');
let newToken;
for(let i=0;i<1200;i++){
 try {const text=(await readFile(pairingFile,'utf8')).trim();if(text!==oldToken && text.length>=32){newToken=text;break;}}catch{}
 await new Promise(r=>setTimeout(r,100));
}
assert.ok(newToken,'Fresh CLI pairing not received');
const fresh=createCandyClient({baseUrl,token:newToken});
assert.equal((await fetch(baseUrl+'/v1/health')).status,200);
const renewed=await fresh.capabilities();assert.notEqual(renewed.runtimeSessionId,declaration.runtimeSessionId);
await assert.rejects(client.session(),e=>e.classification==='UNAUTHORIZED');
await assert.rejects(fresh.getJob(status.jobId),e=>e.details.httpStatus===404);
await assert.rejects(fresh.getResult(status.jobId),e=>e.details.httpStatus===404);
report.newSession=renewed.runtimeSessionId;report.newCredentialHash=createHash('sha256').update(newToken).digest('hex');
report.cases.push({case:'fresh-authenticated-discovery',status:'PASS'},{case:'stale-credential',httpStatus:401,status:'PASS'},{case:'old-active-job-and-result',httpStatus:404,status:'PASS'});
report.status='PASS';await writeFile('artifacts/candy-scope6c-restart-recovery.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,cases:report.cases}));
