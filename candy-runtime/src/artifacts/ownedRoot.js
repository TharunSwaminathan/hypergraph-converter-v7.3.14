import { lstat, mkdir, open, readFile, realpath, readdir, unlink, rmdir, writeFile, mkdtemp } from "node:fs/promises";
import { resolve, sep, join } from "node:path";
import { CandyContractError } from "../../../src/candy/contracts/errorClasses.js";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
const fail=message=>{throw new CandyContractError("RESOURCE_LIMIT",message);};
const MARKER="candy.artifact-store/1\n";
const retryCleanup=async operation=>{
  for(let attempt=0;;attempt++) {
    try{return await operation();}
    catch(error){if(attempt>=5 || !["EBUSY","EPERM","EACCES","ENOTEMPTY"].includes(error.code))throw error;await new Promise(resolve=>setTimeout(resolve,100*(attempt+1)));}
  }
};
export const artifactFile=/^[a-f0-9]{64}\.artifact$/;

// Recovery is restricted to a marked, exclusively owned root. Never adopt
// persisted bytes as session authority and never recursively delete a tree.
export class OwnedRoot {
  constructor(root) { this.root=resolve(root); this.recoveredFiles=0; }
  async initialize() {
    await mkdir(this.root,{recursive:true,mode:0o700});
    const info=await lstat(this.root);
    if(!info.isDirectory() || info.isSymbolicLink())fail("Artifact root must be a private directory.");
    this.realRoot=await realpath(this.root);
    await this.acquireLease();
    try {
    const marker=join(this.root,".candy-store");
    if(!(await readdir(this.root)).length)await writeFile(marker,MARKER,{flag:"wx",mode:0o600});
    else {
      const entry=await lstat(marker);
      if(!entry.isFile() || entry.isSymbolicLink() || entry.size!==Buffer.byteLength(MARKER) || await readFile(marker,"utf8")!==MARKER)fail("Existing artifact root has no valid ownership marker.");
    }
    this.lockPath=join(this.root,".candy-owner");
    try { this.lock=await open(this.lockPath,"wx",0o600); }
    catch(error) {
      if(error.code!=="EEXIST")throw error;
      const lockInfo=await lstat(this.lockPath);
      if(!lockInfo.isFile() || lockInfo.isSymbolicLink() || lockInfo.size>32)fail("Invalid artifact ownership lock.");
      const text=await readFile(this.lockPath,"utf8");
      if(!/^[1-9][0-9]{0,9}\n$/.test(text))fail("Invalid artifact ownership lock.");
      // The kernel lease, not a reusable PID or unlinkable pathname, owns this
      // root. An acquired lease makes a leftover PID file diagnostic only.
      await this.removeFile(this.lockPath); this.lock=await open(this.lockPath,"wx",0o600);
    }
    await this.lock.writeFile(`${process.pid}\n`);
      for(const name of await readdir(this.root)) {
        if([".candy-store",".candy-owner"].includes(name))continue;
        if(artifactFile.test(name)){await this.removeFile(join(this.root,name));this.recoveredFiles++;}
        else if(name==="workspaces")await this.clearWorkspaces();
        else fail("Unrecognized file in owned artifact root; operator cleanup required.");
      }
      await mkdir(join(this.root,"workspaces"),{mode:0o700});
      return this;
    }catch(error){await this.release();throw error;}
  }
  async acquireLease() {
    // Local Runtime roots are private to one host/network namespace. A port
    // collision fails closed; no files are reconciled before this lease binds.
    const port=12000+createHash("sha256").update(this.realRoot).digest().readUInt32BE(0)%20000;
    const server=createServer(socket=>socket.destroy());server.maxConnections=1;
    this.lease=server;this.leasePort=port;
    try {
      await new Promise((resolve,reject)=>{server.once("error",reject);server.listen({host:"127.0.0.1",port,exclusive:true},resolve);});
      server.unref();
    }catch(error){await this.releaseLease();throw new CandyContractError("RESOURCE_LIMIT","Artifact root already has a live owner or its ownership lease port is occupied.",{code:error.code});}
  }
  async releaseLease() {const server=this.lease;this.lease=null;if(server)await new Promise(resolve=>server.close(resolve));}
  async check() {
    const info=await lstat(this.root);
    if(!info.isDirectory() || info.isSymbolicLink() || await realpath(this.root)!==this.realRoot)fail("Artifact root identity changed.");
  }
  async removeFile(path) {
    await this.check();
    if(!resolve(path).startsWith(`${this.root}${sep}`))fail("Cleanup path escaped artifact root.");
    const info=await lstat(path);
    if(!info.isFile() || info.isSymbolicLink() || !(await realpath(path)).startsWith(`${this.realRoot}${sep}`))fail("Cleanup target is not an owned regular file.");
    await retryCleanup(()=>unlink(path));
  }
  async createWorkspace(){
    await this.check();const parent=join(this.root,"workspaces"),info=await lstat(parent);
    if(!info.isDirectory() || info.isSymbolicLink() || !(await realpath(parent)).startsWith(`${this.realRoot}${sep}`))fail("Invalid workspace root.");
    return mkdtemp(join(parent,"job-"));
  }
  async removeWorkspace(path) {
    const parent=join(this.root,"workspaces");
    if(!resolve(path).startsWith(`${parent}${sep}`) || resolve(path).slice(parent.length+1).includes(sep))fail("Workspace cleanup escaped its root.");
    await this.check();
    const parentInfo=await lstat(parent),info=await lstat(path);
    if(!parentInfo.isDirectory() || parentInfo.isSymbolicLink() || !info.isDirectory() || info.isSymbolicLink() || !(await realpath(path)).startsWith(`${this.realRoot}${sep}`))fail("Invalid owned workspace.");
    for(const name of await readdir(path)) {
      if(name!=="request.txt")fail("Unrecognized file in owned workspace.");
      await this.removeFile(join(path,name));
    }
    await retryCleanup(()=>rmdir(path));
  }
  async clearWorkspaces() {
    const parent=join(this.root,"workspaces"),info=await lstat(parent);
    if(!info.isDirectory() || info.isSymbolicLink() || !(await realpath(parent)).startsWith(`${this.realRoot}${sep}`))fail("Invalid workspace root.");
    for(const name of await readdir(parent)) {
      if(!/^job-[A-Za-z0-9]{6}$/.test(name))fail("Unrecognized workspace entry.");
      await this.removeWorkspace(join(parent,name));this.recoveredFiles++;
    }
    await retryCleanup(()=>rmdir(parent));
  }
  async release(){
    try{if(this.lock){await this.lock.close();this.lock=null;await this.removeFile(this.lockPath);}}
    finally{await this.releaseLease();}
  }
  async dispose() {
    if(this.disposed)return;
    // A closed override-root handle must reacquire exclusive ownership before
    // disposal; another Runtime may have opened the same directory meanwhile.
    if(!this.lease)await this.initialize();
    try {
    for(const name of await readdir(this.root)) {
      if(artifactFile.test(name))await this.removeFile(join(this.root,name));
      else if(name==="workspaces")await this.clearWorkspaces();
      else if(![".candy-store",".candy-owner"].includes(name))fail("Unknown file prevents store disposal.");
    }
    await this.lock?.close();this.lock=null;await this.removeFile(this.lockPath);
    await this.removeFile(join(this.root,".candy-store"));await rmdir(this.root);
    this.disposed=true;
    } finally {await this.lock?.close();this.lock=null;await this.releaseLease();}
  }
}
