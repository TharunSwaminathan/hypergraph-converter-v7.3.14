import { spawn } from 'node:child_process';
import { open,writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
const report={startedAt:new Date().toISOString(),gates:[]};
const commands=[['focused','node tests/candy-scope6c-retention.test.mjs && node tests/candy-scope6c-recovery.test.mjs && node tests/candy-scope6c-qualification-reuse.test.mjs && node tests/candy-scope6c-browser-reconnect.test.mjs && node tests/candy-scope6c-corrective-lifecycle.test.mjs'],['test','npm.cmd test'],['lint','npm.cmd run lint'],['build','npm.cmd run build'],['build-github','npm.cmd run build:github'],['audit','npm.cmd audit --omit=dev']];
for(const [name,command] of commands){
 const log=`artifacts/candy-scope6c-final-${name}-closure.log`,file=await open(log,'wx'),started=performance.now();
 const child=spawn('cmd.exe',['/d','/s','/c',command],{stdio:['ignore',file.fd,file.fd],windowsHide:true,env:{...process.env,VITE_CANDY_RUNTIME_ENABLED:'true'}});
 const exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});await file.close();
 report.gates.push({name,command,exitCode,elapsedMs:performance.now()-started,log});console.log(JSON.stringify(report.gates.at(-1)));
 if(exitCode!==0){report.status='FAIL';break;}
}
report.status??='PASS';report.finishedAt=new Date().toISOString();await writeFile('artifacts/candy-scope6c-test-results.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});if(report.status!=='PASS')process.exitCode=1;
