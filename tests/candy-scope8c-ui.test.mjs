import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { seeded, parse, encode, values } from './fixtures/candy-scope8c-history-portability.mjs';
const window = new Window({ url: 'http://127.0.0.1:5173' });
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, Event: window.Event, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });
const vite = await createServer({ server: { middlewareMode: true, watch: { ignored: ['**/artifacts/**'] } }, appType: 'custom', logLevel: 'error' });
const checks = []; let root;
try {
  const React = await import('react'), { act } = React, { createRoot } = await import('react-dom/client');
  const { default: Panel } = await vite.ssrLoadModule('/src/components/AnalysisHistoryPortabilityPanel.jsx'), { default: Experience } = await vite.ssrLoadModule('/src/components/WorkspaceExperience.jsx');
  const s = await seeded(), file = await encode({ ...parse(s.file.bytes), name: '<img src=x onerror=alert(1)> Historical data' });
  const button = text => [...document.querySelectorAll('button')].find(x => x.textContent === text), status = () => document.querySelector('[data-history-portability-state]')?.dataset.historyPortabilityState;
  async function spin(fn) { for (let n=0;n<1600;n++) { await act(async()=>{await new Promise(resolve=>setTimeout(resolve,2));}); if(fn())return; } throw Error('8C UI timeout '+document.body.textContent); }
  async function click(text) { assert(button(text),text); await act(async()=>button(text).click()); }
  async function select(bytes=file) {
    await click('Choose history file');const input=document.querySelector('[aria-label="Standalone analysis history file"]');assert(input);
    Object.defineProperty(input,'files',{configurable:true,value:[new File([bytes],'misleading.bin',{type:'application/octet-stream'})]});
    await act(async()=>input.dispatchEvent(new window.Event('change',{bubbles:true})));await spin(()=>status()==='ready'||status()==='CORRUPT'||status()==='INCOMPATIBLE');
  }
  root = createRoot(document.body.appendChild(document.createElement('div')));
  let calls=0,mode='cancel';const props={projectId:s.id,onExport:async()=>s.file,onImport:async()=>{calls++;if(mode==='cancel')return{cancelled:true};if(mode==='error')throw Object.assign(new Error('Inventory full'),{code:'LIMIT'});return{saved:true,discoveryFailed:true};}};
  await act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Panel,{...props,key:'A'}))));
  assert.equal(document.querySelector('input[type=file]'),null);assert.match(document.body.textContent,/not anonymous or guaranteed secret-free/);await select();assert.equal(calls,0);assert.equal(document.querySelector('img'),null);assert.match(document.body.textContent,/IMPORTED \/ unverified/);assert.match(document.body.textContent,/No source or graph/);assert.equal(document.querySelector('input[type=file]'),null);checks.push('dynamic picker, read-only preview, escaped text, no competing source input and sensitivity disclosure');
  await click('Cancel history import');assert.equal(calls,0);await select();await click('Import history as new project…');await spin(()=>status()==='ready');assert.equal(calls,1);checks.push('cancel preview/confirmation writes nothing');
  mode='error';await click('Import history as new project…');await spin(()=>status()==='LIMIT');assert.match(document.body.textContent,/Inventory full/);assert.equal(document.querySelector('[aria-label="History import preview"]'),null);checks.push('explicit full inventory error discards consumed review');
  mode='success';await select();await click('Import history as new project…');await spin(()=>status()==='committed');assert.match(document.body.textContent,/saved but discovery failed/);checks.push('committed-but-discovery-failed is not rollback');
  await select();await act(async()=>root.render(React.createElement(Panel,{...props,key:'B'})));assert.equal(document.querySelector('[aria-label="History import preview"]'),null);checks.push('owner keyed remount removes old stage/status');
  let release;await act(async()=>root.render(React.createElement(Panel,{...props,key:'old',onExport:()=>new Promise(resolve=>{release=resolve;})})));await click('Download analysis history');await act(async()=>root.render(React.createElement(Panel,{...props,key:'new'})));await act(async()=>release(s.file));assert.equal(status(),'idle');checks.push('old export callback ignored after project switch');
  await act(async()=>root.unmount());

  // Mount the actual orchestration with a declared IDB double; no source changes
  // or fake callback stand in for confirmation/Resume publication here.
  globalThis.indexedDB=s.db;globalThis.BroadcastChannel=undefined;
  let mounted=0,dirty=false,reportCurrent;
  function Scene({experience}) {
    const {active,report}=experience;const [unsaved,setUnsaved]=React.useState(false);reportCurrent=setUnsaved;
    React.useEffect(()=>{dirty=unsaved;report(active.key,{workspace:{state:'clean',unsaved},memoryStatus:'ready',memoryCount:0,sourceCount:0,graphHasData:false});},[active.key,report,unsaved]);
    React.useEffect(()=>{mounted++;},[]);
    return React.createElement(React.Fragment,null,experience.panel(null),React.createElement('span',{'data-mounted-project':active.projectId},'Mounted project'));
  }
  root=createRoot(document.body.appendChild(document.createElement('div')));await act(async()=>root.render(React.createElement(Experience,{component:Scene})));await spin(()=>document.querySelector('[data-mounted-project]')&&document.querySelector('[data-resume-state]')?.dataset.resumeState!=='RESTORING');
  assert.equal([...document.querySelectorAll('dt')].at(-1).textContent,'Analysis history');assert.match(document.body.textContent,/Analysis history, memory, chat and other projects are retained/);
  const before=values(s);await select();await click('Import history as new project…');await spin(()=>document.querySelector('dialog[open]'));assert.equal(document.activeElement.textContent,'Cancel');await click('Cancel');await spin(()=>status()==='ready');assert.equal(values(s),before);checks.push('actual Cancel-first native confirmation and unchanged durable state');
  const mountBefore=mounted;await click('Import history as new project…');await spin(()=>document.querySelector('dialog[open]'));await click('Confirm');await spin(()=>document.querySelector('[data-resume-state]')?.dataset.resumeState==='RESTORE_AVAILABLE');assert.equal(document.querySelector('[data-mounted-project]'),null);assert.equal(mounted,mountBefore);assert.match(document.body.textContent,/1 retained results.*history-only/);const id=(await s.store.readResumePreferences()).selectedProjectId;assert.notEqual(id,s.id);assert.equal((await s.store.readMemory(id)).envelope,null);checks.push('atomic new history-only project shows Resume available without mounting/inheriting memory');
  await click('Resume workspace');await spin(()=>document.querySelector('[data-mounted-project]')?.dataset.mountedProject===id);checks.push('manual Resume mounts only selected imported project');
  await act(async()=>reportCurrent(true));assert.equal(dirty,true);await select(await encode({...parse(s.file.bytes),name:'Another file'}));await click('Import history as new project…');await spin(()=>document.querySelector('dialog[open]'));assert.match(document.querySelector('dialog h2').textContent,/Leave unsaved/);assert.equal(document.activeElement.textContent,'Cancel');const count=(await s.store.listProjects()).length;await click('Cancel');await spin(()=>status()==='ready');assert.equal((await s.store.listProjects()).length,count);assert.equal(dirty,true);checks.push('unsaved-edit Cancel preserves current owner and edits');
  await act(async()=>root.unmount());root=null;await s.store.close();
  console.log(JSON.stringify({scope:'8C mounted UI',cases:checks.length,checks,result:'PASS',evidence:'happy-dom and transactional double; native separate'}));
} finally { if(root) await (await import('react')).act(async()=>root.unmount());await vite.close();await window.happyDOM.close(); }
