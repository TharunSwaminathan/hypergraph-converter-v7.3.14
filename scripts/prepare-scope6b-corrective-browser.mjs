import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root=process.cwd(), temporary=fs.mkdtempSync(path.join(os.tmpdir(),'candy-scope6b-corrective-browser-'));
const baseline=path.join(temporary,'baseline'), candidate=path.join(temporary,'candidate');
fs.mkdirSync(baseline);fs.mkdirSync(candidate);
const archive=path.join(temporary,'baseline.tar');
execFileSync('git',['archive','--format=tar',`--output=${archive}`,'da4629b1f4204fbfc8f8e6d14941d29319d79e90','src','public','index.html','package.json','vite.config.js'],{cwd:root});
execFileSync('tar.exe',['-xf',archive,'-C',baseline]);
for(const file of ['src','public','index.html','package.json','vite.config.js']) fs.cpSync(path.join(root,file),path.join(candidate,file),{recursive:true});
const probe=String.raw`
const out=document.createElement('script');out.id='scope6b-measurements';out.type='application/json';document.head.append(out);
const events=[],functions=[],errors=[];let current=null;let serial=0;
const memoryInterface={performanceMemory:!!performance.memory,measureUserAgentSpecificMemory:typeof performance.measureUserAgentSpecificMemory,crossOriginIsolated:crossOriginIsolated,forcedGC:typeof window.gc};
function publish(){out.textContent=JSON.stringify({events:events.slice(-1000),functions:functions.slice(-10000),errors,memoryInterface,domElements:document.getElementsByTagName('*').length});}
window.__scope6bBrowser={enter(label){return {label,start:performance.now(),eventId:current?.id??null};},leave(token){functions.push({...token,end:performance.now(),ms:performance.now()-token.start});}};
function paint(record){const generation=(record.paintGeneration||0)+1;record.paintGeneration=generation;out.removeAttribute('data-ready-id');requestAnimationFrame(()=>requestAnimationFrame(()=>{if(generation!==record.paintGeneration)return;record.paintAt=performance.now();record.inputToPaintMs=record.paintAt-record.start;publish();if(record.id===serial)out.setAttribute('data-ready-id',String(serial));}));}
for(const type of ['click','input','change','keydown'])document.addEventListener(type,event=>{if(type==='keydown'&&!['Enter',' '].includes(event.key))return;const target=event.target.closest('button,input,textarea,select,a');if(!target)return;const name=target.getAttribute('aria-label')||target.textContent?.slice(0,120)||target.id||target.tagName;current={id:++serial,type,name,start:performance.now(),inputLength:typeof target.value==='string'?target.value.length:null};events.push(current);out.setAttribute('data-event-id',String(serial));queueMicrotask(()=>{current.handlerTaskMs=performance.now()-current.start;paint(current);});},{capture:true});
new MutationObserver(()=>{if(current){current.lastMutationAt=performance.now();paint(current);}}).observe(document.getElementById('root'),{subtree:true,childList:true,characterData:true,attributes:true});
window.addEventListener('error',e=>{errors.push(String(e.message));publish();});window.addEventListener('unhandledrejection',e=>{errors.push(String(e.reason));publish();});publish();
`;
const config=String.raw`
import {defineConfig,transformWithOxc} from 'vite';
import react from '@vitejs/plugin-react';
import {parse} from 'acorn';
import fs from 'node:fs';
const measured=new Set(['AppCore','Viz','computeStats','validateHes','buildMappingPresentation','buildH2V','buildV2H','buildCSR','expH2V','expV2H','expCanonicalJSON','exportResolution','createGraphState','commitGraphState','canonicalizeGraph','graphFingerprint','createGraphHistoryEvent','appendGraphHistory','activateGraph','buildAssistantApplicationSnapshot','buildGraphMutationPlannerContext','prepareBoundedPreview','buildPreviewTopology','createInitialNodePositions','resolvePreviewSearch','resolvePreviewHyperedgeSearch','parseInputFormat','normalizeParsedHyperedges','commitGraph','downloadCurrentExport','dl','createPendingHypergraphUpdateDraft','validatePendingHypergraphUpdate','applyPendingHypergraphUpdate','previewGraphMutation','createMutationPlan']);
function editsFor(code){const edits=[];const marked=new Set();function mark(body,label){if(body?.type!=='BlockStatement'||marked.has(body.start))return;marked.add(body.start);edits.push([body.start+1,'const __s6b=window.__scope6bBrowser.enter('+JSON.stringify(label)+');try {']);edits.push([body.end-1,'} finally {window.__scope6bBrowser.leave(__s6b);}']);}
function walk(node,context){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&measured.has(node.id?.name))mark(node.body,node.id.name);if(node.type==='VariableDeclarator'&&node.id?.type==='Identifier'){context=node.id.name;if(measured.has(context)){const fn=node.init?.type==='CallExpression'?node.init.arguments[0]:node.init;mark(fn?.body,context);}}if(node.type==='CallExpression'&&node.callee?.name==='setTimeout'&&context==='parseAndCommit')mark(node.arguments[0]?.body,'conversion_body');for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(x=>walk(x,context));else if(value&&typeof value==='object')walk(value,context);}}
walk(parse(code,{ecmaVersion:'latest',sourceType:'module'}));for(const [offset,text]of edits.sort((a,b)=>b[0]-a[0]))code=code.slice(0,offset)+text+code.slice(offset);return code;}
export default defineConfig({plugins:[{name:'scope6b-observation-only',enforce:'pre',async transform(code,id){if(!id.includes('/src/')||!/[.]jsx?$/.test(id))return;if(id.endsWith('.jsx'))code=(await transformWithOxc(code,id,{lang:'jsx',jsx:{runtime:'automatic'}})).code;return {code:editsFor(code),map:null};},transformIndexHtml(html){return html.replace('<div id="root"></div>','<div id="root"></div><script type="module">'+fs.readFileSync(new URL('./scope6b-probe.txt',import.meta.url),'utf8')+'</script>');}},react()],server:{host:'127.0.0.1',strictPort:true}});
`;
for(const dir of [baseline,candidate]) {
  fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'junction');
  fs.writeFileSync(path.join(dir,'scope6b-probe.txt'),probe);
  fs.writeFileSync(path.join(dir,'scope6b.config.mjs'),config);
}
const sourceFiles=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(path.join(dir,e.name)):[path.join(dir,e.name)]);
const manifests=Object.fromEntries([['baseline',baseline],['candidate',candidate]].map(([phase,dir])=>[phase,sourceFiles(path.join(dir,'src')).map(file=>({file:path.relative(dir,file),sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))]));
fs.writeFileSync('artifacts/candy-scope6b-corrective-browser-setup.json',JSON.stringify({temporary,baseline,candidate,baselineCommit:'da4629b1f4204fbfc8f8e6d14941d29319d79e90',methodology:'Exact git-archive baseline and candidate source snapshots, shared installed dependencies, separate fresh localhost origins. Vite observation plugin injects monotonic function timings and input-to-double-requestAnimationFrame DOM settle proxy. It does not change application data or authority. Probe exposed as a DOM JSON script for read-only automation. Development builds have instrumentation overhead; these are matched comparative measurements, not production absolute SLAs. Input-to-paint measures opportunity after DOM changes, not compositor/GPU completion. Event handler task timing excludes queued async conversion; conversion_body records that body separately. Functions inclusive and nested; never sum them.',manifests},null,2)+'\n');
console.log(JSON.stringify({baseline,candidate}));
