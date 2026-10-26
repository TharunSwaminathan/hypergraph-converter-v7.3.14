import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const r=process.cwd(),o=path.join(r,'artifacts/candy-scope6e-v3-work');
const extracted=JSON.parse(await fs.readFile(path.join(o,'extraction.json'),'utf8')).extractedRoot;
const {startCandyRuntime}=await import(pathToFileURL(path.join(extracted,'candy-runtime/src/server.js')));
const {createCandyClient}=await import(pathToFileURL(path.join(extracted,'src/candy/client.js')));
const report={candidate:'e84f06cdaa750803a06007ade63124b6bce693c8',extractedRoot:extracted,
 startedAt:new Date().toISOString(),reusePriorCredentials:false,checks:[]};
let runtime;
try{
 runtime=await startCandyRuntime({port:0});let url='http://127.0.0.1:'+runtime.port;
 assert.equal((await fetch(url+'/v1/health')).status,200);
 assert.equal((await fetch(url+'/v1/capabilities')).status,401);
 let client=createCandyClient({baseUrl:url,token:runtime.pairingToken});
 const firstSession=(await client.session()).runtimeSessionId,firstToken=runtime.pairingToken;
 const declaration=await client.capabilities();assert.equal(declaration.runtimeSessionId,firstSession);
 assert.ok(!declaration.capabilities.some(c=>['CUDA_STATIC','CUDA_INCREMENTAL'].includes(c.backend)));
 report.checks.push({startup:'PASS',health:200,unauthenticatedDiscovery:401,freshAuthentication:'PASS',authenticatedDiscovery:'PASS',declaration,
   gpuTruth:'No native installation or qualification supplied; no CUDA capability advertised.'});
 await runtime.close();runtime=null;
 runtime=await startCandyRuntime({port:0});url='http://127.0.0.1:'+runtime.port;
 client=createCandyClient({baseUrl:url,token:runtime.pairingToken});
 assert.notEqual(runtime.pairingToken,firstToken);assert.notEqual((await client.session()).runtimeSessionId,firstSession);
 assert.equal((await fetch(url+'/v1/capabilities',{headers:{Authorization:'Bearer '+firstToken}})).status,401);
 assert.ok((await client.capabilities()).runtimeSessionId);
 report.checks.push({restart:'PASS',newCredentialsAndSession:true,staleCredentialStatus:401,freshDiscovery:'PASS'});
 await runtime.close();runtime=null;report.cleanShutdown=true;report.status='PASS';
}catch(e){report.status='NON-PASS';report.failure={message:e.message,stack:e.stack};process.exitCode=1;}
finally{if(runtime)await runtime.close();report.finishedAt=new Date().toISOString();await fs.writeFile(path.join(o,'extracted-runtime.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({extractedRuntime:report.status,cleanShutdown:report.cleanShutdown,failure:report.failure}));}
