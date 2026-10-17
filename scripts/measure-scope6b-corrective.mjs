import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parse } from 'acorn';
import { createBenchmarkFixture } from './benchmarks/scope6a-fixtures.mjs';

const root = process.cwd();
const baseline = 'C:/Users/tharu/AppData/Local/Temp/candy-scope6b-baseline-7ul_ljjj';
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const summary = values => {
  const sorted = [...values].sort((a,b) => a-b);
  return { n: sorted.length, median: sorted[Math.floor(sorted.length/2)], p95: sorted[Math.ceil(sorted.length*.95)-1] };
};
async function modules(directory) {
  const get = name => import(pathToFileURL(path.join(directory, 'src', name)).href);
  return { ...await get('graph/graphState.js'), ...await get('graph/graphHistory.js'), ...await get('derived/derivedProductCache.js') };
}
function cold(api, rows, invalidate = false) {
  const state = api.createGraphState(rows);
  const event = api.createGraphHistoryEvent({ graphIdentity: state, beforeHyperedges: [], afterHyperedges: state.hyperedges });
  const history = api.appendGraphHistory([], event);
  if (invalidate) api.createDerivedProductCache().activateGraph(state.graphVersion, state.hyperedges);
  if (history.length !== 1) throw new Error('Unexpected history loss');
  return state.graphFingerprint;
}
function instrument(directory) {
  const labels = {
    'graph/immutableGraph.js': { ownGraph: 'ownership_total', graphSnapshotBytes: 'snapshot_byte_accounting' },
    'graph/graphFingerprint.js': { canonicalizeGraph: 'canonical_creation', stableStringify: 'canonical_serialization', graphAuthoritySerialization: 'authority_serialization_total', graphFingerprint: 'fingerprinting_total' },
    'graph/graphIdentity.js': { createGraphId: 'identity_id_creation', createGraphIdentity: 'identity_version_total' },
    'graph/graphState.js': { createGraphState: 'graph_state_total' },
    'graph/graphHistory.js': { createGraphHistoryEvent: 'history_snapshot_retention', appendGraphHistory: 'history_append_total', graphHistoryUsage: 'history_usage_total' },
    'derived/derivedProductCache.js': { activateGraph: 'derived_invalidation' },
  };
  for (const [relative, names] of Object.entries(labels)) {
    const file = path.join(directory, 'src', relative);
    let source = fs.readFileSync(file, 'utf8');
    if (relative === 'graph/immutableGraph.js') {
      source = source.replace('structuredClone(hyperedges)', "globalThis.__scope6bProbe.measure('source_detachment', () => structuredClone(hyperedges))")
        .replace('deepFreeze(copy);', "globalThis.__scope6bProbe.measure('deep_freeze', () => deepFreeze(copy));")
        .replace('isPlainData(copy)', "globalThis.__scope6bProbe.measure('plain_data_audit', () => isPlainData(copy))")
        .replace('freezeAndCheckPlain(copy)', "globalThis.__scope6bProbe.measure('deep_freeze_and_plain_audit', () => freezeAndCheckPlain(copy))");
    }
    const edits = [];
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'FunctionDeclaration' && names[node.id?.name]) {
        const label = names[node.id.name];
        edits.push([node.body.start+1, `const __probeToken=globalThis.__scope6bProbe.enter('${label}');try {`]);
        edits.push([node.body.end-1, '} finally {globalThis.__scope6bProbe.leave(__probeToken);}']);
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === 'object') walk(value);
      }
    }
    walk(parse(source, { ecmaVersion:'latest', sourceType:'module' }));
    for (const [offset, content] of edits.sort((a,b)=>b[0]-a[0])) source = source.slice(0,offset)+content+source.slice(offset);
    fs.writeFileSync(file, source);
  }
}

const mode = process.argv[2];
if (mode === 'profile') {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'candy-scope6b-corrective-profile-'));
  fs.cpSync(path.join(root, 'src'), path.join(temporary, 'src'), { recursive:true });
  fs.writeFileSync(path.join(temporary,'package.json'), '{"type":"module"}');
  instrument(temporary);
  const stack = [], rows = [];
  globalThis.__scope6bProbe = {
    enter(label) { const token = { label, start:performance.now(), children:0 }; stack.push(token); return token; },
    leave(token) {
      const inclusiveMs = performance.now()-token.start;
      if (stack.pop() !== token) throw new Error('Probe stack mismatch');
      if (stack.length) stack.at(-1).children += inclusiveMs;
      rows.push({ label:token.label, inclusiveMs, exclusiveMs:inclusiveMs-token.children });
    },
    measure(label, fn) { const token = this.enter(label); try { return fn(); } finally { this.leave(token); } },
  };
  const api = await modules(temporary);
  const samples = [];
  for (const family of ['S1','S2','B1']) {
    const fixture = createBenchmarkFixture(family).graph.hyperedges;
    for (let iteration=-5; iteration<30; iteration++) {
      const input = structuredClone(fixture); rows.length=0;
      const start = performance.now(); cold(api,input,true); const totalMs=performance.now()-start;
      samples.push({ family, iteration, totalMs, components:structuredClone(rows) });
    }
  }
  const components = {};
  for (const family of ['S1','S2','B1']) {
    const measured = samples.filter(x=>x.family===family&&x.iteration>=0);
    components[family] = {};
    for (const label of new Set(measured.flatMap(x=>x.components.map(c=>c.label)))) {
      components[family][label] = {};
      for (const timing of ['inclusiveMs','exclusiveMs']) components[family][label][timing] = summary(measured.map(x=>x.components.filter(c=>c.label===label).reduce((sum,c)=>sum+c[timing],0)));
    }
  }
  const suffix = process.argv[3] || 'profile';
  fs.writeFileSync(`artifacts/candy-scope6b-corrective-${suffix}.json`, JSON.stringify({ capturedAt:new Date().toISOString(), temporary, methodology:'Exact current production source copied to temporary directory. Entry/finally nested monotonic probes; exclusive timings subtract instrumented children. No fixture generation or input cloning in timed region. Five warmups, thirty fresh-state cold runs per fixture. Probe overhead included; no performance gate inferred from instrumented totals. Canonical/count/index: canonical creation measured; counts/planner index not created by this cold path (zero). Derived activation measured separately inside the same operation. History empty-before and committed-after. Fingerprint exclusive time includes hash and cache bookkeeping; state/identity exclusive includes envelope/version work. Other = exclusive unlabelled work.', source:files('src').map(file=>({file,sha256:sha(file)})), components, samples },null,2)+'\n');
  console.log(JSON.stringify(components.B1));
} else if (mode === 'session') {
  const session = Number(process.argv[3]);
  const apis = { A:await modules(baseline), B:await modules(root) };
  let seed = (0x6b202610+session)>>>0;
  const random = () => { seed ^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296; };
  const samples=[];
  for (const family of ['S1','S2','B1']) {
    const fixture=createBenchmarkFixture(family).graph.hyperedges;
    for(let pair=-12;pair<100;pair++) {
      const order=random()<.5?['A','B']:['B','A'];
      for(const phase of order) {
        const input=structuredClone(fixture);
        const start=performance.now(); const fingerprint=cold(apis[phase],input); const ms=performance.now()-start;
        samples.push({session,family,pair,order:order.join(''),phase,ms,fingerprint});
      }
    }
  }
  process.stdout.write(JSON.stringify(samples));
} else if (mode === 'abba') {
  const samples=[];
  for(let session=0;session<4;session++) {
    const child=spawnSync(process.execPath,[process.argv[1],'session',String(session)],{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024});
    if(child.status!==0) throw new Error(child.stderr);
    samples.push(...JSON.parse(child.stdout));
    console.log(`Independent session ${session+1}/4 finished`);
  }
  const comparison={};
  for(const family of ['S1','S2','B1']) {
    const measured=samples.filter(x=>x.family===family&&x.pair>=0);
    const a=summary(measured.filter(x=>x.phase==='A').map(x=>x.ms)),b=summary(measured.filter(x=>x.phase==='B').map(x=>x.ms));
    comparison[family]={baseline:a,candidate:b,difference:Object.fromEntries(['median','p95'].map(key=>[key,{ms:b[key]-a[key],percent:(b[key]/a[key]-1)*100}])),sessions:Array.from({length:4},(_,session)=>({session,baseline:summary(measured.filter(x=>x.session===session&&x.phase==='A').map(x=>x.ms)),candidate:summary(measured.filter(x=>x.session===session&&x.phase==='B').map(x=>x.ms))}))};
  }
  fs.writeFileSync('artifacts/candy-scope6b-corrective-cold-abba.json',JSON.stringify({capturedAt:new Date().toISOString(),baseline,baselineCommit:'da4629b1f4204fbfc8f8e6d14941d29319d79e90',methodology:'Four fresh Node processes. Per fixture/session: twelve discarded warmup pairs and one hundred measured fresh-state pairs; deterministically randomized AB/BA order within each pair. Each timed operation creates new graph state, creates history event empty-before/committed-after, and appends to fresh history. Input clone outside timer. Same process, machine, fixture and operation within each pair; no forced GC. Exact uninstrumented production modules. Median upper central order statistic; p95 nearest rank. A baseline; B candidate. No UI/paint included.',hardware:{cpu:os.cpus()[0].model,ram:os.totalmem(),os:os.release(),node:process.version},baselineSource:files(path.join(baseline,'src')).map(file=>({file:path.relative(baseline,file),sha256:sha(file)})),candidateSource:files('src').map(file=>({file,sha256:sha(file)})),comparison,samples},null,2)+'\n');
  console.log(JSON.stringify(comparison));
} else throw new Error('Use profile [suffix], abba, or session N');
