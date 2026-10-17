import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { createBenchmarkFixture } from './benchmarks/scope6a-fixtures.mjs';
import { createGraphState, commitGraphState } from '../src/graph/graphState.js';
import { graphFingerprint } from '../src/graph/graphFingerprint.js';
import { graphCounts } from '../src/graph/graphMutationPreview.js';
import { createGraphHistoryEvent, appendGraphHistory } from '../src/graph/graphHistory.js';
import { buildPreviewTopology } from '../src/visualization/hypergraphLayout.js';
import * as previewBudget from '../src/visualization/previewRenderBudget.js';
import { buildGraphMutationPlannerContext } from '../src/agent/prompts/graphMutationPlannerPrompt.js';
import { buildAssistantApplicationSnapshot } from '../src/agent/assistantContextSnapshot.js';
import { expH2V, buildH2V } from '../src/utils/mappings.js';

export function browserFixture(family) {
  if (['S1','S2','B1'].includes(family)) return createBenchmarkFixture(family).graph.hyperedges;
  const id = n => `v${String(n).padStart(6,'0')}`.padEnd(8,'x');
  if (family === 'B5') return [{ id:'e0', vertices:Array.from({length:1_000_000},(_,i)=>id(i)) }];
  if (family === 'B4') return Array.from({length:100_000},(_,e)=>({id:`e${e}`,vertices:Array.from({length:20},(_,j)=>id((20*e+j)%1_000_000))}));
  throw new Error(family);
}

if (process.argv[1]?.endsWith('measure-scope6b.mjs')) {
  const phase = process.argv[2] ?? 'before';
  const samples=[];
  for (const family of ['S1','S2','B1','B5']) {
    const rows=browserFixture(family);
    let state, history=[];
    const measure=(operation,run,fn)=>{ const start=performance.now();const value=fn();samples.push({family,operation,run,ms:performance.now()-start});return value; };
    state=measure('load_commit','cold',()=>createGraphState(rows));
    const repeats=family==='B5'?3:30;
    for(let i=-5;i<repeats;i++) {
      const run=i<0?'warmup':i;
      measure('same_graph_fingerprint',run,()=>graphFingerprint(state.hyperedges));
      measure('same_graph_counts',run,()=>graphCounts(state.hyperedges));
      measure('assistant_snapshot',run,()=>buildAssistantApplicationSnapshot({hasGraph:true,graphId:state.graphId,graphVersion:state.graphVersion,hyperedgeCount:rows.length}));
      if(family!=='B5') measure('assistant_planner',run,()=>buildGraphMutationPlannerContext({hyperedges:state.hyperedges,graphIdentity:state}));
    }
    measure('replacement','new_version',()=>commitGraphState(state,rows,{replacement:true}));
    measure('history_commit','cold',()=>{ const event=createGraphHistoryEvent({graphIdentity:state,beforeHyperedges:state.hyperedges,afterHyperedges:state.hyperedges});history=appendGraphHistory(history,event); });
    const selected=rows.slice(0,50);
    const visual=measure('preview_prepare','cold',()=>previewBudget.prepareBoundedPreview?previewBudget.prepareBoundedPreview(rows,50):{hyperedges:selected});
    const topology=measure('preview_topology','cold',()=>buildPreviewTopology(visual.hyperedges));
    if(family!=='B5') measure('export_h2v','cold',()=>expH2V(buildH2V(state.hyperedges)));
    samples.push({family,operation:'retained_counts',historyEntries:history.length,historySerializedChars:JSON.stringify(history).length,previewNodes:topology.vertices.length,previewHyperedges:visual.hyperedges.length});
  }
  writeFileSync(`artifacts/candy-scope6b-benchmark-${phase}.json`,JSON.stringify({schemaVersion:1,phase,capturedAt:new Date().toISOString(),baseline:'da4629b1f4204fbfc8f8e6d14941d29319d79e90',methodology:'Node monotonic production-function measurements; UI paint excluded. Five warmups, 30 warm samples; B5 three warm samples for allocation safety; one cold session. Full three-session/20 cold distribution is not claimed.',hardware:{cpu:os.cpus()[0].model,ram:os.totalmem()},software:{node:process.version,os:os.release()},fixtureGeneratorSha256:createHash('sha256').update(readFileSync('scripts/benchmarks/scope6a-fixtures.mjs')).digest('hex'),samples},null,2)+'\n');
}
