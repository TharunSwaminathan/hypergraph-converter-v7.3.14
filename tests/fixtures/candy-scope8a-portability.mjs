import {createProjectStore} from '../../src/persistence/projectStore.js';
import {createGraphState} from '../../src/graph/graphState.js';
import {captureWorkspaceInputs,createWorkspaceSourceRegistry} from '../../src/persistence/workspaceCapture.js';
import {projectIndexedDB} from './candy-scope7a-storage.mjs';
import {initialConnectionProfile} from '../../src/persistence/modelConnectionSchema.js';
export function setup(){const db=projectIndexedDB(),store=createProjectStore(db);return{db,store};}
export function workspace(text='h0: A, B',fmt='simple',manual=false){
 const input=captureWorkspaceInputs(createWorkspaceSourceRegistry(),{fmt,texts:{[fmt]:text},nv:'',sv:'',tv:'',customCode:'// Review required; no execution on restore.',customCodeVersion:1,customFiles:[],manualUploads:manual?{['text:'+fmt]:{id:'manual-'+fmt,name:'manual.txt',text}}:{},batches:[],activeBatchId:null});
 return{...input,graph:createGraphState([{id:'h0',vertices:['A','B']}]),graphSourceKeys:[input.sources.find(x=>x.kind==='editor').key]};
}
export async function seed(store,text){const project=await store.defaultProject();await store.saveWorkspace(project.projectId,project.revision,workspace(text));let p=await store.readProject(project.projectId);await store.saveMemory(p.projectId,p.revision,{kind:'remember',memoryType:'USER_CONSTRAINT',topic:'policy',content:'Project Alpha forbids implicit projection.',provenance:'USER_EXPLICIT'});await store.saveConnectionProfile(0,{...initialConnectionProfile('qwen3:8b'),autoReconnectEnabled:true,lastKnownModelAvailability:'AVAILABLE'});return project.projectId;}
