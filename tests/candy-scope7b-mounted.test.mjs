import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { projectIndexedDB,turn } from './fixtures/candy-scope7a-storage.mjs';

const window=new Window({url:'http://127.0.0.1:5173/'});
Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,Event:window.Event,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:window.navigator});
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:window.sessionStorage});
window.sessionStorage.setItem('hypergraph-studio.candy-runtime-token.session','injected-not-authority');
let fetches=0;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{fetches++;throw Error('No automatic Runtime/model request');};
const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error',define:{'import.meta.env.VITE_CANDY_RUNTIME_ENABLED':"'true'"}});
try{
 const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
 const {createProjectStore}=await vite.ssrLoadModule('/src/persistence/projectStore.js');
 const {createProjectSession}=await vite.ssrLoadModule('/src/persistence/projectSession.js');
 const {createWorkspaceSourceRegistry,captureWorkspaceInputs,decodeWorkspaceInputs}=await vite.ssrLoadModule('/src/persistence/workspaceCapture.js');
 const {usePersistentWorkspace}=await vite.ssrLoadModule('/src/persistence/usePersistentWorkspace.js');
 const {usePersistentThread}=await vite.ssrLoadModule('/src/persistence/usePersistentThread.js');
 const {createGraphState}=await vite.ssrLoadModule('/src/graph/graphState.js');
 const {useCandyRuntime}=await vite.ssrLoadModule('/src/candy/useCandyRuntime.js');
 const db=projectIndexedDB();globalThis.indexedDB=db;
 db.records.set('main',{schemaVersion:1,messages:[{role:'agent',text:'Previously approved',actions:[{command:'Apply'}]}],workspace:{graph:{available:true}},pendingAction:{confirmed:true}});
 let mounted;
 function Host(){
  const [session]=React.useState(()=>createProjectSession(createProjectStore()));
  const [registry]=React.useState(createWorkspaceSourceRegistry),[text,setText]=React.useState(''),[graph,setGraph]=React.useState(createGraphState);
  const [messages,setMessages]=React.useState([]),[memory,setMemory]=React.useState({summary:''});
  const input=React.useMemo(()=>captureWorkspaceInputs(registry,{fmt:'simple',texts:{simple:text},nv:'',sv:'',tv:'',customCode:'// explicit Run only',customCodeVersion:0,customFiles:[],batches:[],activeBatchId:null,graphBinding:null}),[registry,text]);
  const workspace=usePersistentWorkspace({session,input,graph,onRestore:value=>{const data=decodeWorkspaceInputs(value);setText(data.editors['text:simple']??'');if(value.graph)setGraph(value.graph);}});
  const chat=usePersistentThread({messages,setMessages,memory,setMemory,agentState:{persistenceSession:session}});
  const candy=useCandyRuntime({graphState:graph});mounted={text,setText,graph,setGraph,workspace,chat,candy,messages,session};
  return React.createElement('p',null,workspace.message);
 }
 async function spin(predicate,label){for(let n=0;n<100;n++){await act(async()=>{await turn();});if(predicate())return;}throw Error('Mounted timeout: '+label+' '+JSON.stringify(mounted?.workspace));}
 let root=createRoot(document.body.appendChild(document.createElement('div')));
 await act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Host))));
 await spin(()=>mounted.workspace.state==='clean'&&mounted.chat.status==='ready','initial usable storage');
 await act(async()=>{mounted.setText('h0: A, B');mounted.setGraph(createGraphState([{id:'h0',vertices:['A','B'],weight:1,time:null,attributes:{}}]));});
 await spin(()=>mounted.workspace.state==='committed'&&!mounted.workspace.unsaved,'shared writer commit');
 assert.equal(mounted.chat.receipt?.code??null,null);
 for(let n=0;n<5;n++)await act(async()=>{await turn();});
 const p=await mounted.session.defaultProject(),revision=(await mounted.session.load(p.projectId)).manifest.revision;
 for(let n=0;n<5;n++)await act(async()=>{await turn();});assert.equal((await mounted.session.load(p.projectId)).manifest.revision,revision,'receipt renders do not trigger an autosave loop');
 db.control.quotaNext=true;await act(async()=>mounted.setText('new local bytes'));
 await spin(()=>mounted.workspace.code==='QUOTA','quota receipt');assert.equal(mounted.workspace.unsaved,true);assert.equal(mounted.text,'new local bytes');
 await act(async()=>{await mounted.workspace.retry();});await spin(()=>mounted.workspace.state==='committed','explicit retry');
 const graphId=mounted.graph.graphId;await act(async()=>root.unmount());
 root=createRoot(document.body.appendChild(document.createElement('div')));await act(async()=>root.render(React.createElement(Host)));
 await spin(()=>mounted.workspace.state==='committed'&&mounted.text==='new local bytes','validated remount');
 assert.equal(mounted.graph.graphId,graphId);assert.equal(mounted.graph.hyperedges.length,1);assert.deepEqual(mounted.messages[0].actions,[]);
 assert.equal(mounted.candy.state.authorized,false);assert.equal(mounted.candy.state.runtimeSessionId,null);assert.equal(mounted.candy.state.pendingUpdateContext,null);assert.equal(fetches,0);
 const peer=createProjectStore(db),current=await peer.load(p.projectId);
 await peer.saveThread(p.projectId,current.manifest.revision,{schemaVersion:1,messages:[],workspace:{}});
 await act(async()=>mounted.setText('stale local update'));await spin(()=>mounted.workspace.code==='CONFLICT','external stale writer');
 assert.equal(mounted.workspace.unsaved,true);assert.equal(await mounted.workspace.retry(),false);
 await act(async()=>root.unmount());await peer.close();
 globalThis.indexedDB=undefined;
 root=createRoot(document.body.appendChild(document.createElement('div')));await act(async()=>root.render(React.createElement(Host)));
 await spin(()=>mounted.workspace.code==='UNAVAILABLE','unavailable storage');await act(async()=>mounted.setText('deterministic editor remains usable'));
 assert.equal(mounted.text,'deterministic editor remains usable');assert.equal(mounted.graph.hyperedges,null);assert.equal(mounted.workspace.unsaved,true);
 await act(async()=>root.unmount());
 assert.throws(()=>decodeWorkspaceInputs({metadata:{schemaVersion:1,pendingAction:{approved:true}},sources:[],root:{}}),error=>error.code==='CORRUPT');
}finally{globalThis.fetch=originalFetch;await vite.close();await window.happyDOM.close();}
console.log('Scope 7B mounted StrictMode/shared chat-workspace CAS, verified data remount, quota retry, no autosave loop, no Runtime/approval replay, external conflict and unavailable storage PASS (happy-dom + transactional double).');
