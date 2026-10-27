import {startCandyRuntime} from '../../candy-runtime/src/server.js';
import {writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const runtime=await startCandyRuntime({port:0,artifactRoot:process.argv[2]});
process.send({type:'ready',port:runtime.port,pairingToken:runtime.pairingToken,runtimeSessionId:runtime.jobs.runtimeSessionId,recoveredFiles:runtime.artifactStore.ownedRoot.recoveredFiles,artifacts:runtime.artifactStore.metadataById.size,workspaces:(await readdir(join(runtime.artifactStore.root,'workspaces'))).length});
process.on('message',async message=>{
 try {
  if(message.command==='orphan') {
   const p=await runtime.artifactStore.ownedRoot.createWorkspace();await writeFile(join(p,'request.txt'),'V5 unexecuted owned restart sentinel',{flag:'wx'});process.send({type:'orphan-created'});
  }else if(message.command==='close'){await runtime.close();process.exit(0);}
 }catch(error){process.send({type:'error',message:error.message});}
});
