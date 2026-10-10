import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { motifGraphBudget } from "../../src/candy/motifPreflight.js";
import { packCudaMotifRequest } from "../../candy-runtime/test/hypergraph-motif-cuda-contract.mjs";

export const FIXTURE_SEEDS = Object.freeze([731406,731407,731408]);
export const FIXTURE_GRID = Object.freeze({S1:{lane:"Q",edges:16,cardinality:4},S2:{lane:"Q",edges:64,cardinality:8},
  S3:{lane:"Q",edges:128,cardinality:4},B1:{lane:"B",edges:10000,cardinality:4}});
export const digest = bytes => createHash("sha256").update(bytes).digest("hex");
// xorshift32 + Fisher–Yates semantic-label permutation; topology stays disjoint.
export function createBenchmarkFixture(family="S1",seed=731406) {
  const spec=FIXTURE_GRID[family];
  if(!spec || !FIXTURE_SEEDS.includes(seed)) throw new RangeError("Only the bounded published fixture grid/seeds are implemented.");
  const {edges:E,cardinality:k,lane}=spec,I=E*k;
  let state=seed>>>0;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
  const labels=Array.from({length:I},(_,i)=>i);
  for(let i=labels.length-1;i>0;i--) {const j=Math.floor(random()*(i+1));[labels[i],labels[j]]=[labels[j],labels[i]];}
  const id=i=>`v${String(i).padStart(6,"0")}`.padEnd(8,"x");
  const graph={schemaVersion:"candy.hypergraph-incidence/1",graphId:`fixture-${family}-${seed}`,graphVersion:1,graphType:"DynamicHypergraph",
    vertices:labels.map(id),hyperedges:Array.from({length:E},(_,e)=>({id:`e${e}`.padEnd(8,"x"),vertices:Array.from({length:k},(_,j)=>id(labels[e*k+j]))}))};
  const json=JSON.stringify(graph),bytes=Buffer.byteLength(json),budget=motifGraphBudget(graph);
  const packed=lane==="Q"?packCudaMotifRequest(graph):null;
  const manifest={schemaVersion:"candy.benchmark-fixture/1",generatorVersion:"scope6a-disjoint-xorshift32/1",
    generatorSha256:digest(readFileSync(new URL(import.meta.url))),family,seed,lane,graphId:graph.graphId,graphVersion:1,graphType:graph.graphType,
    E,V:I,I,explicitIsolatedVertices:0,construction:"disjoint; seeded label permutation",rowCardinalities:Array(E).fill(k),
    cardinality:{min:k,max:k,mean:k,p50:k,p95:k},degreeHistogram:{1:I},maxDegree:1,idTypes:{string:E+I},idLengths:{8:E+I},
    membershipWork:E<3?0:I*(E-1)*(E-2)/2,jsonBytes:bytes,jsonSha256:digest(json),nativeBytes:packed?Buffer.byteLength(packed.text):null,
    nativeSha256:packed?digest(packed.text):null,admission:budget.ok?"WITHIN_COUNTS_WORK":"REJECTED",rejection:budget.ok?null:budget.reason,
    expectedConnectedTriples:lane==="Q"?0:null,descriptiveOnly:true,authority:false};
  return {graph,manifest};
}
export function requireQualifiedBenchmarkFixture(fixture) {
  if(fixture.manifest.lane!=="Q" || fixture.manifest.family[0]!=="S" || !motifGraphBudget(fixture.graph).ok
    || Buffer.byteLength(JSON.stringify(fixture.graph))>6*1024*1024) throw new RangeError("Browser/research fixtures cannot enter the qualified native lane.");
  // Exact packing budget is checked before any network or executable call.
  packCudaMotifRequest(fixture.graph);return fixture.graph;
}
