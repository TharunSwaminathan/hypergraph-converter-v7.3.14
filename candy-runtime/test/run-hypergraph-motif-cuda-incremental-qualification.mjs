import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packCudaIncrementalRequest, validateCudaIncrementalResult, signIncrementalPayload } from "./hypergraph-motif-cuda-incremental-contract.mjs";
import { validateCudaMotifResult } from "./hypergraph-motif-cuda-contract.mjs";
import { countHypergraphThreeEdgeMotifs } from "../../src/candy/hypergraphMotifs/referenceOracle.js";
import { HYPERGRAPH_3EDGE_MOTIF_TAXONOMY, S3_HYPEREDGE_PERMUTATIONS } from "../../src/candy/hypergraphMotifs/taxonomy.js";
import { CANDY_SCHEMA_VERSIONS } from "../../src/candy/contracts/schemaVersions.js";
import { canonicalIdentifierKey } from "../../src/candy/adapters/identifierMapping.js";
import { ALL_30_MOTIF_WITNESSES, ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE, ANCHOR_COUNTEREXAMPLE_DELETE, hypergraphValue } from "../../tests/fixtures/candy-scope4-motifs.mjs";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const build = join(root, "candy-runtime/native/hypergraph-motif-cuda-incremental/build");
const binary = join(build, "candy-hypergraph-motif-cuda-incremental");
const staticBinary = join(root, "candy-runtime/native/hypergraph-motif-cuda/build/candy-hypergraph-motif-cuda");
const sanitizer = process.argv.find(arg => arg.startsWith("--sanitizer="))?.slice(12) ?? null;
assert.equal(process.argv.slice(2).length, sanitizer ? 1 : 0);
assert.ok(!sanitizer || ["memcheck", "racecheck", "initcheck", "synccheck"].includes(sanitizer));
const wslPath = value => process.platform === "win32" && /^[A-Za-z]:/.test(value) ? `/mnt/${value[0].toLowerCase()}${value.slice(2).replaceAll("\\", "/")}` : value;
const report = { schemaVersion: "candy.scope4b2-native-qualification/1", status: "RUNNING", baseline: "592c91f938675d6c76d3179b080c95ed6e1b9398", staticQualifiedTag: "a27eb1246e342097de448408ffa0a4775545c4ae", backend: "CUDA_INCREMENTAL", mode: "INCREMENTAL", sanitizer, cases: [], failures: [], stress: { seed: "0x4b2c0de", plannedCases: sanitizer ? 0 : 128 }, chains: [], priorStateContract: "DELTA_ONLY_NO_PRIOR_COUNTS", insertionClassObservation: "Pure insertion leaves all existing triples unchanged; another class can be added alongside an existing wedge. Replacement covers actual class conversion." };
let workspace, requestPath;
function invoke(executable, path, useSanitizer = false, hideGpu = false, extraArgs = []) {
  const command = useSanitizer ? "/usr/local/cuda-13.4/bin/compute-sanitizer" : wslPath(executable);
  const args = useSanitizer ? ["--tool", sanitizer, "--error-exitcode", "86", wslPath(executable), "--request", wslPath(path), ...extraArgs] : ["--request", wslPath(path), ...extraArgs];
  const env = hideGpu ? { ...process.env, CUDA_VISIBLE_DEVICES: "-1", WSLENV: `${process.env.WSLENV ? process.env.WSLENV + ":" : ""}CUDA_VISIBLE_DEVICES` } : process.env;
  const child = process.platform === "win32" ? spawnSync("wsl.exe", ["-d", "Ubuntu", "--exec", command, ...args], { encoding: "utf8", timeout: 60_000, maxBuffer: 8*1024*1024, windowsHide: true, env }) : spawnSync(command, args, { encoding: "utf8", timeout: 60_000, maxBuffer: 8*1024*1024, env });
  assert.ifError(child.error); assert.equal(child.signal, null);
  const payload = JSON.parse(child.stdout.split(/\r?\n/).find(s => s.startsWith("{")) ?? "");
  const diagnostics = `${child.stdout}\n${child.stderr}`;
  if (useSanitizer) assert.match(diagnostics, sanitizer === "racecheck" ? /RACECHECK SUMMARY: 0 hazards displayed \(0 errors, 0 warnings\)/ : /ERROR SUMMARY: 0 errors/);
  return { status: child.status, payload, diagnostics };
}
export function updateFor(graph, deletions = [], insertions = [], updateId = "update") {
  return { schemaVersion: CANDY_SCHEMA_VERSIONS.HYPERGRAPH_MOTIF_UPDATE, updateId, baseGraphRef: { graphId: graph.graphId, graphVersion: graph.graphVersion }, nextGraphVersion: graph.graphVersion+1, ordering: "DELETE_THEN_INSERT", collisionPolicy: "REJECT_EXCEPT_EXACT_DELETE_REINSERT", deletions, insertions };
}
const dynamic = graph => ({ ...structuredClone(graph), graphType: "DynamicHypergraph" });
const graph = (id, edges, vertices = [0,1,2,3,"isolate"]) => hypergraphValue({ graphId: id, graphType: "DynamicHypergraph", vertices, hyperedges: edges.map(([id, vertices]) => ({ id, vertices })) });
function independentCandidates(n, affected) {
  const set = new Set(); let attempts = 0;
  for (const edge of affected) for (let i = 0; i < n; ++i) for (let j = i+1; j < n; ++j) if (i !== edge && j !== edge) { set.add([edge,i,j].sort((a,b) => a-b).join(",")); attempts++; }
  return { unique: set.size, attempts, duplicateAttempts: attempts-set.size };
}
async function staticCount(packed) {
  await writeFile(requestPath, packed.text);
  const run = invoke(staticBinary, requestPath);
  assert.equal(run.status, 0, run.diagnostics);
  return validateCudaMotifResult(run.payload, packed);
}
async function parity(id, old, update, useSanitizer = false, previous = null) {
  const packed = packCudaIncrementalRequest(old, update);
  const cpuOld = countHypergraphThreeEdgeMotifs(packed.oldGraph), cpuNew = countHypergraphThreeEdgeMotifs(packed.newGraph);
  const cudaOld = await staticCount(packed.oldStatic), cudaNew = await staticCount(packed.newStatic);
  assert.deepEqual(cudaOld.counts,cpuOld.counts); assert.deepEqual(cudaNew.counts,cpuNew.counts);
  assert.equal(cudaOld.totalConnectedTriples,cpuOld.totalConnectedTriples); assert.equal(cudaNew.totalConnectedTriples,cpuNew.totalConnectedTriples);
  if (previous) { assert.deepEqual(cpuOld.counts,previous.counts); assert.deepEqual(cudaOld.inputGraphRef,previous.ref); }
  await writeFile(requestPath,packed.text);
  const run = invoke(binary,requestPath,useSanitizer);
  assert.equal(run.status,0,`${id}: ${run.diagnostics}`);
  const result = validateCudaIncrementalResult(run.payload,packed);
  const expected = cpuNew.counts.map((count,i) => count-cpuOld.counts[i]);
  assert.deepEqual(result.deltaCounts,expected,`${id}: 30 signed deltas`);
  assert.deepEqual(result.deltaCounts,cudaNew.counts.map((count,i) => count-cudaOld.counts[i]));
  const reconstructed = cpuOld.counts.map((count,i) => count+result.deltaCounts[i]);
  assert.deepEqual(reconstructed,cpuNew.counts); assert.deepEqual(reconstructed,cudaNew.counts);
  assert.equal(result.deltaTotalConnectedTriples,cpuNew.totalConnectedTriples-cpuOld.totalConnectedTriples);
  assert.equal(cudaOld.totalConnectedTriples+result.deltaTotalConnectedTriples,cudaNew.totalConnectedTriples);
  const oldCandidates = independentCandidates(packed.oldGraph.hyperedgeCount,packed.oldAffected), newCandidates = independentCandidates(packed.newGraph.hyperedgeCount,packed.newAffected);
  assert.equal(oldCandidates.unique,result.oldCandidateCount); assert.equal(newCandidates.unique,result.newCandidateCount);
  report.device ??= result.cuda;
  report.cases.push({ id, oldCounts: cpuOld.counts, newCounts: cpuNew.counts, deltaCounts: result.deltaCounts, deltaTotal: result.deltaTotalConnectedTriples, oldRef: result.inputGraphRef, newRef: result.outputGraphRef, requestDigest: result.requestDigest, oldAffected: packed.oldAffected.length, newAffected: packed.newAffected.length, oldCandidates, newCandidates, launch: result.cuda.kernelLaunchSucceeded, synchronized: result.cuda.synchronizationSucceeded, ...(useSanitizer ? { diagnostics: run.diagnostics } : {}) });
  if (report.cases.length % 25 === 0) console.log(`Exact incremental CPU/STATIC parity: ${report.cases.length} updates passed`);
  return { packed,result,cpuOld,cpuNew, state: { counts: reconstructed,ref: result.outputGraphRef } };
}
const resign = text => signIncrementalPayload(text.slice(text.indexOf("\n",text.indexOf("\n")+1)+1)).text;
async function failure(id,text,expected,fault=null,path=requestPath,hideGpu=false,extraArgs=[]) {
  if (text !== null) await writeFile(path,text);
  assert.ok(!fault || ["UNAVAILABLE","ALLOCATION","LAUNCH","SYNC"].includes(fault));
  const run = invoke(fault ? `${binary}-fault-${fault}` : binary,path,false,hideGpu,extraArgs);
  assert.equal(run.status,1,`${id}: ${run.diagnostics}`); assert.equal(run.payload.ok,false); assert.equal(run.payload.error.classification,expected,id);
  assert.deepEqual(Object.keys(run.payload).sort(),["error","ok"]); assert.deepEqual(Object.keys(run.payload.error).sort(),["classification","message"]);
  report.failures.push({ id, expected, exit: run.status, payload: run.payload });
}
function linux(command,args) {
  assert.ok(["/usr/bin/mktemp","/usr/bin/ln","/usr/bin/mkfifo","/usr/bin/unlink","/usr/bin/rmdir"].includes(command));
  const run = process.platform === "win32" ? spawnSync("wsl.exe",["-d","Ubuntu","--exec",command,...args],{ encoding:"utf8",timeout:10000,windowsHide:true }) : spawnSync(command,args,{encoding:"utf8",timeout:10000});
  assert.ifError(run.error); assert.equal(run.status,0,run.stderr); return run.stdout.trim();
}
async function specialFiles() {
  const dir = linux("/usr/bin/mktemp",["-d","/tmp/candy-scope4b2-XXXXXX"]);
  assert.match(dir,/^\/tmp\/candy-scope4b2-[A-Za-z0-9]+$/);
  let linked=false,piped=false;
  try {
    linux("/usr/bin/ln",["-s",wslPath(requestPath),`${dir}/link`]); linked=true;
    linux("/usr/bin/mkfifo",[`${dir}/fifo`]); piped=true;
    await failure("final-symlink",null,"INVALID_GRAPH_SCHEMA",null,`${dir}/link`);
    await failure("fifo-no-hang",null,"INVALID_GRAPH_SCHEMA",null,`${dir}/fifo`);
  } finally { if (linked) linux("/usr/bin/unlink",[`${dir}/link`]); if (piped) linux("/usr/bin/unlink",[`${dir}/fifo`]); linux("/usr/bin/rmdir",[dir]); }
}
let randomState=0x4b2c0de;
const random=()=>{ randomState=(Math.imul(randomState,1664525)+1013904223)>>>0; return randomState/4294967296; };
function stressCase(index) {
  const vertices=Array.from({length:1+Math.floor(random()*24)},(_,i)=>i%2 ? `v-${i*1009}` : i*10007);
  const memberships=()=>{ const selected=vertices.filter(()=>random()<[0.08,0.3,0.8][index%3]); return selected.length ? selected : [vertices[Math.floor(random()*vertices.length)]]; };
  const edges=Array.from({length:3+Math.floor(random()*14)},(_,i)=>({ id:i%2 ? `h-${i*101}` : i*1009,vertices:memberships() }));
  if (index%7===0) edges[1].vertices=[...edges[0].vertices];
  const old=hypergraphValue({graphId:`update-stress-${index}`,graphType:"DynamicHypergraph",vertices:[...vertices,"isolate"],hyperedges:edges});
  const type=index%5;
  const deletions=type===1 || type===2 || type===3 ? [edges[0].id,...(index%2 ? [edges[1].id] : [])] : [];
  const insertions=type===0 || type===2 ? [{id:`new-${index}`,vertices:memberships()},...(index%2 ? [{id:`second-${index}`,vertices:memberships()}] : [])] : type===3 ? deletions.map(id=>({id,vertices:memberships()})) : [];
  return {old,update:updateFor(old,deletions,insertions,`stress-${index}`),type:["insertion","deletion","mixed","replacement","zero-effect"][type]};
}
function namedCases() {
  const wedge=graph("wedge",[["A",[0]],["B",[0,1]],["C",[1]]]);
  const triangle=graph("triangle",[["A",[0]],["B",[0]],["C",[0]]]);
  const disconnected=graph("disconnected",[["A",[0]],["B",[0]],["C",[2]]]);
  const cases=[];
  const add=(id,old,deletions,insertions)=>cases.push({id,old,update:updateFor(old,deletions,insertions,id)});
  add("insert-open-wedge",{...wedge,hyperedges:wedge.hyperedges.slice(0,2)},[],[wedge.hyperedges[2]]);
  add("insert-closed-triangle",{...triangle,hyperedges:triangle.hyperedges.slice(0,2)},[],[triangle.hyperedges[2]]);
  add("insertion-adds-class-alongside-wedge",wedge,[],[{id:"D",vertices:[0,1]}]);
  add("delete-open-wedge",wedge,["B"],[]); add("delete-closed-triangle",triangle,["C"],[]);
  add("replace-class-preserve-connected",wedge,["A"],[{id:"A",vertices:[0,1]}]);
  add("replace-connected-to-disconnected",triangle,["C"],[{id:"C",vertices:[2]}]);
  add("replace-disconnected-to-connected",disconnected,["C"],[{id:"C",vertices:[0]}]);
  add("two-deleted-same-triple",triangle,["A","B"],[]); add("three-deleted-same-triple",triangle,["A","B","C"],[]);
  add("two-inserted-same-triple",{...triangle,hyperedges:triangle.hyperedges.slice(0,1)},[],triangle.hyperedges.slice(1));
  add("three-inserted-same-triple",{...triangle,hyperedges:[]},[],triangle.hyperedges);
  add("overlapping-replacements",wedge,["A","B"],[{id:"A",vertices:[0,1]},{id:"B",vertices:[1]}]);
  add("mixed-affects-all-members",triangle,["A","B"],[{id:"A",vertices:[0,1]},{id:"D",vertices:[1]}]);
  add("zero-effect-empty-update",triangle,[],[]); add("zero-effect-exact-reinsert",triangle,["B"],[triangle.hyperedges[1]]);
  add("isolated-singleton-insertion",triangle,[],[{id:"singleton",vertices:[3]}]);
  const typed=graph('identity "\\\n🍬\ud800',[[0,[0,"0"]],["0",["0"]],[9007199254740991,[0]]],[0,"0","isolate"]);
  add("typed-sparse-ids-new-vertices",typed,[0],[{id:0,vertices:["0",-9007199254740991,"new"]}]);
  add("membership-renumbering",triangle,[],[{id:"early",vertices:[-999]}]);
  add("less-than-three-zero",graph("empty",[],[]),[],[{id:0,vertices:["new"]}]);
  add("high-concurrency-many-affected",graph("parallel",Array.from({length:100},(_,i)=>[i,[0]])),Array.from({length:30},(_,i)=>i),Array.from({length:30},(_,i)=>({id:i,vertices:[0,1]})));
  add("affected-edge-many-motifs",graph("hub",[["hub",[0,1,2,3]],...Array.from({length:20},(_,i)=>[i,[i%4]])]),["hub"],[{id:"hub",vertices:[0]}]);
  add("max-realizable-216",graph("max-edges",Array.from({length:216},(_,i)=>[i,[0]])),[0],[{id:0,vertices:[0]}]);
  return cases;
}
try {
  // Hashing precedes mkdtemp, so missing binaries leave no workspace.
  report.binarySha256=createHash("sha256").update(await readFile(binary)).digest("hex");
  report.staticBinarySha256=createHash("sha256").update(await readFile(staticBinary)).digest("hex");
  workspace=await mkdtemp(join(build,"qualification-")); requestPath=join(workspace,"request.txt");
  if (sanitizer) {
    const selected=new Set(["insert-open-wedge","delete-closed-triangle","replace-class-preserve-connected","mixed-affects-all-members","overlapping-replacements","high-concurrency-many-affected"]);
    for (const value of namedCases().filter(c=>selected.has(c.id))) await parity(value.id,value.old,value.update,true);
  } else {
    for (const witness of ALL_30_MOTIF_WITNESSES) {
      const old=dynamic(witness.graph);
      const small={...old,hyperedges:old.hyperedges.slice(0,2)};
      const create=await parity(`class-${witness.motifId}-create`,small,updateFor(small,[],[old.hyperedges[2]],`create-${witness.motifId}`));
      assert.equal(create.result.deltaCounts[witness.motifId-1],1);
      const destroy=await parity(`class-${witness.motifId}-destroy`,old,updateFor(old,[old.hyperedges[2].id],[],`destroy-${witness.motifId}`));
      assert.equal(destroy.result.deltaCounts[witness.motifId-1],-1);
      for (const permutation of S3_HYPEREDGE_PERMUTATIONS) {
        const renamed=structuredClone(old); renamed.hyperedges.forEach((e,i)=>{e.id=`edge-${permutation[i]}`;});
        renamed.vertices.reverse(); renamed.hyperedges.forEach(e=>e.vertices.reverse());
        const base={...renamed,hyperedges:renamed.hyperedges.slice(0,2)};
        await parity(`class-${witness.motifId}-S3-${permutation.join("")}`,base,updateFor(base,[],[renamed.hyperedges[2]],`S3-${permutation.join("")}`));
      }
    }
    report.classCoverage={ all:30,creation:30,destruction:30,openWedge:6,closedTriangle:24,s3:180 };
    for (const value of namedCases()) await parity(value.id,value.old,value.update);
    const anchor=await parity("permanent-anchor-regression",ANCHOR_OVER_SUBTRACTION_COUNTEREXAMPLE,ANCHOR_COUNTEREXAMPLE_DELETE);
    const closed=HYPERGRAPH_3EDGE_MOTIF_TAXONOMY.entries.filter(e=>e.shape==="CLOSED_TRIANGLE").map(e=>e.motifId-1);
    const sum=(counts)=>closed.reduce((total,i)=>total+counts[i],0);
    assert.equal(sum(anchor.cpuOld.counts),2); assert.equal(sum(anchor.cpuNew.counts),1); assert.equal(sum(anchor.result.deltaCounts),-1);
    report.anchorRegression={oldClosed:2,newClosed:1,cudaClosedDelta:-1,faultyAnchorReference:-2,all30BinsExact:true};
    for (let index=0; index<128; ++index) { const value=stressCase(index); await parity(`stress-${index}-${value.type}`,value.old,value.update); }
    report.stress.passed=128; report.stress.failed=0;
    let current=graph("chain",[["A",[0]],["B",[0]],["C",[0]]]),previous=null;
    const steps=[ [[],[]], [[],[{id:"D",vertices:[0]}]], [["D"],[]], [["B"],[]], [[],[{id:"B",vertices:[0]}]], [["A"],[{id:"A",vertices:[1]}]], [["A"],[{id:"A",vertices:[0,1]}]], [["B"],[{id:"E",vertices:[1]}]], [["E"],[{id:"B",vertices:[0]}]], [[],[{id:"isolate",vertices:[3]}]], [["isolate"],[]], [[],[]] ];
    for (const [i,[deletions,insertions]] of steps.entries()) {
      const check=await parity(`chain-step-${i}`,current,updateFor(current,deletions,insertions,`chain-${i}`),false,previous);
      report.chains.push({step:i,oldRef:check.result.inputGraphRef,newRef:check.result.outputGraphRef,exact:true});
      current=check.packed.newValue; previous=check.state;
    }
    const control=await parity("error-result-control",graph("control",[["A",[0,1]],["B",[0]],["C",[0]]]),updateFor(graph("control",[["A",[0,1]],["B",[0]],["C",[0]]]),["C"],[{id:"C",vertices:[1]}],"control"));
    const text=control.packed.text;
    const mutation=(id,from,to,code)=>[id,resign(text.replace(from,to)),code];
    const errors=[
      mutation("algorithm","algorithm HYPERGRAPH_3EDGE_MOTIF_COUNT","algorithm SSSP","ALGORITHM_FAILURE"),
      mutation("taxonomy","taxonomy candy.hypergraph-3edge-motif-taxonomy/1","taxonomy wrong","INVALID_GRAPH_SCHEMA"),
      mutation("static-mode","mode INCREMENTAL","mode STATIC","UNSUPPORTED_MODE"),
      ...["Hypergraph","OrdinaryGraph","DynamicOrdinaryGraph","ProjectedOrdinaryGraph"].map(type=>mutation(type,"graph_type DynamicHypergraph",`graph_type ${type}`,"INVALID_GRAPH_TYPE")),
      mutation("version-progression","new_graph_version 2","new_graph_version 3","STALE_GRAPH_VERSION"),
      mutation("unsafe-version","old_graph_version 1","old_graph_version 9007199254740992","RESOURCE_LIMIT"),
      mutation("negative-device","cuda_device 0","cuda_device -1","INVALID_GRAPH_SCHEMA"),
      mutation("invalid-device","cuda_device 0","cuda_device 99","BACKEND_UNAVAILABLE"),
      mutation("overflow-number","old_hyperedge_count 3","old_hyperedge_count 18446744073709551615","INVALID_GRAPH_SCHEMA"),
      mutation("numeric-suffix","old_vertex_count 5","old_vertex_count 5x","INVALID_GRAPH_SCHEMA"),
      ...["old_","new_"].flatMap(prefix=>[
        mutation(`${prefix}edge-limit`,`${prefix}hyperedge_count 3`,`${prefix}hyperedge_count 257`,"RESOURCE_LIMIT"),
        mutation(`${prefix}incidence-limit`,`${prefix}incidence_count 4`,`${prefix}incidence_count 100001`,"RESOURCE_LIMIT"),
        [`${prefix}work-limit`,resign(text.replace(`${prefix}hyperedge_count 3`,`${prefix}hyperedge_count 256`).replace(`${prefix}incidence_count 4`,`${prefix}incidence_count 100000`)),"RESOURCE_LIMIT"],
        mutation(`${prefix}vertex-limit`,`${prefix}vertex_count 5`,`${prefix}vertex_count 1000001`,"RESOURCE_LIMIT"),
        mutation(`${prefix}offset-count`,`${prefix}offsets 4 `,`${prefix}offsets 3 `,"INVALID_GRAPH_SCHEMA"),
        mutation(`${prefix}offset-start`,`${prefix}offsets 4 0 `,`${prefix}offsets 4 1 `,"INVALID_GRAPH_SCHEMA"),
        mutation(`${prefix}offset-decrease`,new RegExp(`${prefix}offsets [^\\n]+`),`${prefix}offsets 4 0 2 1 4`,"INVALID_GRAPH_SCHEMA"),
        mutation(`${prefix}duplicate-member`,`${prefix}memberships 4 0 1 0 `,`${prefix}memberships 4 0 0 0 `,"INVALID_GRAPH_SCHEMA"),
        mutation(`${prefix}unsorted-member`,`${prefix}memberships 4 0 1 0 `,`${prefix}memberships 4 1 0 0 `,"INVALID_GRAPH_SCHEMA"),
        mutation(`${prefix}member-range`,`${prefix}memberships 4 0 1 0 `,`${prefix}memberships 4 0 9 0 `,"INVALID_VERTEX"),
        mutation(`${prefix}affected-range`,`${prefix}affected 1 2`,`${prefix}affected 1 3`,"INVALID_UPDATE_BATCH"),
        mutation(`${prefix}affected-duplicate`,`${prefix}affected 1 2`,`${prefix}affected 2 2 2`,"INVALID_UPDATE_BATCH"),
        mutation(`${prefix}candidate-limit`,`${prefix}candidate_count 1`,`${prefix}candidate_count 2763521`,"RESOURCE_LIMIT"),
        mutation(`${prefix}candidate-mismatch`,`${prefix}candidate_count 1`,`${prefix}candidate_count 0`,"INVALID_UPDATE_BATCH"),
        mutation(`${prefix}duplicate-tags`,`${prefix}edge_tags 3 0 1 2`,`${prefix}edge_tags 3 0 0 2`,"INVALID_GRAPH_SCHEMA"),
      ]),
      mutation("omitted-changed-affected","old_affected 1 2\nold_candidate_count 1","old_affected 0 \nold_candidate_count 0","INVALID_UPDATE_BATCH"),
      mutation("unchanged-incidence-tamper","new_memberships 4 0 1 0 1","new_memberships 4 0 2 0 1","INVALID_UPDATE_BATCH"),
      mutation("identity-encoding",/graph_id_u16 [^\n]+/,"graph_id_u16 zz","INVALID_GRAPH_SCHEMA"),
      ["digest-tamper",text.replace(/request_digest (.)/,(_,digit)=>`request_digest ${digit === "f" ? "e" : "f"}`),"INVALID_GRAPH_SCHEMA"],
      ["static-wire",control.packed.oldStatic.text,"INVALID_GRAPH_SCHEMA"],
      ["missing-fields",resign(text.slice(0,text.indexOf("old_offsets"))),"INVALID_GRAPH_SCHEMA"],
      ["extra-H2H",resign(text+"H2H 1 2"),"INVALID_GRAPH_SCHEMA"],
      ["forbidden-prior-counts",resign(text+"prior_counts 30 0"),"INVALID_GRAPH_SCHEMA"],
      ["malformed-file","BROKEN\n","INVALID_GRAPH_SCHEMA"],
      ["request-byte-limit","x".repeat(2*1024*1024+1),"RESOURCE_LIMIT"],
    ];
    for (const [id,raw,expected] of errors) { assert.notEqual(raw,text,`${id}: mutation applied`); await failure(id,raw,expected); }
    await failure("invalid-flags",text,"INVALID_GRAPH_SCHEMA",null,requestPath,false,["--device","0"]);
    await failure("inaccessible",null,"INVALID_GRAPH_SCHEMA",null,join(workspace,"missing"));
    await failure("directory",null,"INVALID_GRAPH_SCHEMA",null,workspace);
    await failure("actual-no-visible-device",text,"BACKEND_UNAVAILABLE",null,requestPath,true);
    await specialFiles();
    for (const fault of ["UNAVAILABLE","ALLOCATION","LAUNCH","SYNC"]) await failure(`forced-${fault}`,text,"BACKEND_UNAVAILABLE",fault);
    const badUpdates=[
      u=>{u.deletions=["missing"];},u=>{u.deletions=["C","C"];},u=>{u.deletions=[];},u=>{u.insertions.push({...u.insertions[0]});},
      u=>{u.insertions[0].vertices=[0,0];},u=>{u.insertions[0].vertices=[];},u=>{u.ordering="INSERT_THEN_DELETE";},
      u=>{u.baseGraphRef.graphId="wrong";},u=>{u.baseGraphRef.graphVersion=0;},u=>{u.nextGraphVersion=3;},u=>{u.H2H=[];},
      u=>{u.insertions=Array.from({length:257},(_,i)=>({id:i,vertices:[0]}));},u=>{u.insertions[0].vertices=Array(100001).fill(0);},
      u=>{u.deletions=[];u.insertions=Array.from({length:254},(_,i)=>({id:i,vertices:[0]}));},
    ];
    badUpdates.forEach((mutate,i)=>{const update=structuredClone(control.packed.update); mutate(update); assert.throws(()=>packCudaIncrementalRequest(graph("control",[["A",[0,1]],["B",[0]],["C",[0]]]),update)); report.failures.push({id:`invalid-qualified-update-${i}`,boundary:"adapter/packing",rejected:true});});
    for (const mutate of [v=>{v.graphType="Hypergraph";},v=>{v.H2H=[];},v=>{v.priorCounts=Array(30).fill(0);},v=>{v.hyperedges[1].id=v.hyperedges[0].id;}]) { const old=graph("control",[["A",[0,1]],["B",[0]],["C",[0]]]); mutate(old); assert.throws(()=>packCudaIncrementalRequest(old,control.packed.update)); report.failures.push({id:`invalid-old-${report.failures.length}`,boundary:"adapter",rejected:true}); }
    const corruptions=[
      v=>{v.inputGraphRef.graphId="wrong";},v=>{v.inputGraphRef.graphVersion=0;},v=>{v.outputGraphRef.graphVersion=3;},v=>{v.outputGraphRef.graphId="wrong";},
      v=>{v.taxonomyVersion="wrong";},v=>{v.requestDigest="0".repeat(64);},v=>{v.updateId="wrong";},v=>{v.cuda.deviceIndex=99;},v=>{v.backend="CPU_REFERENCE_ORACLE";},
      v=>{v.deltaCounts.pop();},v=>{v.deltaCounts[0]=Number.MAX_SAFE_INTEGER+1;},v=>{v.deltaCounts[0]++;},v=>{v.deltaTotalConnectedTriples++;},
      v=>{v.oldAffectedCounts[0]=-1;},v=>{v.newAffectedCounts[0]=99;},v=>{v.oldCandidateCount++;},v=>{v.newAffectedEdgeCount++;},
      v=>{v.cuda.kernelLaunchSucceeded=false;},v=>{v.cuda.synchronizationSucceeded=false;},v=>{v.cuda.kernelMilliseconds=NaN;},v=>{v.priorCounts=Array(30).fill(0);},
    ];
    corruptions.forEach((mutate,i)=>{const value=structuredClone(control.result);mutate(value);assert.throws(()=>validateCudaIncrementalResult(value,control.packed));report.failures.push({id:`corrupt-result-${i}`,rejected:true});});
    const nextRequest=packCudaIncrementalRequest(control.packed.newValue,updateFor(control.packed.newValue,[],[],"next"));
    assert.throws(()=>validateCudaIncrementalResult(control.result,nextRequest)); report.failures.push({id:"replayed-prior-result",rejected:true});
    assert.throws(()=>validateCudaIncrementalResult(control.result,{...control.packed})); report.failures.push({id:"forged-request-context",rejected:true});
  }
  report.status="NATIVE_QUALIFICATION_PASS";report.passed=report.cases.length;report.failed=0;
  report.nativeTypedFailures=report.failures.filter(value=>value.exit===1).length;
} catch (error) {report.status="NATIVE_QUALIFICATION_FAIL";report.failed=1;report.error=error.stack;process.exitCode=1;}
finally {
  if (workspace) await rm(workspace,{recursive:true,force:true});
  await writeFile(join(root,"artifacts",`candy-scope4b2-cuda-incremental-${sanitizer ?? "native"}-qualification.json`),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({status:report.status,passed:report.passed,failed:report.failed,failures:report.failures.length,binarySha256:report.binarySha256,sanitizer,error:report.error}));
}
