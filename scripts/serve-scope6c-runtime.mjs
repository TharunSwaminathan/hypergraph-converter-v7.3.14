// Qualification control only: production server, real qualification/backends.
// A local stop file permits graceful shutdown on Windows without HTTP authority.
import { access,writeFile,unlink } from 'node:fs/promises';
import { startCandyRuntime } from '../candy-runtime/src/server.js';
const arg=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const pairing=arg('pairing-file'),stop=arg('stop-file'),receipt=arg('receipt');
if(!pairing||!stop||!receipt)throw Error('Explicit fresh pairing, stop and receipt paths required');
const runtime=await startCandyRuntime({port:8791,...(arg('artifact-root')?{artifactRoot:arg('artifact-root')}:{})});
await writeFile(pairing,runtime.pairingToken,{flag:'wx',mode:0o600});
const record={command:process.argv.join(' '),pid:process.pid,port:runtime.port,url:`http://127.0.0.1:${runtime.port}`,session:runtime.capabilities.runtimeSessionId,artifactRoot:runtime.artifactStore.root,startedAt:new Date().toISOString()};
record.healthStatus=(await fetch(record.url+'/v1/health')).status;
record.recoveredFiles=runtime.artifactStore.ownedRoot.recoveredFiles;
await writeFile(receipt,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(record));
let closing=false;
async function close(){if(closing)return;closing=true;clearInterval(timer);await runtime.close();await unlink(pairing);record.stoppedAt=new Date().toISOString();record.cleanShutdown=true;await writeFile(receipt,JSON.stringify(record,null,2)+'\n');console.log('CLEAN_SHUTDOWN');}
const timer=setInterval(async()=>{try{await access(stop);await close();}catch(e){if(e.code!=='ENOENT'){console.error(e);process.exitCode=1;clearInterval(timer);}}},200);
process.once('SIGINT',()=>void close());process.once('SIGTERM',()=>void close());
