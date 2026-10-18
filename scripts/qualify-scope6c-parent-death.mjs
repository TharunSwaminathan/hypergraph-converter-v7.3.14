// Controlled one-shot shell fixture, NOT a CUDA/native qualification result.
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
const exec=promisify(cp.execFile),toWsl=value=>`/mnt/${value[0].toLowerCase()}${value.slice(2).replaceAll('\\','/')}`;
if(process.argv[2]==='--child') {
 const root=process.argv[3],spawn=cp.spawn;
 cp.spawn=function(...args){const child=spawn.apply(this,args);let text='';child.stdout.on('data',chunk=>{text+=chunk.toString();if(text.includes('CANDY_FIXTURE_STARTED')){const group=/CANDY_PROCESS_GROUP:([0-9]+)/.exec(text)?.[1];process.send?.({started:true,group:Number(group)});}});return child;};
 syncBuiltinESMExports();
 const {NativeProcessRunner}=await import('../candy-runtime/src/backends/nativeProcessRunner.js');
 const runner=new NativeProcessRunner({runtimeRoot:fileURLToPath(new URL('../candy-runtime/',import.meta.url)),stdoutBytes:4096,stderrBytes:4096});
 runner.trustedExecutable=async()=>({path:join(root,'fixture.sh'),fingerprint:'fixture-not-qualified-native'});
 await runner.run({backend:'LOCAL_OPENMP',requestPath:join(root,'request.txt'),timeoutMs:20000});
 process.send?.({unexpectedCompletion:true});
}else{
 const root=await mkdtemp(join(tmpdir(),'candy-scope6c-parent-'));
 const report={schemaVersion:'candy.scope6c-parent-death/1',evidenceKind:'Controlled non-CUDA one-shot process; production NativeProcessRunner and supervisor',cases:[]};
 try{
  await writeFile(join(root,'fixture.sh'),'#!/bin/bash\nprintf "CANDY_FIXTURE_STARTED\\n"\nsleep 60\n');await writeFile(join(root,'request.txt'),'fixture');
  if(process.platform==='win32')await exec('wsl.exe',['-d','Ubuntu','--exec','/bin/chmod','700',toWsl(join(root,'fixture.sh'))],{windowsHide:true});
  else await exec('/bin/chmod',['700',join(root,'fixture.sh')]);
  const child=cp.fork(fileURLToPath(import.meta.url),['--child',root],{silent:true,windowsHide:true});
  const group=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Fixture start timeout')),15000);child.on('message',m=>{if(m.started){clearTimeout(timer);resolve(m.group);}});child.once('exit',()=>{clearTimeout(timer);reject(Error('Fixture exited before controlled kill'));});});
  assert.ok(group>1);child.kill('SIGKILL');await new Promise(r=>child.once('exit',r));
  let living=[];
  for(let i=0;i<20;i++) {
    const args=['-eo','pgid=,pid=,stat=,comm='];
    const {stdout}=await exec(process.platform==='win32'?'wsl.exe':'/bin/ps',process.platform==='win32'?['-d','Ubuntu','--exec','/bin/ps',...args]:args,{windowsHide:true,timeout:5000});
    living=stdout.trim().split('\n').filter(line=>{const parts=line.trim().split(/\s+/);return Number(parts[0])===group&&!parts[2].startsWith('Z');});
    if(!living.length)break;await new Promise(r=>setTimeout(r,100));
  }
  assert.deepEqual(living,[],'No live owned native/supervisor/watcher process after abrupt parent death');
  report.cases.push({id:'abrupt-node-parent-termination',group,liveOwnedProcessesAfterCleanup:living.length,status:'PASS',credentialOrGpuUsed:false});report.status='PASS';
 }catch(e){report.status='FAIL';report.failure=e.message;process.exitCode=1;}
 finally{await rm(root,{recursive:true,force:true});await writeFile('artifacts/candy-scope6c-parent-death.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
}
