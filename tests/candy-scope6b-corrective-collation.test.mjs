import assert from 'node:assert/strict';
import { canonicalizeGraph, canonicalizeGraphAuthority, canonicalizeHyperedge, graphFingerprint, stableStringify } from '../src/graph/graphFingerprint.js';

// Compare the complete authority serialization and marker to the previous
// production comparator, including numeric, accent/case ties and Unicode IDs.
const legacyCompare = (a,b) => a.localeCompare(b, undefined, {numeric:true,sensitivity:'base'});
const ids = ['e10','e2','e01','e1','E1','é1','e\u03011','ß','ss','中文','😀','', '00000000000000000001', '9007199254740993', 'a-b','a_b', '\u0000'];
let seed = 731406;
for (let run=0;run<100;run++) {
  const order=[...ids];
  for(let i=order.length-1;i>0;i--) { seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const j=(seed>>>0)%(i+1);[order[i],order[j]]=[order[j],order[i]]; }
  const rows=order.map((id,index)=>({id,vertices:[String(index),'v10','v2'],attributes:{order:index}}));
  const expected=rows.map(canonicalizeHyperedge).sort((a,b)=>legacyCompare(a.id,b.id));
  assert.deepEqual(canonicalizeGraph(rows),expected);
  for(const graphType of ['Hypergraph','DynamicHypergraph']) {
    const options={graphType,explicitVertices:[...order,2,null]};
    const serialized=stableStringify({graphType,explicitVertices:options.explicitVertices.map(String).sort(legacyCompare),hyperedges:expected});
    assert.equal(stableStringify(canonicalizeGraphAuthority(rows,options)),serialized);
    let hash=2166136261;
    for(let i=0;i<serialized.length;i++) {hash^=serialized.charCodeAt(i);hash=Math.imul(hash,16777619);}
    assert.equal(graphFingerprint(rows,options),`gfp-${(hash>>>0).toString(16).padStart(8,'0')}-${serialized.length}`);
  }
}
console.log('Scope 6B cached collator preserves legacy canonical authority and fingerprint, including stable collation ties.');
