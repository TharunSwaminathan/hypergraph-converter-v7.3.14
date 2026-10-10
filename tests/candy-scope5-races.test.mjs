import assert from "node:assert/strict";
import { harness, selector } from "./fixtures/candy-scope5-runtime.mjs";
const changed=h=>{h.graph={...h.graph,graphVersion:h.graph.graphVersion+1};};
const edit=h=>h.stage([{type:"ADD_INCIDENCE",hyperedgeId:"h2",vertexId:"d"}]);
for(const boundary of ["graphUpload","updateUpload","jobCreation","polling","download"]) {
  const h=await harness(),before=h.graph;
  if(boundary.includes("Upload")) {
    const upload=h.client.uploadArtifact;let uploads=0;
    h.client.uploadArtifact=async payload=>{const artifact=await upload(payload);if(++uploads===(boundary==="graphUpload"?1:2)) {if(boundary==="graphUpload")changed(h);else await edit(h);}return artifact;};
    assert.equal((await h.run()).ok,false);assert.equal(h.counts.submissions,0);
  } else if(boundary==="jobCreation") {
    const submit=h.client.submitJob;h.client.submitJob=async payload=>{const job=await submit(payload);changed(h);h.client.cancelJob=async()=>{throw new Error("cancel unavailable");};return job;};
    assert.equal((await h.run()).ok,false);assert.equal(h.counts.submissions,1);
  } else {
    await h.run();
    const method=boundary==="polling"?"getJob":"getResult",operation=h.client[method];
    h.client[method]=async(...args)=>{const result=await operation(...args);changed(h);return result;};
    assert.equal((await (boundary==="polling"?h.analysis.getJobStatus(h.job.jobId):h.analysis.openResult(h.job.jobId))).ok,false);
  }
  assert.equal(h.analysis.currentResult(),null);assert.equal(h.counts.commits,0);assert.equal(before.graphVersion,1);
}
for(const invalidate of [changed,edit,h=>{h.runtime={...h.runtime,runtimeSessionId:"restarted"};},h=>{h.pending.discard();},h=>{h.analysis.dispose();}]) {
  const h=await harness(),args=selector(h.pending.getCurrent()),confirmation=h.analysis.stage(args).confirmation;
  await invalidate(h);assert.equal((await h.analysis.submit(args,confirmation)).ok,false);assert.equal(h.counts.uploads,0);
}
const expiry=await harness(),args=selector(expiry.pending.getCurrent()),approval=expiry.analysis.stage(args).confirmation;
const now=Date.now;try{Date.now=()=>approval.expiresAt+1;assert.equal((await expiry.analysis.submit(args,approval)).ok,false);}finally{Date.now=now;}

for(const terminal of ["cancelled","timeout"]) {
  const h=await harness();await h.run();const before=h.graph,pending=h.pending.getCurrent();
  if(terminal==="cancelled") {
    let finish;const downloaded=new Promise(resolve=>{finish=resolve;});
    h.client.getResult=()=>downloaded;
    const opening=h.analysis.openResult(h.job.jobId);await new Promise(resolve=>setTimeout(resolve,0));
    h.client.cancelJob=async()=>{throw new Error("offline cancellation");};await h.analysis.cancelJob(h.job.jobId);
    finish(h.result);assert.equal((await opening).ok,false);assert.equal(h.analysis.getSnapshot().status,"CANCELLED");
  } else {
    h.job={...h.job,status:"failed",error:{classification:"TIMEOUT"}};
    assert.equal((await h.analysis.getJobStatus(h.job.jobId)).ok,true);assert.equal(h.analysis.getSnapshot().status,"FAILED");
    h.job={...h.job,status:"completed"};assert.equal((await h.analysis.openResult(h.job.jobId)).ok,false);
  }
  assert.equal(h.analysis.currentResult(),null);assert.equal(h.graph,before);assert.equal(h.pending.getCurrent(),pending);assert.equal(pending.status,"VALIDATED");assert.equal(h.counts.commits,0);assert.equal(h.counts.submissions,1);
  assert.equal((await h.analysis.submit(selector(pending))).ok,false,"retry requires fresh authorization");
}
const abandoned=await harness();let finish;const upload=abandoned.client.uploadArtifact;
abandoned.client.uploadArtifact=async payload=>{await new Promise(resolve=>{finish=resolve;});return upload(payload);};
const running=abandoned.run();while(!finish)await new Promise(resolve=>setTimeout(resolve,0));abandoned.analysis.dispose();finish();assert.equal((await running).ok,false);assert.equal(abandoned.counts.submissions,0);
const superseded=await harness();await superseded.run();await edit(superseded);superseded.analysis.synchronize();assert.equal(superseded.analysis.getSnapshot().status,"STALE");assert.equal((await superseded.analysis.openResult(superseded.job.jobId)).ok,false);
// A digest completion cannot restore a superseded 5B validation revision.
const validateRace=await harness();const staging=edit(validateRace);validateRace.pending.discard();await assert.rejects(staging);assert.equal(validateRace.pending.getCurrent(),null);
console.log("Scope 5C upload/job/poll/download, supersession, cancellation, timeout, expiry, restart and unmount races passed.");
