// Isolated qualification service using unmodified production modules/discovery.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),out=path.join(root,'artifacts/candy-scope6e-v3-work');
const deployment=JSON.parse(await fs.readFile(path.join(out,'live-deployment-qualified.json'),'utf8')).root;
const control=process.argv.find(a=>a.startsWith('--control='))?.slice(10);
const secrets=process.argv.find(a=>a.startsWith('--secrets='))?.slice(10);
const receipt=process.argv.find(a=>a.startsWith('--receipt='))?.slice(10);
const artifactRoot=process.argv.find(a=>a.startsWith('--artifact-root='))?.slice(16);
const port=Number(process.argv.find(a=>a.startsWith('--port='))?.slice(7)??8791);
if(!control||!secrets||!receipt)throw Error('Explicit new qualification controls required');
const {startCandyRuntime}=await import(pathToFileURL(path.join(deployment,'candy-runtime/src/server.js')));
const runtime=await startCandyRuntime({port,...(artifactRoot?{artifactRoot}:{})});
const secret={baseUrl:'http://127.0.0.1:'+runtime.port,token:runtime.pairingToken,pid:process.pid,artifactRoot:runtime.artifactStore.root};
await fs.writeFile(secrets,JSON.stringify(secret),{flag:'wx',mode:0o600});
const record={candidate:'e84f06cdaa750803a06007ade63124b6bce693c8',pid:process.pid,baseUrl:secret.baseUrl,
 deployment,startedAt:new Date().toISOString(),ordinaryProductionDiscovery:true,injectedRunner:false,
 artifactRoot:runtime.artifactStore.root,recoveredFiles:runtime.artifactStore.ownedRoot.recoveredFiles};
await fs.writeFile(receipt,JSON.stringify(record,null,2),{flag:'wx'});
console.log(JSON.stringify({ready:true,pid:process.pid,baseUrl:secret.baseUrl,secrets,receipt}));
let closing=false;
async function close(){if(closing)return;closing=true;clearInterval(timer);await runtime.close();await fs.unlink(secrets);record.cleanShutdown=true;record.stoppedAt=new Date().toISOString();await fs.writeFile(receipt,JSON.stringify(record,null,2));console.log('CLEAN_SHUTDOWN');}
const timer=setInterval(async()=>{try{await fs.access(control);await close();}catch(e){if(e.code!=='ENOENT'){console.error(e);process.exitCode=1;}}},200);
process.once('SIGINT',()=>void close());process.once('SIGTERM',()=>void close());
