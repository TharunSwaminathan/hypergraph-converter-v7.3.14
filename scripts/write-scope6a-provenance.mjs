import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { digest } from "./benchmarks/scope6a-fixtures.mjs";
const git=(...args)=>execFileSync("git",args,{windowsHide:true});
const value=(...args)=>git(...args).toString("utf8").trim();
const anchors={integration:"b24c4e32100d2e7c05b13df3c8f6f9e279fd8828",readiness:"f8343ae195e37885726c396733dd6f5b9468f0fb",
  qualified:"54dd4d3edb73681f51bf8bb69b9708778a46a502",blocked:"bf0240a54fb6ac8284bd9ac371306511158a1a2e"};
if(value("rev-parse","HEAD")!==anchors.readiness || value("branch","--show-current")!=="candy-integration-scope6a-release-hardening")throw Error("Unexpected 6A baseline");
for(const [tag,key] of [["candy-integration-scope5f-final-qualified","qualified"],["candy-integration-scope5f-browser-blocked","blocked"]])if(value("rev-parse",`${tag}^{}`)!==anchors[key])throw Error("Protected tag moved");
for(const [before,after] of [["blocked","qualified"],["qualified","integration"],["integration","readiness"]])git("merge-base","--is-ancestor",anchors[before],anchors[after]);
if(value("rev-parse",`${anchors.readiness}^`)!==anchors.integration)throw Error("Readiness parent mismatch");
const protectedPaths=["candy-runtime/native/hypergraph-motif-cuda","candy-runtime/native/hypergraph-motif-cuda-incremental","package.json","package-lock.json"];
if(value("diff","--name-only",anchors.readiness,"--",...protectedPaths))throw Error("Protected source/manifests changed");
if(value("diff","--name-only",anchors.readiness,"--","artifacts/candy-scope5*","artifacts/candy-scope6-*"))throw Error("Historical evidence changed");
const changed=value("diff","--name-only",anchors.readiness).split(/\r?\n/).filter(Boolean);
const untracked=value("ls-files","--others","--exclude-standard").split(/\r?\n/).filter(Boolean);
const sourcePaths=[...new Set([...changed,...untracked])].filter(path=>!path.startsWith("artifacts/")).sort();
const sourceInventory=await Promise.all(sourcePaths.map(async path=>({path,sha256:digest(await readFile(path))})));
const packaged=JSON.parse(await readFile("artifacts/candy-scope6a-package-qualification.json","utf8"));
const manifest={schemaVersion:"candy.scope6a-release-manifest/1",capturedAt:new Date().toISOString(),descriptiveOnly:true,authority:false,publisherAttestation:false,
  distribution:"BROWSER_ONLY_SOURCE",branch:value("branch","--show-current"),head:value("rev-parse","HEAD"),uncommitted:true,anchors,
  ancestryVerified:true,readinessParentVerified:true,protectedTagsUnchanged:true,protectedSourceDelta:[],dependencyManifestDelta:[],historicalEvidenceDelta:[],
  trackedDiffSha256:digest(git("diff","--binary",anchors.readiness)),sourceInventory,sourceInventorySha256:digest(JSON.stringify(sourceInventory)),
  sourceArchive:{sha256:packaged.cases[0].sha256,bytes:packaged.cases[0].bytes,identicalCleanPopulated:packaged.identicalBytes},
  bytePolicy:{source:"Exact checkout bytes; Git LF and checkout CRLF are distinct identities",native:"Unchanged exact deployed native source/Makefile/binary qualification; no normalization"},
  historicalPrecommitFields:"Scope5 final JSON HEAD/qualifiedCommit/releaseEligible/uncommitted fields describe capture time before qualified commit; blocked tag remains historical",
  futureStandaloneCudaRelease:"Requires separately reviewed equivalent verified release identity; current Git/evidence verification is not bypassed"};
await writeFile("artifacts/candy-scope6a-release-manifest.json",JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify({status:"PROVENANCE_BOUND",sourceFiles:sourceInventory.length,head:manifest.head}));
